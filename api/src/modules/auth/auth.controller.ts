import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { refreshTtlMs } from "../../lib/tokens.js";
import {
  confirmEmailResponseSchema,
  deleteMyPhotoResponseSchema,
  forgotPasswordResponseSchema,
  loginResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
  mfaChallengeResponseSchema,
  refreshResponseSchema,
  registerResponseSchema,
  resendConfirmationResponseSchema,
  resendMfaResponseSchema,
  resetPasswordResponseSchema,
  changeMyPasswordResponseSchema,
  updateMeResponseSchema,
  uploadMyPhotoResponseSchema,
  type ChangeMyPasswordBody,
  type ConfirmEmailBody,
  type ForgotPasswordBody,
  type LoginBody,
  type RefreshBody,
  type RegisterBody,
  type ResendConfirmationBody,
  type ResendMfaBody,
  type ResetPasswordBody,
  type UpdateMeBody,
  type UploadMyPhotoBody,
  type VerifyMfaBody,
} from "./auth.schemas.js";
import {
  changeMyPassword,
  confirmEmailAccount,
  deleteMyPhoto,
  getMe,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resendAccountConfirmation,
  resendLoginMfa,
  resetPasswordWithToken,
  revokePresentedRefresh,
  updateMe,
  uploadMyPhoto,
  verifyLoginMfa,
} from "./auth.service.js";

/** Nombre de la cookie HttpOnly del refresh (web). */
const REFRESH_COOKIE = "refreshToken";

/** Clientes que el login/refresh distinguen vía header X-Client. */
type ClientKind = "web" | "ios";

/** Lee y valida X-Client; sin él no sabemos dónde poner el refresh. */
function readClient(req: Request): ClientKind {
  const raw = req.header("x-client")?.trim().toLowerCase();
  if (raw === "web" || raw === "ios") {
    return raw;
  }
  throw new AppError(
    400,
    "invalid_client",
    "Header X-Client requerido: web o ios",
  );
}

/** Parsea una cookie por nombre desde el header Cookie (sin cookie-parser). */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.header("cookie");
  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    if (key !== name) {
      continue;
    }
    return decodeURIComponent(trimmed.slice(eq + 1));
  }

  return undefined;
}

/** Cookie HttpOnly del refresh para el cliente web (mismo origen vía proxy). */
function setRefreshCookie(res: Response, refreshToken: string): void {
  // Max-Age alineado a JWT_REFRESH_EXPIRES_IN (default 7d).
  const maxAgeMs = refreshTtlMs();
  const parts = [
    `${REFRESH_COOKIE}=${refreshToken}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  res.append("Set-Cookie", parts.join("; "));
}

/** Borra la cookie de refresh (logout web). */
function clearRefreshCookie(res: Response): void {
  res.append(
    "Set-Cookie",
    `${REFRESH_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}

/**
 * POST /login — tokens o challenge MFA.
 * Web: refresh en cookie solo si hay sesión completa.
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  const client = readClient(req);
  const body = req.body as LoginBody;
  const result = await loginUser(body);

  if ("mfaRequired" in result) {
    const bodyOut = mfaChallengeResponseSchema.parse(result);
    res.status(200).json(bodyOut);
    return;
  }

  // Tras el narrowing: sesión completa (tokens).
  const session = result;

  if (client === "web") {
    setRefreshCookie(res, session.refreshToken!);
    const bodyOut = loginResponseSchema.parse({
      user: session.user,
      accessToken: session.accessToken,
    });
    res.status(200).json(bodyOut);
    return;
  }

  const bodyOut = loginResponseSchema.parse(session);
  res.status(200).json(bodyOut);
}

/**
 * POST /verify-mfa — completa login con el código; misma respuesta que login.
 */
export async function verifyMfaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const client = readClient(req);
  const body = req.body as VerifyMfaBody;
  const result = await verifyLoginMfa(body.challengeId, body.code);

  if (client === "web") {
    setRefreshCookie(res, result.refreshToken!);
    const bodyOut = loginResponseSchema.parse({
      user: result.user,
      accessToken: result.accessToken,
    });
    res.status(200).json(bodyOut);
    return;
  }

  const bodyOut = loginResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}

/** POST /resend-mfa — nuevo código; actualiza challengeId. */
export async function resendMfaHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as ResendMfaBody;
  const result = await resendLoginMfa(body.challengeId);
  const bodyOut = resendMfaResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}

/** GET /me — perfil del Bearer; exige `authenticate` antes. */
export async function meHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const result = await getMe(req.user.id);
  const bodyOut = meResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}

