import Link from "next/link";
import { intentar, sql } from "@/lib/db";
import { NOMBRE_ORIGEN, pista, type Origen } from "@/lib/errores-util";
import { exigirSesion } from "@/lib/panel";
import { fechaCorta } from "@/lib/panel-util";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = { title: "Errores" };

type Fila = { id: number; origen: string; mensaje: string; contexto: Record<string, unknown>; veces: number; ultimo_at: Date; revisado_at: Date | null };

export default async function Errores({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  await exigirSesion();
  const q = await searchParams;
  const todos = q.todos === "1";

  const filas = (await intentar(
    () => sql()`
      select id, origen, mensaje, contexto, veces, ultimo_at, revisado_at
      from setter.errores
      where ${todos} or revisado_at is null
      order by ultimo_at desc limit 100`,
  )) as unknown as Fila[];
  const pendientes = filas.filter((f) => !f.revisado_at).length;

  return (
    <main className="pantalla panel">
      <p>
        <Link href="/panel">← Volver a la lista</Link>
      </p>
      <header className="panel-cabecera">
        <h1>Errores</h1>
        <div className="panel-acciones">
          <Link href={todos ? "/panel/errores" : "/panel/errores?todos=1"} className="enlace-boton">
            {todos ? "Solo sin revisar" : "Ver también los revisados"}
          </Link>
        </div>
      </header>

      <p className="ayuda">
        Aquí se guarda cada fallo del sistema con su causa probable, para no tener que adivinarlo. No se guardan datos personales de los leads.
        Los errores nuevos también te llegan por Telegram (máximo 5 por hora).
      </p>

      {pendientes > 0 && (
        <form method="post" action="/panel/errores/revisar">
          <button type="submit" className="secundario">
            Marcar {pendientes === 1 ? "el error" : `los ${pendientes} errores`} como revisado{pendientes === 1 ? "" : "s"}
          </button>
        </form>
      )}

      {filas.length === 0 ? (
        <p className="vacio">No hay errores sin revisar. Todo en orden.</p>
      ) : (
        <ul className="errores">
          {filas.map((f) => {
            const explicacion = pista(f.origen, f.mensaje);
            return (
              <li key={f.id} className={f.revisado_at ? "revisado" : ""}>
                <span className="lead-linea">
                  <strong>{NOMBRE_ORIGEN[f.origen as Origen] ?? f.origen}</strong>
                  <span className="lead-fecha">
                    {fechaCorta(f.ultimo_at)}
                    {f.veces > 1 ? ` · ${f.veces} veces` : ""}
                  </span>
                </span>
                <span className="error-mensaje">{f.mensaje}</span>
                {explicacion && <span className="pista">Qué hacer: {explicacion}</span>}
                {Object.keys(f.contexto ?? {}).length > 0 && (
                  <span className="lead-fecha">{Object.entries(f.contexto).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
