import { sql } from "./db";
import { analizarFormulario, type FichaAnalizada } from "./analysis";
import { avisarAdmin, construirMensaje, resumenDe } from "./telegram";
import type { LeadGuardado } from "./lead";
import type { Solicitud } from "@/formulario/solicitud";

// Lee el formulario con Claude, actualiza la ficha y avisa por Telegram.
// Nunca escribe a la persona. Si algo falla, el aviso sale igualmente.
export async function procesarLead(s: Solicitud, g: LeadGuardado): Promise<void> {
  let ficha: FichaAnalizada | null = null;
  let nota: string | undefined;

  try {
    const tope = Number(process.env.MAX_ANALISIS_DIA ?? 200);
    const [{ n }] = await sql()`
      select count(*)::int as n from setter.fichas
      where modelo is not null and actualizado_at >= date_trunc('day', now())`;
    if (n >= tope) {
      nota = "Tope diario de análisis alcanzado: ficha sin analizar.";
    } else {
      ficha = await analizarFormulario(s);
      if (!ficha) nota = "Claude no devolvió un análisis válido.";
    }
  } catch (e) {
    console.error("Error analizando lead", e instanceof Error ? e.message : "desconocido");
    nota = "Error al analizar el formulario.";
  }

  try {
    if (ficha) {
      await sql().begin(async (tx) => {
        await tx`
          update setter.fichas set
            nivel = ${ficha.nivel},
            dolores = ${tx.json(ficha.dolores)},
            oferta_recomendada = ${ficha.oferta_recomendada},
            encaje = ${ficha.encaje},
            resumen = ${ficha.resumen},
            puntuacion = ${ficha.puntuacion},
            modelo = ${process.env.ANALYSIS_MODEL ?? "claude-opus-5-5"},
            estado = 'analizado'
          where id = ${g.fichaId}`;
        await tx`
          insert into setter.eventos (persona_id, tipo, datos)
          values (${g.personaId}, 'ficha_analizada',
            ${tx.json({ oferta: ficha.oferta_recomendada, encaje: ficha.encaje, puntuacion: ficha.puntuacion, sospechoso: ficha.sospechoso })})`;
      });
    }

    const enviado = await avisarAdmin(construirMensaje(resumenDe(s, g.fichaId), ficha, nota));
    if (enviado) {
      await sql()`
        update setter.fichas set estado = 'notificado', notificado_at = now()
        where id = ${g.fichaId}`;
    }
  } catch (e) {
    console.error("Error guardando ficha o avisando", e instanceof Error ? e.message : "desconocido");
  }
}
