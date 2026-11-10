import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardCheck } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { Logo } from "../../components/Logo/Logo";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  WorkPermitSignModal,
  type WorkPermitSignKind,
} from "../../components/WorkPermitSignModal/WorkPermitSignModal";
import { userHasPermission } from "../../lib/api/auth";
import {
  downloadAccreditationPersonDocumentRequest,
  listAccreditationPersonDocumentsRequest,
  previewAccreditationPersonDocumentRequest,
  type AccreditationPersonDocumentChecklistItem,
} from "../../lib/api/accreditations";
import {
  WORK_PERMIT_SIGNATURE_SLOTS,
  approveWorkPermitRequest,
  closeWorkPermitRequest,
  getWorkPermitChecklistRequest,
  getWorkPermitDocumentRequest,
  getWorkPermitRequest,
  listWorkPermitHistoryRequest,
  listWorkPermitPeopleRequest,
  receiveWorkPermitRequest,
  rejectCloseWorkPermitRequest,
  rejectReceiptWorkPermitRequest,
  requestCloseWorkPermitRequest,
  returnWorkPermitRequest,
  workPermitStatusLabel,
  type WorkPermit,
  type WorkPermitChecklistItem,
  type WorkPermitDigitalSignaturePayload,
  type WorkPermitDocument,
  type WorkPermitDocumentIssuer,
  type WorkPermitDocumentSignature,
  type WorkPermitHistoryItem,
  type WorkPermitPerson,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { WorkPermitCompleteModal } from "./WorkPermitCompleteModal";

/** Tabs de la ficha (P6 / P6d / P6e / P6f). */
type TabId = "datos" | "personal" | "checklist" | "documento" | "historial";

/** Capitaliza. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** dd-mm-yyyy. */
function formatDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** Fecha+hora corta es-CL. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tono chip de estado. */
function statusTone(
  status: WorkPermitStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "to_approve":
      return "info";
    case "to_receive":
    case "to_verify":
    case "to_complete":
      return "warning";
    case "no_closure":
      return "danger";
    default:
      return "neutral";
  }
}

/** Etiqueta Sí/No/N/A. */
function answerLabel(answer: string | null): string {
  if (answer === "yes") return "Sí";
  if (answer === "no") return "No";
  if (answer === "na") return "N/A";
  return "Sin responder";
}

/** Resumen corto de gaps de docs de una persona asignada. */
function personDocsHint(p: WorkPermitPerson): string {
  if (p.docsOk) return "Pack y faena OK";
  const parts: string[] = [];
  if (p.absentPackCodes.length > 0) {
    parts.push(`falta pack: ${p.absentPackCodes.join(", ")}`);
  }
  if (p.pendingPackCodes.length > 0) {
    parts.push(`pack en revisión: ${p.pendingPackCodes.join(", ")}`);
  }
  if (p.absentRequirementLabels.length > 0) {
    parts.push(`falta faena: ${p.absentRequirementLabels.join(", ")}`);
  }
  if (p.pendingRequirementLabels.length > 0) {
    parts.push(`faena en revisión: ${p.pendingRequirementLabels.join(", ")}`);
  }
  return parts.join(" · ") || "Documentación incompleta";
}

/** Etiqueta estado doc persona. */
function personDocStatusLabel(status: string): string {
  switch (status) {
    case "pending_validation":
      return "Pendiente";
    case "validated":
      return "Vigente";
    case "observed":
      return "Observado";
    case "replaced":
      return "Reemplazado";
    default:
      return status;
  }
}

/** Tono chip doc persona. */
function personDocStatusTone(
  status: string,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "validated") return "success";
  if (status === "observed") return "danger";
  if (status === "pending_validation") return "warning";
  return "neutral";
}

const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/**
 * Firmas que ya deberían existir según el estado actual del PT.
 * Sirve para detectar PT transitados antes de P6c (sin backfill).
 */
function expectedSignatureKindsForStatus(
  status: WorkPermitStatus,
): string[] {
  switch (status) {
    case "to_receive":
      return ["prevention_approve"];
    case "active":
      return ["prevention_approve", "captain_receive"];
    case "to_verify":
      return [
        "prevention_approve",
        "captain_receive",
        "contractor_request_close",
      ];
    case "closed":
      return [
        "prevention_approve",
        "captain_receive",
        "contractor_request_close",
        "captain_close",
      ];
    case "no_closure":
      return [
        "prevention_approve",
        "captain_receive",
        "contractor_request_close",
        "captain_no_closure",
      ];
    default:
      return [];
  }
}

