import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileText,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { WorkPermitProgressCell } from "../../components/WorkPermitProgressCell/WorkPermitProgressCell";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { downloadXls } from "../../lib/exportXls";
import {
  listWorkPermitsRequest,
  requestCloseWorkPermitRequest,
  resolveWorkPermitFlowPolicy,
  workPermitStatusLabel,
  type WorkPermit,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { WorkPermitCompleteModal } from "../Prevencion/WorkPermitCompleteModal";

/** Botón outline del portal. */
const outlineBtnClass =
  "inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

/** Filtro de estado (KPI o select). */
type StatusFilter = "" | WorkPermitStatus | "to_close";

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
    default:
      return "neutral";
  }
}

/**
 * Portal contratista — mis permisos de trabajo (Figma [P5] E18).
 * KPIs + filtros + completar / pedir cierre.
 */
export function ContractorPortalPermitsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<WorkPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [completeRow, setCompleteRow] = useState<WorkPermit | null>(null);
  /** Modal pedir cierre con observación opcional. */
  const [closeRow, setCloseRow] = useState<WorkPermit | null>(null);
  const [closeObservation, setCloseObservation] = useState("");

  const load = useCallback(async () => {
    if (!accessToken || !user?.organizationId) return;
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
  }, [accessToken, user?.organizationId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Conteos KPI E18. */
  const kpiCounts = useMemo(() => {
    let toComplete = 0;
    let toApprove = 0;
    let toReceive = 0;
    let toClose = 0;
    const closeCodes: string[] = [];
    for (const row of items) {
      if (row.status === "to_complete") toComplete += 1;
      else if (row.status === "to_approve") toApprove += 1;
      else if (row.status === "to_receive") toReceive += 1;
      else if (row.status === "active" || row.status === "to_verify") {
        toClose += 1;
        if (closeCodes.length < 2) closeCodes.push(row.code);
      }
    }
    return { toComplete, toApprove, toReceive, toClose, closeCodes };
  }, [items]);

  /** Tarjetas KPI portal (Figma E18). */
  const kpiCards = [
    {
      key: "to_complete" as const,
      label: "Por completar",
      value: kpiCounts.toComplete,
      chip: "nuevo",
      chipTone: "danger" as const,
      hint: "asignado por Prevención",
      icon: Clock,
      filter: "to_complete" as StatusFilter,
    },
    {
      key: "to_approve" as const,
      label: "En aprobación",
      value: kpiCounts.toApprove,
      chip: "Prevención",
      chipTone: "neutral" as const,
      hint: "esperando aprobación",
      icon: FileText,
      filter: "to_approve" as StatusFilter,
    },
    {
      key: "to_receive" as const,
      label: "Aprobado Prevención",
      value: kpiCounts.toReceive,
      chip: "a bordo",
      chipTone: "info" as const,
      hint: "esperando al capitán",
      icon: ClipboardList,
      filter: "to_receive" as StatusFilter,
    },
    {
      key: "to_close" as const,
      label: "Por cerrar",
      value: kpiCounts.toClose,
      chip: "vigente y por verif.",
      chipTone: "info" as const,
      hint:
        kpiCounts.closeCodes.length > 0
          ? kpiCounts.closeCodes.join(" · ")
          : "autorizados o por verificar",
      icon: AlertCircle,
      filter: "to_close" as StatusFilter,
    },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (statusFilter === "to_close") {
        if (row.status !== "active" && row.status !== "to_verify") return false;
      } else if (statusFilter && row.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.code.toLowerCase().includes(q) ||
        row.permitType.name.toLowerCase().includes(q) ||
        row.permitType.code.toLowerCase().includes(q) ||
        row.location.name.toLowerCase().includes(q)
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

  /** Export XLS del listado filtrado. */
  function onExport() {
    if (filtered.length === 0) {
      showToast("No hay filas para exportar.", "info");
      return;
    }
    downloadXls(
      filtered,
      [
        { header: "Permiso", value: (row) => row.code },
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
      "mis-permisos",
    );
  }

  /** Click KPI: filtra / limpia. */
  function onKpiClick(filter: StatusFilter) {
    setStatusFilter((prev) => (prev === filter ? "" : filter));
    setPage(1);
  }

  /** Abre modal de pedir cierre. */
  function openRequestClose(row: WorkPermit) {
    setCloseObservation("");
    setCloseRow(row);
  }

  /** Contratista avisa que terminó el trabajo → capitán verifica. */
  async function confirmRequestClose() {
    if (!accessToken || !closeRow || actingId) return;
    setActingId(closeRow.id);
    try {
      await requestCloseWorkPermitRequest(
        accessToken,
        closeRow.id,
        closeObservation.trim() || null,
      );
      showToast(
        `${closeRow.code} · ${workPermitStatusLabel("to_verify")}.`,
        "success",
      );
      setCloseRow(null);
      setCloseObservation("");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo pedir el cierre",
        "danger",
      );
    } finally {
      setActingId(null);
    }
  }

  if (!user?.organizationId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar breadcrumb="Mi empresa" actions={<UserMenu />} />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Esta pantalla es para usuarios del portal contratista.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Mi empresa"
        breadcrumbIcon={ClipboardCheck}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[{ label: "Permisos de trabajo" }]}
          title="Permisos de trabajo"
          description="Prevención crea cada permiso y te lo asigna. Tú completás personal y checklist; el capitán lo recibe en el puente."
          actions={
            <button type="button" className={outlineBtnClass} onClick={onExport}>
              <Download
                className="mr-1.5 size-4"
                strokeWidth={1.5}
                aria-hidden
              />
              Exportar
            </button>
          }
        />

        {/* KPIs Figma E18 */}
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
                  <StatusChip tone={kpi.chipTone}>{kpi.chip}</StatusChip>
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
                placeholder="Buscar por N° o actividad…"
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
                  <option value="to_approve">En aprobación</option>
                  <option value="to_receive">Aprobado Prevención</option>
                  <option value="active">Autorizado a bordo</option>
                  <option value="to_verify">Verificar trabajo</option>
                  <option value="to_close">Por cerrar</option>
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
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                <th className="px-3 py-2.5">Permiso</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Nave</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Avance</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Todavía no tenés permisos asignados.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-tremor-border)]"
                  >
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                      <Link
                        to={`/portal/permisos/${row.id}`}
                        className="hover:text-[var(--color-nachipa-primary)] hover:underline"
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.permitType.code} · {row.permitType.name}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.location.name}
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
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex flex-wrap items-center justify-end gap-2">
                        <Link
                          to={`/portal/permisos/${row.id}`}
                          className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                        >
                          Ver
                        </Link>
                        {row.status === "to_complete" ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                            onClick={() => setCompleteRow(row)}
                          >
                            Completar
                          </button>
                        ) : null}
                        {row.status === "active" &&
                        resolveWorkPermitFlowPolicy(row.approvalFlowSnapshot)
                          .hasRequestCloseStage ? (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                            disabled={actingId === row.id}
                            onClick={() => openRequestClose(row)}
                          >
                            Pedir cierre
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
          mode="portal"
          onClose={() => setCompleteRow(null)}
          onDone={() => void load()}
        />
      ) : null}

      <Modal
        open={Boolean(closeRow)}
        onClose={() => {
          if (!actingId) setCloseRow(null);
        }}
        title="Pedir cierre"
        subtitle={closeRow ? closeRow.code : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(actingId)}
              onClick={() => setCloseRow(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={Boolean(actingId)}
              onClick={() => void confirmRequestClose()}
            >
              {actingId ? "Enviando…" : "Pedir cierre"}
            </Button>
          </div>
        }
      >
        <p className="m-0 mb-3 text-[13px] text-[var(--color-nachipa-secondary)]">
          El permiso pasa a «Verificar trabajo». Podés dejar un comentario para
          el capitán.
        </p>
        <TextField
          label="Observación (opcional)"
          value={closeObservation}
          onChange={(e) => setCloseObservation(e.target.value)}
        />
      </Modal>
    </div>
  );
}
