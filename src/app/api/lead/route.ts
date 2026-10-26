import { after } from "next/server";
import { PayloadSchema } from "@/lib/validation";
import { guardarLead } from "@/lib/lead";
import { procesarLead } from "@/lib/proceso";
import { permitido } from "@/lib/ratelimit";
import { definicion, reglasOferta } from "@/formulario/datos";
import { validarTodo } from "@/formulario/motor";
import { construirSolicitud } from "@/formulario/solicitud";
import type { Respuestas } from "@/formulario/tipos";

export const maxDuration = 60;

const MAX_BYTES = 80_000;

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
  const trampa = (cuerpo as { web?: unknown } | null)?.web;
  if (typeof trampa === "string" && trampa.length > 0) return json({ ok: true });

  const parsed = PayloadSchema.safeParse(cuerpo);
  if (!parsed.success) return json({ ok: false, error: "formato" }, 400);

  const validacion = validarTodo(definicion, parsed.data.respuestas as Respuestas);
  if (!validacion.ok) return json({ ok: false, error: "validacion", errores: validacion.errores }, 400);

  const solicitud = construirSolicitud(definicion, reglasOferta, validacion, {
    zona_horaria: parsed.data.zona_horaria,
    v: parsed.data.v,
    mc: parsed.data.mc,
    iniciado_at: parsed.data.iniciado_at,
  });

  try {
    const guardado = await guardarLead(solicitud);
    // El análisis y el aviso se hacen después de responder a la persona.
    after(() => procesarLead(solicitud, guardado));
    return json({ ok: true });
  } catch (e) {
    console.error("Error guardando lead", e instanceof Error ? e.message : "desconocido");
    return json({ ok: false, error: "servidor" }, 500);
  }
}