/**
 * true si el PT ya pasó hitos que deberían firmar y faltan esas firmas
 * (típico: avanzó antes de registrar firmas en BD).
 */
function signaturesLagBehindStatus(
  status: WorkPermitStatus,
  signatures: WorkPermitDocumentSignature[],
): boolean {
  const expected = expectedSignatureKindsForStatus(status);
  if (expected.length === 0) return false;
  const present = new Set(signatures.map((s) => s.kind));
  return expected.some((kind) => !present.has(kind));
}

/**
 * Arma la lista de hitos (firmados + pendientes) para el bloque Documento.
 * Omite el hito de cierre no usado cuando ya existe el otro (cierre ↔ sin cierre).
 */
function buildSignatureRows(
  signatures: WorkPermitDocumentSignature[],
): Array<{
  kind: string;
  label: string;
  signed: WorkPermitDocumentSignature | null;
}> {
  const byKind = new Map(signatures.map((s) => [s.kind, s]));
  const hasClose = byKind.has("captain_close");
  const hasNoClosure = byKind.has("captain_no_closure");

  return WORK_PERMIT_SIGNATURE_SLOTS.filter((slot) => {
    if (slot.kind === "captain_close" && hasNoClosure && !hasClose) {
      return false;
    }
    if (slot.kind === "captain_no_closure" && hasClose && !hasNoClosure) {
      return false;
    }
    // Sin ninguna firma de cierre: se muestran ambos como pendientes.
    return true;
  }).map((slot) => ({
    kind: slot.kind,
    label: slot.label,
    signed: byKind.get(slot.kind) ?? null,
  }));
}

/**
 * Ficha de revisión del permiso (P5e1 · P6*).
 * Sirve staff (`/prevencion/permisos/:id`) y portal (`/portal/permisos/:id`).
 * Tabs: datos, personal, checklist, documento (firmas), historial.
 */
