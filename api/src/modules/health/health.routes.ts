import { Router } from "express";
import { getHealthHandler } from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/", getHealthHandler);
