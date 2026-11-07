import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaValida, pagoDe } from "@/lib/stripe";

const secreto = "whsec_prueba";
const firmar = (cuerpo: string, t: number, s = secreto) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${cuerpo}`).digest("hex")}`;

describe("firma del webhook de Stripe", () => {
  const cuerpo = '{"type":"x"}';
  const t = 1_800_000_000;
  it("acepta la firma correcta y rechaza las demás", () => {
    expect(firmaValida(cuerpo, firmar(cuerpo, t), secreto, t)).toBe(true);
    expect(firmaValida(cuerpo + " ", firmar(cuerpo, t), secreto, t)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo, t, "otro"), secreto, t)).toBe(false);
    expect(firmaValida(cuerpo, null, secreto, t)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo, t), "", t)).toBe(false);
  });
  it("rechaza firmas antiguas (repetición)", () => {
    expect(firmaValida(cuerpo, firmar(cuerpo, t), secreto, t + 600)).toBe(false);
  });
  it("acepta varias firmas v1 si una coincide", () => {
    expect(firmaValida(cuerpo, `${firmar(cuerpo, t)},v1=abc`, secreto, t)).toBe(true);
  });
});

describe("pago a partir del evento", () => {
  const ficha = "0b9a2f06-5b47-4f64-9a52-0d9a8a1d9c11";
  it("enlace de pago pagado", () => {
    const p = pagoDe({ type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", mode: "payment", amount_total: 25000, currency: "eur", created: 1_800_000_000, client_reference_id: ficha, customer_details: { email: "A@b.com" } } } });
    expect(p).toMatchObject({ stripeId: "cs_1", importeCents: 25000, moneda: "EUR", fichaId: ficha, unico: true, email: "A@b.com" });
  });
  it("ignora pagos sin cobrar, con factura (se cuentan en invoice.paid) y eventos de otro tipo", () => {
    expect(pagoDe({ type: "checkout.session.completed", data: { object: { id: "cs_2", payment_status: "unpaid" } } })).toBeNull();
    expect(pagoDe({ type: "checkout.session.completed", data: { object: { id: "cs_3", payment_status: "paid", invoice: "in_1" } } })).toBeNull();
    expect(pagoDe({ type: "charge.refunded", data: { object: { id: "ch_1" } } })).toBeNull();
  });
  it("cuota de un plan de pago", () => {
    const p = pagoDe({ type: "invoice.paid", data: { object: { id: "in_1", customer_email: "a@b.com", amount_paid: 31250, currency: "eur", status_transitions: { paid_at: 1_800_000_000 }, lines: { data: [{ description: "Formación presencial" }] } } } });
    expect(p).toMatchObject({ stripeId: "in_1", importeCents: 31250, unico: false, descripcion: "Formación presencial" });
  });
});
