import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarClock,
  ClipboardList,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Button } from "../../components/Button/Button";
import { ConfirmModal } from "../../components/ConfirmModal/ConfirmModal";
import { Modal } from "../../components/Modal/Modal";
import { StatusChip, type StatusChipTone } from "../../components/StatusChip/StatusChip";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { TextField } from "../../components/TextField/TextField";
import { useToast } from "../../components/Toast/ToastProvider";
import { userHasPermission } from "../../lib/api/auth";
import { fileToBase64 } from "../../lib/api/crewMemberDocuments";
import {
  createCrewMemberTrainingRequest,
  deleteCrewMemberTrainingRequest,
  listCrewMemberTrainingsRequest,
  updateCrewMemberTrainingRequest,
  uploadCrewMemberTrainingEvidenceRequest,
  type CrewMemberTraining,
  type CrewTrainingStatus,
} from "../../lib/api/crewMemberTrainings";
import {
  listTrainingsRequest,
  type Training,
} from "../../lib/api/trainings";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  crewMemberId: string;
  businessId: string;
  /** Avisa el total para el label del tab. */
  onTotalChange?: (total: number) => void;
};

/** MIME aceptados (alineados al API). */
const ACCEPT_MIME =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

/** Máximo 10 MB. */
const MAX_BYTES = 10 * 1024 * 1024;

/** Nombre capitalizado para UI. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** ISO → YYYY-MM-DD para input date. */
function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** YYYY-MM-DD → ISO medianoche UTC. */
function dateInputToIso(date: string): string | null {
  if (!date) return null;
  return `${date}T00:00:00.000Z`;
}

/** Fecha corta es-CL. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Etiqueta + tono del status. */
function statusUi(status: CrewTrainingStatus): {
  label: string;
  tone: StatusChipTone;
} {
  switch (status) {
    case "valid":
      return { label: "Vigente", tone: "success" };
    case "expiring_soon":
      return { label: "Por vencer", tone: "warning" };
    case "expired":
      return { label: "Vencido", tone: "danger" };
    default:
      return { label: "Pendiente", tone: "neutral" };
  }
}

