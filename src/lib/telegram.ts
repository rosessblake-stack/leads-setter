import type { FichaAnalizada } from "./analysis";
import type { Formulario } from "./validation";

export function escaparHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const OFERTA: Record<string, string> = {
  online: "Formación online",
  presencial: "Formación presencial",
  asesoria: "Asesoría 1 h",
};

export function construirMensaje(
  f: Formulario,
  ficha: FichaAnalizada | null,
  nota?: string,
): string {
  const l: string[] = [];
  l.push(`<b>Nuevo lead:</b> ${escaparHtml(f.nombre)}`);
  l.push(`${escaparHtml(f.email)}${f.ig_username ? " · @" + escaparHtml(f.ig_username) : ""}`);
  l.push(`${escaparHtml(f.pais)}${f.ciudad ? " · " + escaparHtml(f.ciudad) : ""}`);
  l.push("");
  l.push(`Interés: ${escaparHtml(OFERTA[f.interes] ?? "Aún no lo sabe")}`);
  l.push(`Nivel: ${escaparHtml(f.nivel)}`);
  if (f.v) l.push(`Vídeo: ${escaparHtml(f.v)}`);
  if (f.como_nos_conociste) l.push(`Nos conoció por: ${escaparHtml(f.como_nos_conociste)}`);
  l.push("");
  if (ficha) {
    if (ficha.sospechoso) l.push("⚠️ <b>Parece sospechoso (spam o broma)</b>");
    l.push(
      `Oferta recomendada: <b>${escaparHtml(ficha.oferta_recomendada ? OFERTA[ficha.oferta_recomendada] : "ninguna clara")}</b>`,
    );
    l.push(`Encaje con tu cliente ideal: ${escaparHtml(ficha.encaje)}`);
    l.push(`Probabilidad de compra: ${ficha.puntuacion}/100`);
    if (ficha.dolores.length) l.push(`Dolores: ${escaparHtml(ficha.dolores.join(", "))}`);
    l.push("");
    l.push(escaparHtml(ficha.resumen));
  } else {
    l.push("No se pudo analizar el formulario.");
  }
  if (nota) {
    l.push("");
    l.push(escaparHtml(nota));
  }
  return l.join("\n");
}

// Envía un mensaje al chat privado del admin. Sin credenciales, no hace nada.
export async function avisarAdmin(texto: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chat) {
    console.warn("Telegram no configurado: aviso omitido");
    return false;
  }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: texto,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!r.ok) {
    // Telegram explica el motivo en "description" (no contiene secretos).
    const detalle = await r.json().catch(() => ({}));
    console.error("Telegram respondió", r.status, String(detalle?.description ?? "").slice(0, 200));
  }
  return r.ok;
}
