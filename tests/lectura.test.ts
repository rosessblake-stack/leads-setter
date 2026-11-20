import { describe, expect, it } from "vitest";
import { leerCargaLectura, pasoDiapositiva, resumirLectura, textoTiempo } from "@/lib/lectura";

const S = "d762d713-5ac4-4e0c-984c-c10771a8270a";

describe("carga del visor de la guía", () => {
  it("acepta una carga válida y descarta las diapositivas sin tiempo", () => {
    const c = leerCargaLectura(JSON.stringify({ s: S, c: "cobrar-historia-01", t: [[1, 12], [2, 0], [3, 40.4]], fin: true, clic: false }));
    expect(c).toEqual({ s: S, c: "cobrar-historia-01", t: [[1, 12], [3, 40]], fin: true, clic: false });
  });
  it("rechaza sesiones, diapositivas y cuerpos no válidos", () => {
    expect(leerCargaLectura("no es json")).toBeNull();
    expect(leerCargaLectura(JSON.stringify({ s: "corta", c: "", t: [] }))).toBeNull();
    expect(leerCargaLectura(JSON.stringify({ s: S, c: "", t: [[99, 5]] }))).toBeNull();
    expect(leerCargaLectura(JSON.stringify({ s: S, c: "", t: [[1]] }))).toBeNull();
    expect(leerCargaLectura("x".repeat(4000))).toBeNull();
  });
  it("limita los segundos de una diapositiva", () => {
    expect(leerCargaLectura(JSON.stringify({ s: S, c: "", t: [[1, 99999]] }))?.t).toEqual([[1, 600]]);
  });
  it("nombra las diapositivas con dos cifras", () => {
    expect(pasoDiapositiva(3)).toBe("leer_03");
    expect(pasoDiapositiva(23)).toBe("leer_23");
  });
});

describe("resumen de la lectura", () => {
  it("sin datos no hay resumen", () => expect(resumirLectura([{ paso: "bienvenida", indice: 0 }])).toBeNull());
  it("calcula cuánto ve y dónde se detiene", () => {
    const r = resumirLectura([
      { paso: "leer_ini", indice: 0 },
      { paso: "leer_01", indice: 10 },
      { paso: "leer_02", indice: 95 },
      { paso: "leer_07", indice: 30 },
      { paso: "leer_fin", indice: 0 },
    ]);
    expect(r).toMatchObject({ vistas: 3, llego: 7, segundos: 135, masTiempo: { n: 2, segundos: 95 }, final: true, clic: false });
  });
  it("da el tiempo en texto", () => {
    expect(textoTiempo(45)).toBe("45 s");
    expect(textoTiempo(120)).toBe("2 min");
    expect(textoTiempo(135)).toBe("2 min 15 s");
  });
});
