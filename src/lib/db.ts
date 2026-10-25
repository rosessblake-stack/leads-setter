import postgres from "postgres";

let conexion: ReturnType<typeof postgres> | undefined;

// Conexión directa a Postgres con el rol "setter_app" (solo ve el schema "setter").
// "prepare: false" es necesario con el pooler de Supabase en modo transacción.
export function sql() {
  if (!conexion) {
    const url = process.env.SETTER_DATABASE_URL;
    if (!url) throw new Error("Falta SETTER_DATABASE_URL");
    conexion = postgres(url, { prepare: false, max: 1, ssl: "require", idle_timeout: 20 });
  }
  return conexion;
}
