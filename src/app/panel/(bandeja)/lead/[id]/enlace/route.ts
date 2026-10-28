import { cookies } from "next/headers";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";
import { crearEnlaceReserva } from "@/lib/reservas";
import { registrarError } from "@/lib/errores";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const maxDuration = 30;

// Crea un enlace de reserva para este lead y lo devuelve para copiarlo.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });
  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("No encontrado", { status: 404 });
  try {
    const url = await crearEnlaceReserva(id);
    if (!url) return new Response("No encontrado", { status: 404 });
    return Response.json({ ok: true, url });
  } catch (e) {
    await registrarError("reservas", e, { paso: "crear enlace", ficha: id });
    return Response.json({ ok: false, error: "No se pudo crear el enlace." }, { status: 500 });
  }
}
