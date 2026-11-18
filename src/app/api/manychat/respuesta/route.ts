import { ETIQUETA_PASO, guardarRespuestaSeguimiento, leerCuerpoManychat, PASOS_SEGUIMIENTO, secretoValido, type PasoSeguimiento } from "@/lib/guia";
import { registrarError } from "@/lib/errores";
import { permitido } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ManyChat manda aquí cada respuesta del flujo «Seguimiento guía» (petición externa). Sin la clave correcta, no hace nada.
export async function POST(req: Request) {
  const esperado = (process.env.MANYCHAT_WEBHOOK_SECRET ?? "").trim();
  if (!secretoValido(req.headers.get("x-manychat-secret"), esperado)) return new Response("No autorizado", { status: 401 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!(await permitido(`manychat-respuesta:${ip}`, 120, 10 * 60 * 1000))) return Response.json({ ok: false, error: "demasiadas_peticiones" }, { status: 429 });
  const t = await req.text().catch(() => "");
  if (t.length > 4000) return Response.json({ ok: false, error: "demasiado_grande" }, { status: 413 });
  const d = leerCuerpoManychat(t);
  if (!d) return Response.json({ ok: false, error: "json" }, { status: 400 });
  const mc = String(d.mc ?? "").trim();
  const paso = String(d.paso ?? "") as PasoSeguimiento;
  const texto = String(d.texto ?? "").trim();
  if (!/^\d{3,20}$/.test(mc)) return Response.json({ ok: false, error: "mc" }, { status: 400 });
  if (!(PASOS_SEGUIMIENTO as readonly string[]).includes(paso)) return Response.json({ ok: false, error: "paso", validos: Object.keys(ETIQUETA_PASO) }, { status: 400 });
  if (texto === "") return Response.json({ ok: false, error: "texto_vacio" }, { status: 400 });
  try {
    const guardada = await guardarRespuestaSeguimiento(mc, paso, texto);
    return Response.json({ ok: guardada, ...(guardada ? {} : { error: "contacto_desconocido" }) }, { status: guardada ? 200 : 404 });
  } catch (e) {
    await registrarError("manychat", e, { paso: "guardar respuesta del seguimiento" });
    return Response.json({ ok: false, error: "servidor" }, { status: 500 });
  }
}
