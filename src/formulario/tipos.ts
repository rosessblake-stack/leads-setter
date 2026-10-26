export type Ruta = "presencial" | "online" | "asesoria" | "no_claro";

export type TipoPregunta =
  | "texto"
  | "email"
  | "telefono"
  | "texto_largo"
  | "eleccion"
  | "multi"
  | "escala"
  | "sino"
  | "numero"
  | "dos_numeros"
  | "casilla";

// La pregunta aparece solo si se cumple la condición sobre otra respuesta.
export type Condicion = {
  pregunta: string;
  es?: string;
  noEs?: string;
  incluye?: string;
  noIncluye?: string;
};

// Campo adicional ligado a una elección. Sin "cuando", aparece siempre.
export type Extra = {
  cuando?: string;
  etiqueta: string;
  tipo: "texto" | "numero";
  obligatoria?: boolean;
};

export type Pregunta = {
  id: string;
  texto: string;
  tipo: TipoPregunta;
  obligatoria?: boolean;
  // "__pendiente__" = las opciones aún no están confirmadas: se pide como texto libre.
  opciones?: string[] | "__pendiente__";
  maxSelecciones?: number;
  maxCaracteres?: number;
  excluyentes?: string[];
  escala?: { min: number; max: number };
  campos?: { id: string; etiqueta: string }[];
  extra?: Extra;
  rutas?: Ruta[];
  si?: Condicion;
};

export type Definicion = {
  version: string;
  bienvenida: { titulo: string; texto: string };
  // Texto de la pantalla final. Admite {nombre} (", Ana") y {canal} (WhatsApp o Instagram).
  final: { texto: string; rutas?: Partial<Record<Ruta, string>> };
  pregunta_de_ruta: string;
  rutas: Record<string, Ruta>;
  preguntas: Pregunta[];
};

// Respuestas tal cual las maneja el formulario. Los campos "extra" se guardan
// con la clave "<ID>__extra" y las parejas de números como objeto { campo: texto }.
export type Respuestas = Record<string, unknown>;

export type Almacenada = {
  pregunta: string;
  valor: string | string[] | number | boolean | Record<string, number>;
  extra?: string | number;
};
