import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/tokens.js";

/**
 * Exige `Authorization: Bearer <access>` y deja el usuario en `req.user`.
 * Rechaza tokens vencidos, firmados mal, o con tokenVersion desactualizada.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "unauthorized", "Token requerido");
    }

    // "Bearer " = 7 caracteres; el resto es el JWT.
    const token = header.slice(7).trim();
    if (!token) {
      throw new AppError(401, "unauthorized", "Token requerido");
    }

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
    });

    if (!user || !user.state) {
      throw new AppError(401, "unauthorized", "Sesión inválida");
    }

    // Logout / reset de claves sube tokenVersion y deja tokens viejos muertos.
    if (user.tokenVersion !== payload.v) {
      throw new AppError(401, "unauthorized", "Sesión inválida");
    }

    req.user = {
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

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError(401, "unauthorized", "Token inválido o expirado"));
  }
}
