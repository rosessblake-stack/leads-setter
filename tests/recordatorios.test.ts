import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// El comportamiento con base de datos se comprueba en las pruebas de extremo a extremo; aquí, que el temporizador lo llama.
describe("recordatorio de preparación", () => {
  it("el temporizador lo ejecuta y tolera que falle", () => {
    const ruta = readFileSync("src/app/api/propuestas/procesar/route.ts", "utf8");
    expect(ruta).toContain("recordarPreparaciones()");
    expect(ruta).toMatch(/recordarPreparaciones\(\)\.catch/);
  });
});
