// ManyChat: dejar el texto y el enlace en campos personalizados del contacto y lanzar el flujo que los muestra.
const BASE = () => (process.env.MANYCHAT_API_BASE ?? "https://api.manychat.com").replace(/\/$/, "");

export const CAMPO_TEXTO = () => process.env.MANYCHAT_CAMPO_TEXTO ?? "propuesta_texto";
export const CAMPO_ENLACE = () => process.env.MANYCHAT_CAMPO_ENLACE ?? "propuesta_enlace";

export type TipoFlujo = "llamada" | "asesoria";
const flujo = (t: TipoFlujo) => (t === "asesoria" ? process.env.MANYCHAT_FLOW_ASESORIA : process.env.MANYCHAT_FLOW_LLAMADA);

export const manychatConfigurado = () =>
  Boolean(process.env.MANYCHAT_API_KEY && process.env.MANYCHAT_FLOW_LLAMADA && process.env.MANYCHAT_FLOW_ASESORIA);

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

export async function enviarPropuesta(subscriberId: string, tipo: TipoFlujo, texto: string, enlace: string): Promise<void> {
  const flow = flujo(tipo);
  if (!flow) throw new Error("Falta el flujo de ManyChat para este tipo de propuesta");
  await llamar("/fb/subscriber/setCustomFields", "POST", {
    subscriber_id: Number(subscriberId) || subscriberId,
    fields: [
      { field_name: CAMPO_TEXTO(), field_value: texto },
      { field_name: CAMPO_ENLACE(), field_value: enlace },
    ],
  });
  await llamar("/fb/sending/sendFlow", "POST", { subscriber_id: Number(subscriberId) || subscriberId, flow_ns: flow });
}
