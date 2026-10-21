import type { InputHTMLAttributes, ReactNode } from "react";

type TextFieldProps = {
  label: string;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function TextField({
  label,
  leadingIcon,
  trailing,
  error,
  id,
  ...inputProps
}: TextFieldProps) {
  const fieldId = id ?? inputProps.name;

  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[13px] font-medium leading-[19px] text-[var(--color-nachipa-title)]">
        {label}
      </span>
      <span
        className={[
          "flex h-[42px] items-center gap-2.5 overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-tremor-background)] px-3.5",
          error
            ? "border-[var(--color-status-error)]"
            : "border-[var(--color-tremor-border)] focus-within:border-[var(--color-brand-navy)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--color-brand-navy)_20%,transparent)]",
        ].join(" ")}
      >
        {leadingIcon ? (
          <span className="shrink-0 text-[var(--color-icon-default)] [&_svg]:size-4">
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={fieldId}
          className="min-w-0 flex-1 bg-transparent text-[13px] leading-[19px] text-[var(--color-nachipa-title)] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
          {...inputProps}
        />
        {trailing ? (
          <span className="shrink-0 text-[var(--color-icon-default)] [&_svg]:size-4">
            {trailing}
          </span>
        ) : null}
      </span>
      {error ? (
        <span className="text-[12px] leading-4 text-[var(--color-status-error)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
