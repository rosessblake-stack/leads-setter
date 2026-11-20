// Lectura de la guía en el visor web: qué diapositivas ve cada persona y cuánto tiempo. Se guarda en la misma tabla del embudo
// (una fila por sesión y paso): `leer_NN` con los segundos en esa diapositiva, y `leer_ini`, `leer_fin`, `leer_clic`.
export const TOTAL_DIAPOSITIVAS = 23;
export const MAX_SEGUNDOS_DIAPOSITIVA = 600;
export const SESION_VALIDA = /^[A-Za-z0-9-]{16,40}$/;

export const pasoDiapositiva = (n: number) => `leer_${String(n).padStart(2, "0")}`;
export const esPasoLectura = (paso: string) => /^leer_/.test(paso);

export type CargaLectura = {
  s: string;
  c: string;
  t: [number, number][]; // [diapositiva, segundos acumulados]
  fin: boolean;
  clic: boolean;
};

// Lo que manda el visor. Devuelve null si algo no cuadra: nunca se guarda lo que no se ha podido validar.
export function leerCargaLectura(texto: string): CargaLectura | null {
  if (texto.length > 3000) return null;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const s = String(d.s ?? "");
  const c = String(d.c ?? "");
  if (!SESION_VALIDA.test(s) || !/^[A-Za-z0-9_-]{0,40}$/.test(c)) return null;
  const crudo = Array.isArray(d.t) ? d.t.slice(0, TOTAL_DIAPOSITIVAS) : [];
  const t: [number, number][] = [];
  for (const par of crudo) {
    if (!Array.isArray(par) || par.length !== 2) return null;
    const n = Number(par[0]);
    const seg = Math.round(Number(par[1]));
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_DIAPOSITIVAS || !Number.isFinite(seg) || seg < 0) return null;
    if (seg >= 1) t.push([n, Math.min(seg, MAX_SEGUNDOS_DIAPOSITIVA)]);
  }
  return { s, c, t, fin: d.fin === true, clic: d.clic === true };
}

export type ResumenLectura = {
  vistas: number; // diapositivas con al menos 1 s
  total: number;
  llego: number; // la última diapositiva alcanzada
  segundos: number; // tiempo total
  masTiempo: { n: number; segundos: number } | null;
  final: boolean;
  clic: boolean;
};

export function resumirLectura(filas: { paso: string; indice: number }[]): ResumenLectura | null {
  const pantallas = filas.filter((f) => /^leer_\d\d$/.test(f.paso)).map((f) => ({ n: Number(f.paso.slice(5)), s: f.indice }));
  const abrio = filas.some((f) => f.paso === "leer_ini");
  if (!abrio && pantallas.length === 0) return null;
  const mayor = pantallas.reduce<{ n: number; s: number } | null>((m, p) => (m === null || p.s > m.s ? p : m), null);
  return {
    vistas: pantallas.length,
    total: TOTAL_DIAPOSITIVAS,
    llego: pantallas.reduce((m, p) => Math.max(m, p.n), 0),
    segundos: pantallas.reduce((t, p) => t + p.s, 0),
    masTiempo: mayor ? { n: mayor.n, segundos: mayor.s } : null,
    final: filas.some((f) => f.paso === "leer_fin"),
    clic: filas.some((f) => f.paso === "leer_clic"),
  };
}

export function textoTiempo(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}
