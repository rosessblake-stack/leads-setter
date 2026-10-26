import { describe, expect, it } from "vitest";
import { esAdmin, formatearEstado, parsearComando } from "@/lib/comandos";

describe("parsearComando", () => {
  it("reconoce comandos y el sufijo @bot", () => {
    expect(parsearComando("/estado")).toBe("estado");
    expect(parsearComando("/estado@blakeleads_bot")).toBe("estado");
    expect(parsearComando("  /LEADS ")).toBe("leads");
    expect(parsearComando("/start")).toBe("ayuda");
    expect(parsearComando("/ayuda")).toBe("ayuda");
  });

  it("ignora texto normal y comandos desconocidos", () => {
    expect(parsearComando("hola")).toBeNull();
    expect(parsearComando("/borrar_todo")).toBeNull();
    expect(parsearComando(undefined)).toBeNull();
    expect(parsearComando("dime /estado")).toBeNull();
  });
});

describe("esAdmin", () => {
  it("solo acepta el chat configurado", () => {
    expect(esAdmin(8786973653, "8786973653")).toBe(true);
    expect(esAdmin("8786973653", "8786973653")).toBe(true);
    expect(esAdmin(123, "8786973653")).toBe(false);
    expect(esAdmin(8786973653, undefined)).toBe(false);
    expect(esAdmin(undefined, "8786973653")).toBe(false);
  });
});

describe("formatearEstado", () => {
  it("marca lo que falla", () => {
    const t = formatearEstado({
      baseDatos: false,
      claveClaude: true,
      regalo: false,
      ultimas24h: 2,
      sinAvisar: 1,
      ultimo: null,
    });
    expect(t).toContain("❌ Base de datos");
    expect(t).toContain("✅ Clave de Claude");
    expect(t).toContain("sin configurar");
    expect(t).toContain("Fichas sin aviso enviado: 1");
  });
});
