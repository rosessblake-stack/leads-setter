import { NextResponse } from "next/server";

// Redirección con dirección relativa: no depende de qué host cree el servidor que tiene
// (detrás de un proxy puede equivocarse) y la resuelve el propio navegador.
export function ir(ruta: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: ruta, "Cache-Control": "no-store" } });
}

// Solo para los registros: qué tipo de navegador es, sin guardar el identificador completo.
export function tipoNavegador(ua: string | null): string {
  const u = ua ?? "";
  const sistema = /iPhone|iPad|iOS/i.test(u) ? "iOS" : /Android/i.test(u) ? "Android" : /Windows|Macintosh|Linux/i.test(u) ? "ordenador" : "otro";
  const app = /Telegram/i.test(u) ? "Telegram" : /CriOS|Chrome/i.test(u) ? "Chrome" : /FxiOS|Firefox/i.test(u) ? "Firefox" : /Safari/i.test(u) ? "Safari" : "otro";
  return `${sistema}/${app}`;
}
