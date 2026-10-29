/**
 * Detección de MIME por magic bytes (contenido real).
 * No confía en extensión ni en el mime declarado por el cliente.
 */

/** Imágenes permitidas en foto de perfil. */
export type SniffedImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Documentos de tripulante: imágenes + PDF. */
export type SniffedCrewDocMime = SniffedImageMime | "application/pdf";

/** Detecta JPEG / PNG / WebP, o null. */
export function sniffImageMime(buffer: Buffer): SniffedImageMime | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * MIME de documento de tripulante (PDF o imagen).
 * Usado en alta de crew documents.
 */
export function sniffCrewDocumentMime(
  buffer: Buffer,
): SniffedCrewDocMime | null {
  if (buffer.length < 12) return null;

  // PDF: "%PDF"
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }

  return sniffImageMime(buffer);
}

/**
 * MIME de foto de perfil (solo imagen).
 * PDF u otros → null.
 */
export function sniffUserPhotoMime(buffer: Buffer): SniffedImageMime | null {
  return sniffImageMime(buffer);
}
