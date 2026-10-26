import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";

export const COOKIE_PANEL = "panel_sesion";
export const DIAS_SESION = 7;

export const huella = (secreto: string) => createHash("sha256").update(secreto).digest("hex");
export const nuevoSecreto = () => randomBytes(32).toString("base64url");
export const FORMATO_SECRETO = /^[A-Za-z0-9_-]{40,64}$/;

const baseUrl = () => (process.env.PANEL_BASE_URL ?? "https://leads-setter.vercel.app").replace(/\/$/, "");

// Enlace de un solo uso (10 minutos). En la base de datos solo queda su huella.
export async function crearEnlace(): Promise<string> {
  const t = nuevoSecreto();
  await sql()`insert into setter.panel_tokens (token_hash, expira_at) values (${huella(t)}, now() + interval '10 minutes')`;
  await sql()`delete from setter.panel_tokens where expira_at < now() - interval '1 day'`;
  await sql()`delete from setter.panel_sesiones where expira_at < now()`;
  return `${baseUrl()}/panel/entrar?t=${t}`;
}

// Canjea el enlace por una sesión. El enlace se marca como usado de forma atómica.
export async function canjear(t: string): Promise<string | null> {
  if (!FORMATO_SECRETO.test(t)) return null;
  const [fila] = await sql()`
    update setter.panel_tokens set usado_at = now()
    where token_hash = ${huella(t)} and usado_at is null and expira_at > now()
    returning token_hash`;
  if (!fila) return null;
  const s = nuevoSecreto();
  await sql()`
    insert into setter.panel_sesiones (sesion_hash, expira_at)
    values (${huella(s)}, now() + ${DIAS_SESION + " days"}::interval)`;
  return s;
}

export async function sesionValida(valor: string | undefined): Promise<boolean> {
  if (!valor || !FORMATO_SECRETO.test(valor)) return false;
  const [fila] = await sql()`
    update setter.panel_sesiones set ultimo_uso_at = now()
    where sesion_hash = ${huella(valor)} and expira_at > now()
    returning sesion_hash`;
  return Boolean(fila);
}

export async function cerrarSesion(valor: string | undefined): Promise<void> {
  if (!valor || !FORMATO_SECRETO.test(valor)) return;
  await sql()`delete from setter.panel_sesiones where sesion_hash = ${huella(valor)}`;
}

// Para las páginas del panel: sin sesión válida, a la pantalla de entrada.
export async function exigirSesion(): Promise<void> {
  const valor = (await cookies()).get(COOKIE_PANEL)?.value;
  if (!(await sesionValida(valor))) redirect("/panel/entrar");
}

// Emergencia: cierra todas las sesiones y anula los enlaces pendientes.
export async function cerrarTodo(): Promise<void> {
  await sql()`delete from setter.panel_sesiones`;
  await sql()`delete from setter.panel_tokens`;
}
