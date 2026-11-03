import { sql } from "./db";
import { PROMPT_VERSION, analizarFormulario, type FichaAnalizada } from "./analysis";
import { avisarAdmin, construirMensaje, escaparHtml, resumenDe } from "./telegram";
import type { LeadGuardado } from "./lead";
import { programarPropuesta } from "./propuestas";
import type { Solicitud } from "@/formulario/solicitud";
import { registrarError } from "./errores";

// Guarda el análisis en la ficha (con la versión del prompt y los tokens usados) y lo anota en el historial.
export async function guardarAnalisis(fichaId: string, personaId: string, ficha: FichaAnalizada): Promise<void> {
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
        prompt_version = ${PROMPT_VERSION},
        tokens_entrada = ${ficha.tokens?.entrada ?? null},
        tokens_salida = ${ficha.tokens?.salida ?? null},
        estado = 'analizado'
      where id = ${fichaId}`;
    await tx`
      insert into setter.eventos (persona_id, tipo, datos)
      values (${personaId}, 'ficha_analizada',
        ${tx.json({ oferta: ficha.oferta_recomendada, encaje: ficha.encaje, puntuacion: ficha.puntuacion, sospechoso: ficha.sospechoso })})`;
  });
}

// Lee el formulario con Claude, actualiza la ficha y avisa por Telegram.
// Nunca escribe a la persona. Si algo falla, el aviso sale igualmente.
export async function procesarLead(s: Solicitud, g: LeadGuardado, opciones: { historico?: boolean } = {}): Promise<void> {
  let ficha: FichaAnalizada | null = null;
  let nota: string | undefined;

  try {
    const tope = Number(process.env.MAX_ANALISIS_DIA ?? 200);
    const [{ n }] = await sql()`
      select count(*)::int as n from setter.eventos
      where tipo = 'ficha_analizada' and creado_at >= date_trunc('day', now())`;
    if (n >= tope) {
      nota = "Tope diario de análisis alcanzado: ficha sin analizar.";
    } else {
      ficha = await analizarFormulario(s);
      if (!ficha) nota = "Claude no devolvió un análisis válido.";
    }
  } catch (e) {
    await registrarError("claude", e, { ficha: g.fichaId });
    nota = "Error al analizar el formulario.";
  }

  try {
    if (ficha) {
      await guardarAnalisis(g.fichaId, g.personaId, ficha);
    }

    const enviado = await avisarAdmin(construirMensaje(resumenDe(s, g.fichaId), ficha, nota, opciones.historico ? "Cliente anterior" : undefined));
    if (enviado) {
      await sql()`
        update setter.fichas set estado = 'notificado', notificado_at = now()
        where id = ${g.fichaId}`;
    }
  } catch (e) {
    await registrarError("formulario", e, { paso: "guardar ficha o avisar", ficha: g.fichaId });
  }

  // La propuesta se envía más tarde (entre 1 y 3 horas), no ahora. A un cliente anterior no se le manda ninguna.
  if (opciones.historico) return;
  try {
    await programarPropuesta(g.fichaId, g.personaId, s.ruta);
  } catch (e) {
    await registrarError("propuestas", e, { paso: "programar", ficha: g.fichaId });
  }
}

// Si el análisis se cortó (límite de tiempo, reinicio...), el temporizador lo reintenta: hasta 3 veces por ficha,
// entre 5 minutos y 24 horas después. La propuesta no depende de esto: sale igualmente con sus textos fijos.
export async function reanalizarPendientes(): Promise<number> {
  const tope = Number(process.env.MAX_ANALISIS_DIA ?? 200);
  const [{ n }] = await sql()`select count(*)::int as n from setter.eventos where tipo = 'ficha_analizada' and creado_at >= date_trunc('day', now())`;
  if (n >= tope) return 0;
  const reclamadas = await sql()`
    update setter.fichas set analisis_intentos = analisis_intentos + 1
    where id in (
      select id from setter.fichas
      where modelo is null and analisis_intentos < 3 and creado_at < now() - interval '5 minutes' and creado_at > now() - interval '24 hours'
      order by creado_at limit 3 for update skip locked)
    returning id, persona_id, formulario_id`;
  let hechas = 0;
  for (const r of reclamadas) {
    try {
      const [f] = await sql()`
        select fo.ruta, fo.respuestas, fo.signals, p.nombre
        from setter.formularios fo join setter.personas p on p.id = ${r.persona_id} where fo.id = ${r.formulario_id}`;
      if (!f) continue;
      const ficha = await analizarFormulario({ ruta: f.ruta, respuestas: f.respuestas, signals: f.signals } as unknown as Solicitud);
      if (!ficha) continue;
      await guardarAnalisis(r.id as string, r.persona_id as string, ficha);
      hechas++;
      await avisarAdmin(`🔎 Análisis completado de <b>${escaparHtml(String(f.nombre).slice(0, 60))}</b>: encaje ${ficha.encaje}, ${ficha.puntuacion}%.`).catch(() => false);
    } catch (e) {
      await registrarError("claude", e, { paso: "reintento del análisis", ficha: r.id as string });
    }
  }
  return hechas;
}
