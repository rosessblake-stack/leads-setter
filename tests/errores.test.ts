import { describe, expect, it } from "vitest";
import { limpiarContexto, limpiarMensaje, pista } from "@/lib/errores-util";

describe("limpiar mensajes de error", () => {
  it("quita emails y cadenas largas que podrían ser claves", () => {
    const m = limpiarMensaje("Key (email)=(ana@ejemplo.com) already exists; token=abcDEF123456789_abcDEF123456789_xyz");
    expect(m).not.toContain("ana@ejemplo.com");
    expect(m).not.toContain("abcDEF123456789");
    expect(m).toContain("[email]");
  });
  it("recorta a 500 caracteres y junta espacios", () => {
    expect(limpiarMensaje("a  b\n c")).toBe("a b c");
    expect(limpiarMensaje("x".repeat(900)).length).toBeLessThanOrEqual(500);
  });
  it("el contexto solo guarda valores simples y cortos", () => {
    const c = limpiarContexto({ ficha: "id-1", n: 3, ok: true, objeto: { a: 1 }, lista: [1], largo: "y".repeat(500), correo: "a@b.com" });
    expect(c.ficha).toBe("id-1");
    expect(c.n).toBe(3);
    expect(c.objeto).toBeUndefined();
    expect(c.lista).toBeUndefined();
    expect(String(c.largo).length).toBeLessThanOrEqual(120);
    expect(c.correo).toBe("[email]");
  });
});

describe("causa probable", () => {
  it("explica los fallos conocidos", () => {
    expect(pista("google", "Google token 401: invalid_client The provided client secret is invalid.")).toContain("GOOGLE_CLIENT_SECRET");
    expect(pista("google", "x redirect_uri_mismatch")).toContain("callback");
    expect(pista("manychat", "No encuentro en ManyChat un único flujo llamado «Propuesta llamada»")).toContain("Propuesta llamada");
    expect(pista("manychat", "ManyChat 401: Invalid token")).toContain("MANYCHAT_API_KEY");
    expect(pista("manychat", "ManyChat 400: Subscriber not found")).toContain("no encuentra a esa persona");
    expect(pista("telegram", "Telegram respondió 403: Forbidden")).toContain("Start");
    expect(pista("claude", "401 authentication_error")).toContain("ANTHROPIC_API_KEY");
  });
  it("sin explicación conocida devuelve null", () => {
    expect(pista("servidor", "algo raro")).toBeNull();
  });
});
