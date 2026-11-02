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
  type DashboardSummary,
  type DashboardUpcomingItem,
} from "../../lib/api/dashboard";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/**
 * Panel global (Figma 133:4570).
 * KPIs, próximos vencimientos, cápsulas por nave/curso y lista de naves
 * vienen de GET /dashboard/summary. El chart “Cumplimiento mensual” sigue mock
 * (no hay serie histórica aún).
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
 * Escala mínima del plot Figma (8 unidades = 150px).
 * Si los datos superan 8, el eje crece al máximo real (ceil a par).
 */
const CAPSULE_MIN_MAX = 8;
/** Alto del área de barras (sin labels), igual a Figma Plot · cápsulas. */
const CAPSULE_PLOT_H = 150;
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

const meses = [
  "Nov",
  "Dic",
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
];

/** Página Panel global: header S1 + KPIs + breakdowns reales. */
export function Panel() {
  const { user, accessToken } = useAuth();
  const welcomeName = user ? capitalizeName(user.firstName) : "usuario";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  /** Carga el resumen del dashboard. */
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardSummaryRequest(accessToken, {
        upcomingLimit: 8,
        vesselChartLimit: 5,
        courseChartLimit: 5,
        vesselListLimit: 8,
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
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Tres tarjetas KPI desde la API (sin deltas históricos aún). */
  const kpis = useMemo(() => {
    const k = summary?.kpis;
    const horizon = k?.horizonDays ?? 60;
    return [
      {
        label: "Cumplimiento global",
        value:
          k?.compliancePercent == null
            ? "—"
            : `${k.compliancePercent.toLocaleString("es-CL")} %`,
        icon: CheckCircle2,
        hint:
          k == null
            ? "cargando…"
            : `${k.crewCount} tripulantes activos`,
      },
      {
        label: `Vencen en ${horizon} días`,
        value: k == null ? "—" : String(k.expiringSoonCount),
        icon: AlertTriangle,
        hint: "cursos OMI por vencer",
      },
      {
        label: "Vencidos o faltantes",
        value: k == null ? "—" : String(k.expiredOrMissingCount),
        icon: CircleAlert,
        hint: "vencidos + pendientes obligatorios",
      },
    ];
  }, [summary]);

  const upcoming = summary?.upcoming ?? [];
  const byVessel = summary?.byVessel ?? [];
  const byCourse = summary?.byCourse ?? [];
  const vessels = summary?.vessels ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-7 py-[22px]">
      {/* Header S1 (133:4710): saludo + búsqueda + iconos + exportar + UserMenu */}
      <header className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-semibold leading-[26px] text-[var(--color-nachipa-title)]">
            Bienvenido, {welcomeName}
          </h1>
          <p className="text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
            Cumplimiento de formación OMI
            {user?.internalRol === "superadmin"
              ? " · todas las empresas"
              : ""}
          </p>
        </div>

        <label className="flex h-9 w-[240px] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] pl-3 pr-2.5">
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

      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex gap-3.5">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] px-[18px] py-4"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium leading-[19px] text-[var(--color-nachipa-body)]">
                      {kpi.label}
                    </p>
                    <Icon
                      size={16}
                      strokeWidth={1.5}
                      className="text-[var(--color-nav-icon)]"
                      aria-hidden
                    />
                  </div>
                  <p className="text-[28px] font-semibold leading-9 tracking-[-0.14px] text-[var(--color-nachipa-title)]">
                    {loading ? "…" : kpi.value}
                  </p>
                  <p className="text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                    {kpi.hint}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-[18px]">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-[21px] text-[var(--color-nachipa-title)]">
                Cumplimiento mensual
              </h2>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-[var(--color-tremor-border)] px-2.5 py-[5px] text-[12px] font-medium leading-4 text-[var(--color-nachipa-body)]"
              >
                Mensual
                <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
            <div className="relative h-[216px] w-full">
              <svg
                viewBox="0 0 590 216"
                className="size-full"
                preserveAspectRatio="none"
                aria-hidden
              >
                {[8, 53.5, 99, 144.5, 190].map((y) => (
                  <line
                    key={y}
                    x1="40"
                    x2="590"
                    y1={y}
                    y2={y}
                    stroke="var(--color-chart-grid)"
                    strokeWidth="1"
                  />
                ))}
                <polyline
                  fill="none"
                  stroke="var(--color-chart-primary)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points="52,147 100,130 148,138 196,120 244,112 292,118 340,105 388,95 436,78 484,88 532,72 578,80"
                />
                <circle
                  cx="436"
                  cy="78"
                  r="5"
                  fill="var(--color-chart-primary)"
                />
              </svg>
              <div className="pointer-events-none absolute left-[68%] top-9 -translate-x-1/2 rounded-lg bg-[var(--color-chart-primary-soft)] px-2 py-[3px] text-[12px] font-medium leading-4 text-[var(--color-nachipa-primary)]">
                Jul · 96,9%
              </div>
              <div className="absolute inset-y-0 left-0 flex w-8 flex-col justify-between py-1 text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                <span>100%</span>
                <span>98%</span>
                <span>96%</span>
                <span>94%</span>
                <span>92%</span>
              </div>
              <div className="absolute bottom-0 left-10 right-0 flex justify-between text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                {meses.map((m) => (
                  <span key={m} className="w-10 text-center">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-[18px]">
            <div className="mb-2 flex items-center gap-2">
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
            <div className="overflow-hidden rounded-lg">
              <div className="grid grid-cols-[1.6fr_0.9fr_0.7fr_0.7fr] bg-[var(--color-table-head-bg)] text-[12px] font-medium leading-4 text-[var(--color-table-head-text)]">
                <div className="px-3 py-2.5">Tripulante</div>
                <div className="px-3 py-2.5">Curso</div>
                <div className="px-3 py-2.5">Vence</div>
                <div className="px-3 py-2.5">Estado</div>
              </div>
              {loading && upcoming.length === 0 ? (
                <p className="m-0 px-3 py-4 text-[12px] text-[var(--color-nachipa-secondary)]">
                  Cargando…
                </p>
              ) : null}
              {!loading && upcoming.length === 0 ? (
                <p className="m-0 px-3 py-4 text-[12px] text-[var(--color-nachipa-secondary)]">
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
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex size-9 items-center justify-center rounded-[18px] bg-[var(--color-kpi-indigo-soft)] text-[12px] font-semibold text-[var(--color-kpi-indigo)]">
                        {initialsOf(row.crewFirstName, row.crewLastName)}
                      </span>
                      <span className="font-medium text-[var(--color-nachipa-title)]">
                        {fullName || row.crewRun}
                      </span>
                    </div>
                    <div className="flex items-center px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.courseName}
                    </div>
                    <div className="flex items-center px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDate(row.expiresAt)}
                    </div>
                    <div className="flex items-center px-3 py-2.5">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[12px] font-medium",
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

        <div className="flex w-[min(470px,38%)] shrink-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                { title: "Por nave", series: byVessel },
                { title: "Por curso", series: byCourse },
              ] as const
            ).map((chart) => {
              const scaleMax = capsuleScaleMax(chart.series);
              const mid = scaleMax / 2;
              return (
                <div
                  key={chart.title}
                  className="flex flex-col gap-2.5 overflow-hidden rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-4"
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
                  <div className="relative h-[172px] w-full">
                    <div
                      className="absolute left-6 right-0 top-0 h-px bg-[var(--color-chart-grid)]"
                      aria-hidden
                    />
                    <div
                      className="absolute left-6 right-0 top-[75px] h-px bg-[var(--color-chart-grid)]"
                      aria-hidden
                    />
                    <div
                      className="absolute left-6 right-0 top-[150px] h-px bg-[var(--color-chart-grid)]"
                      aria-hidden
                    />
                    <span className="absolute left-0 top-[-8px] w-[18px] text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                      {scaleMax}
                    </span>
                    <span className="absolute left-0 top-[67px] w-[18px] text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                      {mid}
                    </span>
                    <span className="absolute left-0 top-[142px] w-[18px] text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
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

                    <div className="absolute bottom-[22px] left-6 right-0 flex h-[150px] items-end justify-between px-1">
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

          <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] p-[18px]">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-[21px] text-[var(--color-nachipa-title)]">
                Cumplimiento por nave
              </h2>
              <button
                type="button"
                className="shrink-0 text-[13px] font-semibold leading-[19px] text-[var(--color-nachipa-primary)]"
              >
                Ver todo
              </button>
            </div>
            <div className="flex flex-col gap-[10px]">
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
                    className="flex items-start gap-3 px-2.5 py-1"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-nav-item-active-bg)]">
                      <Ship
                        size={18}
                        strokeWidth={1.5}
                        className="text-[var(--color-nav-icon)]"
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-[19px] text-[var(--color-nachipa-title)]">
                            {nave.name}
                          </p>
                          <p className="text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                            {nave.compliantCrewCount} de {nave.crewCount}{" "}
                            tripulantes al día
                          </p>
                        </div>
                        <p className="text-[13px] font-semibold tabular-nums leading-[19px] text-[var(--color-nachipa-title)]">
                          {pct == null ? "—" : `${pct}%`}
                        </p>
                      </div>
                      {/* Track 6px como Figma 133:5008. */}
                      <div className="h-1.5 overflow-hidden rounded-[3px] bg-[var(--color-chart-track)]">
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
