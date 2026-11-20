import { ETIQUETA_PASO, guardarRespuestaSeguimiento, leerPeticionManychat, PASOS_SEGUIMIENTO, respuestasDe, secretoValido, type PasoSeguimiento } from "@/lib/guia";
import { registrarError } from "@/lib/errores";
import { prepararRespuestaPersonal } from "@/lib/respuesta-personal";
import { permitido } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ManyChat manda aquí cada respuesta del flujo «Seguimiento guía» (petición externa). Sin la clave correcta, no hace nada.
// Una petición rechazada se anota (sin datos de la persona ni claves) para poder ver por qué un flujo se quedó parado.
async function rechazar(motivo: string, status: number, extra: Record<string, unknown> = {}) {
  await registrarError("manychat", `Petición de ManyChat rechazada: ${motivo}`, { estado: status, ...extra }).catch(() => undefined);
  return Response.json({ ok: false, error: motivo, ...extra }, { status });
}

async function tratar(req: Request) {
  const esperado = (process.env.MANYCHAT_WEBHOOK_SECRET ?? "").trim();
  const recibido = req.headers.get("x-manychat-secret");
  if (!secretoValido(recibido, esperado)) {
    // El motivo ayuda a configurar ManyChat y no revela ninguna clave.
    const motivo = esperado.length < 16 ? "servidor_sin_clave_valida" : !recibido ? "falta_la_cabecera_x-manychat-secret" : "clave_incorrecta";
    return rechazar(motivo, 401);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!(await permitido(`manychat-respuesta:${ip}`, 120, 10 * 60 * 1000))) return rechazar("demasiadas_peticiones", 429);
  const t = await req.text().catch(() => "");
  if (t.length > 4000) return rechazar("demasiado_grande", 413);
  const d = leerPeticionManychat(t, req.headers.get("content-type"), new URL(req.url).searchParams);
  if (!d) return rechazar("json", 400);
  const mc = String(d.mc ?? "").trim();
  if (!/^\d{3,20}$/.test(mc)) return rechazar("mc", 400);
  const lista = respuestasDe(d);
  if (lista.length === 0) return rechazar("texto_vacio", 400);
  if (lista.some((r) => !(PASOS_SEGUIMIENTO as readonly string[]).includes(r.paso))) return rechazar("paso", 400, { validos: Object.keys(ETIQUETA_PASO) });
  if (lista.some((r) => r.texto === "")) return rechazar("texto_vacio", 400);
  try {
    let guardada = true;
    for (const r of lista) guardada = (await guardarRespuestaSeguimiento(mc, r.paso as PasoSeguimiento, r.texto)) && guardada;
    // Con «qué aprendió» se prepara la respuesta personal que el flujo muestra antes de preguntar por la asesoría.
    // (Una sola pregunta «qué te pareció y qué aprendiste» llega como `valoracion`; las dos separadas, como `opinion` y `aprendio`.)
    const aprendio = lista.find((x) => x.paso === "aprendio")?.texto;
    const valoracion = lista.find((x) => x.paso === "valoracion")?.texto;
    const opinion = lista.find((x) => x.paso === "opinion")?.texto ?? "";
    const respuesta = !guardada ? null : valoracion ? await prepararRespuestaPersonal(mc, valoracion, "") : aprendio ? await prepararRespuestaPersonal(mc, opinion, aprendio) : null;
    if (!guardada) return rechazar("contacto_desconocido", 404);
    return Response.json({ ok: true, ...(respuesta ? { respuesta } : {}) });
  } catch (e) {
    await registrarError("manychat", e, { paso: "guardar respuesta del seguimiento" });
    return Response.json({ ok: false, error: "servidor" }, { status: 500 });
  }
}

// ManyChat puede mandarlo como POST (con cuerpo) o como GET (todo en la dirección, sin cuerpo).
export const POST = tratar;
export const GET = tratar;
