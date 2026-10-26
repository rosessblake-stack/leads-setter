import { sql } from "./db";
import { escaparHtml } from "./telegram";

export type Comando = "estado" | "leads" | "ayuda" | null;

// Acepta "/estado" y "/estado@nombre_del_bot". Todo lo demás se ignora.
export function parsearComando(texto: string | undefined): Comando {
  if (!texto) return null;
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i.exec(texto.trim());
  if (!m) return null;
  switch (m[1].toLowerCase()) {
    case "estado":
      return "estado";
    case "leads":
      return "leads";
    case "start":
    case "ayuda":
    case "help":
      return "ayuda";
    default:
      return null;
  }
}

export function esAdmin(chatId: unknown, admin: string | undefined): boolean {
  if (!admin || (typeof chatId !== "number" && typeof chatId !== "string")) return false;
  return String(chatId) === admin;
}

export const TEXTO_AYUDA = [
  "<b>LeadsBot</b>",
  "",
  "/estado — comprueba que todo funciona",
  "/leads — los últimos 5 leads",
  "/ayuda — esta lista",
].join("\n");

const fecha = (d: Date | null) =>
  d ? d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }) : "—";

export type DatosEstado = {
  baseDatos: boolean;
  claveClaude: boolean;
  regalo: boolean;
  ultimas24h: number;
  sinAvisar: number;
  ultimo: Date | null;
};

export function formatearEstado(e: DatosEstado): string {
  const ok = (b: boolean) => (b ? "✅" : "❌");
  return [
    "<b>Estado del sistema</b>",
    `${ok(e.baseDatos)} Base de datos`,
    `${ok(e.claveClaude)} Clave de Claude configurada`,
    `${ok(e.regalo)} Enlace del regalo ${e.regalo ? "configurado" : "sin configurar"}`,
    "✅ Telegram (estás leyendo esto)",
    "",
    `Leads en las últimas 24 h: ${e.ultimas24h}`,
    `Fichas sin aviso enviado: ${e.sinAvisar}`,
    `Último lead: ${escaparHtml(fecha(e.ultimo))}`,
  ].join("\n");
}

export async function comandoEstado(): Promise<string> {
  const datos: DatosEstado = {
    baseDatos: false,
    claveClaude: Boolean(process.env.ANTHROPIC_API_KEY),
    regalo: Boolean(process.env.GIFT_URL),
    ultimas24h: 0,
    sinAvisar: 0,
    ultimo: null,
  };
  try {
    const [r] = await sql()`
      select
        (select count(*)::int from setter.formularios where creado_at > now() - interval '24 hours') as ultimas24h,
        (select count(*)::int from setter.fichas where notificado_at is null) as sin_avisar,
        (select max(creado_at) from setter.formularios) as ultimo`;
    datos.baseDatos = true;
    datos.ultimas24h = r.ultimas24h;
    datos.sinAvisar = r.sin_avisar;
    datos.ultimo = r.ultimo;
  } catch (e) {
    console.error("Estado: error de base de datos", e instanceof Error ? e.message : "desconocido");
  }
  return formatearEstado(datos);
}

const OFERTA: Record<string, string> = { online: "online", presencial: "presencial", asesoria: "asesoría" };

export async function comandoLeads(): Promise<string> {
  try {
    const filas = await sql()`
      select p.nombre, f.interes, fi.oferta_recomendada, fi.puntuacion, fi.estado, f.creado_at
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      join setter.personas p on p.id = fi.persona_id
      order by f.creado_at desc limit 5`;
    if (filas.length === 0) return "Todavía no hay leads.";
    return [
      "<b>Últimos leads</b>",
      ...filas.map(
        (r) =>
          `• ${escaparHtml(r.nombre)} — ${escaparHtml(fecha(r.creado_at))}\n  interés: ${escaparHtml(r.interes ?? "?")}, ` +
          `recomendado: ${escaparHtml(OFERTA[r.oferta_recomendada] ?? "—")}, ` +
          `${r.puntuacion ?? "—"}/100, estado: ${escaparHtml(r.estado)}`,
      ),
    ].join("\n");
  } catch (e) {
    console.error("Leads: error", e instanceof Error ? e.message : "desconocido");
    return "No pude leer los leads: error de base de datos.";
  }
}
