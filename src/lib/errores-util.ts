// Utilidades puras del registro de errores (sin base de datos, para poder probarlas).

export const ORIGENES = ["servidor", "google", "manychat", "telegram", "claude", "reservas", "propuestas", "formulario", "panel", "base_de_datos"] as const;
export type Origen = (typeof ORIGENES)[number];

export const NOMBRE_ORIGEN: Record<Origen, string> = {
  servidor: "Servidor",
  google: "Google",
  manychat: "ManyChat",
  telegram: "Telegram",
  claude: "Análisis con Claude",
  reservas: "Reservas",
  propuestas: "Propuestas",
  formulario: "Formulario",
  panel: "Panel",
  base_de_datos: "Base de datos",
};

// Quita lo que no debe guardarse: emails y cadenas largas que podrían ser claves o enlaces personales.
export function limpiarMensaje(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[…]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

// Solo identificadores y valores cortos: nada de textos escritos por las personas.
export function limpiarContexto(c: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const salida: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(c).slice(0, 10)) {
    if (v === null || typeof v === "number" || typeof v === "boolean") salida[k] = v;
    else if (typeof v === "string") salida[k] = limpiarMensaje(v).slice(0, 120);
  }
  return salida;
}

// Explicación en español de la causa probable y qué hacer. Si no se reconoce, devuelve null.
export function pista(origen: string, mensaje: string): string | null {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid_client")) return "Google no reconoce el ID o el secreto de la aplicación. Revisa en Vercel GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET: tienen que ser del mismo cliente de Google, sin espacios.";
  if (m.includes("redirect_uri_mismatch")) return "La dirección de vuelta no coincide con la de Google Cloud. Tiene que ser exactamente https://leads-setter.vercel.app/api/google/callback.";
  if (m.includes("invalid_grant")) return "Google rechazó el permiso (caducado o ya usado). Vuelve a pulsar «Conectar Google» en Ajustes.";
  if (m.includes("google no está conectado")) return "Falta conectar Google en Ajustes.";
  if (origen === "google" && /\b40[13]\b/.test(m)) return "Google rechazó la petición. Prueba a volver a conectar Google en Ajustes.";
  if (m.includes("no encuentro en manychat")) return "En ManyChat no hay un único flujo con ese nombre. Tienen que llamarse «Propuesta llamada» y «Propuesta asesoría», y estar activos.";
  if (origen === "manychat" && /\b40[13]\b/.test(m)) return "ManyChat rechazó la clave. Revisa MANYCHAT_API_KEY en Vercel (plan Pro) y vuelve a desplegar.";
  if (origen === "manychat" && m.includes("subscriber")) return "ManyChat no encuentra a esa persona (identificador incorrecto o ya no es contacto).";
  if (origen === "manychat" && (m.includes("24") || m.includes("window"))) return "Instagram no deja escribir primero pasadas 24 horas desde el último mensaje de la persona. Envía el mensaje a mano.";
  if (origen === "telegram" && m.includes("403")) return "Telegram no deja escribirte: abre el bot y pulsa Start, o revisa TELEGRAM_ADMIN_CHAT_ID.";
  if (origen === "claude" && /\b401\b|authentication/.test(m)) return "La clave de Claude (ANTHROPIC_API_KEY) no es válida o no tiene saldo.";
  if (origen === "claude" && m.includes("credit")) return "La cuenta de Claude se ha quedado sin saldo.";
  if (m.includes("tardó demasiado") || m.includes("sin respuesta")) return "La base de datos tardó demasiado. Suele ser puntual: si se repite, avísame.";
  if (m.includes("falta setter_database_url")) return "Falta la variable SETTER_DATABASE_URL en Vercel.";
  if (m.includes("falta el enlace de pago")) return "Falta STRIPE_LINK_ASESORIA en Vercel.";
  return null;
}
