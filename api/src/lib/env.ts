/**
 * Valida variables críticas al arrancar.
 * Falla temprano si faltan secretos o si access/refresh comparten el mismo.
 */
export function assertRequiredEnv(): void {
  const required = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL"] as const;
  for (const name of required) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Falta variable de entorno ${name}`);
    }
  }

  if (
    process.env.JWT_SECRET!.trim() === process.env.JWT_REFRESH_SECRET!.trim()
  ) {
    throw new Error(
      "JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos",
    );
  }
}

/**
 * ¿Es entorno local/test donde se permiten stubs con secretos en log?
 */
export function isDevLikeEnv(): boolean {
  const env = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  return env === "development" || env === "test";
}

/**
 * Stub de correo sin RESEND_API_KEY.
 * En prod/staging no loguea códigos/tokens; en dev sí (Bruno).
 */
export function logEmailStub(lineWithSecrets: string): void {
  if (isDevLikeEnv()) {
    console.info(lineWithSecrets);
    return;
  }
  console.info(
    "[email.stub] Envío omitido (sin RESEND_API_KEY); secretos no logueados",
  );
}
