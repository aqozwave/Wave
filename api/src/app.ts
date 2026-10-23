import express from "express";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiDocument } from "./lib/openapi.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFound.js";
import { areasRouter } from "./modules/areas/areas.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { businessesRouter } from "./modules/businesses/businesses.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { locationsRouter } from "./modules/locations/locations.routes.js";

export function createApp() {
  const app = express();
  const openApiDocument = buildOpenApiDocument();

  app.use(express.json());

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/businesses", businessesRouter);
  app.use("/api/v1/locations", locationsRouter);
  app.use("/api/v1/areas", areasRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
