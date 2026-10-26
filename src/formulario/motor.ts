import type { Almacenada, Condicion, Definicion, Pregunta, Respuestas, Ruta } from "./tipos";

export const PENDIENTE = "__pendiente__";
export const claveExtra = (id: string) => `${id}__extra`;

const MAX_TEXTO = 300;
const MAX_TEXTO_LARGO = 1500;

export function rutaDe(def: Definicion, r: Respuestas): Ruta | null {
  const v = r[def.pregunta_de_ruta];
  return typeof v === "string" ? (def.rutas[v] ?? null) : null;
}

function comoLista(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v !== "") return [v];
  return [];
}

function cumple(c: Condicion, r: Respuestas): boolean {
  const lista = comoLista(r[c.pregunta]);
  if (lista.length === 0) return false; // depende de algo aún sin responder
  if (c.es !== undefined && !lista.includes(c.es)) return false;
  if (c.noEs !== undefined && lista.includes(c.noEs)) return false;
  if (c.incluye !== undefined && !lista.includes(c.incluye)) return false;
  if (c.noIncluye !== undefined && lista.includes(c.noIncluye)) return false;
  return true;
}

// Preguntas que ve la persona con las respuestas actuales, en orden.
export function visibles(def: Definicion, r: Respuestas): Pregunta[] {
  const ruta = rutaDe(def, r);
  return def.preguntas.filter((q) => {
    if (q.rutas && (!ruta || !q.rutas.includes(ruta))) return false;
    if (q.si && !cumple(q.si, r)) return false;
    return true;
  });
}

export function extraAplica(q: Pregunta, r: Respuestas): boolean {
  if (!q.extra) return false;
  if (q.extra.cuando === undefined) return true;
  return r[q.id] === q.extra.cuando;
}

const esNumero = (v: unknown): boolean => {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 && v <= 1e9;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 && n <= 1e9;
  }
  return false;
};
export const aNumero = (v: unknown): number => Number(String(v).replace(",", "."));

export function limpiarTelefono(v: string): string {
  return v.replace(/[\s().-]/g, "");
}

const vacio = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.values(v as object).every((x) => String(x ?? "").trim() === ""));

// Devuelve el mensaje de error o null si la respuesta es válida.
export function validarRespuesta(q: Pregunta, r: Respuestas): string | null {
  const v = r[q.id];
  const obligatoria = Boolean(q.obligatoria);

  if (q.tipo === "casilla") {
    if (obligatoria && v !== true) return "Tienes que aceptar esto para continuar.";
    return v === undefined || typeof v === "boolean" ? null : "Respuesta no válida.";
  }

  if (vacio(v)) return obligatoria ? "Esta pregunta es obligatoria." : null;

  switch (q.tipo) {
    case "texto":
    case "texto_largo": {
      if (typeof v !== "string") return "Respuesta no válida.";
      const max = q.maxCaracteres ?? (q.tipo === "texto" ? MAX_TEXTO : MAX_TEXTO_LARGO);
      if (v.length > max) return `Máximo ${max} caracteres.`;
      return null;
    }
    case "email":
      return typeof v === "string" && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
        ? null
        : "Escribe un email válido.";
    case "telefono":
      return typeof v === "string" && /^\+?\d{7,15}$/.test(limpiarTelefono(v))
        ? null
        : "Escribe un teléfono válido, con prefijo (por ejemplo, +34 600 000 000).";
    case "eleccion": {
      if (typeof v !== "string") return "Respuesta no válida.";
      if (q.opciones === PENDIENTE) {
        if (v.length > MAX_TEXTO) return `Máximo ${MAX_TEXTO} caracteres.`;
      } else if (!q.opciones?.includes(v)) return "Elige una de las opciones.";
      if (extraAplica(q, r)) {
        const e = r[claveExtra(q.id)];
        const e1 = q.extra!;
        if (vacio(e)) return e1.obligatoria ? `Falta: ${e1.etiqueta}.` : null;
        if (e1.tipo === "numero" ? !esNumero(e) : typeof e !== "string" || e.length > MAX_TEXTO) {
          return `Revisa: ${e1.etiqueta}.`;
        }
      }
      return null;
    }
    case "multi": {
      if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) return "Respuesta no válida.";
      const ops = Array.isArray(q.opciones) ? q.opciones : [];
      if (!v.every((x) => ops.includes(x))) return "Elige solo opciones de la lista.";
      if (q.maxSelecciones && v.length > q.maxSelecciones) return `Marca como máximo ${q.maxSelecciones}.`;
      const excl = q.excluyentes ?? [];
      if (v.some((x) => excl.includes(x)) && v.length > 1) return "Esa opción no se puede combinar con las demás.";
      return null;
    }
    case "escala": {
      const { min, max } = q.escala ?? { min: 1, max: 5 };
      const n = typeof v === "number" ? v : Number(v);
      return Number.isInteger(n) && n >= min && n <= max ? null : `Elige un valor del ${min} al ${max}.`;
    }
    case "sino":
      return v === "Sí" || v === "No" ? null : "Elige Sí o No.";
    case "numero":
      return esNumero(v) ? null : "Escribe un número válido.";
    case "dos_numeros": {
      if (typeof v !== "object" || Array.isArray(v) || v === null) return "Respuesta no válida.";
      const o = v as Record<string, unknown>;
      const campos = q.campos ?? [];
      const rellenos = campos.filter((c) => !vacio(o[c.id]));
      if (rellenos.length === 0) return obligatoria ? "Esta pregunta es obligatoria." : null;
      return campos.every((c) => esNumero(o[c.id])) ? null : "Rellena los dos números.";
    }
    default:
      return "Respuesta no válida.";
  }
}

