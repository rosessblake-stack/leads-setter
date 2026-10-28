import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { googleConfigurado, urlAutorizacion } from "@/lib/google";
import { ir } from "@/lib/http";
import { COOKIE_PANEL, huella, nuevoSecreto, sesionValida } from "@/lib/panel";

export const maxDuration = 30;

// Empieza la conexión con Google: solo con el panel abierto y desde la propia web.
export async function POST(req: Request) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });
  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) return ir("/panel/entrar");
  if (!googleConfigurado()) return ir("/panel/ajustes?google=sin_claves");

  const estado = nuevoSecreto();
  await sql()`delete from setter.google_estados where expira_at < now()`;
  await sql()`insert into setter.google_estados (estado_hash, expira_at) values (${huella(estado)}, now() + interval '10 minutes')`;
  (await cookies()).set("google_estado", estado, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google",
    maxAge: 600,
  });
  return Response.redirect(urlAutorizacion(estado), 303);
}
