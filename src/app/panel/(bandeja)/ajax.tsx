"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Resultado = { ok: true } | { ok: false; error: string };

// Envía una acción del panel sin recargar la página; si algo falla, el formulario normal sigue funcionando.
async function enviar(action: string, datos: FormData): Promise<Resultado> {
  try {
    const r = await fetch(action, {
      method: "POST",
      body: datos,
      headers: { "x-fluido": "1" },
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
    });
    if (r.status === 401 || r.redirected) {
      location.href = "/panel/entrar";
      return { ok: false, error: "Sesión caducada." };
    }
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!r.ok || !j?.ok) return { ok: false, error: j?.error ?? "No se pudo guardar. Inténtalo de nuevo." };
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar. Revisa la conexión e inténtalo de nuevo." };
  }
}

export function FormularioAjax({
  action,
  className,
  children,
  limpiar = false,
}: {
  action: string;
  className?: string;
  children: ReactNode;
  limpiar?: boolean;
}) {
  const router = useRouter();
  const [, refrescar] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const ocupado = useRef(false);

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado.current) return;
    ocupado.current = true;
    const form = e.currentTarget;
    const quien = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    setEnviando(true);
    setAviso(null);
    const r = await enviar(action, new FormData(form, quien));
    if (r.ok) {
      if (limpiar) form.reset();
      setAviso({ tipo: "ok", texto: "Guardado." });
      refrescar(() => router.refresh());
    } else {
      setAviso({ tipo: "error", texto: r.error });
    }
    ocupado.current = false;
    setEnviando(false);
  }

  return (
    <form method="post" action={action} className={className} onSubmit={alEnviar} aria-busy={enviando}>
      <fieldset className="sin-marco" disabled={enviando}>
        {children}
      </fieldset>
      {aviso && (
        <p className={aviso.tipo === "ok" ? "aviso" : "error"} role={aviso.tipo === "ok" ? "status" : "alert"}>
          {aviso.texto}
        </p>
      )}
    </form>
  );
}

// Muestra solo el estado actual y, con «Cambiar», las opciones. Al elegir una se guarda y se cierra.
export function Pildoras({
  action,
  accion,
  campo,
  activo,
  opciones,
  etiqueta,
  prefijoClase,
  nombres,
  nota,
  detalle,
}: {
  action: string;
  accion: string;
  campo: string;
  activo: string;
  opciones: { valor: string; etiqueta: string }[];
  etiqueta: string;
  prefijoClase: string;
  nombres: Record<string, string>;
  nota?: string;
  detalle?: string;
}) {
  const router = useRouter();
  const [, refrescar] = useTransition();
  const [sel, setSel] = useState(activo);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const ocupado = useRef(false);

  useEffect(() => setSel(activo), [activo]);

  async function elegir(valor: string) {
    if (ocupado.current) return;
    if (valor === sel) {
      setAbierto(false);
      return;
    }
    ocupado.current = true;
    const anterior = sel;
    setSel(valor); // se ve al instante; se corrige si falla
    setAbierto(false);
    setError(null);
    setGuardado(false);
    const datos = new FormData();
    datos.set("accion", accion);
    datos.set(campo, valor);
    const r = await enviar(action, datos);
    if (r.ok) {
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
      refrescar(() => router.refresh());
    } else {
      setSel(anterior);
      setError(r.error);
    }
    ocupado.current = false;
  }

  return (
    <div className="estado-bloque">
      <div className="estado-fila">
        <span className="estado-etiqueta">{etiqueta}</span>
        <span className={`estado-valor ${prefijoClase}${sel}`}>{nombres[sel] ?? sel}</span>
        {detalle && <span className="lead-fecha">{detalle}</span>}
        {guardado && (
          <span className="aviso" role="status">
            Guardado
          </span>
        )}
        <button type="button" className="enlace-texto" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
          {abierto ? "Cerrar" : "Cambiar"}
        </button>
      </div>
      {abierto && (
        <div className="botonera">
          {opciones.map((o) => (
            <button key={o.valor} type="button" className={`pildora${sel === o.valor ? " activa" : ""}`} aria-pressed={sel === o.valor} onClick={() => elegir(o.valor)}>
              {o.etiqueta}
            </button>
          ))}
        </div>
      )}
      {nota && abierto && <p className="ayuda">{nota}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Crea el enlace de reserva de un lead y lo deja listo para copiar.
export function EnlaceReserva({ action, tipo }: { action: string; tipo: "venta" | "asesoria" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<"" | "creando" | "copiado" | "error">("");

  async function crear() {
    setEstado("creando");
    try {
      const r = await fetch(action, { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(20000) });
      if (r.status === 401) {
        location.href = "/panel/entrar";
        return;
      }
      const j = (await r.json()) as { ok?: boolean; url?: string };
      if (!r.ok || !j.ok || !j.url) throw new Error();
      setUrl(j.url);
      try {
        await navigator.clipboard.writeText(j.url);
        setEstado("copiado");
      } catch {
        setEstado("");
      }
    } catch {
      setEstado("error");
    }
  }

  return (
    <>
      <button type="button" className="secundario" onClick={crear} disabled={estado === "creando"}>
        {estado === "creando" ? "Creando…" : tipo === "asesoria" ? "Crear enlace de reserva (asesoría pagada)" : "Crear enlace de reserva"}
      </button>
      {url && (
        <p className="resumen">
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de reserva" />
          {estado === "copiado" && <span className="aviso"> Copiado.</span>}
        </p>
      )}
      {estado === "error" && (
        <p className="error" role="alert">
          No se pudo crear el enlace. Inténtalo de nuevo.
        </p>
      )}
    </>
  );
}

// Muestra un texto y permite copiarlo con un toque.
export function CopiarTexto({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  }
  return (
    <>
      <textarea readOnly rows={8} value={texto} aria-label="Mensaje de la propuesta" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="secundario" onClick={copiar}>
        {copiado ? "Copiado" : "Copiar mensaje"}
      </button>
    </>
  );
}

// Herramientas de la ficha: abrir o cerrar todo y buscar dentro de las respuestas, señales y valoración.
export function HerramientasFicha() {
  const [busqueda, setBusqueda] = useState("");
  const [todoAbierto, setTodoAbierto] = useState(false);
  const todos = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details.desplegable[data-ficha]"));

  function alternar() {
    const abrir = !todoAbierto;
    todos().forEach((d) => (d.open = abrir));
    setTodoAbierto(abrir);
  }

  function buscar(texto: string) {
    setBusqueda(texto);
    const q = texto.trim().toLowerCase();
    for (const d of todos()) {
      const filas = Array.from(d.querySelectorAll<HTMLElement>("[data-buscable]"));
      if (filas.length === 0) {
        d.classList.toggle("oculto", q !== ""); // lo que no se puede buscar (historial) se esconde mientras se busca
        continue;
      }
      let coincide = 0;
      for (const f of filas) {
        const ok = q === "" || (f.textContent ?? "").toLowerCase().includes(q);
        f.classList.toggle("oculto", !ok);
        if (ok) coincide++;
      }
      d.classList.toggle("oculto", q !== "" && coincide === 0);
      if (q !== "" && coincide > 0) d.open = true;
    }
  }

  return (
    <div className="herramientas-ficha">
      <input type="search" value={busqueda} onChange={(e) => buscar(e.target.value)} placeholder="Buscar en la ficha" aria-label="Buscar en la ficha" maxLength={60} />
      <button type="button" className="enlace-texto" onClick={alternar}>
        {todoAbierto ? "Cerrar todo" : "Abrir todo"}
      </button>
    </div>
  );
}
