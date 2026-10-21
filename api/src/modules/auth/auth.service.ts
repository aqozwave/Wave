import { EmailTokenPurpose, type User } from "@prisma/client";
import { sendConfirmEmail } from "../../emails/sendConfirmEmail.js";
import { sendResetPasswordEmail } from "../../emails/sendResetPassword.js";
import { AppError } from "../../lib/errors.js";
import {
  hashEmailToken,
  issueEmailToken,
} from "../../lib/emailToken.js";
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
  RefreshResponse,
  RegisterBody,
  RegisterResponse,
  ResendConfirmationResponse,
  ResetPasswordResponse,
} from "./auth.schemas.js";

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

// Login sin MFA en este paso. MFA entra con LoginChallenge después.
export async function loginUser(input: LoginBody): Promise<LoginResponse> {
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return issueTokens(updated);
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
 */
async function issueAndSendConfirmation(user: User): Promise<void> {
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
      },
    }),
  ]);

  return {
    message: "Contraseña actualizada. Ya puedes iniciar sesión.",
    user: toAuthUser(user),
  };
}
