import { Navigate, Outlet } from "react-router";
import { userHasPermission } from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";

type PermissionOption = {
  /** Recurso del catálogo de Roles. */
  resource: string;
  /** Acción requerida (read / create / …). */
  action: string;
};

type Props = {
  /** Pasa si el usuario tiene al menos uno de estos pares. */
  options: ReadonlyArray<PermissionOption>;
  /**
   * Ruta de respaldo si no tiene ninguno.
   * Default `/` = Panel.
   */
  fallbackTo?: string;
};

/**
 * Guard de ruta con OR de permisos (p. ej. Catálogos / Flota con varios maestros).
 */
export function RequireAnyPermission({
  options,
  fallbackTo = "/",
}: Props) {
  const { user } = useAuth();

  const allowed = options.some((opt) =>
    userHasPermission(user, opt.resource, opt.action),
  );

  if (!allowed) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <Outlet />;
}
