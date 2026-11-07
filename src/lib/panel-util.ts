import type { Almacenada, Definicion, Ruta } from "@/formulario/tipos";

export const FASES = [
  "nuevo",
  "contactado",
  "llamada_agendada",
  "llamada_hecha",
  "no_presento",
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
  no_presento: "No se presentó",
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

export const VISTAS = ["sin_contactar", "por_enviar", "sin_agendar", "agendadas", "vendidos", "no_vendidos", "casos_exito"] as const;
export type Vista = (typeof VISTAS)[number];
export const NOMBRE_VISTA: Record<Vista, string> = {
  sin_contactar: "Sin contactar +24 h",
  por_enviar: "Por enviar",
  sin_agendar: "Sin agendar",
  agendadas: "Agendadas",
  vendidos: "Vendidos",
  no_vendidos: "No vendidos",
  casos_exito: "Casos de éxito",
};

export type Filtros = { fase: Fase | null; ruta: Ruta | null; vista: Vista | null; q: string | null; pagina: number };

// Solo se aceptan valores conocidos: lo demás se ignora.
export function leerFiltros(sp: Params): Filtros {
  const fase = uno(sp.fase);
  const ruta = uno(sp.ruta);
  const vista = uno(sp.vista);
  const q = (uno(sp.q) ?? "").trim().slice(0, 60);
  const pagina = Number.parseInt(uno(sp.pagina) ?? "1", 10);
  return {
    fase: (FASES as readonly string[]).includes(fase ?? "") ? (fase as Fase) : null,
    ruta: (RUTAS as string[]).includes(ruta ?? "") ? (ruta as Ruta) : null,
    vista: (VISTAS as readonly string[]).includes(vista ?? "") ? (vista as Vista) : null,
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

// Abre directamente el chat con esa persona en Instagram.
export function enlaceChatInstagram(usuario: string | null | undefined): string | null {
  return usuario && /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? `https://ig.me/m/${usuario}` : null;
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
// Respuestas que importan para preparar la llamada (se marcan en rojo en la ficha), en el orden en que se
// tratan en la llamada. Las «imprescindibles» no se pueden pasar por alto. Se pueden ajustar aquí.
export const ORDEN_LLAMADA: { paso: string; ids: string[] }[] = [
  { paso: "Motivo y objetivo", ids: ["C17", "N01", "S01", "S02", "A01", "A34", "A35", "E01"] },
  { paso: "Su situación y nivel", ids: ["C08", "C10", "C12", "A02", "A03", "C13", "C14", "A36"] },
  { paso: "Dolores y dificultades", ids: ["T02", "T03", "S03", "S04", "N02", "N03", "N05"] },
  { paso: "Qué quiere comprar", ids: ["C06", "F01", "F02", "F03", "N08", "N09"] },
  { paso: "Decisión, frenos y pago", ids: ["C15", "C16", "N07", "N10", "E02", "E03"] },
];
// Sin estas no se debe cerrar la llamada: qué compra, cuánto gana, quién decide, urgencia, frenos y pago.
export const IMPRESCINDIBLE_LLAMADA: ReadonlySet<string> = new Set(["C06", "C12", "C15", "C16", "N07", "E03", "A34"]);
export const CLAVE_LLAMADA: ReadonlySet<string> = new Set(ORDEN_LLAMADA.flatMap((p) => p.ids));
export const CLAVE_SIGNAL: ReadonlySet<string> = new Set(["urgencia", "quien_decide", "primer_pago_mismo_dia", "inversion_previa"]);

export type ItemRespuesta = { id: string; pregunta: string; texto: string; clave: boolean; imprescindible: boolean };

export function agruparRespuestas(
  def: Definicion,
  respuestas: Record<string, Almacenada> | null,
): { titulo: string; items: ItemRespuesta[] }[] {
  const r = respuestas ?? {};
  const grupos = new Map<string, ItemRespuesta[]>();
  for (const q of def.preguntas) {
    const a = r[q.id];
    if (!a) continue;
    const prefijo = q.id[0];
    const lista = grupos.get(prefijo) ?? [];
    lista.push({ id: q.id, pregunta: a.pregunta, texto: formatearValor(a), clave: CLAVE_LLAMADA.has(q.id), imprescindible: IMPRESCINDIBLE_LLAMADA.has(q.id) });
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
  fase_cambiada: "Cambió la fase",
  propuesta_cambiada: "Cambió el estado de la propuesta",
  reserva_cambiada: "Cambió la reserva",
  nota_anadida: "Añadiste una nota",
  caso_exito_cambiado: "Cambiaste la marca de «caso de éxito»",
  preparacion_completada: "Rellenó la preparación de la asesoría",
  recordatorio_preparacion: "Te avisé de que no había rellenado la preparación",
  resultado_registrado: "Registraste el resultado",
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

// Clasificación del contenido: tipo (para qué se hizo) y categoría (de qué trata).
export const TIPOS_VIDEO = ["autoridad", "proceso", "conexion", "vitrina", "escasez", "viralidad", "ensenanza", "reaccion"] as const;
export const NOMBRE_TIPO_VIDEO: Record<(typeof TIPOS_VIDEO)[number], string> = {
  autoridad: "Autoridad",
  proceso: "Proceso",
  conexion: "Conexión",
  vitrina: "Vitrina",
  escasez: "Escasez",
  viralidad: "Viralidad",
  ensenanza: "Enseñanza",
  reaccion: "Reacción",
};
export const CATEGORIAS_VIDEO = ["tecnica", "estructura", "formaciones", "negocio", "marca_personal", "mentalidad"] as const;
export const NOMBRE_CATEGORIA_VIDEO: Record<(typeof CATEGORIAS_VIDEO)[number], string> = {
  tecnica: "Peinado y técnica",
  estructura: "Estructura",
  formaciones: "Formaciones",
  negocio: "Negocio",
  marca_personal: "Marca personal",
  mentalidad: "Mentalidad",
};
