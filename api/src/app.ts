import express from "express";
import swaggerUi from "swagger-ui-express";
import { getUploadRoot } from "./lib/localUploads.js";
import { buildOpenApiDocument } from "./lib/openapi.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFound.js";
import { academicDegreesRouter } from "./modules/academicDegrees/academicDegrees.routes.js";
import { areasRouter } from "./modules/areas/areas.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { businessesRouter } from "./modules/businesses/businesses.routes.js";
import { competencyCertificatesRouter } from "./modules/competencyCertificates/competencyCertificates.routes.js";
import { coursesRouter } from "./modules/courses/courses.routes.js";
import { crewMembersRouter } from "./modules/crewMembers/crewMembers.routes.js";
import { documentTypesRouter } from "./modules/documentTypes/documentTypes.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { locationsRouter } from "./modules/locations/locations.routes.js";
import { muellesRouter } from "./modules/muelles/muelles.routes.js";
import { portsRouter } from "./modules/ports/ports.routes.js";
import { ranksRouter } from "./modules/ranks/ranks.routes.js";
import { rolesRouter } from "./modules/roles/roles.routes.js";
import { travesiasRouter } from "./modules/travesias/travesias.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export function createApp() {
  const app = express();
  const openApiDocument = buildOpenApiDocument();

  // 12 MB: fotos y documentos en JSON+base64 (crew docs hasta 10 MB).
  app.use(express.json({ limit: "12mb" }));

  // Fotos (y demás archivos locales): /uploads/… → disco.
  // nosniff evita que el navegador “adivine” un tipo distinto al declarado.
  app.use(
    "/uploads",
    express.static(getUploadRoot(), {
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );

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
  app.use("/api/v1/document-types", documentTypesRouter);
  app.use("/api/v1/courses", coursesRouter);
  app.use("/api/v1/ports", portsRouter);
  app.use("/api/v1/muelles", muellesRouter);
  app.use("/api/v1/travesias", travesiasRouter);
  app.use("/api/v1/roles", rolesRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/crew-members", crewMembersRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
