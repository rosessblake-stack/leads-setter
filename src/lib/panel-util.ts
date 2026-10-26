import type { Almacenada, Definicion, Ruta } from "@/formulario/tipos";

export const FASES = [
  "nuevo",
  "contactado",
  "llamada_agendada",
  "llamada_hecha",
  "pago_pendiente",
  "vendido",
  "no_vendido",
  "descartado",
  "en_pausa",
] as const;
export type Fase = (typeof FASES)[number];

export const NOMBRE_FASE: Record<Fase, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  llamada_agendada: "Llamada agendada",
  llamada_hecha: "Llamada hecha",
  pago_pendiente: "Pago pendiente",
  vendido: "Vendido",
  no_vendido: "No vendido",
  descartado: "Descartado",
  en_pausa: "En pausa",
};

export const RUTAS: Ruta[] = ["presencial", "online", "asesoria", "no_claro"];
export const NOMBRE_RUTA: Record<Ruta, string> = {
  presencial: "Presencial",
  online: "Online",
  asesoria: "Asesoría 1:1",
  no_claro: "No lo tiene claro",
};

export const POR_PAGINA = 30;

type Params = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export type Filtros = { fase: Fase | null; ruta: Ruta | null; q: string | null; pagina: number };

// Solo se aceptan valores conocidos: lo demás se ignora.
export function leerFiltros(sp: Params): Filtros {
  const fase = uno(sp.fase);
  const ruta = uno(sp.ruta);
  const q = (uno(sp.q) ?? "").trim().slice(0, 60);
  const pagina = Number.parseInt(uno(sp.pagina) ?? "1", 10);
  return {
    fase: (FASES as readonly string[]).includes(fase ?? "") ? (fase as Fase) : null,
    ruta: (RUTAS as string[]).includes(ruta ?? "") ? (ruta as Ruta) : null,
    q: q === "" ? null : q,
    pagina: Number.isFinite(pagina) && pagina >= 1 && pagina <= 1000 ? pagina : 1,
  };
}

// Para ILIKE: escapa los comodines que escriba la persona.
export function patronBusqueda(q: string): string {
  return "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
}

export function enlaceWhatsApp(tel: string | null | undefined): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  return d.length >= 7 && d.length <= 15 ? `https://wa.me/${d}` : null;
}

export function enlaceInstagram(usuario: string | null | undefined): string | null {
  return usuario && /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? `https://instagram.com/${usuario}` : null;
}

// Solo http(s). Lo que escribe una persona nunca se convierte en un enlace de otro tipo.
export function urlSegura(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t || /\s/.test(t)) return null;
  const candidato = /^https?:\/\//i.test(t) ? t : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) ? "https://" + t : null;
  if (!candidato) return null;
  try {
    const u = new URL(candidato);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function formatearValor(a: Almacenada): string {
  const v = a.valor;
  let t: string;
  if (Array.isArray(v)) t = v.join(", ");
  else if (typeof v === "boolean") t = v ? "Sí" : "No";
  else if (v && typeof v === "object") t = Object.entries(v).map(([k, x]) => `${k}: ${x}`).join(" · ");
  else t = String(v);
  return a.extra !== undefined && a.extra !== "" ? `${t} (${a.extra})` : t;
}

const MODULOS: { prefijo: string; titulo: string }[] = [
  { prefijo: "C", titulo: "Datos y contexto" },
  { prefijo: "F", titulo: "Formación presencial" },
  { prefijo: "T", titulo: "Técnica" },
  { prefijo: "S", titulo: "Sobre ella o él" },
  { prefijo: "V", titulo: "Servicio y contenido" },
  { prefijo: "N", titulo: "Orientación" },
  { prefijo: "B", titulo: "Negocio y precios" },
  { prefijo: "E", titulo: "Cierre" },
  { prefijo: "A", titulo: "Asesoría 1:1" },
];

// Respuestas ordenadas como en el formulario y agrupadas por bloque.
export function agruparRespuestas(
  def: Definicion,
  respuestas: Record<string, Almacenada> | null,
): { titulo: string; items: { id: string; pregunta: string; texto: string }[] }[] {
  const r = respuestas ?? {};
  const grupos = new Map<string, { id: string; pregunta: string; texto: string }[]>();
  for (const q of def.preguntas) {
    const a = r[q.id];
    if (!a) continue;
    const prefijo = q.id[0];
    const lista = grupos.get(prefijo) ?? [];
    lista.push({ id: q.id, pregunta: a.pregunta, texto: formatearValor(a) });
    grupos.set(prefijo, lista);
  }
  return MODULOS.filter((m) => grupos.has(m.prefijo)).map((m) => ({ titulo: m.titulo, items: grupos.get(m.prefijo)! }));
}

export function fechaCorta(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const f = typeof d === "string" ? new Date(d) : d;
  return f.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });
}

export const ETIQUETA_EVENTO: Record<string, string> = {
  formulario_enviado: "Rellenó el formulario",
  ficha_analizada: "Claude analizó la ficha",
};

export const ETIQUETA_SIGNAL: Record<string, string> = {
  urgencia: "Urgencia",
  quien_decide: "Quién decide",
  primer_pago_mismo_dia: "Primer pago el mismo día",
  ingresos_mensuales: "Ingresos al mes",
  inversion_previa: "Inversión previa",
  experiencia: "Experiencia",
  clientes_mes: "Clientes al mes",
  sugerencia_oferta: "Sugerencia por sus respuestas",
};
