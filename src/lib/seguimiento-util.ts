import { FASES, type Fase } from "./panel-util";

// Las fases que se mueven con un botón. "Vendido" y "No vendido" se fijan al registrar el resultado.
export const FASES_MANUALES: Fase[] = FASES.filter((f) => f !== "vendido" && f !== "no_vendido");
export const FASES_FINALES: Fase[] = ["vendido", "no_vendido", "descartado"];

export const PROPUESTAS = ["pendiente", "enviada", "no_enviada", "manual"] as const;
export type Propuesta = (typeof PROPUESTAS)[number];
export const NOMBRE_PROPUESTA: Record<Propuesta, string> = {
  pendiente: "Pendiente de enviar",
  enviada: "Enviada",
  no_enviada: "No se pudo enviar",
  manual: "Enviada a mano",
};

export const PRODUCTOS = ["online", "presencial", "asesoria"] as const;
export type Producto = (typeof PRODUCTOS)[number];
export const NOMBRE_PRODUCTO: Record<Producto, string> = {
  online: "Curso online",
  presencial: "Formación presencial",
  asesoria: "Asesoría 1:1",
};

export const FORMAS_PAGO = ["stripe", "kajabi", "otra"] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];
export const NOMBRE_FORMA_PAGO: Record<FormaPago, string> = { stripe: "Stripe", kajabi: "Kajabi", otra: "Otra" };

export const MOTIVOS = ["precio", "lo_piensa", "no_encaja", "no_responde", "otro"] as const;
export type Motivo = (typeof MOTIVOS)[number];
export const NOMBRE_MOTIVO: Record<Motivo, string> = {
  precio: "Precio",
  lo_piensa: "Lo está pensando",
  no_encaja: "No encaja",
  no_responde: "No responde",
  otro: "Otro",
};

export type Resultado =
  | {
      resultado: "vendido";
      producto: Producto;
      importe_cents: number | null;
      forma_pago: FormaPago | null;
      edicion: string | null;
      nota: string | null;
    }
  | { resultado: "no_vendido"; motivo: Motivo; nota: string | null };

type Leer<T> = { ok: true; valor: T } | { ok: false; error: string };
type Get = (k: string) => string | null | undefined;

const texto = (v: string | null | undefined) => (v ?? "").trim();
const entre = <T extends string>(lista: readonly T[], v: string): v is T => (lista as readonly string[]).includes(v);

// Acepta "1200", "1200.50", "1.200" y "1.200,50". Devuelve céntimos.
export function aCentimos(entrada: string): number | null {
  let t = entrada.replace(/[\s€]/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  const n = Number(t);
  return n <= 100000 ? Math.round(n * 100) : NaN;
}

export function leerFaseManual(v: string | null | undefined): Leer<Fase> {
  const f = texto(v);
  return entre(FASES_MANUALES, f) ? { ok: true, valor: f as Fase } : { ok: false, error: "Esa fase no es válida." };
}

export function leerPropuesta(v: string | null | undefined): Leer<Propuesta> {
  const p = texto(v);
  return entre(PROPUESTAS, p) ? { ok: true, valor: p } : { ok: false, error: "Ese estado de propuesta no es válido." };
}

// "2026-11-12T18:30" (hora de Madrid) o vacío para quitar la reserva.
export function leerReserva(v: string | null | undefined): Leer<string | null> {
  const t = texto(v);
  if (t === "") return { ok: true, valor: null };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t) || Number.isNaN(Date.parse(t + ":00Z"))) {
    return { ok: false, error: "Escribe una fecha y hora válidas." };
  }
  return { ok: true, valor: t };
}

export function leerNota(v: string | null | undefined): Leer<string> {
  const t = texto(v);
  if (t === "") return { ok: false, error: "Escribe algo en la nota." };
  if (t.length > 2000) return { ok: false, error: "La nota es demasiado larga (máximo 2000 caracteres)." };
  return { ok: true, valor: t };
}

export function leerResultado(get: Get): Leer<Resultado> {
  const resultado = texto(get("resultado"));
  const nota = texto(get("nota"));
  if (nota.length > 500) return { ok: false, error: "La nota del resultado es demasiado larga (máximo 500 caracteres)." };
  if (resultado === "vendido") {
    const producto = texto(get("producto"));
    if (!entre(PRODUCTOS, producto)) return { ok: false, error: "Elige qué ha comprado." };
    const bruto = texto(get("importe"));
    const importe = bruto === "" ? null : aCentimos(bruto);
    if (importe !== null && Number.isNaN(importe)) return { ok: false, error: "El importe no es válido." };
    const forma = texto(get("forma_pago"));
    if (forma !== "" && !entre(FORMAS_PAGO, forma)) return { ok: false, error: "La forma de pago no es válida." };
    const edicion = texto(get("edicion"));
    if (edicion.length > 100) return { ok: false, error: "La edición es demasiado larga." };
    return {
      ok: true,
      valor: {
        resultado: "vendido",
        producto,
        importe_cents: importe,
        forma_pago: forma === "" ? null : (forma as FormaPago),
        edicion: edicion === "" ? null : edicion,
        nota: nota === "" ? null : nota,
      },
    };
  }
  if (resultado === "no_vendido") {
    const motivo = texto(get("motivo"));
    if (!entre(MOTIVOS, motivo)) return { ok: false, error: "Elige el motivo de que no haya comprado." };
    return { ok: true, valor: { resultado: "no_vendido", motivo, nota: nota === "" ? null : nota } };
  }
  return { ok: false, error: "Elige si ha comprado o no." };
}
