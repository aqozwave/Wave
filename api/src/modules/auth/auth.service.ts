import { EmailTokenPurpose, type User } from "@prisma/client";
import { sendConfirmEmail } from "../../emails/sendConfirmEmail.js";
import { sendLoginMfaEmail } from "../../emails/sendLoginMfa.js";
import { sendResetPasswordEmail } from "../../emails/sendResetPassword.js";
import { AppError } from "../../lib/errors.js";
import {
  hashEmailToken,
  issueEmailToken,
} from "../../lib/emailToken.js";
import { sniffUserPhotoMime } from "../../lib/fileSniff.js";
import {
  ALLOWED_USER_PHOTO_MIMES,
  MAX_USER_PHOTO_BYTES,
  isUserPhotoRelativePath,
  unlinkUserPhotoFile,
  writeUserPhotoFile,
} from "../../lib/localUploads.js";
import {
  createLoginChallenge,
  verifyLoginChallenge,
} from "../../lib/loginChallenge.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/tokens.js";
import type {
  AuthUser,
  ConfirmEmailResponse,
  ForgotPasswordResponse,
  LoginBody,
  LoginResponse,
  MfaChallengeResponse,
  RefreshResponse,
  RegisterBody,
  RegisterResponse,
  ResendConfirmationResponse,
  ResendMfaResponse,
  ResetPasswordResponse,
  UpdateMeBody,
  UploadMyPhotoBody,
} from "./auth.schemas.js";

/** MFA activo salvo LOGIN_MFA_ENABLED=false|0 (mismo default que el portal viejo). */
function isLoginMfaEnabled(): boolean {
  const raw = process.env.LOGIN_MFA_ENABLED?.trim()?.toLowerCase();
  if (raw === "false" || raw === "0") {
    return false;
  }
  return true;
}

/** Enmascara email para la UI (f***@dominio.com). */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) {
    return "***";
  }
  const maskedLocal =
    local.length <= 1
      ? "*"
      : `${local[0]}${"*".repeat(Math.min(local.length - 1, 3))}`;
  return `${maskedLocal}@${domain}`;
}

/** Intentos fallidos antes de bloquear la cuenta. */
const MAX_LOGIN_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
/** Minutos de bloqueo tras superar MAX_LOGIN_ATTEMPTS. */
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES ?? 15);

/** Proyecta User de Prisma al contrato AuthUser (sin secretos). */
function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoProfile: user.photoProfile,
    internalRol: user.internalRol,
    roleId: user.roleId,
    businessId: user.businessId,
    confirmed: user.confirmed,
    state: user.state,
  };
}

/** Emite access + refresh firmados con la tokenVersion actual. */
function issueTokens(user: User): LoginResponse {
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    internalRol: user.internalRol,
    businessId: user.businessId,
    v: user.tokenVersion,
  });
  const refreshToken = signRefreshToken({
    sub: user.id,
    v: user.tokenVersion,
  });

  return {
    user: toAuthUser(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Login: valida credenciales; con MFA emite challenge + mail (sin tokens).
 * Sin MFA (LOGIN_MFA_ENABLED=false) emite tokens directo.
 */
export async function loginUser(
  input: LoginBody,
): Promise<LoginResponse | MfaChallengeResponse> {
  const user = await prisma.user.findFirst({
    where: {
      email: input.email,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new AppError(401, "invalid_credentials", "Credenciales inválidas");
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const minutes = Math.ceil(
      (user.lockUntil.getTime() - Date.now()) / 60_000,
    );
    throw new AppError(
      403,
      "account_locked",
      `Cuenta bloqueada. Reintentá en ${minutes} min`,
    );
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    const attempts = user.loginAttempts + 1;
    const lockUntil =
      attempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60_000)
        : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: attempts,
        lockUntil,
      },
    });

    if (lockUntil) {
      throw new AppError(
        403,
        "account_locked",
        `Cuenta bloqueada. Reintentá en ${LOCK_MINUTES} min`,
      );
    }

    throw new AppError(401, "invalid_credentials", "Credenciales inválidas");
  }

  if (!user.state) {
    throw new AppError(403, "user_disabled", "Usuario desactivado");
  }

  if (!user.confirmed) {
    throw new AppError(
      403,
      "account_not_confirmed",
      "Debes confirmar tu cuenta antes de iniciar sesión",
    );
  }

  // Credenciales OK: limpiamos intentos; lastLoginAt se setea al verificar MFA.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockUntil: null,
    },
  });

  if (isLoginMfaEnabled()) {
    const { challengeId, code, expiresAt } = await createLoginChallenge(
      user.id,
    );
    await sendLoginMfaEmail({
      to: user.email,
      firstName: user.firstName,
      code,
    });
    return {
      mfaRequired: true,
      challengeId,
      expiresInSeconds: Math.max(
        1,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      ),
      emailMasked: maskEmail(user.email),
    };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return issueTokens(updated);
}

