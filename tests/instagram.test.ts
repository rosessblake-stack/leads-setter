import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { comentariosDe, firmaMetaValida } from "@/lib/instagram";

const firmar = (c: string, s: string) => `sha256=${createHmac("sha256", s).update(c).digest("hex")}`;

describe("firma de Meta", () => {
  const cuerpo = '{"object":"instagram"}';
  it("acepta la firma correcta y rechaza las demás", () => {
    expect(firmaMetaValida(cuerpo, firmar(cuerpo, "s"), "s")).toBe(true);
    expect(firmaMetaValida(cuerpo, firmar(cuerpo, "x"), "s")).toBe(false);
    expect(firmaMetaValida(cuerpo + " ", firmar(cuerpo, "s"), "s")).toBe(false);
    expect(firmaMetaValida(cuerpo, null, "s")).toBe(false);
    expect(firmaMetaValida(cuerpo, "sha256=abc", "")).toBe(false);
    expect(firmaMetaValida(cuerpo, "abc", "s")).toBe(false);
  });
});

describe("comentarios del aviso", () => {
  const aviso = (value: Record<string, unknown>, id = "17841") => ({ entry: [{ id, time: 1_800_000_000, changes: [{ field: "comments", value }] }] });
  it("saca reel, usuario y texto", () => {
    const [c] = comentariosDe(aviso({ id: "c1", text: "  palabra   clave ", from: { id: "u1", username: "@Ana_Trenzas" }, media: { id: "m1" } }));
    expect(c).toMatchObject({ id: "c1", mediaId: "m1", userId: "u1", username: "ana_trenzas", texto: "palabra clave" });
    expect(c.en.toISOString()).toBe("2027-01-15T08:00:00.000Z");
  });
  it("ignora respuestas, comentarios propios y otros campos", () => {
    expect(comentariosDe(aviso({ id: "c2", parent_id: "c1", from: { id: "u1" }, media: { id: "m1" } }))).toEqual([]);
    expect(comentariosDe(aviso({ id: "c3", from: { id: "17841" }, media: { id: "m1" } }))).toEqual([]);
    expect(comentariosDe({ entry: [{ id: "1", changes: [{ field: "mentions", value: { id: "c4", media: { id: "m1" } } }] }] })).toEqual([]);
    expect(comentariosDe(aviso({ id: "c5", from: { id: "u1" } }))).toEqual([]);
    expect(comentariosDe(null)).toEqual([]);
  });
  it("recorta textos largos", () => {
    const [c] = comentariosDe(aviso({ id: "c6", text: "a".repeat(900), from: { id: "u2", username: "x" }, media: { id: "m1" } }));
    expect(c.texto!.length).toBe(300);
  });
});
