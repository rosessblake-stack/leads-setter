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

export function Pildoras({
  action,
  accion,
  campo,
  activo,
  opciones,
}: {
  action: string;
  accion: string;
  campo: string;
  activo: string;
  opciones: { valor: string; etiqueta: string }[];
}) {
  const router = useRouter();
  const [, refrescar] = useTransition();
  const [sel, setSel] = useState(activo);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const ocupado = useRef(false);

  useEffect(() => setSel(activo), [activo]);

  async function elegir(valor: string) {
    if (ocupado.current || valor === sel) return;
    ocupado.current = true;
    const anterior = sel;
    setSel(valor); // se ve al instante; se corrige si falla
    setError(null);
    setGuardado(false);
    const datos = new FormData();
    datos.set("accion", accion);
    datos.set(campo, valor);
    const r = await enviar(action, datos);
    if (r.ok) {
      setGuardado(true);
      refrescar(() => router.refresh());
    } else {
      setSel(anterior);
      setError(r.error);
    }
    ocupado.current = false;
  }

  return (
    <>
      <div className="botonera">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`pildora${sel === o.valor ? " activa" : ""}`}
            aria-pressed={sel === o.valor}
            onClick={() => elegir(o.valor)}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      {guardado && !error && (
        <p className="aviso" role="status">
          Guardado.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
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