/**
 * Completa el login con el código del correo.
 * Emite tokens (misma forma que login sin MFA).
 */
export async function verifyLoginMfa(
  challengeId: string,
  code: string,
): Promise<LoginResponse> {
  const result = await verifyLoginChallenge(challengeId, code);

  if (!result.ok) {
    if (result.reason === "expired" || result.reason === "not_found") {
      throw new AppError(
        400,
        "mfa_code_expired",
        "El código expiró. Volvé a iniciar sesión.",
      );
    }
    if (result.reason === "max_attempts") {
      throw new AppError(
        400,
        "mfa_max_attempts",
        "Demasiados intentos. Volvé a iniciar sesión.",
      );
    }
    throw new AppError(401, "mfa_invalid_code", "Código incorrecto");
  }

  const user = await prisma.user.findFirst({
    where: { id: result.userId, deletedAt: null, state: true },
  });

  if (!user) {
    throw new AppError(401, "mfa_challenge_invalid", "Challenge inválido");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return issueTokens(updated);
}

/**
 * Reenvía un nuevo código para el mismo challengeId (rota el challenge).
 */
export async function resendLoginMfa(
  challengeId: string,
): Promise<ResendMfaResponse> {
  const existing = await prisma.loginChallenge.findUnique({
    where: { challengeId },
    include: { user: true },
  });

  if (
    !existing ||
    existing.expiresAt.getTime() <= Date.now() ||
    existing.user.deletedAt ||
    !existing.user.state
  ) {
    throw new AppError(
      400,
      "mfa_code_expired",
      "El código expiró. Volvé a iniciar sesión.",
    );
  }

  const { challengeId: nextId, code, expiresAt } = await createLoginChallenge(
    existing.userId,
  );
  await sendLoginMfaEmail({
    to: existing.user.email,
    firstName: existing.user.firstName,
    code,
  });

  return {
    message: "Te enviamos un nuevo código.",
    challengeId: nextId,
    expiresInSeconds: Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    ),
    emailMasked: maskEmail(existing.user.email),
  };
}

/**
 * Perfil del usuario ya autenticado (id viene del JWT).
 * Relee la BD para no confiar solo en claims del token.
 */
export async function getMe(userId: string): Promise<{ user: AuthUser }> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  if (!user || !user.state) {
    throw new AppError(401, "unauthorized", "Sesión inválida");
  }

  return { user: toAuthUser(user) };
}

/** Decodifica base64 puro o data-URL. */
function decodeBase64Content(contentBase64: string): Buffer {
  const trimmed = contentBase64.trim();
  const comma = trimmed.indexOf(",");
  const raw =
    trimmed.startsWith("data:") && comma >= 0
      ? trimmed.slice(comma + 1)
      : trimmed;
  return Buffer.from(raw, "base64");
}

/**
 * PATCH /me — actualiza nombre/apellido/correo del usuario autenticado.
 */
export async function updateMe(
  userId: string,
  body: UpdateMeBody,
): Promise<{ user: AuthUser }> {
  const existing = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!existing || !existing.state) {
    throw new AppError(401, "unauthorized", "Sesión inválida");
  }

  if (body.email && body.email !== existing.email) {
    const taken = await prisma.user.findFirst({
      where: {
        email: body.email,
        deletedAt: null,
        NOT: { id: existing.id },
      },
    });
    if (taken) {
      throw new AppError(
        409,
        "duplicate_email",
        "El correo electrónico ya está registrado",
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
      ...(body.email !== undefined
        ? { email: body.email, pendingEmail: null }
        : {}),
    },
  });

  return { user: toAuthUser(updated) };
}

/**
 * POST /me/photo — sube o reemplaza la foto del usuario autenticado.
 */
