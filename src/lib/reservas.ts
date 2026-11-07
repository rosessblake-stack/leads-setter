import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { proponer, REGLAS, type Propuesta, type Tipo } from "@/lib/disponibilidad";
import { borrarEvento, crearEvento, ocupadosEntre } from "@/lib/google";
import { huella, nuevoSecreto, FORMATO_SECRETO } from "@/lib/panel";
import { enlacePreparacion } from "@/lib/preparacion";
import { escaparHtml } from "@/lib/telegram";
import { fechaCorta } from "@/lib/panel-util";
import { registrarError } from "@/lib/errores";

const DIA = 24 * 60 * 60 * 1000;

export type Enlace = {
  id: string;
  ficha_id: string;
  tipo: Tipo;
  pago_at: Date | null;
  expira_at: Date;
  nombre: string;
  email: string;
  zona: string | null;
  reserva: { inicio: Date; fin: Date; meet_url: string | null } | null;
};

// Crea un enlace personal de reserva. Si es de asesoría, se entiende que el pago ya está confirmado.
export async function crearEnlaceReserva(fichaId: string): Promise<string | null> {
  const [f] = await sql()`
    select fo.ruta from setter.fichas fi join setter.formularios fo on fo.id = fi.formulario_id where fi.id = ${fichaId}`;
  if (!f) return null;
  const tipo: Tipo = f.ruta === "asesoria" ? "asesoria" : "venta";
  const token = nuevoSecreto();
  const dias = tipo === "asesoria" ? 45 : 7;
  await sql()`
    insert into setter.enlaces_reserva (token_hash, ficha_id, tipo, pago_at, expira_at)
    values (${huella(token)}, ${fichaId}, ${tipo}, ${tipo === "asesoria" ? new Date() : null}, ${new Date(Date.now() + dias * DIA)})`;
  const [p] = await sql()`select persona_id from setter.fichas where id = ${fichaId}`;
  await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${p.persona_id}, 'enlace_reserva_creado', ${sql().json({ tipo })})`;
  return `${urlPanel()}/reservar/${token}`;
}

export async function cargarEnlace(token: string): Promise<Enlace | null> {
  if (!FORMATO_SECRETO.test(token)) return null;
  const [e] = await sql()`
    select e.id, e.ficha_id, e.tipo, e.pago_at, e.expira_at, p.nombre, p.email, p.zona_horaria as zona
    from setter.enlaces_reserva e
    join setter.fichas fi on fi.id = e.ficha_id
    join setter.personas p on p.id = fi.persona_id
    where e.token_hash = ${huella(token)}`;
  if (!e) return null;
  const [r] = await sql()`select inicio, fin, meet_url from setter.reservas where ficha_id = ${e.ficha_id} and estado = 'confirmada'`;
  return { ...(e as unknown as Omit<Enlace, "reserva">), reserva: (r as Enlace["reserva"]) ?? null };
}

export async function propuestaPara(e: Enlace, ahora = new Date()): Promise<Propuesta> {
  const hasta = new Date(ahora.getTime() + (REGLAS.asesoriaEsperaDias + REGLAS.asesoriaVentanaDias + 7) * DIA);
  const ocupados = await ocupadosEntre(ahora, hasta);
  return proponer(e.tipo, ocupados, ahora, e.pago_at ?? undefined);
}

export type Confirmacion = { ok: true; aviso: string } | { ok: false; error: string };

export async function confirmarReserva(token: string, inicioIso: string): Promise<Confirmacion> {
  const e = await cargarEnlace(token);
  if (!e || e.expira_at.getTime() < Date.now()) return { ok: false, error: "Este enlace ya no es válido." };
  if (e.reserva) return { ok: false, error: "Ya hay una llamada reservada." };
  const inicio = new Date(inicioIso);
  if (Number.isNaN(inicio.getTime())) return { ok: false, error: "Elige uno de los horarios." };

  // Se vuelve a calcular con el calendario de ahora mismo: solo vale un horario que siga libre.
  const propuesta = await propuestaPara(e);
  const hueco = propuesta.dias.flatMap((d) => d.huecos).find((h) => h.inicio.getTime() === inicio.getTime());
  if (!hueco) return { ok: false, error: "Ese horario ya no está disponible. Elige otro." };

  const tipoTexto = e.tipo === "asesoria" ? "Asesoría 1:1" : "Llamada";
  // 1) Se reclama el hueco en la base de datos. Hay una restricción de exclusión sobre el rango que ocupa cada
  //    llamada (desde su inicio hasta 1 h después de acabar): si otra persona lo reservó a la vez, esto falla.
  let reservaId: string;
  try {
    const [rv] = await sql()`
      insert into setter.reservas (ficha_id, enlace_id, tipo, inicio, fin, ocupa)
      values (${e.ficha_id}, ${e.id}, ${e.tipo}, ${hueco.inicio}, ${hueco.fin},
              tstzrange(${hueco.inicio}::timestamptz, ${new Date(hueco.fin.getTime() + 60 * 60 * 1000)}::timestamptz))
      returning id`;
    reservaId = rv.id as string;
  } catch (err) {
    const codigo = (err as { code?: string }).code;
    if (codigo === "23P01") return { ok: false, error: "Ese horario se acaba de ocupar. Elige otro." };
    if (codigo === "23505") return { ok: false, error: "Ya hay una llamada reservada." };
    throw err;
  }

  // 2) El evento de Google se crea fuera de la transacción (dentro solo hay una conexión a la base de datos).
  //    Si falla, se libera el hueco.
  let ev: { id: string; meet: string | null };
  try {
    ev = await crearEvento({
      titulo: `${tipoTexto} con ${e.nombre}`,
      descripcion: `Reservada desde el enlace personal. Ficha: ${urlPanel()}/panel/lead/${e.ficha_id}`,
      inicio: hueco.inicio,
      fin: hueco.fin,
      invitado: e.email,
      peticion: e.id,
    });
  } catch (err) {
    await sql()`delete from setter.reservas where id = ${reservaId}`.catch(() => undefined);
    throw err;
  }

  // 3) Se completa la reserva. Si esto falla, se deshace todo (evento y hueco) para no dejar huecos fantasma.
  try {
    await sql().begin(async (tx) => {
      const [f] = await tx`select fase, persona_id from setter.fichas where id = ${e.ficha_id} for update`;
      await tx`update setter.reservas set google_event_id = ${ev.id}, meet_url = ${ev.meet} where id = ${reservaId}`;
      await tx`update setter.fichas set reserva_at = ${hueco.inicio} where id = ${e.ficha_id}`;
      await tx`insert into setter.eventos (persona_id, tipo, datos)
               values (${f.persona_id}, 'reserva_confirmada', ${tx.json({ tipo: e.tipo, inicio: hueco.inicio.toISOString() })})`;
      if (f.fase === "nuevo" || f.fase === "contactado") {
        await tx`update setter.fichas set fase = 'llamada_agendada' where id = ${e.ficha_id}`;
        await tx`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'fase_cambiada', ${tx.json({ de: f.fase, a: "llamada_agendada" })})`;
      }
    });
  } catch (err) {
    await borrarEvento(ev.id).catch(() => undefined);
    await sql()`delete from setter.reservas where id = ${reservaId}`.catch(() => undefined);
    throw err;
  }

  // Asesoría: queda lista la preparación (preguntas largas) para que la persona la rellene antes de la llamada.
  if (e.tipo === "asesoria") await enlacePreparacion(e.ficha_id).catch((err) => registrarError("reservas", err, { paso: "preparación al reservar", ficha: e.ficha_id }));
  return {
    ok: true,
    aviso: `📅 <b>${escaparHtml(e.nombre)}</b> ha reservado ${e.tipo === "asesoria" ? "su asesoría" : "una llamada"}: ${escaparHtml(fechaCorta(hueco.inicio))}\n${urlPanel()}/panel/lead/${e.ficha_id}`,
  };
}
