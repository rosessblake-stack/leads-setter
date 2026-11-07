import { ZONA } from "@/lib/disponibilidad";

// Zona horaria de la persona (la que dio su navegador al rellenar el formulario) si es válida y distinta de la de Blake.
// Si no hay zona, no es válida o es la de España, devuelve null y todo se muestra en hora de España.
export function zonaPersona(z: string | null | undefined): string | null {
  if (!z || z === ZONA) return null;
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: z });
  } catch {
    return null;
  }
  // Madrid y otras zonas con la misma hora en esa fecha no necesitan aviso, pero no pasa nada por mostrarlo.
  return z;
}

// «Montevideo» a partir de «America/Montevideo».
export function nombreZona(z: string): string {
  return z.split("/").pop()!.replace(/_/g, " ");
}
