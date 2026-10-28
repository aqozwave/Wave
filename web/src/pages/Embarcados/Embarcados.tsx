import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, MoreVertical, Plus, Search, Ship } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { Button } from "../../components/Button/Button";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { listAreasRequest, type Area } from "../../lib/api/areas";
import {
  listCompetencyCertificatesRequest,
  type CompetencyCertificate,
} from "../../lib/api/competencyCertificates";
import {
  listCrewMembersRequest,
  type CrewMember,
} from "../../lib/api/crewMembers";
import { listLocationsRequest, type Location } from "../../lib/api/locations";
import {
  boardingBookStateLabel,
  daysUntilBoardingBookExpiry,
  formatBoardingBookDate,
  getBoardingBookUiState,
  type BoardingBookTab,
  type BoardingBookUiState,
} from "../../lib/boardingBook";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Filas por página (Figma: 10). */
const PAGE_SIZE = 10;

/** Capitaliza palabras para tabla. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Nombre completo. */
function fullName(row: CrewMember): string {
  return `${displayName(row.firstName)} ${displayName(row.lastName)}`.trim();
}

/** Iniciales del avatar. */
function initialsOf(row: CrewMember): string {
  const a = row.firstName.trim().charAt(0);
  const b = row.lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/** Clases del chip de vigencia libro. */
function vigenciaChipClass(state: BoardingBookUiState): string {
  if (state === "vigente") {
    return "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]";
  }
  if (state === "por_vencer") {
    return "bg-[var(--color-status-warning-bg,#ffedd5)] text-[var(--color-status-warning-fg,#c2410c)]";
  }
  return "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]";
}

/**
 * Embarcados — lista operativa (Figma D2 · Embarcados).
 * Cumplimiento de cursos: placeholder hasta Sección 8.
 */
export function Embarcados() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<BoardingBookTab>("all");
  const [stateFilter, setStateFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [certs, setCerts] = useState<CompetencyCertificate[]>([]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [crew, locs, areaList, certList] = await Promise.all([
        // API max limit = 100 (Zod); 94 migrados caben en una página.
        listCrewMembersRequest(accessToken, {
          page: 1,
          limit: 100,
          includeInactive: true,
        }),
        listLocationsRequest(accessToken),
        listAreasRequest(accessToken),
        listCompetencyCertificatesRequest(accessToken),
      ]);
      setItems(crew.items);
      setLocations(locs.items);
      setAreas(areaList.items);
      setCerts(certList.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los embarcados.",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const locationName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locations) m.set(l.id, l.name);
    return m;
  }, [locations]);

  const areaName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areas) m.set(a.id, a.name);
    return m;
  }, [areas]);

  const certName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of certs) m.set(c.id, c.name);
    return m;
  }, [certs]);

  /** Conteos de tabs de vigencia. */
  const tabCounts = useMemo(() => {
    let vigente = 0;
    let porVencer = 0;
    let vencido = 0;
    for (const row of items) {
      const s = getBoardingBookUiState(row.boardingBookValidUntil);
      if (s === "vigente") vigente += 1;
      else if (s === "por_vencer") porVencer += 1;
      else vencido += 1;
    }
    return { all: items.length, vigente, por_vencer: porVencer, vencido };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (stateFilter === "active" && !row.state) return false;
      if (stateFilter === "inactive" && row.state) return false;
      if (tab !== "all") {
        const s = getBoardingBookUiState(row.boardingBookValidUntil);
        if (tab === "vigente" && s !== "vigente") return false;
        if (tab === "por_vencer" && s !== "por_vencer") return false;
        if (tab === "vencido" && s !== "vencido") return false;
      }
      if (!q) return true;
      const hay = `${row.firstName} ${row.lastName} ${row.run} ${row.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, tab, stateFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, tab, stateFilter]);

  const tabs: { id: BoardingBookTab; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: tabCounts.all },
    { id: "vigente", label: "Vigentes", count: tabCounts.vigente },
    { id: "por_vencer", label: "Por vencer", count: tabCounts.por_vencer },
    { id: "vencido", label: "Vencidos", count: tabCounts.vencido },
  ];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb="Embarcados"
        breadcrumbIcon={Ship}
        actions={<UserMenu />}
      />

      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden pb-6 pl-8 pr-8 pt-6">
        <PageHeader
          crumbs={[{ label: "Tripulación" }, { label: "Embarcados" }]}
          title="Embarcados"
          description="Personal a bordo de tus naves. El cumplimiento cuenta solo los cursos que exige su título marítimo."
        />

        {/* Tabs vigencia (Figma). */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px]",
                  active
                    ? "bg-[var(--color-status-info-bg,#e0f2fe)] font-medium text-[var(--color-nachipa-primary)]"
                    : "bg-white font-normal text-[var(--color-nachipa-secondary)] ring-1 ring-[var(--color-tremor-border)] hover:bg-[var(--color-nachipa-bg-page)]",
                ].join(" ")}
              >
                {t.label}
                <span
                  className={[
                    "rounded-full px-1.5 text-[11px] font-medium",
                    active
                      ? "bg-white/80 text-[var(--color-nachipa-primary)]"
                      : "bg-[var(--color-nachipa-bg-page)] text-[var(--color-nachipa-secondary)]",
                  ].join(" ")}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-tremor-border)] bg-white">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-tremor-border)] px-4 py-3">
            <label className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3">
              <Search
                className="size-3.5 shrink-0 text-[var(--color-icon-default)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar embarcado"
                className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
              />
            </label>
            <select
              className="h-8 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2 text-[12px] text-[var(--color-nachipa-body)]"
              value={stateFilter}
              onChange={(e) =>
                setStateFilter(e.target.value as "all" | "active" | "inactive")
              }
            >
              <option value="all">Estado: todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3 text-[12px] text-[var(--color-nachipa-title)]"
              disabled
              title="Próximamente"
            >
              <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
              Exportar
            </button>
            <Button
              type="button"
              size="small"
              className="!w-auto"
              onClick={() =>
                showToast(
                  "Alta desde ficha: usá Bruno o el modal lo traemos en el siguiente paso.",
                  "info",
                )
              }
            >
              <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
              Agregar embarcado
            </Button>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-semibold text-[var(--color-table-head-text,#6b6b73)]">
                  <th className="h-9 w-12 border-b border-[var(--color-tremor-border)] px-3" />
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Nombre
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Estado
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Vigencia libro
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Título marítimo
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Nave
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Área
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Cumplimiento
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && pageItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      No hay embarcados para mostrar.
                    </td>
                  </tr>
                ) : null}
                {pageItems.map((row) => {
                  const bookState = getBoardingBookUiState(
                    row.boardingBookValidUntil,
                  );
                  const daysLeft = daysUntilBoardingBookExpiry(
                    row.boardingBookValidUntil,
                  );
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--color-nachipa-border-subtle)] hover:bg-[var(--color-nachipa-bg-page)]"
                    >
                      <td className="h-[52px] px-3">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-[var(--color-tremor-border)]"
                          aria-label={`Seleccionar ${fullName(row)}`}
                        />
                      </td>
                      <td className="h-[52px] px-3">
                        <Link
                          to={`/embarcados/${row.id}`}
                          className="flex max-w-[280px] items-center gap-2.5"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-info-bg)] text-[11px] font-semibold text-[var(--color-status-info-fg)]">
                            {initialsOf(row)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[var(--color-nachipa-primary)] hover:underline">
                              {fullName(row)}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--color-nachipa-secondary)]">
                              {row.run}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="h-[52px] px-3">
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium",
                            row.state
                              ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]"
                              : "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]",
                          ].join(" ")}
                        >
                          {row.state ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="h-[52px] px-3">
                        <div className="text-[var(--color-nachipa-body)]">
                          {formatBoardingBookDate(row.boardingBookValidUntil)}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={[
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                              vigenciaChipClass(bookState),
                            ].join(" ")}
                          >
                            {boardingBookStateLabel(bookState)}
                          </span>
                          {daysLeft !== null ? (
                            <span className="text-[11px] text-[var(--color-nachipa-secondary)]">
                              {daysLeft < 0
                                ? `Venció hace ${Math.abs(daysLeft)} d`
                                : `Vence en ${daysLeft} d`}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="h-[52px] max-w-[220px] truncate px-3 text-[var(--color-nachipa-body)]">
                        {row.competencyCertificateId
                          ? displayName(
                              certName.get(row.competencyCertificateId) ?? "—",
                            )
                          : "—"}
                      </td>
                      <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                        {displayName(
                          locationName.get(row.locationId) ?? "—",
                        )}
                      </td>
                      <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                        {row.areaId
                          ? displayName(areaName.get(row.areaId) ?? "—")
                          : "—"}
                      </td>
                      <td className="h-[52px] px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-[90px] overflow-hidden rounded-full bg-[var(--color-nachipa-border-subtle)]">
                            <div className="h-full w-0 rounded-full bg-[var(--color-nachipa-secondary)]" />
                          </div>
                          <span className="text-[11px] tabular-nums text-[var(--color-nachipa-secondary)]">
                            —
                          </span>
                        </div>
                      </td>
                      <td className="relative h-[52px] px-3 text-right">
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-icon-default)] hover:bg-[var(--color-nachipa-bg-page)]"
                          aria-label="Acciones"
                          onClick={() =>
                            setMenuId((id) => (id === row.id ? null : row.id))
                          }
                        >
                          <MoreVertical
                            className="size-[18px]"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </button>
                        {menuId === row.id ? (
                          <div className="absolute right-3 top-11 z-10 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                              onClick={() => {
                                setMenuId(null);
                                void navigate(`/embarcados/${row.id}`);
                              }}
                            >
                              Ver ficha
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex h-12 shrink-0 items-center justify-between border-t border-[var(--color-nachipa-border-subtle)] px-4">
            <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
              {loading
                ? "Cargando…"
                : `Total embarcados: ${filtered.length}`}
            </p>
            <div className="flex items-center gap-3 text-[12px] text-[var(--color-nachipa-title)]">
              <span>Ítems por página {PAGE_SIZE}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded px-2 py-1 hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-40"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                <span className="tabular-nums">
                  {safePage} / {pageCount}
                </span>
                <button
                  type="button"
                  className="rounded px-2 py-1 hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-40"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
