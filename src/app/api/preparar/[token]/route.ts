import { after } from "next/server";
import { z } from "zod";
import { registrarError } from "@/lib/errores";
import { guardarPreparacion } from "@/lib/preparacion";
import { permitido } from "@/lib/ratelimit";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";
import { urlPanel } from "@/lib/config";
import type { Respuestas } from "@/formulario/tipos";

export const maxDuration = 30;
const MAX_BYTES = 120_000;
const Cuerpo = z.object({ respuestas: z.record(z.string(), z.unknown()), web: z.string().optional() });

const json = (c: unknown, status = 200) => Response.json(c, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origen && host && new URL(origen).host !== host) return json({ ok: false, error: "origen" }, 403);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!(await permitido(`preparar:${ip}`, 30))) return json({ ok: false, error: "demasiadas_peticiones" }, 429);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return json({ ok: false, error: "demasiado_grande" }, 413);

  const { token } = await ctx.params;
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ ok: false, error: "json" }, 400);
  }
  const parsed = Cuerpo.safeParse(cuerpo);
  if (!parsed.success) return json({ ok: false, error: "formato" }, 400);
  if (parsed.data.web) return json({ ok: true }); // campo trampa

  try {
    const r = await guardarPreparacion(token, parsed.data.respuestas as Respuestas);
    if (!r.ok) return json(r, r.error === "enlace" ? 404 : 400);
    if (r.primera) {
      after(() =>
        avisarAdmin(`📝 <b>${escaparHtml(r.nombre.slice(0, 60))}</b> ha completado la preparación de su asesoría.\n${urlPanel()}/panel/lead/${r.ficha_id}`).catch(() => false),
      );
    }
    return json({ ok: true });
  } catch (e) {
    await registrarError("formulario", e, { paso: "guardar preparación" });
    return json({ ok: false, error: "servidor" }, 500);
  }
}
