import { cookies } from "next/headers";
import { cerrarSesion, COOKIE_PANEL } from "@/lib/panel";
import { ir } from "@/lib/http";

export async function POST(req: Request) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });

  await cerrarSesion((await cookies()).get(COOKIE_PANEL)?.value).catch(() => undefined);
  const res = ir("/panel/entrar");
  res.cookies.set({ name: COOKIE_PANEL, value: "", path: "/panel", maxAge: 0 });
  return res;
}
