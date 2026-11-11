import { Navigate, Outlet } from "react-router";
import { userHasPermission } from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";

type Props = {
  /** Recurso del catálogo de Roles (p. ej. embarcados). */
  resource: string;
  /** Acción requerida (read / create / …). */
  action: string;
  /**
   * Ruta de respaldo si no tiene permiso.
   * Default `/` = Panel / home según rol.
   */
  fallbackTo?: string;
};

/**
 * Guard de ruta: sin el permiso del rol, no monta la pantalla.
 * Evita URLs “vacías” (listado 403) cuando el menú ya ocultó el módulo.
 */
export function RequirePermission({
  resource,
  action,
  fallbackTo = "/",
}: Props) {
  const { user } = useAuth();

  if (!userHasPermission(user, resource, action)) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <Outlet />;
}
