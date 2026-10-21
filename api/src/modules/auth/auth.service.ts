import { EmailTokenPurpose, type User } from "@prisma/client";
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
  LoginBody,
  LoginResponse,
  RefreshResponse,
  RegisterBody,
  RegisterResponse,
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
 * Mensaje fijo post-alta (el correo real entra con Resend + ConfirmEmail).
 */
const REGISTER_OK_MESSAGE =
  "Usuario creado. Debes confirmar tu correo antes de iniciar sesión.";

/**
 * Alta interna (superadmin): usuario confirmed=false, sin tokens.
 * Stub de correo: log en consola hasta integrar Resend.
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

  const { plain, expiresAt } = await issueEmailToken(
    user.id,
    EmailTokenPurpose.confirm_email,
  );

  // Stub de correo: log del token para Bruno/dev. Resend reemplaza esto.
  console.info(
    `[auth.register] confirm token para ${user.email}: ${plain} (expira ${expiresAt.toISOString()})`,
  );

  return {
    user: toAuthUser(user),
    message: REGISTER_OK_MESSAGE,
  };
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
