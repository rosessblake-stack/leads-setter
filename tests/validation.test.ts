import { describe, expect, it } from "vitest";
import { PayloadSchema } from "@/lib/validation";

const valido = {
  respuestas: { C01: "Ana" },
  iniciado_at: "2026-10-26T10:00:00.000Z",
  zona_horaria: "Europe/Madrid",
  consentimiento: true,
  v: "reel-042",
  mc: "123456",
};

describe("PayloadSchema", () => {
  it("acepta un envío válido", () => {
    expect(PayloadSchema.safeParse(valido).success).toBe(true);
  });
  it("exige el consentimiento", () => {
    expect(PayloadSchema.safeParse({ ...valido, consentimiento: false }).success).toBe(false);
    const { consentimiento, ...sin } = valido;
    void consentimiento;
    expect(PayloadSchema.safeParse(sin).success).toBe(false);
  });
  it("rechaza identificadores de vídeo o ManyChat con caracteres raros", () => {
    expect(PayloadSchema.safeParse({ ...valido, v: "a b; drop" }).success).toBe(false);
    expect(PayloadSchema.safeParse({ ...valido, mc: "x'y" }).success).toBe(false);
  });
  it("rechaza zonas horarias y fechas raras", () => {
    expect(PayloadSchema.safeParse({ ...valido, zona_horaria: "Europe/Madrid; x" }).success).toBe(false);
    expect(PayloadSchema.safeParse({ ...valido, iniciado_at: "ayer" }).success).toBe(false);
  });
  it("el campo trampa debe ir vacío", () => {
    expect(PayloadSchema.safeParse({ ...valido, web: "http://spam" }).success).toBe(false);
  });
});
