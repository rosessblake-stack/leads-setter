import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { registrarError } from "@/lib/errores";
import { ErrorManyChat, enviarMensaje, infoContacto, manychatConfigurado } from "@/lib/manychat";
import { enlacePago, temasDe, VENTANA_SEGURA_H } from "@/lib/propuestas";
import { redactarRespuesta } from "@/lib/respuesta-personal";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";

const dePaso = (notas: { texto: string }[], etiqueta: string) => {
  const n = notas.find((x) => x.texto.startsWith(`Seguimiento de la guía · ${etiqueta}:`));
  return n ? n.texto.slice(n.texto.indexOf(":") + 1).trim() : "";
};

// Para quien contó qué le pareció y qué aprendió y no recibió nada después: se redacta la respuesta personal y se le manda,
// junto con la invitación a la asesoría, en un mensaje directo con un botón al pago. `pegado` es lo que
// contó, si no quedó guardado (por ejemplo, si la petición de ManyChat falló).
export async function forzarRespuestaSeguimiento(fichaId: string, pegado: string | null): Promise<boolean> {
  const [f] = await sql()`
    select p.id as persona_id, p.nombre, p.email, p.manychat_id, fo.respuestas -> 'A01' -> 'valor' as a01
    from setter.fichas fi join setter.personas p on p.id = fi.persona_id join setter.formularios fo on fo.id = fi.formulario_id
    where fi.id = ${fichaId}`;
  if (!f) return false;
  const nombre = String(f.nombre).slice(0, 60);
  const ficha = `${urlPanel()}/panel/lead/${fichaId}`;
  const notas = (await sql()`select texto from setter.notas where ficha_id = ${fichaId} order by creado_at desc`) as unknown as { texto: string }[];
  const opinion = dePaso(notas, "Qué le pareció la guía") || dePaso(notas, "Qué le pareció la guía y qué aprendió");
  const aprendio = pegado?.trim() || dePaso(notas, "Qué aprendió");
  if (!opinion && !aprendio) {
    await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'respuesta_seguimiento_forzada', ${sql().json({ enviado: false, motivo: "sin texto" })})`.catch(() => undefined);
    await avisarAdmin(`⚠️ No hay nada guardado de lo que <b>${escaparHtml(nombre)}</b> contó de la guía. Pega su texto en la ficha y vuelve a pulsar.\n${ficha}`).catch(() => false);
    return true;
  }
  const respuesta = await redactarRespuesta({ nombre: String(f.nombre), opinion, aprendio, temas: temasDe(f.a01) });
  const pagoBase = process.env.STRIPE_LINK_ASESORIA ?? "";
  const enlace = pagoBase ? enlacePago(pagoBase, fichaId, String(f.email ?? "")) : "";
  const invitacion = "Si quieres trabajarlo conmigo en una asesoría de 1 hora, el primer paso para reservarla es el pago.";
  const cuerpo = `${respuesta}\n\n${invitacion} Pulsa el botón para hacerlo.${enlace ? `\n\nSi el botón no te abre, entra aquí: ${enlace}` : ""}`;
  const intento = (enviado: boolean) =>
    sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'respuesta_seguimiento_forzada', ${sql().json({ enviado })})`.catch(() => undefined);
  const aMano = async (motivo: string) => {
    await intento(false);
    await avisarAdmin(`⚠️ ${motivo} Envíale tú este mensaje a <b>${escaparHtml(nombre)}</b>:\n\n${escaparHtml(respuesta)}\n\n${escaparHtml(invitacion)}${enlace ? ` Pago: ${escaparHtml(enlace)}` : ""}\n${ficha}`).catch(() => false);
  };
  const mc = f.manychat_id as string | null;
  if (!mc || !manychatConfigurado() || !enlace) {
    await aMano(!mc ? "No viene de ManyChat." : !enlace ? "Falta el enlace de pago de la asesoría." : "ManyChat no está configurado.");
    return true;
  }
  try {
    const info = await infoContacto(mc);
    const horas = info.ultimaInteraccion ? (Date.now() - info.ultimaInteraccion.getTime()) / 3600_000 : null;
    if (horas !== null && horas > VENTANA_SEGURA_H) {
      await aMano(`Han pasado más de ${VENTANA_SEGURA_H} h desde su última interacción y Instagram no deja escribir primero.`);
      return true;
    }
    // Mensaje directo (sin flujos «Propuesta…»): la campaña solo usa «Cobrar Historia» y «Seguimiento guía».
    await enviarMensaje(mc, cuerpo, { caption: "Reservar mi asesoría", url: enlace });
  } catch (e) {
    const incierto = e instanceof ErrorManyChat && !e.definitivo;
    await registrarError("manychat", e, { paso: "forzar la respuesta del seguimiento", ficha: fichaId, incierto });
    await aMano(incierto ? "No sé si el mensaje salió; mira su chat antes de repetirlo." : "No se pudo enviar por ManyChat.");
    return true;
  }
  await intento(true);
  await avisarAdmin(`✅ Respuesta del seguimiento enviada a <b>${escaparHtml(nombre)}</b>:\n\n${escaparHtml(respuesta)}\n\n${escaparHtml(invitacion)}\n${ficha}`).catch(() => false);
  return true;
}

// Red de seguridad: a quien ya contó qué aprendió y 20 minutos después sigue sin recibir nada (ni respuesta personal ni pregunta de la
// asesoría), se le manda la respuesta con la invitación. También atiende las peticiones que Blake deja «solicitadas» desde fuera del panel.
// Máximo 3 por pasada y solo dentro de la ventana de 24 h de Instagram.
export async function procesarRespuestasAtascadas(): Promise<number> {
  const filas = (await sql()`
    select fi.id as ficha_id from setter.eventos e
    join setter.personas p on p.id = e.persona_id
    join lateral (select id, fase from setter.fichas where persona_id = p.id order by creado_at desc limit 1) fi on true
    where p.manychat_id is not null and fi.fase not in ('vendido', 'no_vendido', 'descartado')
      and (
        (e.tipo = 'respuesta_seguimiento_solicitada'
          and not exists (select 1 from setter.eventos x where x.persona_id = p.id and x.tipo = 'respuesta_seguimiento_forzada' and x.creado_at > e.creado_at))
        or
        (e.tipo = 'seguimiento_respuesta' and e.datos ->> 'paso' in ('aprendio', 'valoracion')
          and e.creado_at < now() - interval '20 minutes' and e.creado_at > now() - interval '22 hours'
          and not exists (select 1 from setter.eventos x where x.persona_id = p.id and (
                x.tipo in ('respuesta_personal', 'respuesta_seguimiento_forzada', 'respuesta_seguimiento_solicitada')
                or (x.tipo = 'seguimiento_respuesta' and x.datos ->> 'paso' in ('asesoria', 'motivo')))))
      )
    group by fi.id order by min(e.creado_at) limit 3`) as unknown as { ficha_id: string }[];
  let n = 0;
  for (const r of filas) {
    try {
      if (await forzarRespuestaSeguimiento(r.ficha_id, null)) n++;
    } catch (e) {
      await registrarError("manychat", e, { paso: "respuesta atascada del seguimiento", ficha: r.ficha_id });
    }
  }
  return n;
}