export function WorkPermitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canRead = userHasPermission(user, "work_permits", "read");
  const canUpdate = userHasPermission(user, "work_permits", "update");
  const canReceive = userHasPermission(user, "work_permits", "receive");
  const isStaff = !user?.organizationId;
  /** Ruta portal o usuario contratista: crumbs y topbar de «Mi empresa». */
  const isPortal =
    Boolean(user?.organizationId) ||
    location.pathname.startsWith("/portal/permisos");
  const listPath = isPortal ? "/portal/permisos" : "/prevencion/permisos";

  const [tab, setTab] = useState<TabId>("datos");
  const [permit, setPermit] = useState<WorkPermit | null>(null);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<WorkPermitPerson[]>([]);
  const [personRequirementLabels, setPersonRequirementLabels] = useState<
    string[]
  >([]);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [personDocs, setPersonDocs] = useState<
    AccreditationPersonDocumentChecklistItem[]
  >([]);
  const [personDocsLoading, setPersonDocsLoading] = useState(false);
  const [checklist, setChecklist] = useState<WorkPermitChecklistItem[]>([]);
  /** Ficha imprimible + firmas (P6c); no se llama `document` para no sombrear el DOM. */
  const [permitDoc, setPermitDoc] = useState<WorkPermitDocument | null>(null);
  const [history, setHistory] = useState<WorkPermitHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [tabLoading, setTabLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [noteModal, setNoteModal] = useState<"return" | "reject-receipt" | null>(
    null,
  );
  const [reviewNote, setReviewNote] = useState("");
  /** Modal pad + aceptación (Prevención / capitán). */
  const [signKind, setSignKind] = useState<WorkPermitSignKind | null>(null);

  const loadPermit = useCallback(async () => {
    if (!accessToken || !id || !canRead) return;
    setLoading(true);
    try {
      const row = await getWorkPermitRequest(accessToken, id);
      setPermit(row);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar el permiso",
        "danger",
      );
      setPermit(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, canRead, showToast]);

  useEffect(() => {
    void loadPermit();
  }, [loadPermit]);

  /** Abre/cierra docs de una persona asignada (pack + faena de la HAB). */
  async function togglePersonDocs(person: WorkPermitPerson) {
    if (!accessToken || !person.accreditationId) return;
    if (expandedPersonId === person.personId) {
      setExpandedPersonId(null);
      setPersonDocs([]);
      return;
    }
    setExpandedPersonId(person.personId);
    setPersonDocsLoading(true);
    try {
      const res = await listAccreditationPersonDocumentsRequest(
        accessToken,
        person.accreditationId,
        person.personId,
      );
      setPersonDocs(res.items);
    } catch (err) {
      setExpandedPersonId(null);
      setPersonDocs([]);
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los documentos",
        "danger",
      );
    } finally {
      setPersonDocsLoading(false);
    }
  }

  /** Carga datos del tab activo. */
  useEffect(() => {
    if (!accessToken || !id || !permit) return;
    let cancelled = false;

    async function loadTab() {
      setTabLoading(true);
      try {
        if (tab === "personal") {
          const res = await listWorkPermitPeopleRequest(accessToken!, id!);
          if (!cancelled) {
            setPeople(res.items);
            setPersonRequirementLabels(res.personRequirementLabels);
            setExpandedPersonId(null);
            setPersonDocs([]);
          }
        } else if (tab === "checklist") {
          const res = await getWorkPermitChecklistRequest(
            accessToken!,
            id!,
            "contractor",
          );
          if (!cancelled) setChecklist(res.items);
        } else if (tab === "documento") {
          const res = await getWorkPermitDocumentRequest(accessToken!, id!);
          if (!cancelled) setPermitDoc(res);
        } else if (tab === "historial") {
          const res = await listWorkPermitHistoryRequest(
            accessToken!,
            id!,
            1,
            50,
          );
          if (!cancelled) {
            setHistory(res.items);
            setHistoryTotal(res.total);
          }
        }
      } catch (err) {
        if (!cancelled) {
          showToast(
            err instanceof ApiError ? err.message : "No se pudo cargar la pestaña",
            "danger",
          );
        }
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    }

    if (tab !== "datos") void loadTab();
    return () => {
      cancelled = true;
    };
  }, [tab, accessToken, id, permit, showToast]);

  /**
   * Aplica un PT actualizado tras una transición que puede crear firma:
   * invalida el documento cacheado para que el tab Documento refetch.
   */
  function applyPermitAfterTransition(updated: WorkPermit) {
    setPermitDoc(null);
    // Evita flash de «no se pudo cargar» mientras el effect refetch.
    if (tab === "documento") setTabLoading(true);
    setPermit(updated);
  }

  /** Staff o flujo interno: pedir verificación de cierre (sin pad). */
  async function onRequestClose() {
    if (!accessToken || !permit || acting) return;
    setActing(true);
    try {
      const updated = await requestCloseWorkPermitRequest(
        accessToken,
        permit.id,
      );
      applyPermitAfterTransition(updated);
      showToast(
        `${updated.code} · ${workPermitStatusLabel("to_verify")}.`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo pedir el cierre.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Confirma pad + aceptación y ejecuta la transición. */
  async function confirmSign(
    payload: WorkPermitDigitalSignaturePayload & { reviewNote?: string },
  ) {
    if (!accessToken || !permit || !signKind || acting) return;
    setActing(true);
    try {
      let updated: WorkPermit;
      if (signKind === "approve") {
        updated = await approveWorkPermitRequest(
          accessToken,
          permit.id,
          payload,
        );
        showToast(
          `${updated.code} · ${workPermitStatusLabel("to_receive")}.`,
          "success",
        );
      } else if (signKind === "receive") {
        updated = await receiveWorkPermitRequest(
          accessToken,
          permit.id,
          payload,
        );
        showToast(
          `${updated.code} · ${workPermitStatusLabel("active")}.`,
          "success",
        );
      } else if (signKind === "close") {
        updated = await closeWorkPermitRequest(accessToken, permit.id, payload);
        showToast(
          `${updated.code} · ${workPermitStatusLabel("closed")}.`,
          "success",
        );
      } else {
        updated = await rejectCloseWorkPermitRequest(
          accessToken,
          permit.id,
          payload.reviewNote ?? "",
          payload,
        );
        showToast(
          `${updated.code} · ${workPermitStatusLabel("no_closure")}.`,
          "success",
        );
      }
      applyPermitAfterTransition(updated);
      setSignKind(null);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo firmar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  async function confirmNote() {
    if (!accessToken || !permit || !noteModal || !reviewNote.trim() || acting) {
      return;
    }
    setActing(true);
    try {
      const updated =
        noteModal === "return"
          ? await returnWorkPermitRequest(
              accessToken,
              permit.id,
              reviewNote.trim(),
            )
          : await rejectReceiptWorkPermitRequest(
              accessToken,
              permit.id,
              reviewNote.trim(),
            );
      applyPermitAfterTransition(updated);
      showToast(
        noteModal === "return"
          ? `${updated.code} · ${workPermitStatusLabel("to_complete")}.`
          : `${updated.code} · vuelve a ${workPermitStatusLabel("to_approve")}.`,
        "success",
      );
      setNoteModal(null);
      setReviewNote("");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  const signedCount = permitDoc?.signatures.length ?? 0;
  const tabs: { id: TabId; label: string }[] = [
    { id: "datos", label: "Datos" },
    { id: "personal", label: "Personal" },
    { id: "checklist", label: "Checklist" },
    {
      id: "documento",
      label:
        permitDoc && signedCount > 0
          ? `Documento · ${signedCount} firma${signedCount === 1 ? "" : "s"}`
          : "Documento",
    },
    { id: "historial", label: "Historial" },
  ];

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb={isPortal ? "Mi empresa" : "Prevención"}
          breadcrumbIcon={ClipboardCheck}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            No tenés permiso work_permits.read.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col print:overflow-visible">
      <div className="print:hidden">
        <Topbar
          breadcrumb={isPortal ? "Mi empresa" : "Prevención"}
          breadcrumbIcon={ClipboardCheck}
          actions={<UserMenu />}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 print:overflow-visible print:p-0">
        <div className="print:hidden">
          <PageHeader
            crumbs={
              isPortal
                ? [
                    { label: "Permisos de trabajo", to: listPath },
                    { label: permit?.code ?? "…" },
                  ]
                : [
                    { label: "Prevención", to: "/prevencion" },
                    { label: "Permisos de trabajo", to: listPath },
                    { label: permit?.code ?? "…" },
                  ]
            }
            title={
              permit
                ? `${permit.code} · ${permit.permitType.name}`
                : loading
                  ? "Cargando…"
                  : "Permiso"
            }
            description={
              permit
                ? `${displayName(permit.organization.name)} · ${displayName(permit.location.name)}`
                : undefined
            }
            actions={
              permit ? (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={statusTone(permit.status)}>
                    {workPermitStatusLabel(permit.status)}
                  </StatusChip>
                  {permitDoc && signedCount > 0 ? (
                    <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                      {signedCount} firma{signedCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {canUpdate && permit.status === "to_complete" ? (
                    <Button
                      type="button"
                      size="medium"
                      className="!w-auto"
                      onClick={() => setCompleteOpen(true)}
                    >
                      Completar
                    </Button>
                  ) : null}
                  {canUpdate && isStaff && permit.status === "to_approve" ? (
                    <>
                      <Button
                        type="button"
                        size="medium"
                        className="!w-auto"
                        disabled={acting}
                        onClick={() => setSignKind("approve")}
                      >
                        Aprobar
                      </Button>
                      <button
                        type="button"
                        className={outlineBtnClass}
                        disabled={acting}
                        onClick={() => {
                          setReviewNote("");
                          setNoteModal("return");
                        }}
                      >
                        Devolver
                      </button>
                    </>
                  ) : null}
                  {canReceive && isStaff && permit.status === "to_receive" ? (
                    <>
                      <Button
                        type="button"
                        size="medium"
                        className="!w-auto"
                        disabled={acting}
                        onClick={() => setSignKind("receive")}
                      >
                        Autorizar a bordo
                      </Button>
                      <button
                        type="button"
                        className={outlineBtnClass}
                        disabled={acting}
                        onClick={() => {
                          setReviewNote("");
                          setNoteModal("reject-receipt");
                        }}
                      >
                        No autorizar
                      </button>
                    </>
                  ) : null}
                  {canUpdate && permit.status === "active" ? (
                    <Button
                      type="button"
                      size="medium"
                      className="!w-auto"
                      disabled={acting}
                      onClick={() => void onRequestClose()}
                    >
                      Pedir cierre
                    </Button>
                  ) : null}
                  {canReceive && isStaff && permit.status === "to_verify" ? (
                    <>
                      <Button
                        type="button"
                        size="medium"
                        className="!w-auto"
                        disabled={acting}
                        onClick={() => setSignKind("close")}
                      >
                        Cerrar trabajo
                      </Button>
                      <button
                        type="button"
                        className={outlineBtnClass}
                        disabled={acting}
                        onClick={() => setSignKind("reject-close")}
                      >
                        Sin cierre
                      </button>
                    </>
                  ) : null}
                </div>
              ) : undefined
            }
          />
        </div>

        <div className="flex gap-1 border-b border-[var(--color-tremor-border)] print:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "border-b-2 border-[var(--color-nachipa-primary)] px-3 py-2 text-[13px] font-semibold text-[var(--color-nachipa-title)]"
                  : "px-3 py-2 text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {!permit && loading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando…
          </p>
        ) : !permit ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Permiso no encontrado.{" "}
            <Link
              to={listPath}
              className="text-[var(--color-nachipa-primary)] hover:underline"
            >
              Volver al listado
            </Link>
          </p>
        ) : tab === "datos" ? (
          <div className="grid max-w-3xl gap-3 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-4 text-[13px]">
            <Row label="Código" value={permit.code} />
            <Row label="Aviso" value={permit.workNotice.code} />
            <Row
              label="Empresa"
              value={`${displayName(permit.organization.name)} · ${permit.organization.rut}`}
            />
            <Row
              label="Tipo"
              value={`${permit.permitType.code} · ${permit.permitType.name}`}
            />
            <Row label="Nave" value={displayName(permit.location.name)} />
            <Row label="Fecha" value={formatDate(permit.scheduledDate)} />
            <Row
              label="Estado"
              value={workPermitStatusLabel(permit.status)}
            />
            <Row
              label="Descripción"
              value={permit.description?.trim() || "—"}
            />
            {permit.reviewNote ? (
              <Row label="Última observación" value={permit.reviewNote} />
            ) : null}
            <Row
              label="Actualizado"
              value={formatDateTime(permit.updatedAt)}
            />
          </div>
        ) : tab === "personal" ? (
          tabLoading ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando…
            </p>
          ) : people.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Todavía no hay personal asignado.
            </p>
          ) : (
            <div className="flex max-w-4xl flex-col gap-2">
              <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                Revisá pack
                {personRequirementLabels.length > 0
                  ? ` y exigencias de faena (${personRequirementLabels.join(", ")})`
                  : ""}
                . Expandí una fila para ver y abrir los archivos.
              </p>
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] text-[var(--color-nachipa-secondary)]">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">RUN</th>
                    <th className="px-3 py-2">Cargo</th>
                    <th className="px-3 py-2">Documentación</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const open = expandedPersonId === p.personId;
                    const Chevron = open ? ChevronDown : ChevronRight;
                    return (
                      <Fragment key={p.personId}>
                        <tr className="border-t border-[var(--color-tremor-border)]">
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className="inline-flex size-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-40"
                              disabled={!p.accreditationId}
                              aria-expanded={open}
                              aria-label={
                                open ? "Ocultar documentos" : "Ver documentos"
                              }
                              onClick={() =>
                                void togglePersonDocs(p)
                              }
                            >
                              <Chevron size={16} strokeWidth={1.5} aria-hidden />
                            </button>
                          </td>
                          <td className="px-3 py-2 font-medium text-[var(--color-nachipa-title)]">
                            {p.fullName}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{p.rut}</td>
                          <td className="px-3 py-2">{p.position ?? "—"}</td>
                          <td className="px-3 py-2">
                            <StatusChip
                              tone={p.docsOk ? "success" : "warning"}
                            >
                              {p.docsOk ? "OK" : "Revisar"}
                            </StatusChip>
                            <span className="mt-1 block text-[11px] text-[var(--color-nachipa-secondary)]">
                              {personDocsHint(p)}
                            </span>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="border-t border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page)]">
                            <td colSpan={5} className="px-4 py-3">
                              {personDocsLoading ? (
                                <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                                  Cargando documentos…
                                </p>
                              ) : personDocs.length === 0 ? (
                                <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                                  Sin tipos de documento para esta persona.
                                </p>
                              ) : (
                                <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                                  {personDocs.map((item) => {
                                    const doc = item.document;
                                    const sourceHint =
                                      item.source === "permit_requirement"
                                        ? "Exigencia de faena"
                                        : item.source === "both"
                                          ? "Pack + faena"
                                          : "Pack";
                                    return (
                                      <li
                                        key={item.documentType.id}
                                        className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                                              {item.documentType.name}
                                            </span>
                                            <span className="ml-1.5 text-[11px] text-[var(--color-nachipa-secondary)]">
                                              {item.documentType.code}
                                            </span>
                                            <span className="ml-1.5 text-[11px] text-[var(--color-nachipa-primary)]">
                                              · {sourceHint}
                                            </span>
                                            <div className="text-[11px] text-[var(--color-nachipa-body)]">
                                              {doc
                                                ? doc.originalName
                                                : "Sin archivo"}
                                            </div>
                                          </div>
                                          {doc ? (
                                            <StatusChip
                                              tone={personDocStatusTone(
                                                doc.status,
                                              )}
                                            >
                                              {personDocStatusLabel(doc.status)}
                                            </StatusChip>
                                          ) : null}
                                        </div>
                                        {doc &&
                                        accessToken &&
                                        p.accreditationId ? (
                                          <div className="flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              className="text-[11px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                                              onClick={() =>
                                                void previewAccreditationPersonDocumentRequest(
                                                  accessToken,
                                                  p.accreditationId!,
                                                  p.personId,
                                                  doc.id,
                                                ).catch((err) =>
                                                  showToast(
                                                    err instanceof ApiError
                                                      ? err.message
                                                      : "No se pudo abrir.",
                                                    "danger",
                                                  ),
                                                )
                                              }
                                            >
                                              Ver
                                            </button>
                                            <button
                                              type="button"
                                              className="text-[11px] font-medium text-[var(--color-nachipa-secondary)] hover:underline"
                                              onClick={() =>
                                                void downloadAccreditationPersonDocumentRequest(
                                                  accessToken,
                                                  p.accreditationId!,
                                                  p.personId,
                                                  doc.id,
                                                  doc.originalName,
                                                ).catch((err) =>
                                                  showToast(
                                                    err instanceof ApiError
                                                      ? err.message
                                                      : "No se pudo descargar.",
                                                    "danger",
                                                  ),
                                                )
                                              }
                                            >
                                              Descargar
                                            </button>
                                          </div>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "checklist" ? (
          tabLoading ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando…
            </p>
          ) : checklist.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Este tipo no tiene ítems de checklist activos.
            </p>
          ) : (
            <ul className="m-0 flex max-w-3xl list-none flex-col gap-2 p-0">
              {checklist.map((item) => (
                <li
                  key={item.checklistItemId}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2 text-[13px]"
                >
                  <span>
                    {item.order}. {item.text}
                  </span>
                  <StatusChip
                    tone={item.answer ? "success" : "warning"}
                  >
                    {answerLabel(item.answer)}
                  </StatusChip>
                </li>
              ))}
            </ul>
          )
        ) : tab === "documento" ? (
          tabLoading ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Cargando…
            </p>
          ) : !permitDoc ? (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              No se pudo cargar el documento.
            </p>
          ) : (
            <div className="flex max-w-3xl flex-col gap-4 print:max-w-none">
              <div className="flex print:hidden">
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  onClick={() => window.print()}
                >
                  Imprimir
                </Button>
              </div>
              <div
                id="work-permit-print"
                className="rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-6 text-[13px] text-black print:rounded-none print:border-0 print:p-0"
              >
                {/* Cabecera formal: logo mandante + título del documento. */}
                <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-tremor-border)] pb-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Logo size="sidebar" />
                    <div className="min-w-0">
                      <p className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                        {displayName(permitDoc.issuer.name)}
                      </p>
                      {permitDoc.issuer.rut ? (
                        <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                          RUT {permitDoc.issuer.rut}
                        </p>
                      ) : null}
                      {permitDoc.issuer.giro ? (
                        <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                          {permitDoc.issuer.giro}
                        </p>
                      ) : null}
                      {issuerPlaceLine(permitDoc.issuer) ? (
                        <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                          {issuerPlaceLine(permitDoc.issuer)}
                        </p>
                      ) : null}
                      {issuerContactLine(permitDoc.issuer) ? (
                        <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                          {issuerContactLine(permitDoc.issuer)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="m-0 text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--color-nachipa-secondary)]">
                      Permiso de trabajo
                    </p>
                    <p className="m-0 mt-1 text-[20px] font-semibold text-[var(--color-nachipa-title)]">
                      {permitDoc.permit.code}
                    </p>
                    <p className="m-0 mt-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                      {permitDoc.permit.permitType.code} ·{" "}
                      {permitDoc.permit.permitType.name}
                    </p>
                    <p className="m-0 mt-1 text-[12px] font-medium text-[var(--color-nachipa-title)]">
                      {workPermitStatusLabel(permitDoc.permit.status)}
                    </p>
                  </div>
                </header>

                <section className="mt-4">
                  <h3 className="mt-0 mb-2 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                    Datos del permiso
                  </h3>
                  <div className="grid gap-2">
                    <Row
                      label="Contratista"
                      value={`${displayName(permitDoc.permit.organization.name)} · ${permitDoc.permit.organization.rut}`}
                    />
                    <Row
                      label="Nave"
                      value={displayName(permitDoc.permit.location.name)}
                    />
                    <Row
                      label="Fecha"
                      value={formatDate(permitDoc.permit.scheduledDate)}
                    />
                    <Row
                      label="Aviso"
                      value={permitDoc.permit.workNotice.code}
                    />
                    <Row
                      label="Descripción"
                      value={permitDoc.permit.description?.trim() || "—"}
                    />
                  </div>
                </section>

                <section className="mt-5">
                  <h3 className="mt-0 mb-2 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                    Personal
                  </h3>
                  {permitDoc.people.length === 0 ? (
                    <p className="m-0 text-[var(--color-nachipa-secondary)]">
                      Sin personal asignado.
                    </p>
                  ) : (
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-[var(--color-tremor-border)] text-[12px] text-[var(--color-nachipa-secondary)]">
                          <th className="py-1.5 pr-3 font-medium">Nombre</th>
                          <th className="py-1.5 pr-3 font-medium">RUN</th>
                          <th className="py-1.5 font-medium">Cargo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permitDoc.people.map((p) => (
                          <tr
                            key={p.rut}
                            className="border-b border-[var(--color-tremor-border)]"
                          >
                            <td className="py-1.5 pr-3 text-[var(--color-nachipa-title)]">
                              {displayName(p.fullName)}
                            </td>
                            <td className="py-1.5 pr-3 tabular-nums text-[var(--color-nachipa-body)]">
                              {p.rut}
                            </td>
                            <td className="py-1.5 text-[var(--color-nachipa-body)]">
                              {p.position?.trim()
                                ? displayName(p.position)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                <section className="mt-5">
                  <h3 className="mt-0 mb-2 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                    Checklist
                  </h3>
                  {permitDoc.checklist.length === 0 ? (
                    <p className="m-0 text-[var(--color-nachipa-secondary)]">
                      Sin respuestas de checklist.
                    </p>
                  ) : (
                    <ul className="m-0 list-none space-y-1 p-0">
                      {permitDoc.checklist.map((c) => (
                        <li key={`${c.order}-${c.text}`}>
                          {c.order}. {c.text} — {answerLabel(c.answer)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="mt-5">
                  <h3 className="mt-0 mb-2 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                    Firmas
                    {permitDoc.signatures.length > 0
                      ? ` · ${permitDoc.signatures.length} registradas`
                      : ""}
                  </h3>
                  {(() => {
                    const lag = signaturesLagBehindStatus(
                      permitDoc.permit.status,
                      permitDoc.signatures,
                    );
                    const expectedPast = new Set(
                      expectedSignatureKindsForStatus(permitDoc.permit.status),
                    );
                    return (
                      <>
                        <p className="m-0 mb-2 text-[12px] text-[var(--color-nachipa-secondary)] print:hidden">
                          Prevención y capitán firman con pad + confirmación al
                          aprobar, autorizar a bordo o cerrar. Pedir cierre solo
                          registra el acto.
                        </p>
                        {lag ? (
                          <p className="m-0 mb-3 rounded-[var(--radius-md)] border border-[var(--color-status-warning-border,#fed7aa)] bg-[var(--color-status-warning-bg,#ffedd5)] px-3 py-2 text-[12px] text-[var(--color-nachipa-title)] print:hidden">
                            Este permiso avanzó sin firmas manuscritas. Sin
                            Aprobación Prevención y Autorización a bordo
                            firmadas no se puede pedir cierre ni cerrar el
                            trabajo. Hay que rehacer el ciclo desde «En
                            revisión» (o pedir backfill).
                          </p>
                        ) : null}
                        <ul className="m-0 list-none space-y-3 p-0">
                          {buildSignatureRows(permitDoc.signatures).map(
                            (row) => (
                              <li
                                key={row.kind}
                                className="border-t border-[var(--color-tremor-border)] pt-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-[var(--color-nachipa-title)]">
                                    {row.label}
                                  </span>
                                  <span className="print:hidden">
                                    <StatusChip
                                      tone={row.signed ? "success" : "neutral"}
                                    >
                                      {row.signed ? "Firmada" : "Pendiente"}
                                    </StatusChip>
                                  </span>
                                  <span className="hidden text-[12px] text-[var(--color-nachipa-secondary)] print:inline">
                                    {row.signed ? "Firmada" : "Pendiente"}
                                  </span>
                                </div>
                                {row.signed ? (
                                  <>
                                    <span className="mt-0.5 block text-[var(--color-nachipa-body)]">
                                      {displayName(row.signed.signerName)} ·{" "}
                                      {formatDateTime(row.signed.signedAt)}
                                    </span>
                                    {row.signed.note ? (
                                      <span className="mt-0.5 block text-[12px] text-[var(--color-nachipa-secondary)]">
                                        {row.signed.note}
                                      </span>
                                    ) : null}
                                    {row.signed.signatureImage ? (
                                      <img
                                        src={row.signed.signatureImage}
                                        alt={`Firma de ${row.signed.signerName}`}
                                        className="mt-2 h-16 max-w-[240px] border border-[var(--color-tremor-border)] bg-white object-contain"
                                      />
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="mt-0.5 block text-[12px] text-[var(--color-nachipa-secondary)]">
                                    {lag && expectedPast.has(row.kind)
                                      ? "Hito ya pasado · sin registro de firma (previo a firmas)."
                                      : "Aún no registrada en este permiso."}
                                  </span>
                                )}
                              </li>
                            ),
                          )}
                        </ul>
                      </>
                    );
                  })()}
                </section>
              </div>
            </div>
          )
        ) : tabLoading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando…
          </p>
        ) : history.length === 0 ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Sin eventos todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
              {historyTotal}{" "}
              {historyTotal === 1 ? "evento" : "eventos"}
            </p>
            <table className="w-full max-w-4xl border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] text-[var(--color-nachipa-secondary)]">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-t border-[var(--color-tremor-border)]"
                  >
                    <td className="px-3 py-2 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDateTime(ev.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-[var(--color-nachipa-title)]">
                        {ev.event}
                      </span>
                      {ev.detail ? (
                        <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                          {ev.detail}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-nachipa-body)]">
                      {ev.user ?? "—"}
                      {ev.role ? (
                        <span className="block text-[12px] text-[var(--color-nachipa-secondary)]">
                          {ev.role}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip tone={ev.resultTone}>{ev.result}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {accessToken && permit ? (
        <WorkPermitCompleteModal
          open={completeOpen}
          permit={permit}
          accessToken={accessToken}
          mode={user?.organizationId ? "portal" : "staff"}
          onClose={() => setCompleteOpen(false)}
          onDone={() => {
            void loadPermit();
            setTab("datos");
          }}
        />
      ) : null}

      <WorkPermitSignModal
        open={Boolean(signKind)}
        kind={signKind}
        permitCode={permit?.code}
        defaultSignerName={
          user
            ? `${user.firstName} ${user.lastName}`.trim() || user.email
            : ""
        }
        submitting={acting && Boolean(signKind)}
        onClose={() => {
          if (!acting) setSignKind(null);
        }}
        onConfirm={(payload) => void confirmSign(payload)}
      />

      <Modal
        open={Boolean(noteModal)}
        onClose={() => {
          if (!acting) setNoteModal(null);
        }}
        title={
          noteModal === "reject-receipt"
            ? "No autorizar recepción"
            : "Devolver permiso al contratista"
        }
        subtitle={permit ? permit.code : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => setNoteModal(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={acting || !reviewNote.trim()}
              onClick={() => void confirmNote()}
            >
              {acting
                ? "Guardando…"
                : noteModal === "reject-receipt"
                  ? "No autorizar"
                  : "Devolver"}
            </Button>
          </div>
        }
      >
        <p className="m-0 mb-3 text-[13px] text-[var(--color-nachipa-secondary)]">
          {noteModal === "reject-receipt"
            ? "El permiso vuelve a «En revisión» con tu motivo."
            : "El permiso vuelve a «Por completar» con tu observación."}
        </p>
        <TextField
          label={
            noteModal === "reject-receipt" ? "Motivo" : "Observaciones"
          }
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          required
        />
      </Modal>
    </div>
  );
}

/** Fila dato etiqueta / valor. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[160px_1fr] sm:gap-3">
      <span className="text-[var(--color-nachipa-secondary)]">{label}</span>
      <span className="text-[var(--color-nachipa-title)]">{value}</span>
    </div>
  );
}

/** Comuna y ciudad de la mandante para la cabecera del documento. */
function issuerPlaceLine(issuer: WorkPermitDocumentIssuer): string | null {
  const parts = [issuer.commune?.trim(), issuer.city?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Teléfono y correo de la mandante para la cabecera del documento. */
function issuerContactLine(issuer: WorkPermitDocumentIssuer): string | null {
  const parts = [issuer.phone?.trim(), issuer.email?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
