import { campanaDe } from "@/formulario/campanas";
import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { registrarError } from "@/lib/errores";
import { forzarRespuestaSeguimiento } from "@/lib/forzar-seguimiento";
import { ErrorManyChat, infoContacto, lanzarSeguimientoGuia, manychatConfigurado } from "@/lib/manychat";
import { enlacePago, enviarPropuestaAhora, VENTANA_SEGURA_H } from "@/lib/propuestas";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";

// Botón «Enviar ahora» de la ficha. Según de dónde venga el lead, hace lo que toca para que no se quede parado:
//  · lead de una campaña con seguimiento propio (como COBRAR): lanza ya el seguimiento de la guía, o, si ya contó algo y no recibió
//    respuesta, le manda la respuesta personal;
//  · cualquier otro lead: envía ya la propuesta.
// El resultado le llega a Blake por Telegram. Devuelve false si la ficha no existe.
export async function enviarAhora(fichaId: string): Promise<boolean> {
  const [f] = await sql()`
    select fi.id, fi.persona_id, p.nombre, p.email, p.manychat_id, v.codigo as video_codigo
    from setter.fichas fi join setter.personas p on p.id = fi.persona_id join setter.formularios fo on fo.id = fi.formulario_id
    left join setter.videos v on v.id = fo.video_id where fi.id = ${fichaId}`;
  if (!f) return false;
  if (!campanaDe(f.video_codigo as string | null)?.sinPropuestaAutomatica) return enviarPropuestaAhora(fichaId);

  const nombre = escaparHtml(String(f.nombre).slice(0, 60));
  const ficha = `${urlPanel()}/panel/lead/${fichaId}`;
  const [e] = await sql()`
    select bool_or(tipo = 'seguimiento_guia_lanzado') as lanzado,
           bool_or(tipo = 'seguimiento_respuesta' and datos ->> 'paso' in ('valoracion', 'opinion', 'aprendio')) as conto
    from setter.eventos where persona_id = ${f.persona_id}`;
  if (e?.conto) return forzarRespuestaSeguimiento(fichaId, null);
  if (e?.lanzado) {
    await avisarAdmin(`ℹ️ A <b>${nombre}</b> ya se le lanzó el seguimiento y todavía no ha contado qué le pareció la guía, así que no hay nada que enviar. Si te escribió algo en el chat, pégalo en «Responder a lo que contó de la guía».\n${ficha}`).catch(() => false);
    return true;
  }
  const mc = f.manychat_id as string | null;
  if (!mc || !manychatConfigurado() || !process.env.STRIPE_LINK_ASESORIA) {
    await avisarAdmin(`⚠️ No se puede lanzar el seguimiento a <b>${nombre}</b>: ${!mc ? "no viene de ManyChat" : !process.env.STRIPE_LINK_ASESORIA ? "falta el enlace de pago de la asesoría" : "ManyChat no está configurado"}. Escríbele tú.\n${ficha}`).catch(() => false);
    return true;
  }
  try {
    const info = await infoContacto(mc);
    const horas = info.ultimaInteraccion ? (Date.now() - info.ultimaInteraccion.getTime()) / 3600_000 : null;
    if (horas !== null && horas > VENTANA_SEGURA_H) {
      await avisarAdmin(`⚠️ No se lanza el seguimiento a <b>${nombre}</b>: han pasado más de ${VENTANA_SEGURA_H} h desde su última interacción y Instagram no deja escribir primero. Escríbele tú.\n${ficha}`).catch(() => false);
      return true;
    }
    // Se reclama antes de enviar, como hace el temporizador: si algo se corta, no se repite solo.
    const [reclamado] = await sql()`
      insert into setter.eventos (persona_id, tipo, datos)
      select ${f.persona_id}, 'seguimiento_guia_lanzado', '{"manual":true}'::jsonb
      where not exists (select 1 from setter.eventos x where x.persona_id = ${f.persona_id} and x.tipo in ('seguimiento_guia_lanzado', 'seguimiento_guia_omitido'))
      returning id`;
    if (!reclamado) return true;
    await lanzarSeguimientoGuia(mc, enlacePago(process.env.STRIPE_LINK_ASESORIA, fichaId, String(f.email ?? "")));
    await avisarAdmin(`✅ Seguimiento de la guía lanzado ahora a <b>${nombre}</b>.\n${ficha}`).catch(() => false);
  } catch (err) {
    const incierto = err instanceof ErrorManyChat && !err.definitivo;
    await registrarError("manychat", err, { paso: "enviar ahora el seguimiento", ficha: fichaId, incierto });
    await avisarAdmin(`⚠️ ${incierto ? "No sé si salió" : "No se pudo lanzar"} el seguimiento a <b>${nombre}</b>: ${escaparHtml(err instanceof Error ? err.message : "error")}\n${ficha}`).catch(() => false);
  }
  return true;
}
