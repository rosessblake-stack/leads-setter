import { createHmac, timingSafeEqual } from "node:crypto";
import { urlPanel } from "@/lib/config";

// El enlace para clientes anteriores lleva un código que se calcula con la clave propia: siempre es el mismo, no hay que
// guardarlo y no se puede adivinar. Para invalidarlo y generar otro, se sube la versión.
const VERSION = "v1";

export function tokenHistorico(): string {
  const clave = Buffer.from((process.env.ENCRYPTION_KEY ?? "").trim(), "base64");
  if (clave.length < 32) throw new Error("Falta ENCRYPTION_KEY (32 bytes en base64)");
  return createHmac("sha256", clave.subarray(0, 32)).update(`clientes-anteriores:${VERSION}`).digest("base64url");
}

export function esTokenHistorico(candidato: string | undefined | null): boolean {
  if (!candidato) return false;
  try {
    const bueno = Buffer.from(tokenHistorico());
    const recibido = Buffer.from(candidato);
    return bueno.length === recibido.length && timingSafeEqual(bueno, recibido);
  } catch {
    return false;
  }
}

export const urlClientesAnteriores = () => `${urlPanel()}/guia?c=${tokenHistorico()}`;
