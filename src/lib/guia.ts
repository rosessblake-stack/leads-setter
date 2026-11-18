import { timingSafeEqual } from "node:crypto";
import { urlPanel } from "@/lib/config";
import { sql } from "@/lib/db";
import { registrarError } from "@/lib/errores";
import { buscarFlujoSeguimiento, ErrorManyChat, infoContacto, lanzarSeguimientoGuia, manychatConfigurado } from "@/lib/manychat";
import { enHorarioDeEnvio, enlacePago, VENTANA_SEGURA_H } from "@/lib/propuestas";
import { avisarAdmin, escaparHtml } from "@/lib/telegram";

// Cuántas horas después de descargar la guía se lanza el mensaje de seguimiento. Debe ser menor que la ventana de 24 h de Instagram.
export const HORAS_ESPERA_GUIA = 18;

export const PASOS_SEGUIMIENTO = ["opinion", "aprendio", "asesoria"] as const;
export type PasoSeguimiento = (typeof PASOS_SEGUIMIENTO)[number];
export const ETIQUETA_PASO: Record<PasoSeguimiento, string> = {
  opinion: "Qué le pareció la guía",
  aprendio: "Qué aprendió",
  asesoria: "¿Quiere trabajarlo en una asesoría?",
};

// «Sí», «si, me interesa», «Sí, quiero»… (también tal cual el texto de un botón).
export function esAfirmativo(texto: string): boolean {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return /^(si|claro|vale|quiero|me interesa|por supuesto|dale|ok)\b/.test(t);
}

