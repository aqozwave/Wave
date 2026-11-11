import { AlertTriangle, type LucideIcon } from "lucide-react";

import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";

/** Props del modal de confirmación del sistema (reemplaza window.confirm). */
type ConfirmModalProps = {
  open: boolean;
  /** Título corto (p. ej. «Eliminar entrada»). */
  title: string;
  /** Pregunta o mensaje principal. */
  message: string;
  /** Texto secundario opcional bajo el mensaje. */
  detail?: string;
  /** Label del botón de confirmar. */
  confirmLabel?: string;
  /** Label del botón cancelar. */
  cancelLabel?: string;
  /** Mientras corre la acción async. */
  busy?: boolean;
  /** Label del botón mientras busy. */
  busyLabel?: string;
  /** Ícono del header; default alerta. */
  icon?: LucideIcon;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Confirmación destructiva / irreversible con el Modal del design system.
 * Usar en lugar de window.confirm en toda la web.
 */
export function ConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  busy = false,
  busyLabel,
  icon = AlertTriangle,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      icon={icon}
      onClose={() => {
        if (!busy) onClose();
      }}
      maxWidthClass="w-full max-w-[440px] sm:w-[440px]"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <Button
            type="button"
            size="medium"
            className="!w-auto"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? (busyLabel ?? "…") : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">{message}</p>
      {detail ? (
        <p className="mt-2 m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
          {detail}
        </p>
      ) : null}
    </Modal>
  );
}
