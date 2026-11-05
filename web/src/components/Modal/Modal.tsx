import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";

/**
 * Variante de presentación:
 * - center: card centrada (Figma Modal).
 * - drawer: panel full-height anclado a la derecha (slide-over).
 */
type ModalVariant = "center" | "drawer";

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
  /** Ancho; por defecto 520px (Figma). Lugares usa 640. Drawer ~70vw. */
  maxWidthClass?: string;
  /**
   * Extra a la derecha del título (badge, acciones), antes del cerrar.
   * Sirve para layouts anchos tipo preview de dos columnas.
   */
  headerEnd?: ReactNode;
  /**
   * Clases del cuerpo. Por defecto con padding y scroll.
   * Pasá p-0 / overflow-hidden cuando el children arma columnas a full height.
   */
  bodyClassName?: string;
  /**
   * center = modal clásico; drawer = panel lateral derecha → izquierda.
   */
  variant?: ModalVariant;
  /**
   * Si true, no renderiza el header IconBadge+título (el children arma el suyo).
   * Útil en drawers tipo ficha P9c.
   */
  hideHeader?: boolean;
};

/** Clases por defecto del cuerpo scrolleable con padding Figma. */
const DEFAULT_BODY_CLASS =
  "min-h-0 flex-1 overflow-y-auto px-6 py-[18px]";

/** Ancho por defecto del drawer (~70% viewport, tope 960). */
const DEFAULT_DRAWER_WIDTH =
  "w-full max-w-[min(960px,70vw)] sm:w-[min(960px,70vw)]";

/**
 * Pila de modales abiertos: Escape / overlay solo cierran el de arriba
 * (ej. P9m sobre el drawer P9c).
 */
const openModalStack: Array<() => void> = [];

/**
 * Modal overlay + card (Figma) o drawer lateral.
 * Portal a document.body: el overlay cubre viewport completo
 * (sidebar + topbar), aunque un ancestro tenga transform (animate-enter).
 */
export function Modal({
  open,
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  footer,
  maxWidthClass,
  headerEnd,
  bodyClassName = DEFAULT_BODY_CLASS,
  variant = "center",
  hideHeader = false,
}: ModalProps) {
  const isDrawer = variant === "drawer";
  const widthClass =
    maxWidthClass ??
    (isDrawer ? DEFAULT_DRAWER_WIDTH : "w-full max-w-[520px] sm:w-[520px]");

  /** Registra este modal en la pila; Escape solo cierra el tope. */
  useEffect(() => {
    if (!open) {
      return;
    }
    openModalStack.push(onClose);
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const top = openModalStack[openModalStack.length - 1];
      if (top === onClose) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const idx = openModalStack.lastIndexOf(onClose);
      if (idx >= 0) openModalStack.splice(idx, 1);
    };
  }, [open, onClose]);

  /** Bloquea scroll del fondo mientras hay al menos un modal. */
  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wave-modal-title"
      className={[
        "relative flex flex-col bg-white",
        isDrawer
          ? [
              "animate-drawer-panel ml-auto h-full max-h-none rounded-none",
              "shadow-[-12px_0_40px_rgba(0,0,0,0.14),-4px_0_16px_rgba(0,0,0,0.06)]",
              widthClass,
            ].join(" ")
          : [
              "animate-modal-panel my-auto max-h-[calc(100vh-4rem)] rounded-2xl",
              "shadow-[0_12px_40px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.08)]",
              widthClass,
            ].join(" "),
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

      {/* Header Figma Modal; omitible si el children trae header propio (P9c). */}
      {!hideHeader ? (
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
          {headerEnd ? (
            <div className="flex shrink-0 items-center gap-2 pt-1">
              {headerEnd}
            </div>
          ) : null}
        </div>
      ) : (
        /* Título accesible oculto cuando el header visual vive en children. */
        <h2 id="wave-modal-title" className="sr-only">
          {title}
        </h2>
      )}

      <div className={bodyClassName}>{children}</div>

      {footer ? (
        <div className="shrink-0 border-t border-[var(--color-nachipa-border-subtle)] px-6 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  );

  /**
   * Drawer debajo (100); modal centrado encima (110) para P9m/P9b sobre ficha.
   * Clic en overlay solo cierra el tope de la pila.
   */
  const overlay = (
    <div
      className={[
        "animate-modal-overlay fixed inset-0 bg-[rgba(15,18,23,0.45)]",
        isDrawer ? "z-[100] flex justify-end" : "z-[110] flex items-start justify-center overflow-y-auto px-6 py-8 sm:items-center",
      ].join(" ")}
      role="presentation"
      onClick={() => {
        const top = openModalStack[openModalStack.length - 1];
        if (top === onClose) onClose();
      }}
    >
      {panel}
    </div>
  );

  return createPortal(overlay, document.body);
}
