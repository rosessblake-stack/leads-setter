import postgres from "postgres";

// El estado vive en globalThis: cada ruta de Next.js se compila por separado y, sin esto, cada una tendría
// su propia conexión y su propia cola. Así toda la instancia comparte una conexión y un orden.
type Estado = { conexion?: ReturnType<typeof postgres>; cola: Promise<void> };
const global = globalThis as typeof globalThis & { __setterDb?: Estado };
const estado: Estado = (global.__setterDb ??= { cola: Promise.resolve() });

// Conexión directa a Postgres con el rol "setter_app" (solo ve el schema "setter").
// "prepare: false" es necesario con el pooler de Supabase en modo transacción.
export function sql() {
  if (!estado.conexion) {
    const url = process.env.SETTER_DATABASE_URL;
    if (!url) throw new Error("Falta SETTER_DATABASE_URL");
    // SETTER_DB_SSL=off solo se usa para pruebas con una base de datos local.
    const ssl = process.env.SETTER_DB_SSL === "off" ? false : "require";
    estado.conexion = postgres(url, {
      prepare: false,
      max: 1,
      ssl,
      idle_timeout: 5,
      connect_timeout: 8,
      max_lifetime: 60 * 5,
      fetch_types: false,
    });
  }
  return estado.conexion;
}

// Tira la conexión actual (por ejemplo, si se ha quedado colgada) para que la siguiente consulta abra otra.
export function reiniciar() {
  const c = estado.conexion;
  estado.conexion = undefined;
  c?.end({ timeout: 0 }).catch(() => undefined);
}

class ErrorTiempo extends Error {}

// En Vercel una conexión puede quedarse "muerta" entre peticiones y la consulta no responde nunca.
// Aquí cada trabajo tiene un límite de tiempo: si se agota, se descarta la conexión y se reintenta
// con una nueva. Solo para lecturas y escrituras que se pueden repetir sin efectos.
export function intentar<T>(trabajo: () => Promise<T>, opciones: { ms?: number; reintentos?: number } = {}): Promise<T> {
  // En cola: los trabajos de esta instancia van de uno en uno. Con la conexión única, dos páginas a la vez
  // (por ejemplo la lista y los números de la barra lateral) no mezclan sus consultas.
  const resultado = estado.cola.then(() => ejecutar(trabajo, opciones));
  estado.cola = resultado.then(
    () => undefined,
    () => undefined,
  );
  return resultado;
}

async function ejecutar<T>(trabajo: () => Promise<T>, opciones: { ms?: number; reintentos?: number }): Promise<T> {
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
