import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarClock,
  ClipboardList,
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
import {
  createCrewMemberCourseRequest,
  deleteCrewMemberCourseRequest,
  listCrewMemberCoursesRequest,
  updateCrewMemberCourseRequest,
  type CrewCourseStatus,
  type CrewMemberCourse,
} from "../../lib/api/crewMemberCourses";
import { listCoursesRequest, type Course } from "../../lib/api/courses";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  crewMemberId: string;
  businessId: string;
  /** Cambia al editar el título → recarga asignaciones auto. */
  reloadKey?: string;
  /** El padre abre el modal de asignar (botón header). */
  assignOpen: boolean;
  onAssignOpenChange: (open: boolean) => void;
  /** Avisa el total para el label del tab. */
  onTotalChange?: (total: number) => void;
};

/** Nombre de curso capitalizado para UI. */
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
function statusUi(status: CrewCourseStatus): {
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

/** Origen legible. */
function sourceLabel(source: CrewMemberCourse["source"]): string {
  if (source === "certificate") return "Título";
  if (source === "rank") return "Cargo";
  return "Manual";
}

/**
 * Tab Cursos de la ficha: KPIs + tabla + asignar / editar fechas / quitar.
 */
export function CrewCoursesPanel({
  crewMemberId,
  businessId,
  reloadKey,
  assignOpen,
  onAssignOpenChange,
  onTotalChange,
}: Props) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();

  const canRead = userHasPermission(user, "cursos.assignments", "read");
  const canCreate = userHasPermission(user, "cursos.assignments", "create");
  const canUpdate = userHasPermission(user, "cursos.assignments", "update");
  const canDelete = userHasPermission(user, "cursos.assignments", "deactivate");

  const [items, setItems] = useState<CrewMemberCourse[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignCourseId, setAssignCourseId] = useState("");
  const [assignCompletedAt, setAssignCompletedAt] = useState("");
  const [assignExpiresAt, setAssignExpiresAt] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [editRow, setEditRow] = useState<CrewMemberCourse | null>(null);
  const [editCompletedAt, setEditCompletedAt] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Curso pendiente de confirmar quitar (modal del sistema). */
  const [pendingDelete, setPendingDelete] =
    useState<CrewMemberCourse | null>(null);

  /** Paginación cliente; 5 por página por defecto (ficha). */
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
      const list = await listCrewMemberCoursesRequest(accessToken, crewMemberId);
      setItems(list.items);
      onTotalChange?.(list.total);

      try {
        const courses = await listCoursesRequest(accessToken, 1, 100, {
          businessId,
        });
        setCatalog(
          courses.items.filter((c) => c.state && c.businessId === businessId),
        );
      } catch {
        setCatalog([]);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los cursos.",
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
  }, [load, reloadKey]);

  /** Cursos del catálogo que aún no están asignados. */
  const availableCourses = useMemo(() => {
    const taken = new Set(items.map((i) => i.courseId));
    return catalog.filter((c) => !taken.has(c.id));
  }, [catalog, items]);

  const stats = useMemo(() => {
    const total = items.length;
    const valid = items.filter((i) => i.status === "valid").length;
    const expiring = items.filter((i) => i.status === "expiring_soon").length;
    const expired = items.filter((i) => i.status === "expired").length;
    const pending = items.filter((i) => i.status === "pending").length;
    const mandatory = items.filter((i) => i.isMandatory);
    const mandatoryDone = mandatory.filter(
      (i) => i.status === "valid" || i.status === "expiring_soon",
    ).length;
    const compliance =
      mandatory.length === 0
        ? null
        : Math.round((mandatoryDone / mandatory.length) * 100);
    return {
      total,
      valid,
      expiring,
      expired,
      pending,
      missing: pending,
      compliance,
      mandatoryTotal: mandatory.length,
    };
  }, [items]);

  /** Resetea y cierra el modal de asignar. */
  function closeAssign() {
    if (assigning) return;
    onAssignOpenChange(false);
    setAssignCourseId("");
    setAssignCompletedAt("");
    setAssignExpiresAt("");
  }

  /** Alta manual. */
  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canCreate) return;
    if (!assignCourseId) {
      showToast("Elegí un curso.", "danger");
      return;
    }
    setAssigning(true);
    try {
      await createCrewMemberCourseRequest(accessToken, crewMemberId, {
        courseId: assignCourseId,
        completedAt: dateInputToIso(assignCompletedAt),
        expiresAt: dateInputToIso(assignExpiresAt),
      });
      showToast("Curso asignado.", "success");
      closeAssign();
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo asignar el curso.",
        "danger",
      );
    } finally {
      setAssigning(false);
    }
  }

  /** Abre edición de fechas. */
  function openEdit(row: CrewMemberCourse) {
    setEditRow(row);
    setEditCompletedAt(isoToDateInput(row.completedAt));
    setEditExpiresAt(isoToDateInput(row.expiresAt));
  }

  function closeEdit() {
    if (savingEdit) return;
    setEditRow(null);
  }

  /** Guarda fechas de la asignación. */
  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !editRow || !canUpdate) return;
    setSavingEdit(true);
    try {
      await updateCrewMemberCourseRequest(
        accessToken,
        crewMemberId,
        editRow.id,
        {
          completedAt: dateInputToIso(editCompletedAt),
          expiresAt: dateInputToIso(editExpiresAt),
        },
      );
      showToast("Curso actualizado.", "success");
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

  /** Abre modal de confirmación para soft-delete. */
  function requestDelete(row: CrewMemberCourse) {
    if (!canDelete) return;
    setPendingDelete(row);
  }

  /** Soft-delete confirmado. */
  async function confirmDelete() {
    if (!accessToken || !canDelete || !pendingDelete) return;
    setDeletingId(pendingDelete.id);
    try {
      await deleteCrewMemberCourseRequest(
        accessToken,
        crewMemberId,
        pendingDelete.id,
      );
      showToast("Curso quitado.", "success");
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
        No tenés permiso para ver los cursos de este tripulante.
      </div>
    );
  }

  const selectClass =
    "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]";

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5 lg:col-span-1">
          <p className="text-[13px] font-semibold text-[var(--color-nachipa-title)]">
            Cumplimiento
          </p>
          <p className="mt-3 text-[28px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
            {stats.compliance === null ? "—" : `${stats.compliance}%`}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-nachipa-secondary)]">
            {stats.mandatoryTotal === 0
              ? "Sin cursos obligatorios asignados"
              : `${stats.mandatoryTotal} obligatorios del título / catálogo`}
          </p>
        </div>
        <SummaryCard
          icon={CalendarClock}
          title="Por vencer"
          value={String(stats.expiring)}
          footer={
            stats.expiring === 0
              ? "Ninguno en ventana de aviso"
              : "Revisá fechas de vigencia"
          }
          footerTone={stats.expiring === 0 ? "ok" : "muted"}
        />
        <SummaryCard
          icon={TriangleAlert}
          title="Vencidos"
          value={String(stats.expired)}
          footer={
            stats.expired === 0 ? "Todo al día" : "Hay cursos vencidos"
          }
          footerTone={stats.expired === 0 ? "ok" : "muted"}
        />
        <SummaryCard
          icon={ClipboardList}
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
            Cursos
          </p>
          {canCreate ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[12px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
              onClick={() => onAssignOpenChange(true)}
            >
              <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
              Asignar
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando cursos…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]">
            Todavía no hay cursos en esta ficha. Si cambia el título marítimo,
            se cargan solos los del título; también podés asignar a mano.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="bg-[var(--color-nachipa-bg-page,#f9fafc)] text-[11px] font-medium uppercase tracking-wide text-[var(--color-nachipa-secondary)]">
                    <th className="px-4 py-2.5">Curso</th>
                    <th className="px-4 py-2.5">Estado</th>
                    <th className="px-4 py-2.5">Realizado</th>
                    <th className="px-4 py-2.5">Vence</th>
                    <th className="px-4 py-2.5">Origen</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => {
                    const ui = statusUi(row.status);
                    const courseName = row.course
                      ? displayName(row.course.name)
                      : "Curso eliminado";
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-[var(--color-tremor-border)] text-[13px]"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--color-nachipa-title)]">
                            {courseName}
                          </p>
                          <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            {row.course
                              ? displayName(row.course.whereTaught)
                              : "—"}
                            {row.isMandatory ? " · Obligatorio" : ""}
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
                        <td className="px-4 py-3 text-[var(--color-nachipa-secondary)]">
                          {sourceLabel(row.source)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
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
                                title="Quitar curso"
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
              totalLabel={`${items.length} ${items.length === 1 ? "curso" : "cursos"}`}
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
        title="Asignar curso"
        subtitle="Alta manual en la ficha (además de los del título)."
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
              form="assign-course-form"
              className="!w-auto !font-medium"
              disabled={assigning || !canCreate}
            >
              {assigning ? "Guardando…" : "Asignar"}
            </Button>
          </div>
        }
      >
        <form
          id="assign-course-form"
          className="flex flex-col gap-4"
          onSubmit={onAssign}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Curso *
            </span>
            <select
              className={selectClass}
              value={assignCourseId}
              onChange={(e) => setAssignCourseId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {displayName(c.name)} · {displayName(c.whereTaught)}
                </option>
              ))}
            </select>
            {availableCourses.length === 0 ? (
              <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                No hay cursos disponibles (ya asignados o catálogo vacío).
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
              label="Vigencia / vence"
              type="date"
              value={assignExpiresAt}
              onChange={(e) => setAssignExpiresAt(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={editRow !== null}
        icon={Pencil}
        title="Editar curso"
        subtitle={
          editRow?.course
            ? displayName(editRow.course.name)
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
              form="edit-course-form"
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
            id="edit-course-form"
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

      <ConfirmModal
        open={pendingDelete !== null}
        title="Quitar curso"
        message={
          pendingDelete?.course
            ? `¿Quitar ${displayName(pendingDelete.course.name)} de la ficha?`
            : "¿Quitar este curso de la ficha?"
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

/** KPI compacto del tab Cursos. */
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
