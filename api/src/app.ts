import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import {
  getUploadRoot,
  isAllowedPublicUploadPhotoPath,
} from "./lib/localUploads.js";
import { buildOpenApiDocument } from "./lib/openapi.js";
import { startRateLimitCleanup } from "./lib/rateLimit.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFound.js";
import { academicDegreesRouter } from "./modules/academicDegrees/academicDegrees.routes.js";
import { accreditationsRouter } from "./modules/accreditations/accreditations.routes.js";
import { activityLogsRouter } from "./modules/activityLogs/activityLogs.routes.js";
import { approvalFlowsRouter } from "./modules/approvalFlows/approvalFlows.routes.js";
import { areasRouter } from "./modules/areas/areas.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { businessesRouter } from "./modules/businesses/businesses.routes.js";
import { competencyCertificatesRouter } from "./modules/competencyCertificates/competencyCertificates.routes.js";
import { contractorsRouter } from "./modules/contractors/contractors.routes.js";
import { coursesRouter } from "./modules/courses/courses.routes.js";
import { crewMemberCoursesGlobalRouter } from "./modules/crewMemberCourses/crewMemberCourses.global.routes.js";
import { crewMembersRouter } from "./modules/crewMembers/crewMembers.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { documentTypesRouter } from "./modules/documentTypes/documentTypes.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { locationsRouter } from "./modules/locations/locations.routes.js";
import { muellesRouter } from "./modules/muelles/muelles.routes.js";
import { notificationOutboxRouter } from "./modules/notificationOutbox/notificationOutbox.routes.js";
import { notificationSettingsRouter } from "./modules/notificationSettings/notificationSettings.routes.js";
import { permitTypesRouter } from "./modules/permitTypes/permitTypes.routes.js";
import { workNoticesRouter } from "./modules/workNotices/workNotices.routes.js";
import { workPermitsRouter } from "./modules/workPermits/workPermits.routes.js";
import { portsRouter } from "./modules/ports/ports.routes.js";
import { trainingsRouter } from "./modules/trainings/trainings.routes.js";
import { trainingSessionsRouter } from "./modules/trainingSessions/trainingSessions.routes.js";
import { ranksRouter } from "./modules/ranks/ranks.routes.js";
import { rolesRouter } from "./modules/roles/roles.routes.js";
import { systemAnnouncementsRouter } from "./modules/systemAnnouncements/systemAnnouncements.routes.js";
import { travesiasRouter } from "./modules/travesias/travesias.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

/** Orígenes CORS permitidos: WEB_APP_URL + CORS_ORIGINS (coma-separados). */
function resolveCorsOrigins(): string[] {
  const web = (process.env.WEB_APP_URL ?? "").trim().replace(/\/$/, "");
  const extras = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const list = [...(web ? [web] : []), ...extras];
  // Local sin env: Vite por defecto.
  if (list.length === 0 && process.env.NODE_ENV !== "production") {
    return ["http://localhost:5173"];
  }
  return [...new Set(list)];
}

export function createApp() {
  const app = express();
  const openApiDocument = buildOpenApiDocument();

  // Barrido de Maps de rate-limit / login pair (anti memory leak).
  startRateLimitCleanup();

  /**
   * Confiar en X-Forwarded-For solo detrás de un proxy real.
   * TRUST_PROXY=1 | true → un hop; número → hops; ausente → no confiar (req.ip = socket).
   * En prod detrás de Nginx/Cloudflare: obligatorio para que el rate limit por IP funcione.
   */
  const trustProxyRaw = (process.env.TRUST_PROXY ?? "").trim().toLowerCase();
  if (trustProxyRaw === "1" || trustProxyRaw === "true") {
    app.set("trust proxy", 1);
  } else if (/^\d+$/.test(trustProxyRaw)) {
    app.set("trust proxy", Number(trustProxyRaw));
  }

  /**
   * Swagger/OpenAPI: on en local; off en production salvo ENABLE_API_DOCS=true.
   * (Se calcula antes de helmet: con docs hay que relajar CSP.)
   */
  const docsFlag = (process.env.ENABLE_API_DOCS ?? "").trim().toLowerCase();
  const apiDocsEnabled =
    docsFlag === "1" || docsFlag === "true"
      ? true
      : docsFlag === "0" || docsFlag === "false"
        ? false
        : process.env.NODE_ENV !== "production";

  // Cabeceras de seguridad (CSP off si Swagger UI está activo: usa inline scripts).
  app.use(
    helmet({
      contentSecurityPolicy: apiDocsEnabled ? false : undefined,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // CORS con lista blanca (credenciales para cookie refresh si el front pega directo).
  const corsOrigins = resolveCorsOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        // Requests same-origin / curl sin Origin.
        if (!origin) {
          callback(null, true);
          return;
        }
        if (corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  // 12 MB: fotos y documentos en JSON+base64 (crew docs hasta 10 MB).
  app.use(express.json({ limit: "12mb" }));

  /**
   * Static de /uploads: whitelist estricta de fotos de perfil.
   * Documentos de crew NUNCA por static: solo GET …/documents/:id/download (RBAC).
   */
  app.use("/uploads", (req, res, next) => {
    if (!isAllowedPublicUploadPhotoPath(req.path)) {
      res.status(404).end();
      return;
    }
    next();
  });
  app.use(
    "/uploads",
    express.static(getUploadRoot(), {
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );

  if (apiDocsEnabled) {
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
    app.get("/api/openapi.json", (_req, res) => {
      res.json(openApiDocument);
    });
  }

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/businesses", businessesRouter);
  app.use("/api/v1/locations", locationsRouter);
  app.use("/api/v1/areas", areasRouter);
  app.use("/api/v1/ranks", ranksRouter);
  app.use("/api/v1/academic-degrees", academicDegreesRouter);
  app.use("/api/v1/competency-certificates", competencyCertificatesRouter);
  app.use("/api/v1/document-types", documentTypesRouter);
  app.use("/api/v1/permit-types", permitTypesRouter);
  app.use("/api/v1/approval-flows", approvalFlowsRouter);
  app.use("/api/v1/trainings", trainingsRouter);
  app.use("/api/v1/training-sessions", trainingSessionsRouter);
  app.use("/api/v1/contractors", contractorsRouter);
  app.use("/api/v1/accreditations", accreditationsRouter);
  app.use("/api/v1/work-notices", workNoticesRouter);
  app.use("/api/v1/work-permits", workPermitsRouter);
  app.use("/api/v1/courses", coursesRouter);
  app.use("/api/v1/ports", portsRouter);
  app.use("/api/v1/muelles", muellesRouter);
  app.use("/api/v1/travesias", travesiasRouter);
  app.use("/api/v1/roles", rolesRouter);
  app.use("/api/v1/activity-logs", activityLogsRouter);
  app.use("/api/v1/system-announcements", systemAnnouncementsRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/crew-members", crewMembersRouter);
  app.use("/api/v1/crew-member-courses", crewMemberCoursesGlobalRouter);
  app.use("/api/v1/notification-settings", notificationSettingsRouter);
  app.use("/api/v1/notification-outbox", notificationOutboxRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
