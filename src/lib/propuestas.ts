import { sql } from "@/lib/db";
import { conexion } from "@/lib/google";
import { ErrorManyChat, enviarPropuesta, infoContacto, manychatConfigurado, type TipoFlujo } from "@/lib/manychat";
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

// El nombre lo escribe la persona y va dentro de un mensaje que se envía solo: se deja únicamente un nombre de pila
// corto, con letras, y sin enlaces, números ni símbolos.
export function nombreSeguro(nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? "";
  if (/[\d@/:.<>\\]/.test(primero)) return ""; // parece un enlace, un usuario o un número: no se usa
  const limpio = primero.replace(/[^\p{L}'’-]/gu, "").slice(0, 30);
  return limpio.length >= 2 ? limpio : "";
}

// Enlace de pago de Stripe con la persona identificada: así el pago se puede asociar a su ficha.
export function enlacePago(base: string, fichaId: string, email: string): string {
  try {
    const u = new URL(base);
    u.searchParams.set("client_reference_id", fichaId);
    if (email) u.searchParams.set("prefilled_email", email);
    return u.toString();
  } catch {
    return base;
  }
}

// Textos de Blake para cada ruta. Sin precios ni promesas que no estén decididas, y sin afirmar nada que no haya pasado
// (el mensaje lo envía el sistema: no dice que Blake lo haya leído).
export function redactar(d: { nombre: string; ruta: "presencial" | "online" | "asesoria"; temas: string[]; enlace: string }): Propuesta {
  const nombre = nombreSeguro(d.nombre);
  const hola = `Hola${nombre ? ` ${nombre}` : ""}, soy Blake.`;
  if (d.ruta === "asesoria") {
    const temas = d.temas.length > 0 ? unir(d.temas) : "los puntos que más te frenan hoy en tu negocio";
    const cuerpo = `${hola} He recibido tu solicitud de asesoría.

En la llamada, que dura 1 hora, vamos a trabajar ${temas}. Te voy a enseñar cómo plantearlo en tu caso, y de ahí sale un plan de acción para todo el mes.

El primer paso para reservarla es el pago. Cuando lo confirmes, te paso el enlace para elegir día y hora: la llamada se agenda una semana después, para poder analizar y preparar tu caso.`;
    return {
      tipo: "asesoria",
      cuerpo: `${cuerpo}\n\nPulsa el botón para hacer el pago.`,
      manual: `${cuerpo}\n\nPago: ${d.enlace}`,
    };
  }
  const que = d.ruta === "presencial" ? "la formación presencial" : "la formación online";
  const cuerpo = `${hola} He recibido tu solicitud para ${que} y quiero hablar contigo antes de nada.

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
export type Modo = { modo: "calibracion" | "automatico"; restantes: number; pausa: boolean; tope: number };
export const TOPE_DIARIO_POR_DEFECTO = 30;
// Solo se escribe a la persona entre estas horas (en su zona horaria).
export const HORA_PRIMERA = 9;
export const HORA_ULTIMA = 21;

export async function leerModo(): Promise<Modo> {
  const [a] = await sql()`select valor from setter.ajustes where clave = 'propuestas'`;
  const v = (a?.valor ?? {}) as Partial<Modo>;
  return {
    modo: v.modo === "automatico" ? "automatico" : "calibracion",
    restantes: Math.max(0, Number(v.restantes ?? 10)),
    pausa: v.pausa === true,
    tope: Math.max(1, Number(v.tope ?? TOPE_DIARIO_POR_DEFECTO)),
  };
}

export async function fijarModo(modo: Modo["modo"], restantes = 10, cambios: Partial<Pick<Modo, "pausa" | "tope">> = {}): Promise<void> {
  const actual = await leerModo();
  const valor = { modo, restantes, pausa: cambios.pausa ?? actual.pausa, tope: cambios.tope ?? actual.tope };
  await sql()`
    insert into setter.ajustes (clave, valor) values ('propuestas', ${sql().json(valor)})
    on conflict (clave) do update set valor = excluded.valor, actualizado_at = now()`;
}

export async function fijarPausa(pausa: boolean): Promise<void> {
  const a = await leerModo();
  await fijarModo(a.modo, a.restantes, { pausa });
}

// Hora local (0-23) de una zona horaria. Si la zona no es válida, se usa la de España.
export function horaLocal(ahora: Date, zona: string | null): number {
  for (const z of [zona, "Europe/Madrid"]) {
    if (!z) continue;
    try {
      return Number(new Intl.DateTimeFormat("en-GB", { timeZone: z, hour: "2-digit", hourCycle: "h23" }).format(ahora));
    } catch {}
  }
  return 12;
}

export const enHorarioDeEnvio = (ahora: Date, zona: string | null) => {
  const h = horaLocal(ahora, zona);
  return h >= HORA_PRIMERA && h <= HORA_ULTIMA;
};

type Fila = {
  id: string;
  persona_id: string;
  nombre: string;
  email: string;
  instagram: string | null;
  zona: string | null;
  manychat_id: string | null;
  ruta: "presencial" | "online" | "asesoria";
  a01: unknown;
  creado_at: Date;
};

// Deja la propuesta preparada para enviarla a mano (calibración o algo que impide el envío automático).
async function preparada(f: Fila, p: Propuesta, nota: string, restantesTexto: string) {
  await sql()`
    update setter.fichas set propuesta_estado = 'pendiente', propuesta_mensaje = ${p.manual}, propuesta_programada_at = null, propuesta_error = ${nota.slice(0, 300) || null}
    where id = ${f.id}`;
  await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'propuesta_preparada', ${sql().json({ nota })})`;
  await avisarAdmin(
    `✍️ <b>Propuesta preparada para ${escaparHtml(f.nombre.slice(0, 60))}</b> (${escaparHtml(restantesTexto)})\n\n${escaparHtml(p.manual)}\n\nEnvíala por Instagram y márcala en la ficha:\n${urlPanel()}/panel/lead/${f.id}`,
  ).catch(() => false);
}

// La vuelve a dejar en cola para el próximo ciclo (por ejemplo, fuera de horario).
async function aplazar(f: Fila) {
  await sql()`update setter.fichas set propuesta_estado = 'pendiente', propuesta_at = null, propuesta_programada_at = now() where id = ${f.id}`;
}

const norm = (x: string | null) => (x ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").toLowerCase();

async function procesarUna(f: Fila, ahora: Date): Promise<"enviada" | "preparada" | "espera"> {
  const ajustes = await leerModo();
  const asesoria = f.ruta === "asesoria";
  const pagoBase = process.env.STRIPE_LINK_ASESORIA ?? "";
  if (asesoria && !pagoBase) {
    await registrarError("propuestas", "Falta el enlace de pago de la asesoría", { ficha: f.id });
    await sql()`update setter.fichas set propuesta_estado = 'pendiente', propuesta_programada_at = null, propuesta_error = 'Falta el enlace de pago de la asesoría' where id = ${f.id}`;
    await avisarAdmin(`⚠️ No se puede preparar la propuesta de ${escaparHtml(f.nombre.slice(0, 60))}: falta el enlace de pago de la asesoría.`).catch(() => false);
    return "preparada";
  }
  const enlace = asesoria ? enlacePago(pagoBase, f.id, f.email) : await crearEnlaceReserva(f.id);
  if (!enlace) {
    await aplazar(f);
    return "espera";
  }
  const p = redactar({ nombre: f.nombre, ruta: f.ruta, temas: asesoria ? temasDe(f.a01) : [], enlace });

  if (ajustes.modo === "calibracion") {
    const restantes = Math.max(0, ajustes.restantes - 1);
    await preparada(f, p, "", `calibración: te quedan ${restantes} antes de pasar a automático`);
    if (restantes === 0) {
      await fijarModo("automatico", 0);
      await avisarAdmin("✅ Terminó la calibración: a partir de ahora las propuestas se envían solas. Puedes pausarlas o volver a calibración desde Ajustes.").catch(() => false);
    } else {
      await fijarModo("calibracion", restantes);
    }
    return "preparada";
  }

  // ----- Automático: se envía solo si todo se ha podido comprobar -----
  if (!manychatConfigurado() || !f.manychat_id) {
    await preparada(f, p, !f.manychat_id ? "Sin identificador de ManyChat: envíala a mano." : "ManyChat no está configurado: envíala a mano.", "no se pudo enviar sola");
    return "preparada";
  }
  if (!asesoria && !(await conexion())) {
    await preparada(f, p, "Google no está conectado: el enlace de reserva no funcionaría. Envíala a mano.", "Google sin conectar");
    return "preparada";
  }

  // El identificador de ManyChat viene de un enlace público: se comprueba que el contacto es de verdad esta persona
  // (su usuario de Instagram coincide con el del formulario) y se mira cuándo interactuó por última vez.
  let info;
  try {
    info = await infoContacto(f.manychat_id);
  } catch (e) {
    await registrarError("manychat", e, { paso: "consultar contacto", ficha: f.id });
    await preparada(f, p, "No se pudo consultar el contacto en ManyChat: envíala a mano.", "no se pudo verificar el contacto");
    return "preparada";
  }
  if (!info.instagram || norm(f.instagram) === "" || info.instagram !== norm(f.instagram)) {
    const motivo = !info.instagram ? "ManyChat no dice el Instagram de este contacto" : "el Instagram del contacto de ManyChat no coincide con el del formulario";
    await registrarError("manychat", `No se envía: ${motivo}`, { ficha: f.id });
    await preparada(f, p, `No se ha enviado sola: ${motivo}. Compruébalo y envíala a mano.`, "no se pudo verificar que es la misma persona");
    return "preparada";
  }
  // Instagram cuenta las 24 h desde la última interacción de la persona (un mensaje o tocar un botón de respuesta),
  // no desde el formulario. Si ManyChat no lo dice, se usa el momento del formulario.
  const desde = info.ultimaInteraccion ?? new Date(f.creado_at);
  const horas = (ahora.getTime() - desde.getTime()) / HORA;
  if (horas > VENTANA_SEGURA_H) {
    await preparada(f, p, `Han pasado más de ${VENTANA_SEGURA_H} h desde su última interacción: Instagram no deja escribir primero. Envíala a mano.`, "ventana de 24 h cerrada");
    return "preparada";
  }
  // Solo de día en su zona horaria; si la ventana está a punto de cerrarse, se prepara a mano en vez de esperar.
  if (!enHorarioDeEnvio(ahora, f.zona)) {
    if (VENTANA_SEGURA_H - horas < 3) {
      await preparada(f, p, "Es de noche para esta persona y la ventana de 24 h se cierra pronto: envíala a mano mañana.", "fuera de horario");
      return "preparada";
    }
    await aplazar(f);
    return "espera";
  }

  try {
    await enviarPropuesta(f.manychat_id, p.tipo, p.cuerpo, enlace);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "error desconocido";
    const incierto = e instanceof ErrorManyChat && !e.definitivo;
    await registrarError("manychat", e, { paso: "enviar propuesta", ficha: f.id, incierto });
    await sql()`update setter.fichas set propuesta_estado = ${incierto ? "incierto" : "no_enviada"}, propuesta_mensaje = ${p.manual}, propuesta_programada_at = null, propuesta_error = ${motivo.slice(0, 300)} where id = ${f.id}`;
    await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, ${incierto ? "propuesta_incierta" : "propuesta_fallida"}, ${sql().json({ motivo: motivo.slice(0, 200) })})`;
    await avisarAdmin(
      incierto
        ? `❓ <b>No sé si la propuesta de ${escaparHtml(f.nombre.slice(0, 60))} salió</b>: ${escaparHtml(motivo)}\nNo se reintenta sola. Mira su chat de Instagram y márcala en la ficha:\n${urlPanel()}/panel/lead/${f.id}`
        : `⚠️ No se pudo enviar la propuesta a <b>${escaparHtml(f.nombre.slice(0, 60))}</b>: ${escaparHtml(motivo)}\n\nEl texto está en la ficha para enviarlo a mano:\n${urlPanel()}/panel/lead/${f.id}`,
    ).catch(() => false);
    return "preparada";
  }
  try {
    await sql()`update setter.fichas set propuesta_estado = 'enviada', propuesta_at = now(), propuesta_mensaje = ${p.manual}, propuesta_programada_at = null, propuesta_error = null,
                fase = case when fase = 'nuevo' then 'contactado' else fase end where id = ${f.id}`;
    await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'propuesta_enviada', ${sql().json({ tipo: p.tipo, automatica: true })})`;
  } catch (e) {
    // Salió, pero no se pudo anotar: queda como incierta para que no se mande otra vez.
    await registrarError("propuestas", e, { paso: "anotar envío", ficha: f.id });
    await sql()`update setter.fichas set propuesta_estado = 'incierto' where id = ${f.id}`.catch(() => undefined);
  }
  await avisarAdmin(`📨 Propuesta enviada a <b>${escaparHtml(f.nombre.slice(0, 60))}</b> (${fechaCorta(ahora)}).\n${urlPanel()}/panel/lead/${f.id}`).catch(() => false);
  return "enviada";
}

// Anota que el temporizador sigue vivo (lo lee /api/salud).
async function latido(r: { enviadas: number; preparadas: number }) {
  await sql()`
    insert into setter.ajustes (clave, valor) values ('latido', ${sql().json({ ...r, en: new Date().toISOString() })})
    on conflict (clave) do update set valor = excluded.valor, actualizado_at = now()`;
}

export async function procesarPropuestas(ahora = new Date()): Promise<{ enviadas: number; preparadas: number }> {
  const resultado = { enviadas: 0, preparadas: 0 };
  const ajustes = await leerModo();

  // Lo que se quedó en «enviando» más de 10 minutos (proceso cortado) no se reintenta: se marca como incierto.
  const colgadas = await sql()`
    update setter.fichas set propuesta_estado = 'incierto', propuesta_error = 'El envío se cortó a medias: no se sabe si salió'
    where propuesta_estado = 'enviando' and propuesta_at < now() - interval '10 minutes'
    returning id`;
  if (colgadas.length > 0) {
    await registrarError("propuestas", "Un envío se cortó a medias y no se sabe si salió", { fichas: colgadas.length });
  }

  if (ajustes.pausa) {
    await latido(resultado);
    return resultado;
  }

  // En automático hay un tope de envíos al día.
  let cupo = 10;
  if (ajustes.modo === "automatico") {
    const [{ n }] = await sql()`select count(*)::int as n from setter.fichas where propuesta_estado = 'enviada' and propuesta_at >= date_trunc('day', now())`;
    cupo = Math.max(0, Math.min(10, ajustes.tope - n));
    if (cupo === 0) {
      await latido(resultado);
      return resultado;
    }
  }

  // Cada ficha la reclama un solo proceso (SKIP LOCKED): si dos ejecuciones coinciden, no se envía dos veces.
  const reclamadas = await sql()`
    update setter.fichas set propuesta_estado = 'enviando', propuesta_at = now()
    where id in (
      select id from setter.fichas
      where propuesta_programada_at <= ${ahora} and propuesta_estado = 'pendiente'
      order by propuesta_programada_at limit ${cupo}
      for update skip locked)
    returning id`;
  if (reclamadas.length === 0) {
    await latido(resultado);
    return resultado;
  }
  const filas = (await sql()`
    select fi.id, fi.persona_id, p.nombre, p.email, p.ig_username as instagram, p.zona_horaria as zona, p.manychat_id, fo.ruta,
           fo.respuestas -> 'A01' -> 'valor' as a01, fo.creado_at
    from setter.fichas fi
    join setter.formularios fo on fo.id = fi.formulario_id
    join setter.personas p on p.id = fi.persona_id
    where fi.id in ${sql()(reclamadas.map((r) => r.id as string))}
    order by fi.propuesta_programada_at`) as unknown as Fila[];
  for (const f of filas) {
    try {
      const r = await procesarUna(f, ahora);
      if (r === "enviada") resultado.enviadas++;
      else if (r === "preparada") resultado.preparadas++;
    } catch (e) {
      await registrarError("propuestas", e, { paso: "procesar ficha", ficha: f.id });
      // Un error inesperado no se reintenta solo (podría haber salido el mensaje): queda para revisarlo a mano.
      await sql()`update setter.fichas set propuesta_estado = 'incierto', propuesta_error = 'Error inesperado al procesar: revísala a mano' where id = ${f.id} and propuesta_estado = 'enviando'`.catch(() => undefined);
    }
  }
  await latido(resultado);
  return resultado;
}
