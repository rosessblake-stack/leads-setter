import { describe, expect, it } from "vitest";
import { definicion as def, reglasOferta } from "@/formulario/datos";
import { claveExtra, limpiar, rutaDe, validarRespuesta, validarTodo, visibles } from "@/formulario/motor";
import { calcularSignals } from "@/formulario/signals";
import { construirSolicitud, extraerInstagram } from "@/formulario/solicitud";
import type { Respuestas } from "@/formulario/tipos";

const base = (ruta: string, extra: Respuestas = {}): Respuestas => ({
  C06: ruta,
  C10: "1–5",
  C13: ["Curso online"],
  V03: "Lo hago, pero me cuesta",
  ...extra,
});

const PRES = "Formación presencial conmigo";
const ONLINE = "Formación online (curso)";
const ASES = "Asesoría 1:1 virtual";
const NOCLARO = "No lo tengo claro, quiero que me orientes";

describe("rutas y totales (con todas las condicionales visibles)", () => {
  it("presencial = 46 (45 de tu documento + teléfono)", () => {
    expect(visibles(def, base(PRES, { V03: "Casi no" })).length).toBe(46);
  });
  it("online = 41", () => {
    expect(visibles(def, base(ONLINE, { V03: "Casi no" })).length).toBe(41);
  });
  it("asesoría = 50", () => {
    expect(visibles(def, base(ASES)).length).toBe(50);
  });
  it("no lo tengo claro = 32", () => {
    expect(visibles(def, base(NOCLARO)).length).toBe(32);
  });

  it("cada ruta muestra solo sus módulos", () => {
    const ids = (r: string) => new Set(visibles(def, base(r, { V03: "Casi no" })).map((q) => q.id));
    expect(ids(PRES).has("F01") && ids(PRES).has("T07") && ids(PRES).has("E04")).toBe(true);
    expect(ids(ONLINE).has("F01")).toBe(false);
    expect(ids(ONLINE).has("T06")).toBe(false);
    expect(ids(ONLINE).has("T05")).toBe(true);
    expect(ids(ASES).has("A33") && !ids(ASES).has("S01") && !ids(ASES).has("B01")).toBe(true);
    expect(ids(NOCLARO).has("N10") && ids(NOCLARO).has("B05") && !ids(NOCLARO).has("E01")).toBe(true);
  });

  it("en 'No lo tengo claro' las N van antes que las B", () => {
    const orden = visibles(def, base(NOCLARO)).map((q) => q.id);
    expect(orden.indexOf("N10")).toBeLessThan(orden.indexOf("B01"));
  });
});

describe("condicionales", () => {
  it("C14 solo si ha invertido antes", () => {
    expect(visibles(def, base(PRES, { C13: ["Nunca"] })).some((q) => q.id === "C14")).toBe(false);
    expect(visibles(def, base(PRES)).some((q) => q.id === "C14")).toBe(true);
  });
  it("V04 solo si graba y publica", () => {
    expect(visibles(def, base(PRES, { V03: "Nunca" })).some((q) => q.id === "V04")).toBe(false);
    expect(visibles(def, base(PRES, { V03: "Casi no" })).some((q) => q.id === "V04")).toBe(true);
  });
  it("B03–B05 solo si atiende clientes", () => {
    const sin = visibles(def, base(PRES, { C10: "0" })).map((q) => q.id);
    expect(["B03", "B04", "B05"].some((id) => sin.includes(id))).toBe(false);
  });
  it("F03 pide ciudad solo si necesita que sea en su ciudad", () => {
    const q = def.preguntas.find((p) => p.id === "F03")!;
    expect(validarRespuesta(q, { F03: "Sí" })).toBeNull();
    expect(q.extra?.cuando).toBe("Necesito que sea en mi ciudad");
  });
  it("B01 personas es opcional", () => {
    const q = def.preguntas.find((p) => p.id === "B01")!;
    expect(validarRespuesta(q, { B01: "Con equipo" })).toBeNull();
    expect(validarRespuesta(q, { B01: "Con equipo", [claveExtra("B01")]: "abc" })).not.toBeNull();
  });
});

