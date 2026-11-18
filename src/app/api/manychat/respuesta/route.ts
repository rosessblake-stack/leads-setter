import { ETIQUETA_PASO, guardarRespuestaSeguimiento, leerPeticionManychat, PASOS_SEGUIMIENTO, respuestasDe, secretoValido, type PasoSeguimiento } from "@/lib/guia";
import { registrarError } from "@/lib/errores";
import { permitido } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ManyChat manda aquí cada respuesta del flujo «Seguimiento guía» (petición externa). Sin la clave correcta, no hace nada.
async function tratar(req: Request) {
  const esperado = (process.env.MANYCHAT_WEBHOOK_SECRET ?? "").trim();
  const recibido = req.headers.get("x-manychat-secret");
  if (!secretoValido(recibido, esperado)) {
    // El motivo ayuda a configurar ManyChat y no revela ninguna clave.
    const motivo = esperado.length < 16 ? "servidor_sin_clave_valida" : !recibido ? "falta_la_cabecera_x-manychat-secret" : "clave_incorrecta";
    return Response.json({ ok: false, error: motivo }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!(await permitido(`manychat-respuesta:${ip}`, 120, 10 * 60 * 1000))) return Response.json({ ok: false, error: "demasiadas_peticiones" }, { status: 429 });
  const t = await req.text().catch(() => "");
  if (t.length > 4000) return Response.json({ ok: false, error: "demasiado_grande" }, { status: 413 });
  const d = leerPeticionManychat(t, req.headers.get("content-type"), new URL(req.url).searchParams);
  if (!d) return Response.json({ ok: false, error: "json" }, { status: 400 });
  const mc = String(d.mc ?? "").trim();
  if (!/^\d{3,20}$/.test(mc)) return Response.json({ ok: false, error: "mc" }, { status: 400 });
  const lista = respuestasDe(d);
  if (lista.length === 0) return Response.json({ ok: false, error: "texto_vacio" }, { status: 400 });
  if (lista.some((r) => !(PASOS_SEGUIMIENTO as readonly string[]).includes(r.paso))) return Response.json({ ok: false, error: "paso", validos: Object.keys(ETIQUETA_PASO) }, { status: 400 });
  if (lista.some((r) => r.texto === "")) return Response.json({ ok: false, error: "texto_vacio" }, { status: 400 });
  try {
    let guardada = true;
    for (const r of lista) guardada = (await guardarRespuestaSeguimiento(mc, r.paso as PasoSeguimiento, r.texto)) && guardada;
    return Response.json({ ok: guardada, ...(guardada ? {} : { error: "contacto_desconocido" }) }, { status: guardada ? 200 : 404 });
  } catch (e) {
    await registrarError("manychat", e, { paso: "guardar respuesta del seguimiento" });
    return Response.json({ ok: false, error: "servidor" }, { status: 500 });
  }
}

// ManyChat puede mandarlo como POST (con cuerpo) o como GET (todo en la dirección, sin cuerpo).
export const POST = tratar;
export const GET = tratar;
