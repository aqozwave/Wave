import { Router } from "express";
import { PERMISSION_ACTION, PERMISSION_RESOURCE } from "../../lib/permissions.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { validate } from "../../middlewares/validate.js";
import {
  approveAccreditationHandler,
  createAccreditationHandler,
  getAccreditationHandler,
  listAccreditationsHandler,
  rejectAccreditationHandler,
  returnAccreditationHandler,
  submitAccreditationHandler,
} from "./accreditations.controller.js";
import {
  approveAccreditationRequestSchema,
  createAccreditationRequestSchema,
  getAccreditationRequestSchema,
  listAccreditationsRequestSchema,
  rejectAccreditationRequestSchema,
  returnAccreditationRequestSchema,
  submitAccreditationRequestSchema,
} from "./accreditations.schemas.js";

/**
 * Habilitaciones bajo /api/v1/accreditations (P2 bandeja).
 * Mutaciones por permiso (prevencionista puede; no exige admin).
 * Submit también con accreditations.update hasta existir portal contratista fino.
 */
export const accreditationsRouter = Router();

accreditationsRouter.get(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(listAccreditationsRequestSchema),
  listAccreditationsHandler,
);

accreditationsRouter.post(
  "/",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.CREATE,
  ),
  validate(createAccreditationRequestSchema),
  createAccreditationHandler,
);

accreditationsRouter.get(
  "/:id",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.READ,
  ),
  validate(getAccreditationRequestSchema),
  getAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/submit",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(submitAccreditationRequestSchema),
  submitAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/approve",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(approveAccreditationRequestSchema),
  approveAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/return",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(returnAccreditationRequestSchema),
  returnAccreditationHandler,
);

accreditationsRouter.post(
  "/:id/reject",
  authenticate,
  requirePermission(
    PERMISSION_RESOURCE.ACCREDITATIONS,
    PERMISSION_ACTION.UPDATE,
  ),
  validate(rejectAccreditationRequestSchema),
  rejectAccreditationHandler,
);
