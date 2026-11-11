import { z } from "../../lib/zod.js";

/** Tags de aplica-a (crew / persona externa). */
export const trainingAppliesToTagSchema = z.enum(["crew", "external_person"]);

/** Una capacitación en respuestas de API. */
export const trainingResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    code: z.string(),
    name: z.string(),
    validityMonths: z.number().int().positive().nullable(),
    appliesTo: z.array(trainingAppliesToTagSchema),
    documentTypeId: z.uuid().nullable(),
    documentType: z
      .object({
        id: z.uuid(),
        code: z.string(),
        name: z.string(),
      })
      .nullable(),
    active: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Training");

/** Query GET /trainings. */
export const listTrainingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  businessId: z.uuid().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  search: z.string().trim().optional(),
});

export const listTrainingsRequestSchema = z.object({
  query: listTrainingsQuerySchema,
});

export const listTrainingsResponseSchema = z
  .object({
    items: z.array(trainingResponseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  })
  .openapi("ListTrainingsResponse");

export const trainingIdParamsSchema = z.object({ id: z.uuid() });

export const getTrainingRequestSchema = z.object({
  params: trainingIdParamsSchema,
});

export const getTrainingResponseSchema = trainingResponseSchema;

/**
 * Código corto: letras, dígitos y guión (EXT-01, IND-SEG, ODI-01).
 * Se normaliza a mayúsculas.
 */
const trainingCodeSchema = z
  .string({ error: "Código es requerido" })
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9][A-Z0-9-]{0,14}$/.test(v), {
    message: "Código: 1–15 caracteres (letras, dígitos, guión)",
  });

/**
 * Shape base sin refine (Zod 4: .partial() no admite refinements previos).
 */
const trainingFieldsObjectSchema = z.object({
  code: trainingCodeSchema,
  name: z
    .string({ error: "Nombre es requerido" })
    .trim()
    .min(1, "Nombre es requerido"),
  /** null = sin vencimiento; omitido en create → null. */
  validityMonths: z.number().int().positive().nullable().optional(),
  appliesTo: z.array(trainingAppliesToTagSchema).optional(),
  /** null limpia el vínculo; omitido = no cambia (update) / null (create). */
  documentTypeId: z.uuid().nullable().optional(),
  /** Superadmin: empresa dueña al crear. */
  businessId: z.uuid().optional(),
  active: z.boolean().optional(),
});

export const createTrainingBodySchema = trainingFieldsObjectSchema;

export const createTrainingRequestSchema = z.object({
  body: createTrainingBodySchema,
});

export const createTrainingResponseSchema = trainingResponseSchema;

export const updateTrainingBodySchema = trainingFieldsObjectSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const updateTrainingRequestSchema = z.object({
  params: trainingIdParamsSchema,
  body: updateTrainingBodySchema,
});

export const updateTrainingResponseSchema = trainingResponseSchema;

export const deleteTrainingRequestSchema = z.object({
  params: trainingIdParamsSchema,
});

export const deleteTrainingResponseSchema = trainingResponseSchema;

export type ListTrainingsQuery = z.infer<typeof listTrainingsQuerySchema>;
export type TrainingResponse = z.infer<typeof trainingResponseSchema>;
export type CreateTrainingBody = z.infer<typeof createTrainingBodySchema>;
export type UpdateTrainingBody = z.infer<typeof updateTrainingBodySchema>;
