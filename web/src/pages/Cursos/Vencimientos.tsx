import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AlertTriangle, GraduationCap } from "lucide-react";
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
import {
  TablePagination,
  useClientTablePagination,
} from "../../components/TablePagination/TablePagination";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  listExpiringCrewMemberCoursesRequest,
  type ExpiringCrewMemberCourse,
  type ExpiryStatusFilter,
} from "../../lib/api/crewMemberCourses";
import {
  listCrewMembersRequest,
  type CrewMember,
} from "../../lib/api/crewMembers";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import {
  boardingBookStateLabel,
  daysUntilBoardingBookExpiry,
  formatBoardingBookDate,
  getBoardingBookUiState,
  type BoardingBookUiState,
} from "../../lib/boardingBook";

/** Tabs de la pantalla (portal viejo LibretasEmbarquePage). */
type VencimientosTab = "libretas" | "cursos";

/** Filtros de estado compartidos. */
const STATUS_FILTERS: Array<{ value: ExpiryStatusFilter; label: string }> = [
  { value: "attention", label: "Vencidas + por vencer" },
  { value: "expired", label: "Vencidas" },
  { value: "expiring_soon", label: "Por vencer" },
];

/** Lee tab desde URL. */
function readTab(params: URLSearchParams): VencimientosTab {
  return params.get("tab") === "cursos" ? "cursos" : "libretas";
}

/** Lee filtro de estado desde URL. */
function readStatus(params: URLSearchParams): ExpiryStatusFilter {
  const value = params.get("status");
  if (value === "expired" || value === "expiring_soon" || value === "attention") {
    return value;
  }
  return "attention";
}

/** Tono del chip según estado de libreta. */
function bookTone(state: BoardingBookUiState): StatusChipTone {
  if (state === "vigente") return "success";
  if (state === "por_vencer") return "warning";
  return "danger";
}

/** Tono del chip según estado de curso. */
function courseTone(
  status: ExpiringCrewMemberCourse["status"],
): StatusChipTone {
  if (status === "expired") return "danger";
  if (status === "expiring_soon") return "warning";
  return "info";
}

/** Etiqueta de estado de curso. */
function courseStatusLabel(
  status: ExpiringCrewMemberCourse["status"],
): string {
  if (status === "expired") return "Vencido";
  if (status === "expiring_soon") return "Por vencer";
  return status;
}

/** Nombre completo. */
function personName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * ¿La libreta entra en el filtro de estado?
 * attention = vencido + por_vencer.
 */
function matchesBookFilter(
  state: BoardingBookUiState,
  filter: ExpiryStatusFilter,
): boolean {
  if (filter === "expired") return state === "vencido";
  if (filter === "expiring_soon") return state === "por_vencer";
  return state === "vencido" || state === "por_vencer";
}

/**
 * Vencimientos: libretas de embarque + cursos OMI por vencer/vencidos.
 * Ruta: /cursos/vencimientos
 */