// Quita las respuestas de preguntas que ya no se muestran (p. ej., al cambiar de ruta).
export function limpiar(def: Definicion, r: Respuestas): Respuestas {
  const salida: Respuestas = {};
  for (const q of visibles(def, r)) {
    if (r[q.id] !== undefined) salida[q.id] = r[q.id];
    if (r[claveExtra(q.id)] !== undefined && extraAplica(q, r)) salida[claveExtra(q.id)] = r[claveExtra(q.id)];
  }
  return salida;
}

export type ResultadoValidacion = {
  ok: boolean;
  ruta: Ruta | null;
  errores: Record<string, string>;
  limpias: Respuestas;
};

export function validarTodo(def: Definicion, r: Respuestas): ResultadoValidacion {
  const ruta = rutaDe(def, r);
  const errores: Record<string, string> = {};
  if (!ruta) errores[def.pregunta_de_ruta] = "Elige una opción.";
  const limpias = limpiar(def, r);
  for (const q of visibles(def, limpias)) {
    const e = validarRespuesta(q, limpias);
    if (e) errores[q.id] = e;
  }
  return { ok: Object.keys(errores).length === 0, ruta, errores, limpias };
}

// Respuestas ya validadas, con el texto de la pregunta tal como se mostró.
export function almacenar(def: Definicion, limpias: Respuestas): Record<string, Almacenada> {
  const salida: Record<string, Almacenada> = {};
  for (const q of visibles(def, limpias)) {
    const v = limpias[q.id];
    if (vacio(v) && q.tipo !== "casilla") continue;
    let valor: Almacenada["valor"];
    switch (q.tipo) {
      case "numero":
        valor = aNumero(v);
        break;
      case "escala":
        valor = Number(v);
        break;
      case "dos_numeros": {
        const o = v as Record<string, unknown>;
        valor = Object.fromEntries(
          (q.campos ?? []).filter((c) => !vacio(o[c.id])).map((c) => [c.id, aNumero(o[c.id])]),
        );
        break;
      }
      case "telefono":
        valor = limpiarTelefono(String(v));
        break;
      case "casilla":
        valor = v === true;
        break;
      case "multi":
        valor = (v as string[]).slice();
        break;
      default:
        valor = String(v).trim();
    }
    const item: Almacenada = { pregunta: q.texto, valor };
    if (extraAplica(q, limpias) && !vacio(limpias[claveExtra(q.id)])) {
      const e = limpias[claveExtra(q.id)];
      item.extra = q.extra!.tipo === "numero" ? aNumero(e) : String(e).trim();
    }
    salida[q.id] = item;
  }
  return salida;
}
