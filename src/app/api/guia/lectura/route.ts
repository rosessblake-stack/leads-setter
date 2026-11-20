import { sql } from "@/lib/db";
import { leerCargaLectura, pasoDiapositiva } from "@/lib/lectura";
import { permitido } from "@/lib/ratelimit";

export const maxDuration = 10;

// El visor de la guía manda aquí, cada pocos segundos, qué diapositivas ve la persona y cuánto tiempo. Solo se guarda si la sesión existe
// (viene de un formulario). Nunca debe molestar a quien lee: cualquier fallo se ignora.
export async function POST(req: Request) {
  const vacio = () => new Response(null, { status: 204 });
  try {
    const origen = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origen && host && new URL(origen).host !== host) return vacio();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
    if (!(await permitido(`lectura:${ip}`, 900, 10 * 60 * 1000))) return vacio();
    const carga = leerCargaLectura(await req.text());
    if (!carga) return vacio();
    const [existe] = await sql()`select campana from setter.embudo_formulario where sesion = ${carga.s} limit 1`;
    if (!existe) return vacio();
    const campana = (existe.campana as string | null) ?? (carga.c || null);
    const filas: { sesion: string; paso: string; indice: number; campana: string | null }[] = [{ sesion: carga.s, paso: "leer_ini", indice: 0, campana }];
    for (const [n, seg] of carga.t) filas.push({ sesion: carga.s, paso: pasoDiapositiva(n), indice: seg, campana });
    if (carga.fin) filas.push({ sesion: carga.s, paso: "leer_fin", indice: 0, campana });
    if (carga.clic) filas.push({ sesion: carga.s, paso: "leer_clic", indice: 0, campana });
    await sql()`
      insert into setter.embudo_formulario ${sql()(filas, "sesion", "paso", "indice", "campana")}
      on conflict (sesion, paso) do update set indice = greatest(setter.embudo_formulario.indice, excluded.indice)`;
  } catch {
    /* sin tabla o sin conexión: se ignora */
  }
  return vacio();
}
