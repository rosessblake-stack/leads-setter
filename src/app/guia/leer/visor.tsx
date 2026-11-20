"use client";

import { useEffect, useRef } from "react";

type Props = { sesion: string | null; campana: string; total: number; chatUrl: string; chatBoton: string; palabra: string; pdfUrl: string };

// Visor de la guía: las diapositivas una debajo de otra. Mide cuál está en el centro de la pantalla y cuántos segundos, solo mientras la
// página está a la vista, y lo manda cada pocos segundos (y al salir). No guarda nada personal: solo la sesión del formulario.
export function Visor({ sesion, campana, total, chatUrl, chatBoton, palabra, pdfUrl }: Props) {
  const tiempos = useRef<number[]>(Array(total + 1).fill(0));
  const actual = useRef<number | null>(null);
  const final = useRef(false);
  const enviado = useRef("");

  useEffect(() => {
    if (!sesion) return;
    const mandar = (extra: { clic?: boolean } = {}) => {
      try {
        const t: [number, number][] = [];
        for (let n = 1; n <= total; n++) if (tiempos.current[n] >= 1) t.push([n, Math.round(tiempos.current[n])]);
        const cuerpo = JSON.stringify({ s: sesion, c: campana, t, fin: final.current, clic: extra.clic === true });
        if (cuerpo === enviado.current && !extra.clic) return;
        enviado.current = cuerpo;
        if (navigator.sendBeacon) navigator.sendBeacon("/api/guia/lectura", new Blob([cuerpo], { type: "application/json" }));
        else void fetch("/api/guia/lectura", { method: "POST", body: cuerpo, keepalive: true });
      } catch {
        /* medir nunca debe molestar */
      }
    };
    mandar();
    // Un segundo a la vez, solo si la página está a la vista y hay una diapositiva en el centro.
    const reloj = window.setInterval(() => {
      if (document.visibilityState !== "visible" || actual.current === null) return;
      const n = actual.current;
      tiempos.current[n] = Math.min(600, tiempos.current[n] + 1);
      if (n === total && tiempos.current[n] >= 2) final.current = true;
    }, 1000);
    const envio = window.setInterval(() => mandar(), 8000);
    const alSalir = () => mandar();
    const alCambiar = () => {
      if (document.visibilityState === "hidden") mandar();
    };
    window.addEventListener("pagehide", alSalir);
    document.addEventListener("visibilitychange", alCambiar);
    // «Diapositiva actual»: la que cruza una franja fina en el centro de la pantalla.
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) actual.current = Number((e.target as HTMLElement).dataset.n);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    document.querySelectorAll("[data-n]").forEach((el) => obs.observe(el));
    // Al llegar al botón final, también cuenta como final de la guía.
    const cierre = document.getElementById("cierre-guia");
    const obsCierre = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting)) final.current = true;
    });
    if (cierre) obsCierre.observe(cierre);
    return () => {
      window.clearInterval(reloj);
      window.clearInterval(envio);
      window.removeEventListener("pagehide", alSalir);
      document.removeEventListener("visibilitychange", alCambiar);
      obs.disconnect();
      obsCierre.disconnect();
      mandar();
    };
  }, [sesion, campana, total]);

  const alPulsarChat = () => {
    if (!sesion) return;
    final.current = true;
    try {
      const t: [number, number][] = [];
      for (let n = 1; n <= total; n++) if (tiempos.current[n] >= 1) t.push([n, Math.round(tiempos.current[n])]);
      const cuerpo = JSON.stringify({ s: sesion, c: campana, t, fin: true, clic: true });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/guia/lectura", new Blob([cuerpo], { type: "application/json" }));
    } catch {
      /* nada */
    }
  };

  return (
    <main className="visor">
      <header className="visor-cab">
        <h1>Cuánto cobrar y qué dicen tus datos</h1>
        <p className="visor-gira">Las diapositivas se leen mejor con el móvil en horizontal. También puedes ampliarlas con los dedos.</p>
      </header>
      <div className="visor-lista">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <figure key={n} data-n={n} className="visor-slide">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/guia-slides/p-${String(n).padStart(2, "0")}.jpg`}
              alt={`Diapositiva ${n} de ${total}`}
              width={1280}
              height={720}
              loading={n <= 2 ? "eager" : "lazy"}
              decoding="async"
            />
            <figcaption>
              {n} / {total}
            </figcaption>
          </figure>
        ))}
      </div>
      <section id="cierre-guia" className="visor-cierre">
        <h2>¿Te ha servido la guía?</h2>
        <p>
          Cuéntame qué te ha parecido y qué has aprendido. <strong>Pulsa el botón</strong> y se abrirá mi chat de Instagram: ahí te hago la pregunta.
        </p>
        <a className="boton-enlace" href={chatUrl} onClick={alPulsarChat}>
          <span aria-hidden="true">💬</span> {chatBoton} <span aria-hidden="true">→</span>
        </a>
        <p className="visor-nota">
          Si al abrir el chat no ves mi pregunta, escribe «{palabra}».
        </p>
        <a className="visor-pdf" href={pdfUrl} download>
          Descargar la guía en PDF
        </a>
      </section>
    </main>
  );
}
