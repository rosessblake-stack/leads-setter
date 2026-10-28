import type { Metadata } from "next";
import { ZONA, REGLAS } from "@/lib/disponibilidad";
import { intentar } from "@/lib/db";
import { cargarEnlace, propuestaPara } from "@/lib/reservas";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata: Metadata = { title: "Reserva tu llamada", robots: { index: false, follow: false } };

const dia = (f: string) =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const hora = (t: Date) => t.toLocaleTimeString("es-ES", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });
const diaLargo = (t: Date) => t.toLocaleDateString("es-ES", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" });

export default async function Reservar({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const q = await searchParams;

  const datos = await intentar(async () => {
    const e = await cargarEnlace(token);
    if (!e || e.expira_at.getTime() < Date.now()) return { e: null, propuesta: null, fallo: false };
    if (e.reserva) return { e, propuesta: null, fallo: false };
    try {
      return { e, propuesta: await propuestaPara(e), fallo: false };
    } catch (err) {
      console.error("Reserva: no se pudo leer el calendario", err instanceof Error ? err.message : "desconocido");
      return { e, propuesta: null, fallo: true };
    }
  });
  const { e, propuesta, fallo } = datos;

  if (!e) {
    return (
      <main className="pantalla">
        <section className="centro bienvenida">
          <h1>Este enlace ya no es válido</h1>
          <p className="intro">Escríbeme por Instagram y te preparo uno nuevo.</p>
        </section>
      </main>
    );
  }

  const nombre = e.nombre.split(" ")[0];
  const duracion = REGLAS.duracionMin[e.tipo];

  if (e.reserva) {
    return (
      <main className="pantalla">
        <section className="centro bienvenida" role="status">
          <h1>Tu llamada está reservada</h1>
          <p className="intro">
            {diaLargo(e.reserva.inicio)} a las {hora(e.reserva.inicio)} (hora de España).
          </p>
          {e.reserva.meet_url && (
            <p>
              <a href={e.reserva.meet_url} target="_blank" rel="noopener noreferrer">
                Enlace de la videollamada
              </a>
            </p>
          )}
          <p className="ayuda">Te llegará la invitación a {e.email}. Si necesitas cambiar el día, escríbeme por Instagram.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="pantalla reserva-pagina">
      <h1>Hola, {nombre}</h1>
      <p className="intro">
        {e.tipo === "asesoria"
          ? `Elige el día y la hora de tu asesoría (${duracion === 60 ? "1 hora" : `${duracion} minutos`}).`
          : `Elige el día y la hora de tu llamada (${duracion} minutos).`}{" "}
        Los horarios están en hora de España.
      </p>

      {q.error && (
        <p className="error" role="alert">
          {q.error.slice(0, 200)}
        </p>
      )}
      {fallo && (
        <p className="error" role="alert">
          Ahora mismo no puedo mostrar los horarios. Inténtalo de nuevo en unos minutos o escríbeme por Instagram.
        </p>
      )}
      {propuesta?.sinHueco && (
        <p className="vacio">Ahora mismo no hay horarios libres. Te escribiré por Instagram para encontrar uno.</p>
      )}

      {propuesta?.dias.map((d) => (
        <form key={d.fecha} method="post" action={`/reservar/${token}/confirmar`} className="dia-reserva">
          <h2>{dia(d.fecha)}</h2>
          <div className="horas">
            {d.huecos.map((h) => (
              <button key={h.inicio.toISOString()} type="submit" name="inicio" value={h.inicio.toISOString()} className="hora">
                {hora(h.inicio)}
              </button>
            ))}
          </div>
        </form>
      ))}
    </main>
  );
}
