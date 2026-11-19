import Link from "next/link";
import { intentar, sql } from "@/lib/db";
import { exigirSesion } from "@/lib/panel";
import {
  FASES,
  NOMBRE_FASE,
  NOMBRE_ORIGEN_LEAD,
  NOMBRE_RUTA,
  ORIGENES_LEAD,
  NOMBRE_VISTA,
  POR_PAGINA,
  RUTAS,
  VISTAS,
  fechaCorta,
  leerFiltros,
  patronBusqueda,
  type Fase,
  type Filtros,
} from "@/lib/panel-util";
import { NOMBRE_PROPUESTA, type Propuesta } from "@/lib/seguimiento-util";
import { etiquetaOrigen } from "@/formulario/campanas";
import type { Ruta } from "@/formulario/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = { title: "Leads" };

type Params = Record<string, string | string[] | undefined>;

type Fila = {
  ficha_id: string;
  nombre: string;
  ruta: Ruta | null;
  encaje: string | null;
  puntuacion: number | null;
  oferta_recomendada: string | null;
  fase: Fase;
  propuesta_estado: Propuesta;
  reserva_at: Date | null;
  video_codigo: string | null;
  video_formato: string | null;
  creado_at: Date;
  sin_contactar: boolean;
  origen: "sistema" | "historico";
  origen_lead: "video" | "chat" | "cliente_anterior";
  caso_exito: boolean;
};

const OFERTA: Record<string, string> = { online: "Online", presencial: "Presencial", asesoria: "Asesoría" };

type Cambios = Partial<Record<"fase" | "ruta" | "origen" | "video" | "vista" | "pagina", string | null>>;

function enlace(f: Filtros, cambios: Cambios) {
  const p = new URLSearchParams();
  const v = (k: "fase" | "ruta" | "origen" | "video" | "vista") => (k in cambios ? cambios[k] : f[k]);
  for (const k of ["vista", "fase", "ruta", "origen", "video"] as const) {
    const val = v(k);
    if (val) p.set(k, val);
  }
  if (f.q) p.set("q", f.q);
  if (cambios.pagina && cambios.pagina !== "1") p.set("pagina", cambios.pagina);
  const s = p.toString();
  return s ? `/panel?${s}` : "/panel";
}

