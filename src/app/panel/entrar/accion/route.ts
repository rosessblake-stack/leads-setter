import { after, NextResponse } from "next/server";
import { canjear, COOKIE_PANEL, DIAS_SESION } from "@/lib/panel";
import { permitido } from "@/lib/ratelimit";
import { avisarAdmin } from "@/lib/telegram";

export async function POST(req: Request) {
  // Solo desde la propia web.
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!permitido(`panel:${ip}`, 10)) return new Response("Demasiados intentos", { status: 429 });

  const datos = await req.formData().catch(() => null);
  const t = String(datos?.get("t") ?? "");
  const sesion = await canjear(t).catch((e) => {
    console.error("Panel: error al canjear el enlace", e instanceof Error ? e.message : "desconocido");
    return null;
  });
  if (!sesion) return NextResponse.redirect(new URL("/panel/entrar?error=1", req.url), 303);

  const res = NextResponse.redirect(new URL("/panel", req.url), 303);
  res.cookies.set({
    name: COOKIE_PANEL,
    value: sesion,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/panel",
    maxAge: DIAS_SESION * 24 * 60 * 60,
  });
  // Aviso de seguridad: si no has sido tú, lo sabrás al momento.
  after(() => avisarAdmin("🔓 Se ha abierto el panel. Si no has sido tú, escribe /cerrar_panel."));
  return res;
}
