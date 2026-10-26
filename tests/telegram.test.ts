import { describe, expect, it } from "vitest";
import { construirMensaje, escaparHtml, resumenDe } from "@/lib/telegram";
import { solicitudDePrueba } from "./ayuda";

const ficha = {
  nivel: "intermedio" as const,
  dolores: ["clientes" as const],
  oferta_recomendada: "presencial" as const,
  encaje: "alto" as const,
  puntuacion: 80,
  sospechoso: false,
  resumen: "Quiere crecer <rápido>",
};

describe("telegram", () => {
  it("escapa HTML", () => {
    expect(escaparHtml("<a>&")).toBe("&lt;a&gt;&amp;");
  });

  it("construye el aviso con contacto, ruta, señales y ficha", () => {
    const m = construirMensaje(resumenDe(solicitudDePrueba({ C01: "<b>Ana</b>" }, { v: "reel-1" })), ficha);
    expect(m).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(m).toContain("@ana.trenzas");
    expect(m).toContain("Escríbele por Instagram: https://ig.me/m/ana.trenzas");
    expect(m).toContain("Ruta: No lo tiene claro");
    expect(m).toContain("Vídeo: reel-1");
    expect(m).toContain("urgencia 7/10");
    expect(m).toContain("Sugerencia por sus respuestas: Formación presencial");
    expect(m).toContain("80/100");
    expect(m).toContain("Encaje con tu cliente ideal: alto");
    expect(m).toContain("Quiere crecer &lt;rápido&gt;");
  });

  it("incluye el enlace a la ficha cuando se conoce", () => {
    const m = construirMensaje(resumenDe(solicitudDePrueba(), "11111111-2222-4333-8444-555555555555"), ficha);
    expect(m).toContain("Abrir ficha: https://leads-setter.vercel.app/panel/lead/11111111-2222-4333-8444-555555555555");
    expect(construirMensaje(resumenDe(solicitudDePrueba()), ficha)).not.toContain("Abrir ficha");
  });

  it("avisa cuando no hay análisis", () => {
    const m = construirMensaje(resumenDe(solicitudDePrueba()), null, "Error al analizar el formulario.");
    expect(m).toContain("No se pudo analizar");
    expect(m).toContain("Error al analizar");
  });
});
