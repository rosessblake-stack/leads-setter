import { cookies } from "next/headers";
import { ir } from "@/lib/http";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";
import {
  cambiarFase,
  cambiarPropuesta,
  fijarReserva,
  guardarNota,
  guardarTelefono,
  marcarCasoExito,
  registrarResultado,
} from "@/lib/seguimiento";
import { aCentimos, leerExito, leerFaseManual, leerNota, leerPropuesta, leerReserva, leerResultado, leerTelefono } from "@/lib/seguimiento-util";
import { registrarError } from "@/lib/errores";
import { registrarPagoManual } from "@/lib/stripe";
import { forzarRespuestaSeguimiento } from "@/lib/forzar-seguimiento";
import { enviarAhora } from "@/lib/enviar-ahora";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Todas las acciones de seguimiento de un lead entran por aquí (formularios POST del panel).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const fluido = req.headers.get("x-fluido") === "1"; // petición del panel sin recarga: responde JSON
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origen || !host || new URL(origen).host !== host) return new Response("Origen no permitido", { status: 403 });

  if (!(await sesionValida((await cookies()).get(COOKIE_PANEL)?.value))) {
    return fluido ? Response.json({ ok: false }, { status: 401 }) : ir("/panel/entrar");
  }

  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("No encontrado", { status: 404 });

  const datos = await req.formData().catch(() => null);
  const get = (k: string) => (datos ? (datos.get(k) as string | null) : null);
  const accion = String(get("accion") ?? "");

  const volver = (q: string) => ir(`/panel/lead/${id}?${q}#seguimiento`);
  const fallo = (e: string) => (fluido ? Response.json({ ok: false, error: e }, { status: 400 }) : volver("error=" + encodeURIComponent(e)));

  try {
    let existe = false;
    switch (accion) {
      case "fase": {
        const f = leerFaseManual(get("fase"));
        if (!f.ok) return fallo(f.error);
        existe = await cambiarFase(id, f.valor);
        break;
      }
      case "propuesta": {
        const p = leerPropuesta(get("estado"));
        if (!p.ok) return fallo(p.error);
        existe = await cambiarPropuesta(id, p.valor);
        break;
      }
      case "reserva": {
        const r = leerReserva(get("reserva"));
        if (!r.ok) return fallo(r.error);
        existe = await fijarReserva(id, r.valor);
        break;
      }
      case "nota": {
        const n = leerNota(get("texto"));
        if (!n.ok) return fallo(n.error);
        existe = await guardarNota(id, n.valor);
        break;
      }
      case "resultado": {
        const r = leerResultado(get);
        if (!r.ok) return fallo(r.error);
        existe = await registrarResultado(id, r.valor);
        break;
      }
      case "enviar_ahora": {
        existe = await enviarAhora(id);
        break;
      }
      case "respuesta_seguimiento": {
        const texto = String(get("texto") ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 1500);
        existe = await forzarRespuestaSeguimiento(id, texto || null);
        break;
      }
      case "pago_manual": {
        const bruto = String(get("importe") ?? "").trim();
        const importe = bruto === "" ? null : aCentimos(bruto);
        if (importe !== null && Number.isNaN(importe)) return fallo("El importe no es válido.");
        existe = await registrarPagoManual(id, importe);
        break;
      }
      case "telefono": {
        const t = leerTelefono(get("telefono"));
        if (!t.ok) return fallo(t.error);
        existe = await guardarTelefono(id, t.valor);
        break;
      }
      case "exito": {
        const x = leerExito(get);
        if (!x.ok) return fallo(x.error);
        existe = await marcarCasoExito(id, x.valor.exito, x.valor.nota);
        break;
      }
      default:
        return fallo("Acción no válida.");
    }
    if (!existe) return new Response("No encontrado", { status: 404 });
    if (!fluido && accion === "enviar_ahora") {
      // Desde la lista se vuelve a la lista (con el mismo filtro); desde la ficha, a la ficha.
      const vuelta = String(get("volver_a") ?? "");
      if (/^\/panel(\?[A-Za-z0-9_=&%.-]*)?$/.test(vuelta)) return ir(`${vuelta}${vuelta.includes("?") ? "&" : "?"}enviado=1`);
    }
    return fluido ? Response.json({ ok: true }) : volver("guardado=" + accion);
  } catch (e) {
    await registrarError("panel", e, { paso: "seguimiento", accion, ficha: id });
    return fallo("No se pudo guardar. Inténtalo de nuevo.");
  }
}
