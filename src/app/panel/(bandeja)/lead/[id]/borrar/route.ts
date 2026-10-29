import { cookies } from "next/headers";
import { borrarPersona } from "@/lib/borrado";
import { registrarError } from "@/lib/errores";
import { ir } from "@/lib/http";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const maxDuration = 30;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });
  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) return ir("/panel/entrar");
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("No encontrado", { status: 404 });
  const datos = await req.formData().catch(() => null);
  if (String(datos?.get("confirmar") ?? "").trim().toUpperCase() !== "BORRAR") return ir(`/panel/lead/${id}?error=${encodeURIComponent("Escribe BORRAR para confirmar.")}#borrar`);
  try {
    const r = await borrarPersona(id);
    if (!r.ok) return new Response("No encontrado", { status: 404 });
    return ir(`/panel?borrado=${r.calendario ? "1" : "2"}`);
  } catch (e) {
    await registrarError("panel", e, { paso: "borrar persona", ficha: id });
    return ir(`/panel/lead/${id}?error=${encodeURIComponent("No se pudo borrar. Inténtalo de nuevo.")}#borrar`);
  }
}
