import { z } from "zod";

// Sobre del envío. Las respuestas se validan después, pregunta a pregunta,
// con el archivo de preguntas (src/formulario/preguntas.json).
export const PayloadSchema = z.object({
  respuestas: z.record(z.string().max(24), z.unknown()),
  iniciado_at: z.string().datetime().optional(),
  zona_horaria: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z_\/+-]+$/)
    .optional(),
  consentimiento: z.literal(true),
  // Identificadores que vienen en el enlace de ManyChat.
  v: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  mc: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  // Campo trampa: las personas no lo ven, los bots sí lo rellenan.
  web: z.string().max(0).optional(),
});

export type Payload = z.infer<typeof PayloadSchema>;