export async function uploadMyPhoto(
  userId: string,
  body: UploadMyPhotoBody,
): Promise<{ user: AuthUser }> {
  const existing = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!existing || !existing.state) {
    throw new AppError(401, "unauthorized", "Sesión inválida");
  }

  if (!ALLOWED_USER_PHOTO_MIMES.has(body.mimeType)) {
    throw new AppError(
      400,
      "validation_error",
      "Tipo de archivo no permitido (JPEG, PNG o WebP)",
    );
  }

  const buffer = decodeBase64Content(body.contentBase64);
  if (!buffer.length) {
    throw new AppError(400, "validation_error", "Archivo vacío o base64 inválido");
  }
  if (buffer.length > MAX_USER_PHOTO_BYTES) {
    throw new AppError(
      400,
      "validation_error",
      "La foto supera el máximo de 2 MB",
    );
  }

  // Magic bytes: el contenido real manda sobre el mimeType del cliente.
  const sniffed = sniffUserPhotoMime(buffer);
  if (!sniffed) {
    throw new AppError(
      400,
      "validation_error",
      "El contenido del archivo no es un JPEG, PNG o WebP válido",
    );
  }
  if (sniffed !== body.mimeType) {
    throw new AppError(
      400,
      "validation_error",
      "El tipo declarado no coincide con el contenido del archivo",
    );
  }

  const previous = existing.photoProfile;
  const written = await writeUserPhotoFile({
    businessId: existing.businessId,
    userId: existing.id,
    mimeType: sniffed,
    buffer,
  });

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { photoProfile: written.relativePath },
  });

  if (previous && previous !== written.relativePath) {
    await unlinkUserPhotoFile(previous);
  }

  return { user: toAuthUser(updated) };
}

/** DELETE /me/photo — quita la foto del usuario autenticado. */
export async function deleteMyPhoto(
  userId: string,
): Promise<{ user: AuthUser }> {
  const existing = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!existing || !existing.state) {
    throw new AppError(401, "unauthorized", "Sesión inválida");
  }

  const previous = existing.photoProfile;
  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { photoProfile: null },
  });

  if (previous && isUserPhotoRelativePath(previous)) {
    await unlinkUserPhotoFile(previous);
  }

  return { user: toAuthUser(updated) };
}

/**
 * Renueva access (y rota refresh) a partir de un refresh JWT válido.
 * Si tokenVersion no coincide, la sesión ya fue invalidada (logout).
 */
export async function refreshSession(
  refreshToken: string,
): Promise<RefreshResponse> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "invalid_refresh", "Refresh inválido o expirado");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      deletedAt: null,
    },
  });

  if (!user || !user.state || user.tokenVersion !== payload.v) {
    throw new AppError(401, "invalid_refresh", "Refresh inválido o expirado");
  }

  return issueTokens(user);
}

/**
 * Invalida todos los JWT del usuario subiendo tokenVersion.
 * El access/refresh viejos dejan de pasar authenticate / refresh.
 */
export async function logoutUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      tokenVersion: { increment: 1 },
    },
  });
}

/**
 * Mensaje fijo post-alta (el usuario aún debe confirmar correo).
 */
const REGISTER_OK_MESSAGE =
  "Usuario creado. Debes confirmar tu correo antes de iniciar sesión.";

/**
 * Mensaje fijo de reenvío (anti-enumeración: igual exista o no el email).
 */
const RESEND_CONFIRMATION_MESSAGE =
  "Si el correo está registrado y pendiente de confirmación, recibirás un enlace.";

/**
 * Emite EmailToken confirm_email y envía (o stubbea) el correo.
 * Exportado para alta admin en /users (misma plantilla que register).
 */
export async function issueAndSendConfirmation(user: User): Promise<void> {
  const { plain, expiresAt } = await issueEmailToken(
    user.id,
    EmailTokenPurpose.confirm_email,
  );

  await sendConfirmEmail({
    to: user.email,
    firstName: user.firstName,
    plainToken: plain,
    expiresAt,
  });
}

/**
 * Alta interna (superadmin): usuario confirmed=false, sin tokens JWT.
 * Emite EmailToken y envía correo (Resend o stub en log).
 */
export async function registerUser(
  input: RegisterBody,
): Promise<RegisterResponse> {
  const existing = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { email: input.email },
        { username: input.username },
        { run: input.run },
      ],
    },
  });

  if (existing) {
    if (existing.email === input.email) {
      throw new AppError(
        409,
        "duplicate_email",
        "El correo electrónico ya está registrado",
      );
    }
    if (existing.username === input.username) {
      throw new AppError(
        409,
        "duplicate_username",
        "El nombre de usuario ya está en uso",
      );
    }
    throw new AppError(409, "duplicate_run", "El RUN ya está registrado");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      run: input.run,
      confirmed: false,
      state: true,
      internalRol: "user",
    },
  });

  await issueAndSendConfirmation(user);

  return {
    user: toAuthUser(user),
    message: REGISTER_OK_MESSAGE,
  };
}

