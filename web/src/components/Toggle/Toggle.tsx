/** Switch on/off (Figma toggle 36×20). */
type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accesible: nombre del control. */
  "aria-label"?: string;
  disabled?: boolean;
};

/**
 * Toggle de estado (activo/inactivo).
 * Reemplaza checkboxes en modales de configuración.
 */
export function Toggle({
  checked,
  onChange,
  "aria-label": ariaLabel,
  disabled = false,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked
          ? "bg-[var(--color-nachipa-primary)]"
          : "bg-[var(--color-nachipa-border-subtle,#e5e7eb)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
          checked ? "left-4" : "left-0.5",
        ].join(" ")}
        aria-hidden
      />
    </button>
  );
}
