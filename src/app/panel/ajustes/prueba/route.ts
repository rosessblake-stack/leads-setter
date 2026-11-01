import { cookies } from "next/headers";
import { registrarError } from "@/lib/errores";
import { ir } from "@/lib/http";
import { enviarPropuesta, manychatConfigurado, type TipoFlujo } from "@/lib/manychat";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";
import { urlPanel } from "@/lib/config";

export const maxDuration = 30;

// Prueba real del envío: manda un mensaje de prueba a un contacto de ManyChat (el de Blake) con el flujo elegido.
// Sirve para comprobar de punta a punta que ManyChat acepta los campos y lanza el flujo.
export async function POST(req: Request) {
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });
  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) return ir("/panel/entrar");
  if (!manychatConfigurado()) return ir("/panel/ajustes?prueba=sin_claves");

  const datos = await req.formData().catch(() => null);
  const contacto = String(datos?.get("contacto") ?? "").trim();
  const tipo: TipoFlujo = datos?.get("tipo") === "asesoria" ? "asesoria" : "llamada";
  if (!/^\d{3,20}$/.test(contacto)) return ir("/panel/ajustes?prueba=contacto");

  const texto =
    tipo === "asesoria"
      ? "Prueba del sistema: así llegará la propuesta de asesoría. Si ves este mensaje con su botón, el envío automático funciona."
      : "Prueba del sistema: así llegará la propuesta de llamada. Si ves este mensaje con su botón, el envío automático funciona.";
  try {
    await enviarPropuesta(contacto, tipo, texto, `${urlPanel()}/guia?prueba=1`);
    return ir("/panel/ajustes?prueba=ok");
  } catch (e) {
    await registrarError("manychat", e, { paso: "prueba de envío desde Ajustes", tipo });
    return ir(`/panel/ajustes?prueba=error&detalle=${encodeURIComponent((e instanceof Error ? e.message : "error").slice(0, 200))}`);
  }
}
