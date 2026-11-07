import { comentariosDe, firmaMetaValida, registrarComentarios } from "@/lib/instagram";
import { registrarError } from "@/lib/errores";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Verificación que hace Meta al dar de alta el webhook.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const esperado = (process.env.INSTAGRAM_VERIFY_TOKEN ?? "").trim();
  if (esperado && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === esperado) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("No autorizado", { status: 403 });
}

// Aviso de comentarios nuevos. Sin la firma correcta no se hace nada.
export async function POST(req: Request) {
  const secreto = (process.env.INSTAGRAM_APP_SECRET ?? "").trim();
  const cuerpo = await req.text();
  if (!secreto || !firmaMetaValida(cuerpo, req.headers.get("x-hub-signature-256"), secreto)) {
    return new Response("Firma no válida", { status: 401 });
  }
  try {
    await registrarComentarios(comentariosDe(JSON.parse(cuerpo)));
    return new Response("ok", { status: 200 });
  } catch (e) {
    await registrarError("servidor", e, { paso: "webhook de Instagram" });
    return new Response("Error", { status: 500 }); // Meta lo reintenta
  }
}
