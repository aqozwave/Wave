import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { FileStack, Pencil } from "lucide-react";
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
  active: boolean;
};

/** Clase de selects del modal. */
const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/**
 * Ficha de tipo: datos + exigencias (P15) + checklist.
 * Encabezado editable (admin); nested sigue solo lectura en este slice.
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

  /** Abre modal con datos actuales. */
  function openEdit() {
    if (!permitType) return;
    setForm({
      name: permitType.name,
      criticality: permitType.criticality,
      requiresAst: permitType.requiresAst,
      astMode: permitType.astMode ?? "",
      description: permitType.description ?? "",
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

  /** Soft-delete y vuelve al listado. */
  async function onDeactivate() {
    if (!accessToken || !id || !permitType) return;
    const ok = window.confirm(
      `¿Desactivar el tipo «${permitType.code}»? Quedará inactivo.`,
    );
    if (!ok) return;
    try {
      await deletePermitTypeRequest(accessToken, id);
      showToast("Tipo desactivado.", "success");
      void navigate("/prevencion/tipos");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desactivar.",
        "danger",
      );
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
                  onClick={() => {
                    void onDeactivate();
                  }}
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
    </div>
  );
}
