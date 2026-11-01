import { createHmac } from "node:crypto";
import { definicion } from "@/formulario/datos";
import { almacenar, validarPreparacion } from "@/formulario/motor";
import type { Almacenada, Respuestas } from "@/formulario/tipos";
import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { FORMATO_SECRETO, huella } from "@/lib/panel";

const DIA = 24 * 60 * 60 * 1000;
const VIGENCIA_DIAS = 60;

// El token de preparación de cada ficha se calcula con una firma (HMAC) de su identificador y la clave propia:
// siempre es el mismo, no hace falta guardarlo en claro y no se puede adivinar. Sin ENCRYPTION_KEY no se puede calcular.
export function tokenPreparacion(fichaId: string): string {
  const clave = Buffer.from((process.env.ENCRYPTION_KEY ?? "").trim(), "base64");
  if (clave.length < 32) throw new Error("Falta ENCRYPTION_KEY (32 bytes en base64)");
  return createHmac("sha256", clave.subarray(0, 32)).update("preparacion:" + fichaId).digest("base64url");
}

export const urlPreparacion = (token: string) => `${urlPanel()}/preparar/${token}`;

// Deja lista la preparación de una ficha de asesoría y devuelve su enlace. Se puede llamar las veces que haga falta.
export async function enlacePreparacion(fichaId: string): Promise<string | null> {
  const [f] = await sql()`
    select fo.ruta from setter.fichas fi join setter.formularios fo on fo.id = fi.formulario_id where fi.id = ${fichaId}`;
  if (!f || f.ruta !== "asesoria") return null;
  const token = tokenPreparacion(fichaId);
  await sql()`
    insert into setter.preparaciones (ficha_id, token_hash, expira_at)
    values (${fichaId}, ${huella(token)}, ${new Date(Date.now() + VIGENCIA_DIAS * DIA)})
    on conflict (ficha_id) do update set token_hash = excluded.token_hash`;
  return urlPreparacion(token);
}

export type Preparacion = { id: string; ficha_id: string; nombre: string; completada_at: Date | null; expira_at: Date; respuestas: Record<string, Almacenada> };

export async function cargarPreparacion(token: string): Promise<Preparacion | null> {
  if (!FORMATO_SECRETO.test(token)) return null;
  const [p] = await sql()`
    select pr.id, pr.ficha_id, pr.completada_at, pr.expira_at, pr.respuestas, per.nombre
    from setter.preparaciones pr
    join setter.fichas fi on fi.id = pr.ficha_id
    join setter.personas per on per.id = fi.persona_id
    where pr.token_hash = ${huella(token)}`;
  return (p as unknown as Preparacion) ?? null;
}

export type Guardado = { ok: true; nombre: string; ficha_id: string; primera: boolean } | { ok: false; error: string; errores?: Record<string, string> };

export async function guardarPreparacion(token: string, respuestas: Respuestas): Promise<Guardado> {
  const p = await cargarPreparacion(token);
  if (!p || p.expira_at.getTime() < Date.now()) return { ok: false, error: "enlace" };
  const v = validarPreparacion(definicion, respuestas, "asesoria");
  if (!v.ok) return { ok: false, error: "validacion", errores: v.errores };
  const guardadas = almacenar(definicion, v.limpias, "preparacion", "asesoria");
  const [f] = await sql()`select persona_id from setter.fichas where id = ${p.ficha_id}`;
  await sql().begin(async (tx) => {
    await tx`update setter.preparaciones set respuestas = ${tx.json(guardadas as never)}, completada_at = now(), actualizado_at = now() where id = ${p.id}`;
    await tx`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'preparacion_completada', ${tx.json({ respuestas: Object.keys(guardadas).length })})`;
  });
  return { ok: true, nombre: p.nombre, ficha_id: p.ficha_id, primera: p.completada_at === null };
}
