import { describe, expect, it } from "vitest";
import { momentoDeEnvio, redactar, temasDe, unir } from "@/lib/propuestas";

describe("redactar propuestas", () => {
  it("presencial: llamada de 30 min, sin precios, con el enlace solo en la versión para copiar", () => {
    const p = redactar({ nombre: "Ana Pérez", ruta: "presencial", temas: [], enlace: "https://x/reservar/abc" });
    expect(p.tipo).toBe("llamada");
    expect(p.cuerpo).toContain("Hola Ana, soy Blake.");
    expect(p.cuerpo).toContain("formación presencial");
    expect(p.cuerpo).toContain("30 minutos");
    expect(p.cuerpo).not.toContain("https://");
    expect(p.manual).toContain("https://x/reservar/abc");
    expect(p.cuerpo + p.manual).not.toMatch(/€|euros|precio/i);
  });
  it("online: dice formación online", () => {
    expect(redactar({ nombre: "Leo", ruta: "online", temas: [], enlace: "u" }).cuerpo).toContain("formación online");
  });
  it("asesoría: temas elegidos, plan de acción del mes, pago primero y llamada una semana después", () => {
    const p = redactar({ nombre: "Mar", ruta: "asesoria", temas: ["precios", "marca personal", "equipo y liderazgo"], enlace: "https://pago" });
    expect(p.tipo).toBe("asesoria");
    expect(p.cuerpo).toContain("precios, marca personal y equipo y liderazgo");
    expect(p.cuerpo).toContain("plan de acción para todo el mes");
    expect(p.cuerpo).toContain("una semana después");
    expect(p.cuerpo).not.toContain("https://");
    expect(p.manual).toContain("Pago: https://pago");
  });
  it("asesoría sin temas elegidos usa una frase general", () => {
    expect(redactar({ nombre: "Mar", ruta: "asesoria", temas: [], enlace: "u" }).cuerpo).toContain("los puntos que más te frenan");
  });
  it("sin nombre no queda un hueco raro", () => {
    expect(redactar({ nombre: "  ", ruta: "online", temas: [], enlace: "u" }).cuerpo.startsWith("Hola, soy Blake.")).toBe(true);
  });
});

describe("temas y unión", () => {
  it("traduce las opciones de A01 y descarta «No lo sé»", () => {
    expect(temasDe(["Precios", "Mercado VIP", "No lo sé, quiero que me ayudes a decidirlo"])).toEqual(["precios", "mercado VIP"]);
    expect(temasDe(undefined)).toEqual([]);
  });
  it("une en español", () => {
    expect(unir(["a"])).toBe("a");
    expect(unir(["a", "b"])).toBe("a y b");
    expect(unir(["a", "b", "c"])).toBe("a, b y c");
  });
});

describe("cuándo se envía", () => {
  const t = new Date("2026-11-02T10:00:00Z");
  it("entre 1 y 3 horas después", () => {
    expect(momentoDeEnvio(t, 0).toISOString()).toBe("2026-11-02T11:00:00.000Z");
    expect(momentoDeEnvio(t, 1).toISOString()).toBe("2026-11-02T13:00:00.000Z");
    expect(momentoDeEnvio(t, 0.5).toISOString()).toBe("2026-11-02T12:00:00.000Z");
  });
});
