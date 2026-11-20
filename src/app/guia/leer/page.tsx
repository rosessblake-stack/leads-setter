import type { Metadata, Viewport } from "next";
import { campanaDe } from "@/formulario/campanas";
import { sql } from "@/lib/db";
import { SESION_VALIDA, TOTAL_DIAPOSITIVAS } from "@/lib/lectura";
import { Visor } from "./visor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guía: cuánto cobrar y qué dicen tus datos", robots: { index: false, follow: false } };
// Se puede ampliar con los dedos: las diapositivas son horizontales y en un móvil vertical se ven pequeñas.
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, themeColor: "#141414" };

const CAMPANA_POR_DEFECTO = "cobrar-historia-01";

export default async function Leer({ searchParams }: { searchParams: Promise<{ s?: string; mc?: string; v?: string }> }) {
  const q = await searchParams;
  const campana = (q.v && campanaDe(q.v) ? q.v : CAMPANA_POR_DEFECTO) as string;
  let sesion: string | null = q.s && SESION_VALIDA.test(q.s) ? q.s : null;
  // Si viene del chat (enlace con el ID de ManyChat), se busca su sesión del formulario para poder medir la lectura.
  if (!sesion && q.mc && /^\d{3,20}$/.test(q.mc)) {
    try {
      const [r] = await sql()`
        select e.datos ->> 'sesion' as sesion from setter.eventos e join setter.personas p on p.id = e.persona_id
        where p.manychat_id = ${q.mc} and e.tipo = 'formulario_enviado' and e.datos ->> 'sesion' is not null order by e.creado_at desc limit 1`;
      if (r?.sesion && SESION_VALIDA.test(String(r.sesion))) sesion = String(r.sesion);
    } catch {
      /* sin medición, pero se puede leer igual */
    }
  }
  const chat = campanaDe(campana)?.chat;
  return (
    <Visor
      sesion={sesion}
      campana={campana}
      total={TOTAL_DIAPOSITIVAS}
      chatUrl={process.env.GUIA_URL_CHAT || chat?.url || "https://ig.me/m/blakebraider"}
      chatBoton={chat?.boton ?? "Haz clic aquí y cuéntame qué te ha parecido"}
      palabra={chat?.palabra ?? "OPINIÓN"}
      pdfUrl={campanaDe(campana)?.regalo?.url ?? "/guia-cobrar-y-datos.pdf"}
    />
  );
}
