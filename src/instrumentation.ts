// Next.js llama a esto con cualquier error que se escape sin controlar (páginas y rutas del servidor).
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routeType: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registrarError } = await import("@/lib/errores");
  await registrarError("servidor", err, { ruta: request.path.split("?")[0], metodo: request.method, tipo: context.routeType });
}
