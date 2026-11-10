import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { ChevronDown, FileStack, Pencil } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listApprovalFlowsRequest,
  type ApprovalFlowListItem,
} from "../../lib/api/approvalFlows";
import {
  deletePermitTypeRequest,
  getPermitTypeRequest,
  listPermitChecklistItemsRequest,
  listPermitTypeRequirementsRequest,
  updatePermitTypeRequest,
  type PermitAstMode,
  type PermitChecklistItem,
  type PermitCriticality,
  type PermitType,
  type PermitTypeRequirement,
} from "../../lib/api/permitTypes";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";
import { PermitTypeChecklistPanel } from "./PermitTypeChecklistPanel";
import { PermitTypeRequirementsPanel } from "./PermitTypeRequirementsPanel";

/** Etiqueta de criticidad. */
function criticalityLabel(c: PermitCriticality): string {
  if (c === "high") return "Alta";
  if (c === "medium") return "Media";
  return "Baja";
}

/** Form edición del encabezado. */
type EditForm = {
  name: string;
  criticality: PermitCriticality;
  requiresAst: boolean;
  astMode: PermitAstMode | "";
  description: string;
  /** Id del flujo default; "" = sin asignar. */
  defaultApprovalFlowId: string;
  active: boolean;
};

/** Clase de selects del modal. */
const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/**
 * Ficha de tipo: datos + exigencias (P15) + checklist.
 * Encabezado y nested editables (admin/superadmin).
 */
