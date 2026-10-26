import { timingSafeEqual } from "node:crypto";
import { avisarAdmin } from "@/lib/telegram";
import {
  comandoEstado,
  comandoLeads,
  esAdmin,
  parsearComando,
  TEXTO_AYUDA,
} from "@/lib/comandos";

export const maxDuration = 30;

function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Webhook de Telegram. Solo acepta llamadas firmadas con el secreto y solo
// responde a mensajes de tu chat; cualquier otra cosa se ignora en silencio.
export async function POST(req: Request) {
  if (!secretoValido(req.headers.get("x-telegram-bot-api-secret-token"))) {
    console.warn("Webhook de Telegram rechazado: el secreto no coincide o falta");
    return new Response("no autorizado", { status: 401 });
  }

  let update: { message?: { chat?: { id?: number }; text?: string } };
  try {
    update = await req.json();
  } catch {
    return new Response("ok");
  }

  const mensaje = update.message;
  if (!mensaje || !esAdmin(mensaje.chat?.id, process.env.TELEGRAM_ADMIN_CHAT_ID)) {
    console.warn("Webhook de Telegram ignorado: el mensaje no viene del chat del admin");
    return new Response("ok");
  }

  const comando = parsearComando(mensaje.text);
  console.log("Comando de Telegram recibido:", comando ?? "ninguno");
  if (comando === "estado") await avisarAdmin(await comandoEstado());
  else if (comando === "leads") await avisarAdmin(await comandoLeads());
  else if (comando === "ayuda") await avisarAdmin(TEXTO_AYUDA);

  return new Response("ok");
}
