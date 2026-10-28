import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Raíz de archivos locales.
 * UPLOAD_ROOT absoluto, o api/uploads por defecto.
 */
export function getUploadRoot(): string {
  const fromEnv = process.env.UPLOAD_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "uploads");
}

/** Prefijo relativo que guardamos en BD (estilo portal viejo). */
const RELATIVE_PREFIX = "/uploads";

/** Máximo 10 MB por documento (cartas / PDF). */
export const MAX_CREW_DOC_BYTES = 10 * 1024 * 1024;

/** MIME permitidos para documentos de tripulante. */
export const ALLOWED_CREW_DOC_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Extensión a partir del mime (fallback .bin). */
function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}

/**
 * Ruta relativa de documento de tripulante.
 * /uploads/{businessId}/crew-members/{crewId}/warning-letters/{rand}.ext
 */
export function buildCrewDocumentRelativePath(input: {
  businessId: string;
  crewMemberId: string;
  type: string;
  mimeType: string;
}): string {
  const sub =
    input.type === "warning_letter" ? "warning-letters" : input.type;
  const rand = crypto.randomBytes(8).toString("hex");
  const ext = extensionForMime(input.mimeType);
  return `${RELATIVE_PREFIX}/${input.businessId}/crew-members/${input.crewMemberId}/${sub}/${rand}${ext}`;
}

/** True si la ruta relativa es de documentos de crew bajo /uploads/. */
export function isCrewDocumentRelativePath(relativePath: string): boolean {
  return (
    relativePath.startsWith(`${RELATIVE_PREFIX}/`) &&
    relativePath.includes("/crew-members/")
  );
}

/**
 * Resuelve path absoluto dentro de UPLOAD_ROOT.
 * Rechaza path traversal (..).
 */
export function resolveUploadFullPath(relativePath: string): string | null {
  if (!relativePath.startsWith(RELATIVE_PREFIX + "/")) return null;
  const withoutPrefix = relativePath.slice(RELATIVE_PREFIX.length);
  const full = path.resolve(getUploadRoot(), "." + withoutPrefix);
  const root = getUploadRoot();
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

/** Escribe buffer en disco creando directorios. Devuelve relativePath. */
export async function writeCrewDocumentFile(input: {
  businessId: string;
  crewMemberId: string;
  type: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ relativePath: string; fullPath: string; size: number }> {
  const relativePath = buildCrewDocumentRelativePath(input);
  const fullPath = resolveUploadFullPath(relativePath);
  if (!fullPath) {
    throw new Error("Ruta de upload inválida");
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.buffer);
  return { relativePath, fullPath, size: input.buffer.length };
}

/** Borra archivo de disco si la ruta es válida (ignora si ya no existe). */
export async function unlinkCrewDocumentFile(
  relativePath: string,
): Promise<void> {
  if (!isCrewDocumentRelativePath(relativePath)) return;
  const fullPath = resolveUploadFullPath(relativePath);
  if (!fullPath) return;
  try {
    await fs.unlink(fullPath);
  } catch {
    // ya borrado
  }
}

/** Máximo 2 MB por foto de perfil. */
export const MAX_USER_PHOTO_BYTES = 2 * 1024 * 1024;

/** MIME permitidos para foto de perfil (sin PDF). */
export const ALLOWED_USER_PHOTO_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Ruta relativa de foto de usuario.
 * Con empresa: /uploads/{businessId}/users/{userId}/{rand}.ext
 * Sin empresa (superadmin): /uploads/users/{userId}/{rand}.ext
 */
export function buildUserPhotoRelativePath(input: {
  businessId: string | null;
  userId: string;
  mimeType: string;
}): string {
  const rand = crypto.randomBytes(8).toString("hex");
  const ext = extensionForMime(input.mimeType);
  if (input.businessId) {
    return `${RELATIVE_PREFIX}/${input.businessId}/users/${input.userId}/${rand}${ext}`;
  }
  return `${RELATIVE_PREFIX}/users/${input.userId}/${rand}${ext}`;
}

/** True si la ruta es de foto de usuario bajo /uploads/. */
export function isUserPhotoRelativePath(relativePath: string): boolean {
  if (!relativePath.startsWith(`${RELATIVE_PREFIX}/`)) return false;
  return (
    relativePath.includes("/users/") &&
    !relativePath.includes("/crew-members/")
  );
}

/** Escribe foto de perfil en disco. */
export async function writeUserPhotoFile(input: {
  businessId: string | null;
  userId: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ relativePath: string; fullPath: string; size: number }> {
  const relativePath = buildUserPhotoRelativePath(input);
  const fullPath = resolveUploadFullPath(relativePath);
  if (!fullPath) {
    throw new Error("Ruta de upload inválida");
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.buffer);
  return { relativePath, fullPath, size: input.buffer.length };
}

/** Borra foto de perfil del disco si la ruta es válida. */
export async function unlinkUserPhotoFile(
  relativePath: string,
): Promise<void> {
  if (!isUserPhotoRelativePath(relativePath)) return;
  const fullPath = resolveUploadFullPath(relativePath);
  if (!fullPath) return;
  try {
    await fs.unlink(fullPath);
  } catch {
    // ya borrado
  }
}
