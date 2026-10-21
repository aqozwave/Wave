import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "brand";

type ButtonProps = {
  variant?: ButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-nachipa-primary)] text-white hover:brightness-105 disabled:opacity-60",
  brand:
    "bg-[var(--color-brand-navy)] text-white hover:brightness-110 disabled:opacity-60",
};

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
