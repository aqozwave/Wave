import type { User } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { signAccessToken, signRefreshToken } from "../../lib/tokens.js";
import type { AuthUser, LoginBody, LoginResponse } from "./auth.schemas.js";

const MAX_LOGIN_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES ?? 15);

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
