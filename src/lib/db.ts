import postgres from "postgres";

let conexion: ReturnType<typeof postgres> | undefined;

// Conexión directa a Postgres con el rol "setter_app" (solo ve el schema "setter").
// "prepare: false" es necesario con el pooler de Supabase en modo transacción.
export function sql() {
  if (!conexion) {
    const url = process.env.SETTER_DATABASE_URL;
    if (!url) throw new Error("Falta SETTER_DATABASE_URL");
    // SETTER_DB_SSL=off solo se usa para pruebas con una base de datos local.
    const ssl = process.env.SETTER_DB_SSL === "off" ? false : "require";
    conexion = postgres(url, {
      prepare: false,
      max: 1,
      ssl,
      idle_timeout: 5,
      connect_timeout: 8,
      max_lifetime: 60 * 5,
      fetch_types: false,
    });
  }
  return conexion;
}

// Tira la conexión actual (por ejemplo, si se ha quedado colgada) para que la siguiente consulta abra otra.
export function reiniciar() {
  const c = conexion;
  conexion = undefined;
  c?.end({ timeout: 0 }).catch(() => undefined);
}

class ErrorTiempo extends Error {}

// En Vercel una conexión puede quedarse "muerta" entre peticiones y la consulta no responde nunca.
// Aquí cada trabajo tiene un límite de tiempo: si se agota, se descarta la conexión y se reintenta
// con una nueva. Solo para lecturas y escrituras que se pueden repetir sin efectos.
export async function intentar<T>(
  trabajo: () => Promise<T>,
  opciones: { ms?: number; reintentos?: number } = {},
): Promise<T> {
  const { ms = 5000, reintentos = 1 } = opciones;
  for (let i = 0; ; i++) {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        trabajo(),
        new Promise<never>((_, rechazar) => {
          temporizador = setTimeout(() => rechazar(new ErrorTiempo("La base de datos tardó demasiado")), ms);
        }),
      ]);
    } catch (e) {
      if (e instanceof ErrorTiempo) {
        console.warn("Base de datos: consulta sin respuesta, se descarta la conexión", `(intento ${i + 1})`);
        reiniciar();
        if (i >= reintentos) void import("./errores").then((m) => m.registrarError("base_de_datos", e, { paso: "consulta sin respuesta" })).catch(() => undefined);
        if (i < reintentos) continue;
      }
      throw e;
    } finally {
      clearTimeout(temporizador);
    }
  }
}
