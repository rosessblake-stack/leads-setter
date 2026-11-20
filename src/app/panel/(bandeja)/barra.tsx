"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ClaveCuenta = "todos" | "sin_contactar" | "por_enviar" | "sin_agendar" | "agendadas" | "vendidos" | "no_vendidos" | "casos_exito" | "errores";
type Cuentas = Partial<Record<ClaveCuenta, number>> & { rutas?: Record<string, number> };

const TIPOS = [
  { ruta: "asesoria", texto: "Leads de asesoría" },
  { ruta: "presencial", texto: "Leads de formación" },
  { ruta: "online", texto: "Leads de curso online" },
  { ruta: "no_claro", texto: "Leads sin definir" },
] as const;
const VIAS = [
  { via: null, texto: "Todos" },
  { via: "historia", texto: "Historias" },
  { via: "reel", texto: "Reels y vídeos" },
  { via: "otros", texto: "Sin vídeo ni historia" },
] as const;

type Item = { clave: string; texto: string; href: string; cuenta?: ClaveCuenta; urgente?: boolean };
const GRUPOS: { titulo: string | null; items: Item[] }[] = [
  {
    titulo: "Por hacer",
    items: [
      { clave: "sin_contactar", texto: "Sin contactar +24 h", href: "/panel?vista=sin_contactar", cuenta: "sin_contactar", urgente: true },
      { clave: "por_enviar", texto: "Por enviar propuesta", href: "/panel?vista=por_enviar", cuenta: "por_enviar" },
    ],
  },
  {
    titulo: "En marcha",
    items: [
      { clave: "sin_agendar", texto: "Sin agendar llamada", href: "/panel?vista=sin_agendar", cuenta: "sin_agendar" },
      { clave: "agendadas", texto: "Llamadas agendadas", href: "/panel?vista=agendadas", cuenta: "agendadas" },
    ],
  },
  {
    titulo: "Cerrados",
    items: [
      { clave: "vendidos", texto: "Vendidos", href: "/panel?vista=vendidos", cuenta: "vendidos" },
      { clave: "no_vendidos", texto: "No vendidos", href: "/panel?vista=no_vendidos", cuenta: "no_vendidos" },
      { clave: "casos_exito", texto: "Casos de éxito", href: "/panel?vista=casos_exito", cuenta: "casos_exito" },
    ],
  },
  {
    titulo: "Sistema",
    items: [
      { clave: "estadisticas", texto: "Estadísticas", href: "/panel/estadisticas" },
      { clave: "videos", texto: "Vídeos e historias", href: "/panel/videos" },
      { clave: "embudo", texto: "Embudo del formulario", href: "/panel/embudo" },
      { clave: "errores", texto: "Errores", href: "/panel/errores", cuenta: "errores", urgente: true },
      { clave: "ajustes", texto: "Ajustes", href: "/panel/ajustes" },
    ],
  },
];

function activaClave(pathname: string, vista: string | null, ruta: string | null, via: string | null): string | null {
  if (pathname === "/panel") return vista ?? (ruta ? `ruta:${ruta}:${via ?? ""}` : "todos");
  if (pathname.startsWith("/panel/estadisticas")) return "estadisticas";
  if (pathname.startsWith("/panel/errores")) return "errores";
  if (pathname.startsWith("/panel/videos")) return "videos";
  if (pathname.startsWith("/panel/embudo")) return "embudo";
  if (pathname.startsWith("/panel/ajustes")) return "ajustes";
  return null;
}

