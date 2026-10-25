import { describe, expect, it } from "vitest";
import { FormularioSchema } from "@/lib/validation";

const valido = {
  nombre: "María",
  email: "  Maria@Ejemplo.COM ",
  ig_username: "@maria.trenzas",
  pais: "España",
  interes: "online",
  nivel: "intermedio",
  dificultad: "No consigo clientes fijos",
  objetivo: "Vivir de ello",
  consentimiento: true,
  v: "reel-042",
  mc: "123456",
};

describe("FormularioSchema", () => {
  it("acepta un formulario válido y normaliza email e Instagram", () => {
    const r = FormularioSchema.parse(valido);
    expect(r.email).toBe("maria@ejemplo.com");
    expect(r.ig_username).toBe("maria.trenzas");
  });

  it("exige consentimiento", () => {
    expect(FormularioSchema.safeParse({ ...valido, consentimiento: false }).success).toBe(false);
    const { consentimiento, ...sin } = valido;
    void consentimiento;
    expect(FormularioSchema.safeParse(sin).success).toBe(false);
  });

  it("rechaza email inválido y opciones fuera de lista", () => {
    expect(FormularioSchema.safeParse({ ...valido, email: "no-es-email" }).success).toBe(false);
    expect(FormularioSchema.safeParse({ ...valido, interes: "otra" }).success).toBe(false);
    expect(FormularioSchema.safeParse({ ...valido, nivel: "experto" }).success).toBe(false);
  });

  it("rechaza identificadores de vídeo o ManyChat con caracteres raros", () => {
    expect(FormularioSchema.safeParse({ ...valido, v: "a b; drop" }).success).toBe(false);
    expect(FormularioSchema.safeParse({ ...valido, mc: "x'y" }).success).toBe(false);
  });

  it("rechaza textos demasiado largos", () => {
    expect(FormularioSchema.safeParse({ ...valido, dificultad: "x".repeat(1001) }).success).toBe(false);
  });

  it("rechaza un usuario de Instagram no válido", () => {
    expect(FormularioSchema.safeParse({ ...valido, ig_username: "hola mundo!" }).success).toBe(false);
  });
});
