import Link from "next/link";
import { notFound } from "next/navigation";
import { intentar, sql } from "@/lib/db";
import { exigirSesion } from "@/lib/panel";
import {
  ETIQUETA_EVENTO,
  ETIQUETA_SIGNAL,
  NOMBRE_FASE,
  NOMBRE_RUTA,
  CLAVE_SIGNAL,
  IMPRESCINDIBLE_LLAMADA,
  ORDEN_LLAMADA,
  type ItemRespuesta,
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
import { EnlacePreparacion, HerramientasFicha } from "../../ajax";
import type { Almacenada, Ruta } from "@/formulario/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
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

  const datos = await intentar(async () => {
    const [r] = await sql()`
      select fi.id as ficha_id, fi.nivel, fi.dolores, fi.oferta_recomendada, fi.encaje, fi.resumen, fi.puntuacion,
             fi.estado, fi.fase, fi.origen, fi.caso_exito, fi.nota_exito, to_char(fi.cierre_posible_at, 'YYYY-MM-DD') as cierre_posible_at, fi.cierre_posible_nota, fi.propuesta_estado, fi.propuesta_at, fi.propuesta_mensaje, fi.propuesta_programada_at, fi.propuesta_error,
             to_char(fi.reserva_at at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI') as reserva_input,
             p.id as persona_id, p.nombre, p.email, p.telefono, p.ig_username, p.pais,
             f.ruta, f.interes, f.como_nos_conociste, f.respuestas, f.signals, f.creado_at, f.iniciado_at,
             v.codigo as video_codigo
      from setter.fichas fi
      join setter.formularios f on f.id = fi.formulario_id
      join setter.personas p on p.id = fi.persona_id
      left join setter.videos v on v.id = f.video_id
      where fi.id = ${id}`;
    if (!r) return null;

    // Eventos, resultado y notas en la misma consulta: un solo viaje a la base de datos.
    const [extra] = await sql()`
      select
        coalesce((select jsonb_agg(e order by e.id desc) from (
          select id, tipo, datos, creado_at from setter.eventos where persona_id = ${r.persona_id} order by id desc limit 50) e), '[]'::jsonb) as eventos,
        (select to_jsonb(x) from (
          select resultado, producto, importe_cents, forma_pago, edicion, motivo, nota from setter.resultados where ficha_id = ${id}) x) as resultado,
        coalesce((select jsonb_agg(n order by n.id desc) from (
          select id, texto, creado_at from setter.notas where ficha_id = ${id} order by id desc limit 100) n), '[]'::jsonb) as notas,
        (select to_jsonb(pp) from (select completada_at, respuestas from setter.preparaciones where ficha_id = ${id}) pp) as preparacion`;
    const eventos = (extra.eventos as { tipo: string; creado_at: string }[]).map((e) => ({ ...e, creado_at: new Date(e.creado_at) }));
    const notas = (extra.notas as { texto: string; creado_at: string }[]).map((n) => ({ texto: n.texto, creado_at: new Date(n.creado_at) }));
    return { r, eventos, resultado: extra.resultado, notas, preparacion: extra.preparacion as { completada_at: string | null; respuestas: Record<string, Almacenada> } | null };
  });
  if (!datos) notFound();
  const { r, eventos, resultado, notas, preparacion } = datos;
  const q = await searchParams;
  const aviso = q.error
    ? { tipo: "error" as const, texto: q.error.slice(0, 200) }
    : q.guardado
      ? { tipo: "ok" as const, texto: "Guardado." }
      : null;
  const seguimiento = {
    id,
    ruta: r.ruta ?? null,
    fase: r.fase,
    propuesta_estado: r.propuesta_estado,
    propuesta_at: r.propuesta_at,
    propuesta_mensaje: r.propuesta_mensaje ?? null,
    propuesta_programada_at: r.propuesta_programada_at ?? null,
    propuesta_error: r.propuesta_error ?? null,
    reserva_input: r.reserva_input,
    caso_exito: r.caso_exito === true,
    nota_exito: r.nota_exito ?? null,
    resultado: resultado ?? null,
    notas,
  } as DatosSeguimiento;

  const respuestas = (r.respuestas ?? {}) as Record<string, Almacenada>;
  const grupos = agruparRespuestas(definicion, respuestas);
  const gruposPrep = agruparRespuestas(definicion, preparacion?.respuestas ?? null);
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
      return { etiqueta, valor: Array.isArray(v) ? v.join(", ") : k === "urgencia" ? `${v}/10` : String(v), clave: CLAVE_SIGNAL.has(k) };
    })
    .filter((x): x is { etiqueta: string; valor: string; clave: boolean } => x !== null);
  const porId = new Map(grupos.flatMap((g) => g.items).map((i) => [i.id, i]));
  const textoPregunta = new Map(definicion.preguntas.map((q) => [q.id, q.texto]));
  // Datos clave en el orden de la llamada. Una imprescindible sin responder se muestra igual: hay que preguntarla.
  const pasos = ORDEN_LLAMADA.map((p) => ({
    paso: p.paso,
    items: p.ids
      .map((id) => porId.get(id) ?? (IMPRESCINDIBLE_LLAMADA.has(id) && textoPregunta.get(id) ? { id, pregunta: textoPregunta.get(id)!, texto: "", clave: true, imprescindible: true } : null))
      .filter((x): x is ItemRespuesta => x !== null),
  })).filter((p) => p.items.length > 0);
  const totalClaves = pasos.reduce((n, p) => n + p.items.length, 0);

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
          {r.origen === "historico" && <span className="chip">Cliente anterior</span>}
          {r.caso_exito && <span className="chip ok">Caso de éxito</span>}
          {r.cierre_posible_at && fase !== "vendido" && fase !== "no_vendido" && (
            <span className="chip av" title={r.cierre_posible_nota ?? undefined}>Posible cierre · {fechaCorta(`${r.cierre_posible_at}T12:00:00Z`).split(",")[0]}</span>
          )}
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

      <HerramientasFicha />

      {totalClaves > 0 && (
        <details className="desplegable clave-bloque" id="llamada" open>
          <summary>
            <h2>Para la llamada</h2>
            <span className="lead-fecha">En el orden de la llamada</span>
          </summary>
          <div className="desplegable-cuerpo" data-buscable>
            <p className="ayuda">Lo marcado con «No pasar por alto» hay que dejarlo claro antes de cerrar.</p>
            {pasos.map((p, n) => (
              <div key={p.paso}>
                <h3 style={{ margin: "16px 0 8px" }}>{n + 1}. {p.paso}</h3>
                <dl className="respuestas">
                  {p.items.map((i) => (
                    <div key={i.id} className={i.imprescindible ? "clave imprescindible" : "clave"}>
                      <dt>{i.imprescindible && <span className="no-pasar">No pasar por alto</span>}{i.pregunta}</dt>
                      <dd>{i.texto || "Sin responder: pregúntalo en la llamada"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </details>
      )}

      <details className="desplegable" id="valoracion" data-ficha>
        <summary>
          <h2>Valoración de Claude</h2>
          {r.resumen && (
            <span className="chips">
              {r.encaje && <span className={`chip encaje-${r.encaje}`}>Encaje {r.encaje}</span>}
              {r.puntuacion !== null && <span className="chip">{r.puntuacion}%</span>}
            </span>
          )}
        </summary>
        <div className="desplegable-cuerpo" data-buscable>
          {r.resumen ? (
            <>
              <p className="chips">
                {r.oferta_recomendada && <span className="chip">Recomendado: {OFERTA[r.oferta_recomendada]}</span>}
                {r.encaje && <span className={`chip encaje-${r.encaje}`}>Encaje {r.encaje}</span>}
                {r.puntuacion !== null && <span className="chip">Probabilidad de compra {r.puntuacion}%</span>}
                {r.nivel && <span className="chip">Nivel {r.nivel}</span>}
              </p>
              {Array.isArray(r.dolores) && r.dolores.length > 0 && <p className="ayuda">Dolores: {r.dolores.join(", ")}</p>}
              <p className="resumen">{r.resumen}</p>
            </>
          ) : (
            <p className="vacio">Esta ficha todavía no tiene análisis.</p>
          )}
        </div>
      </details>

      {lineasSignals.length > 0 && (
        <details className="desplegable" id="senales" data-ficha>
          <summary>
            <h2>Señales</h2>
          </summary>
          <div className="desplegable-cuerpo">
            <dl className="datos">
              {lineasSignals.map((s) => (
                <div key={s.etiqueta} data-buscable className={s.clave ? "clave" : undefined}><dt>{s.etiqueta}</dt><dd>{s.valor}</dd></div>
              ))}
            </dl>
          </div>
        </details>
      )}

      {grupos.map((g) => (
        <details className="desplegable" key={g.titulo} data-ficha data-grupo>
          <summary>
            <h2>{g.titulo}</h2>
            <span className="lead-fecha">{g.items.length} {g.items.length === 1 ? "respuesta" : "respuestas"}</span>
          </summary>
          <div className="desplegable-cuerpo">
            <dl className="respuestas">
              {g.items.map((i) => (
                <div key={i.id} data-buscable className={i.imprescindible ? "clave imprescindible" : i.clave ? "clave" : undefined}><dt>{i.pregunta}</dt><dd>{i.texto}</dd></div>
              ))}
            </dl>
          </div>
        </details>
      ))}

      {ruta === "asesoria" && (
        <details className="desplegable" id="preparacion" data-ficha>
          <summary>
            <h2>Preparación de la asesoría</h2>
            <span className={`chip ${preparacion?.completada_at ? "ok" : "av"}`}>{preparacion?.completada_at ? "Completada" : "Pendiente"}</span>
          </summary>
          <div className="desplegable-cuerpo">
            <p className="ayuda">
              Las preguntas largas, que la persona rellena tras pagar y antes de la llamada. Le sale el enlace al reservar; también puedes copiarlo aquí
              y enviárselo.
            </p>
            <EnlacePreparacion action={`/panel/lead/${id}/preparacion`} />
            {gruposPrep.map((g) => (
              <div key={g.titulo} data-buscable>
                <h3 style={{ margin: "16px 0 8px" }}>{g.titulo}</h3>
                <dl className="respuestas">
                  {g.items.map((i) => (
                    <div key={i.id}><dt>{i.pregunta}</dt><dd>{i.texto}</dd></div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </details>
      )}

      <details className="desplegable" id="borrar">
        <summary>
          <h2>Borrar a esta persona</h2>
          <span className="lead-fecha">Derecho de supresión</span>
        </summary>
        <div className="desplegable-cuerpo">
          <p className="ayuda">
            Borra de forma definitiva a la persona de esta base de datos (ficha, formulario, historial, notas, resultado, reservas) y sus
            eventos del calendario. Después tendrás que borrar a mano su contacto en ManyChat y los mensajes de Telegram. Las copias de
            seguridad de Supabase caducan solas. Los datos de pagos y facturas que debas conservar por ley no están aquí: están en Stripe.
          </p>
          <form method="post" action={`/panel/lead/${id}/borrar`} className="formulario-seg">
            <label>
              Escribe BORRAR para confirmar
              <input type="text" name="confirmar" autoComplete="off" required />
            </label>
            <button type="submit" className="secundario">Borrar definitivamente</button>
          </form>
        </div>
      </details>

      <details className="desplegable" id="historial" data-ficha>
        <summary>
          <h2>Historial</h2>
          <span className="lead-fecha">{eventos.length} {eventos.length === 1 ? "evento" : "eventos"}</span>
        </summary>
        <div className="desplegable-cuerpo">
          <ol className="historial">
            {eventos.map((e, i) => (
              <li key={i}>
                <span className="lead-fecha">{fechaCorta(e.creado_at)}</span> {ETIQUETA_EVENTO[e.tipo as string] ?? String(e.tipo)}
              </li>
            ))}
          </ol>
        </div>
      </details>
    </main>
  );
}
