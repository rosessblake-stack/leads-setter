import { after } from "next/server";
import { FormularioSchema } from "@/lib/validation";
import { guardarLead } from "@/lib/lead";
import { procesarLead } from "@/lib/proceso";
import { permitido } from "@/lib/ratelimit";

export const maxDuration = 60;

const MAX_BYTES = 20_000;

function json(cuerpo: unknown, status = 200) {
  return Response.json(cuerpo, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  // Solo se acepta desde la propia web.
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origen && host && new URL(origen).host !== host) {
    return json({ ok: false, error: "origen" }, 403);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!permitido(ip)) return json({ ok: false, error: "demasiadas_peticiones" }, 429);

  const largo = Number(req.headers.get("content-length") ?? 0);
  if (largo > MAX_BYTES) return json({ ok: false, error: "demasiado_grande" }, 413);

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ ok: false, error: "json" }, 400);
  }

  // Campo trampa relleno: respondemos como si fuera bien, sin guardar nada.
  if (typeof cuerpo === "object" && cuerpo && typeof (cuerpo as { web?: unknown }).web === "string" && (cuerpo as { web: string }).web.length > 0) {
    return json({ ok: true, regalo: null });
  }

  const parsed = FormularioSchema.safeParse(cuerpo);
  if (!parsed.success) {
    const campos = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")))];
    return json({ ok: false, error: "validacion", campos }, 400);
  }

  try {
    const guardado = await guardarLead(parsed.data);
    // El análisis y el aviso se hacen después de responder a la persona.
    after(() => procesarLead(parsed.data, guardado));
    return json({ ok: true, regalo: process.env.GIFT_URL ?? null });
  } catch (e) {
    console.error("Error guardando lead", e instanceof Error ? e.message : "desconocido");
    return json({ ok: false, error: "servidor" }, 500);
  }
}
