import { describe, expect, it } from "vitest";
import { esAfirmativo, leerCuerpoManychat, leerPeticionManychat, secretoValido } from "@/lib/guia";

describe("seguimiento de la guía", () => {
  it("reconoce respuestas afirmativas, con o sin tilde", () => {
    for (const t of ["Sí", "si", "Sí, me interesa", "Claro!", "quiero", "  SÍ  ", "Me interesa"]) expect(esAfirmativo(t)).toBe(true);
  });
  it("no toma por afirmativo lo que no lo es", () => {
    for (const t of ["No", "Ahora no", "no, gracias", "Siempre pensé que no", "", "tal vez más adelante"]) expect(esAfirmativo(t)).toBe(false);
  });
  it("la clave del enlace de ManyChat se compara entera y exige un mínimo de longitud", () => {
    const clave = "una-clave-larga-1234567890";
    expect(secretoValido(clave, clave)).toBe(true);
    expect(secretoValido(clave + "x", clave)).toBe(false);
    expect(secretoValido(null, clave)).toBe(false);
    expect(secretoValido("corta", "corta")).toBe(false);
    expect(secretoValido("", "")).toBe(false);
  });
});

describe("cuerpo que manda ManyChat", () => {
  it("lee JSON normal", () => {
    expect(leerCuerpoManychat('{"mc":"123","paso":"opinion","texto":"Genial"}')).toEqual({ mc: "123", paso: "opinion", texto: "Genial" });
  });
  it("rescata los campos si el texto trae comillas sin escapar", () => {
    const d = leerCuerpoManychat('{"mc":"123","paso":"aprendio","texto":"Aprendí que "cobrar" es un oficio"}');
    expect(d).toEqual({ mc: "123", paso: "aprendio", texto: 'Aprendí que "cobrar" es un oficio' });
  });
  it("devuelve null si no hay forma de leerlo", () => {
    expect(leerCuerpoManychat("basura")).toBeNull();
    expect(leerCuerpoManychat('{"mc":"1"')).toBeNull();
  });
});

describe("petición de ManyChat en varios formatos", () => {
  const vacia = new URLSearchParams();
  it("JSON, formulario y parámetros de la dirección dan lo mismo", () => {
    const esperado = { mc: "123", paso: "opinion", texto: "Genial" };
    expect(leerPeticionManychat('{"mc":"123","paso":"opinion","texto":"Genial"}', "application/json", vacia)).toEqual(esperado);
    expect(leerPeticionManychat("mc=123&paso=opinion&texto=Genial", "application/x-www-form-urlencoded", vacia)).toEqual(esperado);
    expect(leerPeticionManychat("", null, new URLSearchParams("mc=123&paso=opinion&texto=Genial"))).toEqual(esperado);
  });
  it("sin nada que leer devuelve null", () => {
    expect(leerPeticionManychat("", null, vacia)).toBeNull();
  });
});