export function Vencimientos() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = readTab(searchParams);
  const statusFilter = readStatus(searchParams);
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("q") ?? "",
  );
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");

  const [loading, setLoading] = useState(true);
  const [crewRows, setCrewRows] = useState<CrewMember[]>([]);
  const [courseRows, setCourseRows] = useState<ExpiringCrewMemberCourse[]>([]);
  const [courseTotal, setCourseTotal] = useState(0);
  const [coursePage, setCoursePage] = useState(1);
  const [coursePageSize, setCoursePageSize] = useState(25);
  const [warningDays, setWarningDays] = useState(30);

  /** Sincroniza query string. */
  function patchUrl(patch: {
    tab?: VencimientosTab;
    status?: ExpiryStatusFilter;
    q?: string;
  }) {
    const next = new URLSearchParams(searchParams);
    const merged = {
      tab,
      status: statusFilter,
      q: search,
      ...patch,
    };
    if (merged.tab === "cursos") next.set("tab", "cursos");
    else next.delete("tab");
    if (merged.status !== "attention") next.set("status", merged.status);
    else next.delete("status");
    if (merged.q.trim()) next.set("q", merged.q.trim());
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }

  /** Carga libretas (tripulantes) o cursos según tab. */
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      if (tab === "libretas") {
        const res = await listCrewMembersRequest(accessToken, {
          page: 1,
          limit: 100,
          includeInactive: false,
          search: search || undefined,
        });
        setCrewRows(res.items);
      } else {
        const res = await listExpiringCrewMemberCoursesRequest(accessToken, {
          page: coursePage,
          limit: coursePageSize,
          status: statusFilter,
          search: search || undefined,
        });
        setCourseRows(res.items);
        setCourseTotal(res.total);
        setWarningDays(res.warningDays);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los vencimientos",
        "danger",
      );
      setCrewRows([]);
      setCourseRows([]);
      setCourseTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    coursePage,
    coursePageSize,
    search,
    showToast,
    statusFilter,
    tab,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Libretas filtradas por estado de vigencia. */
  const filteredBooks = useMemo(() => {
    return crewRows.filter((row) => {
      const state = getBoardingBookUiState(row.boardingBookValidUntil);
      return matchesBookFilter(state, statusFilter);
    });
  }, [crewRows, statusFilter]);

  const {
    pageItems: bookPageItems,
    page: bookPage,
    pageCount: bookPageCount,
    pageSize: bookPageSize,
    setPage: setBookPage,
    setPageSize: setBookPageSize,
    total: bookTotal,
  } = useClientTablePagination(filteredBooks);

  const coursePageCount = Math.max(1, Math.ceil(courseTotal / coursePageSize));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Vencimientos"
        breadcrumbIcon={AlertTriangle}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Cursos", to: "/cursos" },
            { label: "Vencimientos" },
          ]}
          title="Vencimientos"
          description="Libretas de embarque y cursos OMI vencidos o por vencer. Abrí la ficha del tripulante para corregir fechas."
        />

        <div
          className="flex shrink-0 flex-wrap gap-1.5"
          role="tablist"
          aria-label="Tipo de vencimiento"
        >
          {(
            [
              { id: "libretas" as const, label: "Libretas" },
              { id: "cursos" as const, label: "Cursos" },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  patchUrl({ tab: t.id });
                  setCoursePage(1);
                  setBookPage(1);
                }}
                className={[
                  "inline-flex h-9 items-center rounded-[var(--radius-md)] px-3.5 text-[13px] font-medium",
                  active
                    ? "bg-[var(--color-nachipa-tab,#f4f4f5)] text-[var(--color-nachipa-title)]"
                    : "text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-nachipa-bg-page)]",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <DataTableCard
          toolbar={
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <label className="flex min-w-[200px] flex-col gap-1 text-[12px] text-[var(--color-nachipa-secondary)]">
                Estado
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    patchUrl({
                      status: e.target.value as ExpiryStatusFilter,
                    });
                    setCoursePage(1);
                    setBookPage(1);
                  }}
                  className="h-9 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[13px] text-[var(--color-nachipa-title)]"
                >
                  {STATUS_FILTERS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
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
                  setCoursePage(1);
                  setBookPage(1);
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
              {tab === "cursos" ? (
                <p className="text-[12px] text-[var(--color-nachipa-secondary)] lg:ml-auto">
                  Por vencer ≤ {warningDays} d
                </p>
              ) : null}
            </div>
          }
          footer={
            tab === "libretas" ? (
              <TablePagination
                totalLabel={
                  loading ? "Cargando…" : `${bookTotal} libretas`
                }
                page={bookPage}
                pageCount={bookPageCount}
                pageSize={bookPageSize}
                onPageChange={setBookPage}
                onPageSizeChange={setBookPageSize}
              />
            ) : (
              <TablePagination
                totalLabel={
                  loading ? "Cargando…" : `${courseTotal} cursos`
                }
                page={coursePage}
                pageCount={coursePageCount}
                pageSize={coursePageSize}
                onPageChange={setCoursePage}
                onPageSizeChange={(size) => {
                  setCoursePageSize(size);
                  setCoursePage(1);
                }}
              />
            )
          }
        >
          {tab === "libretas" ? (
            <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
              <thead>
                <tr>
                  <TableHeaderCell rounded="left">Tripulante</TableHeaderCell>
                  <TableHeaderCell>RUN</TableHeaderCell>
                  <TableHeaderCell>Vigencia</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell rounded="right" align="right">
                    Acciones
                  </TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {!loading && bookPageItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      No hay libretas en este filtro.
                    </td>
                  </tr>
                ) : null}
                {bookPageItems.map((row) => {
                  const state = getBoardingBookUiState(
                    row.boardingBookValidUntil,
                  );
                  const days = daysUntilBoardingBookExpiry(
                    row.boardingBookValidUntil,
                  );
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-tremor-border)] last:border-b-0 hover:bg-[var(--color-nachipa-bg-page)]"
                    >
                      <td className="h-[52px] px-3 font-medium text-[var(--color-nachipa-title)]">
                        {personName(row.firstName, row.lastName)}
                      </td>
                      <td className="h-[52px] px-3 tabular-nums text-[var(--color-nachipa-body)]">
                        {row.run}
                      </td>
                      <td className="h-[52px] px-3 text-[var(--color-nachipa-body)]">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {formatBoardingBookDate(row.boardingBookValidUntil)}
                          </span>
                          {days !== null ? (
                            <span className="text-[11px] text-[var(--color-nachipa-secondary)]">
                              {days < 0
                                ? `Venció hace ${Math.abs(days)} d`
                                : `Vence en ${days} d`}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="h-[52px] px-3">
                        <StatusChip tone={bookTone(state)}>
                          {boardingBookStateLabel(state)}
                        </StatusChip>
                      </td>
                      <td className="h-[52px] px-3 text-right">
                        <Link
                          to={`/embarcados/${row.id}`}
                          className="text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                        >
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[960px] border-collapse text-left text-[12px]">
              <thead>
                <tr>
                  <TableHeaderCell rounded="left">Tripulante</TableHeaderCell>
                  <TableHeaderCell>Curso</TableHeaderCell>
                  <TableHeaderCell>Vence</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell rounded="right" align="right">
                    Acciones
                  </TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {!loading && courseRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      No hay cursos en este filtro.
                    </td>
                  </tr>
                ) : null}
                {courseRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-tremor-border)] last:border-b-0 hover:bg-[var(--color-nachipa-bg-page)]"
                  >
                    <td className="h-[52px] px-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[var(--color-nachipa-title)]">
                          {personName(row.crew.firstName, row.crew.lastName)}
                        </span>
                        <span className="tabular-nums text-[11px] text-[var(--color-nachipa-secondary)]">
                          {row.crew.run}
                        </span>
                      </div>
                    </td>
                    <td className="h-[52px] max-w-[240px] truncate px-3 text-[var(--color-nachipa-body)]">
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap
                          className="size-3.5 shrink-0 text-[var(--color-nachipa-secondary)]"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        {row.courseName}
                        {row.isMandatory ? (
                          <span className="rounded-full bg-[var(--color-nachipa-bg-page)] px-1.5 py-0.5 text-[10px] text-[var(--color-nachipa-secondary)]">
                            Obl.
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="h-[52px] px-3 text-[var(--color-nachipa-body)]">
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {row.expiresAt
                            ? formatBoardingBookDate(row.expiresAt)
                            : "—"}
                        </span>
                        {row.daysUntilExpiry !== null ? (
                          <span className="text-[11px] text-[var(--color-nachipa-secondary)]">
                            {row.daysUntilExpiry < 0
                              ? `Venció hace ${Math.abs(row.daysUntilExpiry)} d`
                              : `Vence en ${row.daysUntilExpiry} d`}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="h-[52px] px-3">
                      <StatusChip tone={courseTone(row.status)}>
                        {courseStatusLabel(row.status)}
                      </StatusChip>
                    </td>
                    <td className="h-[52px] px-3 text-right">
                      <Link
                        to={`/embarcados/${row.crewMemberId}`}
                        className="text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                      >
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataTableCard>
      </div>
    </div>
  );
}
