import { cookies } from "next/headers";
import { after } from "next/server";
import { canjear, COOKIE_PANEL, DIAS_SESION, sesionValida } from "@/lib/panel";
import { ir, tipoNavegador } from "@/lib/http";
import { permitido } from "@/lib/ratelimit";
import { avisarAdmin } from "@/lib/telegram";
import { registrarError } from "@/lib/errores";

export async function POST(req: Request) {
  const nav = tipoNavegador(req.headers.get("user-agent"));

  // Solo desde la propia web.
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) {
    console.warn("Panel: entrada rechazada por origen", nav, origen ? "con origen distinto" : "sin cabecera Origin");
    return new Response("Origen no permitido", { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!permitido(`panel:${ip}`, 10)) return new Response("Demasiados intentos", { status: 429 });

  const datos = await req.formData().catch(() => null);
  const t = String(datos?.get("t") ?? "");
  const sesion = await canjear(t).catch(async (e) => {
    await registrarError("panel", e, { paso: "canjear enlace" });
    return null;
  });

  if (!sesion) {
    // Si ya estás dentro (por ejemplo, pulsaste dos veces el mismo enlace), te llevamos al panel.
    if (await sesionValida((await cookies()).get(COOKIE_PANEL)?.value).catch(() => false)) {
      console.log("Panel: enlace ya usado, pero la sesión es válida →", nav);
      return ir("/panel");
    }
    console.warn("Panel: enlace rechazado (usado, caducado o no válido) →", nav);
    return ir("/panel/entrar?error=1");
  }

  const res = ir("/panel");
  res.cookies.set({
    name: COOKIE_PANEL,
    value: sesion,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/panel",
    maxAge: DIAS_SESION * 24 * 60 * 60,
  });
  console.log("Panel: entrada correcta →", nav);
  // Aviso de seguridad: si no has sido tú, lo sabrás al momento.
  after(() => avisarAdmin("🔓 Se ha abierto el panel. Si no has sido tú, escribe /cerrar_panel."));
  return res;
}