export default async function Lista({ searchParams }: { searchParams: Promise<Params> }) {
  await exigirSesion();
  const sp = await searchParams;
  const f = leerFiltros(sp);
  const patron = f.q ? patronBusqueda(f.q) : null;

  // Sin contactar: fase «Nuevo», propuesta sin enviar y más de 24 h desde el formulario (se cierra la ventana de Instagram).
  // Quien viene de una campaña con seguimiento propio no recibe «propuesta»: su recorrido es la guía y el seguimiento. Cuenta como contactada
  // en cuanto se le lanza el seguimiento, y no se le espera en «por enviar».
  const SEGUIDA = sql()`exists (select 1 from setter.eventos z where z.persona_id = fi.persona_id and z.tipo = 'seguimiento_guia_lanzado')`;
  const SIN_PROPUESTA_POR_CAMPANA = sql()`exists (select 1 from setter.eventos z where z.persona_id = fi.persona_id and z.tipo = 'propuesta_omitida' and z.datos ->> 'motivo' = 'campaña con su propio seguimiento')`;
  const SIN_CONTACTAR = sql()`(fi.fase = 'nuevo' and fi.propuesta_estado in ('pendiente', 'no_enviada', 'incierto') and f.creado_at < now() - interval '24 hours' and not ${SEGUIDA})`;
  // Cada vista es una pregunta concreta: ¿a quién falta escribir?, ¿quién no ha reservado?...
  const vistaSql = sql()`(
    ${f.vista}::text is null
    or (${f.vista}::text = 'casos_exito' and fi.caso_exito)
    or (fi.origen = 'sistema' and (
         (${f.vista}::text = 'sin_contactar' and ${SIN_CONTACTAR})
      or (${f.vista}::text = 'por_enviar' and fi.propuesta_estado in ('pendiente', 'no_enviada', 'incierto') and fi.fase not in ('vendido', 'no_vendido', 'descartado') and not ${SIN_PROPUESTA_POR_CAMPANA})
      or (${f.vista}::text = 'sin_agendar' and fi.reserva_at is null and f.ruta is distinct from 'asesoria'
          and fi.propuesta_estado in ('enviada', 'manual') and fi.fase not in ('vendido', 'no_vendido', 'descartado'))
      or (${f.vista}::text = 'agendadas' and fi.reserva_at is not null and fi.fase not in ('vendido', 'no_vendido', 'descartado'))
      or (${f.vista}::text = 'vendidos' and fi.fase = 'vendido')
      or (${f.vista}::text = 'no_vendidos' and fi.fase = 'no_vendido')
    ))
  )`;
  // De dónde viene: cliente anterior, vídeo (por código del enlace o por su comentario) o chat directo.
  const ORIGEN_LEAD = sql()`(case when fi.origen = 'historico' then 'cliente_anterior' when f.video_id is not null then 'video' else 'chat' end)`;
  const baseSql = sql()`
    ${vistaSql}
    and (${f.fase}::text is null or fi.fase = ${f.fase})
    and (${patron}::text is null or p.nombre ilike ${patron} or p.email ilike ${patron} or p.ig_username ilike ${patron})`;
  const videoSql = sql()`(${f.video}::text is null or v.codigo = ${f.video})`;
  const filtrosSql = sql()`
    ${baseSql}
    and (${f.ruta}::text is null or f.ruta = ${f.ruta})
    and (${f.origen}::text is null or ${ORIGEN_LEAD} = ${f.origen})
    and ${videoSql}`;

  // Una consulta detrás de otra (no a la vez) y con límite de tiempo por si la conexión se cuelga.
  const { filas, porVista, porRuta, porOrigen, videos } = await intentar(async () => {
    const filas = await sql()`
      select fi.id as ficha_id, p.nombre, f.ruta, fi.encaje, fi.puntuacion, fi.oferta_recomendada, fi.fase,
             fi.propuesta_estado, fi.reserva_at, v.codigo as video_codigo, v.formato as video_formato, f.creado_at,
             ${SIN_CONTACTAR} as sin_contactar, fi.origen, fi.caso_exito, ${ORIGEN_LEAD} as origen_lead,
             count(*) over()::int as total
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      join setter.personas p on p.id = fi.persona_id
      left join setter.videos v on v.id = f.video_id
      where ${filtrosSql}
      order by (case when ${f.vista}::text = 'agendadas' then fi.reserva_at end) asc nulls last, f.creado_at desc
      limit ${POR_PAGINA} offset ${(f.pagina - 1) * POR_PAGINA}`;
    // Contadores de fase para los filtros (los de la barra lateral los pide la propia barra).
    const [porVista] = await sql()`
      select (select coalesce(jsonb_object_agg(t.fase, t.n), '{}'::jsonb) from (select fase, count(*)::int as n from setter.fichas group by fase) t) as por_fase`;
    // Cuántos hay en cada ruta y de cada origen con lo demás ya filtrado (vista, fase y búsqueda), para que los números cuadren.
    const rutas = await sql()`
      select f.ruta, count(*)::int as n from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id join setter.personas p on p.id = fi.persona_id
      left join setter.videos v on v.id = f.video_id
      where ${baseSql} and (${f.origen}::text is null or ${ORIGEN_LEAD} = ${f.origen}) and ${videoSql} group by f.ruta`;
    const origenes = await sql()`
      select ${ORIGEN_LEAD} as origen, count(*)::int as n from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id join setter.personas p on p.id = fi.persona_id
      left join setter.videos v on v.id = f.video_id
      where ${baseSql} and (${f.ruta}::text is null or f.ruta = ${f.ruta}) and ${videoSql} group by 1`;
    // Vídeos con leads, para elegir uno y ver solo los que vinieron de él.
    const videos = await sql()`
      select v.codigo, coalesce(nullif(left(v.descripcion, 45), ''), v.codigo) as etiqueta, count(*)::int as n
      from setter.formularios f join setter.videos v on v.id = f.video_id
      group by v.codigo, v.descripcion, v.creado_at order by max(f.creado_at) desc limit 60`;
    const porRuta: Record<string, number> = {};
    for (const r of rutas) porRuta[String(r.ruta)] = r.n as number;
    const porOrigen: Record<string, number> = {};
    for (const o of origenes) porOrigen[String(o.origen)] = o.n as number;
    return { filas, porVista, porRuta, porOrigen, videos };
  });

  const cuentasFase = (porVista?.por_fase ?? {}) as Record<string, number>;
  const lista = filas as unknown as Fila[];
  const total = (filas[0]?.total as number | undefined) ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <main className="pantalla panel">
      <header className="panel-cabecera">
        <h1>{f.vista ? NOMBRE_VISTA[f.vista] : "Todos los leads"}</h1>
      </header>

      {(sp.borrado === "1" || sp.borrado === "2") && (
        <p className="aviso" role="status">
          Persona borrada de la base de datos{sp.borrado === "1" ? " y del calendario" : " (no se pudo quitar su evento del calendario: bórralo a mano)"}. Falta borrar a mano su contacto en ManyChat y los mensajes de Telegram.
        </p>
      )}

      <nav className="filtros" aria-label="Filtrar por ruta">
        <span className="ayuda">Ruta</span>
        <Link href={enlace(f, { ruta: null })} className={`ficha-chip${f.ruta ? "" : " activa"}`}>
          Todas
        </Link>
        {RUTAS.map((r) => (
          <Link key={r} href={enlace(f, { ruta: r })} className={`ficha-chip${f.ruta === r ? " activa" : ""}`}>
            {NOMBRE_RUTA[r]} <span>{porRuta[r] ?? 0}</span>
          </Link>
        ))}
      </nav>
      <nav className="filtros" aria-label="Filtrar por origen">
        <span className="ayuda">Origen</span>
        <Link href={enlace(f, { origen: null })} className={`ficha-chip${f.origen ? "" : " activa"}`}>
          Todos
        </Link>
        {ORIGENES_LEAD.map((o) => (
          <Link key={o} href={enlace(f, { origen: o })} className={`ficha-chip${f.origen === o ? " activa" : ""}`}>
            {NOMBRE_ORIGEN_LEAD[o]} <span>{porOrigen[o] ?? 0}</span>
          </Link>
        ))}
      </nav>

      {videos.length > 0 && (
        <form method="get" action="/panel" className="busqueda" aria-label="Filtrar por vídeo o historia">
          {f.vista && <input type="hidden" name="vista" value={f.vista} />}
          {f.fase && <input type="hidden" name="fase" value={f.fase} />}
          {f.ruta && <input type="hidden" name="ruta" value={f.ruta} />}
          {f.origen && <input type="hidden" name="origen" value={f.origen} />}
          {f.q && <input type="hidden" name="q" value={f.q} />}
          <label>
            <span className="solo-lectores">Vídeo o historia</span>
            <select name="video" defaultValue={f.video ?? ""}>
              <option value="">Todos los vídeos e historias</option>
              {videos.map((v) => (
                <option key={String(v.codigo)} value={String(v.codigo)}>
                  {String(v.etiqueta)} ({v.n as number})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="secundario">Filtrar</button>
        </form>
      )}

      <details className="desplegable filtros-lista" open={Boolean(f.fase || f.q)}>
        <summary>
          <h2>Filtrar por fase y buscar</h2>
          {(f.fase || f.q) && <span className="chip">Filtros activos</span>}
        </summary>
        <div className="desplegable-cuerpo">
          <nav className="filtros secundarios" aria-label="Filtrar por fase">
            <Link href={enlace(f, { fase: null })} className={`ficha-chip${f.fase ? "" : " activa"}`}>
              Cualquier fase
            </Link>
            {FASES.map((fase) => (
              <Link key={fase} href={enlace(f, { fase })} className={`ficha-chip${f.fase === fase ? " activa" : ""}`}>
                {NOMBRE_FASE[fase]} <span>{cuentasFase[fase] ?? 0}</span>
              </Link>
            ))}
          </nav>

          <form method="get" action="/panel" className="busqueda">
            {f.vista && <input type="hidden" name="vista" value={f.vista} />}
            {f.fase && <input type="hidden" name="fase" value={f.fase} />}
            {f.ruta && <input type="hidden" name="ruta" value={f.ruta} />}
            {f.origen && <input type="hidden" name="origen" value={f.origen} />}
            {f.video && <input type="hidden" name="video" value={f.video} />}
            <label>
              <span className="solo-lectores">Buscar</span>
              <input type="search" name="q" defaultValue={f.q ?? ""} placeholder="Nombre, email o Instagram" maxLength={60} />
            </label>
            <button type="submit" className="secundario">
              Buscar
            </button>
          </form>
        </div>
      </details>

      <p className="ayuda">
        {total} {total === 1 ? "lead" : "leads"}
      </p>

      {lista.length === 0 ? (
        <p className="vacio">No hay leads con estos filtros.</p>
      ) : (
        <ul className="leads">
          {lista.map((l) => (
            <li key={l.ficha_id}>
              <Link href={`/panel/lead/${l.ficha_id}`} className="lead">
                <span className="lead-linea">
                  <strong>{l.nombre}</strong>
                  <span className="lead-fecha">{fechaCorta(l.creado_at)}</span>
                </span>
                <span className="chips">
                  {l.sin_contactar && l.origen === "sistema" && <span className="chip urgente">Sin contactar +24 h</span>}
                  {l.caso_exito && <span className="chip ok">Caso de éxito</span>}
                  <span className="chip">{NOMBRE_ORIGEN_LEAD[l.origen_lead]}</span>
                  <span className={`fase fase-${l.fase}`}>{NOMBRE_FASE[l.fase]}</span>
                  <span className="chip">{l.ruta ? NOMBRE_RUTA[l.ruta] : "Formulario antiguo"}</span>
                  {l.reserva_at && <span className="chip reserva">Llamada {fechaCorta(l.reserva_at)}</span>}
                </span>
                <span className="lead-meta">
                  {[
                    l.propuesta_estado !== "pendiente" ? `Propuesta: ${NOMBRE_PROPUESTA[l.propuesta_estado].toLowerCase()}` : null,
                    l.encaje ? `Encaje ${l.encaje}` : null,
                    l.puntuacion !== null ? `${l.puntuacion}%` : null,
                    l.oferta_recomendada ? `Recomendado: ${OFERTA[l.oferta_recomendada]}` : null,
                    l.video_codigo ? `${etiquetaOrigen(l.video_codigo, l.video_formato)} ${l.video_codigo}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && (
        <nav className="paginas" aria-label="Páginas">
          {f.pagina > 1 && <Link href={enlace(f, { pagina: String(f.pagina - 1) })}>← Anterior</Link>}
          <span>
            Página {f.pagina} de {paginas}
          </span>
          {f.pagina < paginas && <Link href={enlace(f, { pagina: String(f.pagina + 1) })}>Siguiente →</Link>}
        </nav>
      )}
    </main>
  );
}