describe("cambio de ruta", () => {
  it("conserva el tramo común y descarta las ramas que ya no aplican", () => {
    const r = base(PRES, { C01: "Ana", C15: 8, F01: "2 días", T06: ["Espalda"], E03: "Sí" });
    const online = limpiar(def, { ...r, C06: ONLINE });
    expect(online.C01).toBe("Ana");
    expect(online.C15).toBe(8);
    expect(online.F01).toBeUndefined();
    expect(online.T06).toBeUndefined();
    expect(online.E03).toBe("Sí");
    const asesoria = limpiar(def, { ...r, C06: ASES });
    expect(asesoria.C01).toBe("Ana");
    expect(asesoria.E03).toBeUndefined();
  });
  it("rutaDe devuelve null si no hay elección", () => {
    expect(rutaDe(def, {})).toBeNull();
  });
});

describe("validación de respuestas", () => {
  const q = (id: string) => def.preguntas.find((p) => p.id === id)!;
  it("obligatorias", () => {
    expect(validarRespuesta(q("C01"), {})).not.toBeNull();
    expect(validarRespuesta(q("C01"), { C01: "Ana Pérez" })).toBeNull();
  });
  it("email y teléfono", () => {
    expect(validarRespuesta(q("C02"), { C02: "no-es-email" })).not.toBeNull();
    expect(validarRespuesta(q("C02"), { C02: "ana@x.com" })).toBeNull();
    expect(validarRespuesta(q("C03B"), { C03B: "600" })).not.toBeNull();
    expect(validarRespuesta(q("C03B"), { C03B: "+34 600 000 000" })).toBeNull();
  });
  it("C03 exige el número o @", () => {
    expect(validarRespuesta(q("C03"), { C03: "WhatsApp" })).not.toBeNull();
    expect(validarRespuesta(q("C03"), { C03: "WhatsApp", [claveExtra("C03")]: "+34600000000" })).toBeNull();
  });
  it("límites de selección y opciones excluyentes", () => {
    expect(validarRespuesta(q("T02"), { T02: ["Particiones", "Extensiones", "Tiempo"] })).not.toBeNull();
    expect(validarRespuesta(q("T02"), { T02: ["Particiones", "Extensiones"] })).toBeNull();
    expect(validarRespuesta(q("C13"), { C13: ["Nunca", "Curso online"] })).not.toBeNull();
    expect(validarRespuesta(q("T02"), { T02: ["No existe"] })).not.toBeNull();
  });
  it("límite de caracteres", () => {
    expect(validarRespuesta(q("S04"), { S04: "x".repeat(401) })).not.toBeNull();
    expect(validarRespuesta(q("V01"), { V01: "x".repeat(601) })).not.toBeNull();
  });
  it("escala, números y casilla", () => {
    expect(validarRespuesta(q("C15"), { C15: 11 })).not.toBeNull();
    expect(validarRespuesta(q("C15"), { C15: 10 })).toBeNull();
    expect(validarRespuesta(q("B03"), { B03: { precio: "40", horas: "" } })).not.toBeNull();
    expect(validarRespuesta(q("B03"), { B03: { precio: "40", horas: "3" } })).toBeNull();
    expect(validarRespuesta(q("E04"), { E04: false })).not.toBeNull();
    expect(validarRespuesta(q("E04"), { E04: true })).toBeNull();
  });
  it("las preguntas con opciones pendientes aceptan texto libre", () => {
    expect(q("A01").opciones).toBe("__pendiente__");
    expect(validarRespuesta(q("A01"), { A01: "algo" })).toBeNull();
  });
});

