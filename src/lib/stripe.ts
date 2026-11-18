import { createHmac, timingSafeEqual } from "node:crypto";
import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { registrarError } from "@/lib/errores";
import { ErrorManyChat, enviarPropuesta, infoContacto, manychatConfigurado } from "@/lib/manychat";
import { nombreSeguro, VENTANA_SEGURA_H } from "@/lib/propuestas";
import { crearEnlaceReserva } from "@/lib/reservas";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";

const TOLERANCIA_S = 5 * 60;

// Comprueba la firma que Stripe pone en cada aviso: HMAC-SHA256 de «marca.cuerpo» con el secreto del webhook.
export function firmaValida(cuerpo: string, cabecera: string | null, secreto: string, ahoraS = Math.floor(Date.now() / 1000)): boolean {
  if (!cabecera || !secreto) return false;
  const partes = Object.fromEntries(
    cabecera.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(partes.t);
  if (!Number.isFinite(t) || Math.abs(ahoraS - t) > TOLERANCIA_S) return false;
  const esperada = createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex");
  // Stripe puede mandar varias firmas v1 (al rotar el secreto): basta con que una coincida.
  return cabecera
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const a = Buffer.from(p.slice(3));
      const b = Buffer.from(esperada);
      return a.length === b.length && timingSafeEqual(a, b);
    });
}

