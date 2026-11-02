import argon2 from "argon2";
import bcrypt from "bcryptjs";

/**
 * Detecta hash bcrypt ($2a$ / $2b$ / $2y$).
 * Usuarios migrados desde Mongo traen bcrypt; altas Wave usan argon2.
 */
function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

/** Hashea una contraseña en claro con argon2 (altas y resets nuevos). */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

/**
 * Compara plain contra el hash guardado.
 * Soporta argon2 (Wave) y bcrypt (ETL portal viejo) sin forzar reset.
 */
export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(plain, hash);
  }
  return argon2.verify(hash, plain);
}
