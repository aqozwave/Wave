import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  confirmEmailHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  resendConfirmationHandler,
  resendMfaHandler,
  resetPasswordHandler,
  verifyMfaHandler,
} from "./auth.controller.js";
import {
  confirmEmailRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  resendConfirmationRequestSchema,
  resendMfaRequestSchema,
  resetPasswordRequestSchema,
  verifyMfaRequestSchema,
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

// Público: el token del correo demuestra posesión del enlace.
authRouter.post(
  "/confirm-email",
  validate(confirmEmailRequestSchema),
  (req, res, next) => {
    confirmEmailHandler(req, res).catch(next);
  },
);

// Público: reenvío con mensaje fijo (no revela si el email existe).
authRouter.post(
  "/resend-confirmation",
  validate(resendConfirmationRequestSchema),
  (req, res, next) => {
    resendConfirmationHandler(req, res).catch(next);
  },
);

// Público: pide enlace de reset (mensaje fijo).
authRouter.post(
  "/forgot-password",
  validate(forgotPasswordRequestSchema),
  (req, res, next) => {
    forgotPasswordHandler(req, res).catch(next);
  },
);

// Público: aplica nueva contraseña con el token del correo.
authRouter.post(
  "/reset-password",
  validate(resetPasswordRequestSchema),
  (req, res, next) => {
    resetPasswordHandler(req, res).catch(next);
  },
);

authRouter.post("/login", validate(loginRequestSchema), (req, res, next) => {
  loginHandler(req, res).catch(next);
});

// MFA: verificar código (mismo X-Client que login para cookie/body).
authRouter.post(
  "/verify-mfa",
  validate(verifyMfaRequestSchema),
  (req, res, next) => {
    verifyMfaHandler(req, res).catch(next);
  },
);

authRouter.post(
  "/resend-mfa",
  validate(resendMfaRequestSchema),
  (req, res, next) => {
    resendMfaHandler(req, res).catch(next);
  },
);

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