/**
 * Reenvía el enlace de confirmación.
 * Siempre el mismo mensaje (no revela si el email existe).
 */
export async function resendAccountConfirmation(
  email: string,
): Promise<ResendConfirmationResponse> {
  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
      state: true,
      confirmed: false,
    },
  });

  if (user) {
    await issueAndSendConfirmation(user);
  }

  return { message: RESEND_CONFIRMATION_MESSAGE };
}

/**
 * Activa la cuenta con el token del correo (hash en EmailToken).
 * Idempotente si ya estaba confirmed y el token era válido.
 */
export async function confirmEmailAccount(
  plainToken: string,
): Promise<ConfirmEmailResponse> {
  const tokenHash = hashEmailToken(plainToken);

  const record = await prisma.emailToken.findFirst({
    where: {
      tokenHash,
      purpose: EmailTokenPurpose.confirm_email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!record || record.user.deletedAt) {
    throw new AppError(
      400,
      "invalid_confirm_token",
      "Enlace de confirmación inválido o expirado",
    );
  }

  if (!record.user.state) {
    throw new AppError(403, "user_disabled", "Usuario desactivado");
  }

  const [, user] = await prisma.$transaction([
    prisma.emailToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { confirmed: true },
    }),
  ]);

  return {
    message: "Cuenta confirmada. Ya puedes iniciar sesión.",
    user: toAuthUser(user),
  };
}

/**
 * Mensaje fijo de forgot-password (anti-enumeración).
 */
const PASSWORD_RESET_REQUEST_MESSAGE =
  "Si el correo está registrado, recibirás un enlace para restablecer la contraseña.";

/**
 * Emite EmailToken reset_password y envía (o stubbea) el correo.
 */
async function issueAndSendPasswordReset(user: User): Promise<void> {
  const { plain, expiresAt } = await issueEmailToken(
    user.id,
    EmailTokenPurpose.reset_password,
  );

  await sendResetPasswordEmail({
    to: user.email,
    firstName: user.firstName,
    plainToken: plain,
    expiresAt,
  });
}

/**
 * Solicita reset: siempre el mismo mensaje; solo envía si hay usuario activo.
 */
export async function requestPasswordReset(
  email: string,
): Promise<ForgotPasswordResponse> {
  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
      state: true,
    },
  });

  if (user) {
    await issueAndSendPasswordReset(user);
  }

  return { message: PASSWORD_RESET_REQUEST_MESSAGE };
}

/**
 * Cambia la contraseña del usuario autenticado (Seguridad).
 * Verifica la actual, sube tokenVersion (cierra otras sesiones) y emite tokens nuevos.
 */
export async function changeMyPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<LoginResponse> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new AppError(401, "unauthorized", "Usuario no encontrado");
  }

  if (!user.state) {
    throw new AppError(403, "user_disabled", "Usuario desactivado");
  }

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new AppError(
      401,
      "invalid_current_password",
      "La contraseña actual no es correcta",
    );
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      // Invalida access/refresh previos; el handler reemite con la versión nueva.
      tokenVersion: { increment: 1 },
    },
  });

  return issueTokens(updated);
}

/**
 * Cambia la contraseña con el token del correo.
 * Invalida el token y sube tokenVersion (cierra sesiones previas).
 */
export async function resetPasswordWithToken(
  plainToken: string,
  newPassword: string,
): Promise<ResetPasswordResponse> {
  const tokenHash = hashEmailToken(plainToken);

  const record = await prisma.emailToken.findFirst({
    where: {
      tokenHash,
      purpose: EmailTokenPurpose.reset_password,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!record || record.user.deletedAt) {
    throw new AppError(
      400,
      "invalid_reset_token",
      "Enlace de restablecimiento inválido o expirado",
    );
  }

  if (!record.user.state) {
    throw new AppError(403, "user_disabled", "Usuario desactivado");
  }

  const passwordHash = await hashPassword(newPassword);

  const [, user] = await prisma.$transaction([
    prisma.emailToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        // Cierra access/refresh emitidos antes del cambio.
        tokenVersion: { increment: 1 },
        // El enlace prueba el correo: una invitación queda confirmada al elegir clave.
        ...(record.user.confirmed ? {} : { confirmed: true }),
      },
    }),
  ]);

  return {
    message: "Contraseña actualizada. Ya puedes iniciar sesión.",
    user: toAuthUser(user),
  };
}
