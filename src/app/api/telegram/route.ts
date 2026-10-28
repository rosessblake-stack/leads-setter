import { timingSafeEqual } from "node:crypto";
import { avisarAdmin } from "@/lib/telegram";
import { cerrarTodo, crearEnlace } from "@/lib/panel";
import {
  comandoEstado,
  comandoLead,
  comandoLeads,
  numeroDeLead,
  esAdmin,
  parsearComando,
  TEXTO_AYUDA,
} from "@/lib/comandos";
import { registrarError } from "@/lib/errores";

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
  else if (comando === "panel") {
    try {
      const url = await crearEnlace();
      await avisarAdmin(`Tu enlace para entrar al panel (caduca en 10 minutos y solo funciona una vez):\n${url}`);
    } catch (e) {
      await registrarError("panel", e, { paso: "enlace de entrada desde Telegram" });
      await avisarAdmin("No pude crear el enlace del panel: error de base de datos.");
    }
  } else if (comando === "cerrar_panel") {
    try {
      await cerrarTodo();
      await avisarAdmin("Listo: todas las sesiones del panel están cerradas y los enlaces pendientes anulados.");
    } catch {
      await avisarAdmin("No pude cerrar las sesiones: error de base de datos.");
    }
  } else if (comando === "lead") {
    const n = numeroDeLead(mensaje.text);
    await avisarAdmin(n ? await comandoLead(n) : "Usa /lead seguido de un número del 1 al 5, por ejemplo /lead 1.");
  }
  else if (comando === "ayuda") await avisarAdmin(TEXTO_AYUDA);

  return new Response("ok");
}
