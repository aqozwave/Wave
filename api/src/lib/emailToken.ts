import { createHash, randomBytes } from "node:crypto";
import { EmailTokenPurpose } from "@prisma/client";
import { prisma } from "./prisma.js";

/** Minutos de validez del enlace de confirmación (24h, como el portal viejo). */
const CONFIRM_EXPIRES_MINUTES = Number(
  process.env.EMAIL_CONFIRM_EXPIRES_MINUTES ?? 1440,
);

/** Bytes del token en claro (32 → 64 hex). */
const TOKEN_BYTES = 32;

/** SHA-256 hex del token en claro (así no guardamos el secreto en BD). */
export function hashEmailToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

/** Genera un token en claro aleatorio (solo viaja por correo / log stub). */
export function createPlainEmailToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Invalida tokens previos del mismo propósito y crea uno nuevo.
 * Devuelve el plain para el mail; en BD solo queda el hash.
 */
export async function issueEmailToken(
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<{ plain: string; expiresAt: Date }> {
  const plain = createPlainEmailToken();
  const tokenHash = hashEmailToken(plain);
  const expiresAt = new Date(
    Date.now() + CONFIRM_EXPIRES_MINUTES * 60 * 1000,
  );

  // Un solo confirm activo por usuario: marcamos usados los anteriores.
  await prisma.emailToken.updateMany({
    where: {
      userId,
      purpose,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  await prisma.emailToken.create({
    data: {
      userId,
      purpose,
      tokenHash,
      expiresAt,
    },
  });

  return { plain, expiresAt };
}
