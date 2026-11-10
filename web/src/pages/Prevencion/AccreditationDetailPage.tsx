import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ClipboardCheck,
  Download,
  Eye,
  MessageSquareWarning,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableOutlineButton,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import { TablePagination } from "../../components/TablePagination/TablePagination";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { downloadXls } from "../../lib/exportXls";
import {
  approveAccreditationRequest,
  createAccreditationDocumentRequest,
  createAccreditationPersonDocumentRequest,
  downloadAccreditationDocumentRequest,
  downloadAccreditationPersonDocumentRequest,
  fileToBase64,
  getAccreditationRequest,
  listAccreditationDocumentsRequest,
  listAccreditationHistoryRequest,
  listAccreditationPersonDocumentsRequest,
  previewAccreditationDocumentRequest,
  previewAccreditationPersonDocumentRequest,
  rejectAccreditationRequest,
  returnAccreditationRequest,
  submitAccreditationRequest,
  validateAccreditationDocumentRequest,
  validateAccreditationPersonDocumentRequest,
  type AccreditationDocumentChecklistItem,
  type AccreditationHistoryItem,
  type AccreditationPersonDocumentChecklistItem,
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

/** Fecha+hora corta es-CL para historial. */
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Clase de select compacto en toolbar. */
const toolbarSelectClass =
  "h-8 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[12px] text-[var(--color-nachipa-body)] outline-none";

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

/** Botón de acción solo ícono (mismo patrón que ficha tripulante). */
function DocIconButton({
  title,
  disabled,
  onClick,
  tone = "default",
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick?: () => void;
  tone?: "default" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--color-status-success-fg,#15803d)]"
      : tone === "warning"
        ? "text-[var(--color-status-warning-fg,#b45309)]"
        : tone === "danger"
          ? "text-[var(--color-status-danger-fg)]"
          : "text-[var(--color-nachipa-primary)]";
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60",
        toneClass,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

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
  /** Si viene, la observación es de pack person. */
  const [observePersonId, setObservePersonId] = useState<string | null>(null);
  const [observeNote, setObserveNote] = useState("");
  /** Upload pendiente de vencimiento (tipos requiresExpiry). */
  const [pendingUpload, setPendingUpload] = useState<{
    documentTypeId: string;
    file: File;
    /** Si viene, es pack person. */
    personId?: string;
  } | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [personDocItems, setPersonDocItems] = useState<
    AccreditationPersonDocumentChecklistItem[]
  >([]);
  const [personDocsLoading, setPersonDocsLoading] = useState(false);

  /** Historial P5h. */
  const [historyItems, setHistoryItems] = useState<AccreditationHistoryItem[]>(
    [],
  );
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historySearch, setHistorySearch] = useState("");
  const [historySuccess, setHistorySuccess] = useState<"" | "true" | "false">(
    "",
  );
  const [historyLoading, setHistoryLoading] = useState(false);

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

  /** Carga historial P5h de la HAB. */
  const loadHistory = useCallback(async () => {
    if (!accessToken || !id || !canRead) return;
    setHistoryLoading(true);
    try {
      const res = await listAccreditationHistoryRequest(
        accessToken,
        id,
        historyPage,
        historyLimit,
        {
          search: historySearch.trim() || undefined,
          success: historySuccess || undefined,
        },
      );
      setHistoryItems(res.items);
      setHistoryTotal(res.total);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar el historial",
        "danger",
      );
      setHistoryItems([]);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  }, [
    accessToken,
    id,
    canRead,
    historyPage,
    historyLimit,
    historySearch,
    historySuccess,
    showToast,
  ]);

  useEffect(() => {
    if (tab === "historial") void loadHistory();
  }, [tab, loadHistory]);

  /** Exporta historial visible a XLS. */
  function onExportHistory() {
    if (historyItems.length === 0) {
      showToast("No hay eventos para exportar.", "info");
      return;
    }
    downloadXls(
      historyItems,
      [
        { header: "Fecha", value: (row) => formatDateTime(row.createdAt) },
        { header: "Evento", value: (row) => row.event },
        { header: "Rol", value: (row) => row.role },
        { header: "Usuario", value: (row) => row.user },
        { header: "Detalle", value: (row) => row.detail },
        { header: "Resultado", value: (row) => row.result },
      ],
      `historial-${hab?.code ?? "hab"}`,
    );
  }

  /** Carga checklist pack person de una persona. */
  async function loadPersonDocs(personId: string) {
    if (!accessToken || !hab) return;
    setPersonDocsLoading(true);
    try {
      const docs = await listAccreditationPersonDocumentsRequest(
        accessToken,
        hab.id,
        personId,
      );
      setPersonDocItems(docs.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar docs de la persona",
        "danger",
      );
      setPersonDocItems([]);
    } finally {
      setPersonDocsLoading(false);
    }
  }

  /** Expande/colapsa persona y carga checklist. */
  function togglePerson(personId: string) {
    if (expandedPersonId === personId) {
      setExpandedPersonId(null);
      setPersonDocItems([]);
      return;
    }
    setExpandedPersonId(personId);
    void loadPersonDocs(personId);
  }

  /** Sube archivo (con expiresAt ya resuelto). */
  async function uploadFile(
    documentTypeId: string,
    file: File,
    expiresAt: string | null,
    personId?: string,
  ) {
    if (!accessToken || !hab || acting) return;
    setUploadingTypeId(documentTypeId);
    setActing(true);
    try {
      const contentBase64 = await fileToBase64(file);
      if (personId) {
        await createAccreditationPersonDocumentRequest(
          accessToken,
          hab.id,
          personId,
          {
            documentTypeId,
            fileName: file.name,
            mimeType: file.type || "application/pdf",
            contentBase64,
            expiresAt,
          },
        );
        showToast("Documento de persona subido.", "success");
        await loadPersonDocs(personId);
      } else {
        await createAccreditationDocumentRequest(accessToken, hab.id, {
          documentTypeId,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          contentBase64,
          expiresAt,
        });
        showToast("Documento subido.", "success");
        await load();
      }
      setPendingUpload(null);
      setExpiryDate("");
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
    personId?: string,
  ) {
    if (!file) return;
    if (requiresExpiry) {
      setPendingUpload({ documentTypeId, file, personId });
      setExpiryDate(
        new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
      );
      return;
    }
    void uploadFile(documentTypeId, file, null, personId);
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

  /** Confirma observación de doc (empresa o person). */
  async function confirmObserveDoc() {
    if (!accessToken || !hab || !observeDocId || !observeNote.trim() || acting) {
      return;
    }
    const personId = observePersonId;
    const docId = observeDocId;
    setActing(true);
    try {
      if (personId) {
        await validateAccreditationPersonDocumentRequest(
          accessToken,
          hab.id,
          personId,
          docId,
          { status: "observed", observation: observeNote.trim() },
        );
        showToast("Documento observado.", "success");
        setObserveDocId(null);
        setObservePersonId(null);
        setObserveNote("");
        await loadPersonDocs(personId);
      } else {
        await validateAccreditationDocumentRequest(
          accessToken,
          hab.id,
          docId,
          { status: "observed", observation: observeNote.trim() },
        );
        showToast("Documento observado.", "success");
        setObserveDocId(null);
        setObservePersonId(null);
        setObserveNote("");
        await load();
      }
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
              Pack de empresa + exigencias de tipos de permiso (
              {docItems.length} tipos). Disco local, mismo patrón que docs de
              tripulante.
            </p>
            {docItems.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                No hay tipos de pack «company» ni exigencias document/company
                en tipos de permiso. Configuralos en Packs o en el tipo.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-0">
                {docItems.map((item) => {
                  const doc = item.document;
                  const sourceHint =
                    item.source === "permit_requirement"
                      ? "Exigencia de tipo de permiso"
                      : item.source === "both"
                        ? "Pack + exigencia"
                        : null;
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
                            {sourceHint ? ` · ${sourceHint}` : null}
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
                          <>
                            <DocIconButton
                              title="Visualizar"
                              onClick={() =>
                                void previewAccreditationDocumentRequest(
                                  accessToken,
                                  hab.id,
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
                              <Eye className="size-4" strokeWidth={1.5} aria-hidden />
                            </DocIconButton>
                            <DocIconButton
                              title="Descargar"
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
                              <Download
                                className="size-4"
                                strokeWidth={1.5}
                                aria-hidden
                              />
                            </DocIconButton>
                          </>
                        ) : null}
                        {canUpdate &&
                        doc &&
                        (doc.status === "pending_validation" ||
                          doc.status === "observed") ? (
                          <>
                            <DocIconButton
                              title="Validar"
                              tone="success"
                              disabled={acting}
                              onClick={() => void onValidateDoc(doc.id)}
                            >
                              <Check
                                className="size-4"
                                strokeWidth={1.5}
                                aria-hidden
                              />
                            </DocIconButton>
                            <DocIconButton
                              title="Observar"
                              tone="warning"
                              disabled={acting}
                              onClick={() => {
                                setObserveDocId(doc.id);
                                setObservePersonId(null);
                                setObserveNote(doc.observation ?? "");
                              }}
                            >
                              <MessageSquareWarning
                                className="size-4"
                                strokeWidth={1.5}
                                aria-hidden
                              />
                            </DocIconButton>
                          </>
                        ) : null}
                        {canUpdate &&
                        hab.status !== "approved" &&
                        hab.status !== "rejected" ? (
                          <label className="cursor-pointer px-1 text-[12px] font-medium text-[var(--color-nachipa-title)] hover:underline">
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
              Personal declarado ({people.length}). Expandí una fila para ver el
              pack person.
            </p>
            {people.length === 0 ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Sin personal cargado todavía.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-0">
                {people.map((p) => {
                  const open = expandedPersonId === p.id;
                  return (
                    <li key={p.id} className="flex flex-col">
                      <button
                        type="button"
                        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-nachipa-bg-page)]"
                        onClick={() => togglePerson(p.id)}
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
                        <span className="text-[12px] text-[var(--color-nachipa-primary)]">
                          {open ? "Ocultar docs" : "Ver docs"}
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page)] px-4 py-3">
                          {personDocsLoading ? (
                            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                              Cargando pack person…
                            </p>
                          ) : personDocItems.length === 0 ? (
                            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                              No hay pack persona ni exigencias por persona.
                              Configurá Packs o exigencias del tipo.
                            </p>
                          ) : (
                            <ul className="m-0 list-none space-y-2 p-0">
                              {personDocItems.map((item) => {
                                const doc = item.document;
                                const sourceHint =
                                  item.source === "permit_requirement"
                                    ? "Exigencia de faena"
                                    : item.source === "both"
                                      ? "Pack + faena"
                                      : null;
                                return (
                                  <li
                                    key={item.documentType.id}
                                    className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2 sm:flex-row sm:items-center sm:gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                                        {item.documentType.name}
                                      </span>
                                      <span className="ml-2 text-[11px] text-[var(--color-nachipa-secondary)]">
                                        {item.documentType.code}
                                      </span>
                                      {sourceHint ? (
                                        <span className="ml-2 text-[11px] text-[var(--color-nachipa-primary)]">
                                          · {sourceHint}
                                        </span>
                                      ) : null}
                                      <div className="text-[11px] text-[var(--color-nachipa-body)]">
                                        {doc
                                          ? doc.originalName
                                          : "Sin archivo"}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {doc ? (
                                        <StatusChip
                                          tone={docStatusTone(doc.status)}
                                        >
                                          {docStatusLabel(doc.status)}
                                        </StatusChip>
                                      ) : null}
                                      {doc && accessToken ? (
                                        <>
                                          <DocIconButton
                                            title="Visualizar"
                                            onClick={() =>
                                              void previewAccreditationPersonDocumentRequest(
                                                accessToken,
                                                hab.id,
                                                p.id,
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
                                            <Eye
                                              className="size-4"
                                              strokeWidth={1.5}
                                              aria-hidden
                                            />
                                          </DocIconButton>
                                          <DocIconButton
                                            title="Descargar"
                                            onClick={() =>
                                              void downloadAccreditationPersonDocumentRequest(
                                                accessToken,
                                                hab.id,
                                                p.id,
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
                                            <Download
                                              className="size-4"
                                              strokeWidth={1.5}
                                              aria-hidden
                                            />
                                          </DocIconButton>
                                        </>
                                      ) : null}
                                      {canUpdate &&
                                      doc &&
                                      (doc.status === "pending_validation" ||
                                        doc.status === "observed") ? (
                                        <>
                                          <DocIconButton
                                            title="Validar"
                                            tone="success"
                                            disabled={acting}
                                            onClick={() =>
                                              void (async () => {
                                                if (!accessToken) return;
                                                setActing(true);
                                                try {
                                                  await validateAccreditationPersonDocumentRequest(
                                                    accessToken,
                                                    hab.id,
                                                    p.id,
                                                    doc.id,
                                                    { status: "validated" },
                                                  );
                                                  showToast(
                                                    "Documento validado.",
                                                    "success",
                                                  );
                                                  await loadPersonDocs(p.id);
                                                } catch (err) {
                                                  showToast(
                                                    err instanceof ApiError
                                                      ? err.message
                                                      : "No se pudo validar.",
                                                    "danger",
                                                  );
                                                } finally {
                                                  setActing(false);
                                                }
                                              })()
                                            }
                                          >
                                            <Check
                                              className="size-4"
                                              strokeWidth={1.5}
                                              aria-hidden
                                            />
                                          </DocIconButton>
                                          <DocIconButton
                                            title="Observar"
                                            tone="warning"
                                            disabled={acting}
                                            onClick={() => {
                                              setObserveDocId(doc.id);
                                              setObservePersonId(p.id);
                                              setObserveNote(
                                                doc.observation ?? "",
                                              );
                                            }}
                                          >
                                            <MessageSquareWarning
                                              className="size-4"
                                              strokeWidth={1.5}
                                              aria-hidden
                                            />
                                          </DocIconButton>
                                        </>
                                      ) : null}
                                      {canUpdate &&
                                      hab.status !== "approved" &&
                                      hab.status !== "rejected" ? (
                                        <label className="cursor-pointer px-1 text-[11px] font-medium text-[var(--color-nachipa-title)] hover:underline">
                                          {uploadingTypeId ===
                                          item.documentType.id
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
                                              const f =
                                                e.target.files?.[0] ?? null;
                                              e.target.value = "";
                                              onPickFile(
                                                item.documentType.id,
                                                f,
                                                item.documentType
                                                  .requiresExpiry,
                                                p.id,
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
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "historial" ? (
          <DataTableCard
            toolbar={
              <>
                <DataTableSearch
                  value={historySearch}
                  onChange={(v) => {
                    setHistorySearch(v);
                    setHistoryPage(1);
                  }}
                  placeholder="Buscar evento…"
                />
                <select
                  className={toolbarSelectClass}
                  value={historySuccess}
                  onChange={(e) => {
                    setHistorySuccess(
                      e.target.value as "" | "true" | "false",
                    );
                    setHistoryPage(1);
                  }}
                  aria-label="Filtrar por resultado"
                >
                  <option value="">Estado: todos</option>
                  <option value="true">Solo OK</option>
                  <option value="false">Solo error</option>
                </select>
                <div className="ml-auto">
                  <DataTableOutlineButton onClick={onExportHistory}>
                    Exportar
                  </DataTableOutlineButton>
                </div>
              </>
            }
            footer={
              <TablePagination
                totalLabel={
                  historyLoading
                    ? "Cargando…"
                    : `${historyTotal} ${historyTotal === 1 ? "evento" : "eventos"}`
                }
                page={historyPage}
                pageCount={Math.max(
                  1,
                  Math.ceil(historyTotal / historyLimit) || 1,
                )}
                pageSize={historyLimit}
                onPageChange={setHistoryPage}
                onPageSizeChange={(n) => {
                  setHistoryLimit(n);
                  setHistoryPage(1);
                }}
              />
            }
          >
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-[var(--color-nachipa-bg-page)]">
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Evento</TableHeaderCell>
                  <TableHeaderCell>Rol</TableHeaderCell>
                  <TableHeaderCell>Usuario</TableHeaderCell>
                  <TableHeaderCell>Detalle</TableHeaderCell>
                  <TableHeaderCell>Resultado</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      Cargando historial…
                    </td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      Sin eventos todavía. Las acciones sobre esta HAB quedan
                      aquí.
                    </td>
                  </tr>
                ) : (
                  historyItems.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--color-tremor-border)]"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] tabular-nums text-[var(--color-nachipa-body)]">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                        {row.event}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-nachipa-body)]">
                        {row.role ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-nachipa-body)]">
                        {row.user ?? "—"}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                        {row.detail ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusChip tone={row.resultTone}>
                          {row.result}
                        </StatusChip>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataTableCard>
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
                  pendingUpload.personId,
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
          if (!acting) {
            setObserveDocId(null);
            setObservePersonId(null);
          }
        }}
        icon={ClipboardCheck}
        title="Observar documento"
        subtitle="La observación queda en el documento."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                setObserveDocId(null);
                setObservePersonId(null);
              }}
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
