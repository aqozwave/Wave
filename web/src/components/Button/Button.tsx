import type { ButtonHTMLAttributes } from "react";

/** Variantes visuales del botón (Figma Button). */
type ButtonVariant = "primary" | "brand";

/**
 * Tamaños Figma actuales (página Buttons):
 * Medium = 36px; Small = 30px (bajaron desde 44).
 */
type ButtonSize = "medium" | "small";

/** Props del Button (HTML button + variante/tamaño Figma). */
type ButtonProps = {
  /** primary = azul Nachipa; brand = navy del logo (auth). */
  variant?: ButtonVariant;
  /** medium = CTA estándar; small = acciones compactas. */
  size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** Clases Tailwind por variante. */
const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-nachipa-primary)] text-white hover:brightness-105 disabled:opacity-60",
  brand:
    "bg-[var(--color-brand-navy)] text-white hover:brightness-110 disabled:opacity-60",
};

/** Alto / padding / tipo según Size en Figma (2:121 Medium, 2:125 Small). */
const sizeClass: Record<ButtonSize, string> = {
  medium: "h-9 px-4 text-[13px] leading-[19px]",
  small: "h-[30px] px-3 text-[12px] leading-4",
};

/**
 * Botón principal (Figma Button).
 * Default Medium 36px — alineado al tamaño reducido del design system.
 */
export function Button({
  variant = "primary",
  size = "medium",
  children,
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition disabled:cursor-not-allowed",
        sizeClass[size],
        variantClass[variant],
        className ?? "",
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
