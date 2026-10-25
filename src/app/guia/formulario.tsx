"use client";

import { useState } from "react";

type Props = {
  video: string;
  manychat: string;
  textoConsentimiento: string;
  privacidad: string;
};

type Estado =
  | { tipo: "editando" }
  | { tipo: "enviando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; regalo: string | null };

export function Formulario({ video, manychat, textoConsentimiento, privacidad }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: "editando" });

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const texto = (k: string) => String(datos.get(k) ?? "").trim();
    const cuerpo = {
      nombre: texto("nombre"),
      email: texto("email"),
      ig_username: texto("ig_username"),
      pais: texto("pais"),
      ciudad: texto("ciudad") || undefined,
      zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone,
      interes: texto("interes"),
      nivel: texto("nivel"),
      dificultad: texto("dificultad"),
      objetivo: texto("objetivo"),
      como_nos_conociste: texto("como_nos_conociste") || undefined,
      consentimiento: datos.get("consentimiento") === "on",
      v: video || undefined,
      mc: manychat || undefined,
      web: texto("web"),
    };

    setEstado({ tipo: "enviando" });
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setEstado({ tipo: "listo", regalo: j.regalo ?? null });
      } else if (j.error === "validacion") {
        setEstado({ tipo: "error", mensaje: "Revisa los campos obligatorios y el email." });
      } else if (r.status === 429) {
        setEstado({ tipo: "error", mensaje: "Demasiados intentos. Prueba en unos minutos." });
      } else {
        setEstado({ tipo: "error", mensaje: "Algo ha fallado. Inténtalo de nuevo en un momento." });
      }
    } catch {
      setEstado({ tipo: "error", mensaje: "No hay conexión. Inténtalo de nuevo." });
    }
  }

  if (estado.tipo === "listo") {
    return (
      <section className="gracias" role="status">
        <h2>¡Listo! Gracias por rellenarlo.</h2>
        {estado.regalo ? (
          <p>
            <a className="boton" href={estado.regalo}>
              Descargar tu guía
            </a>
          </p>
        ) : (
          <p>En breve recibirás tu guía.</p>
        )}
        <p>Revisaré tus respuestas y te escribiré pronto.</p>
      </section>
    );
  }

  const enviando = estado.tipo === "enviando";

  return (
    <form onSubmit={enviar} className="formulario">
      <label>
        Nombre
        <input name="nombre" required maxLength={80} autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" required maxLength={200} autoComplete="email" />
      </label>
      <label>
        Tu usuario de Instagram (opcional)
        <input name="ig_username" maxLength={60} placeholder="@usuario" autoComplete="off" />
      </label>
      <label>
        País
        <input name="pais" required maxLength={60} autoComplete="country-name" />
      </label>
      <label>
        Ciudad (opcional)
        <input name="ciudad" maxLength={80} autoComplete="address-level2" />
      </label>
      <label>
        ¿Qué te interesa más?
        <select name="interes" required defaultValue="">
          <option value="" disabled>
            Elige una opción
          </option>
          <option value="online">Formación online</option>
          <option value="presencial">Formación presencial</option>
          <option value="asesoria">Asesoría 1 a 1 de una hora</option>
          <option value="no_se">Aún no lo sé</option>
        </select>
      </label>
      <label>
        Tu nivel actual
        <select name="nivel" required defaultValue="">
          <option value="" disabled>
            Elige una opción
          </option>
          <option value="principiante">Estoy empezando</option>
          <option value="intermedio">Ya trabajo, pero quiero mejorar</option>
          <option value="avanzado">Tengo experiencia sólida</option>
        </select>
      </label>
      <label>
        ¿Cuál es tu mayor dificultad ahora mismo?
        <textarea name="dificultad" required maxLength={1000} rows={4} />
      </label>
      <label>
        ¿Qué quieres conseguir en los próximos 6 meses?
        <textarea name="objetivo" required maxLength={1000} rows={4} />
      </label>
      <label>
        ¿Cómo nos conociste? (opcional)
        <input name="como_nos_conociste" maxLength={200} />
      </label>

      {/* Campo trampa para bots: las personas no lo ven. */}
      <div className="trampa" aria-hidden="true">
        <label>
          No rellenar
          <input name="web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="consentimiento">
        <input name="consentimiento" type="checkbox" required />
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

      {estado.tipo === "error" && (
        <p className="error" role="alert">
          {estado.mensaje}
        </p>
      )}

      <button type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Recibir mi guía"}
      </button>
    </form>
  );
}
