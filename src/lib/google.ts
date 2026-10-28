import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import type { Ocupado } from "@/lib/disponibilidad";

// Las direcciones se pueden cambiar por variable de entorno solo para probar en local.
const OAUTH = () => process.env.GOOGLE_OAUTH_BASE ?? "https://oauth2.googleapis.com";
const CUENTAS = () => process.env.GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth";
const API = () => process.env.GOOGLE_API_BASE ?? "https://www.googleapis.com";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];

// Valores de Vercel sin espacios ni saltos de línea sobrantes al principio o al final (error típico al pegar).
const clienteId = () => (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const clienteSecreto = () => (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();

export const redirectUri = () => `${urlPanel()}/api/google/callback`;
export const googleConfigurado = () => Boolean(clienteId() && clienteSecreto());

// ----- Cifrado del token de refresco (la clave se deriva del secreto de cliente; no hay otra variable que configurar) -----
const clave = () => createHash("sha256").update("setter-google:" + clienteSecreto()).digest();

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), datos].map((b) => b.toString("base64url")).join(".");
}

export function descifrar(valor: string): string {
  const [iv, tag, datos] = valor.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", clave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(datos), d.final()]).toString("utf8");
}

// ----- Inicio de sesión -----
export function urlAutorizacion(estado: string): string {
  const p = new URLSearchParams({
    client_id: clienteId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: estado,
  });
  return `${CUENTAS()}?${p}`;
}

async function pedirToken(cuerpo: Record<string, string>) {
  const r = await fetch(`${OAUTH()}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clienteId(), client_secret: clienteSecreto(), ...cuerpo }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    // Google explica el motivo con un código corto (invalid_client, redirect_uri_mismatch...). No incluye secretos.
    const j = (await r.json().catch(() => null)) as { error?: string; error_description?: string } | null;
    throw new Error(`Google token ${r.status}: ${String(j?.error ?? "sin detalle").slice(0, 60)} ${String(j?.error_description ?? "").slice(0, 120)}`.trim());
  }
  return (await r.json()) as { access_token: string; expires_in: number; refresh_token?: string; id_token?: string };
}

export async function guardarConexion(codigo: string): Promise<{ email: string | null }> {
  const t = await pedirToken({ grant_type: "authorization_code", code: codigo, redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error("Google no devolvió permiso permanente");
  let email: string | null = null;
  try {
    const carga = JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8"));
    email = typeof carga.email === "string" ? carga.email : null;
  } catch {}
  await sql()`
    insert into setter.google_conexion (id, email, refresh_token_cifrado) values (true, ${email}, ${cifrar(t.refresh_token)})
    on conflict (id) do update set email = excluded.email, refresh_token_cifrado = excluded.refresh_token_cifrado, conectado_at = now()`;
  cache = null;
  return { email };
}

export async function conexion() {
  const [c] = await sql()`select email, calendario_id, conectado_at from setter.google_conexion where id`;
  return (c as { email: string | null; calendario_id: string; conectado_at: Date } | undefined) ?? null;
}

// ----- Llamadas al calendario -----
let cache: { token: string; hasta: number } | null = null;

async function tokenAcceso(): Promise<{ token: string; calendario: string }> {
  const [c] = await sql()`select refresh_token_cifrado, calendario_id from setter.google_conexion where id`;
  if (!c) throw new Error("Google no está conectado");
  if (cache && cache.hasta > Date.now() + 60_000) return { token: cache.token, calendario: c.calendario_id };
  const t = await pedirToken({ grant_type: "refresh_token", refresh_token: descifrar(c.refresh_token_cifrado) });
  cache = { token: t.access_token, hasta: Date.now() + t.expires_in * 1000 };
  return { token: t.access_token, calendario: c.calendario_id };
}

async function api(ruta: string, token: string, cuerpo: unknown) {
  const r = await fetch(`${API()}${ruta}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Google API ${r.status}`);
  return r.json();
}

// Lo que ya tienes ocupado entre dos instantes (incluye lo de Kira citas: es el mismo calendario).
export async function ocupadosEntre(desde: Date, hasta: Date): Promise<Ocupado[]> {
  const { token, calendario } = await tokenAcceso();
  const j = (await api("/calendar/v3/freeBusy", token, {
    timeMin: desde.toISOString(),
    timeMax: hasta.toISOString(),
    timeZone: "Europe/Madrid",
    items: [{ id: calendario }],
  })) as { calendars?: Record<string, { busy?: { start: string; end: string }[] }> };
  const busy = j.calendars?.[calendario]?.busy ?? [];
  return busy.map((b) => ({ inicio: new Date(b.start), fin: new Date(b.end) }));
}

export async function crearEvento(d: { titulo: string; descripcion: string; inicio: Date; fin: Date; invitado: string; peticion: string }) {
  const { token, calendario } = await tokenAcceso();
  const j = (await api(
    `/calendar/v3/calendars/${encodeURIComponent(calendario)}/events?conferenceDataVersion=1&sendUpdates=all`,
    token,
    {
      summary: d.titulo,
      description: d.descripcion,
      start: { dateTime: d.inicio.toISOString(), timeZone: "Europe/Madrid" },
      end: { dateTime: d.fin.toISOString(), timeZone: "Europe/Madrid" },
      attendees: [{ email: d.invitado }],
      conferenceData: { createRequest: { requestId: d.peticion, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    },
  )) as { id: string; hangoutLink?: string };
  return { id: j.id, meet: j.hangoutLink ?? null };
}

// Si la reserva no llega a guardarse, se quita el evento para no dejar huecos fantasma en el calendario.
export async function borrarEvento(id: string): Promise<void> {
  const { token, calendario } = await tokenAcceso();
  await fetch(`${API()}/calendar/v3/calendars/${encodeURIComponent(calendario)}/events/${encodeURIComponent(id)}?sendUpdates=all`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
}
