import { elegibleParaOpinion, secretoValido } from "@/lib/guia";
import { registrarError } from "@/lib/errores";
import { guardarCampo } from "@/lib/manychat";
import { permitido } from "@/lib/ratelimit";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// Campo de ManyChat donde se deja la respuesta («si» / «no»), para que el flujo la use en una condición.
const CAMPO = () => process.env.MANYCHAT_CAMPO_ELEGIBLE ?? "guia_elegible";

// ManyChat pregunta aquí si quien ha escrito la palabra «OPINIÓN» (o ha abierto el chat desde el visor) es alguien a quien hay que hacerle la
// pregunta de la guía. Responde siempre 200 con `elegible` y deja «si» o «no» en un campo del contacto. Sin la clave correcta, no hace nada.
async function tratar(req: Request) {
  const esperado = (process.env.MANYCHAT_WEBHOOK_SECRET ?? "").trim();
  if (!secretoValido(req.headers.get("x-manychat-secret"), esperado)) return Response.json({ ok: false, error: "clave" }, { status: 401 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!(await permitido(`manychat-elegible:${ip}`, 120, 10 * 60 * 1000))) return Response.json({ ok: false, error: "demasiadas_peticiones" }, { status: 429 });
  const mc = (new URL(req.url).searchParams.get("mc") ?? "").trim();
  if (!/^\d{3,20}$/.test(mc)) return Response.json({ ok: false, error: "mc" }, { status: 400 });
  try {
    const r = await elegibleParaOpinion(mc);
    await guardarCampo(mc, CAMPO(), r.elegible ? "si" : "no").catch((e) => registrarError("manychat", e, { paso: "guardar si es elegible para opinar" }));
    await sql()`insert into setter.eventos (persona_id, tipo, datos) select p.id, 'opinion_solicitada', ${sql().json({ elegible: r.elegible, motivo: r.motivo })} from setter.personas p where p.manychat_id = ${mc}`.catch(() => undefined);
    return Response.json({ ok: true, elegible: r.elegible, motivo: r.motivo });
  } catch (e) {
    await registrarError("manychat", e, { paso: "comprobar si es elegible para opinar" });
    return Response.json({ ok: false, error: "servidor" }, { status: 500 });
  }
}

export const GET = tratar;
export const POST = tratar;
