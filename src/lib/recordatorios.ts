import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { registrarError } from "@/lib/errores";
import { fechaCorta } from "@/lib/panel-util";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";

// Aviso a Blake (no a la persona): una asesoría reservada para las próximas 48 h cuya preparación sigue sin rellenar.
// Se avisa una sola vez por persona (queda un evento en su historial).
export async function recordarPreparaciones(): Promise<number> {
  const filas = await sql()`
    select r.ficha_id, p.id as persona_id, p.nombre, r.inicio
    from setter.reservas r
    join setter.fichas fi on fi.id = r.ficha_id
    join setter.personas p on p.id = fi.persona_id
    left join setter.preparaciones pr on pr.ficha_id = r.ficha_id
    where r.estado = 'confirmada' and r.tipo = 'asesoria'
      and r.inicio > now() and r.inicio <= now() + interval '48 hours'
      and pr.completada_at is null
      and not exists (
        select 1 from setter.eventos e
        where e.persona_id = p.id and e.tipo = 'recordatorio_preparacion' and e.creado_at > now() - interval '7 days')
    order by r.inicio limit 10`;
  let avisadas = 0;
  for (const f of filas) {
    try {
      const enviado = await avisarAdmin(
        `⏰ <b>${escaparHtml(String(f.nombre).slice(0, 60))}</b> tiene asesoría el ${escaparHtml(fechaCorta(f.inicio as Date))} y aún no ha rellenado la preparación.\n${urlPanel()}/panel/lead/${f.ficha_id}`,
      );
      if (!enviado) continue; // si Telegram falla, se reintenta en el siguiente ciclo
      await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'recordatorio_preparacion', '{}'::jsonb)`;
      avisadas++;
    } catch (e) {
      await registrarError("telegram", e, { paso: "recordatorio de preparación", ficha: f.ficha_id as string });
    }
  }
  return avisadas;
}
