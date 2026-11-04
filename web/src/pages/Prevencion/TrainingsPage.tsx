import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";
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
import {
  listTrainingsRequest,
  type Training,
} from "../../lib/api/trainings";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Etiqueta de appliesTo. */
function appliesToLabel(tags: Training["appliesTo"]): string {
  if (tags.length === 0) return "—";
  return tags
    .map((t) => (t === "crew" ? "Tripulación" : "Externo"))
    .join(", ");
}

/**
 * Listado de capacitaciones Prevención (P1 / P4).
 * Solo lectura en este slice.
 */
export function TrainingsPage() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listTrainingsRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar capacitaciones",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q),
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={GraduationCap}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Capacitaciones" },
          ]}
          title="Capacitaciones"
          description="Catálogo de capacitaciones del módulo Prevención (distinto de cursos OMI)."
        />

        <DataTableCard
          toolbar={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar código o nombre…"
            />
          }
          footer={
            <TablePagination
              totalLabel={
                loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "capacitación" : "capacitaciones"}`
              }
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          }
        >
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-nachipa-bg-page)] text-[12px] text-[var(--color-nachipa-secondary)]">
                <th className="rounded-tl-[var(--radius-md)] px-3 py-2.5 font-medium">
                  Código
                </th>
                <th className="px-3 py-2.5 font-medium">Nombre</th>
                <th className="px-3 py-2.5 font-medium">Vigencia</th>
                <th className="px-3 py-2.5 font-medium">Aplica a</th>
                <th className="rounded-tr-[var(--radius-md)] px-3 py-2.5 font-medium">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-[var(--color-nachipa-secondary)]"
                  >
                    No hay capacitaciones.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-tremor-border)]"
                  >
                    <td className="px-3 py-2.5 font-semibold text-[var(--color-nachipa-title)]">
                      {row.code}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-title)]">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-secondary)]">
                      {row.validityMonths != null
                        ? `${row.validityMonths} meses`
                        : "Sin vencimiento"}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-secondary)]">
                      {appliesToLabel(row.appliesTo)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={row.active ? "success" : "neutral"}>
                        {row.active ? "Activo" : "Inactivo"}
                      </StatusChip>
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
