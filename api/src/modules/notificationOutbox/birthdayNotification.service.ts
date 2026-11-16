import { getDateOnlyKey } from "../../lib/dateOnly.js";
import { prisma } from "../../lib/prisma.js";
import { listBirthdayNotificationRecipients } from "../roles/roles.service.js";
import { enqueueNotification } from "./notificationOutbox.service.js";

/** Zona horaria para “hoy es cumpleaños” (Chile). */
const BIRTHDAY_TIMEZONE = "America/Santiago";

/** Resultado del generador de cumpleaños (métricas Bruno / log). */
export type ProcessBirthdayNotificationsResult = {
  birthdayPeople: number;
  /** Felicitaciones encoladas al personal. */
  personEmails: number;
  /** Avisos encolados a admins con el check. */
  adminEmails: number;
  emailsQueued: number;
  recipients: number;
  skippedWithoutBusiness: number;
  skippedNoRecipients: number;
  skippedPersonWithoutEmail: number;
};

/** Persona con cumpleaños hoy (usuario o embarcado). */
type BirthdayPerson = {
  kind: "user" | "crew";
  id: string;
  run: string;
  firstName: string;
  lastName: string;
  /** Correo propio para la felicitación (puede faltar). */
  email: string | null;
  businessId: string;
  /** Solo embarcados: para FK del outbox. */
  crewMemberId: string | null;
  /** Solo usuarios: para dedupe si también es embarcado. */
  userId: string | null;
};

/**
 * Mes y día de calendario en una zona (1–12 / 1–31).
 * Sirve para comparar cumpleaños sin importar la hora del Date.
 */
function zonedMonthDay(
  date: Date,
  timeZone: string,
): { month: number; day: number } | null {
  if (Number.isNaN(date.getTime())) return null;
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
  });
  const map = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const month = Number(map.month);
  const day = Number(map.day);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

/** ¿La fecha de nacimiento cae hoy en la zona dada? */
function isBirthdayToday(
  birthDate: Date,
  now: Date,
  timeZone: string,
): boolean {
  const birth = zonedMonthDay(birthDate, timeZone);
  const today = zonedMonthDay(now, timeZone);
  if (!birth || !today) return false;
  return birth.month === today.month && birth.day === today.day;
}

/** Nombre visible. */
function formatPersonName(person: {
  firstName: string;
  lastName: string;
}): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** Normaliza email o null. */
function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email || null;
}

/**
 * Genera filas outbox:
 * 1) Felicitación al cumpleañero (si tiene email).
 * 2) Aviso a destinatarios con permiso birthdays.notifications (misma empresa).
 * No envía (eso es el worker). Idempotente vía dedupeKey.
 */
