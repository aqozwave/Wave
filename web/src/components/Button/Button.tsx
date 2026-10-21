import type { ButtonHTMLAttributes } from "react";

/** Variantes visuales del botón primario del portal. */
type ButtonVariant = "primary" | "brand";

/** Props del Button (HTML button + variante Figma). */
type ButtonProps = {
  /** primary = azul Nachipa; brand = navy del logo (auth). */
  variant?: ButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** Clases Tailwind por variante (Figma Button). */
const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-nachipa-primary)] text-white hover:brightness-105 disabled:opacity-60",
  brand:
    "bg-[var(--color-brand-navy)] text-white hover:brightness-110 disabled:opacity-60",
};

/**
 * Botón principal (Figma Button).
 * Primary para CTAs del dashboard; Brand opcional en auth.
 */
export function Button({
  variant = "primary",
  children,
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 text-[13px] font-semibold leading-[19px] transition disabled:cursor-not-allowed",
        variantClass[variant],
        className ?? "",
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
