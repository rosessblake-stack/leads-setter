import Link from "next/link";
import { intentar, sql } from "@/lib/db";
import { exigirSesion } from "@/lib/panel";
import {
  FASES,
  NOMBRE_FASE,
  NOMBRE_RUTA,
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
  creado_at: Date;
};

const OFERTA: Record<string, string> = { online: "Online", presencial: "Presencial", asesoria: "Asesoría" };

type Cambios = Partial<Record<"fase" | "ruta" | "vista" | "pagina", string | null>>;

function enlace(f: Filtros, cambios: Cambios) {
  const p = new URLSearchParams();
  const v = (k: "fase" | "ruta" | "vista") => (k in cambios ? cambios[k] : f[k]);
  for (const k of ["vista", "fase", "ruta"] as const) {
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
  const f = leerFiltros(await searchParams);
  const patron = f.q ? patronBusqueda(f.q) : null;

  // Cada vista es una pregunta concreta: ¿a quién falta escribir?, ¿quién no ha reservado?...
  const vistaSql = sql()`(
    ${f.vista}::text is null
    or (${f.vista}::text = 'por_enviar' and fi.propuesta_estado in ('pendiente', 'no_enviada') and fi.fase not in ('vendido', 'no_vendido', 'descartado'))
    or (${f.vista}::text = 'sin_agendar' and fi.reserva_at is null and f.ruta is distinct from 'asesoria'
        and fi.propuesta_estado in ('enviada', 'manual') and fi.fase not in ('vendido', 'no_vendido', 'descartado'))
    or (${f.vista}::text = 'agendadas' and fi.reserva_at is not null and fi.fase not in ('vendido', 'no_vendido', 'descartado'))
    or (${f.vista}::text = 'vendidos' and fi.fase = 'vendido')
    or (${f.vista}::text = 'no_vendidos' and fi.fase = 'no_vendido')
  )`;
  const filtrosSql = sql()`
    ${vistaSql}
    and (${f.fase}::text is null or fi.fase = ${f.fase})
    and (${f.ruta}::text is null or f.ruta = ${f.ruta})
    and (${patron}::text is null or p.nombre ilike ${patron} or p.email ilike ${patron} or p.ig_username ilike ${patron})`;

  // Una consulta detrás de otra (no a la vez) y con límite de tiempo por si la conexión se cuelga.
  const { filas, total, porVista, porFase } = await intentar(async () => {
    const filas = await sql()`
      select fi.id as ficha_id, p.nombre, f.ruta, fi.encaje, fi.puntuacion, fi.oferta_recomendada, fi.fase,
             fi.propuesta_estado, fi.reserva_at, v.codigo as video_codigo, f.creado_at
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      join setter.personas p on p.id = fi.persona_id
      left join setter.videos v on v.id = f.video_id
      where ${filtrosSql}
      order by (case when ${f.vista}::text = 'agendadas' then fi.reserva_at end) asc nulls last, f.creado_at desc
      limit ${POR_PAGINA} offset ${(f.pagina - 1) * POR_PAGINA}`;
    const [total] = await sql()`
      select count(*)::int as n
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      join setter.personas p on p.id = fi.persona_id
      where ${filtrosSql}`;
    const [porVista] = await sql()`
      select
        count(*) filter (where fi.propuesta_estado in ('pendiente', 'no_enviada') and fi.fase not in ('vendido', 'no_vendido', 'descartado'))::int as por_enviar,
        count(*) filter (where fi.reserva_at is null and f.ruta is distinct from 'asesoria' and fi.propuesta_estado in ('enviada', 'manual')
                           and fi.fase not in ('vendido', 'no_vendido', 'descartado'))::int as sin_agendar,
        count(*) filter (where fi.reserva_at is not null and fi.fase not in ('vendido', 'no_vendido', 'descartado'))::int as agendadas,
        count(*) filter (where fi.fase = 'vendido')::int as vendidos,
        count(*) filter (where fi.fase = 'no_vendido')::int as no_vendidos
      from setter.fichas fi join setter.formularios f on f.id = fi.formulario_id`;
    const porFase = await sql()`select fase, count(*)::int as n from setter.fichas group by fase`;
    return { filas, total, porVista, porFase };
  });

  const cuentasFase = new Map<string, number>(porFase.map((r) => [r.fase as string, r.n as number]));
  const paginas = Math.max(1, Math.ceil((total?.n ?? 0) / POR_PAGINA));
  const lista = filas as unknown as Fila[];

  return (
    <main className="pantalla panel">
      <header className="panel-cabecera">
        <h1>Leads</h1>
        <form method="post" action="/panel/salir">
          <button type="submit" className="secundario">
            Salir
          </button>
        </form>
      </header>

      <nav className="filtros" aria-label="Bandeja">
        <Link href={enlace(f, { vista: null })} className={`ficha-chip${f.vista ? "" : " activa"}`}>
          Todos
        </Link>
        {VISTAS.map((v) => (
          <Link key={v} href={enlace(f, { vista: v })} className={`ficha-chip${f.vista === v ? " activa" : ""}`}>
            {NOMBRE_VISTA[v]} <span>{(porVista?.[v] as number | undefined) ?? 0}</span>
          </Link>
        ))}
      </nav>

      <nav className="filtros secundarios" aria-label="Filtrar por fase">
        <Link href={enlace(f, { fase: null })} className={`ficha-chip${f.fase ? "" : " activa"}`}>
          Cualquier fase
        </Link>
        {FASES.map((fase) => (
          <Link key={fase} href={enlace(f, { fase })} className={`ficha-chip${f.fase === fase ? " activa" : ""}`}>
            {NOMBRE_FASE[fase]} <span>{cuentasFase.get(fase) ?? 0}</span>
          </Link>
        ))}
      </nav>

      <form method="get" action="/panel" className="busqueda">
        {f.vista && <input type="hidden" name="vista" value={f.vista} />}
        {f.fase && <input type="hidden" name="fase" value={f.fase} />}
        <label>
          <span className="solo-lectores">Ruta</span>
          <select name="ruta" defaultValue={f.ruta ?? ""}>
            <option value="">Todas las rutas</option>
            {RUTAS.map((r) => (
              <option key={r} value={r}>
                {NOMBRE_RUTA[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="solo-lectores">Buscar</span>
          <input type="search" name="q" defaultValue={f.q ?? ""} placeholder="Nombre, email o Instagram" maxLength={60} />
        </label>
        <button type="submit" className="secundario">
          Buscar
        </button>
      </form>

      <p className="ayuda">
        {total?.n ?? 0} {(total?.n ?? 0) === 1 ? "lead" : "leads"}
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
                  <span className={`fase fase-${l.fase}`}>{NOMBRE_FASE[l.fase]}</span>
                  <span className="chip">{l.ruta ? NOMBRE_RUTA[l.ruta] : "Formulario antiguo"}</span>
                  <span className={`chip propuesta-${l.propuesta_estado}`}>Propuesta: {NOMBRE_PROPUESTA[l.propuesta_estado]}</span>
                  {l.reserva_at && <span className="chip reserva">Llamada {fechaCorta(l.reserva_at)}</span>}
                  {l.encaje && <span className={`chip encaje-${l.encaje}`}>Encaje {l.encaje}</span>}
                  {l.puntuacion !== null && <span className="chip">{l.puntuacion}/100</span>}
                  {l.oferta_recomendada && <span className="chip">Recomendado: {OFERTA[l.oferta_recomendada]}</span>}
                  {l.video_codigo && <span className="chip">Vídeo {l.video_codigo}</span>}
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
