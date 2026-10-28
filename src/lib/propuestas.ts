import { sql } from "@/lib/db";
import { conexion } from "@/lib/google";
import { enviarPropuesta, manychatConfigurado, type TipoFlujo } from "@/lib/manychat";
import { fechaCorta } from "@/lib/panel-util";
import { crearEnlaceReserva } from "@/lib/reservas";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";
import { urlPanel } from "@/lib/config";
import { registrarError } from "@/lib/errores";

const HORA = 60 * 60 * 1000;
export const ESPERA_MIN_H = 1;
export const ESPERA_MAX_H = 3;
// Instagram solo deja escribir primero durante 24 h desde el último mensaje de la persona: se deja margen.
export const VENTANA_SEGURA_H = 23;

// Lo que la persona marca en la pregunta A01 -> cómo se dice en el mensaje.
const TEMAS: Record<string, string> = {
  "Contenido y redes sociales": "contenido y redes sociales",
  "Clientela (cómo atraer y elegir a tus clientes)": "clientela",
  Precios: "precios",
  "Marca personal": "marca personal",
  "Sistematización y hábitos": "sistematización y hábitos",
  "Equipo y liderazgo": "equipo y liderazgo",
  "Mercado VIP": "mercado VIP",
};

export function unir(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export function temasDe(a01: unknown): string[] {
  const lista = Array.isArray(a01) ? a01 : typeof a01 === "string" ? [a01] : [];
  return lista.map((t) => TEMAS[String(t)]).filter((t): t is string => Boolean(t));
}

export type Propuesta = {
  tipo: TipoFlujo; // qué flujo de ManyChat se usa
  cuerpo: string; // texto del mensaje, sin enlace (el enlace va en el botón)
  manual: string; // el mismo mensaje con el enlace dentro, para copiar y pegar
};

// Textos de Blake para cada ruta. Sin precios ni promesas que no estén decididas.
export function redactar(d: { nombre: string; ruta: "presencial" | "online" | "asesoria"; temas: string[]; enlace: string }): Propuesta {
  const nombre = d.nombre.trim().split(/\s+/)[0] || "";
  const hola = `Hola${nombre ? ` ${nombre}` : ""}, soy Blake.`;
  if (d.ruta === "asesoria") {
    const temas = d.temas.length > 0 ? unir(d.temas) : "los puntos que más te frenan hoy en tu negocio";
    const cuerpo = `${hola} He leído tu solicitud de asesoría con calma.

En la llamada, que dura 1 hora, vamos a trabajar ${temas}. Te voy a enseñar cómo plantearlo en tu caso, y de ahí sale un plan de acción para todo el mes.

El primer paso para reservarla es el pago. Cuando lo confirmes, te paso el enlace para elegir día y hora: la llamada se agenda una semana después, para poder analizar y preparar tu caso.`;
    return {
      tipo: "asesoria",
      cuerpo: `${cuerpo}\n\nPulsa el botón para hacer el pago.`,
      manual: `${cuerpo}\n\nPago: ${d.enlace}`,
    };
  }
  const que = d.ruta === "presencial" ? "la formación presencial" : "la formación online";
  const cuerpo = `${hola} He leído tu solicitud para ${que} con calma y quiero hablar contigo antes de nada.

Es una llamada de 30 minutos para ver si encajamos y resolver tus dudas.`;
  return {
    tipo: "llamada",
    cuerpo: `${cuerpo}\n\nPulsa el botón y elige el día y la hora que mejor te venga.`,
    manual: `${cuerpo}\n\nElige el día y la hora que mejor te venga aquí: ${d.enlace}`,
  };
}

// ----- Programar -----
export function momentoDeEnvio(ahora: Date, azar = Math.random()): Date {
  return new Date(ahora.getTime() + (ESPERA_MIN_H + azar * (ESPERA_MAX_H - ESPERA_MIN_H)) * HORA);
}

// Se llama cuando entra un lead nuevo. «No lo sé» no se automatiza: lo lleva Blake a mano.
export async function programarPropuesta(fichaId: string, personaId: string, ruta: string | null): Promise<void> {
  if (ruta !== "presencial" && ruta !== "online" && ruta !== "asesoria") return;
  // Si esta persona ya tiene propuesta o llamada de otro formulario, no se le manda otra.
  const [previa] = await sql()`
    select 1 as x from setter.fichas where persona_id = ${personaId} and id <> ${fichaId}
      and (propuesta_estado in ('enviada', 'manual') or reserva_at is not null) limit 1`;
  if (previa) {
    await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${personaId}, 'propuesta_omitida', ${sql().json({ motivo: "ya tiene propuesta o llamada" })})`;
    return;
  }
  await sql()`update setter.fichas set propuesta_programada_at = ${momentoDeEnvio(new Date())} where id = ${fichaId}`;
}

// ----- Procesar las que ya toca enviar -----
type Modo = { modo: "calibracion" | "automatico"; restantes: number };

export async function leerModo(): Promise<Modo> {
  const [a] = await sql()`select valor from setter.ajustes where clave = 'propuestas'`;
  const v = (a?.valor ?? {}) as Partial<Modo>;
  return { modo: v.modo === "automatico" ? "automatico" : "calibracion", restantes: Math.max(0, Number(v.restantes ?? 10)) };
}

export async function fijarModo(modo: Modo["modo"], restantes = 10): Promise<void> {
  await sql()`
    insert into setter.ajustes (clave, valor) values ('propuestas', ${sql().json({ modo, restantes })})
    on conflict (clave) do update set valor = excluded.valor, actualizado_at = now()`;
}

type Fila = { id: string; persona_id: string; nombre: string; manychat_id: string | null; ruta: "presencial" | "online" | "asesoria"; a01: unknown; creado_at: Date };

async function preparada(f: Fila, p: Propuesta, nota: string, restantesTexto: string) {
  await sql()`
    update setter.fichas set propuesta_mensaje = ${p.manual}, propuesta_programada_at = null, propuesta_error = ${nota.slice(0, 300) || null}
    where id = ${f.id}`;
  await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'propuesta_preparada', ${sql().json({ nota })})`;
  await avisarAdmin(
    `✍️ <b>Propuesta preparada para ${escaparHtml(f.nombre)}</b> (${escaparHtml(restantesTexto)})\n\n${escaparHtml(p.manual)}\n\nEnvíala por Instagram y márcala en la ficha:\n${urlPanel()}/panel/lead/${f.id}`,
  ).catch(() => false);
}

async function procesarUna(f: Fila, ahora: Date): Promise<"enviada" | "preparada" | "espera"> {
  const ajustes = await leerModo();
  const asesoria = f.ruta === "asesoria";
  const pagoUrl = process.env.STRIPE_LINK_ASESORIA ?? "";
  if (asesoria && !pagoUrl) {
    await registrarError("propuestas", "Falta el enlace de pago de la asesoría", { ficha: f.id });
    await sql()`update setter.fichas set propuesta_programada_at = null, propuesta_error = 'Falta el enlace de pago de la asesoría' where id = ${f.id}`;
    await avisarAdmin(`⚠️ No se puede preparar la propuesta de ${escaparHtml(f.nombre)}: falta el enlace de pago de la asesoría.`).catch(() => false);
    return "preparada";
  }
  const enlace = asesoria ? pagoUrl : await crearEnlaceReserva(f.id);
  if (!enlace) return "espera";
  const p = redactar({ nombre: f.nombre, ruta: f.ruta, temas: asesoria ? temasDe(f.a01) : [], enlace });

  if (ajustes.modo === "calibracion") {
    const restantes = Math.max(0, ajustes.restantes - 1);
    await preparada(f, p, "", `calibración: te quedan ${restantes} antes de pasar a automático`);
    if (restantes === 0) {
      await fijarModo("automatico", 0);
      await avisarAdmin("✅ Terminó la calibración: a partir de ahora las propuestas se envían solas. Puedes volver a calibración desde Ajustes.").catch(() => false);
    } else {
      await fijarModo("calibracion", restantes);
    }
    return "preparada";
  }

  // Automático: solo si todo está listo y la ventana de 24 h sigue abierta.
  const horas = (ahora.getTime() - new Date(f.creado_at).getTime()) / HORA;
  if (!manychatConfigurado() || !f.manychat_id) {
    await preparada(f, p, !f.manychat_id ? "Sin identificador de ManyChat: envíala a mano." : "ManyChat no está configurado: envíala a mano.", "no se pudo enviar sola");
    return "preparada";
  }
  if (horas > VENTANA_SEGURA_H) {
    await preparada(f, p, "Ya pasaron más de 23 h: Instagram no deja escribir primero. Envíala a mano.", "ventana de 24 h casi cerrada");
    return "preparada";
  }
  if (!asesoria && !(await conexion())) {
    await preparada(f, p, "Google no está conectado: el enlace de reserva no funcionaría. Envíala a mano.", "Google sin conectar");
    return "preparada";
  }
  try {
    await enviarPropuesta(f.manychat_id, p.tipo, p.cuerpo, enlace);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "error desconocido";
    await registrarError("manychat", e, { paso: "enviar propuesta", ficha: f.id });
    await sql()`update setter.fichas set propuesta_estado = 'no_enviada', propuesta_mensaje = ${p.manual}, propuesta_programada_at = null, propuesta_error = ${motivo.slice(0, 300)} where id = ${f.id}`;
    await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'propuesta_fallida', ${sql().json({ motivo: motivo.slice(0, 200) })})`;
    await avisarAdmin(`⚠️ No se pudo enviar la propuesta a <b>${escaparHtml(f.nombre)}</b>: ${escaparHtml(motivo)}\n\nEl texto está en la ficha para enviarlo a mano:\n${urlPanel()}/panel/lead/${f.id}`).catch(() => false);
    return "preparada";
  }
  await sql()`update setter.fichas set propuesta_estado = 'enviada', propuesta_at = now(), propuesta_mensaje = ${p.manual}, propuesta_programada_at = null, propuesta_error = null,
              fase = case when fase = 'nuevo' then 'contactado' else fase end where id = ${f.id}`;
  await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'propuesta_enviada', ${sql().json({ tipo: p.tipo, automatica: true })})`;
  await avisarAdmin(`📨 Propuesta enviada a <b>${escaparHtml(f.nombre)}</b> (${fechaCorta(ahora)}).\n${urlPanel()}/panel/lead/${f.id}`).catch(() => false);
  return "enviada";
}

export async function procesarPropuestas(ahora = new Date()): Promise<{ enviadas: number; preparadas: number }> {
  const filas = (await sql()`
    select fi.id, fi.persona_id, p.nombre, p.manychat_id, fo.ruta, fo.respuestas -> 'A01' -> 'valor' as a01, fo.creado_at
    from setter.fichas fi
    join setter.formularios fo on fo.id = fi.formulario_id
    join setter.personas p on p.id = fi.persona_id
    where fi.propuesta_programada_at <= ${ahora} and fi.propuesta_estado = 'pendiente'
    order by fi.propuesta_programada_at limit 10`) as unknown as Fila[];
  let enviadas = 0;
  let preparadas = 0;
  for (const f of filas) {
    try {
      const r = await procesarUna(f, ahora);
      if (r === "enviada") enviadas++;
      else if (r === "preparada") preparadas++;
    } catch (e) {
      await registrarError("propuestas", e, { paso: "procesar ficha", ficha: f.id });
    }
  }
  return { enviadas, preparadas };
}
