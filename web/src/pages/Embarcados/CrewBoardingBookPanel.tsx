import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarClock, Mail, Pencil } from "lucide-react";

import { Button } from "../../components/Button/Button";
import {
  DEFAULT_EXPIRY_NOTIFICATION_SETTINGS,
  getExpiryNotificationSettingsRequest,
} from "../../lib/api/notifications";
import {
  boardingBookStateLabel,
  daysUntilBoardingBookExpiry,
  formatBoardingBookDate,
  getBoardingBookUiState,
  type BoardingBookUiState,
} from "../../lib/boardingBook";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Props del panel de libreta en la ficha. */
export type CrewBoardingBookPanelProps = {
  /** Vigencia ISO del libro de embarque. */
  boardingBookValidUntil: string;
  /** Abre el modal de edición del embarcado (fecha de libreta). */
  onEdit: () => void;
};

/** Clases del chip según estado. */
function stateChipClass(state: BoardingBookUiState): string {
  if (state === "vigente") {
    return "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]";
  }
  if (state === "por_vencer") {
    return "bg-[var(--color-status-warning-bg,#ffedd5)] text-[var(--color-status-warning-fg,#c2410c)]";
  }
  return "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]";
}

/** Etiqueta de días restantes / vencidos. */
function daysLabel(days: number | null): string {
  if (days == null) return "Sin fecha";
  if (days > 0) return `Vence en ${days} día${days === 1 ? "" : "s"}`;
  if (days === 0) return "Vence hoy";
  const ago = Math.abs(days);
  return `Vencida hace ${ago} día${ago === 1 ? "" : "s"}`;
}

/**
 * Estado de un hito de aviso respecto a los días restantes.
 * pending = aún no llega; due = hoy es el hito; passed = ya pasó ese día.
 */
function milestonePhase(
  milestoneDay: number,
  daysLeft: number | null,
): "pending" | "due" | "passed" | "n_a" {
  if (daysLeft == null) return "n_a";
  if (daysLeft < 0) return "passed";
  if (daysLeft === milestoneDay) return "due";
  if (daysLeft < milestoneDay) return "passed";
  return "pending";
}

/** Label corto del hito. */
function milestonePhaseLabel(
  phase: "pending" | "due" | "passed" | "n_a",
): string {
  if (phase === "due") return "Hoy";
  if (phase === "passed") return "Pasó";
  if (phase === "pending") return "Pendiente";
  return "—";
}

/**
 * Tab Libreta de embarque en la ficha.
 * Muestra vigencia, estado, días y hitos de aviso configurados.
 */
export function CrewBoardingBookPanel({
  boardingBookValidUntil,
  onEdit,
}: CrewBoardingBookPanelProps) {
  const { accessToken } = useAuth();
  const [crewDays, setCrewDays] = useState<number[]>([
    ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.boardingBookCrewDays,
  ]);
  const [adminDays, setAdminDays] = useState<number[]>([
    ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.boardingBookAdminDays,
  ]);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  /** Carga hitos desde settings (si el usuario puede leerlos). */
  const loadSettings = useCallback(async () => {
    if (!accessToken) return;
    setSettingsError(null);
    try {
      const settings = await getExpiryNotificationSettingsRequest(accessToken);
      setCrewDays(settings.boardingBookCrewDays);
      setAdminDays(settings.boardingBookAdminDays);
    } catch (err) {
      // Sin permiso de notificaciones: usamos defaults y no bloqueamos la ficha.
      setCrewDays([
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.boardingBookCrewDays,
      ]);
      setAdminDays([
        ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS.boardingBookAdminDays,
      ]);
      if (err instanceof ApiError && err.status !== 403) {
        setSettingsError(err.message);
      }
    }
  }, [accessToken]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const state = getBoardingBookUiState(boardingBookValidUntil);
  const daysLeft = daysUntilBoardingBookExpiry(boardingBookValidUntil);
  const dateLabel = formatBoardingBookDate(boardingBookValidUntil);

  const crewMilestones = useMemo(
    () =>
      [...crewDays]
        .sort((a, b) => b - a)
        .map((day) => ({
          day,
          phase: milestonePhase(day, daysLeft),
        })),
    [crewDays, daysLeft],
  );

  const adminMilestones = useMemo(
    () =>
      [...adminDays]
        .sort((a, b) => b - a)
        .map((day) => ({
          day,
          phase: milestonePhase(day, daysLeft),
        })),
    [adminDays, daysLeft],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen vigencia */}
      <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-status-info-bg)] text-[var(--color-nachipa-primary)]">
              <BookOpen size={20} strokeWidth={1.5} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                Libreta de embarque
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--color-nachipa-secondary)]">
                Vigencia y avisos automáticos según la configuración del
                sistema.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="small"
            className="!w-auto"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" strokeWidth={1.5} aria-hidden />
            Actualizar vigencia
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[12px] border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page,#f9fafc)] px-4 py-3">
            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
              Vigente hasta
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[18px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
              <CalendarClock
                size={16}
                strokeWidth={1.5}
                className="text-[var(--color-nav-icon)]"
                aria-hidden
              />
              {dateLabel}
            </p>
          </div>
          <div className="rounded-[12px] border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page,#f9fafc)] px-4 py-3">
            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
              Estado
            </p>
            <p className="mt-1.5">
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium",
                  stateChipClass(state),
                ].join(" ")}
              >
                {boardingBookStateLabel(state)}
              </span>
            </p>
          </div>
          <div className="rounded-[12px] border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page,#f9fafc)] px-4 py-3">
            <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
              Plazo
            </p>
            <p className="mt-1 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
              {daysLabel(daysLeft)}
            </p>
          </div>
        </div>
      </div>

      {/* Hitos de aviso */}
      <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white p-5">
        <div className="flex items-start gap-2">
          <Mail
            size={18}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-[var(--color-nachipa-primary)]"
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
              Hitos de notificación
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--color-nachipa-secondary)]">
              Días antes del vencimiento en que el sistema encola avisos (job /
              corrida manual).
            </p>
          </div>
        </div>

        {settingsError ? (
          <p className="mt-3 m-0 text-[12px] text-[var(--color-status-danger-fg)]">
            {settingsError}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MilestoneList
            title="Correo al tripulante"
            items={crewMilestones}
          />
          <MilestoneList
            title="Resumen a administradores"
            items={adminMilestones}
          />
        </div>
      </div>
    </div>
  );
}

/** Lista de hitos (crew o admin). */
function MilestoneList({
  title,
  items,
}: {
  title: string;
  items: Array<{ day: number; phase: "pending" | "due" | "passed" | "n_a" }>;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--color-tremor-border)] overflow-hidden">
      <div className="bg-[var(--color-table-head-bg)] px-3 py-2 text-[12px] font-medium text-[var(--color-table-head-text)]">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="m-0 px-3 py-3 text-[12px] text-[var(--color-nachipa-secondary)]">
          Sin hitos configurados.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <li
              key={`${title}-${item.day}`}
              className="flex items-center justify-between gap-3 border-t border-[var(--color-nachipa-border-subtle)] px-3 py-2.5 text-[13px]"
            >
              <span className="text-[var(--color-nachipa-title)]">
                Aviso a {item.day} día{item.day === 1 ? "" : "s"}
              </span>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  item.phase === "due"
                    ? "bg-[var(--color-status-warning-bg,#ffedd5)] text-[var(--color-status-warning-fg,#c2410c)]"
                    : item.phase === "passed"
                      ? "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral-fg)]"
                      : "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-fg)]",
                ].join(" ")}
              >
                {milestonePhaseLabel(item.phase)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
