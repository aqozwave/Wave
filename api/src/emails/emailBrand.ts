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

/** Ruta al PNG del logo para adjuntar inline. */
const logoPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "assets/logo-nachipa-email.png",
);

/** Adjunto inline del logo para Resend (`contentId` → cid: en Img). */
export function getLogoAttachment(): {
  filename: string;
  content: Buffer;
  contentId: string;
} {
  return {
    filename: "logo-nachipa-email.png",
    content: readFileSync(logoPath),
    contentId: LOGO_CONTENT_ID,
  };
}
