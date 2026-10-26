import type { Almacenada, Ruta } from "./tipos";

export type ReglasOferta = {
  reglas: { pregunta: string; respuesta: string; sugiere: string[] }[];
  contradiccion: { entre: [string, string]; mensaje: string };
};

export type Signals = {
  ruta: Ruta;
  urgencia: number | null;
  quien_decide: string | null;
  primer_pago_mismo_dia: string | null;
  ingresos_mensuales: string | null;
  inversion_previa: string[] | null;
  experiencia: string | null;
  clientes_mes: string | null;
  sugerencia_oferta?: string | null;
};

type Mapa = Record<string, Almacenada>;
const texto = (m: Mapa, id: string): string | null => {
  const v = m[id]?.valor;
  return typeof v === "string" ? v : null;
};

function sugerencias(m: Mapa, reglas: ReglasOferta, id: string): string[] {
  const resp = texto(m, id);
  if (!resp) return [];
  return reglas.reglas.find((r) => r.pregunta === id && r.respuesta === resp)?.sugiere ?? [];
}

// Resumen para leer de un vistazo, calculado por código (no por Claude).
export function calcularSignals(ruta: Ruta, m: Mapa, reglas: ReglasOferta): Signals {
  const urg = m["C15"]?.valor;
  const inv = m["C13"]?.valor;
  const s: Signals = {
    ruta,
    urgencia: typeof urg === "number" ? urg : null,
    quien_decide: texto(m, "C16"),
    primer_pago_mismo_dia: ruta === "presencial" || ruta === "online" ? texto(m, "E03") : null,
    ingresos_mensuales: texto(m, "C12"),
    inversion_previa: Array.isArray(inv) ? inv : null,
    experiencia: texto(m, "C08"),
    clientes_mes: texto(m, "C10"),
  };
  if (ruta === "no_claro") {
    const [a, b] = reglas.contradiccion.entre;
    const sa = sugerencias(m, reglas, a);
    const sb = sugerencias(m, reglas, b);
    if (sa.length && sb.length) {
      const comunes = sa.filter((x) => sb.includes(x));
      s.sugerencia_oferta = comunes.length ? comunes.join(" / ") : reglas.contradiccion.mensaje;
    } else {
      const unica = sa.length ? sa : sb;
      s.sugerencia_oferta = unica.length ? unica.join(" / ") : null;
    }
  }
  return s;
}
