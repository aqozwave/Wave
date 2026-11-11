import { createReadStream } from "node:fs";
import type { Response } from "express";

/**
 * Pipe de archivo a la respuesta con manejo de error.
 * Sin esto, un path faltante puede tumbar el proceso entero (uncaught).
 */
export function pipeFileToResponse(fullPath: string, res: Response): void {
  const stream = createReadStream(fullPath);
  stream.on("error", (err) => {
    console.error("[pipeFile]", fullPath, err);
    if (!res.headersSent) {
      res.status(404).json({
        code: "file_not_found",
        message: "Archivo no encontrado",
      });
      return;
    }
    res.destroy(err);
  });
  stream.pipe(res);
}
