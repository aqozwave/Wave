import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Link } from "react-router";
import {
  DataTableCard,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { userHasPermission } from "../../lib/api/auth";
import {
  listWorkPermitsRequest,
  submitWorkPermitRequest,
  type WorkPermit,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

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

/** Etiqueta UI del ciclo. */
function statusLabel(status: WorkPermitStatus): string {
  switch (status) {
    case "to_complete":
      return "Por completar";
    case "to_approve":
      return "Por aprobar";
    case "to_receive":
      return "Por recibir";
    case "active":
      return "Vigente";
    case "to_verify":
      return "Por verificar";
    case "closed":
      return "Cerrado";
    case "no_closure":
      return "Sin cierre";
    default:
      return status;
  }
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

/**
 * Bandeja de permisos de trabajo (Prevención).
 * Crear PT se hace desde un aviso (AT1 → Crear permiso).
 */
export function WorkPermitsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canRead = userHasPermission(user, "work_permits", "read");
  const canUpdate = userHasPermission(user, "work_permits", "update");

  const [items, setItems] = useState<WorkPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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

  /** Contratista/staff: Por completar → Por aprobar. */
  async function onSubmit(row: WorkPermit) {
    if (!accessToken || !canUpdate || submittingId) return;
    if (row.status !== "to_complete") return;
    setSubmittingId(row.id);
    try {
      await submitWorkPermitRequest(accessToken, row.id);
      showToast(`${row.code} enviado a aprobación.`, "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo enviar.",
        "danger",
      );
    } finally {
      setSubmittingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.workNotice.code.toLowerCase().includes(q) ||
        row.organization.name.toLowerCase().includes(q) ||
        row.organization.rut.toLowerCase().includes(q),
    );
  }, [items, search]);

  const {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    total,
  } = useClientTablePagination(filtered);

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
          description="Prevención crea cada permiso desde un aviso. El contratista completa; el capitán recibe y cierra."
          actions={
            <Link
              to="/prevencion/avisos"
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
            >
              Ir a avisos
            </Link>
          }
        />

        <DataTableCard
          toolbar={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar PT, aviso o empresa…"
            />
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
          <table className="w-full min-w-[800px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                <th className="px-3 py-2.5">Permiso</th>
                <th className="px-3 py-2.5">Aviso</th>
                <th className="px-3 py-2.5">Empresa</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Nave</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
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
                    className="border-t border-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                      {row.code}
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
                        {statusLabel(row.status)}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canUpdate && row.status === "to_complete" ? (
                        <button
                          type="button"
                          className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-60"
                          disabled={submittingId === row.id}
                          onClick={() => void onSubmit(row)}
                        >
                          {submittingId === row.id
                            ? "Enviando…"
                            : "Enviar a aprobación"}
                        </button>
                      ) : (
                        <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableCard>
      </div>
    </div>
  );
}
