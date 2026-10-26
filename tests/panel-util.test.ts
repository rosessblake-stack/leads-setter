import { describe, expect, it } from "vitest";
import { definicion } from "@/formulario/datos";
import {
  agruparRespuestas,
  enlaceInstagram,
  enlaceWhatsApp,
  formatearValor,
  leerFiltros,
  patronBusqueda,
  urlSegura,
} from "@/lib/panel-util";
import { FORMATO_SECRETO, huella, nuevoSecreto } from "@/lib/panel";
import { parsearComando } from "@/lib/comandos";

describe("filtros del panel", () => {
  it("solo acepta valores conocidos", () => {
    expect(leerFiltros({ fase: "vendido", ruta: "online", vista: "agendadas", q: " ana ", pagina: "3" })).toEqual({
      fase: "vendido",
      ruta: "online",
      vista: "agendadas",
      q: "ana",
      pagina: 3,
    });
    expect(leerFiltros({ fase: "x'; drop", ruta: "otra", vista: "todo", pagina: "-4" })).toEqual({ fase: null, ruta: null, vista: null, q: null, pagina: 1 });
    expect(leerFiltros({ pagina: "99999" }).pagina).toBe(1);
    expect(leerFiltros({ q: "x".repeat(200) }).q?.length).toBe(60);
  });
  it("escapa los comodines de la búsqueda", () => {
    expect(patronBusqueda("50%_a")).toBe("%50\\%\\_a%");
  });
});

describe("enlaces seguros", () => {
  it("WhatsApp e Instagram solo con datos válidos", () => {
    expect(enlaceWhatsApp("+34 600 000 000")).toBe("https://wa.me/34600000000");
    expect(enlaceWhatsApp("123")).toBeNull();
    expect(enlaceInstagram("ana.trenzas")).toBe("https://instagram.com/ana.trenzas");
    expect(enlaceInstagram("ana trenzas/<x>")).toBeNull();
  });
  it("urlSegura solo deja pasar http(s)", () => {
    expect(urlSegura("https://instagram.com/ana")).toBe("https://instagram.com/ana");
    expect(urlSegura("instagram.com/ana")).toBe("https://instagram.com/ana");
    expect(urlSegura("javascript:alert(1)")).toBeNull();
    expect(urlSegura("data:text/html,<script>")).toBeNull();
    expect(urlSegura("mi perfil de instagram")).toBeNull();
    expect(urlSegura("")).toBeNull();
  });
});

describe("respuestas del lead", () => {
  it("formatea valores y agrupa por bloque en el orden del formulario", () => {
    expect(formatearValor({ pregunta: "p", valor: ["a", "b"] })).toBe("a, b");
    expect(formatearValor({ pregunta: "p", valor: true })).toBe("Sí");
    expect(formatearValor({ pregunta: "p", valor: { precio: 60, horas: 4 } })).toBe("precio: 60 · horas: 4");
    expect(formatearValor({ pregunta: "p", valor: "WhatsApp", extra: "+34600000000" })).toBe("WhatsApp (+34600000000)");
    const g = agruparRespuestas(definicion, {
      B03: { pregunta: "b", valor: 1 },
      C01: { pregunta: "c", valor: "Ana" },
      N01: { pregunta: "n", valor: "x" },
    });
    expect(g.map((x) => x.titulo)).toEqual(["Datos y contexto", "Orientación", "Negocio y precios"]);
    expect(agruparRespuestas(definicion, null)).toEqual([]);
  });
});

describe("acceso al panel", () => {
  it("los secretos son largos, únicos y su huella no los revela", () => {
    const a = nuevoSecreto();
    const b = nuevoSecreto();
    expect(a).not.toBe(b);
    expect(FORMATO_SECRETO.test(a)).toBe(true);
    expect(huella(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(huella(a)).not.toContain(a);
    expect(FORMATO_SECRETO.test("corto")).toBe(false);
    expect(FORMATO_SECRETO.test("x".repeat(43) + "'; drop table")).toBe(false);
  });
  it("reconoce /panel y /cerrar_panel", () => {
    expect(parsearComando("/panel")).toBe("panel");
    expect(parsearComando("/panel@blakeleads_bot")).toBe("panel");
    expect(parsearComando("/cerrar_panel")).toBe("cerrar_panel");
  });
});
