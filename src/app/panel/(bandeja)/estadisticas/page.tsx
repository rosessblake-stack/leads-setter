import Link from "next/link";
import { intentar, sql } from "@/lib/db";
import { exigirSesion } from "@/lib/panel";
import { NOMBRE_RUTA } from "@/lib/panel-util";
import type { Ruta } from "@/formulario/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = { title: "Estadísticas" };

type Fila = { clave: string | null; leads: number; contactados: number; con_llamada: number; vendidos: number; no_vendidos: number; ingresos_cents: number };

const pct = (a: number, b: number) => (b === 0 ? "—" : `${Math.round((a / b) * 100)}%`);
const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function Estadisticas() {
  await exigirSesion();

  const { porRuta, porVideo } = await intentar(async () => {
    // Misma medida en las dos tablas: cuántos llegan a cada paso.
    const porRuta = await sql()`
      select f.ruta as clave,
             count(*)::int as leads,
             count(*) filter (where fi.propuesta_estado in ('enviada', 'manual'))::int as contactados,
             count(*) filter (where fi.reserva_at is not null)::int as con_llamada,
             count(*) filter (where fi.fase = 'vendido')::int as vendidos,
             count(*) filter (where fi.fase = 'no_vendido')::int as no_vendidos,
             coalesce(sum(r.importe_cents) filter (where r.resultado = 'vendido'), 0)::int as ingresos_cents
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      left join setter.resultados r on r.ficha_id = fi.id
      group by f.ruta order by leads desc`;
    const porVideo = await sql()`
      select v.codigo as clave,
             count(*)::int as leads,
             count(*) filter (where fi.propuesta_estado in ('enviada', 'manual'))::int as contactados,
             count(*) filter (where fi.reserva_at is not null)::int as con_llamada,
             count(*) filter (where fi.fase = 'vendido')::int as vendidos,
             count(*) filter (where fi.fase = 'no_vendido')::int as no_vendidos,
             coalesce(sum(r.importe_cents) filter (where r.resultado = 'vendido'), 0)::int as ingresos_cents
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      left join setter.videos v on v.id = f.video_id
      left join setter.resultados r on r.ficha_id = fi.id
      group by v.codigo order by vendidos desc, leads desc limit 50`;
    return { porRuta: porRuta as unknown as Fila[], porVideo: porVideo as unknown as Fila[] };
  });

  const suma = (k: keyof Omit<Fila, "clave">) => porRuta.reduce((t, r) => t + r[k], 0);
  const total = { leads: suma("leads"), contactados: suma("contactados"), con_llamada: suma("con_llamada"), vendidos: suma("vendidos"), no_vendidos: suma("no_vendidos"), ingresos: suma("ingresos_cents") };

  const tabla = (titulo: string, filas: Fila[], nombre: (c: string | null) => string) => (
    <section className="bloque">
      <h2>{titulo}</h2>
      {filas.length === 0 ? (
        <p className="vacio">Todavía no hay datos.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="estadisticas">
            <thead>
              <tr>
                <th></th>
                <th>Leads</th>
                <th>Contactados</th>
                <th>Con llamada</th>
                <th>Vendidos</th>
                <th>Cierre</th>
                <th>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave ?? "ninguno"}>
                  <th scope="row">{nombre(f.clave)}</th>
                  <td>{f.leads}</td>
                  <td>{f.contactados}</td>
                  <td>{f.con_llamada}</td>
                  <td>{f.vendidos}</td>
                  <td>{pct(f.vendidos, f.vendidos + f.no_vendidos)}</td>
                  <td>{euros(f.ingresos_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <main className="pantalla panel">
      <p>
        <Link href="/panel">← Volver a la lista</Link>
      </p>
      <header className="panel-cabecera">
        <h1>Estadísticas</h1>
      </header>

      <section className="bloque">
        <h2>Embudo</h2>
        <ol className="embudo">
          <li><strong>{total.leads}</strong> leads</li>
          <li><strong>{total.contactados}</strong> contactados <span>{pct(total.contactados, total.leads)}</span></li>
          <li><strong>{total.con_llamada}</strong> con llamada <span>{pct(total.con_llamada, total.contactados)}</span></li>
          <li><strong>{total.vendidos}</strong> vendidos <span>{pct(total.vendidos, total.con_llamada)}</span></li>
        </ol>
        <p className="ayuda">
          Ingresos registrados: <strong>{euros(total.ingresos)}</strong>. Cierre: vendidos entre los que ya tienen resultado
          (vendido o no vendido). Los porcentajes del embudo son sobre el paso anterior.
        </p>
      </section>

      {tabla("Por ruta", porRuta, (c) => (c ? NOMBRE_RUTA[c as Ruta] : "Formulario antiguo"))}
      {tabla("Por vídeo", porVideo, (c) => (c ? `Vídeo ${c}` : "Sin vídeo"))}
    </main>
  );
}
