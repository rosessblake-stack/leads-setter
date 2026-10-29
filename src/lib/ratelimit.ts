import { sql } from "@/lib/db";

// Límite de peticiones compartido entre todas las instancias (vive en la base de datos).
// Si la base de datos no responde, se usa un contador local para no dejar la web sin protección.
const local = new Map<string, { n: number; hasta: number }>();

function enMemoria(clave: string, max: number, msVentana: number): boolean {
  const ahora = Date.now();
  const e = local.get(clave);
  if (!e || ahora > e.hasta) {
    local.set(clave, { n: 1, hasta: ahora + msVentana });
    return true;
  }
  e.n += 1;
  return e.n <= max;
}

export async function permitido(clave: string, max = 5, msVentana = 10 * 60 * 1000): Promise<boolean> {
  try {
    const [f] = await Promise.race([
      sql()`
        insert into setter.limites (clave, ventana_hasta, n)
        values (${clave}, now() + ${msVentana} * interval '1 millisecond', 1)
        on conflict (clave) do update set
          n = case when setter.limites.ventana_hasta < now() then 1 else setter.limites.n + 1 end,
          ventana_hasta = case when setter.limites.ventana_hasta < now() then excluded.ventana_hasta else setter.limites.ventana_hasta end
        returning n`,
      new Promise<never>((_, no) => setTimeout(() => no(new Error("tiempo agotado")), 3000)),
    ]);
    return (f.n as number) <= max;
  } catch {
    return enMemoria(clave, max, msVentana);
  }
}
