import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Inbox, Play, RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip, type StatusChipTone } from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import { TablePagination } from "../../components/TablePagination/TablePagination";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  listNotificationOutboxRequest,
  processOutboxRequest,
  retryNotificationOutboxRequest,
  runCourseExpiryRequest,
  type NotificationOutboxItem,
  type NotificationOutboxStatus,
  type NotificationOutboxType,
} from "../../lib/api/notifications";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Filtros de estado. */
const STATUS_OPTIONS: Array<{ value: "" | NotificationOutboxStatus; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "pending", label: "Pendiente" },
  { value: "processing", label: "En proceso" },
  { value: "sent", label: "Enviado" },
  { value: "failed", label: "Fallido" },
  { value: "cancelled", label: "Cancelado" },
];

/** Filtros de tipo. */
const TYPE_OPTIONS: Array<{ value: "" | NotificationOutboxType; label: string }> = [
  { value: "", label: "Todos los tipos" },
  { value: "boarding_book_expiring", label: "Libreta por vencer" },
  { value: "course_expiring", label: "Curso por vencer" },
  { value: "course_expired", label: "Curso vencido" },
  { value: "boarding_book_admin_digest", label: "Resumen admin · libretas" },
  { value: "course_admin_digest", label: "Resumen admin · cursos" },
];

const STATUS_LABELS: Record<NotificationOutboxStatus, string> = {
  pending: "Pendiente",
  processing: "En proceso",
  sent: "Enviado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

const TYPE_LABELS: Record<NotificationOutboxType, string> = {
  boarding_book_expiring: "Libreta por vencer",
  course_expiring: "Curso por vencer",
  course_expired: "Curso vencido",
  boarding_book_admin_digest: "Resumen admin · libretas",
  course_admin_digest: "Resumen admin · cursos",
  training_expiring: "Capacitación por vencer",
  training_expired: "Capacitación vencida",
  training_admin_digest: "Resumen · capacitaciones",
  work_notice_created: "Nuevo aviso de trabajo",
  work_permit_created: "PT creado → contratista",
};

const STATUS_TONE: Record<NotificationOutboxStatus, StatusChipTone> = {
  pending: "info",
  processing: "info",
  sent: "success",
  failed: "danger",
  cancelled: "neutral",
};

/** Fecha/hora corta es-CL. */
function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/** Resumen legible del payload. */
function payloadLabel(row: NotificationOutboxItem): string {
  const p = row.payload;
  if (!p || typeof p !== "object") return "—";
  const obj = p as Record<string, unknown>;
  if (Array.isArray(obj.rows)) {
    const n = obj.rows.length;
    return `${n} registro${n === 1 ? "" : "s"} en resumen`;
  }
  if (typeof obj.crewName === "string" && typeof obj.courseName === "string") {
    return `${obj.crewName} · ${obj.courseName}`;
  }
  if (typeof obj.crewName === "string") return obj.crewName;
  if (typeof obj.resendId === "string") return `Resend ${obj.resendId.slice(0, 8)}…`;
  return "—";
}

/** Destino efectivo si hubo override. */
function deliveredLabel(row: NotificationOutboxItem): string {
  const p = row.payload;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    const deliveredTo = (p as Record<string, unknown>).deliveredTo;
    if (typeof deliveredTo === "string" && deliveredTo !== row.to) {
      return `${row.to} → ${deliveredTo}`;
    }
  }
  return row.to;
}

/**
 * Outbox de notificaciones: cola, filtros, retry y acciones manuales.
 * Ruta: /notificaciones/outbox
 */
