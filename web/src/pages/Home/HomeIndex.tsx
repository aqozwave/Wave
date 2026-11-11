import { useAuth } from "../../lib/auth/AuthContext";
import { Panel } from "../Panel/Panel";
import { ContratistaHome } from "./ContratistaHome";
import { TripulanteHome } from "./TripulanteHome";

/**
 * Entrada de `/`: elige el home según el rol (Figma S1 / D1 / C1 / E3 / T*).
 * Admin, RR.HH., prevencionista y solicitante de trabajos usan el Panel OMI (empresa).
 */
export function HomeIndex() {
  const { user } = useAuth();
  const rol = user?.internalRol ?? "";

  // Usuario externo invitado a una org (P9b) → portal E3b / faena.
  if (
    user?.organizationId ||
    rol === "contratista" ||
    rol === "contratista_faena"
  ) {
    return <ContratistaHome />;
  }
  if (rol === "user") {
    return <TripulanteHome />;
  }
  return <Panel />;
}
