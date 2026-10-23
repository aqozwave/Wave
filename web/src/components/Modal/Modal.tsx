import { useEffect, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

/** Props del modal centrado (Figma Modal · Overlays + D16). */
type ModalProps = {
  open: boolean;
  title: string;
  /** Subtítulo bajo el título. */
  subtitle?: string;
  /**
   * Ícono del header (Figma IconBadge 40px).
   * Se muestra en todos los modales que lo pasen.
   */
  icon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  /**
   * Acciones fijas abajo (Cancelar / Guardar).
   * Quedan fuera del scroll para no alargar la card.
   */
  footer?: ReactNode;
  /** Ancho; por defecto 520px (Figma). Lugares usa 640. */
  maxWidthClass?: string;
};

/**
 * Modal overlay + card (Figma).
 * Header con badge de ícono opcional; cuerpo scroll; footer fijo.
 */
export function Modal({
  open,
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  footer,
  maxWidthClass = "w-full max-w-[520px] sm:w-[520px]",
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="animate-modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(15,18,23,0.45)] px-6 py-8 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wave-modal-title"
        className={[
          "animate-modal-panel relative my-auto flex max-h-[calc(100vh-4rem)] flex-col rounded-2xl bg-white",
          "shadow-[0_12px_40px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.08)]",
          maxWidthClass,
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-icon-default)] hover:bg-[var(--color-nachipa-bg-page)]"
          aria-label="Cerrar"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>

        {/* Header: IconBadge 40 + títulos (Figma 2:549 / 164:848). */}
        <div className="flex shrink-0 items-start gap-3 px-6 pb-0 pt-5 pr-12">
          {Icon ? (
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-info-bg)] text-[var(--color-status-info-fg)]"
              aria-hidden
            >
              <Icon className="size-5" strokeWidth={1.5} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="wave-modal-title"
              className="text-[18px] font-semibold leading-normal text-[var(--color-nachipa-title)]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[18px]">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-[var(--color-nachipa-border-subtle)] px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
