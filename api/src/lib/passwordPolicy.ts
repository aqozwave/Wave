import { z } from "./zod.js";

/**
 * Política de claves fuertes (register / reset / change / admin).
 * Mínimo 8, mayúscula, minúscula y número.
 */
export const STRONG_PASSWORD_MESSAGE =
  "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número";

/** True si cumple la política (sin Zod; útil en UI/API). */
export function isStrongPassword(value: string): boolean {
  if (value.length < 8) return false;
  if (!/[A-ZÁÉÍÓÚÑ]/.test(value)) return false;
  if (!/[a-záéíóúñ]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return true;
}

/** Schema Zod reutilizable para body de contraseña nueva. */
export const strongPasswordSchema = z
  .string({ error: "Contraseña es requerida" })
  .min(8, { message: STRONG_PASSWORD_MESSAGE })
  .refine(isStrongPassword, { message: STRONG_PASSWORD_MESSAGE });
