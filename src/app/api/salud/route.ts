import { intentar, sql } from "@/lib/db";
import { permitido } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const MAX_SIN_LATIDO_MIN = 15;

// Para un vigilante externo (UptimeRobot u otro): responde 200 si la base de datos responde y el temporizador
// de propuestas se ha ejecutado en los últimos 15 minutos; si no, 503. No devuelve datos de personas.
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!(await permitido(`salud:${ip}`, 60, 60 * 1000))) return new Response("Demasiadas peticiones", { status: 429 });
  try {
    const [r] = await intentar(
      () => sql()`
        select extract(epoch from (now() - actualizado_at)) / 60 as minutos
        from setter.ajustes where clave = 'latido'`,
    );
    const minutos = r ? Math.round(Number(r.minutos)) : null;
    const vivo = minutos !== null && minutos <= MAX_SIN_LATIDO_MIN;
    return Response.json({ ok: vivo, base_de_datos: true, minutos_desde_el_temporizador: minutos }, { status: vivo ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, base_de_datos: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
