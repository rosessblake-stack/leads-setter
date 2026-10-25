// Límite sencillo en memoria. En serverless cada instancia tiene el suyo,
// así que es una barrera básica contra abuso, no una garantía.
const ventana = new Map<string, { n: number; hasta: number }>();

export function permitido(clave: string, max = 5, msVentana = 10 * 60 * 1000): boolean {
  const ahora = Date.now();
  const e = ventana.get(clave);
  if (!e || ahora > e.hasta) {
    ventana.set(clave, { n: 1, hasta: ahora + msVentana });
    return true;
  }
  e.n += 1;
  return e.n <= max;
}
