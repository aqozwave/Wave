import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileText,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { WorkPermitProgressCell } from "../../components/WorkPermitProgressCell/WorkPermitProgressCell";
import {
  WorkPermitSignModal,
  type WorkPermitSignKind,
} from "../../components/WorkPermitSignModal/WorkPermitSignModal";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { userHasPermission } from "../../lib/api/auth";
import { downloadXls } from "../../lib/exportXls";
import {
  approveWorkPermitRequest,
  closeWorkPermitRequest,
  deleteWorkPermitRequest,
  listWorkPermitsRequest,
  receiveWorkPermitRequest,
  rejectCloseWorkPermitRequest,
  rejectReceiptWorkPermitRequest,
  requestCloseWorkPermitRequest,
  resolveWorkPermitFlowPolicy,
  returnWorkPermitRequest,
  workPermitStatusLabel,
  type WorkPermit,
  type WorkPermitDigitalSignaturePayload,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { WorkPermitCompleteModal } from "./WorkPermitCompleteModal";
import { WorkPermitCreateModal } from "./WorkPermitCreateModal";

/** KPI de la bandeja (Figma [P5] P3). */
type PermitKpiKey =
  | "to_complete"
  | "to_approve"
  | "to_receive"
  | "closure_pending";

/** Filtro de estado: todos o un status concreto / cierre pendiente. */
type StatusFilter = "" | WorkPermitStatus | "closure_pending";

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

/** Tono chip. */
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
    case "closed":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Botón outline (modales + Exportar). */
const outlineBtnClass =
  "inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/**
 * Bandeja de permisos de trabajo (Prevención).
 * Crear PT desde aviso; aprobar/devolver desde «Por aprobar».
 */
export function WorkPermitsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const canRead = userHasPermission(user, "work_permits", "read");
  const canCreate = userHasPermission(user, "work_permits", "create");
  const canUpdate = userHasPermission(user, "work_permits", "update");
  const canReceive = userHasPermission(user, "work_permits", "receive");
  const canDelete = userHasPermission(user, "work_permits", "deactivate");
  /** Portal contratista no aprueba ni recibe. */
  const isStaff = !user?.organizationId;

  const [items, setItems] = useState<WorkPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  /** Filtro por estado (también al clickear un KPI). */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [actingId, setActingId] = useState<string | null>(null);
  /** Modal con nota: devolver / no autorizar / pedir cierre. */
  const [noteModal, setNoteModal] = useState<{
    kind: "return" | "reject-receipt" | "request-close";
    row: WorkPermit;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  /** Modal firma digital: aprobar / recibir / cerrar / sin cierre. */
  const [signModal, setSignModal] = useState<{
    kind: WorkPermitSignKind;
    row: WorkPermit;
  } | null>(null);
  /** Modal completar personal + checklist (también staff, opción B). */
  const [completeRow, setCompleteRow] = useState<WorkPermit | null>(null);
  /** Modal Nuevo permiso P13/P13b. */
  const [createOpen, setCreateOpen] = useState(false);
  /** Confirmación soft-delete. */
  const [deleteRow, setDeleteRow] = useState<WorkPermit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    try {
      const result = await listWorkPermitsRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar permisos",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, canRead, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Abre modal de firma digital (Prevención / capitán). */
  function openSignModal(kind: WorkPermitSignKind, row: WorkPermit) {
    setSignModal({ kind, row });
  }

  /** Abre modal con nota (devolver / no autorizar / pedir cierre). */
  function openNoteModal(
    kind: "return" | "reject-receipt" | "request-close",
    row: WorkPermit,
  ) {
    setReviewNote("");
    setNoteModal({ kind, row });
  }

  /** Confirma firma digital y ejecuta la transición. */
  async function confirmSign(
    payload: WorkPermitDigitalSignaturePayload & { reviewNote?: string },
  ) {
    if (!accessToken || !signModal || actingId) return;
    const { kind, row } = signModal;
    setActingId(row.id);
    try {
      if (kind === "approve") {
        await approveWorkPermitRequest(accessToken, row.id, payload);
        showToast(
          `${row.code} · ${workPermitStatusLabel("to_receive")}.`,
          "success",
        );
      } else if (kind === "receive") {
        await receiveWorkPermitRequest(accessToken, row.id, payload);
        showToast(
          `${row.code} · ${workPermitStatusLabel("active")}.`,
          "success",
        );
      } else if (kind === "close") {
        await closeWorkPermitRequest(accessToken, row.id, payload);
        showToast(
          `${row.code} · ${workPermitStatusLabel("closed")}.`,
          "success",
        );
      } else {
        await rejectCloseWorkPermitRequest(
          accessToken,
          row.id,
          payload.reviewNote ?? "",
          payload,
        );
        showToast(
          `${row.code} · ${workPermitStatusLabel("no_closure")}.`,
          "success",
        );
      }
      setSignModal(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo firmar.",
        "danger",
      );
    } finally {
      setActingId(null);
    }
  }

  /** Confirma modal con nota (devolver / no autorizar / pedir cierre). */
  async function confirmNoteModal() {
    if (!accessToken || !noteModal || actingId) return;
    /** Pedir cierre: observación opcional; el resto exige texto. */
    if (noteModal.kind !== "request-close" && !reviewNote.trim()) return;
    setActingId(noteModal.row.id);
    try {
      if (noteModal.kind === "return") {
        await returnWorkPermitRequest(
          accessToken,
          noteModal.row.id,
          reviewNote.trim(),
        );
        showToast(
          `${noteModal.row.code} · ${workPermitStatusLabel("to_complete")}.`,
          "success",
        );
      } else if (noteModal.kind === "reject-receipt") {
        await rejectReceiptWorkPermitRequest(
          accessToken,
          noteModal.row.id,
          reviewNote.trim(),
        );
        showToast(
          `${noteModal.row.code} · vuelve a ${workPermitStatusLabel("to_approve")}.`,
          "success",
        );
      } else {
        await requestCloseWorkPermitRequest(
          accessToken,
          noteModal.row.id,
          reviewNote.trim() || null,
        );
        showToast(
          `${noteModal.row.code} · ${workPermitStatusLabel("to_verify")}.`,
          "success",
        );
      }
      setNoteModal(null);
      setReviewNote("");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setActingId(null);
    }
  }

  /** Soft-delete PT (+ aviso origen). */
  async function onConfirmDelete() {
    if (!accessToken || !deleteRow || deleting) return;
    setDeleting(true);
    try {
      await deleteWorkPermitRequest(accessToken, deleteRow.id);
      showToast(`${deleteRow.code} eliminado.`, "success");
      setDeleteRow(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo eliminar el permiso.",
        "danger",
      );
    } finally {
      setDeleting(false);
    }
  }

  /** Conteos KPI desde el listado cargado (Figma P3). */
  const kpiCounts = useMemo(() => {
    let toComplete = 0;
    let toApprove = 0;
    let toReceive = 0;
    let closurePending = 0;
    for (const row of items) {
      if (row.status === "to_complete") toComplete += 1;
      else if (row.status === "to_approve") toApprove += 1;
      else if (row.status === "to_receive") toReceive += 1;
      else if (row.status === "active" || row.status === "to_verify") {
        closurePending += 1;
      }
    }
    return { toComplete, toApprove, toReceive, closurePending };
  }, [items]);

  /** Tarjetas KPI alineadas al frame Figma. */
  const kpiCards: Array<{
    key: PermitKpiKey;
    label: string;
    value: number;
    chip: string;
    hint: string;
    icon: typeof Clock;
    filter: StatusFilter;
  }> = [
    {
      key: "to_complete",
      label: "Por completar",
      value: kpiCounts.toComplete,
      chip: "contratista",
      hint: "esperan al contratista",
      icon: Clock,
      filter: "to_complete",
    },
    {
      key: "to_approve",
      label: "En revisión",
      value: kpiCounts.toApprove,
      chip: "vuelven a ti",
      hint: "checklist y personal",
      icon: FileText,
      filter: "to_approve",
    },
    {
      key: "to_receive",
      label: "Aprobado Prevención",
      value: kpiCounts.toReceive,
      chip: "a bordo",
      hint: "esperan al capitán",
      icon: ClipboardList,
      filter: "to_receive",
    },
    {
      key: "closure_pending",
      label: "Cierre pendiente",
      value: kpiCounts.closurePending,
      chip: "verificar o cerrar",
      hint: "autorizados o por verificar",
      icon: AlertCircle,
      filter: "closure_pending",
    },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (statusFilter === "closure_pending") {
        if (row.status !== "active" && row.status !== "to_verify") return false;
      } else if (statusFilter && row.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.code.toLowerCase().includes(q) ||
        row.workNotice.code.toLowerCase().includes(q) ||
        row.organization.name.toLowerCase().includes(q) ||
        row.organization.rut.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  const {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    total,
  } = useClientTablePagination(filtered);

  /** Export XLS del listado filtrado (Figma Exportar). */
  function onExport() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filtered,
      [
        { header: "Permiso", value: (row) => row.code },
        { header: "Aviso", value: (row) => row.workNotice.code },
        {
          header: "Empresa",
          value: (row) => displayName(row.organization.name),
        },
        { header: "RUT", value: (row) => row.organization.rut },
        {
          header: "Tipo",
          value: (row) => `${row.permitType.code} · ${row.permitType.name}`,
        },
        { header: "Nave", value: (row) => row.location.name },
        {
          header: "Fecha",
          value: (row) => formatDate(row.scheduledDate),
        },
        {
          header: "Estado",
          value: (row) => workPermitStatusLabel(row.status),
        },
      ],
      "permisos-trabajo",
    );
  }

  /** Click en KPI: filtra / limpia si ya estaba activo. */
  function onKpiClick(filter: StatusFilter) {
    setStatusFilter((prev) => (prev === filter ? "" : filter));
    setPage(1);
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
            No tenés permiso work_permits.read, o el módulo work_permits está
            apagado.
          </p>
        </div>
      </div>
    );
  }

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
            { label: "Permisos de trabajo" },
          ]}
          title="Permisos de trabajo"
          description="Tú creas el permiso para una empresa habilitada, el contratista lo completa, tú lo apruebas y el capitán lo recibe en el puente."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={outlineBtnClass}
                onClick={onExport}
              >
                <Download
                  className="mr-1.5 size-4"
                  strokeWidth={1.5}
                  aria-hidden
                />
                Exportar
              </button>
              {canCreate && isStaff ? (
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  onClick={() => setCreateOpen(true)}
                >
                  + Nuevo permiso
                </Button>
              ) : null}
            </div>
          }
        />

        {/* Tabs Figma: Permisos | Avisos | Tipos */}
        <div
          role="tablist"
          className="flex flex-wrap gap-1 border-b border-[var(--color-tremor-border)]"
        >
          <span
            role="tab"
            aria-selected
            className="border-b-2 border-[var(--color-nachipa-primary)] px-3 py-2 text-[13px] font-medium text-[var(--color-nachipa-title)]"
          >
            Permisos
            <span className="ml-1.5 text-[var(--color-nachipa-secondary)]">
              {items.length}
            </span>
          </span>
          <Link
            to="/prevencion/avisos"
            role="tab"
            className="px-3 py-2 text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]"
          >
            Avisos
          </Link>
          <Link
            to="/prevencion/tipos"
            role="tab"
            className="px-3 py-2 text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]"
          >
            Tipos de permiso
          </Link>
        </div>

        {/* KPIs Figma [P5] P3 — click filtra la tabla */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon;
            const active = statusFilter === kpi.filter;
            return (
              <button
                key={kpi.key}
                type="button"
                onClick={() => onKpiClick(kpi.filter)}
                className={[
                  "flex flex-col gap-1.5 rounded-[var(--radius-lg)] border bg-white px-4 py-3.5 text-left transition-colors",
                  active
                    ? "border-[var(--color-nachipa-primary)] ring-1 ring-[var(--color-nachipa-primary)]"
                    : "border-[var(--color-tremor-border)] hover:border-[var(--color-nachipa-secondary)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--color-nachipa-body)]">
                    {kpi.label}
                  </span>
                  <Icon
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0 text-[var(--color-nav-icon,#64748b)]"
                    aria-hidden
                  />
                </div>
                <p className="m-0 text-[28px] font-semibold leading-9 tracking-[-0.5px] tabular-nums text-[var(--color-nachipa-title)]">
                  {loading ? "…" : kpi.value}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip tone="info">{kpi.chip}</StatusChip>
                  <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                    {kpi.hint}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <DataTableCard
          toolbar={
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <DataTableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar por N° o empresa…"
              />
              <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                <span className="sr-only">Estado</span>
                <select
                  className="h-8 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2 text-[12px] font-medium text-[var(--color-nachipa-title)]"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <option value="">Estado: todos</option>
                  <option value="to_complete">Por completar</option>
                  <option value="to_approve">En revisión</option>
                  <option value="to_receive">Aprobado Prevención</option>
                  <option value="active">Autorizado a bordo</option>
                  <option value="to_verify">Verificar trabajo</option>
                  <option value="closure_pending">Cierre pendiente</option>
                  <option value="closed">Trabajo cerrado</option>
                  <option value="no_closure">Sin cierre</option>
                </select>
              </label>
            </div>
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "permiso" : "permisos"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                <th className="px-3 py-2.5">Permiso</th>
                <th className="px-3 py-2.5">Aviso</th>
                <th className="px-3 py-2.5">Empresa</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Nave</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Avance</th>
                <th className="sticky right-0 z-10 bg-[var(--color-table-head-bg,#f8f9fb)] px-3 py-2.5 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    No hay permisos. Creá uno desde un aviso en Avisos de
                    trabajo.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-t border-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                      <Link
                        to={`/prevencion/permisos/${row.id}`}
                        className="hover:text-[var(--color-nachipa-primary)] hover:underline"
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {row.workNotice.code}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-medium text-[var(--color-nachipa-title)]">
                        {displayName(row.organization.name)}
                      </span>
                      <span className="text-[12px] tabular-nums text-[var(--color-nachipa-secondary)]">
                        {row.organization.rut}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.permitType.code}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {displayName(row.location.name)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDate(row.scheduledDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={statusTone(row.status)}>
                        {workPermitStatusLabel(row.status)}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5">
                      <WorkPermitProgressCell status={row.status} />
                    </td>
                    <td className="sticky right-0 z-10 whitespace-nowrap bg-white px-3 py-2.5 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] group-hover:bg-[var(--color-nachipa-bg-page)]">
                      {/* Aprobar solo dentro del PT (evita clic accidental en la lista). */}
                      <span className="inline-flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
                        {/* Siempre visible: Acciones nunca queda vacía. */}
                        <Link
                          to={`/prevencion/permisos/${row.id}`}
                          className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                        >
                          Ver
                        </Link>
                        {canUpdate && row.status === "to_complete" ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                            onClick={() => setCompleteRow(row)}
                          >
                            Completar
                          </button>
                        ) : null}
                        {canUpdate &&
                        isStaff &&
                        row.status === "to_approve" ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-title)] hover:underline disabled:opacity-60"
                            disabled={actingId === row.id}
                            onClick={() => openNoteModal("return", row)}
                          >
                            Devolver
                          </button>
                        ) : null}
                        {canReceive &&
                        isStaff &&
                        row.status === "to_receive" ? (
                          <>
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                              disabled={actingId === row.id}
                              onClick={() => openSignModal("receive", row)}
                            >
                              {actingId === row.id ? "…" : "Autorizar a bordo"}
                            </button>
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-title)] hover:underline disabled:opacity-60"
                              disabled={actingId === row.id}
                              onClick={() =>
                                openNoteModal("reject-receipt", row)
                              }
                            >
                              No autorizar
                            </button>
                          </>
                        ) : null}
                        {canUpdate &&
                        row.status === "active" &&
                        resolveWorkPermitFlowPolicy(row.approvalFlowSnapshot)
                          .hasRequestCloseStage ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                            disabled={actingId === row.id}
                            onClick={() =>
                              openNoteModal("request-close", row)
                            }
                          >
                            Pedir cierre
                          </button>
                        ) : null}
                        {canReceive &&
                        isStaff &&
                        row.status === "to_verify" ? (
                          <>
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                              disabled={actingId === row.id}
                              onClick={() => openSignModal("close", row)}
                            >
                              {actingId === row.id ? "…" : "Cerrar trabajo"}
                            </button>
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-title)] hover:underline disabled:opacity-60"
                              disabled={actingId === row.id}
                              onClick={() =>
                                openSignModal("reject-close", row)
                              }
                            >
                              Sin cierre
                            </button>
                          </>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-secondary)] hover:text-[var(--color-status-danger-fg,#b91c1c)] hover:underline"
                            onClick={() => setDeleteRow(row)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      {accessToken ? (
        <WorkPermitCompleteModal
          open={Boolean(completeRow)}
          permit={completeRow}
          accessToken={accessToken}
          mode="staff"
          onClose={() => setCompleteRow(null)}
          onDone={() => void load()}
        />
      ) : null}

      {accessToken && canCreate && isStaff ? (
        <WorkPermitCreateModal
          open={createOpen}
          accessToken={accessToken}
          onClose={() => setCreateOpen(false)}
          onCreated={(permitId) => {
            void load();
            navigate(`/prevencion/permisos/${permitId}`);
          }}
        />
      ) : null}

      <WorkPermitSignModal
        open={Boolean(signModal)}
        kind={signModal?.kind ?? null}
        permitCode={signModal?.row.code}
        defaultSignerName={
          user
            ? `${user.firstName} ${user.lastName}`.trim() || user.email
            : ""
        }
        submitting={Boolean(actingId && signModal)}
        onClose={() => {
          if (!actingId) setSignModal(null);
        }}
        onConfirm={(payload) => void confirmSign(payload)}
      />

      <Modal
        open={Boolean(noteModal)}
        onClose={() => {
          if (!actingId) setNoteModal(null);
        }}
        title={
          noteModal?.kind === "reject-receipt"
            ? "No autorizar recepción"
            : noteModal?.kind === "request-close"
              ? "Pedir cierre"
              : "Devolver permiso al contratista"
        }
        subtitle={
          noteModal
            ? `${noteModal.row.code} · ${displayName(noteModal.row.organization.name)}`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(actingId)}
              onClick={() => setNoteModal(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={
                Boolean(actingId) ||
                (noteModal?.kind !== "request-close" && !reviewNote.trim())
              }
              onClick={() => void confirmNoteModal()}
            >
              {actingId
                ? "Guardando…"
                : noteModal?.kind === "reject-receipt"
                  ? "No autorizar"
                  : noteModal?.kind === "request-close"
                    ? "Pedir cierre"
                    : "Devolver"}
            </Button>
          </div>
        }
      >
        <p className="m-0 mb-3 text-[13px] text-[var(--color-nachipa-secondary)]">
          {noteModal?.kind === "reject-receipt"
            ? "El permiso vuelve a «En revisión» (Prevención) con tu motivo."
            : noteModal?.kind === "request-close"
              ? "El permiso pasa a «Verificar trabajo». Podés dejar un comentario para el capitán."
              : "El permiso vuelve a «Por completar» con tu observación."}
        </p>
        <TextField
          label={
            noteModal?.kind === "reject-receipt"
              ? "Motivo"
              : noteModal?.kind === "request-close"
                ? "Observación (opcional)"
                : "Observaciones"
          }
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          required={noteModal?.kind !== "request-close"}
        />
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        onClose={() => {
          if (!deleting) setDeleteRow(null);
        }}
        title="Eliminar permiso"
        subtitle={
          deleteRow
            ? `${deleteRow.code} · ${displayName(deleteRow.organization.name)}`
            : undefined
        }
        maxWidthClass="max-w-[440px]"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteRow(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={deleting}
              onClick={() => void onConfirmDelete()}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          Se quita de la bandeja junto con el aviso{" "}
          {deleteRow ? deleteRow.workNotice.code : ""}. Esta acción no se puede
          deshacer desde la UI.
        </p>
      </Modal>
    </div>
  );
}
