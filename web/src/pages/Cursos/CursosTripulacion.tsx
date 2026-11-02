import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ClipboardList } from "lucide-react";
import {
  DataTableCard,
  DataTableSearch,
} from "../../components/DataTableCard/DataTableCard";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import {
  StatusChip,
  type StatusChipTone,
} from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import { TablePagination } from "../../components/TablePagination/TablePagination";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  listExpiringCrewMemberCoursesRequest,
  type CrewCourseStatus,
  type ExpiringCrewMemberCourse,
  type ExpiryStatusFilter,
} from "../../lib/api/crewMemberCourses";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Filtros de estado de la matriz (incluye “Todos”). */
const STATUS_FILTERS: Array<{ value: ExpiryStatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "valid", label: "Vigentes" },
  { value: "expiring_soon", label: "Por vencer" },
  { value: "expired", label: "Vencidos" },
];

/** Lee filtro de estado desde URL (default all). */
function readStatus(params: URLSearchParams): ExpiryStatusFilter {
  const value = params.get("status");
  if (
    value === "all" ||
    value === "pending" ||
    value === "valid" ||
    value === "expired" ||
    value === "expiring_soon"
  ) {
    return value;
  }
  return "all";
}

/** Tono del chip según status de curso. */
function courseTone(status: CrewCourseStatus): StatusChipTone {
  if (status === "valid") return "success";
  if (status === "expiring_soon") return "warning";
  if (status === "expired") return "danger";
  return "neutral";
}

/** Etiqueta de status. */
function courseStatusLabel(status: CrewCourseStatus): string {
  if (status === "valid") return "Vigente";
  if (status === "expiring_soon") return "Por vencer";
  if (status === "expired") return "Vencido";
  return "Pendiente";
}

/** Origen legible. */
function sourceLabel(source: ExpiringCrewMemberCourse["source"]): string {
  if (source === "certificate") return "Título";
  if (source === "rank") return "Cargo";
  return "Manual";
}

/** Nombre completo. */
function personName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/** Fecha corta es-CL en UTC (solo día). */
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

/**
 * Vista masiva de asignaciones OMI por tripulante.
 * Portal viejo: CursosPorUsuarioPage. Ruta: /cursos/tripulacion
 */
export function CursosTripulacion() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = readStatus(searchParams);
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("q") ?? "",
  );
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExpiringCrewMemberCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  /** Sincroniza query string. */
  function patchUrl(patch: { status?: ExpiryStatusFilter; q?: string }) {
    const next = new URLSearchParams(searchParams);
    const merged = {
      status: statusFilter,
      q: search,
      ...patch,
    };
    if (merged.status !== "all") next.set("status", merged.status);
    else next.delete("status");
    if (merged.q.trim()) next.set("q", merged.q.trim());
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }

  /** Carga página del listado global. */
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await listExpiringCrewMemberCoursesRequest(accessToken, {
        page,
        limit: pageSize,
        status: statusFilter,
        search: search || undefined,
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los cursos de la tripulación",
        "danger",
      );
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, pageSize, search, showToast, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Cursos de la tripulación"
        breadcrumbIcon={ClipboardList}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Cursos", to: "/cursos" },
            { label: "Cursos de la tripulación" },
          ]}
          title="Cursos de la tripulación"
          description="Todas las asignaciones OMI por persona. Abrí la ficha para registrar fechas o corregir un curso."
        />

        <DataTableCard
          toolbar={
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <label className="flex min-w-[200px] flex-col gap-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                Estado
                <select
                  className="h-9 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-title)]"
                  value={statusFilter}
                  onChange={(e) => {
                    patchUrl({
                      status: e.target.value as ExpiryStatusFilter,
                    });
                    setPage(1);
                  }}
                >
                  {STATUS_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <form
                className="flex min-w-[220px] flex-1 items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(searchInput.trim());
                  patchUrl({ q: searchInput.trim() });
                  setPage(1);
                }}
              >
                <div className="min-w-0 flex-1">
                  <DataTableSearch
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Buscar nombre, RUN o curso…"
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
              totalLabel={loading ? "Cargando…" : `${total} cursos`}
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-[var(--color-nachipa-table-header,#f4f4f5)]">
                  <TableHeaderCell>Tripulante</TableHeaderCell>
                  <TableHeaderCell>Curso</TableHeaderCell>
                  <TableHeaderCell>Origen</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Completado</TableHeaderCell>
                  <TableHeaderCell>Vence</TableHeaderCell>
                  <TableHeaderCell className="w-[88px]"> </TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[var(--color-nachipa-secondary)]"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[var(--color-nachipa-secondary)]"
                    >
                      No hay asignaciones con estos filtros.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--color-tremor-border)]"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--color-nachipa-title)]">
                          {personName(row.crew.firstName, row.crew.lastName)}
                        </div>
                        <div className="tabular-nums text-[12px] text-[var(--color-nachipa-secondary)]">
                          {row.crew.run}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-nachipa-title)]">
                        <span className="uppercase">{row.courseName}</span>
                        {row.isMandatory ? (
                          <span className="ml-2 text-[11px] text-[var(--color-nachipa-secondary)]">
                            Obl.
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-nachipa-secondary)]">
                        {sourceLabel(row.source)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip tone={courseTone(row.status)}>
                          {courseStatusLabel(row.status)}
                        </StatusChip>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--color-nachipa-secondary)]">
                        {formatDate(row.completedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="tabular-nums text-[var(--color-nachipa-title)]">
                          {formatDate(row.expiresAt)}
                        </div>
                        {row.daysUntilExpiry != null ? (
                          <div className="text-[11px] text-[var(--color-nachipa-secondary)]">
                            {row.daysUntilExpiry < 0
                              ? `Hace ${Math.abs(row.daysUntilExpiry)} d`
                              : `En ${row.daysUntilExpiry} d`}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/embarcados/${row.crewMemberId}`}
                          className="text-[13px] font-medium text-[var(--color-nachipa-accent,#004c8c)] hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DataTableCard>
      </div>
    </div>
  );
}
