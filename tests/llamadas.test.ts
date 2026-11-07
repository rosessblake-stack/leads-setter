import { describe, expect, it } from "vitest";
import { faseTrasLlamada, normalizarLlamada, textoNota } from "@/lib/llamadas";

const base = {
  resultado: "posible_cierre" as const,
  resumen: "Quiere la presencial; confirma el domingo.",
  acordado: "Presencial de 3 días; parte en cuotas y parte en efectivo.",
  proximo_paso: "Blake llama el domingo 8 y propone una señal.",
  fecha_seguimiento: "2026-11-08",
  bien: ["Preguntó el motivo"],
  mejorar: ["Explorar el dinero antes del precio"],
  falto: ["Urgencia"],
  objeciones: ["Dinero"],
  contraste_formulario: "Coincide con el formulario.",
  puntuacion: 65,
  motivo_puntuacion: "Eligió presencial con claridad.",
};
const hoy = new Date("2026-11-03T15:00:00Z");

describe("análisis de la llamada", () => {
  it("acepta una fecha de seguimiento próxima y descarta las inválidas o lejanas", () => {
    expect(normalizarLlamada(base, hoy).fecha_seguimiento).toBe("2026-11-08");
    expect(normalizarLlamada({ ...base, fecha_seguimiento: "2027-06-01" }, hoy).fecha_seguimiento).toBeNull();
    expect(normalizarLlamada({ ...base, fecha_seguimiento: "2026-10-01" }, hoy).fecha_seguimiento).toBeNull();
    expect(normalizarLlamada({ ...base, fecha_seguimiento: "mañana" }, hoy).fecha_seguimiento).toBeNull();
    expect(normalizarLlamada({ ...base, fecha_seguimiento: null }, hoy).fecha_seguimiento).toBeNull();
  });
  it("limita la probabilidad a 0-100 y las listas a 5 puntos", () => {
    const a = normalizarLlamada({ ...base, puntuacion: 140.4, bien: Array(9).fill("x") }, hoy);
    expect(a.puntuacion).toBe(100);
    expect(a.bien.length).toBe(5);
    expect(normalizarLlamada({ ...base, puntuacion: -5 }, hoy).puntuacion).toBe(0);
  });
  it("la fase solo avanza hasta «llamada hecha» y nunca toca ventas ni pagos", () => {
    expect(faseTrasLlamada("llamada_agendada", "posible_cierre")).toBe("llamada_hecha");
    expect(faseTrasLlamada("contactado", "no_interesa")).toBe("llamada_hecha");
    expect(faseTrasLlamada("llamada_agendada", "no_celebrada")).toBeNull();
    for (const f of ["vendido", "no_vendido", "pago_pendiente", "descartado", "llamada_hecha", "en_pausa"]) {
      expect(faseTrasLlamada(f, "cerrada")).toBeNull();
    }
  });
  it("la nota recoge resultado, probabilidad y puntos", () => {
    const t = textoNota(normalizarLlamada(base, hoy), 55);
    expect(t).toContain("Posible cierre");
    expect(t).toContain("55 % → 65 %");
    expect(t).toContain("Explorar el dinero antes del precio");
  });
});
