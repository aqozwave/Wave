import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
} from "./auth.controller.js";
import {
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from "./auth.schemas.js";

/** Rutas de autenticación bajo /api/v1/auth. */
export const authRouter = Router();

// Alta interna: solo superadmin (como el portal viejo; permisos finos en §6).
authRouter.post(
  "/register",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  requireSuperadmin,
  validate(registerRequestSchema),
  (req, res, next) => {
    registerHandler(req, res).catch(next);
  },
);

authRouter.post("/login", validate(loginRequestSchema), (req, res, next) => {
  loginHandler(req, res).catch(next);
});

authRouter.post(
  "/refresh",
  validate(refreshRequestSchema),
  (req, res, next) => {
    refreshHandler(req, res).catch(next);
  },
);

// authenticate → me: Bearer obligatorio; 401 si falta o es inválido.
authRouter.get(
  "/me",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  (req, res, next) => {
    meHandler(req, res).catch(next);
  },
);

// authenticate → logout: invalida sesión y limpia cookie.
authRouter.post(
  "/logout",
  (req, res, next) => {
    authenticate(req, res, next).catch(next);
  },
  (req, res, next) => {
    logoutHandler(req, res).catch(next);
  },
);
