import { timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
import { reanalizarPendientes } from "@/lib/proceso";
import { procesarPropuestas } from "@/lib/propuestas";
import { procesarSeguimientoGuia } from "@/lib/guia";
import { procesarRespuestasAtascadas } from "@/lib/forzar-seguimiento";
import { limpiarComentarios } from "@/lib/instagram";
import { procesarLlamadas } from "@/lib/llamadas";
import { recordarPreparaciones } from "@/lib/recordatorios";
import { registrarError } from "@/lib/errores";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function igual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Lo llama un temporizador (cada pocos minutos). Sin la clave correcta, no hace nada.
export async function POST(req: Request) {
  const recibida = req.headers.get("x-cron-secret") ?? "";
  try {
    // La clave del temporizador vive en la base de datos (la misma que lee el temporizador); no hay otra variable que configurar.
    const [c] = await sql()`select valor ->> 'secreto' as secreto from setter.ajustes where clave = 'cron'`;
    const clave = String(c?.secreto ?? "");
    if (clave.length < 24 || !igual(recibida, clave)) return new Response("No autorizado", { status: 401 });
    const reanalizadas = await reanalizarPendientes().catch(async (e) => {
      await registrarError("claude", e, { paso: "reintento del análisis" });
      return 0;
    });
    const recordadas = await recordarPreparaciones().catch(async (e) => {
      await registrarError("telegram", e, { paso: "recordatorios" });
      return 0;
    });
    const llamadas = await procesarLlamadas().catch(async (e) => {
      await registrarError("claude", e, { paso: "llamadas" });
      return 0;
    });
    const seguimientos = await procesarSeguimientoGuia().catch(async (e) => {
      await registrarError("manychat", e, { paso: "seguimiento de la guía" });
      return 0;
    });
    const atascadas = await procesarRespuestasAtascadas().catch(async (e) => {
      await registrarError("manychat", e, { paso: "respuestas atascadas" });
      return 0;
    });
    await limpiarComentarios().catch(() => undefined);
    const r = await procesarPropuestas();
    return Response.json({ ok: true, ...r, reanalizadas, recordadas, llamadas, seguimientos, atascadas });
  } catch (e) {
    await registrarError("propuestas", e, { paso: "temporizador" });
    return Response.json({ ok: false }, { status: 500 });
  }
}
