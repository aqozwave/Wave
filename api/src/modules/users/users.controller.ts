import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import {
  createUserResponseSchema,
  deleteUserPhotoResponseSchema,
  deleteUserResponseSchema,
  getUserResponseSchema,
  listUsersResponseSchema,
  unlockUserResponseSchema,
  updateUserResponseSchema,
  uploadUserPhotoResponseSchema,
  type CreateUserBody,
  type ListUsersQuery,
  type UpdateUserBody,
  type UploadUserPhotoBody,
} from "./users.schemas.js";
import {
  createUser,
  deleteUserById,
  deleteUserPhoto,
  getUserById,
  listUsers,
  unlockUserById,
  updateUser,
  uploadUserPhoto,
} from "./users.service.js";

/** GET /users — listado paginado scoped por tenant. */
export async function listUsersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const query = req.query as unknown as ListUsersQuery;
  const result = await listUsers(req.user, query);
  res.status(200).json(listUsersResponseSchema.parse(result));
}

/** POST /users — alta admin (enlace para elegir contraseña y confirmar). */
export async function createUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const body = req.body as CreateUserBody;
  const created = await createUser(req.user, body);
  res.status(201).json(createUserResponseSchema.parse(created));
}

/** GET /users/:id — detalle. */
export async function getUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const item = await getUserById(req.user, id);
  res.status(200).json(getUserResponseSchema.parse(item));
}

/** PATCH /users/:id — edición. */
export async function updateUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UpdateUserBody;
  const updated = await updateUser(req.user, id, body);
  res.status(200).json(updateUserResponseSchema.parse(updated));
}

/** DELETE /users/:id — soft delete. */
export async function deleteUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const deleted = await deleteUserById(req.user, id);
  res.status(200).json(deleteUserResponseSchema.parse(deleted));
}

/** POST /users/:id/unlock — limpia lockUntil e intentos. */
export async function unlockUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const unlocked = await unlockUserById(req.user, id);
  res.status(200).json(unlockUserResponseSchema.parse(unlocked));
}

/** POST /users/:id/photo — sube o reemplaza foto (JSON + base64). */
export async function uploadUserPhotoHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const body = req.body as UploadUserPhotoBody;
  const updated = await uploadUserPhoto(req.user, id, body);
  res.status(200).json(uploadUserPhotoResponseSchema.parse(updated));
}

/** DELETE /users/:id/photo — quita la foto. */
export async function deleteUserPhotoHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "unauthorized", "Token requerido");
  }
  const { id } = req.params as { id: string };
  const updated = await deleteUserPhoto(req.user, id);
  res.status(200).json(deleteUserPhotoResponseSchema.parse(updated));
}
