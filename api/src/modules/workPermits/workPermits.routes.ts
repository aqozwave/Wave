import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  approveWorkPermitHandler,
  createWorkPermitHandler,
  getWorkPermitChecklistHandler,
  getWorkPermitHandler,
  listWorkPermitHistoryHandler,
  listWorkPermitPeopleHandler,
  listWorkPermitsHandler,
  putWorkPermitChecklistHandler,
  putWorkPermitPeopleHandler,
  receiveWorkPermitHandler,
  rejectReceiptWorkPermitHandler,
  returnWorkPermitHandler,
  submitWorkPermitHandler,
} from "./workPermits.controller.js";
import {
  approveWorkPermitRequestSchema,
  createWorkPermitRequestSchema,
  getWorkPermitChecklistRequestSchema,
  getWorkPermitRequestSchema,
  listWorkPermitHistoryRequestSchema,
  listWorkPermitPeopleRequestSchema,
  listWorkPermitsRequestSchema,
  putWorkPermitChecklistRequestSchema,
  putWorkPermitPeopleRequestSchema,
  receiveWorkPermitRequestSchema,
  rejectReceiptWorkPermitRequestSchema,
  returnWorkPermitRequestSchema,
  submitWorkPermitRequestSchema,
} from "./workPermits.schemas.js";

/**
 * Permisos de trabajo bajo /api/v1/work-permits.
 * Completar (people/checklist) = contratista o Prevención (update).
 * Aprobar/devolver = Prevención. Recibir = capitán (receive).
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
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.RECEIVE,
  ),
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
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.WORK_PERMITS,
    PERMISSION_ACTION.READ,
  ),
  validate(getWorkPermitRequestSchema),
  getWorkPermitHandler,
);
