"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Definicion, Pregunta, Respuestas } from "@/formulario/tipos";
import { PENDIENTE, claveExtra, extraAplica, limpiar, validarRespuesta, visibles } from "@/formulario/motor";

type Props = {
  definicion: Definicion;
  video: string;
  manychat: string;
  textoConsentimiento: string;
  privacidad: string;
};

const CLAVE = "leads-setter:formulario";
const BIENVENIDA = "bienvenida";
const CONSENTIMIENTO = "consentimiento";

export function Formulario({ definicion, video, manychat, textoConsentimiento, privacidad }: Props) {
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [paso, setPaso] = useState<string>(BIENVENIDA);
  const [iniciado, setIniciado] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [consentimiento, setConsentimiento] = useState(false);
  const [web, setWeb] = useState("");
  const [fase, setFase] = useState<"editando" | "enviando" | "listo">("editando");
  const [errorEnvio, setErrorEnvio] = useState("");
  const [cargado, setCargado] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  // Recupera lo respondido si la persona vuelve en el mismo navegador.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.version === definicion.version && d.respuestas && typeof d.respuestas === "object") {
          setRespuestas(d.respuestas);
          if (typeof d.paso === "string") setPaso(d.paso);
          if (typeof d.iniciado === "string") setIniciado(d.iniciado);
        }
      }
    } catch {
      /* sin almacenamiento: el formulario funciona igual */
    }
    setCargado(true);
  }, [definicion.version]);

  useEffect(() => {
    if (!cargado || fase === "listo") return;
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ version: definicion.version, respuestas, paso, iniciado }));
    } catch {
      /* ignorar */
    }
  }, [cargado, fase, definicion.version, respuestas, paso, iniciado]);

  const lista = useMemo(() => visibles(definicion, respuestas), [definicion, respuestas]);
  const secuencia = useMemo(() => [BIENVENIDA, ...lista.map((q) => q.id), CONSENTIMIENTO], [lista]);
  const idx = Math.max(0, secuencia.indexOf(paso));
  const pasoActual = secuencia[idx];
  const pregunta = lista.find((q) => q.id === pasoActual);
  const progreso = Math.round((idx / (secuencia.length - 1)) * 100);

  // Lleva el foco al primer campo de cada pantalla.
  useEffect(() => {
    if (!cargado) return;
    // Campos de escribir: foco directo. En las demás pantallas el foco va a la sección
    // (sin marcar ninguna opción) para que Enter siga funcionando.
    const escribir = raiz.current?.querySelector<HTMLElement>(
      "input:not([type='radio']):not([type='checkbox']):not([tabindex='-1']), textarea",
    );
    (escribir ?? raiz.current?.querySelector<HTMLElement>("form section"))?.focus({ preventScroll: true });
  }, [pasoActual, cargado, fase]);

  function poner(id: string, valor: unknown) {
    setRespuestas((prev) => limpiar(definicion, { ...prev, [id]: valor }));
    setErrores({});
  }
  function ponerExtra(id: string, valor: string) {
    setRespuestas((prev) => ({ ...prev, [claveExtra(id)]: valor }));
    setErrores({});
  }

  function avanzar() {
    if (pasoActual === BIENVENIDA) {
      setIniciado((prev) => prev ?? new Date().toISOString());
      setPaso(secuencia[1]);
      return;
    }
    if (pasoActual === CONSENTIMIENTO) {
      void enviar();
      return;
    }
    if (!pregunta) return;
    const e = validarRespuesta(pregunta, respuestas);
    if (e) {
      setErrores({ [pregunta.id]: e });
      return;
    }
    setErrores({});
    setPaso(secuencia[idx + 1]);
  }

  function volver() {
    if (idx > 0) {
      setErrores({});
      setErrorEnvio("");
      setPaso(secuencia[idx - 1]);
    }
  }

  async function enviar() {
    if (!consentimiento) {
      setErrorEnvio("Tienes que aceptar para poder enviar la solicitud.");
      return;
    }
    setFase("enviando");
    setErrorEnvio("");
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          respuestas,
          iniciado_at: iniciado ?? undefined,
          zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone,
          consentimiento: true,
          v: video || undefined,
          mc: manychat || undefined,
          web,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        try {
          localStorage.removeItem(CLAVE);
        } catch {
          /* ignorar */
        }
        setFase("listo");
        return;
      }
      setFase("editando");
      if (j.error === "validacion" && j.errores && typeof j.errores === "object") {
        const ids = Object.keys(j.errores);
        setErrores(j.errores);
        if (ids.length) setPaso(ids[0]);
        setErrorEnvio("Hay respuestas que revisar antes de enviar.");
      } else if (r.status === 429) {
        setErrorEnvio("Demasiados intentos. Prueba de nuevo en unos minutos.");
      } else {
        setErrorEnvio("Algo ha fallado. Inténtalo de nuevo en un momento.");
      }
    } catch {
      setFase("editando");
      setErrorEnvio("No hay conexión. Inténtalo de nuevo.");
    }
  }

  function alTeclear(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter") return;
    const t = e.target as HTMLElement;
    if (t instanceof HTMLTextAreaElement) {
      // Shift + Enter = salto de línea. En pantallas táctiles, Enter también lo es y se avanza con el botón.
      if (e.shiftKey || window.matchMedia("(pointer: coarse)").matches) return;
      e.preventDefault();
      avanzar();
      return;
    }
    if (t instanceof HTMLButtonElement) return;
    e.preventDefault();
    avanzar();
  }

  if (fase === "listo") {
    return (
      <div className="pantalla">
        <section className="gracias centro" role="status">
          <h2>{definicion.final.texto}</h2>
        </section>
      </div>
    );
  }

  const error = pregunta ? errores[pregunta.id] : undefined;
  const enviando = fase === "enviando";

  return (
    <div ref={raiz} className="pantalla">
      <div
        className="progreso"
        role="progressbar"
        aria-label="Progreso del formulario"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progreso}
      >
        <div className="progreso-barra" style={{ width: `${progreso}%` }} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          avanzar();
        }}
        onKeyDown={alTeclear}
        noValidate
        className="centro"
      >
        {pasoActual === BIENVENIDA && (
          <section className="bienvenida">
            <h1>{definicion.bienvenida.titulo}</h1>
            <p className="intro">{definicion.bienvenida.texto}</p>
            <button type="submit" className="principal">
              Empezar
            </button>
          </section>
        )}

        {pregunta && (
          <section tabIndex={-1}>
            <p className="contador">
              Pregunta {idx} de {lista.length}
            </p>
            <Campo
              q={pregunta}
              respuestas={respuestas}
              error={error}
              poner={poner}
              ponerExtra={ponerExtra}
            />
            {error && (
              <p className="error" role="alert" id={`error-${pregunta.id}`}>
                {error}
              </p>
            )}
          </section>
        )}

        {pasoActual === CONSENTIMIENTO && (
          <section tabIndex={-1}>
            <h2>Último paso</h2>
            <label className="consentimiento">
              <input
                type="checkbox"
                checked={consentimiento}
                onChange={(e) => {
                  setConsentimiento(e.target.checked);
                  setErrorEnvio("");
                }}
              />
              <span>
                {textoConsentimiento}
                {privacidad ? (
                  <>
                    {" "}
                    <a href={privacidad} target="_blank" rel="noopener noreferrer">
                      Política de privacidad
                    </a>
                  </>
                ) : null}
              </span>
            </label>
            {/* Campo trampa para bots: las personas no lo ven. */}
            <div className="trampa" aria-hidden="true">
              <label>
                No rellenar
                <input tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
              </label>
            </div>
          </section>
        )}

        {errorEnvio && (
          <p className="error" role="alert">
            {errorEnvio}
          </p>
        )}

        {pasoActual !== BIENVENIDA && (
          <div className="acciones">
            <button type="button" className="secundario" onClick={volver}>
              Volver
            </button>
            <button type="submit" className="principal" disabled={enviando}>
              {pasoActual === CONSENTIMIENTO ? (enviando ? "Enviando…" : "Enviar solicitud") : "Siguiente"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

type CampoProps = {
  q: Pregunta;
  respuestas: Respuestas;
  error?: string;
  poner: (id: string, valor: unknown) => void;
  ponerExtra: (id: string, valor: string) => void;
};

function Campo({ q, respuestas, error, poner, ponerExtra }: CampoProps) {
  const v = respuestas[q.id];
  const texto = typeof v === "string" ? v : "";
  const descr = error ? `error-${q.id}` : undefined;
  const titulo = (
    <>
      {q.texto}
      {q.obligatoria ? <span className="req"> *</span> : null}
    </>
  );
  const extra = q.extra && extraAplica(q, respuestas) ? q.extra : null;
  const valorExtra = String(respuestas[claveExtra(q.id)] ?? "");

  const campoExtra = extra ? (
    <label className="extra">
      <span>
        {extra.etiqueta}
        {extra.obligatoria ? <span className="req"> *</span> : null}
      </span>
      <input
        type={extra.tipo === "numero" ? "number" : "text"}
        inputMode={extra.tipo === "numero" ? "numeric" : undefined}
        min={extra.tipo === "numero" ? 0 : undefined}
        value={valorExtra}
        onChange={(e) => ponerExtra(q.id, e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={descr}
      />
    </label>
  ) : null;

  switch (q.tipo) {
    case "texto":
    case "email":
    case "telefono":
      return (
        <label className="pregunta">
          <span className="titulo">{titulo}</span>
          <input
            type={q.tipo === "email" ? "email" : q.tipo === "telefono" ? "tel" : "text"}
            autoComplete={q.id === "C01" ? "name" : q.id === "C02" ? "email" : q.id === "C03B" ? "tel" : "off"}
            maxLength={q.maxCaracteres ?? 300}
            value={texto}
            onChange={(e) => poner(q.id, e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={descr}
          />
        </label>
      );
    case "texto_largo":
      return (
        <label className="pregunta">
          <span className="titulo">{titulo}</span>
          <textarea
            rows={5}
            maxLength={q.maxCaracteres ?? 1500}
            value={texto}
            onChange={(e) => poner(q.id, e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={descr}
          />
          <span className="ayuda">
            <span className="solo-teclado">Enter para continuar · Shift + Enter para salto de línea</span>
            {q.maxCaracteres ? (
              <span>
                <span className="solo-teclado"> · </span>
                {texto.length} / {q.maxCaracteres}
              </span>
            ) : null}
          </span>
        </label>
      );
    case "numero":
      return (
        <label className="pregunta">
          <span className="titulo">{titulo}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={texto}
            onChange={(e) => poner(q.id, e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={descr}
          />
        </label>
      );
    case "dos_numeros": {
      const o = (v && typeof v === "object" ? v : {}) as Record<string, string>;
      return (
        <fieldset className="pregunta">
          <legend className="titulo">{titulo}</legend>
          <div className="pareja">
            {(q.campos ?? []).map((c) => (
              <label key={c.id}>
                {c.etiqueta}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={o[c.id] ?? ""}
                  onChange={(e) => poner(q.id, { ...o, [c.id]: e.target.value })}
                  aria-invalid={Boolean(error)}
                  aria-describedby={descr}
                />
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    case "eleccion": {
      if (q.opciones === PENDIENTE) {
        return (
          <label className="pregunta">
            <span className="titulo">{titulo}</span>
            <input
              type="text"
              maxLength={300}
              value={texto}
              onChange={(e) => poner(q.id, e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={descr}
            />
          </label>
        );
      }
      return (
        <fieldset className="pregunta">
          <legend className="titulo">{titulo}</legend>
          <div className="opciones" role="radiogroup">
            {(q.opciones ?? []).map((o) => (
              <label key={o} className={`opcion${texto === o ? " marcada" : ""}`}>
                <input type="radio" name={q.id} checked={texto === o} onChange={() => poner(q.id, o)} />
                <span>{o}</span>
              </label>
            ))}
          </div>
          {campoExtra}
        </fieldset>
      );
    }
    case "multi": {
      const actual = Array.isArray(v) ? (v as string[]) : [];
      const alternar = (o: string) => {
        const excl = q.excluyentes ?? [];
        let nuevo: string[];
        if (actual.includes(o)) nuevo = actual.filter((x) => x !== o);
        else if (excl.includes(o)) nuevo = [o];
        else {
          nuevo = [...actual.filter((x) => !excl.includes(x)), o];
          if (q.maxSelecciones && nuevo.length > q.maxSelecciones) return;
        }
        poner(q.id, nuevo);
      };
      const lleno = Boolean(q.maxSelecciones && actual.length >= q.maxSelecciones);
      return (
        <fieldset className="pregunta">
          <legend className="titulo">{titulo}</legend>
          {q.maxSelecciones ? <p className="ayuda">Elige hasta {q.maxSelecciones}.</p> : null}
          <div className="opciones">
            {(Array.isArray(q.opciones) ? q.opciones : []).map((o) => {
              const marcada = actual.includes(o);
              const bloqueada = lleno && !marcada && !(q.excluyentes ?? []).includes(o);
              return (
                <label key={o} className={`opcion${marcada ? " marcada" : ""}${bloqueada ? " bloqueada" : ""}`}>
                  <input type="checkbox" checked={marcada} disabled={bloqueada} onChange={() => alternar(o)} />
                  <span>{o}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case "escala": {
      const { min, max } = q.escala ?? { min: 1, max: 5 };
      const valores = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <fieldset className="pregunta">
          <legend className="titulo">{titulo}</legend>
          <div className="escala" role="radiogroup">
            {valores.map((n) => (
              <label key={n} className={`opcion${Number(v) === n ? " marcada" : ""}`}>
                <input type="radio" name={q.id} checked={Number(v) === n} onChange={() => poner(q.id, n)} />
                <span>{n}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    case "sino":
      return (
        <fieldset className="pregunta">
          <legend className="titulo">{titulo}</legend>
          <div className="opciones" role="radiogroup">
            {["Sí", "No"].map((o) => (
              <label key={o} className={`opcion${texto === o ? " marcada" : ""}`}>
                <input type="radio" name={q.id} checked={texto === o} onChange={() => poner(q.id, o)} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "casilla":
      return (
        <div className="pregunta">
          <label className="consentimiento">
            <input type="checkbox" checked={v === true} onChange={(e) => poner(q.id, e.target.checked)} />
            <span>
              {q.texto}
              {q.obligatoria ? <span className="req"> *</span> : null}
            </span>
          </label>
        </div>
      );
    default:
      return null;
  }
}
