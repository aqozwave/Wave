import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  loginResponseSchema,
  meResponseSchema,
  type LoginBody,
} from "./auth.schemas.js";
import { getMe, loginUser } from "./auth.service.js";

/** Clientes que el login distingue vía header X-Client. */
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

/** Cookie HttpOnly del refresh para el cliente web (mismo origen vía proxy). */
function setRefreshCookie(res: Response, refreshToken: string): void {
  // 7 días en ms — alineado al default JWT_REFRESH_EXPIRES_IN.
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  const parts = [
    `refreshToken=${refreshToken}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  res.append("Set-Cookie", parts.join("; "));
}

/** POST /login — emite tokens; web: refresh en cookie; ios: refresh en body. */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  const client = readClient(req);
  const body = req.body as LoginBody;
  const result = await loginUser(body);

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

/** GET /me — perfil del Bearer; exige `authenticate` antes. */
export async function meHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }

  const result = await getMe(req.user.id);
  const bodyOut = meResponseSchema.parse(result);
  res.status(200).json(bodyOut);
}