export function OutboxNotificaciones() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<NotificationOutboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [filterStatus, setFilterStatus] = useState<"" | NotificationOutboxStatus>("");
  const [filterType, setFilterType] = useState<"" | NotificationOutboxType>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const loadRows = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await listNotificationOutboxRequest(accessToken, {
        page,
        limit: pageSize,
        status: filterStatus || undefined,
        type: filterType || undefined,
        search: search || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar el outbox";
      showToast(message, "danger");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    filterStatus,
    filterType,
    page,
    pageSize,
    search,
    showToast,
  ]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  async function handleRetry(id: string) {
    if (!accessToken || busy) return;
    setBusy(true);
    try {
      await retryNotificationOutboxRequest(accessToken, id);
      showToast("Aviso reencolado", "success");
      await loadRows();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo reintentar";
      showToast(message, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function handleRunGenerator() {
    if (!accessToken || busy) return;
    setBusy(true);
    try {
      const result = await runCourseExpiryRequest(accessToken);
      showToast(
        `Generador: ${result.expiringEmails} por vencer, ${result.expiredEmails} vencidos, ${result.adminEmails} digest`,
        "success",
      );
      await loadRows();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Falló el generador";
      showToast(message, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function handleProcess(limit = 5) {
    if (!accessToken || busy) return;
    setBusy(true);
    try {
      const result = await processOutboxRequest(accessToken, limit);
      showToast(
        `Envío: ${result.sent} ok, ${result.failed} fallidos, ${result.cancelled} cancelados`,
        result.failed > 0 ? "warning" : "success",
      );
      await loadRows();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Falló el worker";
      showToast(message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Outbox de notificaciones"
        breadcrumbIcon={Inbox}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Configuración" },
            { label: "Notificaciones", to: "/notificaciones" },
            { label: "Outbox" },
          ]}
          title="Outbox de notificaciones"
          description="Cola de avisos encolados, enviados o fallidos. Con override, todos llegan a tu correo de prueba."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/notificaciones"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
              >
                <Settings2 className="size-3.5" strokeWidth={1.5} aria-hidden />
                Hitos
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRunGenerator()}
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
              >
                <RefreshCw className="size-3.5" strokeWidth={1.5} aria-hidden />
                Generar avisos
              </button>
              <Button
                type="button"
                size="small"
                className="!w-auto"
                disabled={busy}
                onClick={() => void handleProcess(5)}
              >
                <Play className="size-3.5" strokeWidth={1.5} aria-hidden />
                Enviar 5
              </Button>
            </div>
          }
        />

        <DataTableCard
          toolbar={
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <label className="flex min-w-[160px] flex-col gap-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                Estado
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(
                      e.target.value as "" | NotificationOutboxStatus,
                    );
                    setPage(1);
                  }}
                  className="h-9 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[13px] text-[var(--color-nachipa-title)]"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value || "all-status"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[180px] flex-col gap-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                Tipo
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value as "" | NotificationOutboxType);
                    setPage(1);
                  }}
                  className="h-9 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[13px] text-[var(--color-nachipa-title)]"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value || "all-type"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <form
                onSubmit={handleSearchSubmit}
                className="flex min-w-[220px] flex-1 items-end gap-2"
              >
                <div className="min-w-0 flex-1">
                  <DataTableSearch
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Buscar destinatario…"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-9 shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                >
                  Buscar
                </button>
              </form>
            </div>
          }
          footer={
            <TablePagination
              totalLabel={loading ? "Cargando…" : `${total} avisos`}
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          }
        >
          <table className="w-full min-w-[960px] border-collapse text-left text-[12px]">
            <thead>
              <tr>
                <TableHeaderCell rounded="left">Estado</TableHeaderCell>
                <TableHeaderCell>Tipo</TableHeaderCell>
                <TableHeaderCell>Destino</TableHeaderCell>
                <TableHeaderCell>Detalle</TableHeaderCell>
                <TableHeaderCell>Intentos</TableHeaderCell>
                <TableHeaderCell>Creado</TableHeaderCell>
                <TableHeaderCell rounded="right" align="right">
                  Acciones
                </TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                  >
                    No hay avisos para mostrar.
                  </td>
                </tr>
              ) : null}
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-tremor-border)] last:border-b-0 hover:bg-[var(--color-nachipa-bg-page)]"
                >
                  <td className="h-[52px] px-3">
                    <StatusChip tone={STATUS_TONE[row.status]}>
                      {STATUS_LABELS[row.status]}
                    </StatusChip>
                    {row.lastError ? (
                      <p
                        className="m-0 mt-1 max-w-[180px] truncate text-[10px] text-[var(--color-status-danger-fg)]"
                        title={row.lastError}
                      >
                        {row.lastError}
                      </p>
                    ) : null}
                  </td>
                  <td className="h-[52px] px-3 text-[var(--color-nachipa-body)]">
                    {TYPE_LABELS[row.type]}
                  </td>
                  <td className="h-[52px] max-w-[220px] truncate px-3 text-[var(--color-nachipa-body)]">
                    {deliveredLabel(row)}
                  </td>
                  <td className="h-[52px] max-w-[240px] truncate px-3 text-[var(--color-nachipa-secondary)]">
                    {payloadLabel(row)}
                  </td>
                  <td className="h-[52px] px-3 tabular-nums text-[var(--color-nachipa-secondary)]">
                    {row.attempts}/{row.maxAttempts}
                  </td>
                  <td className="h-[52px] whitespace-nowrap px-3 text-[var(--color-nachipa-secondary)]">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="h-[52px] px-3 text-right">
                    {row.status === "failed" || row.status === "cancelled" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRetry(row.id)}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                      >
                        <RotateCcw
                          className="size-3"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        Reintentar
                      </button>
                    ) : (
                      <span className="text-[var(--color-nachipa-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableCard>
      </div>
    </div>
  );
}
