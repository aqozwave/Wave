import { Check, Info, TriangleAlert, X } from "lucide-react";

/** Tonos del Toast (Figma Feedback · Toast). */
export type ToastTone = "success" | "danger" | "info" | "warning";

/** Props visuales de un toast individual. */
export type ToastProps = {
  tone?: ToastTone;
  message: string;
  /** Cierra el toast (ícono X). */
  onClose?: () => void;
};

/** Fondo del badge 28×28 según tono. */
const badgeClass: Record<ToastTone, string> = {
  success: "bg-[var(--color-nachipa-primary)]",
  danger: "bg-[var(--color-status-danger-fg)]",
  info: "bg-[var(--color-status-info-fg)]",
  warning: "bg-[var(--color-status-warning-fg)]",
};

/** Ícono Lucide del badge (check / alert / info). */
const ToneIcon = {
  success: Check,
  danger: X,
  info: Info,
  warning: TriangleAlert,
} as const;

/**
 * Toast Figma (2:284): card blanca, badge 28px, texto 13px, X para cerrar.
 * Posición en pantalla la controla ToastViewport (arriba a la derecha).
 */
export function Toast({
  tone = "success",
  message,
  onClose,
}: ToastProps) {
  const Icon = ToneIcon[tone];

  return (
    <div
      role="status"
      className="flex max-w-[366px] items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-tremor-background)] py-3 pl-3 pr-4 shadow-[0_12px_32px_rgba(15,23,42,0.14)]"
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white ${badgeClass[tone]}`}
        aria-hidden
      >
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-[19px] text-[var(--color-nachipa-body)]">
        {message}
      </p>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-[var(--color-icon-default)] hover:text-[var(--color-nachipa-title)]"
          aria-label="Cerrar notificación"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
