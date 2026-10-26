import { definicion, reglasOferta } from "@/formulario/datos";
import { validarTodo } from "@/formulario/motor";
import { construirSolicitud } from "@/formulario/solicitud";
import type { Respuestas } from "@/formulario/tipos";

export const respuestasNoClaro: Respuestas = {
  C01: "Ana Pérez",
  C02: "Ana@Ejemplo.com",
  C03: "@ana.trenzas",
  C04: "https://instagram.com/ana.trenzas",
  C05: "Madrid, España",
  C06: "No lo tengo claro, quiero que me orientes",
  C07: "TikTok",
  C08: "1–3 años",
  C10: "1–5",
  C11: "Trenzo y estudio",
  C12: "500–1.000 €",
  C13: ["Nunca"],
  C15: 7,
  C16: "La decido yo",
  N01: "Cobrar mejor",
  N05: "Mejorar mi técnica",
  N06: "En persona con corrección directa",
  B01: "Sola/o en casa",
  B03: { precio: "60", horas: "4" },
  B04: "Por intuición",
  B05: "Dudo",
};

export function solicitudDePrueba(cambios: Respuestas = {}, extra: { v?: string; mc?: string } = {}) {
  const v = validarTodo(definicion, { ...respuestasNoClaro, ...cambios });
  if (!v.ok) throw new Error("Respuestas de prueba no válidas: " + JSON.stringify(v.errores));
  return construirSolicitud(definicion, reglasOferta, v, { zona_horaria: "Europe/Madrid", ...extra });
}
