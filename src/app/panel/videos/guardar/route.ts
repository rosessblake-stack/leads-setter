import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { ir } from "@/lib/http";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";
import { CATEGORIAS_VIDEO, TIPOS_VIDEO } from "@/lib/panel-util";

export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });
  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) return ir("/panel/entrar");

  const d = await req.formData().catch(() => null);
  const id = String(d?.get("id") ?? "");
  if (!UUID.test(id)) return ir("/panel/videos");
  const texto = (k: string, max: number) => {
    const v = String(d?.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    return v || null;
  };
  const tipo = String(d?.get("tipo") ?? "");
  const categoria = String(d?.get("categoria") ?? "");
  await sql()`
    update setter.videos set
      descripcion = ${texto("descripcion", 500)},
      tipo = ${(TIPOS_VIDEO as readonly string[]).includes(tipo) ? tipo : null},
      categoria = ${(CATEGORIAS_VIDEO as readonly string[]).includes(categoria) ? categoria : null},
      palabra_clave = ${texto("palabra_clave", 40)}
    where id = ${id}`;
  return ir("/panel/videos?guardado=1");
}
