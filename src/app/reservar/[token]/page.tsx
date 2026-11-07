import type { Metadata } from "next";
import { ZONA, REGLAS } from "@/lib/disponibilidad";
import { intentar } from "@/lib/db";
import { tokenPreparacion, urlPreparacion } from "@/lib/preparacion";
import { cargarEnlace, propuestaPara } from "@/lib/reservas";
import { registrarError } from "@/lib/errores";
import { nombreZona, zonaPersona } from "@/lib/zona";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata: Metadata = { title: "Reserva tu llamada", robots: { index: false, follow: false } };

const dia = (f: string) =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const hora = (t: Date, zona: string = ZONA) => t.toLocaleTimeString("es-ES", { timeZone: zona, hour: "2-digit", minute: "2-digit" });
const diaLargo = (t: Date, zona: string = ZONA) => t.toLocaleDateString("es-ES", { timeZone: zona, weekday: "long", day: "numeric", month: "long" });
const diaCorto = (t: Date, zona: string) => t.toLocaleDateString("es-ES", { timeZone: zona, weekday: "short", day: "numeric" });

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
      await registrarError("google", err, { paso: "leer calendario para reservas" });
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
  // Si la persona está en otra zona horaria, los horarios se le muestran en su hora, con la de España al lado.
  const suZona = zonaPersona(e.zona);
  const duracion = REGLAS.duracionMin[e.tipo];

  if (e.reserva) {
    let preparacion: string | null = null;
    if (e.tipo === "asesoria") {
      try {
        preparacion = urlPreparacion(tokenPreparacion(e.ficha_id));
      } catch {
        preparacion = null;
      }
    }
    return (
      <main className="pantalla">
        <section className="centro bienvenida" role="status">
          <h1>Tu llamada está reservada</h1>
          <p className="intro">
            {suZona ? (
              <>
                {diaLargo(e.reserva.inicio, suZona)} a las {hora(e.reserva.inicio, suZona)} (hora de {nombreZona(suZona)}).
              </>
            ) : (
              <>
                {diaLargo(e.reserva.inicio)} a las {hora(e.reserva.inicio)} (hora de España).
              </>
            )}
          </p>
          {suZona && (
            <p className="ayuda">
              En España: {diaLargo(e.reserva.inicio)} a las {hora(e.reserva.inicio)}.
            </p>
          )}
          {e.reserva.meet_url && (
            <p>
              <a href={e.reserva.meet_url} target="_blank" rel="noopener noreferrer">
                Enlace de la videollamada
              </a>
            </p>
          )}
          {preparacion && (
            <>
              <p className="intro">Antes de la llamada, rellena las preguntas de preparación. Me ayudan a preparar tu caso.</p>
              <p>
                <a className="principal" href={preparacion} style={{ display: "inline-block", textDecoration: "none", padding: "12px 20px" }}>
                  Preparar mi asesoría (unos 15 minutos)
                </a>
              </p>
            </>
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
        {suZona ? `Los horarios están en tu hora (${nombreZona(suZona)}). En España son otra hora: te lo indico en cada día.` : "Los horarios están en hora de España."}
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
          <h2>{dia(d.fecha)}{suZona ? " (en España)" : ""}</h2>
          <div className="horas">
            {d.huecos.map((h) => (
              <button key={h.inicio.toISOString()} type="submit" name="inicio" value={h.inicio.toISOString()} className="hora">
                {suZona ? (
                  <>
                    {hora(h.inicio, suZona)}
                    {diaCorto(h.inicio, suZona) !== diaCorto(h.inicio, ZONA) && <small> · {diaCorto(h.inicio, suZona)}</small>}
                  </>
                ) : (
                  hora(h.inicio)
                )}
              </button>
            ))}
          </div>
        </form>
      ))}
    </main>
  );
}
