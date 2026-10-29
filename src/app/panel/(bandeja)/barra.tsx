"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Cuentas = Partial<Record<"todos" | "sin_contactar" | "por_enviar" | "sin_agendar" | "agendadas" | "vendidos" | "no_vendidos" | "errores", number>>;

type Item = { clave: string; texto: string; href: string; cuenta?: keyof Cuentas; urgente?: boolean };
const GRUPOS: { titulo: string | null; items: Item[] }[] = [
  { titulo: null, items: [{ clave: "todos", texto: "Todos los leads", href: "/panel", cuenta: "todos" }] },
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
    ],
  },
  {
    titulo: "Sistema",
    items: [
      { clave: "estadisticas", texto: "Estadísticas", href: "/panel/estadisticas" },
      { clave: "errores", texto: "Errores", href: "/panel/errores", cuenta: "errores", urgente: true },
      { clave: "ajustes", texto: "Ajustes", href: "/panel/ajustes" },
    ],
  },
];

function activaClave(pathname: string, vista: string | null): string | null {
  if (pathname === "/panel") return vista ?? "todos";
  if (pathname.startsWith("/panel/estadisticas")) return "estadisticas";
  if (pathname.startsWith("/panel/errores")) return "errores";
  if (pathname.startsWith("/panel/ajustes")) return "ajustes";
  return null;
}

export function Barra() {
  const pathname = usePathname();
  const params = useSearchParams();
  const vista = params.get("vista");
  const [cuentas, setCuentas] = useState<Cuentas>({});
  const [abierta, setAbierta] = useState(false);
  const activa = activaClave(pathname, vista);

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
