import type { FichaAnalizada } from "./analysis";
import type { Signals } from "@/formulario/signals";
import type { Solicitud } from "@/formulario/solicitud";
import type { Ruta } from "@/formulario/tipos";

export function escaparHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const OFERTA: Record<string, string> = {
  online: "Formación online",
  presencial: "Formación presencial",
  asesoria: "Asesoría 1 h",
};

export type ResumenLead = {
  nombre: string;
  email: string;
  telefono: string | null;
  ig_username: string | null;
  ubicacion: string | null;
  contacto: string | null;
  ruta: Ruta | null;
  v: string | null;
  como_nos_conociste: string | null;
  signals: Partial<Signals> | null;
};

const RUTA: Record<Ruta, string> = {
  presencial: "Formación presencial",
  online: "Formación online",
  asesoria: "Asesoría 1:1",
  no_claro: "No lo tiene claro",
};

export function resumenDe(s: Solicitud): ResumenLead {
  const c = s.respuestas["C03"];
  return {
    nombre: s.nombre,
    email: s.email,
    telefono: s.telefono,
    ig_username: s.ig_username,
    ubicacion: s.pais,
    contacto: c ? `${c.valor}${c.extra ? " (" + c.extra + ")" : ""}` : null,
    ruta: s.ruta,
    v: s.v,
    como_nos_conociste: s.como_nos_conociste,
    signals: s.signals,
  };
}

function lineasSignals(sg: Partial<Signals>): string[] {
  const partes: string[] = [];
  if (sg.urgencia != null) partes.push(`urgencia ${sg.urgencia}/10`);
  if (sg.quien_decide) partes.push(`decide: ${sg.quien_decide}`);
  if (sg.primer_pago_mismo_dia) partes.push(`primer pago el mismo día: ${sg.primer_pago_mismo_dia}`);
  if (sg.ingresos_mensuales) partes.push(`ingresos: ${sg.ingresos_mensuales}`);
  if (sg.clientes_mes) partes.push(`clientes/mes: ${sg.clientes_mes}`);
  if (sg.experiencia) partes.push(`experiencia: ${sg.experiencia}`);
  if (sg.inversion_previa?.length) partes.push(`inversión previa: ${sg.inversion_previa.join(", ")}`);
  const l: string[] = [];
  if (partes.length) l.push(`Señales: ${escaparHtml(partes.join(" · "))}`);
  if (sg.sugerencia_oferta) l.push(`Sugerencia por sus respuestas: ${escaparHtml(sg.sugerencia_oferta)}`);
  return l;
}

export function construirMensaje(r: ResumenLead, ficha: FichaAnalizada | null, nota?: string): string {
  const l: string[] = [];
  l.push(`<b>Nuevo lead:</b> ${escaparHtml(r.nombre)}`);
  const contacto = [r.email, r.telefono, r.ig_username ? "@" + r.ig_username : null].filter(Boolean).join(" · ");
  l.push(escaparHtml(contacto));
  if (r.ubicacion) l.push(escaparHtml(r.ubicacion));
  if (r.contacto) l.push(`Prefiere que le escribas por: ${escaparHtml(r.contacto)}`);
  l.push("");
  l.push(`Ruta: ${escaparHtml(r.ruta ? RUTA[r.ruta] : "formulario antiguo")}`);
  if (r.v) l.push(`Vídeo: ${escaparHtml(r.v)}`);
  if (r.como_nos_conociste) l.push(`Nos conoció por: ${escaparHtml(r.como_nos_conociste)}`);
  if (r.signals) l.push(...lineasSignals(r.signals));
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
