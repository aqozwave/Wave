import { listPreventionStaffRecipients } from "../roles/roles.service.js";
import { enqueueNotification } from "./notificationOutbox.service.js";

/** Datos mínimos del aviso recién creado para el mail. */
export type WorkNoticeCreatedNotifyInput = {
  id: string;
  code: string;
  businessId: string;
  organizationName: string;
  locationName: string;
  permitTypeName: string;
  requestingAreaName: string;
  tentativeDate: Date;
  description: string | null;
};

/** Resultado del encolado (métricas para log). */
export type EnqueueWorkNoticeCreatedResult = {
  recipients: number;
  inserted: number;
  skipped: number;
};

/**
 * Encola un mail `work_notice_created` a cada admin/prevencionista del tenant.
 * Idempotente por (aviso, destinatario). No envía (eso es el worker).
 */
export async function enqueueWorkNoticeCreatedNotifications(
  notice: WorkNoticeCreatedNotifyInput,
): Promise<EnqueueWorkNoticeCreatedResult> {
  const recipients = await listPreventionStaffRecipients({
    businessId: notice.businessId,
  });

  let inserted = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    // Solo staff de la misma empresa (el helper ya filtró superadmin sueltos).
    if (
      recipient.businessId !== notice.businessId &&
      !recipient.seesAllBusinesses
    ) {
      skipped += 1;
      continue;
    }

    try {
      const { inserted: wasInserted } = await enqueueNotification({
        type: "work_notice_created",
        dedupeKey: `work_notice_created:${notice.id}:${recipient.id}`,
        to: recipient.email,
        payload: {
          workNoticeId: notice.id,
          code: notice.code,
          organizationName: notice.organizationName,
          locationName: notice.locationName,
          permitTypeName: notice.permitTypeName,
          requestingAreaName: notice.requestingAreaName,
          tentativeDate: notice.tentativeDate.toISOString(),
          description: notice.description,
        },
        businessId: notice.businessId,
        crewMemberId: null,
      });
      if (wasInserted) inserted += 1;
      else skipped += 1;
    } catch (error) {
      console.error("Error encolando aviso de trabajo a Prevención", {
        workNoticeId: notice.id,
        to: recipient.email,
        error: error instanceof Error ? error.message : String(error),
      });
      skipped += 1;
    }
  }

  const result = {
    recipients: recipients.length,
    inserted,
    skipped,
  };
  console.info("Avisos de trabajo encolados a Prevención", {
    code: notice.code,
    ...result,
  });
  return result;
}
