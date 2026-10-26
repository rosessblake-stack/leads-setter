import Link from "next/link";
import { sql } from "@/lib/db";
import { exigirSesion } from "@/lib/panel";
import {
  FASES,
  NOMBRE_FASE,
  NOMBRE_RUTA,
  POR_PAGINA,
  RUTAS,
  fechaCorta,
  leerFiltros,
  patronBusqueda,
  type Fase,
} from "@/lib/panel-util";
import type { Ruta } from "@/formulario/tipos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

type Params = Record<string, string | string[] | undefined>;

type Fila = {
  ficha_id: string;
  nombre: string;
  ruta: Ruta | null;
  interes: string | null;
  encaje: string | null;
  puntuacion: number | null;
  oferta_recomendada: string | null;
  fase: Fase;
  video_codigo: string | null;
  creado_at: Date;
};

const OFERTA: Record<string, string> = { online: "Online", presencial: "Presencial", asesoria: "Asesoría" };

function enlace(f: ReturnType<typeof leerFiltros>, cambios: Partial<Record<"fase" | "ruta" | "pagina", string | null>>) {
  const p = new URLSearchParams();
  const fase = "fase" in cambios ? cambios.fase : f.fase;
  const ruta = "ruta" in cambios ? cambios.ruta : f.ruta;
  if (fase) p.set("fase", fase);
  if (ruta) p.set("ruta", ruta);
  if (f.q) p.set("q", f.q);
  const pagina = "pagina" in cambios ? cambios.pagina : null;
  if (pagina && pagina !== "1") p.set("pagina", pagina);
  const s = p.toString();
  return s ? `/panel?${s}` : "/panel";
}

export default async function Lista({ searchParams }: { searchParams: Promise<Params> }) {
  await exigirSesion();
  const f = leerFiltros(await searchParams);
  const patron = f.q ? patronBusqueda(f.q) : null;

  const [filas, [total], porFase] = await Promise.all([
    sql()`
      select fi.id as ficha_id, p.nombre, f.ruta, f.interes, fi.encaje, fi.puntuacion,
             fi.oferta_recomendada, fi.fase, v.codigo as video_codigo, f.creado_at
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      join setter.personas p on p.id = fi.persona_id
      left join setter.videos v on v.id = f.video_id
      where (${f.fase}::text is null or fi.fase = ${f.fase})
        and (${f.ruta}::text is null or f.ruta = ${f.ruta})
        and (${patron}::text is null or p.nombre ilike ${patron} or p.email ilike ${patron} or p.ig_username ilike ${patron})
      order by f.creado_at desc
      limit ${POR_PAGINA} offset ${(f.pagina - 1) * POR_PAGINA}`,
    sql()`
      select count(*)::int as n
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      join setter.personas p on p.id = fi.persona_id
      where (${f.fase}::text is null or fi.fase = ${f.fase})
        and (${f.ruta}::text is null or f.ruta = ${f.ruta})
        and (${patron}::text is null or p.nombre ilike ${patron} or p.email ilike ${patron} or p.ig_username ilike ${patron})`,
    sql()`select fase, count(*)::int as n from setter.fichas group by fase`,
  ]);

  const cuentas = new Map<string, number>(porFase.map((r) => [r.fase as string, r.n as number]));
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

      <nav className="filtros" aria-label="Filtrar por fase">
        <Link href={enlace(f, { fase: null })} className={`ficha-chip${f.fase ? "" : " activa"}`}>
          Todos
        </Link>
        {FASES.map((fase) => (
          <Link key={fase} href={enlace(f, { fase })} className={`ficha-chip${f.fase === fase ? " activa" : ""}`}>
            {NOMBRE_FASE[fase]} <span>{cuentas.get(fase) ?? 0}</span>
          </Link>
        ))}
      </nav>

      <form method="get" action="/panel" className="busqueda">
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
