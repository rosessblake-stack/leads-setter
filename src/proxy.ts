import { NextResponse, type NextRequest } from "next/server";

// Respuesta inmediata para quien no tiene sesión: sin cookie no se llega ni a cargar el panel.
// (Que la sesión sea válida se comprueba después en cada página, contra la base de datos.)
export function proxy(req: NextRequest) {
  if (!req.cookies.has("panel_sesion")) {
    return NextResponse.redirect(new URL("/panel/entrar", req.url), 303);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/panel", "/panel/lead/:path*"] };
