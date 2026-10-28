import { after } from "next/server";
import { ir } from "@/lib/http";
import { permitido } from "@/lib/ratelimit";
import { confirmarReserva } from "@/lib/reservas";
import { FORMATO_SECRETO } from "@/lib/panel";
import { avisarAdmin } from "@/lib/telegram";

export const maxDuration = 30;

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!permitido(`reserva:${ip}`, 20)) return new Response("Demasiados intentos", { status: 429 });

  const { token } = await ctx.params;
  if (!FORMATO_SECRETO.test(token)) return new Response("No encontrado", { status: 404 });
  const datos = await req.formData().catch(() => null);
  const inicio = String(datos?.get("inicio") ?? "");

  try {
    const r = await confirmarReserva(token, inicio);
    if (!r.ok) return ir(`/reservar/${token}?error=${encodeURIComponent(r.error)}`);
    after(() => avisarAdmin(r.aviso).catch(() => {}));
    return ir(`/reservar/${token}`);
  } catch (e) {
    console.error("Reserva: error al confirmar", e instanceof Error ? e.message : "desconocido");
    return ir(`/reservar/${token}?error=${encodeURIComponent("No se pudo reservar. Inténtalo de nuevo.")}`);
  }
}
