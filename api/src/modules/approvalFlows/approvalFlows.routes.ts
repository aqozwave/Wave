import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSuperadmin } from "../../middlewares/requireSuperadmin.js";
import { requireTenantManager } from "../../middlewares/requireTenantManager.js";
import { validate } from "../../middlewares/validate.js";
import {
  addApprovalFlowStageHandler,
  createApprovalFlowHandler,
  deleteApprovalFlowHandler,
  deleteApprovalFlowStageHandler,
  getApprovalFlowHandler,
  listApprovalFlowsHandler,
  updateApprovalFlowHandler,
  updateApprovalFlowStageHandler,
} from "./approvalFlows.controller.js";
import {
  createApprovalFlowRequestSchema,
  createApprovalFlowStageRequestSchema,
  deleteApprovalFlowRequestSchema,
  deleteApprovalFlowStageRequestSchema,
  getApprovalFlowRequestSchema,
  listApprovalFlowsRequestSchema,
  updateApprovalFlowRequestSchema,
  updateApprovalFlowStageRequestSchema,
} from "./approvalFlows.schemas.js";

/**
 * Flujos de aprobación bajo /api/v1/approval-flows (P16).
 * Lectura: admin/superadmin (asignar a tipo). Escritura: solo Superadmin.
 */
export const approvalFlowsRouter = Router();

approvalFlowsRouter.get(
  "/",
  authenticate,
  requireTenantManager,
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
  requireTenantManager,
  validate(getApprovalFlowRequestSchema),
  getApprovalFlowHandler,
);

approvalFlowsRouter.patch(
  "/:id",
  authenticate,
  requireSuperadmin,
  validate(updateApprovalFlowRequestSchema),
  updateApprovalFlowHandler,
);

approvalFlowsRouter.delete(
  "/:id",
  authenticate,
  requireSuperadmin,
  validate(deleteApprovalFlowRequestSchema),
  deleteApprovalFlowHandler,
);

approvalFlowsRouter.post(
  "/:id/stages",
  authenticate,
  requireSuperadmin,
  validate(createApprovalFlowStageRequestSchema),
  addApprovalFlowStageHandler,
);

approvalFlowsRouter.patch(
  "/:id/stages/:stageId",
  authenticate,
  requireSuperadmin,
  validate(updateApprovalFlowStageRequestSchema),
  updateApprovalFlowStageHandler,
);

approvalFlowsRouter.delete(
  "/:id/stages/:stageId",
  authenticate,
  requireSuperadmin,
  validate(deleteApprovalFlowStageRequestSchema),
  deleteApprovalFlowStageHandler,
);
