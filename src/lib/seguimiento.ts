import { sql } from "./db";
import type { Fase } from "./panel-util";
import { FASES_FINALES, type Propuesta, type Resultado } from "./seguimiento-util";

// Todas estas acciones devuelven false si la ficha no existe y dejan constancia en el historial.

export async function cambiarFase(fichaId: string, fase: Fase): Promise<boolean> {
  return sql().begin(async (tx) => {
    const [f] = await tx`select fase, persona_id from setter.fichas where id = ${fichaId} for update`;
    if (!f) return false;
    if (f.fase !== fase) {
      await tx`update setter.fichas set fase = ${fase} where id = ${fichaId}`;
      // Si se reabre un lead cerrado, el resultado anterior deja de valer.
      if (f.fase === "vendido" || f.fase === "no_vendido") {
        await tx`delete from setter.resultados where ficha_id = ${fichaId}`;
      }
      await tx`insert into setter.eventos (persona_id, tipo, datos)
               values (${f.persona_id}, 'fase_cambiada', ${tx.json({ de: f.fase, a: fase })})`;
    }
    return true;
  });
}

export async function cambiarPropuesta(fichaId: string, estado: Propuesta): Promise<boolean> {
  return sql().begin(async (tx) => {
    const [f] = await tx`select fase, persona_id from setter.fichas where id = ${fichaId} for update`;
    if (!f) return false;
    await tx`update setter.fichas set propuesta_estado = ${estado},
             propuesta_at = ${estado === "pendiente" ? null : new Date()} where id = ${fichaId}`;
    await tx`insert into setter.eventos (persona_id, tipo, datos)
             values (${f.persona_id}, 'propuesta_cambiada', ${tx.json({ estado })})`;
    // Si ya se le ha escrito, deja de ser un lead "nuevo".
    if ((estado === "enviada" || estado === "manual") && f.fase === "nuevo") {
      await tx`update setter.fichas set fase = 'contactado' where id = ${fichaId}`;
      await tx`insert into setter.eventos (persona_id, tipo, datos)
               values (${f.persona_id}, 'fase_cambiada', ${tx.json({ de: "nuevo", a: "contactado" })})`;
    }
    return true;
  });
}

// "2026-11-12T18:30" se interpreta como hora de Madrid. null quita la reserva.
export async function fijarReserva(fichaId: string, local: string | null): Promise<boolean> {
  return sql().begin(async (tx) => {
    const [f] = await tx`select fase, persona_id from setter.fichas where id = ${fichaId} for update`;
    if (!f) return false;
    await tx`update setter.fichas
             set reserva_at = case when ${local}::text is null then null else (${local}::timestamp at time zone 'Europe/Madrid') end
             where id = ${fichaId}`;
    await tx`insert into setter.eventos (persona_id, tipo, datos)
             values (${f.persona_id}, 'reserva_cambiada', ${tx.json({ reserva: local })})`;
    const nueva: Fase | null =
      local && (f.fase === "nuevo" || f.fase === "contactado")
        ? "llamada_agendada"
        : !local && f.fase === "llamada_agendada"
          ? "contactado"
          : null;
    if (nueva) {
      await tx`update setter.fichas set fase = ${nueva} where id = ${fichaId}`;
      await tx`insert into setter.eventos (persona_id, tipo, datos)
               values (${f.persona_id}, 'fase_cambiada', ${tx.json({ de: f.fase, a: nueva })})`;
    }
    return true;
  });
}

export async function guardarNota(fichaId: string, texto: string): Promise<boolean> {
  return sql().begin(async (tx) => {
    const [f] = await tx`select persona_id from setter.fichas where id = ${fichaId}`;
    if (!f) return false;
    await tx`insert into setter.notas (ficha_id, texto) values (${fichaId}, ${texto})`;
    await tx`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'nota_anadida', '{}'::jsonb)`;
    return true;
  });
}

export async function registrarResultado(fichaId: string, r: Resultado): Promise<boolean> {
  return sql().begin(async (tx) => {
    const [f] = await tx`select fase, persona_id from setter.fichas where id = ${fichaId} for update`;
    if (!f) return false;
    const v = r.resultado === "vendido";
    await tx`
      insert into setter.resultados (ficha_id, resultado, producto, importe_cents, forma_pago, edicion, motivo, nota)
      values (${fichaId}, ${r.resultado}, ${v ? r.producto : null}, ${v ? r.importe_cents : null},
              ${v ? r.forma_pago : null}, ${v ? r.edicion : null}, ${v ? null : r.motivo}, ${r.nota})
      on conflict (ficha_id) do update set
        resultado = excluded.resultado, producto = excluded.producto, importe_cents = excluded.importe_cents,
        forma_pago = excluded.forma_pago, edicion = excluded.edicion, motivo = excluded.motivo, nota = excluded.nota`;
    if (f.fase !== r.resultado) await tx`update setter.fichas set fase = ${r.resultado} where id = ${fichaId}`;
    await tx`insert into setter.eventos (persona_id, tipo, datos)
             values (${f.persona_id}, 'resultado_registrado',
                     ${tx.json(v ? { resultado: r.resultado, producto: r.producto, importe_cents: r.importe_cents } : { resultado: r.resultado, motivo: r.motivo })})`;
    return true;
  });
}

export const esFaseFinal = (f: string) => (FASES_FINALES as string[]).includes(f);
