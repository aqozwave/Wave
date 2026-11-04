import { useCallback, useEffect, useState } from "react";
import { FileStack } from "lucide-react";
import { Link, useParams } from "react-router";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  getPermitTypeRequest,
  listPermitChecklistItemsRequest,
  listPermitTypeRequirementsRequest,
  type PermitChecklistItem,
  type PermitType,
  type PermitTypeRequirement,
} from "../../lib/api/permitTypes";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Etiqueta de momento. */
function momentLabel(m: "before" | "closure"): string {
  return m === "before" ? "Antes" : "Cierre";
}

/** Etiqueta de kind. */
function kindLabel(k: PermitTypeRequirement["kind"]): string {
  if (k === "document") return "Documento";
  if (k === "training") return "Capacitación";
  return "Checklist";
}

/**
 * Ficha de tipo: datos + exigencias (P15) + ítems de checklist.
 * Solo lectura en este slice.
 */
export function PermitTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [permitType, setPermitType] = useState<PermitType | null>(null);
  const [requirements, setRequirements] = useState<PermitTypeRequirement[]>(
    [],
  );
  const [checklist, setChecklist] = useState<PermitChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      const [type, reqs, items] = await Promise.all([
        getPermitTypeRequest(accessToken, id),
        listPermitTypeRequirementsRequest(accessToken, id),
        listPermitChecklistItemsRequest(accessToken, id),
      ]);
      setPermitType(type);
      setRequirements(reqs.items);
      setChecklist(items.items);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar el tipo",
        "danger",
      );
      setPermitType(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Prevención"
        breadcrumbIcon={FileStack}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Prevención", to: "/prevencion" },
            { label: "Tipos de permiso", to: "/prevencion/tipos" },
            {
              label: permitType
                ? `${permitType.code} · ${permitType.name}`
                : "Detalle",
            },
          ]}
          title={
            permitType
              ? `${permitType.code} · ${permitType.name}`
              : "Tipo de permiso"
          }
          description={
            permitType?.description ??
            "Exigencias y checklist del tipo (lectura)."
          }
        />

        {loading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando…
          </p>
        ) : !permitType ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Tipo no encontrado.{" "}
            <Link
              to="/prevencion/tipos"
              className="text-[var(--color-nachipa-primary)] hover:underline"
            >
              Volver al listado
            </Link>
          </p>
        ) : (
          <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
            <section className="rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-4">
              <h2 className="m-0 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
                Datos del tipo
              </h2>
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] text-[var(--color-nachipa-secondary)]">
                    Criticidad
                  </dt>
                  <dd className="m-0 mt-0.5 text-[13px] text-[var(--color-nachipa-title)]">
                    {permitType.criticality}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--color-nachipa-secondary)]">
                    AST
                  </dt>
                  <dd className="m-0 mt-0.5 text-[13px] text-[var(--color-nachipa-title)]">
                    {permitType.requiresAst
                      ? (permitType.astMode ?? "requerido")
                      : "No"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[var(--color-nachipa-secondary)]">
                    Estado
                  </dt>
                  <dd className="m-0 mt-0.5">
                    <StatusChip
                      tone={permitType.active ? "success" : "neutral"}
                    >
                      {permitType.active ? "Activo" : "Inactivo"}
                    </StatusChip>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white">
              <div className="border-b border-[var(--color-tremor-border)] px-4 py-3">
                <h2 className="m-0 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
                  Exigencias ({requirements.length})
                </h2>
                <p className="m-0 mt-0.5 text-[12px] text-[var(--color-nachipa-secondary)]">
                  Documentos, capacitaciones y checklist requeridos.
                </p>
              </div>
              {requirements.length === 0 ? (
                <p className="m-0 px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Sin exigencias activas.
                </p>
              ) : (
                <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] p-0">
                  {requirements.map((req) => (
                    <li
                      key={req.id}
                      className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="m-0 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                          {req.label}
                        </p>
                        <p className="m-0 mt-0.5 text-[11px] text-[var(--color-nachipa-secondary)]">
                          {req.key}
                          {req.trainingCode
                            ? ` · ${req.trainingCode}`
                            : null}
                          {req.documentType
                            ? ` · ${req.documentType.code}`
                            : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusChip tone="info">{kindLabel(req.kind)}</StatusChip>
                        <StatusChip tone="neutral">
                          {momentLabel(req.moment)}
                        </StatusChip>
                        {req.mandatory ? (
                          <StatusChip tone="warning">Obligatorio</StatusChip>
                        ) : (
                          <StatusChip tone="neutral">Opcional</StatusChip>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white">
              <div className="border-b border-[var(--color-tremor-border)] px-4 py-3">
                <h2 className="m-0 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
                  Checklist ({checklist.length})
                </h2>
              </div>
              {checklist.length === 0 ? (
                <p className="m-0 px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                  Sin ítems de checklist.
                </p>
              ) : (
                <ol className="m-0 list-decimal space-y-2 px-4 py-3 pl-8 text-[13px] text-[var(--color-nachipa-title)]">
                  {checklist.map((item) => (
                    <li key={item.id}>{item.text}</li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
