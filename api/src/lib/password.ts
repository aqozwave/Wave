import argon2 from "argon2";

/** Hashea una contraseña en claro con argon2 (único algoritmo en Wave). */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

/** Compara plain contra el hash guardado; true si coinciden. */
export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  return argon2.verify(hash, plain);
}
