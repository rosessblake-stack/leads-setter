import { cookies } from "next/headers";
import { registrarError } from "@/lib/errores";
import { ir } from "@/lib/http";
import { enviarMensaje, enviarPropuesta, lanzarSeguimientoGuia, manychatConfigurado, type TipoFlujo } from "@/lib/manychat";
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
  const seguimiento = datos?.get("tipo") === "seguimiento";
  const directo = datos?.get("tipo") === "mensaje";
  const tipo: TipoFlujo = datos?.get("tipo") === "asesoria" ? "asesoria" : "llamada";
  if (!/^\d{3,20}$/.test(contacto)) return ir("/panel/ajustes?prueba=contacto");
  if (seguimiento) {
    // Lanza el flujo «Seguimiento guía» a tu contacto, con tu enlace de pago de la asesoría (o uno de prueba si no está puesto).
    try {
      await lanzarSeguimientoGuia(contacto, process.env.STRIPE_LINK_ASESORIA || `${urlPanel()}/guia?prueba=1`);
      return ir("/panel/ajustes?prueba=ok");
    } catch (e) {
      await registrarError("manychat", e, { paso: "prueba del seguimiento de la guía desde Ajustes" });
      return ir(`/panel/ajustes?prueba=error&detalle=${encodeURIComponent((e instanceof Error ? e.message : "error").slice(0, 200))}`);
    }
  }

  if (directo) {
    // Mensaje directo con botón, sin ningún flujo: el que usan las respuestas que se mandan desde el sistema.
    try {
      await enviarMensaje(contacto, "Prueba del sistema: así llegará un mensaje directo con su botón. Si lo ves completo, funciona.", { caption: "Abrir la guía", url: `${urlPanel()}/guia?prueba=1` });
      return ir("/panel/ajustes?prueba=ok");
    } catch (e) {
      await registrarError("manychat", e, { paso: "prueba del mensaje directo desde Ajustes" });
      return ir(`/panel/ajustes?prueba=error&detalle=${encodeURIComponent((e instanceof Error ? e.message : "error").slice(0, 200))}`);
    }
  }

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
