import { beforeAll, describe, expect, it } from "vitest";
import { esTokenHistorico, tokenHistorico } from "@/lib/historico";
import { leerExito } from "@/lib/seguimiento-util";

describe("enlace para clientes anteriores", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  });
  it("el código es siempre el mismo, largo y apto para un enlace", () => {
    const t = tokenHistorico();
    expect(t).toBe(tokenHistorico());
    expect(t).toMatch(/^[A-Za-z0-9_-]{40,64}$/);
  });
  it("solo vale el código exacto", () => {
    expect(esTokenHistorico(tokenHistorico())).toBe(true);
    expect(esTokenHistorico(tokenHistorico().slice(0, -1) + "x")).toBe(false);
    expect(esTokenHistorico("")).toBe(false);
    expect(esTokenHistorico(undefined)).toBe(false);
    expect(esTokenHistorico("a".repeat(43))).toBe(false);
  });
  it("con otra clave, el código es otro", () => {
    const antes = tokenHistorico();
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    expect(tokenHistorico()).not.toBe(antes);
    expect(esTokenHistorico(antes)).toBe(false);
  });
  it("sin clave no se puede generar y no valida nada", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => tokenHistorico()).toThrow(/ENCRYPTION_KEY/);
    expect(esTokenHistorico("a".repeat(43))).toBe(false);
  });
});

describe("caso de éxito", () => {
  const get = (m: Record<string, string>) => (k: string) => m[k] ?? null;
  it("marcado o no, con nota opcional", () => {
    expect(leerExito(get({ exito: "1", nota_exito: " Compró a la primera " }))).toEqual({ ok: true, valor: { exito: true, nota: "Compró a la primera" } });
    expect(leerExito(get({}))).toEqual({ ok: true, valor: { exito: false, nota: null } });
  });
  it("rechaza una nota demasiado larga", () => {
    expect(leerExito(get({ nota_exito: "x".repeat(1001) })).ok).toBe(false);
  });
});
