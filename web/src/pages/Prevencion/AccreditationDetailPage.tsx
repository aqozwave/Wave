import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  approveAccreditationRequest,
  createAccreditationDocumentRequest,
  downloadAccreditationDocumentRequest,
  fileToBase64,
  getAccreditationRequest,
  listAccreditationDocumentsRequest,
  rejectAccreditationRequest,
  returnAccreditationRequest,
  submitAccreditationRequest,
  validateAccreditationDocumentRequest,
  type AccreditationDocumentChecklistItem,
  type AccreditationStatus,
  type ContractorAccreditation,
  type ContractorDocumentStatus,
} from "../../lib/api/accreditations";
import {
  getContractorRequest,
  listContractorPeopleRequest,
  type ContractorOrganization,
  type ContractorPerson,
} from "../../lib/api/contractors";
import { userHasPermission } from "../../lib/api/auth";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Capitaliza nombre en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Etiqueta de estado HAB. */
function statusLabel(status: AccreditationStatus): string {
  switch (status) {
    case "invited":
      return "Invitada";
    case "pending":
      return "Pendiente";
    case "in_review":
      return "En revisión";
    case "observed":
      return "Observada";
    case "approved":
      return "Aprobada";
    case "rejected":
      return "Rechazada";
    default:
      return status;
  }
}

/** Tono chip HAB. */
function statusTone(
  status: AccreditationStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "approved":
      return "success";
    case "in_review":
      return "info";
    case "observed":
    case "pending":
    case "invited":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

/** Fecha corta es-CL. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL");
  } catch {
    return "—";
  }
}

/** Etiqueta estado doc HAB. */
function docStatusLabel(status: ContractorDocumentStatus): string {
  switch (status) {
    case "pending_validation":
      return "Pendiente";
    case "validated":
      return "Validado";
    case "observed":
      return "Observado";
    case "replaced":
      return "Reemplazado";
    default:
      return status;
  }
}

/** Tono chip doc. */
function docStatusTone(
  status: ContractorDocumentStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "validated":
      return "success";
    case "pending_validation":
      return "info";
    case "observed":
      return "warning";
    default:
      return "neutral";
  }
}

/** Tabs de revisión P5. */
type TabId = "documentos" | "antecedentes" | "personal" | "historial";

/** Fila de dato en antecedentes. */
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--color-tremor-border)] py-2.5 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-[13px] text-[var(--color-nachipa-body)]">
        {value || "—"}
      </dd>
    </div>
  );
}

const outlineBtnClass =
  "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/**
 * Revisión de habilitación (P2 · P5 shell).
 * Tabs: Documentos (stub) · Antecedentes · Personal · Historial (stub).
 * Acciones: submit / approve / return / reject (API ya existente).
 */
