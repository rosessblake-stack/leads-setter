import { describe, expect, it } from "vitest";
import { respuestaGenerica, textoAceptable } from "@/lib/respuesta-personal";
import { esAfirmativo, esNegativo, leerCuerpoManychat, leerPeticionManychat, respuestasDe, secretoValido } from "@/lib/guia";

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
    const esperado = { mc: "123", paso: "opinion", texto: "Genial", leyo: undefined, problema: undefined, opinion: undefined, aprendio: undefined, asesoria: undefined, motivo: undefined };
    expect(leerPeticionManychat('{"mc":"123","paso":"opinion","texto":"Genial"}', "application/json", vacia)).toEqual(esperado);
    expect(leerPeticionManychat("mc=123&paso=opinion&texto=Genial", "application/x-www-form-urlencoded", vacia)).toEqual(esperado);
    expect(leerPeticionManychat("", null, new URLSearchParams("mc=123&paso=opinion&texto=Genial"))).toEqual(esperado);
  });
  it("sin nada que leer devuelve null", () => {
    expect(leerPeticionManychat("", null, vacia)).toBeNull();
  });
});

describe("varias respuestas en una sola petición", () => {
  it("saca las que vengan rellenas, en orden", () => {
    const d = leerPeticionManychat('{"mc":"1","opinion":"Genial","aprendio":"","asesoria":"Sí, me interesa"}', "application/json", new URLSearchParams())!;
    expect(respuestasDe(d)).toEqual([
      { paso: "opinion", texto: "Genial" },
      { paso: "asesoria", texto: "Sí, me interesa" },
    ]);
  });
  it("un solo paso sigue funcionando", () => {
    const d = leerPeticionManychat('{"mc":"1","paso":"aprendio","texto":"Mucho"}', "application/json", new URLSearchParams())!;
    expect(respuestasDe(d)).toEqual([{ paso: "aprendio", texto: "Mucho" }]);
  });
});

describe("pasos nuevos: pudo abrir la guía", () => {
  it("«leyo» y «problema» se reconocen y van primero", () => {
    const d = leerPeticionManychat('{"mc":"1","leyo":"No","problema":"No me abre el PDF","opinion":""}', "application/json", new URLSearchParams())!;
    expect(respuestasDe(d)).toEqual([
      { paso: "leyo", texto: "No" },
      { paso: "problema", texto: "No me abre el PDF" },
    ]);
  });
});

describe("«no» claro a la asesoría", () => {
  it("solo un no claro cuenta", () => {
    for (const t of ["No", "no", " NO ", "No.", "no gracias", "No, gracias", "No quiero"]) expect(esNegativo(t)).toBe(true);
    for (const t of ["Ahora no", "Sí", "no sé", "no, pero quizá más adelante", "tal vez", ""]) expect(esNegativo(t)).toBe(false);
  });
});

describe("respuesta personal del seguimiento", () => {
  it("el texto genérico agradece y nombra los temas marcados", () => {
    const t = respuestaGenerica("Ana López", ["precios", "marca personal"]);
    expect(t).toContain("Ana");
    expect(t).toContain("precios y marca personal");
    expect(textoAceptable(t)).toBe(true);
  });
  it("rechaza textos con enlaces, dinero o que hablan de asesoría", () => {
    expect(textoAceptable("Gracias por contármelo, me alegra que te haya servido la guía.")).toBe(true);
    expect(textoAceptable("Gracias, entra en https://x.com y mira esto con calma por favor.")).toBe(false);
    expect(textoAceptable("Gracias por contármelo, la asesoría cuesta 100 € y te ayudará mucho.")).toBe(false);
    expect(textoAceptable("Hola")).toBe(false);
  });
});

describe("una sola respuesta de valoración", () => {
  it("se lee como un paso más", () => {
    expect(respuestasDe({ mc: "1", valoracion: "Me encantó y aprendí mucho" })).toEqual([{ paso: "valoracion", texto: "Me encantó y aprendí mucho" }]);
  });
});
