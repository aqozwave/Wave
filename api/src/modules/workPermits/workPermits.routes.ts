import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import {
  requireAnyPermission,
  requirePermission,
} from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  approveWorkPermitHandler,
  checkWorkPermitRequirementsHandler,
  closeWorkPermitHandler,
  createWorkPermitHandler,
  deleteWorkPermitHandler,
  getWorkPermitChecklistHandler,
  getWorkPermitDocumentHandler,
  getWorkPermitHandler,
  listWorkPermitAssignablePeopleHandler,
  listWorkPermitHistoryHandler,
  listWorkPermitPeopleHandler,
  listWorkPermitsHandler,
  putWorkPermitChecklistHandler,
  putWorkPermitPeopleHandler,
  receiveWorkPermitHandler,
  refreshWorkPermitApprovalFlowHandler,
  rejectCloseWorkPermitHandler,
  rejectReceiptWorkPermitHandler,
  requestCloseWorkPermitHandler,
  returnWorkPermitHandler,
  submitWorkPermitHandler,
} from "./workPermits.controller.js";
import {
  approveWorkPermitRequestSchema,
  closeWorkPermitRequestSchema,
  createWorkPermitRequestSchema,
  deleteWorkPermitRequestSchema,
  getWorkPermitChecklistRequestSchema,
  getWorkPermitDocumentRequestSchema,
  getWorkPermitRequestSchema,
  listWorkPermitAssignablePeopleRequestSchema,
  listWorkPermitHistoryRequestSchema,
  listWorkPermitPeopleRequestSchema,
  listWorkPermitsRequestSchema,
  putWorkPermitChecklistRequestSchema,
  putWorkPermitPeopleRequestSchema,
  receiveWorkPermitRequestSchema,
  refreshWorkPermitApprovalFlowRequestSchema,
  rejectCloseWorkPermitRequestSchema,
  rejectReceiptWorkPermitRequestSchema,
  requestCloseWorkPermitRequestSchema,
  returnWorkPermitRequestSchema,
  submitWorkPermitRequestSchema,
  workPermitRequirementsCheckRequestSchema,
} from "./workPermits.schemas.js";

/**
 * Permisos de trabajo bajo /api/v1/work-permits.
 * Completar (people/checklist) = contratista o Prevención (update).
 * Aprobar/devolver = Prevención. Recibir/cerrar = capitán (receive).
 */
export const workPermitsRouter = Router();

workPermitsRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(listWorkPermitsRequestSchema),
  listWorkPermitsHandler,
);

workPermitsRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createWorkPermitRequestSchema),
  createWorkPermitHandler,
);

/** Antes de /:id para no capturar "requirements-check" como uuid. */
workPermitsRouter.get(
  "/requirements-check",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(workPermitRequirementsCheckRequestSchema),
  checkWorkPermitRequirementsHandler,
);

workPermitsRouter.get(
  "/:id/assignable-people",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(listWorkPermitAssignablePeopleRequestSchema),
  listWorkPermitAssignablePeopleHandler,
);

workPermitsRouter.get(
  "/:id/people",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(listWorkPermitPeopleRequestSchema),
  listWorkPermitPeopleHandler,
);

workPermitsRouter.put(
  "/:id/people",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(putWorkPermitPeopleRequestSchema),
  putWorkPermitPeopleHandler,
);

workPermitsRouter.get(
  "/:id/checklist",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(getWorkPermitChecklistRequestSchema),
  getWorkPermitChecklistHandler,
);

workPermitsRouter.put(
  "/:id/checklist",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(putWorkPermitChecklistRequestSchema),
  putWorkPermitChecklistHandler,
);

workPermitsRouter.post(
  "/:id/submit",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(submitWorkPermitRequestSchema),
  submitWorkPermitHandler,
);

workPermitsRouter.post(
  "/:id/approve",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(approveWorkPermitRequestSchema),
  approveWorkPermitHandler,
);

workPermitsRouter.post(
  "/:id/refresh-approval-flow",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(refreshWorkPermitApprovalFlowRequestSchema),
  refreshWorkPermitApprovalFlowHandler,
);

workPermitsRouter.post(
  "/:id/return",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(returnWorkPermitRequestSchema),
  returnWorkPermitHandler,
);

workPermitsRouter.post(
  "/:id/receive",
  authenticate,
  requireAnyPermission([
    {
      resource: PERMISSION_RESOURCE.WORK_PERMITS,
      action: PERMISSION_ACTION.RECEIVE,
    },
    {
      resource: PERMISSION_RESOURCE.WORK_PERMITS,
      action: PERMISSION_ACTION.UPDATE,
    },
  ]),
  validate(receiveWorkPermitRequestSchema),
  receiveWorkPermitHandler,
);

workPermitsRouter.post(
  "/:id/reject-receipt",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.RECEIVE,
  ),
  validate(rejectReceiptWorkPermitRequestSchema),
  rejectReceiptWorkPermitHandler,
);

workPermitsRouter.post(
  "/:id/request-close",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(requestCloseWorkPermitRequestSchema),
  requestCloseWorkPermitHandler,
);

workPermitsRouter.post(
  "/:id/close",
  authenticate,
  requireAnyPermission([
    {
      resource: PERMISSION_RESOURCE.WORK_PERMITS,
      action: PERMISSION_ACTION.RECEIVE,
    },
    {
      resource: PERMISSION_RESOURCE.WORK_PERMITS,
      action: PERMISSION_ACTION.UPDATE,
    },
  ]),
  validate(closeWorkPermitRequestSchema),
  closeWorkPermitHandler,
);

workPermitsRouter.post(
  "/:id/reject-close",
  authenticate,
  requireAnyPermission([
    {
      resource: PERMISSION_RESOURCE.WORK_PERMITS,
      action: PERMISSION_ACTION.RECEIVE,
    },
    {
      resource: PERMISSION_RESOURCE.WORK_PERMITS,
      action: PERMISSION_ACTION.UPDATE,
    },
  ]),
  validate(rejectCloseWorkPermitRequestSchema),
  rejectCloseWorkPermitHandler,
);

workPermitsRouter.get(
  "/:id/history",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(listWorkPermitHistoryRequestSchema),
  listWorkPermitHistoryHandler,
);

workPermitsRouter.get(
  "/:id/document",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(getWorkPermitDocumentRequestSchema),
  getWorkPermitDocumentHandler,
);

workPermitsRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(getWorkPermitRequestSchema),
  getWorkPermitHandler,
);

workPermitsRouter.delete(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.DEACTIVATE,
  ),
  validate(deleteWorkPermitRequestSchema),
  deleteWorkPermitHandler,
);
