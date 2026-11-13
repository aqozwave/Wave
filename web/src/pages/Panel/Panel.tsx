import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Download,
  Search,
  Ship,
} from "lucide-react";
import { Link } from "react-router";
import { SystemAnnouncementsBell } from "../../components/SystemAnnouncementsBell/SystemAnnouncementsBell";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  getDashboardSummaryRequest,
  type DashboardCapsuleColumn,
  type DashboardMonthlyCompliancePoint,
  type DashboardSummary,
  type DashboardUpcomingItem,
} from "../../lib/api/dashboard";
import { VesselLocationMap } from "../../components/VesselLocationMap/VesselLocationMap";
import { listLocationsRequest } from "../../lib/api/locations";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Valor del select “Todas las embarcaciones”. */
const VESSEL_FILTER_ALL = "";

/**
 * Panel global (Figma 133:4570).
 * KPIs, próximos vencimientos, cápsulas por nave/curso y lista de naves
 * vienen de GET /dashboard/summary, incluida la serie monthlyCompliance.
 */

/** Capitaliza el primer carácter (nombres del seed vienen en minúscula). */
function capitalizeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Iniciales a partir de nombre y apellido. */
function initialsOf(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/** Fecha corta es-CL (día calendario UTC). */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Etiqueta + tono del estado de vencimiento. */
function upcomingEstado(status: DashboardUpcomingItem["status"]): {
  label: string;
  tone: "danger" | "warning" | "neutral";
} {
  if (status === "expired") return { label: "Vencido", tone: "danger" };
  if (status === "pending") return { label: "Faltante", tone: "neutral" };
  return { label: "Por vencer", tone: "warning" };
}

/**
 * Texto corto del chip de variación KPI.
 * pp = puntos porcentuales; count = diferencia absoluta.
 */
function formatKpiDelta(
  delta: number,
  kind: "pp" | "count",
): string {
  const sign = delta > 0 ? "+" : "";
  if (kind === "pp") {
    return `${sign}${delta.toLocaleString("es-CL")} pp`;
  }
  return `${sign}${delta.toLocaleString("es-CL")}`;
}

/**
 * Escala mínima del plot Figma (8 unidades = 150px).
 * Si los datos superan 8, el eje crece al máximo real (ceil a par).
 */
const CAPSULE_MIN_MAX = 8;
/** Alto del área de barras (compacto para Panel sin scroll). */
const CAPSULE_PLOT_H = 110;
/** Ancho de cada cápsula en Figma. */
const CAPSULE_W = 12;

/** Umbral visual: debajo de esto la barra de nave se pinta “warn”. */
const VESSEL_WARN_BELOW_PCT = 90;

/** Convierte unidades del eje (0–scaleMax) a píxeles del plot. */
function capsulePx(units: number, scaleMax: number): number {
  if (scaleMax <= 0) return 0;
  return (units / scaleMax) * CAPSULE_PLOT_H;
}

/**
 * Escala del eje Y para una serie de cápsulas.
 * Mínimo 8 (Figma); si hay más, redondea al siguiente par ≥ max.
 */
function capsuleScaleMax(series: DashboardCapsuleColumn[]): number {
  let peak = 0;
  for (const col of series) {
    peak = Math.max(peak, col.soft, col.solid);
  }
  if (peak <= CAPSULE_MIN_MAX) return CAPSULE_MIN_MAX;
  return peak % 2 === 0 ? peak : peak + 1;
}

/** ViewBox del chart mensual (alineado al SVG Figma). */
const MONTHLY_CHART = {
  width: 590,
  height: 216,
  padLeft: 52,
  padRight: 12,
  padTop: 16,
  padBottom: 28,
} as const;

/**
 * Escala Y del chart: encuadra los % reales con un poco de margen.
 * Si no hay datos, deja 90–100 (rango típico del mock previo).
 */
function monthlyYScale(points: DashboardMonthlyCompliancePoint[]): {
  min: number;
  max: number;
  ticks: number[];
} {
  const values = points
    .map((p) => p.percent)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) {
    return { min: 90, max: 100, ticks: [100, 98, 96, 94, 92] };
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min = Math.max(0, min - 2);
    max = Math.min(100, max + 2);
  }
  const pad = Math.max(1, Math.ceil((max - min) * 0.15));
  min = Math.max(0, Math.floor(min - pad));
  max = Math.min(100, Math.ceil(max + pad));
  if (max - min < 4) {
    max = Math.min(100, min + 4);
  }
  const step = (max - min) / 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round(max - step * i));
  return { min, max, ticks };
}

