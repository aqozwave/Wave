import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { validate } from "../../middlewares/validate.js";
import {
  createApprovalFlowHandler,
  getApprovalFlowHandler,
  listApprovalFlowsHandler,
} from "./approvalFlows.controller.js";
import {
  createApprovalFlowRequestSchema,
  getApprovalFlowRequestSchema,
  listApprovalFlowsRequestSchema,
} from "./approvalFlows.schemas.js";

/**
 * Flujos de aprobación bajo /api/v1/approval-flows (P16).
 * Catálogo solo Superadmin en esta entrega.
 */
export const approvalFlowsRouter = Router();

approvalFlowsRouter.get(
  "/",
  authenticate,
  requireSuperadmin,
  validate(listApprovalFlowsRequestSchema),
  listApprovalFlowsHandler,
);

approvalFlowsRouter.post(
  "/",
  authenticate,
  requireSuperadmin,
  validate(createApprovalFlowRequestSchema),
  createApprovalFlowHandler,
);

approvalFlowsRouter.get(
  "/:id",
  authenticate,
  requireSuperadmin,
  validate(getApprovalFlowRequestSchema),
  getApprovalFlowHandler,
);