export function AccreditationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canRead = userHasPermission(user, "accreditations", "read");
  const canUpdate = userHasPermission(user, "accreditations", "update");

  const [hab, setHab] = useState<ContractorAccreditation | null>(null);
  const [org, setOrg] = useState<ContractorOrganization | null>(null);
  const [people, setPeople] = useState<ContractorPerson[]>([]);
  const [docItems, setDocItems] = useState<AccreditationDocumentChecklistItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("documentos");
  const [acting, setActing] = useState(false);
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);

  const [noteAction, setNoteAction] = useState<"return" | "reject" | null>(
    null,
  );
  const [reviewNote, setReviewNote] = useState("");
  const [observeDocId, setObserveDocId] = useState<string | null>(null);
  const [observeNote, setObserveNote] = useState("");
  /** Upload pendiente de vencimiento (tipos requiresExpiry). */
  const [pendingUpload, setPendingUpload] = useState<{
    documentTypeId: string;
    file: File;
  } | null>(null);
  const [expiryDate, setExpiryDate] = useState("");

  const load = useCallback(async () => {
    if (!accessToken || !id || !canRead) return;
    setLoading(true);
    try {
      const row = await getAccreditationRequest(accessToken, id);
      setHab(row);
      try {
        const orgRow = await getContractorRequest(
          accessToken,
          row.organizationId,
        );
        setOrg(orgRow);
      } catch {
        setOrg(null);
      }
      try {
        const peopleList = await listContractorPeopleRequest(
          accessToken,
          row.organizationId,
          1,
          100,
        );
        setPeople(peopleList.items);
      } catch {
        setPeople([]);
      }
      try {
        const docs = await listAccreditationDocumentsRequest(accessToken, id);
        setDocItems(docs.items);
      } catch {
        setDocItems([]);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar la HAB",
        "danger",
      );
      setHab(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, canRead, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Submit o approve sin nota. */
  async function runSimple(kind: "submit" | "approve") {
    if (!accessToken || !hab || acting) return;
    setActing(true);
    try {
      if (kind === "submit") {
        await submitAccreditationRequest(accessToken, hab.id);
        showToast("Enviada a revisión.", "success");
      } else {
        await approveAccreditationRequest(accessToken, hab.id);
        showToast("Habilitación aprobada.", "success");
      }
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo completar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Sube archivo (con expiresAt ya resuelto). */
  async function uploadFile(
    documentTypeId: string,
    file: File,
    expiresAt: string | null,
  ) {
    if (!accessToken || !hab || acting) return;
    setUploadingTypeId(documentTypeId);
    setActing(true);
    try {
      const contentBase64 = await fileToBase64(file);
      await createAccreditationDocumentRequest(accessToken, hab.id, {
        documentTypeId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        contentBase64,
        expiresAt,
      });
      showToast("Documento subido.", "success");
      setPendingUpload(null);
      setExpiryDate("");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo subir.",
        "danger",
      );
    } finally {
      setActing(false);
      setUploadingTypeId(null);
    }
  }

  /** Elige archivo: si requiere vencimiento abre modal; si no, sube directo. */
  function onPickFile(
    documentTypeId: string,
    file: File | null,
    requiresExpiry: boolean,
  ) {
    if (!file) return;
    if (requiresExpiry) {
      setPendingUpload({ documentTypeId, file });
      setExpiryDate(
        new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
      );
      return;
    }
    void uploadFile(documentTypeId, file, null);
  }

  /** Marca doc como validado. */
  async function onValidateDoc(documentId: string) {
    if (!accessToken || !hab || acting) return;
    setActing(true);
    try {
      await validateAccreditationDocumentRequest(
        accessToken,
        hab.id,
        documentId,
        { status: "validated" },
      );
      showToast("Documento validado.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo validar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Confirma observación de doc. */
  async function confirmObserveDoc() {
    if (!accessToken || !hab || !observeDocId || !observeNote.trim() || acting) {
      return;
    }
    setActing(true);
    try {
      await validateAccreditationDocumentRequest(
        accessToken,
        hab.id,
        observeDocId,
        { status: "observed", observation: observeNote.trim() },
      );
      showToast("Documento observado.", "success");
      setObserveDocId(null);
      setObserveNote("");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo observar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Confirma devolver / rechazar. */
  async function confirmNoteAction() {
    if (!accessToken || !hab || !noteAction || !reviewNote.trim() || acting) {
      return;
    }
    setActing(true);
    try {
      if (noteAction === "return") {
        await returnAccreditationRequest(
          accessToken,
          hab.id,
          reviewNote.trim(),
        );
        showToast("Devuelta con observaciones.", "success");
      } else {
        await rejectAccreditationRequest(
          accessToken,
          hab.id,
          reviewNote.trim(),
        );
        showToast("Habilitación rechazada.", "success");
      }
      setNoteAction(null);
      setReviewNote("");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo completar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={ClipboardCheck}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            No tenés permiso accreditations.read.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={ClipboardCheck}
          actions={<UserMenu />}
        />
        <p className="px-6 py-5 text-[13px] text-[var(--color-nachipa-secondary)]">
          Cargando…
        </p>
      </div>
    );
  }

  if (!hab) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Prevención"
          breadcrumbIcon={ClipboardCheck}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Habilitación no encontrada.
          </p>
          <button
            type="button"
            className={`${outlineBtnClass} mt-3`}
            onClick={() => void navigate("/prevencion/habilitaciones")}
          >
            Volver a la bandeja
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "documentos", label: "Documentos" },
    { id: "antecedentes", label: "Antecedentes" },
    { id: "personal", label: "Personal" },
    { id: "historial", label: "Historial" },
  ];

  const canSubmit =
    canUpdate && (hab.status === "pending" || hab.status === "observed");
  const canApprove = canUpdate && hab.status === "in_review";
  const canReturnOrReject = canUpdate && hab.status === "in_review";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={ClipboardCheck}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Habilitaciones", to: "/prevencion/habilitaciones" },
            { label: hab.code },
          ]}
          title={hab.code}
          description={`${displayName(hab.organization.name)} · ${hab.organization.rut}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canSubmit ? (
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  disabled={acting}
                  onClick={() => void runSimple("submit")}
                >
                  Enviar a revisión
                </Button>
              ) : null}
              {canApprove ? (
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  disabled={acting}
                  onClick={() => void runSimple("approve")}
                >
                  Habilitar
                </Button>
              ) : null}
              {canReturnOrReject ? (
                <>
                  <button
                    type="button"
                    className={outlineBtnClass}
                    disabled={acting}
                    onClick={() => {
                      setNoteAction("return");
                      setReviewNote("");
                    }}
                  >
                    Devolver
                  </button>
                  <button
                    type="button"
                    className={outlineBtnClass}
                    disabled={acting}
                    onClick={() => {
                      setNoteAction("reject");
                      setReviewNote("");
                    }}
                  >
                    Rechazar
                  </button>
                </>
              ) : null}
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={statusTone(hab.status)}>
            {statusLabel(hab.status)}
          </StatusChip>
          <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
            Solicitada {formatDate(hab.requestedAt)}
            {hab.dueAt ? ` · Plazo ${formatDate(hab.dueAt)}` : ""}
          </span>
          <Link
            to={`/prevencion/contratistas/${hab.organizationId}`}
            className="text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
          >
            Ver organización
          </Link>
        </div>

        {hab.message ? (
          <p className="m-0 max-w-2xl rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 py-3 text-[13px] text-[var(--color-nachipa-body)]">
            <span className="font-medium text-[var(--color-nachipa-title)]">
              Mensaje al solicitar:{" "}
            </span>
            {hab.message}
          </p>
        ) : null}

        {hab.reviewNote ? (
          <p className="m-0 max-w-2xl rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 py-3 text-[13px] text-[var(--color-nachipa-body)]">
            <span className="font-medium text-[var(--color-nachipa-title)]">
              Nota de revisión:{" "}
            </span>
            {hab.reviewNote}
          </p>
        ) : null}

        <div
          role="tablist"
          className="flex gap-1 border-b border-[var(--color-tremor-border)]"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={[
                "px-3 py-2 text-[13px] font-medium",
                tab === t.id
                  ? "border-b-2 border-[var(--color-nachipa-primary)] text-[var(--color-nachipa-title)]"
                  : "text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]",
              ].join(" ")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "documentos" ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Pack de empresa ({docItems.length} tipos). Disco local, mismo
              patrón que docs de tripulante.
            </p>
            {docItems.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                No hay tipos con pack «company» en esta empresa. Configuralos
                en Packs de habilitación.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-0">
                {docItems.map((item) => {
                  const doc = item.document;
                  return (
                    <li
                      key={item.documentType.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block font-medium text-[var(--color-nachipa-title)]">
                          {item.documentType.name}
                          <span className="ml-2 text-[12px] font-normal text-[var(--color-nachipa-secondary)]">
                            {item.documentType.code}
                          </span>
                        </span>
                        {doc ? (
                          <span className="text-[12px] text-[var(--color-nachipa-body)]">
                            {doc.originalName}
                            {doc.expiresAt
                              ? ` · vence ${formatDate(doc.expiresAt)}`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            Sin archivo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {doc ? (
                          <StatusChip tone={docStatusTone(doc.status)}>
                            {docStatusLabel(doc.status)}
                          </StatusChip>
                        ) : null}
                        {doc && accessToken ? (
                          <button
                            type="button"
                            className="text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                            onClick={() =>
                              void downloadAccreditationDocumentRequest(
                                accessToken,
                                hab.id,
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
                        ) : null}
                        {canUpdate &&
                        doc &&
                        (doc.status === "pending_validation" ||
                          doc.status === "observed") ? (
                          <>
                            <button
                              type="button"
                              className="text-[12px] font-medium text-[var(--color-status-success-fg,#15803d)] hover:underline"
                              disabled={acting}
                              onClick={() => void onValidateDoc(doc.id)}
                            >
                              Validar
                            </button>
                            <button
                              type="button"
                              className="text-[12px] font-medium text-[var(--color-status-warning-fg,#b45309)] hover:underline"
                              disabled={acting}
                              onClick={() => {
                                setObserveDocId(doc.id);
                                setObserveNote(doc.observation ?? "");
                              }}
                            >
                              Observar
                            </button>
                          </>
                        ) : null}
                        {canUpdate &&
                        hab.status !== "approved" &&
                        hab.status !== "rejected" ? (
                          <label className="cursor-pointer text-[12px] font-medium text-[var(--color-nachipa-title)] hover:underline">
                            {uploadingTypeId === item.documentType.id
                              ? "Subiendo…"
                              : doc
                                ? "Reemplazar"
                                : "Subir"}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                              disabled={acting}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                e.target.value = "";
                                onPickFile(
                                  item.documentType.id,
                                  f,
                                  item.documentType.requiresExpiry,
                                );
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "antecedentes" ? (
          org ? (
            <dl className="m-0 max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-4 py-1">
              <DataRow label="RUT" value={org.rut} />
              <DataRow label="Razón social" value={displayName(org.name)} />
              <DataRow
                label="Relación"
                value={
                  org.role === "permanent" ? "Permanente" : "Ocasional"
                }
              />
              <DataRow label="Especialidad" value={org.specialty ?? ""} />
              <DataRow label="Contacto" value={org.contactName ?? ""} />
              <DataRow label="Email" value={org.contactEmail ?? ""} />
              <DataRow label="Teléfono" value={org.contactPhone ?? ""} />
              <DataRow
                label="Rep. legal"
                value={org.legalRepresentative ?? ""}
              />
              <DataRow label="Dirección" value={org.address ?? ""} />
              <DataRow label="Mutual" value={org.mutual ?? ""} />
              <DataRow label="Supervisor" value={org.supervisorName ?? ""} />
              <DataRow
                label="Prevencionista"
                value={org.prevencionistName ?? ""}
              />
            </dl>
          ) : (
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              No se pudieron cargar los antecedentes (¿sin
              contractors.read?).
            </p>
          )
        ) : null}

        {tab === "personal" ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
              Personal declarado de la organización ({people.length}).
            </p>
            {people.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Sin personal cargado todavía.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-0">
                {people.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 font-medium text-[var(--color-nachipa-title)]">
                      {displayName(p.fullName)}
                    </span>
                    <span className="tabular-nums text-[12px] text-[var(--color-nachipa-secondary)]">
                      {p.rut}
                    </span>
                    <span className="text-[12px] text-[var(--color-nachipa-body)]">
                      {p.position ?? "—"}
                    </span>
                    <StatusChip tone={p.active ? "success" : "neutral"}>
                      {p.active ? "Activo" : "Inactivo"}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "historial" ? (
          <dl className="m-0 max-w-md rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-4 py-1">
            <DataRow label="Creada" value={formatDate(hab.createdAt)} />
            <DataRow label="Solicitada" value={formatDate(hab.requestedAt)} />
            <DataRow label="Enviada" value={formatDate(hab.submittedAt)} />
            <DataRow label="Revisada" value={formatDate(hab.reviewedAt)} />
            <DataRow label="Actualizada" value={formatDate(hab.updatedAt)} />
            <p className="m-0 border-t border-[var(--color-tremor-border)] py-2.5 text-[12px] text-[var(--color-nachipa-secondary)]">
              Eventos detallados de auditoría llegan después.
            </p>
          </dl>
        ) : null}
      </div>

      <Modal
        open={Boolean(pendingUpload)}
        onClose={() => {
          if (!acting) {
            setPendingUpload(null);
            setExpiryDate("");
          }
        }}
        icon={ClipboardCheck}
        title="Vencimiento del documento"
        subtitle={
          pendingUpload
            ? `Archivo: ${pendingUpload.file.name}`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                setPendingUpload(null);
                setExpiryDate("");
              }}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={acting || !expiryDate}
              onClick={() => {
                if (!pendingUpload || !expiryDate) return;
                void uploadFile(
                  pendingUpload.documentTypeId,
                  pendingUpload.file,
                  new Date(`${expiryDate}T12:00:00.000Z`).toISOString(),
                );
              }}
            >
              {acting ? "Subiendo…" : "Subir"}
            </Button>
          </div>
        }
      >
        <TextField
          label="Vence el"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          required
        />
      </Modal>

      <Modal
        open={Boolean(observeDocId)}
        onClose={() => {
          if (!acting) setObserveDocId(null);
        }}
        icon={ClipboardCheck}
        title="Observar documento"
        subtitle="La observación queda en el documento."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => setObserveDocId(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={acting || !observeNote.trim()}
              onClick={() => void confirmObserveDoc()}
            >
              {acting ? "Guardando…" : "Observar"}
            </Button>
          </div>
        }
      >
        <TextField
          label="Observación"
          value={observeNote}
          onChange={(e) => setObserveNote(e.target.value)}
          required
        />
      </Modal>

      <Modal
        open={Boolean(noteAction)}
        onClose={() => {
          if (!acting) setNoteAction(null);
        }}
        icon={ClipboardCheck}
        title={
          noteAction === "return"
            ? "Devolver con observaciones"
            : "Rechazar habilitación"
        }
        subtitle="La nota queda registrada en la HAB."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => setNoteAction(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={acting || !reviewNote.trim()}
              onClick={() => void confirmNoteAction()}
            >
              {acting
                ? "Guardando…"
                : noteAction === "return"
                  ? "Devolver"
                  : "Rechazar"}
            </Button>
          </div>
        }
      >
        <TextField
          label="Nota"
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          required
        />
      </Modal>
    </div>
  );
}