// ManyChat puede meter el texto de la persona sin escapar las comillas y romper el JSON: si no se puede leer, se intenta sacar
// los tres campos a mano (el texto es lo último del cuerpo).
export function leerCuerpoManychat(t: string): { mc?: unknown; paso?: unknown; texto?: unknown } | null {
  try {
    const d = JSON.parse(t);
    return d && typeof d === "object" ? d : null;
  } catch {
    const campo = (k: string) => new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`).exec(t)?.[1];
    const texto = /"texto"\s*:\s*"([\s\S]*)"\s*}\s*$/.exec(t)?.[1];
    const mc = campo("mc");
    const paso = campo("paso");
    return mc !== undefined && paso !== undefined && texto !== undefined ? { mc, paso, texto } : null;
  }
}

// Lo que puede mandar ManyChat: un solo paso (`paso` + `texto`) o varias respuestas a la vez (`opinion`, `aprendio`, `asesoria`).
export type PeticionManychat = { mc?: unknown; paso?: unknown; texto?: unknown; opinion?: unknown; aprendio?: unknown; asesoria?: unknown };
const CLAVES_PETICION = ["mc", "paso", "texto", "opinion", "aprendio", "asesoria"] as const;

// Acepta el cuerpo como JSON, como formulario (clave=valor&clave=valor) o, en último caso, como parámetros de la dirección.
export function leerPeticionManychat(t: string, tipo: string | null, busqueda: URLSearchParams): PeticionManychat | null {
  let d: PeticionManychat | null = null;
  if (t.trim() !== "") {
    if ((tipo ?? "").includes("application/x-www-form-urlencoded")) {
      const f = new URLSearchParams(t);
      d = Object.fromEntries(CLAVES_PETICION.map((k) => [k, f.get(k) ?? undefined]));
    } else {
      d = leerCuerpoManychat(t);
    }
  }
  const salida: PeticionManychat = Object.fromEntries(CLAVES_PETICION.map((k) => [k, (d as Record<string, unknown> | null)?.[k] ?? busqueda.get(k) ?? undefined]));
  return CLAVES_PETICION.every((k) => salida[k] === undefined) ? null : salida;
}

// Las respuestas que trae la petición, en orden: o un solo paso, o todas las que vengan rellenas.
export function respuestasDe(d: PeticionManychat): { paso: string; texto: string }[] {
  if (d.paso !== undefined) return [{ paso: String(d.paso), texto: String(d.texto ?? "").trim() }];
  return PASOS_SEGUIMIENTO.map((paso) => ({ paso: paso as string, texto: String(d[paso] ?? "").trim() })).filter((r) => r.texto !== "");
}

export function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido || esperado.length < 16) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Candidato = {
  persona_id: string;
  ficha_id: string;
  nombre: string;
  email: string;
  instagram: string | null;
  zona: string | null;
  manychat_id: string;
  descargo_at: Date;
};

const norm = (x: string | null) => (x ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").toLowerCase();

// Lo llama el temporizador. A quien descargó la guía hace entre 18 y 23 h, le lanza el flujo «Seguimiento guía» de ManyChat,
// con el enlace de pago de la asesoría ya puesto. Solo si se puede comprobar que es de verdad esa persona y que la ventana de
// 24 h de Instagram sigue abierta; si no, se avisa a Blake para que escriba a mano.
export async function procesarSeguimientoGuia(ahora = new Date()): Promise<number> {
  if (!manychatConfigurado()) return 0;
  const candidatos = (await sql()`
    select p.id as persona_id, fi.id as ficha_id, p.nombre, p.email, p.ig_username as instagram, p.zona_horaria as zona, p.manychat_id, ef.en as descargo_at
    from setter.eventos e
    join setter.embudo_formulario ef on ef.sesion = e.datos ->> 'sesion' and ef.paso = 'pdf_ok'
    join setter.personas p on p.id = e.persona_id
    join lateral (select id from setter.fichas where persona_id = p.id order by creado_at desc limit 1) fi on true
    where e.tipo = 'formulario_enviado' and e.datos ->> 'sesion' is not null
      and ef.en <= ${new Date(ahora.getTime() - HORAS_ESPERA_GUIA * 3600_000)}
      and ef.en > ${new Date(ahora.getTime() - 23 * 3600_000)}
      and p.manychat_id is not null
      and not exists (select 1 from setter.eventos x where x.persona_id = p.id and x.tipo in ('seguimiento_guia_lanzado', 'seguimiento_guia_omitido'))
    order by ef.en limit 5`) as unknown as Candidato[];

  if (candidatos.length === 0) return 0;
  // Sin el flujo en ManyChat no se reclama a nadie: así, cuando exista, todavía se les puede lanzar.
  try {
    if (!(await buscarFlujoSeguimiento())) {
      await registrarError("manychat", "No encuentro en ManyChat un único flujo llamado «Seguimiento guía»", { pendientes: candidatos.length });
      return 0;
    }
  } catch (e) {
    await registrarError("manychat", e, { paso: "buscar el flujo de seguimiento de la guía" });
    return 0;
  }

  let lanzados = 0;
  for (const c of candidatos) {
    try {
      const omitir = async (motivo: string) => {
        await sql()`insert into setter.eventos (persona_id, tipo, datos) values (${c.persona_id}, 'seguimiento_guia_omitido', ${sql().json({ motivo })})`;
        await avisarAdmin(`⚠️ No se lanzó el seguimiento de la guía a <b>${escaparHtml(c.nombre.slice(0, 60))}</b>: ${escaparHtml(motivo)}. Escríbele tú si quieres.\n${urlPanel()}/panel/lead/${c.ficha_id}`).catch(() => false);
      };
      const info = await infoContacto(c.manychat_id);
      if (!info.instagram || norm(c.instagram) === "" || info.instagram !== norm(c.instagram)) {
        await omitir("no se pudo comprobar que el contacto de ManyChat es la misma persona");
        continue;
      }
      const desde = info.ultimaInteraccion ?? new Date(c.descargo_at);
      const horas = (ahora.getTime() - desde.getTime()) / 3600_000;
      if (horas > VENTANA_SEGURA_H) {
        await omitir("la ventana de 24 h de Instagram ya está cerrada");
        continue;
      }
      if (!enHorarioDeEnvio(ahora, c.zona)) {
        // De noche en su zona: se espera al siguiente ciclo, salvo que la ventana esté a punto de cerrarse.
        if (VENTANA_SEGURA_H - horas < 3) await omitir("es de noche para esta persona y la ventana de 24 h se cierra pronto");
        continue;
      }
      const pagoBase = process.env.STRIPE_LINK_ASESORIA ?? "";
      if (!pagoBase) {
        await registrarError("propuestas", "Falta el enlace de pago de la asesoría para el seguimiento de la guía", { ficha: c.ficha_id });
        continue;
      }
      // Se reclama antes de enviar: si el envío se cortara, no se repite solo.
      const [reclamado] = await sql()`
        insert into setter.eventos (persona_id, tipo, datos)
        select ${c.persona_id}, 'seguimiento_guia_lanzado', '{}'::jsonb
        where not exists (select 1 from setter.eventos x where x.persona_id = ${c.persona_id} and x.tipo in ('seguimiento_guia_lanzado', 'seguimiento_guia_omitido'))
        returning id`;
      if (!reclamado) continue;
      try {
        await lanzarSeguimientoGuia(c.manychat_id, enlacePago(pagoBase, c.ficha_id, c.email));
      } catch (e) {
        const incierto = e instanceof ErrorManyChat && !e.definitivo;
        await registrarError("manychat", e, { paso: "lanzar seguimiento de la guía", ficha: c.ficha_id, incierto });
        await avisarAdmin(`⚠️ ${incierto ? "No sé si salió" : "No se pudo lanzar"} el seguimiento de la guía a <b>${escaparHtml(c.nombre.slice(0, 60))}</b>: ${escaparHtml(e instanceof Error ? e.message : "error")}\n${urlPanel()}/panel/lead/${c.ficha_id}`).catch(() => false);
        continue;
      }
      lanzados++;
      await avisarAdmin(`📨 Seguimiento de la guía lanzado a <b>${escaparHtml(c.nombre.slice(0, 60))}</b>.\n${urlPanel()}/panel/lead/${c.ficha_id}`).catch(() => false);
    } catch (e) {
      await registrarError("manychat", e, { paso: "seguimiento de la guía", ficha: c.ficha_id });
    }
  }
  return lanzados;
}

// Guarda una respuesta que ManyChat manda desde el flujo de seguimiento. Devuelve false si no hay nadie con ese contacto.
export async function guardarRespuestaSeguimiento(mc: string, paso: PasoSeguimiento, texto: string): Promise<boolean> {
  const [f] = await sql()`
    select fi.id as ficha_id, p.id as persona_id, p.nombre from setter.personas p
    join lateral (select id from setter.fichas where persona_id = p.id order by creado_at desc limit 1) fi on true
    where p.manychat_id = ${mc}`;
  if (!f) return false;
  const limpio = texto.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
  await sql().begin(async (tx) => {
    await tx`insert into setter.notas (ficha_id, texto) values (${f.ficha_id}, ${`Seguimiento de la guía · ${ETIQUETA_PASO[paso]}: ${limpio}`.slice(0, 2000)})`;
    await tx`insert into setter.eventos (persona_id, tipo, datos) values (${f.persona_id}, 'seguimiento_respuesta', ${tx.json({ paso, afirmativo: paso === "asesoria" ? esAfirmativo(limpio) : null })})`;
  });
  if (paso === "asesoria") {
    const si = esAfirmativo(limpio);
    await avisarAdmin(
      si
        ? `🔥 <b>${escaparHtml(String(f.nombre).slice(0, 60))}</b> quiere trabajar contigo en una asesoría (respondió que sí tras la guía). Se le ha pasado el enlace de pago.\n${urlPanel()}/panel/lead/${f.ficha_id}`
        : `ℹ️ <b>${escaparHtml(String(f.nombre).slice(0, 60))}</b> respondió «${escaparHtml(limpio.slice(0, 80))}» a la asesoría tras la guía.\n${urlPanel()}/panel/lead/${f.ficha_id}`,
    ).catch(() => false);
  }
  return true;
}
