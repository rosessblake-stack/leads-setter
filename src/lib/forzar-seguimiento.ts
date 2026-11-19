import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { registrarError } from "@/lib/errores";
import { ErrorManyChat, enviarPropuesta, infoContacto, manychatConfigurado } from "@/lib/manychat";
import { enlacePago, temasDe, VENTANA_SEGURA_H } from "@/lib/propuestas";
import { redactarRespuesta } from "@/lib/respuesta-personal";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";

const dePaso = (notas: { texto: string }[], etiqueta: string) => {
  const n = notas.find((x) => x.texto.startsWith(`Seguimiento de la guía · ${etiqueta}:`));
  return n ? n.texto.slice(n.texto.indexOf(":") + 1).trim() : "";
};

// Para quien contó qué le pareció y qué aprendió y no recibió nada después: se redacta la respuesta personal y se le manda,
// junto con la invitación a la asesoría (con el flujo «Propuesta asesoría», cuyo botón lleva al pago). `pegado` es lo que
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
  const opinion = dePaso(notas, "Qué le pareció la guía");
  const aprendio = pegado?.trim() || dePaso(notas, "Qué aprendió");
  if (!opinion && !aprendio) {
    await avisarAdmin(`⚠️ No hay nada guardado de lo que <b>${escaparHtml(nombre)}</b> contó de la guía. Pega su texto en la ficha y vuelve a pulsar.\n${ficha}`).catch(() => false);
    return true;
  }
  const respuesta = await redactarRespuesta({ nombre: String(f.nombre), opinion, aprendio, temas: temasDe(f.a01) });
  const pagoBase = process.env.STRIPE_LINK_ASESORIA ?? "";
  const enlace = pagoBase ? enlacePago(pagoBase, fichaId, String(f.email ?? "")) : "";
  const invitacion = "Si quieres trabajarlo conmigo en una asesoría de 1 hora, el primer paso para reservarla es el pago.";
  const cuerpo = `${respuesta}\n\n${invitacion} Pulsa el botón para hacerlo.`;
  const aMano = (motivo: string) =>
    avisarAdmin(`⚠️ ${motivo} Envíale tú este mensaje a <b>${escaparHtml(nombre)}</b>:\n\n${escaparHtml(respuesta)}\n\n${escaparHtml(invitacion)}${enlace ? ` Pago: ${escaparHtml(enlace)}` : ""}\n${ficha}`).catch(() => false);
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
    await enviarPropuesta(mc, "asesoria", cuerpo, enlace);
  } catch (e) {
    const incierto = e instanceof ErrorManyChat && !e.definitivo;
    await registrarError("manychat", e, { paso: "forzar la respuesta del seguimiento", ficha: fichaId, incierto });
    await aMano(incierto ? "No sé si el mensaje salió; mira su chat antes de repetirlo." : "No se pudo enviar por ManyChat.");
    return true;
  }
  await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'respuesta_seguimiento_forzada', '{}'::jsonb)`;
  await avisarAdmin(`✅ Respuesta del seguimiento enviada a <b>${escaparHtml(nombre)}</b>:\n\n${escaparHtml(respuesta)}\n\n${escaparHtml(invitacion)}\n${ficha}`).catch(() => false);
  return true;
}
