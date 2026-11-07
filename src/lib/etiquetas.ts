// Título y color de cada llamada en el calendario de Blake. Los colores son los clásicos de Google (la API no permite
// asignar las etiquetas con nombre): se eligen los más parecidos a sus etiquetas y se evitan los que ya usa para trenzas
// (uva), citas sin reserva, eventos y colaboraciones.
export type TipoLlamada = "venta" | "asesoria";

export type Etiqueta = { nombre: string; titulo: string; colorId: string };

const ETIQUETAS: Record<"presencial" | "online" | "asesoria" | "orientacion", Etiqueta> = {
  presencial: { nombre: "Venta formación presencial", titulo: "Venta formación", colorId: "1" }, // lavanda
  online: { nombre: "Venta curso online", titulo: "Venta curso", colorId: "2" }, // verde salvia
  asesoria: { nombre: "Asesoría", titulo: "Asesoría", colorId: "10" }, // verde albahaca
  orientacion: { nombre: "Llamada orientación", titulo: "Orientación", colorId: "8" }, // grafito
};

export function etiquetaLlamada(tipo: TipoLlamada, ruta: string | null): Etiqueta {
  if (tipo === "asesoria") return ETIQUETAS.asesoria;
  if (ruta === "presencial") return ETIQUETAS.presencial;
  if (ruta === "online") return ETIQUETAS.online;
  return ETIQUETAS.orientacion;
}

// «Venta formación Matteo»: el nombre de pila, como lo escribe Blake a mano.
export function tituloLlamada(tipo: TipoLlamada, ruta: string | null, nombre: string): string {
  const pila = nombre.trim().split(/\s+/)[0] || nombre.trim();
  return `${etiquetaLlamada(tipo, ruta).titulo} ${pila}`;
}
