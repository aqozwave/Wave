import { prisma } from "../../lib/prisma.js";
import { enqueueNotification } from "./notificationOutbox.service.js";

/** Datos mínimos del PT recién creado para el mail al contratista. */
export type WorkPermitCreatedNotifyInput = {
  id: string;
  code: string;
  businessId: string;
  organizationId: string;
  organizationName: string;
  locationName: string;
  permitTypeName: string;
  scheduledDate: Date;
  workNoticeCode: string | null;
  description: string | null;
  /** Contacto de la ficha org (si no hay usuario portal con ese mail). */
  contactEmail: string | null;
};

/** Resultado del encolado. */
export type EnqueueWorkPermitCreatedResult = {
  recipients: number;
  inserted: number;
  skipped: number;
};

/**
 * Encola `work_permit_created` a cada usuario activo de la org contratista
 * (+ contactEmail de la ficha si no está ya en la lista).
 * Idempotente por (PT, email). No envía (eso es el worker).
 */
export async function enqueueWorkPermitCreatedNotifications(
  permit: WorkPermitCreatedNotifyInput,
): Promise<EnqueueWorkPermitCreatedResult> {
  const portalUsers = await prisma.user.findMany({
    where: {
      organizationId: permit.organizationId,
      deletedAt: null,
      state: true,
    },
    select: { id: true, email: true },
  });

  /** Destinos únicos (lowercase). */
  const recipients = new Map<string, { email: string; userId: string | null }>();
  for (const user of portalUsers) {
    const email = user.email.trim().toLowerCase();
    if (!email) continue;
    recipients.set(email, { email, userId: user.id });
  }

  const contact = permit.contactEmail?.trim().toLowerCase() ?? "";
  if (contact && !recipients.has(contact)) {
    recipients.set(contact, { email: contact, userId: null });
  }

  let inserted = 0;
  let skipped = 0;

  for (const recipient of recipients.values()) {
    try {
      const { inserted: wasInserted } = await enqueueNotification({
        type: "work_permit_created",
        dedupeKey: `work_permit_created:${permit.id}:${recipient.email}`,
        to: recipient.email,
        payload: {
          workPermitId: permit.id,
          code: permit.code,
          organizationName: permit.organizationName,
          locationName: permit.locationName,
          permitTypeName: permit.permitTypeName,
          scheduledDate: permit.scheduledDate.toISOString(),
          workNoticeCode: permit.workNoticeCode,
          description: permit.description,
          recipientUserId: recipient.userId,
        },
        businessId: permit.businessId,
        crewMemberId: null,
      });
      if (wasInserted) inserted += 1;
      else skipped += 1;
    } catch (error) {
      console.error("Error encolando PT al contratista", {
        workPermitId: permit.id,
        to: recipient.email,
        error: error instanceof Error ? error.message : String(error),
      });
      skipped += 1;
    }
  }

  const result = {
    recipients: recipients.size,
    inserted,
    skipped,
  };
  console.info("Permisos de trabajo encolados al contratista", {
    code: permit.code,
    ...result,
  });
  return result;
}
