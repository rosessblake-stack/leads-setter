import Link from "next/link";
import { intentar } from "@/lib/db";
import { conexion, googleConfigurado, ocupadosEntre } from "@/lib/google";
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

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await exigirSesion();
  const q = await searchParams;
  const aviso = q.google ? MENSAJE[q.google] : undefined;

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
        {!googleConfigurado() && <p className="error">Faltan las claves de Google en Vercel.</p>}
        <form method="post" action="/panel/google/conectar">
          <button type="submit" className={c ? "secundario" : "principal"}>
            {c ? "Volver a conectar" : "Conectar Google"}
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
