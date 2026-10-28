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

async function llamar(ruta: string, metodo: "GET" | "POST", cuerpo?: unknown) {
  const r = await fetch(`${BASE()}${ruta}`, {
    method: metodo,
    headers: { authorization: `Bearer ${process.env.MANYCHAT_API_KEY ?? ""}`, "content-type": "application/json", accept: "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  });
  const j = (await r.json().catch(() => null)) as { status?: string; message?: string; data?: unknown } | null;
  if (!r.ok || j?.status !== "success") {
    // El mensaje de ManyChat explica el motivo (no contiene secretos).
    throw new Error(`ManyChat ${r.status}: ${String(j?.message ?? "sin detalle").slice(0, 200)}`);
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
  await llamar("/fb/sending/sendFlow", "POST", { subscriber_id: Number(subscriberId) || subscriberId, flow_ns: flow });
}
