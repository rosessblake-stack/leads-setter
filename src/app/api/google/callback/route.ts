import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { guardarConexion } from "@/lib/google";
import { ir } from "@/lib/http";
import { huella, FORMATO_SECRETO } from "@/lib/panel";
import { registrarError } from "@/lib/errores";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Vuelta de Google. El «state» debe coincidir con el de la cookie de este navegador y con el guardado (un solo uso).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const estado = url.searchParams.get("state") ?? "";
  const codigo = url.searchParams.get("code") ?? "";
  const jar = await cookies();
  const cookie = jar.get("google_estado")?.value ?? "";
  jar.delete({ name: "google_estado", path: "/api/google" });

  if (!FORMATO_SECRETO.test(estado) || estado !== cookie || !codigo) return ir("/panel/ajustes?google=error");
  const [ok] = await sql()`delete from setter.google_estados where estado_hash = ${huella(estado)} and expira_at > now() returning 1 as x`;
  if (!ok) return ir("/panel/ajustes?google=error");
  try {
    await guardarConexion(codigo);
  } catch (e) {
    await registrarError("google", e, { paso: "conectar" });
    return ir("/panel/ajustes?google=error");
  }
  return ir("/panel/ajustes?google=ok");
}