/** PATCH /me — edita nombre, apellido o correo propios. */
export async function updateMeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as UpdateMeBody;
  const result = await updateMe(req.user.id, body);
  res.status(200).json(updateMeResponseSchema.parse(result));
}

/** POST /me/photo — sube o reemplaza la foto propia. */
export async function uploadMyPhotoHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as UploadMyPhotoBody;
  const result = await uploadMyPhoto(req.user.id, body);
  res.status(200).json(uploadMyPhotoResponseSchema.parse(result));
}

/** DELETE /me/photo — quita la foto propia. */
export async function deleteMyPhotoHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const result = await deleteMyPhoto(req.user.id);
  res.status(200).json(deleteMyPhotoResponseSchema.parse(result));
}

/**
 * POST /me/password — cambia la clave; cierra otras sesiones y reemite tokens.
 * Web: refresh en cookie. iOS: refresh en body.
 */
export async function changeMyPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const client = readClient(req);
  const body = req.body as ChangeMyPasswordBody;
  const session = await changeMyPassword(
    req.user.id,
    body.currentPassword,
    body.newPassword,
  );

  if (client === "web") {
    setRefreshCookie(res, session.refreshToken!);
    const bodyOut = changeMyPasswordResponseSchema.parse({
      user: session.user,
      accessToken: session.accessToken,
    });
    res.status(200).json(bodyOut);
    return;
  }

  const bodyOut = changeMyPasswordResponseSchema.parse(session);
  res.status(200).json(bodyOut);
}

/**
 * POST /refresh — nuevo access (+ refresh rotado).
 * Web: refresh en cookie. iOS: refresh en body.
 */
export async function refreshHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const client = readClient(req);
  const body = (req.body ?? {}) as RefreshBody;

  const refreshToken =
    client === "web"
      ? readCookie(req, REFRESH_COOKIE)
      : body.refreshToken;

  if (!refreshToken) {
    throw new AppError(401, "invalid_refresh", "Refresh requerido");
  }

  const result = await refreshSession(refreshToken);

  if (client === "web") {
    setRefreshCookie(res, result.refreshToken!);
    const bodyOut = refreshResponseSchema.parse({
      user: result.user,
      accessToken: result.accessToken,
    });
    res.status(200).json(bodyOut);
    return;
  }

  const bodyOut = refreshResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}

/**
 * POST /logout — invalida JWT (tokenVersion++) y borra cookie web.
 * Exige Bearer válido.
 */
export async function logoutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  await logoutUser(req.user.id);
  clearRefreshCookie(res);

  const bodyOut = logoutResponseSchema.parse({ ok: true });
  res.status(200).json(bodyOut);
}

/**
 * POST /clear-session — logout suave sin Bearer (confirm-email / reset / “usar otra cuenta”).
 * Revoca el refresh de la cookie si existe y siempre limpia Set-Cookie.
 */
export async function clearSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const presented = readCookie(req, REFRESH_COOKIE);
  await revokePresentedRefresh(presented);
  clearRefreshCookie(res);
  const bodyOut = logoutResponseSchema.parse({ ok: true });
  res.status(200).json(bodyOut);
}

/**
 * POST /register — alta por superadmin; 201 con user confirmed=false.
 * No emite tokens (hay que confirmar correo).
 */
export async function registerHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as RegisterBody;
  const result = await registerUser(body);
  const bodyOut = registerResponseSchema.parse(result);
  res.status(201).json(bodyOut);
}

/**
 * POST /confirm-email — activa cuenta con el token del enlace (público).
 */
export async function confirmEmailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as ConfirmEmailBody;
  const result = await confirmEmailAccount(body.token);
  const bodyOut = confirmEmailResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}

/**
 * POST /resend-confirmation — reenvía el mail; mensaje fijo siempre.
 */
export async function resendConfirmationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as ResendConfirmationBody;
  const result = await resendAccountConfirmation(body.email);
  const bodyOut = resendConfirmationResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}

/**
 * POST /forgot-password — pide reset; mensaje fijo (anti-enumeración).
 */
export async function forgotPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as ForgotPasswordBody;
  const result = await requestPasswordReset(body.email);
  const bodyOut = forgotPasswordResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}

/**
 * POST /reset-password — aplica nueva contraseña con el token del mail.
 */
export async function resetPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as ResetPasswordBody;
  const result = await resetPasswordWithToken(body.token, body.password);
  const bodyOut = resetPasswordResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}
