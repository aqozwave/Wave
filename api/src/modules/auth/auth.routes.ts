import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import { loginHandler } from "./auth.controller.js";
import { loginRequestSchema } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/login", validate(loginRequestSchema), (req, res, next) => {
  loginHandler(req, res).catch(next);
});
