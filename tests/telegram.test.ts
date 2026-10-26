import { describe, expect, it } from "vitest";
import { construirMensaje, escaparHtml } from "@/lib/telegram";
import { FormularioSchema } from "@/lib/validation";

const f = FormularioSchema.parse({
  nombre: "<b>Ana</b>",
  email: "ana@x.com",
  pais: "España",
  interes: "presencial",
  nivel: "avanzado",
  dificultad: "d",
  objetivo: "o",
  consentimiento: true,
  v: "reel-1",
});

describe("telegram", () => {
  it("escapa HTML", () => {
    expect(escaparHtml("<a>&")).toBe("&lt;a&gt;&amp;");
  });

  it("construye el aviso con ficha y escapa los datos de la persona", () => {
    const m = construirMensaje(f, {
      nivel: "avanzado",
      dolores: ["clientes"],
      oferta_recomendada: "presencial",
      encaje: "alto",
      puntuacion: 80,
      sospechoso: false,
      resumen: "Quiere crecer <rápido>",
    });
    expect(m).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(m).toContain("Vídeo: reel-1");
    expect(m).toContain("80/100");
    expect(m).toContain("Encaje con tu cliente ideal: alto");
    expect(m).toContain("Quiere crecer &lt;rápido&gt;");
  });

  it("avisa cuando no hay análisis", () => {
    const m = construirMensaje(f, null, "Error al analizar el formulario.");
    expect(m).toContain("No se pudo analizar");
    expect(m).toContain("Error al analizar");
  });
});