const completoNoClaro: Respuestas = {
  C01: "Ana Pérez", C02: "Ana@Ejemplo.com", C03: "Instagram", [claveExtra("C03")]: "@ana.trenzas",
  C03B: "+34 600 000 000", C04: "https://instagram.com/ana.trenzas", C05: "Madrid, España",
  C06: NOCLARO, C07: "TikTok", C08: "1–3 años", C10: "1–5", C11: "Trenzo y estudio",
  C12: "500–1.000 €", C13: ["Nunca"], C15: 7, C16: "La decido yo",
  N01: "Cobrar mejor", N05: "Mejorar mi técnica", N06: "En persona con corrección directa",
  B01: "Sola/o en casa", B03: { precio: "60", horas: "4" }, B04: "Por intuición", B05: "Dudo",
};

describe("envío completo", () => {
  it("valida, guarda con el texto de la pregunta y calcula el resumen", () => {
    const v = validarTodo(def, completoNoClaro);
    expect(v.errores).toEqual({});
    expect(v.ok).toBe(true);
    const s = construirSolicitud(def, reglasOferta, v, { zona_horaria: "Europe/Madrid", v: "reel-1" });
    expect(s.nombre).toBe("Ana Pérez");
    expect(s.email).toBe("ana@ejemplo.com");
    expect(s.telefono).toBe("+34600000000");
    expect(s.ig_username).toBe("ana.trenzas");
    expect(s.interes).toBe("no_se");
    expect(s.respuestas.C12.pregunta).toBe("Aproximadamente, ¿cuánto ganas al mes trenzando, después de gastos?");
    expect(s.respuestas.B03.valor).toEqual({ precio: 60, horas: 4 });
    expect(s.signals.urgencia).toBe(7);
    expect(s.signals.quien_decide).toBe("La decido yo");
    expect(s.signals.sugerencia_oferta).toBe("Formación presencial");
  });

  it("detecta preguntas obligatorias que faltan", () => {
    const { C01, ...sin } = completoNoClaro;
    void C01;
    const v = validarTodo(def, sin);
    expect(v.ok).toBe(false);
    expect(Object.keys(v.errores)).toContain("C01");
  });

  it("descarta respuestas de ramas que no corresponden", () => {
    const v = validarTodo(def, { ...completoNoClaro, E03: "Sí", F01: "1 día" });
    expect(v.limpias.E03).toBeUndefined();
    expect(v.limpias.F01).toBeUndefined();
  });
});

describe("sugerencia de oferta (No lo tengo claro)", () => {
  const m = (n5?: string, n6?: string) => {
    const r: Record<string, { pregunta: string; valor: string }> = {};
    if (n5) r.N05 = { pregunta: "", valor: n5 };
    if (n6) r.N06 = { pregunta: "", valor: n6 };
    return r;
  };
  it("coincidencia, contradicción, una sola o ninguna", () => {
    expect(calcularSignals("no_claro", m("Mejorar mi técnica", "En persona con corrección directa"), reglasOferta).sugerencia_oferta).toBe("Formación presencial");
    expect(calcularSignals("no_claro", m("Mejorar mi técnica", "Hablando 1 a 1 de mi caso concreto"), reglasOferta).sugerencia_oferta).toBe("Revisar N03 y N10 a mano");
    expect(calcularSignals("no_claro", m("Cobrar mejor y ordenar mi negocio", undefined), reglasOferta).sugerencia_oferta).toBe("Asesoría 1:1");
    expect(calcularSignals("no_claro", m("No lo sé", "No lo sé"), reglasOferta).sugerencia_oferta).toBeNull();
  });
  it("solo aparece en la ruta no_claro", () => {
    expect("sugerencia_oferta" in calcularSignals("online", {}, reglasOferta)).toBe(false);
  });
});

describe("extraerInstagram", () => {
  it("saca el usuario de un enlace o una @", () => {
    expect(extraerInstagram("https://www.instagram.com/blakebraider/")).toBe("blakebraider");
    expect(extraerInstagram("@blake.braider")).toBe("blake.braider");
    expect(extraerInstagram("https://instagram.com/reel/abc")).toBeNull();
    expect(extraerInstagram("https://miweb.com")).toBeNull();
  });
});
