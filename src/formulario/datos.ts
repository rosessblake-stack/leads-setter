import definicionJson from "./preguntas.json";
import reglasJson from "./reglas-oferta.json";
import type { Definicion } from "./tipos";
import type { ReglasOferta } from "./signals";

// Los textos y opciones viven en preguntas.json; las reglas de oferta, en reglas-oferta.json.
export const definicion = definicionJson as unknown as Definicion;
export const reglasOferta = reglasJson as unknown as ReglasOferta;
