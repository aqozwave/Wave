import { useCallback, useEffect, useMemo, useState } from "react";
import { FileStack } from "lucide-react";
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
import {
  listPermitTypesRequest,
  type PermitCriticality,
  type PermitType,
} from "../../lib/api/permitTypes";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Etiqueta de criticidad para chip. */
function criticalityLabel(c: PermitCriticality): string {
  if (c === "high") return "Alta";
  if (c === "medium") return "Media";
  return "Baja";
}

/** Tono del chip según criticidad. */
function criticalityTone(
  c: PermitCriticality,
): "danger" | "warning" | "neutral" {
  if (c === "high") return "danger";
  if (c === "medium") return "warning";
  return "neutral";
}

/**
 * Listado de tipos de permiso (P1 / P14).
 * Click en fila → ficha con exigencias y checklist.
 */
export function PermitTypesPage() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<PermitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listPermitTypesRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar tipos de permiso",
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
        breadcrumbIcon={FileStack}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Tipos de permiso" },
          ]}
          title="Tipos de permiso"
          description="Catálogo por empresa. Abrí un tipo para ver exigencias y checklist."
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
                  : `${total} ${total === 1 ? "tipo" : "tipos"}`
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
                <th className="px-3 py-2.5 font-medium">Criticidad</th>
                <th className="px-3 py-2.5 font-medium">AST</th>
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
                    No hay tipos de permiso.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/prevencion/tipos/${row.id}`}
                        className="font-semibold text-[var(--color-nachipa-primary)] hover:underline"
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-title)]">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={criticalityTone(row.criticality)}>
                        {criticalityLabel(row.criticality)}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-secondary)]">
                      {row.requiresAst ? (row.astMode ?? "sí") : "No"}
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
