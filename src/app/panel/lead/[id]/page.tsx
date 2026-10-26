import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { exigirSesion } from "@/lib/panel";
import {
  ETIQUETA_EVENTO,
  ETIQUETA_SIGNAL,
  NOMBRE_FASE,
  NOMBRE_RUTA,
  agruparRespuestas,
  enlaceChatInstagram,
  enlaceInstagram,
  enlaceWhatsApp,
  fechaCorta,
  urlSegura,
  type Fase,
} from "@/lib/panel-util";
import { definicion } from "@/formulario/datos";
import { Seguimiento, type DatosSeguimiento } from "./seguimiento";
import type { Almacenada, Ruta } from "@/formulario/tipos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lead" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFERTA: Record<string, string> = { online: "Formación online", presencial: "Formación presencial", asesoria: "Asesoría 1:1" };

export default async function Ficha({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string; error?: string }>;
}) {
  await exigirSesion();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [r] = await sql()`
    select fi.id as ficha_id, fi.nivel, fi.dolores, fi.oferta_recomendada, fi.encaje, fi.resumen, fi.puntuacion,
           fi.estado, fi.fase, fi.propuesta_estado, fi.propuesta_at,
           to_char(fi.reserva_at at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI') as reserva_input,
           p.id as persona_id, p.nombre, p.email, p.telefono, p.ig_username, p.pais,
           f.ruta, f.interes, f.como_nos_conociste, f.respuestas, f.signals, f.creado_at, f.iniciado_at,
           v.codigo as video_codigo
    from setter.fichas fi
    join setter.formularios f on f.id = fi.formulario_id
    join setter.personas p on p.id = fi.persona_id
    left join setter.videos v on v.id = f.video_id
    where fi.id = ${id}`;
  if (!r) notFound();

  const eventos = await sql()`
    select tipo, datos, creado_at from setter.eventos where persona_id = ${r.persona_id} order by id desc limit 50`;

  const [resultado] = await sql()`
    select resultado, producto, importe_cents, forma_pago, edicion, motivo, nota
    from setter.resultados where ficha_id = ${id}`;
  const notas = await sql()`select texto, creado_at from setter.notas where ficha_id = ${id} order by id desc limit 100`;
  const q = await searchParams;
  const aviso = q.error
    ? { tipo: "error" as const, texto: q.error.slice(0, 200) }
    : q.guardado
      ? { tipo: "ok" as const, texto: "Guardado." }
      : null;
  const seguimiento = {
    id,
    fase: r.fase,
    propuesta_estado: r.propuesta_estado,
    propuesta_at: r.propuesta_at,
    reserva_input: r.reserva_input,
    resultado: resultado ?? null,
    notas: notas.map((n) => ({ texto: n.texto as string, creado_at: n.creado_at as Date })),
  } as DatosSeguimiento;

  const respuestas = (r.respuestas ?? {}) as Record<string, Almacenada>;
  const grupos = agruparRespuestas(definicion, respuestas);
  const signals = (r.signals ?? {}) as Record<string, unknown>;
  const whatsapp = enlaceWhatsApp(r.telefono);
  const instagram = enlaceInstagram(r.ig_username);
  const chatInstagram = enlaceChatInstagram(r.ig_username);
  const web = urlSegura(typeof respuestas.C04?.valor === "string" ? respuestas.C04.valor : null);
  const fase = r.fase as Fase;
  const ruta = r.ruta as Ruta | null;

  const lineasSignals = Object.entries(ETIQUETA_SIGNAL)
    .map(([k, etiqueta]) => {
      const v = signals[k];
      if (v === null || v === undefined || v === "") return null;
      return { etiqueta, valor: Array.isArray(v) ? v.join(", ") : k === "urgencia" ? `${v}/10` : String(v) };
    })
    .filter((x): x is { etiqueta: string; valor: string } => x !== null);

  return (
    <main className="pantalla panel">
      <p>
        <Link href="/panel">← Volver a la lista</Link>
      </p>

      <header className="ficha-cabecera">
        <h1>{r.nombre}</h1>
        <p className="chips">
          <span className={`fase fase-${fase}`}>{NOMBRE_FASE[fase]}</span>
          <span className="chip">{ruta ? NOMBRE_RUTA[ruta] : "Formulario antiguo"}</span>
          {r.video_codigo && <span className="chip">Vídeo {r.video_codigo}</span>}
          <span className="chip">{fechaCorta(r.creado_at)}</span>
        </p>
      </header>

      <Seguimiento d={seguimiento} aviso={aviso} />

      <section className="bloque">
        <h2>Contacto</h2>
        <dl className="datos">
          <div><dt>Email</dt><dd><a href={`mailto:${r.email}`}>{r.email}</a></dd></div>
          {r.telefono && (
            <div>
              <dt>Teléfono</dt>
              <dd>
                <a href={`tel:${r.telefono}`}>{r.telefono}</a>
                {whatsapp && <> · <a href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a></>}
              </dd>
            </div>
          )}
          {r.ig_username && (
            <div>
              <dt>Instagram</dt>
              <dd>
                {instagram ? <a href={instagram} target="_blank" rel="noopener noreferrer">@{r.ig_username}</a> : `@${r.ig_username}`}
                {chatInstagram && <> · <a href={chatInstagram} target="_blank" rel="noopener noreferrer">Abrir chat</a></>}
              </dd>
            </div>
          )}
          {web && (
            <div>
              <dt>Su trabajo</dt>
              <dd><a href={web} target="_blank" rel="noopener noreferrer">{web}</a></dd>
            </div>
          )}
          {r.pais && <div><dt>Ubicación</dt><dd>{r.pais}</dd></div>}
          {r.como_nos_conociste && <div><dt>Nos conoció por</dt><dd>{r.como_nos_conociste}</dd></div>}
        </dl>
      </section>

      <section className="bloque">
        <h2>Valoración de Claude</h2>
        {r.resumen ? (
          <>
            <p className="chips">
              {r.oferta_recomendada && <span className="chip">Recomendado: {OFERTA[r.oferta_recomendada]}</span>}
              {r.encaje && <span className={`chip encaje-${r.encaje}`}>Encaje {r.encaje}</span>}
              {r.puntuacion !== null && <span className="chip">Probabilidad de compra {r.puntuacion}/100</span>}
              {r.nivel && <span className="chip">Nivel {r.nivel}</span>}
            </p>
            {Array.isArray(r.dolores) && r.dolores.length > 0 && <p className="ayuda">Dolores: {r.dolores.join(", ")}</p>}
            <p className="resumen">{r.resumen}</p>
          </>
        ) : (
          <p className="vacio">Esta ficha todavía no tiene análisis.</p>
        )}
      </section>

      {lineasSignals.length > 0 && (
        <section className="bloque">
          <h2>Señales</h2>
          <dl className="datos">
            {lineasSignals.map((s) => (
              <div key={s.etiqueta}><dt>{s.etiqueta}</dt><dd>{s.valor}</dd></div>
            ))}
          </dl>
        </section>
      )}

      {grupos.map((g) => (
        <section className="bloque" key={g.titulo}>
          <h2>{g.titulo}</h2>
          <dl className="respuestas">
            {g.items.map((i) => (
              <div key={i.id}><dt>{i.pregunta}</dt><dd>{i.texto}</dd></div>
            ))}
          </dl>
        </section>
      ))}

      <section className="bloque">
        <h2>Historial</h2>
        <ol className="historial">
          {eventos.map((e, i) => (
            <li key={i}>
              <span className="lead-fecha">{fechaCorta(e.creado_at)}</span> {ETIQUETA_EVENTO[e.tipo as string] ?? String(e.tipo)}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
