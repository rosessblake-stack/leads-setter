import { after } from "next/server";
import { sql } from "@/lib/db";
import { registrarError } from "@/lib/errores";
import { permitido } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const ARCHIVO = "/guia-cobrar-y-datos.pdf";

// Enlace del botón «Ver guía» de ManyChat: fuerza la descarga del PDF (en vez de abrirlo en el navegador) y,
// si trae el contacto (`?mc=`), anota en su ficha que la ha descargado por esta vía. Sin `mc` solo descarga.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mc = (url.searchParams.get("mc") ?? "").trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!(await permitido(`guia-descarga:${ip}`, 60, 10 * 60 * 1000))) return new Response("Demasiadas descargas seguidas. Prueba en unos minutos.", { status: 429 });
  const pdf = await fetch(new URL(ARCHIVO, url.origin)).catch(() => null);
  if (!pdf || !pdf.ok || !pdf.body) return new Response("No se pudo preparar la guía.", { status: 502 });
  if (/^\d{3,20}$/.test(mc)) {
    after(async () => {
      try {
        const [f] = await sql()`
          select fi.id as ficha_id, p.id as persona_id from setter.personas p
          join lateral (select id from setter.fichas where persona_id = p.id order by creado_at desc limit 1) fi on true
          where p.manychat_id = ${mc}`;
        if (!f) return;
        await sql().begin(async (tx) => {
          const [ya] = await tx`select 1 as x from setter.eventos where persona_id = ${f.persona_id} and tipo = 'guia_descargada_enlace' and creado_at > now() - interval '10 minutes'`;
          if (ya) return;
          await tx`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'guia_descargada_enlace', ${tx.json({ via: "seguimiento" })})`;
          await tx`insert into setter.notas (ficha_id, texto) values (${f.ficha_id}, 'Seguimiento de la guía · Ha descargado la guía desde el enlace del mensaje.')`;
        });
      } catch (e) {
        await registrarError("manychat", e, { paso: "anotar descarga de la guía" });
      }
    });
  }
  return new Response(pdf.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="guia-cobrar-y-datos.pdf"',
      "cache-control": "no-store",
    },
  });
}