export async function processBirthdayNotifications(options?: {
  now?: Date;
}): Promise<ProcessBirthdayNotificationsResult> {
  const now = options?.now ?? new Date();
  const todayKey = getDateOnlyKey(
    // Mediodía UTC del día calendario en Chile → clave estable del cursor.
    (() => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: BIRTHDAY_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const map = Object.fromEntries(
        parts
          .filter((p) => p.type !== "literal")
          .map((p) => [p.type, p.value]),
      );
      return `${map.year}-${map.month}-${map.day}`;
    })(),
  );

  const result: ProcessBirthdayNotificationsResult = {
    birthdayPeople: 0,
    personEmails: 0,
    adminEmails: 0,
    emailsQueued: 0,
    recipients: 0,
    skippedWithoutBusiness: 0,
    skippedNoRecipients: 0,
    skippedPersonWithoutEmail: 0,
  };

  if (todayKey == null) return result;

  // Embarcados con fecha (no hace falta cuenta portal ni confirmed).
  const crewRows = await prisma.crewMember.findMany({
    where: { deletedAt: null, birthDate: { not: null } },
    select: {
      id: true,
      run: true,
      firstName: true,
      lastName: true,
      email: true,
      businessId: true,
      userId: true,
      birthDate: true,
      user: { select: { email: true } },
    },
  });

  const people: BirthdayPerson[] = [];
  /** Usuarios ya cubiertos por un embarcado vinculado (evitar doble mail). */
  const coveredUserIds = new Set<string>();

  for (const crew of crewRows) {
    if (!crew.birthDate || !isBirthdayToday(crew.birthDate, now, BIRTHDAY_TIMEZONE)) {
      continue;
    }
    if (!crew.businessId) {
      result.skippedWithoutBusiness += 1;
      continue;
    }
    people.push({
      kind: "crew",
      id: crew.id,
      run: crew.run,
      firstName: crew.firstName,
      lastName: crew.lastName,
      email: normalizeEmail(crew.email) ?? normalizeEmail(crew.user?.email),
      businessId: crew.businessId,
      crewMemberId: crew.id,
      userId: crew.userId,
    });
    if (crew.userId) coveredUserIds.add(crew.userId);
  }

  // Usuarios con fecha: sin acceso al sistema no bloquea el aviso.
  const userRows = await prisma.user.findMany({
    where: { deletedAt: null, birthDate: { not: null } },
    select: {
      id: true,
      run: true,
      firstName: true,
      lastName: true,
      email: true,
      businessId: true,
      birthDate: true,
    },
  });

  for (const user of userRows) {
    if (coveredUserIds.has(user.id)) continue;
    if (!user.birthDate || !isBirthdayToday(user.birthDate, now, BIRTHDAY_TIMEZONE)) {
      continue;
    }
    if (!user.businessId) {
      result.skippedWithoutBusiness += 1;
      continue;
    }
    people.push({
      kind: "user",
      id: user.id,
      run: user.run,
      firstName: user.firstName,
      lastName: user.lastName,
      email: normalizeEmail(user.email),
      businessId: user.businessId,
      crewMemberId: null,
      userId: user.id,
    });
  }

  result.birthdayPeople = people.length;
  if (people.length === 0) return result;

  const recipients = await listBirthdayNotificationRecipients();
  result.recipients = recipients.length;

  for (const person of people) {
    const personKey =
      person.kind === "crew" ? `crew:${person.id}` : `user:${person.id}`;
    const personName = formatPersonName(person);

    // 1) Felicitación al personal (siempre que haya correo).
    if (!person.email) {
      result.skippedPersonWithoutEmail += 1;
    } else {
      const { inserted } = await enqueueNotification({
        type: "birthday_person",
        dedupeKey: `birthday_person:${personKey}:${todayKey}`,
        to: person.email,
        businessId: person.businessId,
        crewMemberId: person.crewMemberId,
        payload: {
          personKind: person.kind,
          personId: person.id,
          personName,
          firstName: person.firstName,
          personRun: person.run,
          birthdayDateKey: todayKey,
        },
      });
      if (inserted) {
        result.personEmails += 1;
        result.emailsQueued += 1;
      }
    }

    // 2) Aviso a admins / RR.HH. con el check (misma empresa).
    let matchedRecipients = 0;
    for (const recipient of recipients) {
      const sameBusiness =
        recipient.seesAllBusinesses ||
        recipient.businessId === person.businessId;
      if (!sameBusiness) continue;
      matchedRecipients += 1;

      const { inserted } = await enqueueNotification({
        type: "birthday_admin",
        dedupeKey: `birthday_admin:${personKey}:${recipient.id}:${todayKey}`,
        to: recipient.email,
        businessId: person.businessId,
        crewMemberId: person.crewMemberId,
        payload: {
          personKind: person.kind,
          personId: person.id,
          personName,
          personRun: person.run,
          birthdayDateKey: todayKey,
        },
      });
      if (inserted) {
        result.adminEmails += 1;
        result.emailsQueued += 1;
      }
    }

    if (matchedRecipients === 0) {
      result.skippedNoRecipients += 1;
    }
  }

  return result;
}
