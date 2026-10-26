import { describe, expect, it } from "vitest";
import { esAdmin, formatearEstado, numeroDeLead, parsearComando, reconstruirLead } from "@/lib/comandos";

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

describe("/lead", () => {
  it("reconoce el comando y su número", () => {
    expect(parsearComando("/lead 2")).toBe("lead");
    expect(numeroDeLead("/lead 2")).toBe(2);
    expect(numeroDeLead("/lead")).toBe(1);
    expect(numeroDeLead("/lead@blakeleads_bot 5")).toBe(5);
  });

  it("rechaza números fuera de rango o texto raro", () => {
    expect(numeroDeLead("/lead 0")).toBeNull();
    expect(numeroDeLead("/lead 6")).toBeNull();
    expect(numeroDeLead("/lead abc")).toBeNull();
    expect(numeroDeLead("/lead 1; drop table")).toBeNull();
  });
});

describe("reconstruirLead", () => {
  const base = {
    nombre: "Ana",
    email: "ana@x.com",
    telefono: "+34600000000",
    ig_username: null,
    pais: "España",
    como_nos_conociste: null,
    ruta: "online" as const,
    signals: { urgencia: 8, quien_decide: "La decido yo" },
    respuestas: { C03: { valor: "WhatsApp", extra: "+34600000000" } },
    video_codigo: "reel-1",
    estado: "analizado",
    nivel: "intermedio" as const,
    dolores: ["clientes" as const],
    oferta_recomendada: "online" as const,
    encaje: "alto" as const,
    puntuacion: 60,
    resumen: "Resumen",
    sospechoso: null,
  };

  it("reconstruye el resumen y la ficha", () => {
    const { resumen, ficha } = reconstruirLead(base);
    expect(resumen.nombre).toBe("Ana");
    expect(resumen.contacto).toBe("WhatsApp (+34600000000)");
    expect(resumen.v).toBe("reel-1");
    expect(resumen.signals?.urgencia).toBe(8);
    expect(ficha?.puntuacion).toBe(60);
    expect(ficha?.sospechoso).toBe(false);
  });

  it("devuelve ficha nula si el lead no llegó a analizarse", () => {
    const { ficha } = reconstruirLead({ ...base, resumen: null, nivel: null, puntuacion: null });
    expect(ficha).toBeNull();
  });

  it("un formulario antiguo (sin ruta) no rompe", () => {
    const { resumen } = reconstruirLead({ ...base, ruta: null, signals: null, respuestas: null });
    expect(resumen.ruta).toBeNull();
    expect(resumen.signals).toBeNull();
  });
});
