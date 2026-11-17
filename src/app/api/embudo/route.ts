import { sql } from "@/lib/db";
import { permitido } from "@/lib/ratelimit";

export const maxDuration = 10;

// Cuenta hasta dónde llega la gente en el formulario y si descarga el regalo. No guarda nada personal: un identificador
// aleatorio de la visita, el paso y la campaña. Si algo falla, no importa: nunca debe molestar a quien rellena.
const SESION = /^[A-Za-z0-9-]{16,40}$/;
const PASO = /^[A-Za-z0-9_-]{1,30}$/;
const CAMPANA = /^[A-Za-z0-9_-]{0,40}$/;

export async function POST(req: Request) {
  const vacio = () => new Response(null, { status: 204 });
  try {
    const origen = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origen && host && new URL(origen).host !== host) return vacio();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
    if (!(await permitido(`embudo:${ip}`, 300, 10 * 60 * 1000))) return vacio();
    const texto = await req.text();
    if (texto.length > 500) return vacio();
    const d = JSON.parse(texto) as { s?: unknown; p?: unknown; n?: unknown; c?: unknown };
    const s = String(d.s ?? "");
    const p = String(d.p ?? "");
    const c = String(d.c ?? "");
    const n = Number(d.n);
    if (!SESION.test(s) || !PASO.test(p) || !CAMPANA.test(c) || !Number.isInteger(n) || n < 0 || n > 200) return vacio();
    await sql()`
      insert into setter.embudo_formulario (sesion, paso, indice, campana) values (${s}, ${p}, ${n}, ${c || null})
      on conflict (sesion, paso) do nothing`;
  } catch {
    /* sin tabla o sin conexión: se ignora */
  }
  return vacio();
}
