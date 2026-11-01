import Link from "next/link";
import { intentar } from "@/lib/db";
import { conexion, googleConfigurado, ocupadosEntre } from "@/lib/google";
import { diagnosticar, manychatConfigurado, type Diagnostico } from "@/lib/manychat";
import { registrarError } from "@/lib/errores";
import { HORA_PRIMERA, HORA_ULTIMA, leerModo } from "@/lib/propuestas";
import { proponer, ZONA, REGLAS } from "@/lib/disponibilidad";
import { exigirSesion } from "@/lib/panel";
import { fechaCorta } from "@/lib/panel-util";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = { title: "Ajustes" };

const MENSAJE: Record<string, { tipo: "ok" | "error"; texto: string }> = {
  ok: { tipo: "ok", texto: "Google conectado." },
  error: { tipo: "error", texto: "No se pudo conectar con Google. Inténtalo de nuevo." },
  sin_claves: { tipo: "error", texto: "Faltan las claves de Google en Vercel (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET)." },
};

const dia = (f: string) =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const hora = (t: Date) => t.toLocaleTimeString("es-ES", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ google?: string; propuestas?: string; prueba?: string; detalle?: string }> }) {
  await exigirSesion();
  const q = await searchParams;
  const aviso = q.google ? MENSAJE[q.google] : undefined;

  const { modo, diag } = await intentar(async () => {
    const modo = await leerModo();
    let diag: Diagnostico | null = null;
    if (manychatConfigurado()) {
      diag = await diagnosticar();
      // Lo que falla queda guardado en la página Errores con el motivo exacto de ManyChat.
      for (const [parte, r] of [["conexión", diag.conexion], ["flujos", diag.flujos], ["campos", diag.campos]] as const) {
        if (!r.ok && r.detalle) await registrarError("manychat", `Diagnóstico (${parte}): ${r.detalle}`);
      }
    }
    return { modo, diag };
  });

  const { c, prueba, fallo } = await intentar(async () => {
    const c = await conexion();
    if (!c) return { c, prueba: null, fallo: false };
    try {
      const ahora = new Date();
      const ocupados = await ocupadosEntre(ahora, new Date(ahora.getTime() + 25 * 86400000));
      return { c, prueba: proponer("venta", ocupados, ahora), fallo: false };
    } catch {
      return { c, prueba: null, fallo: true };
    }
  });

  return (
    <main className="pantalla panel">
      <p>
        <Link href="/panel">← Volver a la lista</Link>
      </p>
      <header className="panel-cabecera">
        <h1>Ajustes</h1>
      </header>

      <section className="bloque">
        <h2>Google Calendar</h2>
        {aviso && (
          <p className={aviso.tipo === "ok" ? "aviso" : "error"} role={aviso.tipo === "ok" ? "status" : "alert"}>
            {aviso.texto}
          </p>
        )}
        {c ? (
          <p className="resumen">
            Conectado{c.email ? ` como ${c.email}` : ""} · {fechaCorta(c.conectado_at)}
          </p>
        ) : (
          <p className="ayuda">Todavía no está conectado. Sin esto no se pueden ofrecer horarios de llamada.</p>
        )}
        {!googleConfigurado() && <p className="error">Faltan las claves de Google en Vercel (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y ENCRYPTION_KEY).</p>}
        <form method="post" action="/panel/google/conectar">
          <button type="submit" className={c ? "secundario" : "principal"}>
            {c ? "Volver a conectar" : "Conectar Google"}
          </button>
        </form>
      </section>

      <section className="bloque">
        <h2>Propuesta automática por Instagram</h2>
        {q.propuestas === "ok" && (
          <p className="aviso" role="status">
            Guardado.
          </p>
        )}
        {!diag ? (
          <p className="resumen">ManyChat: sin configurar (falta la clave MANYCHAT_API_KEY en Vercel)</p>
        ) : (
          <ul className="lista-diag">
            {([
              ["Conexión", diag.conexion],
              ["Flujos de propuesta", diag.flujos],
              ["Campos personalizados", diag.campos],
            ] as const).map(([titulo, r]) => (
              <li key={titulo}>
                <span className={`chip ${r.ok ? "ok" : "mal"}`}>{r.ok ? "Bien" : "Falla"}</span> <strong>{titulo}:</strong> {r.detalle}
              </li>
            ))}
          </ul>
        )}
        <div className="subbloque">
          <h3>Prueba real del envío</h3>
          {q.prueba === "ok" && (
            <p className="aviso" role="status">
              Enviado. Mira tu Instagram: debe llegarte el mensaje con su botón.
            </p>
          )}
          {q.prueba === "error" && (
            <p className="error" role="alert">
              ManyChat respondió con un error: {(q.detalle ?? "").slice(0, 200)}
            </p>
          )}
          {q.prueba === "contacto" && (
            <p className="error" role="alert">
              El identificador del contacto son solo números.
            </p>
          )}
          <p className="ayuda">
            Manda un mensaje de prueba a tu propio Instagram para comprobar que ManyChat lo acepta. Primero tienes que haber escrito tú a tu cuenta
            (por ejemplo, comentando la palabra clave y tocando el botón) para que la ventana de 24 h esté abierta. El identificador lo ves en ManyChat,
            en el perfil de tu contacto (campo «ID de contacto»).
          </p>
          <form method="post" action="/panel/ajustes/prueba" className="formulario-seg">
            <label>
              ID de contacto de ManyChat (el tuyo)
              <input type="text" name="contacto" inputMode="numeric" pattern="[0-9]*" maxLength={20} required />
            </label>
            <label>
              Flujo
              <select name="tipo">
                <option value="llamada">Propuesta llamada</option>
                <option value="asesoria">Propuesta asesoría</option>
              </select>
            </label>
            <button type="submit" className="secundario">Enviarme una prueba</button>
          </form>
        </div>

        <p className="resumen">
          Modo:{" "}
          {modo.modo === "automatico"
            ? "automático (se envían solas, entre 1 y 3 horas después del formulario)"
            : `calibración (te llegan a Telegram para revisarlas; faltan ${modo.restantes} para pasar a automático)`}
        </p>
        <p className="resumen">
          Envío: {modo.pausa ? "PAUSADO (no sale ninguna propuesta)" : `activo · máximo ${modo.tope} al día · de ${HORA_PRIMERA}:00 a ${HORA_ULTIMA}:59 en la zona horaria de la persona`}
        </p>
        <form method="post" action="/panel/propuestas/modo">
          <input type="hidden" name="modo" value={modo.pausa ? "reanudar" : "pausar"} />
          <button type="submit" className="secundario">
            {modo.pausa ? "Reanudar el envío" : "Pausar el envío"}
          </button>
        </form>
        <form method="post" action="/panel/propuestas/modo">
          <input type="hidden" name="modo" value={modo.modo === "automatico" ? "calibracion" : "automatico"} />
          <button type="submit" className="secundario">
            {modo.modo === "automatico" ? "Volver a calibración (10 propuestas)" : "Pasar a automático ya"}
          </button>
        </form>
      </section>

      {c && (
        <section className="bloque">
          <h2>Horarios que se ofrecerían ahora</h2>
          <p className="ayuda">
            Llamada de venta ({REGLAS.duracionMin.venta} min), de mañana a {REGLAS.ventaHastaDias} días. Tiene en cuenta tu calendario, 1 hora de margen y de {REGLAS.horaInicio}:00 a {REGLAS.horaFin}:00.
          </p>
          {fallo && <p className="error">No se pudo leer el calendario. Prueba a volver a conectar Google.</p>}
          {prueba?.sinHueco && <p className="vacio">No hay ningún hueco en estos días.</p>}
          {prueba?.dias.map((d) => (
            <p key={d.fecha} className="resumen">
              <strong>{dia(d.fecha)}</strong>
              {d.preferido ? " · día preferido" : ""}
              <br />
              {d.huecos.map((h) => hora(h.inicio)).join(" · ")}
            </p>
          ))}
          {prueba?.unSoloPreferido && <p className="ayuda">Solo uno de los días propuestos es domingo o lunes.</p>}
        </section>
      )}
    </main>
  );
}
