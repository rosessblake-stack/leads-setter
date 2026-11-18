"use client";

import { useState } from "react";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Clave aleatoria generada en este navegador (no se envía ni se guarda en ningún sitio). Sin modulo sesgado: se descartan
// los bytes que no caben en un múltiplo exacto del alfabeto.
function nuevaClave(largo: number): string {
  const limite = 256 - (256 % ALFABETO.length);
  let salida = "";
  while (salida.length < largo) {
    const bytes = new Uint8Array(largo * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limite && salida.length < largo) salida += ALFABETO[b % ALFABETO.length];
    }
  }
  return salida;
}

export function Generador() {
  const [largo, setLargo] = useState(40);
  const [clave, setClave] = useState("");
  const [copiada, setCopiada] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2500);
    } catch {
      /* si el navegador no deja copiar, se puede seleccionar a mano */
    }
  }

  return (
    <div className="formulario-seg">
      <label>
        Longitud
        <select value={largo} onChange={(e) => { setLargo(Number(e.target.value)); setClave(""); }}>
          {[32, 40, 48, 64].map((n) => (
            <option key={n} value={n}>{n} caracteres</option>
          ))}
        </select>
      </label>
      <button type="button" className="principal" onClick={() => { setClave(nuevaClave(largo)); setCopiada(false); }}>
        {clave ? "Generar otra" : "Generar clave"}
      </button>
      {clave && (
        <>
          <p className="clave-generada" data-testid="clave" style={{ fontFamily: "ui-monospace, monospace", wordBreak: "break-all", padding: 14, border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg-2)" }}>
            {clave}
          </p>
          <button type="button" className="secundario" onClick={() => void copiar()}>
            {copiada ? "✔ Copiada" : "Copiar"}
          </button>
        </>
      )}
    </div>
  );
}
