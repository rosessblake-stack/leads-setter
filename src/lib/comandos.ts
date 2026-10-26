import { sql } from "./db";
import { construirMensaje, escaparHtml } from "./telegram";
import type { FichaAnalizada } from "./analysis";
import type { Formulario } from "./validation";

export type Comando = "estado" | "leads" | "lead" | "ayuda" | null;

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
    case "lead":
      return "lead";
    case "start":
    case "ayuda":
    case "help":
      return "ayuda";
    default:
      return null;
  }
}

// Número que acompaña al comando ("/lead 3" → 3). Por defecto 1; solo del 1 al 5.
export function numeroDeLead(texto: string | undefined): number | null {
  const m = /^\/lead(?:@\w+)?(?:\s+(\d+))?\s*$/i.exec((texto ?? "").trim());
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1;
  return n >= 1 && n <= 5 ? n : null;
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
  "/lead 1 — la ficha completa del lead nº 1 de esa lista (hasta el 5)",
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
        (r, i) =>
          `${i + 1}. ${escaparHtml(r.nombre)} — ${escaparHtml(fecha(r.creado_at))}\n  interés: ${escaparHtml(r.interes ?? "?")}, ` +
          `recomendado: ${escaparHtml(OFERTA[r.oferta_recomendada] ?? "—")}, ` +
          `${r.puntuacion ?? "—"}/100, estado: ${escaparHtml(r.estado)}`,
      ),
    ].join("\n");
  } catch (e) {
    console.error("Leads: error", e instanceof Error ? e.message : "desconocido");
    return "No pude leer los leads: error de base de datos.";
  }
}

type FilaLead = {
  nombre: string;
  email: string;
  ig_username: string | null;
  pais: string | null;
  interes: "online" | "presencial" | "asesoria" | "no_se" | null;
  como_nos_conociste: string | null;
  respuestas: { ciudad?: string | null; nivel?: string; dificultad?: string; objetivo?: string } | null;
  video_codigo: string | null;
  estado: string;
  nivel: FichaAnalizada["nivel"] | null;
  dolores: FichaAnalizada["dolores"] | null;
  oferta_recomendada: "online" | "presencial" | "asesoria" | null;
  puntuacion: number | null;
  resumen: string | null;
  sospechoso: boolean | null;
};

// Reconstruye lo necesario para volver a generar la ficha tal como se avisó.
export function reconstruirLead(r: FilaLead): { f: Formulario; ficha: FichaAnalizada | null } {
  const resp = r.respuestas ?? {};
  const f = {
    nombre: r.nombre,
    email: r.email,
    ig_username: r.ig_username ?? undefined,
    pais: r.pais ?? "",
    ciudad: resp.ciudad ?? undefined,
    interes: r.interes ?? "no_se",
    nivel: (resp.nivel ?? "principiante") as Formulario["nivel"],
    dificultad: resp.dificultad ?? "",
    objetivo: resp.objetivo ?? "",
    como_nos_conociste: r.como_nos_conociste ?? undefined,
    consentimiento: true,
    v: r.video_codigo ?? undefined,
  } as Formulario;
  const ficha: FichaAnalizada | null =
    r.resumen && r.nivel && r.puntuacion !== null
      ? {
          nivel: r.nivel,
          dolores: r.dolores ?? [],
          oferta_recomendada: r.oferta_recomendada,
          puntuacion: r.puntuacion,
          sospechoso: r.sospechoso ?? false,
          resumen: r.resumen,
        }
      : null;
  return { f, ficha };
}

export async function comandoLead(n: number): Promise<string> {
  try {
    const filas = await sql()`
      select p.nombre, p.email, p.ig_username, p.pais,
        f.interes, f.como_nos_conociste, f.respuestas, v.codigo as video_codigo,
        fi.estado, fi.nivel, fi.dolores, fi.oferta_recomendada, fi.puntuacion, fi.resumen,
        (select (e.datos->>'sospechoso')::boolean from setter.eventos e
          where e.persona_id = p.id and e.tipo = 'ficha_analizada' order by e.id desc limit 1) as sospechoso
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      join setter.personas p on p.id = fi.persona_id
      left join setter.videos v on v.id = f.video_id
      order by f.creado_at desc
      offset ${n - 1} limit 1`;
    if (filas.length === 0) return "No hay un lead con ese número.";
    const { f, ficha } = reconstruirLead(filas[0] as unknown as FilaLead);
    return construirMensaje(f, ficha, `Estado de la ficha: ${filas[0].estado}`);
  } catch (e) {
    console.error("Lead: error", e instanceof Error ? e.message : "desconocido");
    return "No pude leer ese lead: error de base de datos.";
  }
}
