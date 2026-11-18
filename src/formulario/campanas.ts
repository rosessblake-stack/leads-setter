import type { Ruta } from "./tipos";

// Campañas: un código en el enlace del formulario (?v=…) puede fijar la ruta (así no se pregunta «¿Qué te interesa?»),
// poner textos propios y ofrecer un regalo en la pantalla final. Para una campaña nueva, se añade aquí.
export type Campana = {
  ruta: Ruta;
  // Cómo se llama en la página Vídeos y qué ve Claude al analizar la ficha.
  descripcion: string;
  bienvenida?: { titulo: string; texto: string };
  // Regalo para la pantalla final. Si no hay url, solo sale el texto de agradecimiento normal.
  regalo?: { titulo: string; boton: string; url: string };
};

export const CAMPANAS: Record<string, Campana> = {
  "cobrar-historia-01": {
    ruta: "asesoria",
    descripcion:
      "Historia de Instagram: ¿te ha pasado presupuestar un servicio en 50 € y darte cuenta después de que tenías que cobrar 70 €? Regalo: PDF sobre cómo cobrar lo que vale tu trabajo.",
    bienvenida: {
      titulo: "Cómo cobrar lo que vale tu trabajo",
      texto:
        "Responde unas preguntas rápidas y, al terminar, te paso el PDF. Así te conozco un poco y puedo ayudarte mejor con tus precios.",
    },
    regalo: { titulo: "Aquí tienes tu guía", boton: "Descargar la guía", url: "/guia-cobrar-y-datos.pdf" },
  },
};

// «Historia» si viene de una campaña de historia; «Vídeo» si viene de un reel o vídeo.
export function etiquetaOrigen(codigo: string | null | undefined, formato?: string | null): string {
  return formato === "historia" || campanaDe(codigo) ? "Historia" : "Vídeo";
}

export function campanaDe(codigo: string | null | undefined): Campana | null {
  return codigo && Object.prototype.hasOwnProperty.call(CAMPANAS, codigo) ? CAMPANAS[codigo] : null;
}
