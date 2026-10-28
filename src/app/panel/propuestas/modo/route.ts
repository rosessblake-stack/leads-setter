import { cookies } from "next/headers";
import { ir } from "@/lib/http";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";
import { fijarModo } from "@/lib/propuestas";

export const maxDuration = 30;

// Cambia entre «calibración» (las propuestas te llegan a Telegram) y «automático» (se envían solas).
export async function POST(req: Request) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });
  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) return ir("/panel/entrar");
  const datos = await req.formData().catch(() => null);
  const modo = String(datos?.get("modo") ?? "");
  if (modo === "automatico") await fijarModo("automatico", 0);
  else if (modo === "calibracion") await fijarModo("calibracion", 10);
  else return new Response("Modo no válido", { status: 400 });
  return ir("/panel/ajustes?propuestas=ok");
}
