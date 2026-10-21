import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { loginResponseSchema, type LoginBody } from "./auth.schemas.js";
import { loginUser } from "./auth.service.js";

type ClientKind = "web" | "ios";

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

function setRefreshCookie(res: Response, refreshToken: string): void {
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
