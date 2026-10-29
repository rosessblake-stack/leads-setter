import { cookies } from "next/headers";
import { intentar, sql } from "@/lib/db";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Números de la barra lateral del panel (solo contadores, sin datos de personas).
export async function GET() {
  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) return Response.json({ ok: false }, { status: 401 });
  try {
    const [c] = await intentar(
      () => sql()`
        select
          count(*)::int as todos,
          count(*) filter (where fi.fase = 'nuevo' and fi.propuesta_estado in ('pendiente', 'no_enviada') and f.creado_at < now() - interval '24 hours')::int as sin_contactar,
          count(*) filter (where fi.propuesta_estado in ('pendiente', 'no_enviada') and fi.fase not in ('vendido', 'no_vendido', 'descartado'))::int as por_enviar,
          count(*) filter (where fi.reserva_at is null and f.ruta is distinct from 'asesoria' and fi.propuesta_estado in ('enviada', 'manual')
                             and fi.fase not in ('vendido', 'no_vendido', 'descartado'))::int as sin_agendar,
          count(*) filter (where fi.reserva_at is not null and fi.fase not in ('vendido', 'no_vendido', 'descartado'))::int as agendadas,
          count(*) filter (where fi.fase = 'vendido')::int as vendidos,
          count(*) filter (where fi.fase = 'no_vendido')::int as no_vendidos,
          (select count(*)::int from setter.errores where revisado_at is null) as errores
        from setter.fichas fi join setter.formularios f on f.id = fi.formulario_id`,
    );
    return Response.json({ ok: true, ...c }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
