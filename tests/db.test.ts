import { describe, expect, it, vi } from "vitest";
import { intentar } from "@/lib/db";

describe("intentar: consultas con límite de tiempo", () => {
  it("devuelve el resultado normal sin esperar", async () => {
    expect(await intentar(async () => "ok", { ms: 200 })).toBe("ok");
  });

  it("si la primera consulta se cuelga, descarta y reintenta con éxito", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let llamadas = 0;
    const r = await intentar(
      () => {
        llamadas += 1;
        return llamadas === 1 ? new Promise<string>(() => undefined) : Promise.resolve("recuperado");
      },
      { ms: 40, reintentos: 1 },
    );
    expect(r).toBe("recuperado");
    expect(llamadas).toBe(2);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it("si se cuelga siempre, falla con un error claro en lugar de esperar para siempre", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const t0 = Date.now();
    await expect(intentar(() => new Promise<string>(() => undefined), { ms: 30, reintentos: 1 })).rejects.toThrow(/tardó demasiado/);
    expect(Date.now() - t0).toBeLessThan(1000);
    aviso.mockRestore();
  });

  it("los errores normales no se reintentan", async () => {
    let llamadas = 0;
    await expect(
      intentar(async () => {
        llamadas += 1;
        throw new Error("fallo de verdad");
      }, { ms: 200 }),
    ).rejects.toThrow("fallo de verdad");
    expect(llamadas).toBe(1);
  });
});
