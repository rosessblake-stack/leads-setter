import { describe, expect, it } from "vitest";
import { esAfirmativo, secretoValido } from "@/lib/guia";

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
