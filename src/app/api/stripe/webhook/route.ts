import { firmaValida, pagoDe, registrarPago } from "@/lib/stripe";
import { registrarError } from "@/lib/errores";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Stripe avisa aquí de cada pago. Sin la firma correcta no se hace nada.
export async function POST(req: Request) {
  const secreto = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  const cuerpo = await req.text();
  if (!secreto || !firmaValida(cuerpo, req.headers.get("stripe-signature"), secreto)) {
    return new Response("Firma no válida", { status: 400 });
  }
  try {
    const evento = JSON.parse(cuerpo) as { type?: string; data?: { object?: Record<string, unknown> } };
    const pago = pagoDe(evento);
    if (pago) await registrarPago(pago);
    return Response.json({ ok: true });
  } catch (e) {
    await registrarError("servidor", e, { paso: "webhook de Stripe" });
    return new Response("Error", { status: 500 }); // Stripe lo reintenta
  }
}
