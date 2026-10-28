import { describe, expect, it } from "vitest";
import { REGLAS, huecosDelDia, madridAUtc, partesMadrid, proponer } from "@/lib/disponibilidad";

const h = (y: number, m: number, d: number, hh: number, mm = 0) => madridAUtc(y, m, d, hh, mm);
const hora = (t: Date) => {
  const p = partesMadrid(t);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
};

describe("hora de España", () => {
  it("convierte con horario de invierno y de verano", () => {
    expect(h(2026, 11, 12, 18, 30).toISOString()).toBe("2026-11-12T17:30:00.000Z");
    expect(h(2026, 7, 15, 10, 0).toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });
  it("funciona el día del cambio de hora", () => {
    expect(h(2026, 10, 25, 11, 0).toISOString()).toBe("2026-10-25T10:00:00.000Z"); // ya en invierno
    expect(h(2026, 3, 29, 11, 0).toISOString()).toBe("2026-03-29T09:00:00.000Z"); // ya en verano
  });
});

describe("huecos de un día", () => {
  const antes = new Date("2026-01-01T00:00:00Z");
  it("sin eventos: de 11:00 a 22:00, de 30 en 30 min", () => {
    const v = huecosDelDia(2026, 11, 2, "venta", [], antes);
    expect(hora(v[0].inicio)).toBe("11:00");
    expect(hora(v[v.length - 1].inicio)).toBe("21:30"); // acaba a las 22:00
    const a = huecosDelDia(2026, 11, 2, "asesoria", [], antes);
    expect(hora(a[a.length - 1].inicio)).toBe("21:00"); // 1 hora: acaba a las 22:00
  });
  it("deja 1 hora de margen antes y después de cada evento", () => {
    const ev = [{ inicio: h(2026, 11, 2, 15, 0), fin: h(2026, 11, 2, 16, 0) }];
    const horas = huecosDelDia(2026, 11, 2, "venta", ev, antes).map((x) => hora(x.inicio));
    expect(horas).toContain("13:30"); // termina a las 14:00, justo con 1 h de margen
    expect(horas).not.toContain("14:00");
    expect(horas).not.toContain("16:30");
    expect(horas).toContain("17:00");
  });
  it("la asesoría (1 h) necesita que quepa entera con su margen", () => {
    const ev = [{ inicio: h(2026, 11, 2, 15, 0), fin: h(2026, 11, 2, 16, 0) }];
    const horas = huecosDelDia(2026, 11, 2, "asesoria", ev, antes).map((x) => hora(x.inicio));
    expect(horas).toContain("13:00"); // 13:00-14:00, margen hasta 15:00
    expect(horas).not.toContain("13:30");
  });
  it("no ofrece horas pasadas", () => {
    const v = huecosDelDia(2026, 11, 2, "venta", [], h(2026, 11, 2, 18, 10));
    expect(hora(v[0].inicio)).toBe("18:30");
  });
});

describe("propuesta de días", () => {
  it("venta: de mañana a 3 días, y prefiere domingo y lunes", () => {
    // Jueves 29 oct 2026: ventana = viernes 30, sábado 31, domingo 1 nov (los 3 días)
    const p = proponer("venta", [], h(2026, 10, 29, 12, 0));
    expect(p.dias.map((d) => d.fecha)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(p.dias.find((d) => d.fecha === "2026-11-01")?.preferido).toBe(true);
  });
  it("venta: si un día está lleno, se queda con los que tienen hueco", () => {
    const lleno = [{ inicio: h(2026, 10, 30, 10, 0), fin: h(2026, 10, 30, 23, 0) }];
    const p = proponer("venta", lleno, h(2026, 10, 29, 12, 0));
    expect(p.dias.map((d) => d.fecha)).toEqual(["2026-10-31", "2026-11-01"]);
  });
  it("avisa cuando no hay ningún hueco", () => {
    const todo = [{ inicio: h(2026, 10, 29, 0, 0), fin: h(2026, 11, 5, 0, 0) }];
    expect(proponer("venta", todo, h(2026, 10, 29, 12, 0)).sinHueco).toBe(true);
  });
  it("asesoría: no antes de una semana después del pago, y elige 3 días con preferencia dom/lun", () => {
    const pago = h(2026, 10, 29, 12, 0); // jueves
    const p = proponer("asesoria", [], pago, pago);
    expect(p.dias).toHaveLength(3);
    expect(p.dias.every((d) => d.fecha >= "2026-11-05")).toBe(true); // 29 oct + 7 días
    // los dos primeros candidatos preferidos de la ventana (dom 8 y lun 9 nov) entran
    expect(p.dias.map((d) => d.fecha)).toContain("2026-11-08");
    expect(p.dias.map((d) => d.fecha)).toContain("2026-11-09");
    expect(REGLAS.asesoriaEsperaDias).toBe(7);
  });
  it("avisa si solo uno de los días recomendados es domingo o lunes", () => {
    const pago = h(2026, 10, 29, 12, 0);
    const p = proponer("venta", [], pago); // vie, sáb, dom -> solo el domingo es preferido
    expect(p.unSoloPreferido).toBe(true);
  });
});
