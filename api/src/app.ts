import express from "express";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiDocument } from "./lib/openapi.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFound.js";
import { academicDegreesRouter } from "./modules/academicDegrees/academicDegrees.routes.js";
import { areasRouter } from "./modules/areas/areas.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { businessesRouter } from "./modules/businesses/businesses.routes.js";
import { competencyCertificatesRouter } from "./modules/competencyCertificates/competencyCertificates.routes.js";
import { coursesRouter } from "./modules/courses/courses.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { locationsRouter } from "./modules/locations/locations.routes.js";
import { muellesRouter } from "./modules/muelles/muelles.routes.js";
import { ranksRouter } from "./modules/ranks/ranks.routes.js";
import { travesiasRouter } from "./modules/travesias/travesias.routes.js";

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
  app.use("/api/v1/ranks", ranksRouter);
  app.use("/api/v1/academic-degrees", academicDegreesRouter);
  app.use("/api/v1/competency-certificates", competencyCertificatesRouter);
  app.use("/api/v1/courses", coursesRouter);
  app.use("/api/v1/muelles", muellesRouter);
  app.use("/api/v1/travesias", travesiasRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
