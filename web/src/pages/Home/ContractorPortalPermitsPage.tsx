import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  DataTableCard,
} from "../../components/DataTableCard/DataTableCard";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listWorkPermitsRequest,
  workPermitStatusLabel,
  type WorkPermit,
  type WorkPermitStatus,
} from "../../lib/api/workPermits";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { WorkPermitCompleteModal } from "../Prevencion/WorkPermitCompleteModal";

/** dd-mm-yyyy. */
function formatDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** Tono chip. */
function statusTone(
  status: WorkPermitStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "to_approve":
      return "info";
    case "to_receive":
    case "to_verify":
    case "to_complete":
      return "warning";
    case "no_closure":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Portal contratista — mis permisos de trabajo.
 * Completar personal/checklist y enviar a aprobación (E12/E13).
 */
export function ContractorPortalPermitsPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<WorkPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [completeRow, setCompleteRow] = useState<WorkPermit | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !user?.organizationId) return;
    setLoading(true);
    try {
      const result = await listWorkPermitsRequest(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar permisos",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.organizationId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user?.organizationId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar breadcrumb="Mi empresa" actions={<UserMenu />} />
        <div className="px-6 py-5">
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Esta pantalla es para usuarios del portal contratista.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Mi empresa"
        breadcrumbIcon={ClipboardCheck}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[{ label: "Permisos de trabajo" }]}
          title="Mis permisos de trabajo"
          description="Completá personal y checklist, y envialo a Prevención."
        />

        <DataTableCard>
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                <th className="px-3 py-2.5">Permiso</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Nave</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-[var(--color-nachipa-secondary)]"
                  >
                    Todavía no tenés permisos asignados.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-tremor-border)]"
                  >
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                      {row.code}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.permitType.code} · {row.permitType.name}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
                      {row.location.name}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
                      {formatDate(row.scheduledDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip tone={statusTone(row.status)}>
                        {workPermitStatusLabel(row.status)}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {row.status === "to_complete" ? (
                        <button
                          type="button"
                          className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                          onClick={() => setCompleteRow(row)}
                        >
                          Completar
                        </button>
                      ) : (
                        <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      {accessToken ? (
        <WorkPermitCompleteModal
          open={Boolean(completeRow)}
          permit={completeRow}
          accessToken={accessToken}
          mode="portal"
          onClose={() => setCompleteRow(null)}
          onDone={() => void load()}
        />
      ) : null}
    </div>
  );
}
