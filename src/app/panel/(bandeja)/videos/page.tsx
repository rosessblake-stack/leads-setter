import Link from "next/link";
import { intentar, sql } from "@/lib/db";
import { exigirSesion } from "@/lib/panel";
import { CATEGORIAS_VIDEO, NOMBRE_CATEGORIA_VIDEO, NOMBRE_TIPO_VIDEO, TIPOS_VIDEO, fechaCorta, urlSegura } from "@/lib/panel-util";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = { title: "Vídeos" };

type Fila = {
  id: string;
  codigo: string;
  enlace: string | null;
  publicado_at: Date | null;
  creado_at: Date;
  descripcion: string | null;
  tipo: string | null;
  categoria: string | null;
  palabra_clave: string | null;
  notas: string | null;
  comentarios: number;
  leads: number;
};

export default async function Videos({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  await exigirSesion();
  const q = await searchParams;
  const filas = (await intentar(
    () => sql()`
      select v.id, v.codigo, v.enlace, v.publicado_at, v.creado_at, v.descripcion, v.tipo, v.categoria, v.palabra_clave, v.notas,
             (select count(*)::int from setter.comentarios_ig c where c.ig_media_id = v.ig_media_id) as comentarios,
             (select count(*)::int from setter.formularios f where f.video_id = v.id) as leads
      from setter.videos v
      order by (v.descripcion is null) desc, coalesce(v.publicado_at, v.creado_at) desc limit 100`,
  )) as unknown as Fila[];
  const sinDescribir = filas.filter((f) => !f.descripcion).length;

  return (
    <main className="pantalla panel">
      <p>
        <Link href="/panel">← Volver a la lista</Link>
      </p>
      <h1>Vídeos</h1>
      <p className="ayuda">
        Cada reel que alguien comenta aparece aquí solo, con su fecha. Dime de qué trata cada uno: Claude lo usará para cruzarlo con lo
        que la persona escribe en el formulario. {sinDescribir > 0 ? `${sinDescribir} sin describir (arriba).` : "Todos descritos."}
      </p>
      {q.guardado && <p role="status">Guardado.</p>}
      {filas.length === 0 && <p className="vacio">Todavía no hay vídeos. Aparecerán cuando alguien comente un reel con Instagram conectado.</p>}
      {filas.map((v) => {
        const enlace = urlSegura(v.enlace);
        return (
          <details className="desplegable" key={v.id} open={!v.descripcion}>
            <summary>
              <h2>{v.descripcion ? v.descripcion.slice(0, 70) : `Sin describir · ${v.codigo}`}</h2>
              <span className="lead-fecha">
                {fechaCorta(v.publicado_at ?? v.creado_at)} · {v.comentarios} {v.comentarios === 1 ? "comentario" : "comentarios"} · {v.leads} {v.leads === 1 ? "lead" : "leads"}
              </span>
            </summary>
            <div className="desplegable-cuerpo">
              {enlace && (
                <p>
                  <a href={enlace} target="_blank" rel="noopener noreferrer">Ver el reel en Instagram</a>
                </p>
              )}
              {v.notas && <p className="ayuda">{v.notas}</p>}
              <form method="post" action="/panel/videos/guardar" className="formulario-seg">
                <input type="hidden" name="id" value={v.id} />
                <label>
                  De qué trata
                  <textarea name="descripcion" rows={3} maxLength={500} defaultValue={v.descripcion ?? ""} />
                </label>
                <label>
                  Tipo
                  <select name="tipo" defaultValue={v.tipo ?? ""}>
                    <option value="">Sin elegir</option>
                    {TIPOS_VIDEO.map((t) => (
                      <option key={t} value={t}>{NOMBRE_TIPO_VIDEO[t]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Categoría
                  <select name="categoria" defaultValue={v.categoria ?? ""}>
                    <option value="">Sin elegir</option>
                    {CATEGORIAS_VIDEO.map((c) => (
                      <option key={c} value={c}>{NOMBRE_CATEGORIA_VIDEO[c]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Palabra clave que se comenta
                  <input type="text" name="palabra_clave" maxLength={40} defaultValue={v.palabra_clave ?? ""} />
                </label>
                <button type="submit">Guardar</button>
              </form>
            </div>
          </details>
        );
      })}
    </main>
  );
}