/** Polilínea + último punto con valor para el badge. */
function monthlyPolyline(
  points: DashboardMonthlyCompliancePoint[],
  scale: { min: number; max: number },
): {
  pointsAttr: string;
  last: { x: number; y: number; label: string; percent: number } | null;
} {
  const { width, height, padLeft, padRight, padTop, padBottom } = MONTHLY_CHART;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const n = Math.max(points.length - 1, 1);
  const coords: Array<{ x: number; y: number; p: DashboardMonthlyCompliancePoint }> =
    [];

  points.forEach((p, i) => {
    if (p.percent == null) return;
    const x = padLeft + (plotW * i) / n;
    const t = (p.percent - scale.min) / (scale.max - scale.min || 1);
    const y = padTop + plotH * (1 - t);
    coords.push({ x, y, p });
  });

  if (coords.length === 0) {
    return { pointsAttr: "", last: null };
  }

  const last = coords[coords.length - 1]!;
  return {
    pointsAttr: coords.map((c) => `${c.x},${c.y}`).join(" "),
    last: {
      x: last.x,
      y: last.y,
      label: last.p.label,
      percent: last.p.percent!,
    },
  };
}

/**
 * Panel OMI alineado a Figma:
 * S1 superadmin (global) · D1 admin/empresa · C1 colaborador (mi nave).
 */
