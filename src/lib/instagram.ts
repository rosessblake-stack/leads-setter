import { createHmac, timingSafeEqual } from "node:crypto";
import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { registrarError } from "@/lib/errores";
import { avisarAdmin } from "@/lib/telegram";

// Meta firma cada aviso con HMAC-SHA256 del cuerpo y el secreto de la aplicación: «sha256=<hex>».
export function firmaMetaValida(cuerpo: string, cabecera: string | null, secreto: string): boolean {
  if (!cabecera || !secreto || !cabecera.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpo).digest("hex");
  const a = Buffer.from(cabecera.slice(7));
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ComentarioIg = { id: string; mediaId: string; userId: string | null; username: string | null; texto: string | null; en: Date };

// Saca los comentarios nuevos de un aviso. Ignora respuestas (parent_id) y los comentarios de la propia cuenta.
export function comentariosDe(payload: unknown): ComentarioIg[] {
  const salida: ComentarioIg[] = [];
  const p = payload as { entry?: { id?: string; time?: number; changes?: { field?: string; value?: Record<string, unknown> }[] }[] };
  for (const e of p?.entry ?? []) {
    for (const c of e.changes ?? []) {
      if (c.field !== "comments" || !c.value) continue;
      const v = c.value as { id?: string; parent_id?: string; text?: string; from?: { id?: string; username?: string }; media?: { id?: string } };
      if (!v.id || !v.media?.id || v.parent_id) continue;
      if (v.from?.id && e.id && v.from.id === e.id) continue; // lo escribió Blake
      salida.push({
        id: String(v.id),
        mediaId: String(v.media.id),
        userId: v.from?.id ? String(v.from.id) : null,
        username: v.from?.username ? String(v.from.username).replace(/^@/, "").toLowerCase().slice(0, 60) : null,
        texto: typeof v.text === "string" ? v.text.replace(/\s+/g, " ").trim().slice(0, 300) : null,
        en: new Date(Number(e.time ?? Date.now() / 1000) * 1000),
      });
    }
  }
  return salida;
}

// Lee el texto, el enlace y la fecha del reel si hay una clave de acceso. Si falla, no pasa nada: Blake lo describe a mano.
async function datosDelReel(mediaId: string): Promise<{ caption: string | null; permalink: string | null; timestamp: string | null }> {
  const token = (process.env.INSTAGRAM_ACCESS_TOKEN ?? "").trim();
  if (!token) return { caption: null, permalink: null, timestamp: null };
  try {
    const r = await fetch(`https://graph.instagram.com/v21.0/${encodeURIComponent(mediaId)}?fields=caption,permalink,timestamp`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`Instagram API ${r.status}`);
    const j = (await r.json()) as { caption?: string; permalink?: string; timestamp?: string };
    return { caption: j.caption ?? null, permalink: j.permalink ?? null, timestamp: j.timestamp ?? null };
  } catch (e) {
    await registrarError("servidor", e, { paso: "leer datos del reel en Instagram" });
    return { caption: null, permalink: null, timestamp: null };
  }
}

// Guarda el comentario y, si el reel es nuevo, lo da de alta y avisa a Blake para que lo describa.
export async function registrarComentarios(lista: ComentarioIg[]): Promise<number> {
  let nuevos = 0;
  for (const c of lista) {
    const [ya] = await sql()`select id from setter.videos where ig_media_id = ${c.mediaId}`;
    if (!ya) {
      const d = await datosDelReel(c.mediaId);
      const notas = d.caption ? `Texto del reel: ${d.caption.replace(/\s+/g, " ").trim().slice(0, 500)}` : null;
      const [v] = await sql()`
        insert into setter.videos (codigo, ig_media_id, enlace, publicado_at, notas, formato)
        values (${`ig-${c.mediaId}`.slice(0, 40)}, ${c.mediaId}, ${d.permalink}, ${d.timestamp ? new Date(d.timestamp) : null}, ${notas}, 'reel')
        on conflict do nothing returning id`;
      if (v) {
        await avisarAdmin(`📹 Reel nuevo comentado${d.permalink ? ` (${d.permalink})` : ""}.\nDime de qué trata: ${urlPanel()}/panel/videos`).catch(() => false);
      }
    }
    const [n] = await sql()`
      insert into setter.comentarios_ig (ig_comment_id, ig_media_id, ig_user_id, username, texto, comentado_at)
      values (${c.id}, ${c.mediaId}, ${c.userId}, ${c.username}, ${c.texto}, ${c.en})
      on conflict (ig_comment_id) do nothing returning id`;
    if (n) nuevos++;
  }
  return nuevos;
}

// Se borran los comentarios de más de 30 días: ya no sirven para enlazar a nadie.
export async function limpiarComentarios(): Promise<void> {
  await sql()`delete from setter.comentarios_ig where comentado_at < now() - interval '30 days'`;
}
