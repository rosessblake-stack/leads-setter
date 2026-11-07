import { sql } from "./db";
import { CONSENT_TEXT } from "./consent";
import type { Solicitud } from "@/formulario/solicitud";

export type LeadGuardado = {
  personaId: string;
  formularioId: string;
  fichaId: string;
  videoCodigo: string | null;
};

// Guarda persona, formulario, ficha vacía y evento en una sola transacción.
export async function guardarLead(s: Solicitud, opciones: { historico?: boolean } = {}): Promise<LeadGuardado> {
  return sql().begin(async (tx) => {
    let videoId: string | null = null;
    let videoCodigo: string | null = s.v;
    let videoOrigen: "enlace" | "comentario" | null = null;
    if (s.v) {
      const [video] = await tx`select id from setter.videos where codigo = ${s.v}`;
      videoId = video?.id ?? null;
      if (videoId) videoOrigen = "enlace";
    }
    // Sin código en el enlace, se busca el reel que comentó esa persona (por su usuario de Instagram).
    if (!videoId) {
      // (Se consulta con la misma transacción: hay una sola conexión a la base de datos.)
      const usuario = s.ig_username?.replace(/^@/, "").trim().toLowerCase();
      if (usuario) {
        const [v] = await tx`
          select v.id, v.codigo from setter.comentarios_ig c join setter.videos v on v.ig_media_id = c.ig_media_id
          where lower(c.username) = ${usuario} and c.comentado_at > now() - interval '14 days'
          order by c.comentado_at desc limit 1`;
        if (v) {
          videoId = v.id as string;
          videoCodigo = v.codigo as string;
          videoOrigen = "comentario";
        }
      }
    }

    // Si ese ID de ManyChat ya pertenece a otra persona, no lo reasignamos.
    let manychat: string | null = s.mc;
    let manychatEnConflicto = false;
    if (manychat) {
      const [otro] = await tx`
        select id from setter.personas
        where manychat_id = ${manychat} and lower(email) <> ${s.email}`;
      if (otro) {
        manychat = null;
        manychatEnConflicto = true;
      }
    }

    const [persona] = await tx`
      insert into setter.personas
        (email, nombre, telefono, ig_username, manychat_id, pais, zona_horaria, consentimiento_at, consentimiento_texto)
      values
        (${s.email}, ${s.nombre}, ${s.telefono}, ${s.ig_username}, ${manychat}, ${s.pais}, ${s.zona_horaria}, now(), ${CONSENT_TEXT})
      on conflict ((lower(email))) do update set
        nombre = excluded.nombre,
        telefono = coalesce(excluded.telefono, setter.personas.telefono),
        ig_username = coalesce(excluded.ig_username, setter.personas.ig_username),
        manychat_id = coalesce(excluded.manychat_id, setter.personas.manychat_id),
        pais = coalesce(excluded.pais, setter.personas.pais),
        zona_horaria = coalesce(excluded.zona_horaria, setter.personas.zona_horaria),
        consentimiento_at = now(),
        consentimiento_texto = excluded.consentimiento_texto
      returning id`;

    const [formulario] = await tx`
      insert into setter.formularios
        (persona_id, video_id, origen, interes, como_nos_conociste, respuestas, ruta, iniciado_at, signals, version_formulario)
      values
        (${persona.id}, ${videoId}, 'web', ${s.interes}, ${s.como_nos_conociste}, ${tx.json(s.respuestas)},
         ${s.ruta}, ${s.iniciado_at}, ${tx.json(s.signals)}, ${s.version})
      returning id`;

    const [ficha] = await tx`
      insert into setter.fichas (persona_id, formulario_id, origen)
      values (${persona.id}, ${formulario.id}, ${opciones.historico ? "historico" : "sistema"})
      returning id`;

    await tx`
      insert into setter.eventos (persona_id, video_id, tipo, datos)
      values (${persona.id}, ${videoId}, 'formulario_enviado',
        ${tx.json({
          codigo_video: s.v,
          video_encontrado: videoId !== null,
          video_origen: videoOrigen,
          ruta: s.ruta,
          manychat_en_conflicto: manychatEnConflicto,
          cliente_anterior: Boolean(opciones.historico),
        })})`;

    return {
      personaId: persona.id,
      formularioId: formulario.id,
      fichaId: ficha.id,
      videoCodigo,
    };
  });
}
