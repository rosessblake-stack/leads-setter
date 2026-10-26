import { almacenar, limpiarTelefono, type ResultadoValidacion } from "./motor";
import { calcularSignals, type ReglasOferta, type Signals } from "./signals";
import type { Almacenada, Definicion, Ruta } from "./tipos";

export type Solicitud = {
  nombre: string;
  email: string;
  telefono: string | null;
  pais: string | null;
  ig_username: string | null;
  zona_horaria: string | null;
  ruta: Ruta;
  interes: "online" | "presencial" | "asesoria" | "no_se";
  como_nos_conociste: string | null;
  respuestas: Record<string, Almacenada>;
  signals: Signals;
  v: string | null;
  mc: string | null;
  iniciado_at: string | null;
  version: string;
};

const NO_USUARIOS = new Set(["p", "reel", "reels", "explore", "stories", "tv", "accounts"]);

export function extraerInstagram(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const t = texto.trim();
  const m = /instagram\.com\/@?([A-Za-z0-9._]{1,30})/i.exec(t) ?? /^@([A-Za-z0-9._]{1,30})$/.exec(t);
  return m && !NO_USUARIOS.has(m[1].toLowerCase()) ? m[1] : null;
}

const INTERES: Record<Ruta, Solicitud["interes"]> = {
  presencial: "presencial",
  online: "online",
  asesoria: "asesoria",
  no_claro: "no_se",
};

const str = (a: Almacenada | undefined): string | null => (typeof a?.valor === "string" ? a.valor : null);

export function construirSolicitud(
  def: Definicion,
  reglas: ReglasOferta,
  validacion: ResultadoValidacion,
  extra: { zona_horaria?: string; v?: string; mc?: string; iniciado_at?: string },
): Solicitud {
  const ruta = validacion.ruta as Ruta;
  const m = almacenar(def, validacion.limpias);
  const contacto = m["C03"];
  const arroba = contacto?.valor === "Instagram" && typeof contacto.extra === "string" ? contacto.extra : null;
  return {
    nombre: str(m["C01"]) ?? "",
    email: (str(m["C02"]) ?? "").toLowerCase(),
    telefono: m["C03B"] ? limpiarTelefono(String(m["C03B"].valor)) : null,
    pais: str(m["C05"]),
    ig_username: extraerInstagram(str(m["C04"])) ?? extraerInstagram(arroba),
    zona_horaria: extra.zona_horaria ?? null,
    ruta,
    interes: INTERES[ruta],
    como_nos_conociste: str(m["C07"]),
    respuestas: m,
    signals: calcularSignals(ruta, m, reglas),
    v: extra.v ?? null,
    mc: extra.mc ?? null,
    iniciado_at: extra.iniciado_at ?? null,
    version: def.version,
  };
}
