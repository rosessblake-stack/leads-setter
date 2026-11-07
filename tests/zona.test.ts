import { describe, expect, it } from "vitest";
import { nombreZona, zonaPersona } from "@/lib/zona";

describe("zona horaria de la persona", () => {
  it("ignora zonas vacías, inválidas o la de España", () => {
    expect(zonaPersona(null)).toBeNull();
    expect(zonaPersona("")).toBeNull();
    expect(zonaPersona("Europe/Madrid")).toBeNull();
    expect(zonaPersona("Mundo/Inventado")).toBeNull();
  });
  it("acepta una zona válida y da su nombre legible", () => {
    expect(zonaPersona("America/Montevideo")).toBe("America/Montevideo");
    expect(nombreZona("America/Buenos_Aires")).toBe("Buenos Aires");
  });
});
