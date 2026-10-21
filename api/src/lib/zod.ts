import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Una sola vez: habilita .openapi() en los schemas del contrato.
extendZodWithOpenApi(z);

export { z };
