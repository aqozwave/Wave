import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
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
 * RBAC: approval_flows (Admin + Superadmin por preset; editable en Roles).
 */
export const approvalFlowsRouter = Router();

approvalFlowsRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.APPROVAL_FLOWS,
    PERMISSION_ACTION.READ,
  ),
  validate(listApprovalFlowsRequestSchema),
  listApprovalFlowsHandler,
);

approvalFlowsRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.APPROVAL_FLOWS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createApprovalFlowRequestSchema),
  createApprovalFlowHandler,
);

approvalFlowsRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.APPROVAL_FLOWS,
    PERMISSION_ACTION.READ,
  ),
  validate(getApprovalFlowRequestSchema),
  getApprovalFlowHandler,
);

approvalFlowsRouter.patch(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.APPROVAL_FLOWS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateApprovalFlowRequestSchema),
  updateApprovalFlowHandler,
);

approvalFlowsRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.APPROVAL_FLOWS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteApprovalFlowRequestSchema),
  deleteApprovalFlowHandler,
);

approvalFlowsRouter.post(
  "/:id/stages",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.APPROVAL_FLOWS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(createApprovalFlowStageRequestSchema),
  addApprovalFlowStageHandler,
);

approvalFlowsRouter.patch(
  "/:id/stages/:stageId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.APPROVAL_FLOWS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(updateApprovalFlowStageRequestSchema),
  updateApprovalFlowStageHandler,
);

approvalFlowsRouter.delete(
  "/:id/stages/:stageId",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.APPROVAL_FLOWS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(deleteApprovalFlowStageRequestSchema),
  deleteApprovalFlowStageHandler,
);
