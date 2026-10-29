import { describe, expect, it, beforeAll } from "vitest";
import { enHorarioDeEnvio, enlacePago, horaLocal, nombreSeguro, redactar } from "@/lib/propuestas";

describe("nombre dentro de un mensaje que se envía solo", () => {
  it("deja un nombre de pila normal", () => {
    expect(nombreSeguro("Ana Pérez")).toBe("Ana");
    expect(nombreSeguro("  María-José  López")).toBe("María-José");
    expect(nombreSeguro("D'Arcy")).toBe("D'Arcy");
  });
  it("descarta enlaces, usuarios, números y símbolos", () => {
    for (const malo of ["http://estafa.com", "www.malo.es", "@usuario", "gana100", "x", "<script>", "💥", "a.b.com hola"]) {
      expect(nombreSeguro(malo)).toBe("");
    }
  });
  it("recorta nombres larguísimos", () => {
    expect(nombreSeguro("A".repeat(80)).length).toBe(30);
  });
  it("el mensaje no contiene el enlace de otro ni el texto libre", () => {
    const p = redactar({ nombre: "http://malo.com cómprame", ruta: "online", temas: [], enlace: "https://x" });
    expect(p.cuerpo).not.toContain("malo.com");
    expect(p.cuerpo.startsWith("Hola, soy Blake.")).toBe(true);
  });
  it("no dice que alguien lo ha leído con calma", () => {
    for (const ruta of ["presencial", "online", "asesoria"] as const) {
      expect(redactar({ nombre: "Ana", ruta, temas: [], enlace: "u" }).cuerpo).not.toMatch(/con calma|he le[ií]do/i);
    }
  });
});

describe("enlace de pago con la persona identificada", () => {
  it("añade la ficha y el email", () => {
    const u = new URL(enlacePago("https://buy.stripe.com/abc", "ficha-1", "ana@ejemplo.com"));
    expect(u.searchParams.get("client_reference_id")).toBe("ficha-1");
    expect(u.searchParams.get("prefilled_email")).toBe("ana@ejemplo.com");
  });
  it("respeta un enlace que ya tenga parámetros y tolera uno roto", () => {
    expect(enlacePago("https://buy.stripe.com/abc?x=1", "f", "a@b.co")).toContain("x=1");
    expect(enlacePago("no es un enlace", "f", "a@b.co")).toBe("no es un enlace");
  });
});

describe("horario de envío en la zona de la persona", () => {
  it("de 9:00 a 21:59", () => {
    const t = new Date("2026-11-02T13:00:00Z"); // 14:00 en Madrid, 08:00 en México (UTC-5)
    expect(horaLocal(t, "Europe/Madrid")).toBe(14);
    expect(enHorarioDeEnvio(t, "Europe/Madrid")).toBe(true);
    expect(enHorarioDeEnvio(t, "America/Bogota")).toBe(false); // 08:00
    expect(enHorarioDeEnvio(new Date("2026-11-02T03:00:00Z"), "Europe/Madrid")).toBe(false); // 04:00
  });
  it("una zona inválida usa la de España", () => {
    expect(horaLocal(new Date("2026-11-02T13:00:00Z"), "Marte/Olimpo")).toBe(14);
  });
});

describe("cifrado del token de Google con clave propia", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    delete process.env.ENCRYPTION_KEY_ANTERIOR;
  });
  it("ida y vuelta, con versión, y sin depender del secreto de Google", async () => {
    const { cifrar, descifrar } = await import("@/lib/google");
    process.env.GOOGLE_CLIENT_SECRET = "uno";
    const c = cifrar("token-secreto");
    expect(c.startsWith("k1.")).toBe(true);
    expect(c).not.toContain("token-secreto");
    process.env.GOOGLE_CLIENT_SECRET = "otro-distinto"; // rotar el secreto de Google no rompe lo guardado
    expect(descifrar(c)).toBe("token-secreto");
  });
  it("sin clave, falla con un mensaje claro", async () => {
    const { cifrar } = await import("@/lib/google");
    const antes = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => cifrar("x")).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = antes;
  });
});
