import { createHash, randomInt, randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";

/** Minutos de validez del código (default 10, como el portal viejo). */
export const MFA_EXPIRES_MINUTES = Number(
  process.env.LOGIN_MFA_CODE_EXPIRES_MINUTES ?? 10,
);

/** Intentos máximos por challenge. */
export const MFA_MAX_ATTEMPTS = Number(
  process.env.LOGIN_MFA_MAX_ATTEMPTS ?? 5,
);

/** SHA-256 del código de 6 dígitos. */
export function hashLoginCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

/** Genera un código numérico de 6 dígitos. */
export function generateLoginCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

/**
 * Invalida challenges previos del usuario y crea uno nuevo.
 * Devuelve el código en claro solo para el mail.
 */
export async function createLoginChallenge(userId: string): Promise<{
  challengeId: string;
  code: string;
  expiresAt: Date;
}> {
  await prisma.loginChallenge.deleteMany({ where: { userId } });

  const code = generateLoginCode();
  const challengeId = randomUUID();
  const expiresAt = new Date(Date.now() + MFA_EXPIRES_MINUTES * 60_000);

  await prisma.loginChallenge.create({
    data: {
      challengeId,
      userId,
      codeHash: hashLoginCode(code),
      expiresAt,
    },
  });

  return { challengeId, code, expiresAt };
}

/** Resultado de verificar un código MFA. */
export type VerifyChallengeResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason: "not_found" | "expired" | "invalid_code" | "max_attempts";
      remainingAttempts?: number;
    };

/**
 * Valida el código; borra el challenge si ok o expirado / max intentos.
 */
export async function verifyLoginChallenge(
  challengeId: string,
  code: string,
): Promise<VerifyChallengeResult> {
  const challenge = await prisma.loginChallenge.findUnique({
    where: { challengeId },
  });

  if (!challenge) {
    return { ok: false, reason: "not_found" };
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    await prisma.loginChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, reason: "expired" };
  }

  if (challenge.codeHash !== hashLoginCode(code)) {
    const attempts = challenge.attempts + 1;
    if (attempts >= MFA_MAX_ATTEMPTS) {
      await prisma.loginChallenge.delete({ where: { id: challenge.id } });
      return { ok: false, reason: "max_attempts" };
    }
    await prisma.loginChallenge.update({
      where: { id: challenge.id },
      data: { attempts },
    });
    return {
      ok: false,
      reason: "invalid_code",
      remainingAttempts: MFA_MAX_ATTEMPTS - attempts,
    };
  }

  const userId = challenge.userId;
  await prisma.loginChallenge.delete({ where: { id: challenge.id } });
  return { ok: true, userId };
}
