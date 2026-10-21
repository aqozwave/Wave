import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Download,
  Search,
  Ship,
} from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { UserMenu } from "../../components/UserMenu/UserMenu";

// Maqueta S1 · Panel global (Figma 133:4570). Datos de diseño; API real = sección Dashboard.

/** Capitaliza el primer carácter (nombres del seed vienen en minúscula). */
function capitalizeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const kpis = [
  {
    label: "Cumplimiento global",
    value: "97,4%",
    icon: CheckCircle2,
    delta: "+0,6 pts",
    deltaTone: "success" as const,
    hint: "vs mes pasado",
  },
  {
    label: "Vencen en 60 días",
    value: "21",
    icon: AlertTriangle,
    delta: "+4",
    deltaTone: "danger" as const,
    hint: "vs semana pasada",
  },
  {
    label: "Vencidos o faltantes",
    value: "3",
    icon: CircleAlert,
    delta: "0",
    deltaTone: "neutral" as const,
    hint: "sin cambios",
  },
];

const vencimientos = [
  {
    initials: "DR",
    name: "Daniel Rojas",
    curso: "OMI 1.13",
    vence: "21-10-2026",
    estado: "Urgente" as const,
  },
  {
    initials: "TH",
    name: "Tomás Herrera",
    curso: "OMI 1.19",
    vence: "28-10-2026",
    estado: "Crítico" as const,
  },
  {
    initials: "CT",
    name: "Camila Torres",
    curso: "OMI 6.1",
    vence: "02-11-2026",
    estado: "Urgente" as const,
  },
  {
    initials: "FV",
    name: "Felipe Vargas",
    curso: "OMI 1.13",
    vence: "05-11-2026",
    estado: "Crítico" as const,
  },
];

/** Escala del plot Figma: 8 unidades = 150px de alto útil. */
const CAPSULE_MAX = 8;
/** Alto del área de barras (sin labels), igual a Figma Plot · cápsulas. */
const CAPSULE_PLOT_H = 150;
/** Ancho de cada cápsula en Figma. */
const CAPSULE_W = 12;

/**
 * Series “cápsulas” (Figma 133:4937): dos barras redondeadas en la misma
 * categoría, ancladas abajo — soft (31–60 d) detrás / primary (0–30 d) delante.
 */
const porNaveCapsules = [
  { label: "POL", soft: 7, solid: 3 },
  { label: "DIA", soft: 5, solid: 2 },
  { label: "ATL", soft: 4, solid: 2 },
  { label: "PIO", soft: 4, solid: 1 },
  { label: "AUS", soft: 1, solid: 0 },
] as const;

const porCursoCapsules = [
  { label: "1.13", soft: 6, solid: 3 },
  { label: "1.19", soft: 4, solid: 2 },
  { label: "2.03", soft: 4, solid: 1 },
  { label: "1.07", soft: 3, solid: 1 },
  { label: "IND", soft: 2, solid: 1 },
] as const;

const naves = [
  {
    name: "Austral I",
    meta: "10 de 12 tripulantes al día",
    pct: 85,
    tone: "warn" as const,
  },
  {
    name: "Ronia Polaris",
    meta: "22 de 24 tripulantes al día",
    pct: 92,
    tone: "ok" as const,
  },
  {
    name: "Ronia Atlantic",
    meta: "18 de 19 tripulantes al día",
    pct: 95,
    tone: "ok" as const,
  },
  {
    name: "Ronia Diamond",
    meta: "15 de 15 tripulantes al día",
    pct: 97,
    tone: "ok" as const,
  },
];

