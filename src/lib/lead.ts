import { sql } from "./db";
import { CONSENT_TEXT } from "./consent";
import type { Formulario } from "./validation";

export type LeadGuardado = {
  personaId: string;
  formularioId: string;
  fichaId: string;
  videoCodigo: string | null;
};

// Guarda persona, formulario, ficha vacía y evento en una sola transacción.
export async function guardarLead(f: Formulario): Promise<LeadGuardado> {
  return sql().begin(async (tx) => {
    let videoId: string | null = null;
    if (f.v) {
      const [video] = await tx`select id from setter.videos where codigo = ${f.v}`;
      videoId = video?.id ?? null;
    }

    // Si ese ID de ManyChat ya pertenece a otra persona, no lo reasignamos.
    let manychat: string | null = f.mc ?? null;
    let manychatEnConflicto = false;
    if (manychat) {
      const [otro] = await tx`
        select id from setter.personas
        where manychat_id = ${manychat} and lower(email) <> ${f.email}`;
      if (otro) {
        manychat = null;
        manychatEnConflicto = true;
      }
    }

    const ig = f.ig_username ? f.ig_username : null;
    const [persona] = await tx`
      insert into setter.personas
        (email, nombre, ig_username, manychat_id, pais, zona_horaria, consentimiento_at, consentimiento_texto)
      values
        (${f.email}, ${f.nombre}, ${ig}, ${manychat}, ${f.pais}, ${f.zona_horaria ?? null}, now(), ${CONSENT_TEXT})
      on conflict ((lower(email))) do update set
        nombre = excluded.nombre,
        ig_username = coalesce(excluded.ig_username, setter.personas.ig_username),
        manychat_id = coalesce(excluded.manychat_id, setter.personas.manychat_id),
        pais = excluded.pais,
        zona_horaria = coalesce(excluded.zona_horaria, setter.personas.zona_horaria),
        consentimiento_at = now(),
        consentimiento_texto = excluded.consentimiento_texto
      returning id`;

    const respuestas = {
      ciudad: f.ciudad ?? null,
      nivel: f.nivel,
      dificultad: f.dificultad,
      objetivo: f.objetivo,
    };
    const [formulario] = await tx`
      insert into setter.formularios (persona_id, video_id, origen, interes, como_nos_conociste, respuestas)
      values (${persona.id}, ${videoId}, 'web', ${f.interes}, ${f.como_nos_conociste ?? null}, ${tx.json(respuestas)})
      returning id`;

    const [ficha] = await tx`
      insert into setter.fichas (persona_id, formulario_id)
      values (${persona.id}, ${formulario.id})
      returning id`;

    await tx`
      insert into setter.eventos (persona_id, video_id, tipo, datos)
      values (${persona.id}, ${videoId}, 'formulario_enviado',
        ${tx.json({
          codigo_video: f.v ?? null,
          video_encontrado: videoId !== null,
          interes: f.interes,
          manychat_en_conflicto: manychatEnConflicto,
        })})`;

    return {
      personaId: persona.id,
      formularioId: formulario.id,
      fichaId: ficha.id,
      videoCodigo: f.v ?? null,
    };
  });
}
