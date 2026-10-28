import { sql } from "@/lib/db";
import { limpiarContexto, limpiarMensaje, type Origen } from "@/lib/errores-util";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";
import { urlPanel } from "@/lib/config";

const MAX_AVISOS_HORA = 5;

// Guarda un error para verlo en el panel (Errores). Nunca lanza: si no se puede guardar, queda en los registros de Vercel.
export async function registrarError(origen: Origen, error: unknown, contexto: Record<string, unknown> = {}): Promise<void> {
  const bruto = error instanceof Error ? error.message : typeof error === "string" ? error : "error desconocido";
  const mensaje = limpiarMensaje(bruto) || "error desconocido";
  const ctx = limpiarContexto(contexto);
  console.error(`[${origen}]`, mensaje);
  try {
    await Promise.race([guardar(origen, mensaje, ctx), new Promise((_, no) => setTimeout(() => no(new Error("tiempo agotado")), 4000))]);
  } catch (e) {
    console.error("No se pudo guardar el error en la base de datos:", e instanceof Error ? limpiarMensaje(e.message) : "desconocido");
  }
}

async function guardar(origen: Origen, mensaje: string, ctx: Record<string, unknown>) {
  // Si es el mismo error de la última hora y sigue sin revisar, se cuenta una vez más en vez de repetirlo.
  const repetido = await sql()`
    update setter.errores set veces = veces + 1, ultimo_at = now(), contexto = ${sql().json(ctx as never)}
    where id = (select id from setter.errores where origen = ${origen} and mensaje = ${mensaje} and revisado_at is null
                  and ultimo_at > now() - interval '1 hour' order by id desc limit 1)
    returning id`;
  if (repetido.length > 0) return;
  await sql()`insert into setter.errores (origen, mensaje, contexto) values (${origen}, ${mensaje}, ${sql().json(ctx as never)})`;
  await sql()`delete from setter.errores where creado_at < now() - interval '90 days'`;
  // Aviso por Telegram de los errores nuevos, con tope por hora (y nunca por errores de Telegram, para no hacer un bucle).
  if (origen === "telegram") return;
  const [{ n }] = await sql()`select count(*)::int as n from setter.errores where creado_at > now() - interval '1 hour'`;
  if (n <= MAX_AVISOS_HORA) {
    await avisarAdmin(`⚠️ <b>Error en ${escaparHtml(origen)}</b>: ${escaparHtml(mensaje.slice(0, 200))}\n${urlPanel()}/panel/errores`).catch(() => false);
  }
}