export function Panel() {
  const { user, accessToken } = useAuth();
  const welcomeName = user ? capitalizeName(user.firstName) : "usuario";
  const isLocationScope =
    user?.dataScope === "location" ||
    user?.internalRol === "colaborador" ||
    user?.internalRol === "user";
  const isGlobalScope =
    user?.internalRol === "superadmin" || user?.dataScope === "all";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  /** Filtro de embarcación (vacío = todas del alcance). */
  const [vesselFilter, setVesselFilter] = useState(VESSEL_FILTER_ALL);
  /** Opciones del select (naves visibles para el usuario). */
  const [vesselOptions, setVesselOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);

  /** ¿Mostrar el select? Solo si el rol no está ya fijado a una nave. */
  const showVesselFilter = !isLocationScope;

  /** Carga el resumen del dashboard (respeta filtro de nave). */
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardSummaryRequest(accessToken, {
        // 4 filas: el Panel debe caber en viewport sin scroll vertical.
        upcomingLimit: 4,
        vesselChartLimit: 4,
        courseChartLimit: 4,
        vesselListLimit: 4,
        locationId: vesselFilter || undefined,
      });
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar el panel",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, vesselFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Carga naves para el select (vessel; si no hay kind, todas activas). */
  useEffect(() => {
    if (!accessToken || !showVesselFilter) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await listLocationsRequest(
          accessToken,
          1,
          200,
          user?.businessId ?? undefined,
        );
        if (cancelled) return;
        const vessels = result.items.filter(
          (loc) => loc.state && (loc.kind === "vessel" || loc.kind == null),
        );
        const list =
          vessels.length > 0
            ? vessels
            : result.items.filter((loc) => loc.state);
        setVesselOptions(
          list
            .map((loc) => ({ id: loc.id, name: loc.name }))
            .sort((a, b) => a.name.localeCompare(b.name, "es")),
        );
      } catch {
        if (!cancelled) setVesselOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, showVesselFilter, user?.businessId]);

  const scopeKind = summary?.scope.kind;
  const locationScoped =
    scopeKind === "location" || (scopeKind == null && isLocationScope);
  const globalScoped =
    scopeKind === "global" || (scopeKind == null && isGlobalScope);

  /** Tres tarjetas KPI; delta de cumplimiento vs mes anterior (snapshots). */
  const kpis = useMemo(() => {
    const k = summary?.kpis;
    const horizon = k?.horizonDays ?? 60;
    const complianceLabel = locationScoped
      ? "Cumplimiento de la nave"
      : globalScoped
        ? "Cumplimiento global"
        : "Cumplimiento";
    const deltaPp = k?.deltas.compliancePercentPoints ?? null;
    return [
      {
        label: complianceLabel,
        value:
          k?.compliancePercent == null
            ? "—"
            : `${k.compliancePercent.toLocaleString("es-CL")} %`,
        icon: CheckCircle2,
        hint:
          k == null
            ? "cargando…"
            : `${k.crewCount} tripulantes activos`,
        delta: deltaPp,
        deltaKind: "pp" as const,
      },
      {
        label: `Vencen en ${horizon} días`,
        value: k == null ? "—" : String(k.expiringSoonCount),
        icon: AlertTriangle,
        hint: "cursos OMI por vencer",
        delta: k?.deltas.expiringSoonCount ?? null,
        deltaKind: "count" as const,
      },
      {
        label: locationScoped ? "Pendientes / vencidos" : "Vencidos o faltantes",
        value: k == null ? "—" : String(k.expiredOrMissingCount),
        icon: CircleAlert,
        hint: locationScoped
          ? "obligatorios vencidos o sin cursar"
          : "vencidos + pendientes obligatorios",
        delta: k?.deltas.expiredOrMissingCount ?? null,
        deltaKind: "count" as const,
      },
    ];
  }, [summary, locationScoped, globalScoped]);

  /** Subtítulo del header según alcance Figma. */
  const subtitle = useMemo(() => {
    if (locationScoped) {
      const nave =
        summary?.scope.locationName ?? user?.locationName ?? "tu nave";
      const n = summary?.kpis.crewCount;
      return n == null
        ? `${nave}`
        : `${nave} · ${n} tripulantes a bordo`;
    }
    if (globalScoped) {
      return "Cumplimiento de todas las empresas";
    }
    return "Cumplimiento de formación OMI";
  }, [locationScoped, globalScoped, summary, user?.locationName]);

  const chartTitleMonthly = locationScoped
    ? "Cumplimiento mensual de la nave"
    : "Cumplimiento mensual";

  const upcoming = summary?.upcoming ?? [];
  const byVessel = summary?.byVessel ?? [];
  const byCourse = summary?.byCourse ?? [];
  const vessels = summary?.vessels ?? [];
  const monthlyCompliance = summary?.monthlyCompliance ?? [];
  const monthlyScale = useMemo(
    () => monthlyYScale(monthlyCompliance),
    [monthlyCompliance],
  );
  const monthlyLine = useMemo(
    () => monthlyPolyline(monthlyCompliance, monthlyScale),
    [monthlyCompliance, monthlyScale],
  );
  /** En C1 no tiene sentido el chart “Por nave” (ya filtró a una). */
  const showVesselCapsule = !locationScoped;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-7 py-4">
      {/* Header encima del mapa Leaflet (panes z altos); evita que tape avisos/menú. */}
      <header className="relative z-40 flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-semibold leading-[26px] text-[var(--color-nachipa-title)]">
            {locationScoped
              ? summary?.scope.locationName ?? user?.locationName ?? "Mi nave"
              : `Bienvenido, ${welcomeName}`}
          </h1>
          <p className="text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
            {locationScoped ? (
              <>
                {welcomeName}
                {subtitle ? ` · ${subtitle}` : ""}
              </>
            ) : (
              subtitle
            )}
          </p>
        </div>

        {showVesselFilter ? (
          <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] pl-3 pr-2">
            <Ship
              size={14}
              strokeWidth={1.5}
              className="shrink-0 text-[var(--color-nav-icon)]"
              aria-hidden
            />
            <select
              value={vesselFilter}
              onChange={(e) => setVesselFilter(e.target.value)}
              aria-label="Filtrar por embarcación"
              className="max-w-[200px] bg-transparent text-[12px] leading-[18px] text-[var(--color-nachipa-title)] outline-none"
            >
              <option value={VESSEL_FILTER_ALL}>Todas las embarcaciones</option>
              {vesselOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex h-9 w-[200px] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] pl-3 pr-2.5">
          <input
            type="search"
            placeholder="Buscar…"
            className="w-full bg-transparent text-[12px] leading-[18px] text-[var(--color-nachipa-title)] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
          />
          <Search
            size={14}
            strokeWidth={1.5}
            className="shrink-0 text-[var(--color-nav-icon)]"
            aria-hidden
          />
        </label>

        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-[18px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] text-[var(--color-icon-default)]"
          aria-label="Ayuda"
        >
          <CircleHelp size={16} strokeWidth={1.5} aria-hidden />
        </button>

        <SystemAnnouncementsBell />

        <button
          type="button"
          className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-nachipa-primary)] px-4 text-[13px] font-semibold leading-[19px] text-white"
        >
          <Download size={18} strokeWidth={1.5} aria-hidden />
          Exportar resumen
        </button>

        <UserMenu />
      </header>

      {error ? (
        <p className="m-0 text-[13px] text-[var(--color-status-danger-fg)]">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex shrink-0 gap-3">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              const deltaLabel =
                kpi.delta == null
                  ? null
                  : formatKpiDelta(kpi.delta, kpi.deltaKind);
              // Cumplimiento: subir es bueno. Conteos de riesgo: bajar es bueno.
              const deltaGood =
                kpi.delta == null
                  ? null
                  : kpi.deltaKind === "pp"
                    ? kpi.delta >= 0
                    : kpi.delta <= 0;
              return (
                <div
                  key={kpi.label}
                  className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-[13px] font-medium leading-[19px] text-[var(--color-nachipa-body)]">
                      {kpi.label}
                    </p>
                    <Icon
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0 text-[var(--color-nav-icon)]"
                      aria-hidden
                    />
                  </div>
                  <p className="text-[24px] font-semibold leading-8 tracking-[-0.14px] text-[var(--color-nachipa-title)]">
                    {loading ? "…" : kpi.value}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                      {kpi.hint}
                    </p>
                    {deltaLabel && deltaGood != null ? (
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
                          deltaGood
                            ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]"
                            : "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]",
                        ].join(" ")}
                      >
                        {deltaLabel} vs mes ant.
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="shrink-0 rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-[21px] text-[var(--color-nachipa-title)]">
                {chartTitleMonthly}
              </h2>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-[var(--color-tremor-border)] px-2.5 py-[5px] text-[12px] font-medium leading-4 text-[var(--color-nachipa-body)]"
              >
                Mensual
                <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
            <div className="relative h-[140px] w-full">
              {loading && monthlyCompliance.length === 0 ? (
                <p className="flex h-full items-center justify-center text-[13px] text-[var(--color-nachipa-secondary)]">
                  Cargando serie…
                </p>
              ) : monthlyLine.pointsAttr === "" ? (
                <p className="flex h-full items-center justify-center text-[13px] text-[var(--color-nachipa-secondary)]">
                  Sin historial aún. El mes actual se guarda al cargar el Panel.
                </p>
              ) : (
                <>
                  <svg
                    viewBox={`0 0 ${MONTHLY_CHART.width} ${MONTHLY_CHART.height}`}
                    className="size-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={chartTitleMonthly}
                  >
                    {monthlyScale.ticks.map((tick, i) => {
                      const t =
                        (tick - monthlyScale.min) /
                        (monthlyScale.max - monthlyScale.min || 1);
                      const y =
                        MONTHLY_CHART.padTop +
                        (MONTHLY_CHART.height -
                          MONTHLY_CHART.padTop -
                          MONTHLY_CHART.padBottom) *
                          (1 - t);
                      return (
                        <line
                          key={`grid-${i}`}
                          x1={40}
                          x2={MONTHLY_CHART.width}
                          y1={y}
                          y2={y}
                          stroke="var(--color-chart-grid)"
                          strokeWidth="1"
                        />
                      );
                    })}
                    <polyline
                      fill="none"
                      stroke="var(--color-chart-primary)"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={monthlyLine.pointsAttr}
                    />
                    {monthlyLine.last ? (
                      <circle
                        cx={monthlyLine.last.x}
                        cy={monthlyLine.last.y}
                        r="5"
                        fill="var(--color-chart-primary)"
                      />
                    ) : null}
                  </svg>
                  {monthlyLine.last ? (
                    <div
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-[var(--color-chart-primary-soft)] px-2 py-[3px] text-[12px] font-medium leading-4 text-[var(--color-nachipa-primary)]"
                      style={{
                        left: `${(monthlyLine.last.x / MONTHLY_CHART.width) * 100}%`,
                        top: `${(monthlyLine.last.y / MONTHLY_CHART.height) * 100}%`,
                        marginTop: "-6px",
                      }}
                    >
                      {monthlyLine.last.label} ·{" "}
                      {monthlyLine.last.percent.toLocaleString("es-CL")} %
                    </div>
                  ) : null}
                  <div className="absolute inset-y-0 left-0 flex w-8 flex-col justify-between py-1 text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                    {monthlyScale.ticks.map((tick) => (
                      <span key={tick}>{tick}%</span>
                    ))}
                  </div>
                  <div className="absolute bottom-0 left-10 right-0 flex justify-between text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                    {monthlyCompliance.map((m) => (
                      <span key={m.periodMonth} className="w-10 text-center">
                        {m.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-3.5">
            <div className="mb-1.5 flex shrink-0 items-center gap-2">
              <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-[21px] text-[var(--color-nachipa-title)]">
                Próximos vencimientos
              </h2>
              <Link
                to="/cursos/vencimientos"
                className="text-[13px] font-semibold leading-[19px] text-[var(--color-nachipa-primary)]"
              >
                Ver todos
              </Link>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg">
              <div className="grid grid-cols-[1.6fr_0.9fr_0.7fr_0.7fr] bg-[var(--color-table-head-bg)] text-[12px] font-medium leading-4 text-[var(--color-table-head-text)]">
                <div className="px-3 py-1.5">Tripulante</div>
                <div className="px-3 py-1.5">Curso</div>
                <div className="px-3 py-1.5">Vence</div>
                <div className="px-3 py-1.5">Estado</div>
              </div>
              {loading && upcoming.length === 0 ? (
                <p className="m-0 px-3 py-3 text-[12px] text-[var(--color-nachipa-secondary)]">
                  Cargando…
                </p>
              ) : null}
              {!loading && upcoming.length === 0 ? (
                <p className="m-0 px-3 py-3 text-[12px] text-[var(--color-nachipa-secondary)]">
                  Sin vencimientos próximos en la ventana.
                </p>
              ) : null}
              {upcoming.map((row) => {
                const estado = upcomingEstado(row.status);
                const fullName = `${capitalizeName(row.crewFirstName)} ${capitalizeName(row.crewLastName)}`.trim();
                return (
                  <div
                    key={row.assignmentId}
                    className="grid grid-cols-[1.6fr_0.9fr_0.7fr_0.7fr] border-b border-[var(--color-nachipa-border-subtle)] text-[12px] last:border-b-0"
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-kpi-indigo-soft)] text-[11px] font-semibold text-[var(--color-kpi-indigo)]">
                        {initialsOf(row.crewFirstName, row.crewLastName)}
                      </span>
                      <span className="truncate font-medium text-[var(--color-nachipa-title)]">
                        {fullName || row.crewRun}
                      </span>
                    </div>
                    <div className="flex items-center truncate px-3 py-1.5 text-[var(--color-nachipa-body)]">
                      {row.courseName}
                    </div>
                    <div className="flex items-center px-3 py-1.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDate(row.expiresAt)}
                    </div>
                    <div className="flex items-center px-3 py-1.5">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          estado.tone === "danger"
                            ? "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]"
                            : estado.tone === "warning"
                              ? "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-fg)]"
                              : "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral-fg)]",
                        ].join(" ")}
                      >
                        {estado.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex w-[min(460px,40%)] shrink-0 flex-col gap-3 overflow-hidden">
          <div
            className={[
              "grid shrink-0 gap-3",
              showVesselCapsule ? "grid-cols-2" : "grid-cols-1",
            ].join(" ")}
          >
            {(
              [
                ...(showVesselCapsule
                  ? [{ title: "Por nave", series: byVessel }]
                  : []),
                { title: "Por curso", series: byCourse },
              ] as const
            ).map((chart) => {
              const scaleMax = capsuleScaleMax(chart.series);
              const mid = scaleMax / 2;
              return (
                <div
                  key={chart.title}
                  className="flex flex-col gap-1.5 overflow-hidden rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-[15px] font-semibold leading-[21px] text-[var(--color-nachipa-title)]">
                      {chart.title}
                    </p>
                    <button
                      type="button"
                      className="shrink-0 text-[13px] font-semibold leading-[19px] text-[var(--color-nachipa-primary)]"
                    >
                      Ver
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                      <span
                        className="size-[7px] rounded-full bg-[var(--color-chart-primary-soft)]"
                        aria-hidden
                      />
                      31–60 d
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                      <span
                        className="size-[7px] rounded-full bg-[var(--color-chart-primary)]"
                        aria-hidden
                      />
                      0–30 d
                    </span>
                  </div>

                  {/* Plot · cápsulas: soft detrás + solid delante, mismo baseline. */}
                  <div className="relative h-[132px] w-full">
                    <div
                      className="absolute left-6 right-0 top-0 h-px bg-[var(--color-chart-grid)]"
                      aria-hidden
                    />
                    <div
                      className="absolute left-6 right-0 top-[55px] h-px bg-[var(--color-chart-grid)]"
                      aria-hidden
                    />
                    <div
                      className="absolute left-6 right-0 top-[110px] h-px bg-[var(--color-chart-grid)]"
                      aria-hidden
                    />
                    <span className="absolute left-0 top-[-8px] w-[18px] text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                      {scaleMax}
                    </span>
                    <span className="absolute left-0 top-[47px] w-[18px] text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                      {mid}
                    </span>
                    <span className="absolute left-0 top-[102px] w-[18px] text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                      0
                    </span>

                    {loading && chart.series.length === 0 ? (
                      <p className="absolute inset-x-6 top-12 m-0 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                        Cargando…
                      </p>
                    ) : null}
                    {!loading && chart.series.length === 0 ? (
                      <p className="absolute inset-x-6 top-12 m-0 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                        Sin datos en 60 d
                      </p>
                    ) : null}

                    <div className="absolute bottom-[18px] left-6 right-0 flex h-[110px] items-end justify-between px-1">
                      {chart.series.map((col) => (
                        <div
                          key={col.id}
                          className="relative flex h-full w-6 flex-col items-center justify-end"
                          title={`${col.name}: ${col.solid} (0–30 d), ${col.soft} (31–60 d)`}
                        >
                          {col.soft > 0 ? (
                            <div
                              className="absolute bottom-0 rounded-[6px] bg-[var(--color-chart-primary-soft)]"
                              style={{
                                width: CAPSULE_W,
                                height: capsulePx(col.soft, scaleMax),
                              }}
                              aria-hidden
                            />
                          ) : null}
                          {col.solid > 0 ? (
                            <div
                              className="absolute bottom-0 rounded-[6px] bg-[var(--color-chart-primary)]"
                              style={{
                                width: CAPSULE_W,
                                height: capsulePx(col.solid, scaleMax),
                              }}
                              aria-hidden
                            />
                          ) : null}
                          <span className="absolute -bottom-5 text-center text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                            {col.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mapa: z-0 para que no compita con el header (avisos, UserMenu). */}
          {accessToken ? (
            <div className="relative z-0 flex min-h-0 flex-[1.65] flex-col overflow-hidden">
              <VesselLocationMap
                accessToken={accessToken}
                mode={
                  locationScoped || vesselFilter ? "single" : "fleet"
                }
                locationId={
                  locationScoped
                    ? (user?.locationId ?? null)
                    : vesselFilter || user?.locationId || null
                }
                locationName={
                  locationScoped
                    ? (user?.locationName ?? null)
                    : vesselOptions.find((v) => v.id === vesselFilter)?.name ??
                      user?.locationName ??
                      null
                }
                canReport={Boolean(
                  user?.locationId &&
                    (locationScoped
                      ? true
                      : !vesselFilter || vesselFilter === user.locationId),
                )}
                businessId={user?.businessId}
              />
            </div>
          ) : null}

          {/* Cumplimiento secundario: compacto bajo el mapa. */}
          <div className="flex max-h-[200px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-3">
            <div className="mb-1.5 flex shrink-0 items-center gap-2">
              <h2 className="min-w-0 flex-1 text-[14px] font-semibold leading-[20px] text-[var(--color-nachipa-title)]">
                Cumplimiento por nave
              </h2>
              <button
                type="button"
                className="shrink-0 text-[12px] font-semibold leading-[18px] text-[var(--color-nachipa-primary)]"
              >
                Ver todo
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {loading && vessels.length === 0 ? (
                <p className="m-0 px-2.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                  Cargando…
                </p>
              ) : null}
              {!loading && vessels.length === 0 ? (
                <p className="m-0 px-2.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                  Sin naves con tripulación activa.
                </p>
              ) : null}
              {vessels.map((nave) => {
                const pct = nave.compliancePercent;
                const tone: "warn" | "ok" =
                  pct == null || pct < VESSEL_WARN_BELOW_PCT ? "warn" : "ok";
                const barWidth = pct == null ? 0 : pct;
                return (
                  <div
                    key={nave.locationId}
                    className="flex items-center gap-2 px-1 py-0.5"
                  >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[var(--color-nav-item-active-bg)]">
                      <Ship
                        size={14}
                        strokeWidth={1.5}
                        className="text-[var(--color-nav-icon)]"
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[12px] font-medium leading-[16px] text-[var(--color-nachipa-title)]">
                          {nave.name}
                        </p>
                        <p className="shrink-0 text-[12px] font-semibold tabular-nums leading-[16px] text-[var(--color-nachipa-title)]">
                          {pct == null ? "—" : `${pct}%`}
                        </p>
                      </div>
                      <div className="h-1 overflow-hidden rounded-[3px] bg-[var(--color-chart-track)]">
                        <div
                          className="h-full rounded-[3px]"
                          style={{
                            width: `${barWidth}%`,
                            background:
                              tone === "warn"
                                ? "var(--color-chart-critical)"
                                : "var(--color-chart-primary)",
                          }}
                        />
                      </div>
                      <p className="m-0 mt-0.5 text-[11px] leading-[14px] text-[var(--color-nachipa-secondary)]">
                        {nave.completedTrainingSessionsCount}{" "}
                        {nave.completedTrainingSessionsCount === 1
                          ? "capacitación cerrada"
                          : "capacitaciones cerradas"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
