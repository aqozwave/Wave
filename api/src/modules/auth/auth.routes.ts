import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  confirmEmailHandler,
  deleteMyPhotoHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  resendConfirmationHandler,
  resendMfaHandler,
  resetPasswordHandler,
  updateMeHandler,
  uploadMyPhotoHandler,
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
  updateMeRequestSchema,
  uploadMyPhotoRequestSchema,
  verifyMfaRequestSchema,
} from "./auth.schemas.js";

/**
 * Rutas de autenticación bajo /api/v1/auth.
 * Express 5: handlers async se pasan directo (rejects → errorHandler).
 */
export const authRouter = Router();

// Alta interna: solo superadmin (permisos finos en §6).
authRouter.post(
  "/register",
  authenticate,
  requireSuperadmin,
  validate(registerRequestSchema),
  registerHandler,
);

// Público: el token del correo demuestra posesión del enlace.
authRouter.post(
  "/confirm-email",
  validate(confirmEmailRequestSchema),
  confirmEmailHandler,
);

// Público: reenvío con mensaje fijo (no revela si el email existe).
authRouter.post(
  "/resend-confirmation",
  validate(resendConfirmationRequestSchema),
  resendConfirmationHandler,
);

// Público: pide enlace de reset (mensaje fijo).
authRouter.post(
  "/forgot-password",
  validate(forgotPasswordRequestSchema),
  forgotPasswordHandler,
);

// Público: aplica nueva contraseña con el token del correo.
authRouter.post(
  "/reset-password",
  validate(resetPasswordRequestSchema),
  resetPasswordHandler,
);

authRouter.post("/login", validate(loginRequestSchema), loginHandler);

// MFA: verificar código (mismo X-Client que login para cookie/body).
authRouter.post(
  "/verify-mfa",
  validate(verifyMfaRequestSchema),
  verifyMfaHandler,
);

authRouter.post(
  "/resend-mfa",
  validate(resendMfaRequestSchema),
  resendMfaHandler,
);

authRouter.post("/refresh", validate(refreshRequestSchema), refreshHandler);

// Bearer obligatorio; 401 si falta o es inválido.
authRouter.get("/me", authenticate, meHandler);

authRouter.patch(
  "/me",
  authenticate,
  validate(updateMeRequestSchema),
  updateMeHandler,
);

authRouter.post(
  "/me/photo",
  authenticate,
  validate(uploadMyPhotoRequestSchema),
  uploadMyPhotoHandler,
);

authRouter.delete("/me/photo", authenticate, deleteMyPhotoHandler);

// Invalida sesión y limpia cookie.
authRouter.post("/logout", authenticate, logoutHandler);
