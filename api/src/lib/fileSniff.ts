/**
 * Detección de MIME por magic bytes (contenido real).
 * No confía en extensión ni en el mime declarado por el cliente.
 */

/** Imágenes permitidas en foto de perfil. */
export type SniffedImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Documentos de tripulante: PDF, imágenes y Word. */
export type SniffedCrewDocMime =
  | SniffedImageMime
  | "application/pdf"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Detecta JPEG / PNG / WebP, o null. */
export function sniffImageMime(buffer: Buffer): SniffedImageMime | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: firma 8 bytes + chunk IHDR (tipo en offset 12..15).
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a &&
    buffer[12] === 0x49 &&
    buffer[13] === 0x48 &&
    buffer[14] === 0x44 &&
    buffer[15] === 0x52
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
 * ¿ZIP OOXML de Word (.docx)?
 * Solo local file header PK 03 04 + rutas típicas de Word (no ZIP vacío/raro).
 */
function looksLikeDocx(buffer: Buffer): boolean {
  // Exige entrada local real (PK 03 04), no central/empty (05 06 / 07 08).
  if (
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    return false;
  }
  // Firmas de paquete Word en la cabecera (sin inflar el ZIP completo).
  const head = buffer
    .subarray(0, Math.min(buffer.length, 16_384))
    .toString("binary");
  return (
    head.includes("[Content_Types].xml") &&
    (head.includes("word/document.xml") || head.includes("word/"))
  );
}

/**
 * MIME de documento de tripulante (PDF, imagen o Word).
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

  // DOC clásico (OLE Compound File): D0 CF 11 E0 A1 B1 1A E1
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return "application/msword";
  }

  // DOCX (Office Open XML = ZIP con word/)
  if (looksLikeDocx(buffer)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
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
