import { describe, expect, it } from "vitest";
import {
  aCentimos,
  leerFaseManual,
  leerNota,
  leerPropuesta,
  leerReserva,
  leerResultado,
} from "@/lib/seguimiento-util";

const form = (o: Record<string, string>) => (k: string) => o[k] ?? null;

describe("importe", () => {
  it("entiende los formatos habituales y devuelve céntimos", () => {
    expect(aCentimos("2000")).toBe(200000);
    expect(aCentimos("2.000")).toBe(200000);
    expect(aCentimos("1.200,50")).toBe(120050);
    expect(aCentimos("99,9")).toBe(9990);
    expect(aCentimos("100.50")).toBe(10050);
    expect(aCentimos("2000 €")).toBe(200000);
    expect(aCentimos("0")).toBe(0);
  });
  it("rechaza lo que no es un importe", () => {
    expect(aCentimos("abc")).toBeNaN();
    expect(aCentimos("-5")).toBeNaN();
    expect(aCentimos("1,234,5")).toBeNaN();
    expect(aCentimos("100001")).toBeNaN();
    expect(aCentimos("")).toBeNull();
  });
});

describe("lectura de formularios del seguimiento", () => {
  it("fase: solo las que se mueven con botón", () => {
    expect(leerFaseManual("contactado")).toEqual({ ok: true, valor: "contactado" });
    expect(leerFaseManual("vendido").ok).toBe(false);
    expect(leerFaseManual("x'; drop").ok).toBe(false);
  });
  it("propuesta", () => {
    expect(leerPropuesta("manual").ok).toBe(true);
    expect(leerPropuesta("otra").ok).toBe(false);
  });
  it("reserva: fecha válida, vacía o error", () => {
    expect(leerReserva("2026-11-12T18:30")).toEqual({ ok: true, valor: "2026-11-12T18:30" });
    expect(leerReserva("")).toEqual({ ok: true, valor: null });
    expect(leerReserva("12/11/2026").ok).toBe(false);
    expect(leerReserva("2026-13-45T99:99").ok).toBe(false);
  });
  it("nota", () => {
    expect(leerNota("  hola ")).toEqual({ ok: true, valor: "hola" });
    expect(leerNota("   ").ok).toBe(false);
    expect(leerNota("x".repeat(2001)).ok).toBe(false);
  });
  it("resultado vendido exige producto y valida el importe", () => {
    const ok = leerResultado(form({ resultado: "vendido", producto: "presencial", importe: "2.000", forma_pago: "stripe", edicion: "Noviembre" }));
    expect(ok).toEqual({
      ok: true,
      valor: { resultado: "vendido", producto: "presencial", importe_cents: 200000, forma_pago: "stripe", edicion: "Noviembre", nota: null },
    });
    expect(leerResultado(form({ resultado: "vendido" })).ok).toBe(false);
    expect(leerResultado(form({ resultado: "vendido", producto: "online", importe: "mucho" })).ok).toBe(false);
    expect(leerResultado(form({ resultado: "vendido", producto: "online", forma_pago: "bizum" })).ok).toBe(false);
    expect(leerResultado(form({ resultado: "vendido", producto: "online" }))).toMatchObject({ ok: true, valor: { importe_cents: null, forma_pago: null } });
  });
  it("resultado no vendido exige motivo", () => {
    expect(leerResultado(form({ resultado: "no_vendido", motivo: "precio", nota: "dijo que caro" }))).toEqual({
      ok: true,
      valor: { resultado: "no_vendido", motivo: "precio", nota: "dijo que caro" },
    });
    expect(leerResultado(form({ resultado: "no_vendido" })).ok).toBe(false);
    expect(leerResultado(form({ resultado: "otra" })).ok).toBe(false);
    expect(leerResultado(form({ resultado: "no_vendido", motivo: "precio", nota: "x".repeat(501) })).ok).toBe(false);
  });
});
