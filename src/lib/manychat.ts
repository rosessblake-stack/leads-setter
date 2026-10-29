// ManyChat: dejar el texto y el enlace en campos personalizados del contacto y lanzar el flujo que los muestra.
const BASE = () => (process.env.MANYCHAT_API_BASE ?? "https://api.manychat.com").replace(/\/$/, "");

export const CAMPO_TEXTO = () => process.env.MANYCHAT_CAMPO_TEXTO ?? "propuesta_texto";
export const CAMPO_ENLACE = () => process.env.MANYCHAT_CAMPO_ENLACE ?? "propuesta_enlace";

export type TipoFlujo = "llamada" | "asesoria";

// Ambas variables son opcionales: si no están, el flujo se busca en ManyChat por su nombre
// («Propuesta llamada» y «Propuesta asesoría»).
const flujoManual = (t: TipoFlujo) => (t === "asesoria" ? process.env.MANYCHAT_FLOW_ASESORIA : process.env.MANYCHAT_FLOW_LLAMADA);

export const manychatConfigurado = () => Boolean(process.env.MANYCHAT_API_KEY);

const normal = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const COINCIDE: Record<TipoFlujo, (n: string) => boolean> = {
  llamada: (n) => n.includes("propuesta") && n.includes("llamada"),
  asesoria: (n) => n.includes("propuesta") && n.includes("asesor"),
};

// Un error «definitivo» (ManyChat contestó que no) es seguro reintentarlo o dejarlo; uno «incierto» (tiempo agotado,
// error del servidor, sin conexión) puede haber llegado a ejecutarse.
export class ErrorManyChat extends Error {
  constructor(
    mensaje: string,
    readonly definitivo: boolean,
  ) {
    super(mensaje);
  }
}

async function llamar(ruta: string, metodo: "GET" | "POST", cuerpo?: unknown) {
  let r: Response;
  try {
    r = await fetch(`${BASE()}${ruta}`, {
      method: metodo,
      headers: { authorization: `Bearer ${process.env.MANYCHAT_API_KEY ?? ""}`, "content-type": "application/json", accept: "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ErrorManyChat("ManyChat no respondió (tiempo agotado o sin conexión)", false);
  }
  const j = (await r.json().catch(() => null)) as { status?: string; message?: string; data?: unknown } | null;
  if (!r.ok || j?.status !== "success") {
    // El mensaje de ManyChat explica el motivo (no contiene secretos).
    throw new ErrorManyChat(`ManyChat ${r.status}: ${String(j?.message ?? "sin detalle").slice(0, 200)}`, r.status >= 400 && r.status < 500);
  }
  return j.data;
}

// Para comprobar la conexión desde el panel.
export async function infoPagina(): Promise<{ nombre: string | null }> {
  const d = (await llamar("/fb/page/getInfo", "GET")) as { name?: string } | undefined;
  return { nombre: d?.name ?? null };
}

export async function listarFlujos(): Promise<{ ns: string; name: string }[]> {
  const d = (await llamar("/fb/page/getFlows", "GET")) as { flows?: { ns?: string; name?: string }[] } | { ns?: string; name?: string }[] | undefined;
  const lista = Array.isArray(d) ? d : (d?.flows ?? []);
  return lista.filter((f): f is { ns: string; name: string } => typeof f.ns === "string" && typeof f.name === "string");
}

let cacheFlujos: { hasta: number; flujos: { ns: string; name: string }[] } | null = null;

export async function buscarFlujo(tipo: TipoFlujo): Promise<string | null> {
  const manual = flujoManual(tipo);
  if (manual) return manual;
  if (!cacheFlujos || cacheFlujos.hasta < Date.now()) cacheFlujos = { hasta: Date.now() + 10 * 60_000, flujos: await listarFlujos() };
  const coinciden = cacheFlujos.flujos.filter((f) => COINCIDE[tipo](normal(f.name)));
  return coinciden.length === 1 ? coinciden[0].ns : null; // si hay 0 o varios con ese nombre, no se adivina
}

export type InfoContacto = { instagram: string | null; ultimaInteraccion: Date | null };

function aFecha(v: unknown): Date | null {
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v === "string" && v.trim() !== "") {
    const d = new Date(v.includes("T") || /[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v.replace(" ", "T")}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Datos del contacto en ManyChat: su usuario de Instagram y cuándo fue la última vez que interactuó (para la ventana de 24 h).
// Si ManyChat no devuelve un dato, queda en null y quien llama decide (por defecto: no se envía sola).
export async function infoContacto(subscriberId: string): Promise<InfoContacto> {
  const d = ((await llamar(`/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(subscriberId)}`, "GET")) ?? {}) as Record<string, unknown>;
  const usuario = [d.ig_username, d.instagram_username].find((x) => typeof x === "string" && x.trim() !== "") as string | undefined;
  const fechas = [d.ig_last_interaction, d.last_interaction].map(aFecha).filter((x): x is Date => x !== null);
  return {
    instagram: usuario ? usuario.trim().replace(/^@/, "").toLowerCase() : null,
    ultimaInteraccion: fechas.length > 0 ? new Date(Math.max(...fechas.map((f) => f.getTime()))) : null,
  };
}

export async function enviarPropuesta(subscriberId: string, tipo: TipoFlujo, texto: string, enlace: string): Promise<void> {
  const flow = await buscarFlujo(tipo);
  if (!flow) throw new Error(`No encuentro en ManyChat un único flujo llamado «Propuesta ${tipo === "asesoria" ? "asesoría" : "llamada"}»`);
  await llamar("/fb/subscriber/setCustomFields", "POST", {
    subscriber_id: Number(subscriberId) || subscriberId,
    fields: [
      { field_name: CAMPO_TEXTO(), field_value: texto },
      { field_name: CAMPO_ENLACE(), field_value: enlace },
    ],
  });
  // Aquí está el riesgo de duplicar: si esta llamada no contesta, no se sabe si el mensaje salió. No se reintenta sola.
  await llamar("/fb/sending/sendFlow", "POST", { subscriber_id: Number(subscriberId) || subscriberId, flow_ns: flow });
}
