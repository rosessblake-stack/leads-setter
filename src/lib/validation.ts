import { z } from "zod";

const texto = (max: number) => z.string().trim().max(max);

export const INTERESES = ["online", "presencial", "asesoria", "no_se"] as const;
export const NIVELES = ["principiante", "intermedio", "avanzado"] as const;

export const FormularioSchema = z.object({
  nombre: texto(80).min(1),
  email: z.string().trim().toLowerCase().email().max(200),
  ig_username: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v.replace(/^@+/, ""))
    .refine((v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v), "usuario de Instagram no válido")
    .optional(),
  pais: texto(60).min(2),
  ciudad: texto(80).optional(),
  zona_horaria: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z_\/+-]+$/)
    .optional(),
  interes: z.enum(INTERESES),
  nivel: z.enum(NIVELES),
  dificultad: texto(1000).min(1),
  objetivo: texto(1000).min(1),
  como_nos_conociste: texto(200).optional(),
  consentimiento: z.literal(true),
  // Identificadores que vienen en el enlace de ManyChat.
  v: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  mc: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  // Campo trampa: las personas no lo ven, los bots sí lo rellenan.
  web: z.string().max(0).optional(),
});

export type Formulario = z.infer<typeof FormularioSchema>;
