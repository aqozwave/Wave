import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileCheck,
  FileText,
  LogIn,
  Ship,
  Star,
} from "lucide-react";

import { StatusChip } from "../../components/StatusChip/StatusChip";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listCrewMemberHistoryRequest,
  type CrewHistoryCategory,
  type CrewHistoryItem,
  type CrewHistorySummary,
} from "../../lib/api/crewMembers";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  /** Id del tripulante de la ficha. */
  crewMemberId: string;
  /** Callback al pulsar «Ver todos» de documentos recientes (ir a tab Documentos). */
  onOpenDocuments?: () => void;
};

/** Filtros pill de la timeline (Figma D31). */
const FILTERS: { id: CrewHistoryCategory; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "contract", label: "Contrato" },
  { id: "document", label: "Documentos" },
  { id: "observation", label: "Observaciones" },
  { id: "sanction", label: "Amonestaciones" },
  { id: "boarding", label: "Embarques" },
];

/** Fecha corta DD-MM-YYYY es-CL. */
function formatDay(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Hora HH:mm local. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Año del evento para agrupación. */
function yearOf(iso: string): number {
  return new Date(iso).getFullYear();
}

/** Ícono + fondo del rail según categoría. */
function eventVisual(category: CrewHistoryItem["category"]): {
  Icon: typeof FileText;
  tileClass: string;
  iconClass: string;
} {
  switch (category) {
    case "document":
      return {
        Icon: FileCheck,
        tileClass: "bg-[var(--color-status-info-bg)]",
        iconClass: "text-[var(--color-status-info-fg)]",
      };
    case "observation":
      return {
        Icon: Star,
        tileClass: "bg-[var(--color-status-success-bg)]",
        iconClass: "text-[var(--color-status-success-fg)]",
      };
    case "sanction":
      return {
        Icon: AlertTriangle,
        tileClass: "bg-[var(--color-status-warning-bg,#fef3c7)]",
        iconClass: "text-[var(--color-status-warning-fg,#d97706)]",
      };
    case "boarding":
      return {
        Icon: Ship,
        tileClass: "bg-[var(--color-kpi-indigo-soft,#e0ecfd)]",
        iconClass: "text-[var(--color-nachipa-primary)]",
      };
    case "course":
      return {
        Icon: FileText,
        tileClass: "bg-[var(--color-status-info-bg)]",
        iconClass: "text-[var(--color-status-info-fg)]",
      };
    default:
      return {
        Icon: LogIn,
        tileClass: "bg-[var(--color-status-neutral-bg,#f4f4f5)]",
        iconClass: "text-[var(--color-nachipa-secondary)]",
      };
  }
}

/**
 * Bitácora del tripulante (Figma D31 / AQO-68).
 * Timeline + filtros + resumen lateral; períodos laborales pendientes de modelo.
 */
export function CrewBitacoraPanel({
  crewMemberId,
  onOpenDocuments,
}: Props) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [category, setCategory] = useState<CrewHistoryCategory>("all");
  const [allItems, setAllItems] = useState<CrewHistoryItem[]>([]);
  const [summary, setSummary] = useState<CrewHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  /** Carga historial completo una vez; el filtro es local. */
  const reload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listCrewMemberHistoryRequest(
        accessToken,
        crewMemberId,
        { page: 1, limit: 100, category: "all" },
      );
      setAllItems(result.items);
      setSummary(result.summary);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar la bitácora.",
        "danger",
      );
      setAllItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, crewMemberId, showToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Ítems visibles según pill activa. */
  const items = useMemo(
    () =>
      category === "all"
        ? allItems
        : allItems.filter((e) => e.category === category),
    [allItems, category],
  );

  /** Agrupa por año (desc) para encabezados de período. */
  const groups = useMemo(() => {
    const map = new Map<number, CrewHistoryItem[]>();
    for (const item of items) {
      const y = yearOf(item.createdAt);
      const bucket = map.get(y) ?? [];
      bucket.push(item);
      map.set(y, bucket);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [items]);

  /** Documentos recientes desde el set completo (no dependen del filtro). */
  const recentDocs = useMemo(
    () =>
      allItems
        .filter((e) => e.category === "document" && e.attachmentName)
        .slice(0, 5),
    [allItems],
  );

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Timeline */}
      <div className="min-w-0 flex-1 rounded-[14px] border border-[var(--color-tremor-border)] bg-white px-[18px] py-4">
        <div className="mb-3.5 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = category === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategory(f.id)}
                className={
                  active
                    ? "rounded-full border border-[var(--color-nachipa-primary)] bg-[var(--color-table-row-selected,#eaf2fe)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-nachipa-link,#1d6fe8)]"
                    : "rounded-full border border-[var(--color-tremor-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--color-nachipa-body)]"
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="py-8 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando bitácora…
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-[13px] text-[var(--color-nachipa-secondary)]">
            Sin eventos todavía. Las altas de documentos y cambios de ficha
            aparecen aquí.
          </p>
        ) : (
          <div className="flex flex-col">
            {groups.map(([year, yearItems]) => (
              <div key={year}>
                <div className="flex items-center gap-2.5 pb-2.5 pt-1.5">
                  <p className="shrink-0 text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                    {year}
                  </p>
                  <div className="h-px min-w-0 flex-1 bg-[var(--color-tremor-border)]" />
                  {year === currentYear ? (
                    <p className="shrink-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                      Período actual
                    </p>
                  ) : null}
                </div>

                {yearItems.map((item, idx) => {
                  const { Icon, tileClass, iconClass } = eventVisual(
                    item.category,
                  );
                  const isLastInYear = idx === yearItems.length - 1;
                  const isLastYear =
                    year === groups[groups.length - 1]?.[0];
                  const isLast = isLastInYear && isLastYear;
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3.5 items-start"
                    >
                      <div className="flex w-[76px] shrink-0 flex-col items-end gap-0.5 pt-1.5 whitespace-nowrap">
                        <p className="text-[12px] font-semibold text-[var(--color-nachipa-title)]">
                          {formatDay(item.createdAt)}
                        </p>
                        <p className="text-[11px] text-[var(--color-nachipa-secondary)]">
                          {formatTime(item.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-center self-stretch">
                        <div
                          className={`flex size-8 items-center justify-center rounded-2xl ${tileClass}`}
                        >
                          <Icon
                            className={`size-4 ${iconClass}`}
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </div>
                        {!isLast ? (
                          <div className="w-0.5 min-h-[12px] flex-1 bg-[var(--color-tremor-border)]" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 pb-5 pt-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-semibold text-[var(--color-nachipa-title)]">
                            {item.title}
                          </p>
                          {item.statusLabel ? (
                            <StatusChip tone={item.statusTone}>
                              {item.statusLabel}
                            </StatusChip>
                          ) : null}
                        </div>
                        {item.detail ? (
                          <p className="mb-1 text-[13px] text-[var(--color-nachipa-body)]">
                            {item.detail}
                          </p>
                        ) : null}
                        {item.actor ? (
                          <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            {item.actor}
                          </p>
                        ) : null}
                        {item.attachmentName ? (
                          <div className="mt-1.5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-table-head-bg,#f8f9fb)] px-2.5 py-1.5">
                            <FileText
                              className="size-3.5 text-[var(--color-nachipa-secondary)]"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                            <span className="text-[12px] font-medium text-[var(--color-nachipa-title)]">
                              {item.attachmentName}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lateral */}
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
        <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-white px-[18px] py-4">
          <p className="mb-3 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
            Períodos laborales
          </p>
          <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
            Todavía no hay períodos registrados para este tripulante.
          </p>
        </div>

        <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-white px-[18px] py-4">
          <p className="mb-3 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
            Resumen de la bitácora
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryStat
              label="Observaciones"
              value={summary?.observations ?? 0}
              tileClass="bg-[var(--color-status-success-bg)]"
              Icon={Star}
              iconClass="text-[var(--color-status-success-fg)]"
            />
            <SummaryStat
              label="Amonestaciones"
              value={summary?.sanctions ?? 0}
              tileClass="bg-[var(--color-status-warning-bg,#fef3c7)]"
              Icon={AlertTriangle}
              iconClass="text-[var(--color-status-warning-fg,#d97706)]"
            />
            <SummaryStat
              label="Documentos"
              value={summary?.documents ?? 0}
              tileClass="bg-[var(--color-status-info-bg)]"
              Icon={FileText}
              iconClass="text-[var(--color-status-info-fg)]"
            />
            <SummaryStat
              label="Cambios de nave"
              value={summary?.boardings ?? 0}
              tileClass="bg-[var(--color-kpi-indigo-soft,#e0ecfd)]"
              Icon={Ship}
              iconClass="text-[var(--color-nachipa-primary)]"
            />
          </div>
        </div>

        <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-white px-[18px] py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-[var(--color-nachipa-title)]">
              Documentos recientes
            </p>
            {onOpenDocuments && (summary?.documents ?? 0) > 0 ? (
              <button
                type="button"
                onClick={onOpenDocuments}
                className="text-[12px] font-medium text-[var(--color-nachipa-link,#1d6fe8)]"
              >
                Ver todos ({summary?.documents ?? 0})
              </button>
            ) : null}
          </div>
          {recentDocs.length === 0 ? (
            <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Sin documentos en este filtro.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {recentDocs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-status-neutral-bg,#f4f4f5)]">
                    <FileText
                      className="size-3.5 text-[var(--color-nachipa-secondary)]"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-[var(--color-nachipa-title)]">
                      {doc.attachmentName}
                    </p>
                    <p className="text-[11px] text-[var(--color-nachipa-secondary)]">
                      {doc.categoryLabel} · {formatDay(doc.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

/** Stat del resumen lateral. */
function SummaryStat({
  label,
  value,
  tileClass,
  Icon,
  iconClass,
}: {
  label: string;
  value: number;
  tileClass: string;
  Icon: typeof FileText;
  iconClass: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] bg-[var(--color-table-head-bg,#f8f9fb)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div
          className={`flex size-6 items-center justify-center rounded-xl ${tileClass}`}
        >
          <Icon className={`size-3 ${iconClass}`} strokeWidth={1.5} aria-hidden />
        </div>
        <p className="text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
          {label}
        </p>
      </div>
      <p className="text-[20px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
        {value}
      </p>
    </div>
  );
}
