import { z } from "../../lib/zod.js";

// Contrato de GET /api/v1/health. Si el service devuelve otra forma, parse falla
// y el cliente no recibe un JSON a medias.
export const healthResponseSchema = z
  .object({
    status: z.literal("ok").openapi({ example: "ok" }),
  })
  .openapi("HealthResponse");

export type HealthResponse = z.infer<typeof healthResponseSchema>;
