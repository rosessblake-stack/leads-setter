import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { proponer, REGLAS, type Propuesta, type Tipo } from "@/lib/disponibilidad";
import { borrarEvento, crearEvento, ocupadosEntre } from "@/lib/google";
import { huella, nuevoSecreto, FORMATO_SECRETO } from "@/lib/panel";
import { escaparHtml } from "@/lib/telegram";
import { fechaCorta } from "@/lib/panel-util";

const DIA = 24 * 60 * 60 * 1000;

export type Enlace = {
  id: string;
  ficha_id: string;
  tipo: Tipo;
  pago_at: Date | null;
  expira_at: Date;
  nombre: string;
  email: string;
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
    select e.id, e.ficha_id, e.tipo, e.pago_at, e.expira_at, p.nombre, p.email
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
  // El evento se crea antes de la transacción: dentro de ella solo hay una conexión a la base de datos disponible.
  const ev = await crearEvento({
    titulo: `${tipoTexto} con ${e.nombre}`,
    descripcion: `Reservada desde el enlace personal. Ficha: ${urlPanel()}/panel/lead/${e.ficha_id}`,
    inicio: hueco.inicio,
    fin: hueco.fin,
    invitado: e.email,
    peticion: e.id,
  });
  let resultado: "ok" | "ya" | null;
  try {
    resultado = await sql().begin(async (tx) => {
      const [f] = await tx`select fase, persona_id from setter.fichas where id = ${e.ficha_id} for update`;
      if (!f) return null;
      const [ya] = await tx`select 1 as x from setter.reservas where ficha_id = ${e.ficha_id} and estado = 'confirmada'`;
      if (ya) return "ya" as const;
      await tx`insert into setter.reservas (ficha_id, enlace_id, tipo, inicio, fin, google_event_id, meet_url)
               values (${e.ficha_id}, ${e.id}, ${e.tipo}, ${hueco.inicio}, ${hueco.fin}, ${ev.id}, ${ev.meet})`;
      await tx`update setter.fichas set reserva_at = ${hueco.inicio} where id = ${e.ficha_id}`;
      await tx`insert into setter.eventos (persona_id, tipo, datos)
               values (${f.persona_id}, 'reserva_confirmada', ${tx.json({ tipo: e.tipo, inicio: hueco.inicio.toISOString() })})`;
      if (f.fase === "nuevo" || f.fase === "contactado") {
        await tx`update setter.fichas set fase = 'llamada_agendada' where id = ${e.ficha_id}`;
        await tx`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'fase_cambiada', ${tx.json({ de: f.fase, a: "llamada_agendada" })})`;
      }
      return "ok" as const;
    });
  } catch (err) {
    await borrarEvento(ev.id).catch(() => {});
    throw err;
  }
  if (resultado !== "ok") await borrarEvento(ev.id).catch(() => {});
  if (resultado === "ya") return { ok: false, error: "Ya hay una llamada reservada." };
  if (resultado === null) return { ok: false, error: "Este enlace ya no es válido." };

  return {
    ok: true,
    aviso: `📅 <b>${escaparHtml(e.nombre)}</b> ha reservado ${e.tipo === "asesoria" ? "su asesoría" : "una llamada"}: ${escaparHtml(fechaCorta(hueco.inicio))}\n${urlPanel()}/panel/lead/${e.ficha_id}`,
  };
}
