import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Nombre visible del producto en correos. */
export const PRODUCT_NAME = "Portal Nachipa Wellboats";

/** Overline corto en cabeceras de auth. */
export const BRAND_OVERLINE = "NACHIPA WELLBOATS";

/** Acento navy Nachipa (logo / botones). */
export const ACCENT = "#004c8c";

/** Celeste del mark (Figma). */
export const ACCENT_LIGHT = "#5bc1e7";

/** Content-ID del logo embebido (cid: en el HTML). */
export const LOGO_CONTENT_ID = "logo-nachipa";

/** Carpeta de assets de correo. */
const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "assets");

/** Ruta al PNG del logo para adjuntar inline. */
const logoPath = join(assetsDir, "logo-nachipa-email.png");

/** Forma común de adjunto inline Resend. */
export type InlineEmailAttachment = {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentId: string;
  contentType?: string;
};

/** Adjunto inline del logo para Resend (`contentId` → cid: en Img). */
export function getLogoAttachment(): InlineEmailAttachment {
  return {
    filename: "logo-nachipa-email.png",
    content: readFileSync(logoPath).toString("base64"),
    contentId: LOGO_CONTENT_ID,
    contentType: "image/png",
  };
}

/** Adjuntos del correo de felicitación minimalista: solo logo. */
export function getBirthdayPersonAttachments(): InlineEmailAttachment[] {
  return [getLogoAttachment()];
}
