import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { validate } from "../../middlewares/validate.js";
import { loginHandler, meHandler } from "./auth.controller.js";
import { loginRequestSchema } from "./auth.schemas.js";

/** Rutas de autenticación bajo /api/v1/auth. */
export const authRouter = Router();

authRouter.post("/login", validate(loginRequestSchema), (req, res, next) => {
  loginHandler(req, res).catch(next);
});

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