/** Convierte unidades del eje (0–8) a píxeles del plot. */
function capsulePx(units: number): number {
  return (units / CAPSULE_MAX) * CAPSULE_PLOT_H;
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

export function Panel() {
  const { user } = useAuth();
  const welcomeName = user
    ? capitalizeName(user.firstName)
    : "usuario";

  return (
    <div className="flex flex-col gap-4">
      {/* Header S1 (133:4710): saludo + búsqueda + iconos + exportar + UserMenu */}
      <header className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-semibold leading-[26px] text-[var(--color-nachipa-title)]">
            Bienvenido, {welcomeName}
          </h1>
          <p className="text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
            Cumplimiento de todas las empresas
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

        <button
          type="button"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-[18px] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] text-[var(--color-icon-default)]"
          aria-label="Notificaciones"
        >
          <Bell size={16} strokeWidth={1.5} aria-hidden />
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--color-status-danger-fg)]"
          />
        </button>

        <button
          type="button"
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-nachipa-primary)] px-5 text-[13px] font-semibold leading-[19px] text-white"
        >
          <Download size={18} strokeWidth={1.5} aria-hidden />
          Exportar resumen
        </button>

        <UserMenu />
      </header>

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
                    {kpi.value}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "rounded-md px-1.5 py-0.5 text-[12px] font-medium leading-4",
                        kpi.deltaTone === "success"
                          ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]"
                          : kpi.deltaTone === "danger"
                            ? "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]"
                            : "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral-fg)]",
                      ].join(" ")}
                    >
                      {kpi.delta}
                    </span>
                    <span className="text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                      {kpi.hint}
                    </span>
                  </div>
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
              <button
                type="button"
                className="text-[13px] font-semibold leading-[19px] text-[var(--color-nachipa-primary)]"
              >
                Ver todos
              </button>
            </div>
            <div className="overflow-hidden rounded-lg">
              <div className="grid grid-cols-[1.6fr_0.9fr_0.7fr_0.7fr] bg-[var(--color-table-head-bg)] text-[12px] font-medium leading-4 text-[var(--color-table-head-text)]">
                <div className="px-3 py-2.5">Tripulante</div>
                <div className="px-3 py-2.5">Curso</div>
                <div className="px-3 py-2.5">Vence</div>
                <div className="px-3 py-2.5">Estado</div>
              </div>
              {vencimientos.map((row) => (
                <div
                  key={row.name}
                  className="grid grid-cols-[1.6fr_0.9fr_0.7fr_0.7fr] border-b border-[var(--color-nachipa-border-subtle)] text-[12px] last:border-b-0"
                >
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex size-9 items-center justify-center rounded-[18px] bg-[var(--color-kpi-indigo-soft)] text-[12px] font-semibold text-[var(--color-kpi-indigo)]">
                      {row.initials}
                    </span>
                    <span className="font-medium text-[var(--color-nachipa-title)]">
                      {row.name}
                    </span>
                  </div>
                  <div className="flex items-center px-3 py-2.5 text-[var(--color-nachipa-body)]">
                    {row.curso}
                  </div>
                  <div className="flex items-center px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                    {row.vence}
                  </div>
                  <div className="flex items-center px-3 py-2.5">
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[12px] font-medium",
                        row.estado === "Urgente"
                          ? "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]"
                          : "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-fg)]",
                      ].join(" ")}
                    >
                      {row.estado}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-[min(470px,38%)] shrink-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                { title: "Por nave", series: porNaveCapsules },
                { title: "Por curso", series: porCursoCapsules },
              ] as const
            ).map((chart) => (
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
                    8
                  </span>
                  <span className="absolute left-0 top-[67px] w-[18px] text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                    4
                  </span>
                  <span className="absolute left-0 top-[142px] w-[18px] text-right text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                    0
                  </span>

                  <div className="absolute bottom-[22px] left-6 right-0 flex h-[150px] items-end justify-between px-1">
                    {chart.series.map((col) => (
                      <div
                        key={col.label}
                        className="relative flex h-full w-6 flex-col items-center justify-end"
                      >
                        {col.soft > 0 ? (
                          <div
                            className="absolute bottom-0 rounded-[6px] bg-[var(--color-chart-primary-soft)]"
                            style={{
                              width: CAPSULE_W,
                              height: capsulePx(col.soft),
                            }}
                            aria-hidden
                          />
                        ) : null}
                        {col.solid > 0 ? (
                          <div
                            className="absolute bottom-0 rounded-[6px] bg-[var(--color-chart-primary)]"
                            style={{
                              width: CAPSULE_W,
                              height: capsulePx(col.solid),
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
            ))}
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
              {naves.map((nave) => (
                <div
                  key={nave.name}
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
                          {nave.meta}
                        </p>
                      </div>
                      <p className="text-[13px] font-semibold tabular-nums leading-[19px] text-[var(--color-nachipa-title)]">
                        {nave.pct}%
                      </p>
                    </div>
                    {/* Track 6px como Figma 133:5008. */}
                    <div className="h-1.5 overflow-hidden rounded-[3px] bg-[var(--color-chart-track)]">
                      <div
                        className="h-full rounded-[3px]"
                        style={{
                          width: `${nave.pct}%`,
                          background:
                            nave.tone === "warn"
                              ? "var(--color-chart-critical)"
                              : "var(--color-chart-primary)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
