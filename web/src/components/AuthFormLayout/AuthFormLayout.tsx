import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "../Logo/Logo";

/** Props del layout de pantallas auth públicas (sin hero). */
type AuthFormLayoutProps = {
  /** Título bajo el logo. */
  title: string;
  /** Subtítulo gris. */
  subtitle?: string;
  children: ReactNode;
};

/**
 * Shell centrado para forgot / reset / confirm / resend.
 * Misma columna blanca del Login (sin panel hero).
 */
export function AuthFormLayout({
  title,
  subtitle,
  children,
}: AuthFormLayoutProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[var(--color-tremor-background)] px-6 py-10">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-4">
        <Logo size="auth" />
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-2xl font-semibold leading-[30px] text-[var(--color-nachipa-title)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
        <Link
          to="/login"
          className="text-[13px] font-semibold leading-[19px] text-[var(--color-nachipa-primary)] hover:underline"
        >
          Volver al inicio de sesión
        </Link>
        <p className="text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
          © 2026 Nachipa Wellboats · v2.0.0
        </p>
      </div>
    </div>
  );
}
