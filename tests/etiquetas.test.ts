import { describe, expect, it } from "vitest";
import { etiquetaLlamada, tituloLlamada } from "@/lib/etiquetas";

describe("título y color de la llamada", () => {
  it("cada tipo tiene su color y no usa los de trenzas (uva 3, banana 5), eventos ni colaboraciones", () => {
    const colores = [
      etiquetaLlamada("venta", "presencial").colorId,
      etiquetaLlamada("venta", "online").colorId,
      etiquetaLlamada("asesoria", "asesoria").colorId,
      etiquetaLlamada("venta", "no_claro").colorId,
    ];
    expect(new Set(colores).size).toBe(4);
    expect(colores.some((c) => ["3", "5", "11", "4"].includes(c))).toBe(false);
  });
  it("título con el nombre de pila, como lo escribe Blake", () => {
    expect(tituloLlamada("venta", "presencial", "Matteo Di Ienno")).toBe("Venta formación Matteo");
    expect(tituloLlamada("venta", "online", "Tania")).toBe("Venta curso Tania");
    expect(tituloLlamada("asesoria", "asesoria", "  Osvaldo  Pérez")).toBe("Asesoría Osvaldo");
    expect(tituloLlamada("venta", "no_claro", "Ana")).toBe("Orientación Ana");
    expect(tituloLlamada("venta", null, "Ana")).toBe("Orientación Ana");
  });
});
