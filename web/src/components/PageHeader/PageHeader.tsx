import type { ReactNode } from "react";
import { Link } from "react-router";

/** Un tramo del breadcrumb (el último es la página actual). */
export type PageHeaderCrumb = {
  label: string;
  /** Si hay `to`, el tramo es link; el último suele ir sin ruta. */
  to?: string;
};

/** Props del encabezado de pantalla (estándar Wave). */
type PageHeaderProps = {
  /**
   * Ruta de sección, ej. Configuración → Empresas.
   * El último ítem es la página actual (sin link).
   */
  crumbs: PageHeaderCrumb[];
  /** Título H1 de la página. */
  title: string;
  /** Subtítulo bajo el título. */
  description?: string;
  /** Acciones a la derecha (botones, etc.). */
  actions?: ReactNode;
};

/**
 * Encabezado de página estándar: breadcrumb + título + descripción + acciones.
 * Usar en pantallas del shell (Empresas, futuras bajo Configuración, etc.).
 */
export function PageHeader({
  crumbs,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex shrink-0 items-start gap-4">
      <div className="min-w-0 flex-1">
        {crumbs.length > 0 ? (
          <nav
            aria-label="Ruta"
            className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px] leading-4 text-[var(--color-nachipa-muted)]"
          >
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
                  {index > 0 ? (
                    <span aria-hidden className="text-[var(--color-nachipa-placeholder)]">
                      /
                    </span>
                  ) : null}
                  {crumb.to && !isLast ? (
                    <Link
                      to={crumb.to}
                      className="hover:text-[var(--color-nachipa-body)] hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        isLast
                          ? "text-[var(--color-nachipa-secondary)]"
                          : undefined
                      }
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        ) : null}
        <h1 className="text-[20px] font-semibold leading-[26px] text-[var(--color-nachipa-title)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[13px] leading-[19px] text-[var(--color-nachipa-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
