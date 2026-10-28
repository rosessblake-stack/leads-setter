import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { ir } from "@/lib/http";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";

export const maxDuration = 30;

export async function POST(req: Request) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });
  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) return ir("/panel/entrar");
  await sql()`update setter.errores set revisado_at = now() where revisado_at is null`;
  return ir("/panel/errores");
}