export function PermitTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canManage =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";

  const [permitType, setPermitType] = useState<PermitType | null>(null);
  const [requirements, setRequirements] = useState<PermitTypeRequirement[]>(
    [],
  );
  const [checklist, setChecklist] = useState<PermitChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Confirmar desactivar tipo con Modal del sistema. */
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  /** Flujos activos de la empresa del tipo (select P15d). */
  const [flows, setFlows] = useState<ApprovalFlowListItem[]>([]);

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

  /** Carga flujos activos del tenant del tipo para el select. */
  useEffect(() => {
    if (!accessToken || !permitType || !canManage) return;
    void listApprovalFlowsRequest(accessToken, 1, 100, {
      businessId: permitType.businessId,
      active: true,
    })
      .then((res) => setFlows(res.items))
      .catch(() => setFlows([]));
  }, [accessToken, permitType, canManage]);

  /** Abre modal con datos actuales. */
  function openEdit() {
    if (!permitType) return;
    setForm({
      name: permitType.name,
      criticality: permitType.criticality,
      requiresAst: permitType.requiresAst,
      astMode: permitType.astMode ?? "",
      description: permitType.description ?? "",
      defaultApprovalFlowId: permitType.defaultApprovalFlowId ?? "",
      active: permitType.active,
    });
    setEditOpen(true);
  }

  /** Guarda PATCH del encabezado. */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !id || !form || submitting) return;
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    if (form.requiresAst && !form.astMode) {
      showToast("Elegí el modo AST.", "danger");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await updatePermitTypeRequest(accessToken, id, {
        name: form.name.trim(),
        criticality: form.criticality,
        requiresAst: form.requiresAst,
        astMode: form.requiresAst ? (form.astMode as PermitAstMode) : null,
        description: form.description.trim() || undefined,
        defaultApprovalFlowId: form.defaultApprovalFlowId || null,
        active: form.active,
      });
      setPermitType(updated);
      setEditOpen(false);
      showToast("Tipo actualizado.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Soft-delete y vuelve al listado (tras Modal). */
  async function confirmDeactivate() {
    if (!accessToken || !id || !permitType || deactivating) return;
    setDeactivating(true);
    try {
      await deletePermitTypeRequest(accessToken, id);
      showToast("Tipo desactivado.", "success");
      setDeactivateOpen(false);
      void navigate("/prevencion/tipos");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desactivar.",
        "danger",
      );
    } finally {
      setDeactivating(false);
    }
  }

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
            "Exigencias y checklist del tipo."
          }
          actions={
            canManage && permitType ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  onClick={openEdit}
                >
                  <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
                  Editar
                </Button>
                <button
                  type="button"
                  onClick={() => setDeactivateOpen(true)}
                  className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                >
                  Desactivar
                </button>
              </div>
            ) : null
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
                    {criticalityLabel(permitType.criticality)}
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
                <div>
                  <dt className="text-[11px] text-[var(--color-nachipa-secondary)]">
                    Flujo de aprobación
                  </dt>
                  <dd className="m-0 mt-0.5 text-[13px] text-[var(--color-nachipa-title)]">
                    {permitType.defaultApprovalFlow
                      ? `${permitType.defaultApprovalFlow.code} · ${permitType.defaultApprovalFlow.name} (${permitType.defaultApprovalFlow.stageCount} etapas)`
                      : "Sin asignar"}
                  </dd>
                </div>
              </dl>
            </section>

            <PermitTypeRequirementsPanel
              permitTypeId={permitType.id}
              permitTypeCode={permitType.code}
              businessId={permitType.businessId}
              items={requirements}
              canManage={canManage}
              onChanged={() => {
                void load();
              }}
            />

            <PermitTypeChecklistPanel
              permitTypeId={permitType.id}
              items={checklist}
              canManage={canManage}
              onChanged={() => {
                void load();
              }}
            />
          </div>
        )}
      </div>

      <Modal
        open={editOpen && form !== null}
        onClose={() => {
          if (!submitting) setEditOpen(false);
        }}
        icon={Pencil}
        title="Editar tipo de permiso"
        subtitle={permitType ? `Código ${permitType.code} (fijo).` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setEditOpen(false)}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="permit-type-edit-form"
              size="medium"
              className="!w-auto"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        {form ? (
          <form
            id="permit-type-edit-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => void onSubmit(e)}
          >
            <TextField
              label="Nombre"
              name="name"
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, name: e.target.value } : f))
              }
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Criticidad
              </span>
              <select
                className={selectClass}
                value={form.criticality}
                onChange={(e) =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          criticality: e.target.value as PermitCriticality,
                        }
                      : f,
                  )
                }
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>
            <TextField
              label="Descripción"
              name="description"
              value={form.description}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, description: e.target.value } : f,
                )
              }
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Flujo de aprobación
              </span>
              <span className="relative block w-full">
                <select
                  className={`${selectClass} appearance-none pr-10`}
                  value={form.defaultApprovalFlowId}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? { ...f, defaultApprovalFlowId: e.target.value }
                        : f,
                    )
                  }
                  name="defaultApprovalFlowId"
                  autoComplete="off"
                >
                  <option value="">Sin asignar</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.code} · {flow.name}
                      {flow.isSystem ? " (sistema)" : ""} · {flow.stageCount}{" "}
                      etapas
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-icon-default)]"
                  aria-hidden
                />
              </span>
              <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                Se congela en cada permiso nuevo de este tipo.
              </span>
            </label>
            <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Exige AST
                </span>
                <Toggle
                  checked={form.requiresAst}
                  aria-label="Exige AST"
                  onChange={(checked) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            requiresAst: checked,
                            astMode: checked ? f.astMode || "form" : "",
                          }
                        : f,
                    )
                  }
                />
              </div>
              {form.requiresAst ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                    Modo AST
                  </span>
                  <select
                    className={selectClass}
                    value={form.astMode}
                    onChange={(e) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              astMode: e.target.value as PermitAstMode | "",
                            }
                          : f,
                      )
                    }
                  >
                    <option value="form">Formulario</option>
                    <option value="pdf">PDF</option>
                    <option value="both">Ambos</option>
                  </select>
                </label>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Activo
              </span>
              <Toggle
                checked={form.active}
                aria-label="Activo"
                onChange={(checked) =>
                  setForm((f) => (f ? { ...f, active: checked } : f))
                }
              />
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={deactivateOpen}
        onClose={() => {
          if (!deactivating) setDeactivateOpen(false);
        }}
        title="Desactivar tipo de permiso"
        subtitle={
          permitType
            ? `¿Desactivar «${permitType.code}»? Quedará inactivo y no se ofrecerá en permisos nuevos.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deactivating}
              onClick={() => setDeactivateOpen(false)}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={deactivating}
              onClick={() => {
                void confirmDeactivate();
              }}
            >
              {deactivating ? "Desactivando…" : "Desactivar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
          Las exigencias e historial se conservan; solo se desactiva el tipo.
        </p>
      </Modal>
    </div>
  );
}