/** MIME desde extensión si el browser no manda type. */
function resolveUploadMime(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/**
 * Tab Capacitaciones de la ficha: KPIs + tabla + asignar / editar / evidencia / quitar.
 */
export function CrewTrainingsPanel({
  crewMemberId,
  businessId,
  onTotalChange,
}: Props) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();

  const canRead = userHasPermission(user, "trainings", "read");
  const canCreate = userHasPermission(user, "trainings", "create");
  const canUpdate = userHasPermission(user, "trainings", "update");
  const canDelete = userHasPermission(user, "trainings", "deactivate");

  const [items, setItems] = useState<CrewMemberTraining[]>([]);
  const [catalog, setCatalog] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTrainingId, setAssignTrainingId] = useState("");
  const [assignCompletedAt, setAssignCompletedAt] = useState("");
  const [assignExpiresAt, setAssignExpiresAt] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [editRow, setEditRow] = useState<CrewMemberTraining | null>(null);
  const [editCompletedAt, setEditCompletedAt] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Capacitación pendiente de confirmar quitar (modal del sistema). */
  const [pendingDelete, setPendingDelete] =
    useState<CrewMemberTraining | null>(null);

  const [evidenceRow, setEvidenceRow] = useState<CrewMemberTraining | null>(
    null,
  );
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceExpiresAt, setEvidenceExpiresAt] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const { page, setPage, pageSize, setPageSize, pageCount, pageItems } =
    useClientTablePagination(items, 5);

  const load = useCallback(async () => {
    if (!accessToken || !businessId) return;
    if (!canRead) {
      setItems([]);
      setCatalog([]);
      setLoading(false);
      onTotalChange?.(0);
      return;
    }
    setLoading(true);
    try {
      const list = await listCrewMemberTrainingsRequest(
        accessToken,
        crewMemberId,
      );
      setItems(list.items);
      onTotalChange?.(list.total);

      try {
        const trainings = await listTrainingsRequest(accessToken, 1, 100, {
          businessId,
          active: true,
        });
        setCatalog(
          trainings.items.filter(
            (t) =>
              t.active &&
              t.businessId === businessId &&
              t.appliesTo.includes("crew"),
          ),
        );
      } catch {
        setCatalog([]);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las capacitaciones.",
        "danger",
      );
      setItems([]);
      onTotalChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    businessId,
    canRead,
    crewMemberId,
    onTotalChange,
    showToast,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Capacitaciones del catálogo aún no asignadas. */
  const availableTrainings = useMemo(() => {
    const taken = new Set(items.map((i) => i.trainingId));
    return catalog.filter((t) => !taken.has(t.id));
  }, [catalog, items]);

  const stats = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending").length;
    const expiring = items.filter((i) => i.status === "expiring_soon").length;
    const expired = items.filter((i) => i.status === "expired").length;
    const withEvidence = items.filter((i) => i.evidenceDocumentId).length;
    return {
      total: items.length,
      pending,
      expiring,
      expired,
      withEvidence,
    };
  }, [items]);

  function closeAssign() {
    if (assigning) return;
    setAssignOpen(false);
    setAssignTrainingId("");
    setAssignCompletedAt("");
    setAssignExpiresAt("");
  }

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canCreate) return;
    if (!assignTrainingId) {
      showToast("Elegí una capacitación.", "danger");
      return;
    }
    setAssigning(true);
    try {
      await createCrewMemberTrainingRequest(accessToken, crewMemberId, {
        trainingId: assignTrainingId,
        completedAt: dateInputToIso(assignCompletedAt),
        expiresAt: dateInputToIso(assignExpiresAt),
      });
      showToast("Capacitación asignada.", "success");
      closeAssign();
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo asignar la capacitación.",
        "danger",
      );
    } finally {
      setAssigning(false);
    }
  }

  function openEdit(row: CrewMemberTraining) {
    setEditRow(row);
    setEditCompletedAt(isoToDateInput(row.completedAt));
    setEditExpiresAt(isoToDateInput(row.expiresAt));
  }

  function closeEdit() {
    if (savingEdit) return;
    setEditRow(null);
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !editRow || !canUpdate) return;
    setSavingEdit(true);
    try {
      await updateCrewMemberTrainingRequest(
        accessToken,
        crewMemberId,
        editRow.id,
        {
          completedAt: dateInputToIso(editCompletedAt),
          expiresAt: dateInputToIso(editExpiresAt),
        },
      );
      showToast("Capacitación actualizada.", "success");
      closeEdit();
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  function openEvidence(row: CrewMemberTraining) {
    setEvidenceRow(row);
    setEvidenceFile(null);
    setEvidenceExpiresAt(isoToDateInput(row.expiresAt));
  }

  function closeEvidence() {
    if (uploadingEvidence) return;
    setEvidenceRow(null);
    setEvidenceFile(null);
    setEvidenceExpiresAt("");
  }

  async function onUploadEvidence(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !evidenceRow || !canUpdate) return;
    if (!evidenceFile) {
      showToast("Elegí un archivo.", "danger");
      return;
    }
    if (evidenceFile.size > MAX_BYTES) {
      showToast("El archivo supera el máximo de 10 MB.", "danger");
      return;
    }
    setUploadingEvidence(true);
    try {
      const contentBase64 = await fileToBase64(evidenceFile);
      await uploadCrewMemberTrainingEvidenceRequest(
        accessToken,
        crewMemberId,
        evidenceRow.id,
        {
          fileName: evidenceFile.name,
          mimeType: resolveUploadMime(evidenceFile),
          contentBase64,
          expiresAt: dateInputToIso(evidenceExpiresAt),
        },
      );
      showToast("Evidencia cargada.", "success");
      closeEvidence();
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo subir la evidencia.",
        "danger",
      );
    } finally {
      setUploadingEvidence(false);
    }
  }

  /** Abre modal de confirmación para soft-delete. */
  function requestDelete(row: CrewMemberTraining) {
    if (!canDelete) return;
    setPendingDelete(row);
  }

  /** Soft-delete confirmado. */
  async function confirmDelete() {
    if (!accessToken || !canDelete || !pendingDelete) return;
    setDeletingId(pendingDelete.id);
    try {
      await deleteCrewMemberTrainingRequest(
        accessToken,
        crewMemberId,
        pendingDelete.id,
      );
      showToast("Capacitación quitada.", "success");
      setPendingDelete(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo quitar.",
        "danger",
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (!canRead) {
    return (
      <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white px-5 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]">
        No tenés permiso para ver las capacitaciones de este tripulante.
      </div>
    );
  }

  const selectClass =
    "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]";

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={ClipboardList}
          title="Asignadas"
          value={String(stats.total)}
          footer={
            stats.withEvidence === 0
              ? "Sin evidencias cargadas"
              : `${stats.withEvidence} con evidencia`
          }
          footerTone={stats.withEvidence > 0 ? "ok" : "muted"}
        />
        <SummaryCard
          icon={CalendarClock}
          title="Por vencer"
          value={String(stats.expiring)}
          footer={
            stats.expiring === 0
              ? "Ninguna en ventana de aviso"
              : "Revisá fechas de vigencia"
          }
          footerTone={stats.expiring === 0 ? "ok" : "muted"}
        />
        <SummaryCard
          icon={TriangleAlert}
          title="Vencidas"
          value={String(stats.expired)}
          footer={
            stats.expired === 0 ? "Todo al día" : "Hay capacitaciones vencidas"
          }
          footerTone={stats.expired === 0 ? "ok" : "muted"}
        />
        <SummaryCard
          icon={Paperclip}
          title="Pendientes"
          value={String(stats.pending)}
          footer={
            stats.pending === 0
              ? "Sin pendientes"
              : "Falta fecha de realización"
          }
          footerTone={stats.pending === 0 ? "ok" : "muted"}
        />
      </div>

      <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-tremor-border)] px-4 py-3">
          <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
            Capacitaciones
          </p>
          {canCreate ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[12px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
              onClick={() => setAssignOpen(true)}
            >
              <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
              Asignar
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando capacitaciones…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]">
            Todavía no hay capacitaciones en esta ficha. Asigná desde el
            catálogo de Prevención (aplica a tripulación).
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="bg-[var(--color-nachipa-bg-page,#f9fafc)] text-[11px] font-medium uppercase tracking-wide text-[var(--color-nachipa-secondary)]">
                    <th className="px-4 py-2.5">Capacitación</th>
                    <th className="px-4 py-2.5">Estado</th>
                    <th className="px-4 py-2.5">Realizado</th>
                    <th className="px-4 py-2.5">Vence</th>
                    <th className="px-4 py-2.5">Evidencia</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => {
                    const ui = statusUi(row.status);
                    const title = row.training
                      ? `${row.training.code} · ${displayName(row.training.name)}`
                      : "Capacitación eliminada";
                    const canAttach =
                      canUpdate && Boolean(row.training?.documentTypeId);
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-[var(--color-tremor-border)] text-[13px]"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--color-nachipa-title)]">
                            {title}
                          </p>
                          <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            {row.training?.validityMonths != null
                              ? `Vigencia ${row.training.validityMonths} meses`
                              : "Sin vigencia fija"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip tone={ui.tone}>{ui.label}</StatusChip>
                          {row.daysUntilExpiry != null &&
                          row.status !== "pending" ? (
                            <p className="mt-1 text-[11px] tabular-nums text-[var(--color-nachipa-secondary)]">
                              {row.daysUntilExpiry < 0
                                ? `Venció hace ${Math.abs(row.daysUntilExpiry)} d`
                                : `Vence en ${row.daysUntilExpiry} d`}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--color-nachipa-body)]">
                          {formatDate(row.completedAt)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--color-nachipa-body)]">
                          {formatDate(row.expiresAt)}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--color-nachipa-secondary)]">
                          {row.evidenceDocument
                            ? row.evidenceDocument.originalName
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canAttach ? (
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                title="Subir evidencia"
                                onClick={() => openEvidence(row)}
                              >
                                <Paperclip
                                  className="size-3.5"
                                  strokeWidth={1.5}
                                  aria-hidden
                                />
                              </button>
                            ) : null}
                            {canUpdate ? (
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                                title="Editar fechas"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil
                                  className="size-3.5"
                                  strokeWidth={1.5}
                                  aria-hidden
                                />
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)] disabled:opacity-60"
                                title="Quitar capacitación"
                                disabled={deletingId === row.id}
                                onClick={() => {
                                  requestDelete(row);
                                }}
                              >
                                <Trash2
                                  className="size-3.5"
                                  strokeWidth={1.5}
                                  aria-hidden
                                />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalLabel={`${items.length} ${items.length === 1 ? "capacitación" : "capacitaciones"}`}
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      <Modal
        open={assignOpen}
        icon={Plus}
        title="Asignar capacitación"
        subtitle="Desde el catálogo de Prevención (aplica a tripulación)."
        onClose={closeAssign}
        maxWidthClass="w-full max-w-[480px] sm:w-[480px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              onClick={closeAssign}
              disabled={assigning}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="assign-training-form"
              className="!w-auto !font-medium"
              disabled={assigning || !canCreate}
            >
              {assigning ? "Guardando…" : "Asignar"}
            </Button>
          </div>
        }
      >
        <form
          id="assign-training-form"
          className="flex flex-col gap-4"
          onSubmit={onAssign}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Capacitación *
            </span>
            <select
              className={selectClass}
              value={assignTrainingId}
              onChange={(e) => setAssignTrainingId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {availableTrainings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {displayName(t.name)}
                  {t.validityMonths != null
                    ? ` (${t.validityMonths} m)`
                    : ""}
                </option>
              ))}
            </select>
            {availableTrainings.length === 0 ? (
              <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                No hay capacitaciones disponibles (ya asignadas o catálogo sin
                aplica a tripulación).
              </span>
            ) : null}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Fecha de realización"
              type="date"
              value={assignCompletedAt}
              onChange={(e) => setAssignCompletedAt(e.target.value)}
            />
            <TextField
              label="Vence (opcional)"
              type="date"
              value={assignExpiresAt}
              onChange={(e) => setAssignExpiresAt(e.target.value)}
            />
            <p className="sm:col-span-2 m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
              Si vacío y hay vigencia en el catálogo, se calcula sola.
            </p>
          </div>
        </form>
      </Modal>

      <Modal
        open={editRow !== null}
        icon={Pencil}
        title="Editar capacitación"
        subtitle={
          editRow?.training
            ? `${editRow.training.code} · ${displayName(editRow.training.name)}`
            : "Fechas de la asignación"
        }
        onClose={closeEdit}
        maxWidthClass="w-full max-w-[480px] sm:w-[480px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              onClick={closeEdit}
              disabled={savingEdit}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="edit-training-form"
              className="!w-auto !font-medium"
              disabled={savingEdit}
            >
              {savingEdit ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        {editRow ? (
          <form
            id="edit-training-form"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={onSaveEdit}
          >
            <TextField
              label="Fecha de realización"
              type="date"
              value={editCompletedAt}
              onChange={(e) => setEditCompletedAt(e.target.value)}
            />
            <TextField
              label="Vigencia / vence"
              type="date"
              value={editExpiresAt}
              onChange={(e) => setEditExpiresAt(e.target.value)}
            />
          </form>
        ) : null}
      </Modal>

      <Modal
        open={evidenceRow !== null}
        icon={Paperclip}
        title="Subir evidencia"
        subtitle={
          evidenceRow?.training
            ? `${evidenceRow.training.code} · ${displayName(evidenceRow.training.name)}`
            : "Documento de acreditación"
        }
        onClose={closeEvidence}
        maxWidthClass="w-full max-w-[480px] sm:w-[480px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              onClick={closeEvidence}
              disabled={uploadingEvidence}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="training-evidence-form"
              className="!w-auto !font-medium"
              disabled={uploadingEvidence || !evidenceFile}
            >
              {uploadingEvidence ? "Subiendo…" : "Subir"}
            </Button>
          </div>
        }
      >
        {evidenceRow ? (
          <form
            id="training-evidence-form"
            className="flex flex-col gap-4"
            onSubmit={onUploadEvidence}
          >
            {!evidenceRow.training?.documentTypeId ? (
              <p className="m-0 text-[13px] text-[var(--color-status-danger-fg)]">
                Esta capacitación no tiene tipo de documento configurado en el
                catálogo.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                    Archivo *
                  </span>
                  <input
                    type="file"
                    accept={ACCEPT_MIME}
                    className="block w-full text-[13px] text-[var(--color-nachipa-body)] file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--color-nachipa-tab)] file:px-3 file:py-1.5 file:text-[12px] file:font-medium"
                    onChange={(e) =>
                      setEvidenceFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                <TextField
                  label="Vence (opcional)"
                  type="date"
                  value={evidenceExpiresAt}
                  onChange={(e) => setEvidenceExpiresAt(e.target.value)}
                />
                <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                  Si el tipo exige vencimiento y no hay fecha, usá este campo.
                </p>
              </>
            )}
          </form>
        ) : null}
      </Modal>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Quitar capacitación"
        message={
          pendingDelete?.training
            ? `¿Quitar ${pendingDelete.training.code} · ${displayName(pendingDelete.training.name)} de la ficha?`
            : "¿Quitar esta capacitación de la ficha?"
        }
        confirmLabel="Quitar"
        busyLabel="Quitando…"
        busy={deletingId !== null}
        onClose={() => {
          if (deletingId === null) setPendingDelete(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </>
  );
}

/** KPI compacto del tab Capacitaciones. */
function SummaryCard({
  icon: Icon,
  title,
  value,
  footer,
  footerTone,
}: {
  icon: typeof CalendarClock;
  title: string;
  value: string;
  footer: string;
  footerTone: "ok" | "muted";
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--color-nachipa-bg-page)]">
          <Icon
            className="size-3.5 text-[var(--color-icon-default)]"
            strokeWidth={1.5}
            aria-hidden
          />
        </span>
        <span className="text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
          {title}
        </span>
      </div>
      <p className="mt-3 text-[28px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
        {value}
      </p>
      <p
        className={[
          "mt-2 text-[12px]",
          footerTone === "ok"
            ? "text-[var(--color-status-success-fg)]"
            : "text-[var(--color-nachipa-secondary)]",
        ].join(" ")}
      >
        {footer}
      </p>
    </div>
  );
}
