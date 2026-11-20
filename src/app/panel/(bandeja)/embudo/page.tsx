import Link from "next/link";
import { definicion } from "@/formulario/datos";
import { campanaDe } from "@/formulario/campanas";
import { intentar, sql } from "@/lib/db";
import { textoTiempo } from "@/lib/lectura";
import { exigirSesion } from "@/lib/panel";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = { title: "Embudo del formulario" };

type Fila = { campana: string; paso: string; indice: number; n: number };

const ESPECIALES: Record<string, string> = {
  bienvenida: "Abren el formulario",
  consentimiento: "Llegan al último paso (aceptar)",
  enviado: "Envían el formulario",
  pdf_inicio: "Pulsan «Descargar»",
  pdf_ok: "Descarga completada",
};

function etiqueta(paso: string): string {
  if (ESPECIALES[paso]) return ESPECIALES[paso];
  const q = definicion.preguntas.find((x) => x.id === paso);
  return q ? `${paso} · ${q.texto.length > 60 ? q.texto.slice(0, 57) + "…" : q.texto}` : paso;
}

export default async function Embudo() {
  await exigirSesion();
  let filas: Fila[] = [];
  let sinTabla = false;
  try {
    filas = (await intentar(
      () => sql()`
        select coalesce(campana, 'general') as campana, paso, max(indice)::int as indice, count(*)::int as n
        from setter.embudo_formulario where en > now() - interval '60 days' and paso not like 'leer%'
        group by 1, 2 order by 1, 3`,
    )) as unknown as Fila[];
  } catch (e) {
    if ((e as { code?: string })?.code === "42P01") sinTabla = true;
    else throw e;
  }

  // Lectura de la guía en el visor: por diapositiva, cuántas personas la vieron y cuánto tiempo de media.
  let lectura: { campana: string; paso: string; n: number; media: number }[] = [];
  try {
    lectura = (await intentar(
      () => sql()`
        select coalesce(campana, 'general') as campana, paso, count(*)::int as n, round(avg(indice))::int as media
        from setter.embudo_formulario where en > now() - interval '60 days' and paso like 'leer%' group by 1, 2 order by 1, 2`,
    )) as unknown as typeof lectura;
  } catch {
    lectura = [];
  }

  const porCampana = new Map<string, Fila[]>();
  for (const f of filas) porCampana.set(f.campana, [...(porCampana.get(f.campana) ?? []), f]);

  return (
    <main className="pantalla panel">
      <p>
        <Link href="/panel">← Volver a la lista</Link>
      </p>
      <h1>Embudo del formulario</h1>
      <p className="ayuda">
        Cuántas personas llegan a cada pregunta, cuántas envían el formulario y, si hay regalo, cuántas lo descargan. Cuenta visitas, no
        personas: no se guarda ningún dato personal. Últimos 60 días.
      </p>
      {sinTabla && (
        <p className="error">
          Falta crear la tabla donde se guarda esto (migración 014, «embudo_formulario»). Hasta entonces no se cuenta nada.
        </p>
      )}
      {!sinTabla && porCampana.size === 0 && <p className="vacio">Todavía no hay visitas contadas.</p>}
      {[...porCampana.entries()].map(([campana, pasos]) => {
        const inicio = pasos.find((p) => p.paso === "bienvenida")?.n ?? pasos[0]?.n ?? 0;
        const nombre = campana === "general" ? "Formulario general (sin campaña)" : `Campaña ${campana}`;
        const info = campana === "general" ? null : campanaDe(campana)?.descripcion;
        return (
          <details className="desplegable" key={campana} open>
            <summary>
              <h2>{nombre}</h2>
              <span className="lead-fecha">{inicio} {inicio === 1 ? "visita" : "visitas"}</span>
            </summary>
            <div className="desplegable-cuerpo">
              {info && <p className="ayuda">{info}</p>}
              <ol className="embudo-form">
                {pasos.map((p, i) => {
                  const anterior = i > 0 ? pasos[i - 1].n : p.n;
                  const pierden = Math.max(0, anterior - p.n);
                  const pct = inicio > 0 ? Math.round((p.n / inicio) * 100) : 0;
                  return (
                    <li key={p.paso}>
                      <span className="embudo-form-texto">{etiqueta(p.paso)}</span>
                      <span className="embudo-form-cifras">
                        <strong>{p.n}</strong> · {pct} % del inicio{i > 0 && pierden > 0 ? ` · se pierden ${pierden}` : ""}
                      </span>
                      <span className="embudo-form-barra" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, pct)}%` }} />
                      </span>
                    </li>
                  );
                })}
              </ol>
              {(() => {
                const mias = lectura.filter((l) => l.campana === campana);
                const ini = mias.find((l) => l.paso === "leer_ini")?.n ?? 0;
                if (ini === 0) return null;
                const diap = mias.filter((l) => /^leer_\d\d$/.test(l.paso));
                const fin = mias.find((l) => l.paso === "leer_fin")?.n ?? 0;
                const clic = mias.find((l) => l.paso === "leer_clic")?.n ?? 0;
                return (
                  <div className="subbloque">
                    <h3>Lectura de la guía en el visor</h3>
                    <p className="ayuda">
                      {ini} abren el visor · {fin} llegan al final · {clic} pulsan «Cuéntame qué te ha parecido». Por diapositiva: cuántos la ven (al menos 1 s) y
                      cuánto tiempo de media.
                    </p>
                    <ol className="embudo-form">
                      {diap.map((d) => {
                        const pct = ini > 0 ? Math.round((d.n / ini) * 100) : 0;
                        return (
                          <li key={d.paso}>
                            <span className="embudo-form-texto">Diapositiva {Number(d.paso.slice(5))}</span>
                            <span className="embudo-form-cifras">
                              <strong>{d.n}</strong> · {pct} % de quienes abren · {textoTiempo(d.media)} de media
                            </span>
                            <span className="embudo-form-barra" aria-hidden="true">
                              <span style={{ width: `${Math.min(100, pct)}%` }} />
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })()}
            </div>
          </details>
        );
      })}
    </main>
  );
}
