import { sql } from "@/lib/db";
import { borrarEvento, conexion } from "@/lib/google";
import { registrarError } from "@/lib/errores";

// Derecho de supresión: borra a la persona de la base de datos (ficha, formulario, historial, notas, resultado,
// reservas, enlaces...) y sus eventos del calendario. Lo que está fuera (contacto en ManyChat, mensajes de Telegram,
// copias de seguridad de Supabase) hay que borrarlo a mano.
export async function borrarPersona(fichaId: string): Promise<{ ok: boolean; calendario: boolean }> {
  const [f] = await sql()`select persona_id from setter.fichas where id = ${fichaId}`;
  if (!f) return { ok: false, calendario: false };
  const reservas = await sql()`
    select r.google_event_id from setter.reservas r join setter.fichas fi on fi.id = r.ficha_id
    where fi.persona_id = ${f.persona_id} and r.google_event_id is not null`;

  let calendario = reservas.length === 0;
  if (reservas.length > 0 && (await conexion())) {
    calendario = true;
    for (const r of reservas) {
      try {
        await borrarEvento(r.google_event_id as string);
      } catch (e) {
        calendario = false;
        await registrarError("google", e, { paso: "borrar evento al borrar a una persona" });
      }
    }
  }

  await sql().begin(async (tx) => {
    await tx`delete from setter.personas where id = ${f.persona_id}`;
    await tx`insert into setter.borrados (tenia_reserva, evento_calendario_borrado) values (${reservas.length > 0}, ${calendario && reservas.length > 0})`;
  });
  return { ok: true, calendario };
}
