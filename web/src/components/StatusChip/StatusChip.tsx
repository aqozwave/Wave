import type { ReactNode } from "react";

/** Tonos de chip alineados a tokens status/*. */
export type StatusChipTone =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral";

const toneClass: Record<StatusChipTone, string> = {
  success:
    "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]",
  danger:
    "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]",
  warning:
    "bg-[var(--color-status-warning-bg,#ffedd5)] text-[var(--color-status-warning-fg,#c2410c)]",
  info: "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-fg)]",
  neutral:
    "bg-[var(--color-nachipa-bg-page,#f4f4f5)] text-[var(--color-nachipa-secondary)]",
};

type Props = {
  children: ReactNode;
  tone?: StatusChipTone;
};

/**
 * Chip de estado (Figma StatusChip).
 * Pill 12/medium sobre fondo status.
 */
export function StatusChip({ children, tone = "success" }: Props) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium leading-4",
        toneClass[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