type Pago = {
  stripeId: string;
  email: string | null;
  importeCents: number;
  moneda: string;
  descripcion: string | null;
  fichaId: string | null;
  pagadoAt: Date;
  unico: boolean; // pago único (enlace de pago), no cuota de un plan
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Traduce el evento de Stripe a un pago. Devuelve null si no es un pago que haya que registrar.
export function pagoDe(evento: { type?: string; data?: { object?: Record<string, unknown> } }): Pago | null {
  const o = evento.data?.object;
  if (!o) return null;
  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
  if (evento.type === "checkout.session.completed") {
    // Si la compra genera factura, se registra con «invoice.paid» para no contarla dos veces.
    if (o.payment_status !== "paid" || o.invoice) return null;
    const det = (o.customer_details ?? {}) as Record<string, unknown>;
    const ref = texto(o.client_reference_id);
    return {
      stripeId: String(o.id),
      email: texto(det.email) ?? texto(o.customer_email),
      importeCents: Number(o.amount_total ?? 0),
      moneda: String(o.currency ?? "eur").toUpperCase(),
      descripcion: null,
      fichaId: ref && UUID.test(ref) ? ref : null,
      pagadoAt: new Date(Number(o.created ?? Date.now() / 1000) * 1000),
      unico: o.mode === "payment",
    };
  }
  if (evento.type === "invoice.paid") {
    const lineas = ((o.lines as { data?: { description?: string }[] } | undefined)?.data ?? []) as { description?: string }[];
    const pagadoS = Number((o.status_transitions as Record<string, unknown> | undefined)?.paid_at ?? o.created ?? Date.now() / 1000);
    return {
      stripeId: String(o.id),
      email: texto(o.customer_email),
      importeCents: Number(o.amount_paid ?? 0),
      moneda: String(o.currency ?? "eur").toUpperCase(),
      descripcion: texto(lineas[0]?.description),
      fichaId: null,
      pagadoAt: new Date(pagadoS * 1000),
      unico: false,
    };
  }
  return null;
}

const euros = (c: number, moneda: string) => `${(c / 100).toLocaleString("es-ES", { minimumFractionDigits: c % 100 ? 2 : 0 })} ${moneda === "EUR" ? "€" : moneda}`;

// Intenta mandar el enlace de reserva a la persona por ManyChat. Devuelve el texto para el aviso de Telegram.
async function enviarReservaTrasPago(persona: { id: string; nombre: string }, fichaId: string, url: string): Promise<string> {
  const aMano = (motivo: string) => `\n⚠️ ${motivo} Envíale tú este enlace para que reserve su hora: ${url}`;
  const [pe] = await sql()`select manychat_id from setter.personas where id = ${persona.id}`;
  const mc = pe?.manychat_id as string | null | undefined;
  if (!mc) return aMano("No viene de ManyChat, así que no se le ha podido mandar solo.");
  if (!manychatConfigurado()) return aMano("ManyChat no está configurado.");
  try {
    const info = await infoContacto(mc);
    const horas = info.ultimaInteraccion ? (Date.now() - info.ultimaInteraccion.getTime()) / 3600_000 : null;
    if (horas !== null && horas > VENTANA_SEGURA_H) {
      return aMano(`Han pasado más de ${VENTANA_SEGURA_H} h desde su última interacción y Instagram no deja escribir primero.`);
    }
    const nombre = nombreSeguro(persona.nombre);
    const texto = `Hola${nombre ? ` ${nombre}` : ""}, soy Blake. ¡Pago recibido, gracias! 🙌

Ahora elige el día y la hora de tu llamada de asesoría: se agenda una semana después, para poder analizar y preparar tu caso.

Pulsa el botón para reservarla.`;
    await enviarPropuesta(mc, "llamada", texto, url);
    await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${persona.id}, 'reserva_enviada_tras_pago', ${sql().json({ ficha: fichaId })})`;
    return "\n✅ Se le ha mandado solo, por Instagram, el enlace para reservar su hora.";
  } catch (e) {
    const incierto = e instanceof ErrorManyChat && !e.definitivo;
    await registrarError("manychat", e, { paso: "enviar enlace de reserva tras el pago", ficha: fichaId, incierto });
    return aMano(incierto ? "No sé si el mensaje con el enlace salió; mira su chat antes de repetirlo." : "No se le pudo mandar el enlace por ManyChat.");
  }
}

// Registra el pago una sola vez, lo apunta en el historial y avisa por Telegram. No cambia la fase ni marca ninguna venta:
// eso lo decides tú en la ficha. Si es el pago de una asesoría, deja listo el enlace de reserva.
export async function registrarPago(p: Pago): Promise<"nuevo" | "repetido"> {
  const email = p.email?.trim().toLowerCase() ?? null;
  let persona: { id: string; nombre: string } | undefined;
  let ficha: { id: string; ruta: string | null } | undefined;
  if (p.fichaId) {
    [ficha] = await sql()`select fi.id, fo.ruta from setter.fichas fi join setter.formularios fo on fo.id = fi.formulario_id where fi.id = ${p.fichaId}`;
    if (ficha) [persona] = await sql()`select p.id, p.nombre from setter.personas p join setter.fichas fi on fi.persona_id = p.id where fi.id = ${p.fichaId}`;
  }
  if (!persona && email) {
    [persona] = await sql()`select id, nombre from setter.personas where lower(email) = ${email} limit 1`;
    if (persona) {
      [ficha] = await sql()`
        select fi.id, fo.ruta from setter.fichas fi join setter.formularios fo on fo.id = fi.formulario_id
        where fi.persona_id = ${persona.id} order by fi.creado_at desc limit 1`;
    }
  }
  const [nuevo] = await sql()`
    insert into setter.pagos (persona_id, stripe_id, email_pagador, importe_cents, moneda, descripcion, estado, pagado_at)
    values (${persona?.id ?? null}, ${p.stripeId}, ${email}, ${p.importeCents}, ${p.moneda}, ${p.descripcion}, 'pagado', ${p.pagadoAt})
    on conflict (stripe_id) do nothing returning id`;
  if (!nuevo) return "repetido";
  if (persona) {
    await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${persona.id}, 'pago_recibido', ${sql().json({ importe_cents: p.importeCents, moneda: p.moneda })})`;
  }

  // Pago de una asesoría: se le manda solo, por ManyChat, el enlace para elegir día y hora (con el flujo de «Propuesta llamada», que
  // ya existe). Si no se puede (sin ManyChat, ventana de 24 h cerrada, error), el enlace llega a Telegram para enviárselo a mano.
  let reserva = "";
  if (persona && ficha && ficha.ruta === "asesoria" && p.unico) {
    try {
      const url = await crearEnlaceReserva(ficha.id as string);
      if (url) reserva = await enviarReservaTrasPago(persona, ficha.id as string, url);
    } catch (e) {
      await registrarError("reservas", e, { paso: "crear enlace de reserva tras el pago", ficha: ficha.id as string });
    }
  }
  const quien = persona ? `<b>${escaparHtml(String(persona.nombre).slice(0, 60))}</b>` : `<b>${escaparHtml(email ?? "alguien sin email")}</b> (no está entre tus leads)`;
  const ficha_url = persona && ficha ? `\n${urlPanel()}/panel/lead/${ficha.id}` : "";
  await avisarAdmin(`💳 Pago recibido de ${quien}: ${escaparHtml(euros(p.importeCents, p.moneda))}${p.descripcion ? ` · ${escaparHtml(p.descripcion.slice(0, 80))}` : ""}${reserva}${ficha_url}`).catch(() => false);
  return "nuevo";
}
