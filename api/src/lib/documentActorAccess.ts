import type { DocumentType } from "@prisma/client";
import { AppError } from "./errors.js";

/**
 * Etiquetas de actor derivadas del usuario (Figma «Lo suben» / «Lo ven»).
 * No son roles Prisma: varios role.key pueden mapear a la misma etiqueta.
 */
export type DocumentActorTag = "admin" | "prevention" | "hr" | "assets";

/** Scopes del maestro DocumentType.uploadBy / viewBy. */
export type DocumentActorScope =
  | "prevention_or_admin"
  | "prevention_admin_hr_assets"
  | "admin"
  | "hr"
  | "assets";

/** Quién entra en cada scope de Figma. */
const SCOPE_TAGS: Record<DocumentActorScope, ReadonlySet<DocumentActorTag>> = {
  prevention_or_admin: new Set(["prevention", "admin"]),
  prevention_admin_hr_assets: new Set([
    "prevention",
    "admin",
    "hr",
    "assets",
  ]),
  admin: new Set(["admin"]),
  hr: new Set(["hr"]),
  assets: new Set(["assets"]),
};

/**
 * Normaliza role.key / internalRol a etiquetas de documento.
 * - admin / superadmin → admin
 * - contratista, prevencion*, prevention* → prevention
 * - hr, rrhh, recursos* → hr
 * - assets, activo* → assets
 */
export function resolveDocumentActorTags(input: {
  internalRol: string;
  roleKey: string | null;
}): Set<DocumentActorTag> {
  const tags = new Set<DocumentActorTag>();
  const rol = input.internalRol.trim().toLowerCase();
  const key = (input.roleKey ?? "").trim().toLowerCase();

  if (rol === "superadmin" || rol === "admin" || key === "admin") {
    tags.add("admin");
  }
  if (
    key === "contratista" ||
    key.startsWith("prevencion") ||
    key.startsWith("prevention")
  ) {
    tags.add("prevention");
  }
  if (key === "hr" || key === "rrhh" || key.startsWith("recursos")) {
    tags.add("hr");
  }
  if (key === "assets" || key.startsWith("activo")) {
    tags.add("assets");
  }

  return tags;
}

/** True si alguna etiqueta del actor está en el scope. */
export function actorMatchesScope(
  scope: string,
  tags: ReadonlySet<DocumentActorTag>,
): boolean {
  const allowed = SCOPE_TAGS[scope as DocumentActorScope];
  if (!allowed) return false;
  for (const tag of tags) {
    if (allowed.has(tag)) return true;
  }
  return false;
}

/**
 * ¿Puede subir este tipo?
 * Superadmin siempre; el resto debe matchear uploadBy.
 */
export function assertCanUploadDocumentType(
  docType: Pick<DocumentType, "uploadBy" | "code" | "name">,
  input: { internalRol: string; roleKey: string | null },
): void {
  if (input.internalRol === "superadmin") return;
  const tags = resolveDocumentActorTags(input);
  if (actorMatchesScope(docType.uploadBy, tags)) return;
  throw new AppError(
    403,
    "document_upload_forbidden",
    `No tenés permiso para subir documentos del tipo «${docType.code}»`,
  );
}

/**
 * ¿Puede ver este tipo (listado / descarga)?
 * - Superadmin: sí
 * - Staff que matchea viewBy: sí
 * - Tripulante dueño (isSubjectCrew) solo si crewCanView
 */
export function canViewDocumentType(
  docType: Pick<DocumentType, "viewBy" | "crewCanView">,
  input: {
    internalRol: string;
    roleKey: string | null;
    /** True si el actor es el User vinculado al CrewMember del expediente. */
    isSubjectCrew: boolean;
  },
): boolean {
  if (input.internalRol === "superadmin") return true;

  const tags = resolveDocumentActorTags(input);
  if (actorMatchesScope(docType.viewBy, tags)) return true;

  if (input.isSubjectCrew && docType.crewCanView) return true;

  return false;
}

/**
 * El tipo debe aplicar a tripulante (no solo «persona externa»).
 */
export function assertDocumentTypeAppliesToCrew(
  docType: Pick<DocumentType, "appliesTo" | "code">,
): void {
  if (docType.appliesTo === "external") {
    throw new AppError(
      400,
      "document_type_not_for_crew",
      `El tipo «${docType.code}» solo aplica a persona externa`,
    );
  }
}
