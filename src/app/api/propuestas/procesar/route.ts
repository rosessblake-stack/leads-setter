import { timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
import { procesarPropuestas } from "@/lib/propuestas";

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
    const r = await procesarPropuestas();
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error("Propuestas: error general", e instanceof Error ? e.message : "desconocido");
    return Response.json({ ok: false }, { status: 500 });
  }
}