export function Barra() {
  const pathname = usePathname();
  const params = useSearchParams();
  const vista = params.get("vista");
  const ruta = params.get("ruta");
  const via = params.get("via");
  const [cuentas, setCuentas] = useState<Cuentas>({});
  const [abierta, setAbierta] = useState(false);
  const activa = activaClave(pathname, vista, ruta, via);

  // Los números se piden aparte, así la barra no desaparece mientras carga cada pantalla.
  useEffect(() => {
    const control = new AbortController();
    const cargar = () =>
      fetch("/panel/cuentas", { credentials: "same-origin", signal: control.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.ok && setCuentas(j))
        .catch(() => undefined);
    cargar();
    window.addEventListener("focus", cargar);
    return () => {
      control.abort();
      window.removeEventListener("focus", cargar);
    };
  }, [pathname, params]);

  useEffect(() => setAbierta(false), [pathname, params]);

  const pendientes = (cuentas.sin_contactar ?? 0) + (cuentas.errores ?? 0);

  return (
    <>
      <div className="barra-superior">
        <button type="button" className="menu-boton" aria-expanded={abierta} aria-controls="barra-lateral" onClick={() => setAbierta((a) => !a)}>
          <span aria-hidden="true">☰</span> Menú
          {pendientes > 0 && <span className="punto" aria-label={`${pendientes} cosas por revisar`} />}
        </button>
      </div>
      {abierta && <div className="barra-velo" onClick={() => setAbierta(false)} aria-hidden="true" />}
      <nav id="barra-lateral" className={`barra${abierta ? " abierta" : ""}`} aria-label="Panel">
        <p className="barra-marca">Leads</p>
        <div className="barra-grupo">
          <Link href="/panel" className={`barra-enlace${activa === "todos" ? " activa" : ""}`} aria-current={activa === "todos" ? "page" : undefined}>
            <span>Todos los leads</span>
            {cuentas.todos !== undefined && <span className="barra-cuenta">{cuentas.todos}</span>}
          </Link>
        </div>
        <div className="barra-grupo">
          <p className="barra-titulo">Por tipo</p>
          {TIPOS.map((t) => {
            const total = cuentas.rutas?.[t.ruta];
            const abierto = ruta === t.ruta && pathname === "/panel" && !vista;
            return (
              <details className="barra-tipo" key={t.ruta} open={abierto}>
                <summary className={`barra-enlace${activa?.startsWith(`ruta:${t.ruta}:`) ? " activa" : ""}`}>
                  <span>{t.texto}</span>
                  <span className="barra-cuenta">{total ?? 0}</span>
                </summary>
                {VIAS.map((v) => {
                  const clave = `ruta:${t.ruta}:${v.via ?? ""}`;
                  const n = v.via ? (cuentas.rutas?.[`${t.ruta}:${v.via}`] ?? (cuentas.rutas ? 0 : undefined)) : total ?? (cuentas.rutas ? 0 : undefined);
                  return (
                    <Link
                      key={clave}
                      href={`/panel?ruta=${t.ruta}${v.via ? `&via=${v.via}` : ""}`}
                      className={`barra-enlace barra-sub${activa === clave ? " activa" : ""}`}
                      aria-current={activa === clave ? "page" : undefined}
                    >
                      <span>{v.texto}</span>
                      {n !== undefined && <span className="barra-cuenta">{n}</span>}
                    </Link>
                  );
                })}
              </details>
            );
          })}
        </div>
        {GRUPOS.map((g, i) => (
          <div className="barra-grupo" key={i}>
            {g.titulo && <p className="barra-titulo">{g.titulo}</p>}
            {g.items.map((it) => {
              const n = it.cuenta ? cuentas[it.cuenta] : undefined;
              return (
                <Link key={it.clave} href={it.href} className={`barra-enlace${activa === it.clave ? " activa" : ""}`} aria-current={activa === it.clave ? "page" : undefined}>
                  <span>{it.texto}</span>
                  {n !== undefined && (it.clave === "todos" || n > 0 || !it.urgente) && (
                    <span className={`barra-cuenta${it.urgente && n > 0 ? " urgente" : ""}`}>{n}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
        <form method="post" action="/panel/salir" className="barra-salir">
          <button type="submit" className="secundario">
            Salir
          </button>
        </form>
      </nav>
    </>
  );
}
