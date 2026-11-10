import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown, GitBranch, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../../components/Button/Button";
import {
  DataTableCard,
} from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  addApprovalFlowStageRequest,
  createApprovalFlowRequest,
  deleteApprovalFlowRequest,
  deleteApprovalFlowStageRequest,
  getApprovalFlowRequest,
  updateApprovalFlowRequest,
  updateApprovalFlowStageRequest,
  type ApprovalFlowDetail,
  type ApprovalFlowStage,
  type ApprovalFlowStageActor,
  type ApprovalFlowStageMoment,
} from "../../lib/api/approvalFlows";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Tope de etapas (misma regla que API). */
const MAX_STAGES = 8;

/** Clase de textarea (misma altura visual que FieldSelect). */
const textareaClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/**
 * Select con chevron Lucide visible (no depende del browser).
 */
function FieldSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block w-full">
      <select
        {...props}
        className={[
          "h-[42px] w-full appearance-none rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 pr-10 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]",
          className ?? "",
        ].join(" ")}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.5}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-icon-default)]"
        aria-hidden
      />
    </span>
  );
}
/** Etiqueta actor. */
function actorLabel(actor: ApprovalFlowStageActor): string {
  switch (actor) {
    case "requesting_area":
      return "Área solicitante";
    case "prevention":
      return "Prevencionista";
    case "contractor":
      return "Contratista";
    case "captain":
      return "Capitán";
    default:
      return actor;
  }
}

/** Etiqueta momento. */
function momentLabel(moment: ApprovalFlowStageMoment): string {
  switch (moment) {
    case "before":
      return "Antes";
    case "on_arrival":
      return "Al llegar";
    case "on_finish":
      return "Al terminar";
    default:
      return moment;
  }
}

/** Form de etapa (alta / edición). */
type StageForm = {
  key: string;
  label: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
  requiresSignature: boolean;
  mandatory: boolean;
};

const EMPTY_STAGE: StageForm = {
  key: "request_close",
  label: "Registra el término y entrega el área",
  actor: "contractor",
  moment: "on_finish",
  requiresSignature: true,
  mandatory: false,
};

/**
 * P15e / P15f · Detalle de flujo de aprobación.
 * Sistema: solo lectura + Duplicar. Personalizado: editar etapas.
 */
export function ApprovalFlowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [flow, setFlow] = useState<ApprovalFlowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [stageModal, setStageModal] = useState<"add" | "edit" | null>(null);
  const [editingStage, setEditingStage] = useState<ApprovalFlowStage | null>(
    null,
  );
  const [stageForm, setStageForm] = useState<StageForm>(EMPTY_STAGE);
  const [pendingRemove, setPendingRemove] = useState<ApprovalFlowStage | null>(
    null,
  );
  /** Soft-delete del flujo personalizado. */
  const [confirmDeleteFlow, setConfirmDeleteFlow] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !id || !isSuperadmin) return;
    setLoading(true);
    try {
      const row = await getApprovalFlowRequest(accessToken, id);
      setFlow(row);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo cargar el flujo",
        "danger",
      );
      setFlow(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, isSuperadmin, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDuplicate() {
    if (!accessToken || !flow || !user?.businessId) return;
    setBusy(true);
    try {
      const created = await createApprovalFlowRequest(accessToken, {
        businessId: flow.businessId,
        code: `${flow.code}-C`.slice(0, 15),
        name: `${flow.name} (copia)`,
        description: flow.description,
        sourceFlowId: flow.id,
      });
      showToast(`Copia ${created.code} creada`, "success");
      void navigate(`/configuracion/flujos/${created.id}`);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo duplicar",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive() {
    if (!accessToken || !flow || flow.isSystem) return;
    setBusy(true);
    try {
      const updated = await updateApprovalFlowRequest(accessToken, flow.id, {
        active: !flow.active,
      });
      setFlow(updated);
      showToast(
        updated.active ? "Flujo activado" : "Flujo desactivado",
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo actualizar",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  function openAddStage() {
    setEditingStage(null);
    setStageForm(EMPTY_STAGE);
    setStageModal("add");
  }

  function openEditStage(stage: ApprovalFlowStage) {
    setEditingStage(stage);
    setStageForm({
      key: stage.key,
      label: stage.label,
      actor: stage.actor,
      moment: stage.moment,
      requiresSignature: stage.requiresSignature,
      mandatory: stage.mandatory,
    });
    setStageModal("edit");
  }

  async function onSaveStage(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !flow) return;
    setBusy(true);
    try {
      const updated =
        stageModal === "add"
          ? await addApprovalFlowStageRequest(accessToken, flow.id, {
              key: stageForm.key.trim(),
              label: stageForm.label.trim(),
              actor: stageForm.actor,
              moment: stageForm.moment,
              requiresSignature: stageForm.requiresSignature,
              mandatory: stageForm.mandatory,
            })
          : editingStage
            ? await updateApprovalFlowStageRequest(
                accessToken,
                flow.id,
                editingStage.id,
                {
                  label: stageForm.label.trim(),
                  actor: stageForm.actor,
                  moment: stageForm.moment,
                  requiresSignature: stageForm.requiresSignature,
                  mandatory: stageForm.mandatory,
                },
              )
            : null;
      if (updated) {
        setFlow(updated);
        setStageModal(null);
        showToast(
          stageModal === "add" ? "Etapa agregada" : "Etapa actualizada",
          "success",
        );
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar la etapa",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmRemove() {
    if (!accessToken || !flow || !pendingRemove) return;
    setBusy(true);
    try {
      const updated = await deleteApprovalFlowStageRequest(
        accessToken,
        flow.id,
        pendingRemove.id,
      );
      setFlow(updated);
      setPendingRemove(null);
      showToast("Etapa eliminada", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  /** Soft-delete del flujo y vuelta al listado. */
  async function onConfirmDeleteFlow() {
    if (!accessToken || !flow || flow.isSystem) return;
    setBusy(true);
    try {
      await deleteApprovalFlowRequest(accessToken, flow.id);
      showToast(`Flujo ${flow.code} eliminado`, "success");
      setConfirmDeleteFlow(false);
      void navigate("/configuracion/flujos");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar el flujo",
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isSuperadmin) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Configuración"
          breadcrumbIcon={GitBranch}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5 text-[13px] text-[var(--color-nachipa-secondary)]">
          Solo Superadmin.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Configuración"
        breadcrumbIcon={GitBranch}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader
          crumbs={[
            { label: "Configuración" },
            { label: "Flujos de aprobación", to: "/configuracion/flujos" },
            { label: flow?.name ?? "…" },
          ]}
          title={loading ? "Cargando…" : (flow?.name ?? "Flujo")}
          description={
            flow
              ? flow.isSystem
                ? `Flujo de sistema · ${flow.stageCount} etapas fijas · usado por ${flow.typeCount} tipo(s) · no editable`
                : `Personalizado · ${flow.stageCount} etapa(s) · usado por ${flow.typeCount} tipo(s)`
              : undefined
          }
          actions={
            flow ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={flow.active ? "success" : "neutral"}>
                  {flow.active ? "Activo" : "Inactivo"}
                </StatusChip>
                <StatusChip tone={flow.isSystem ? "info" : "warning"}>
                  {flow.isSystem ? "Sistema" : "Personalizado"}
                </StatusChip>
                {flow.isSystem ? (
                  <Button
                    type="button"
                    size="medium"
                    className="!w-auto"
                    disabled={busy}
                    onClick={() => void onDuplicate()}
                  >
                    + Duplicar flujo
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="medium"
                      className="!w-auto"
                      disabled={
                        busy || flow.stageCount >= MAX_STAGES
                      }
                      onClick={openAddStage}
                    >
                      <Plus size={16} strokeWidth={1.5} aria-hidden />
                      Agregar etapa
                    </Button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium"
                      disabled={busy}
                      onClick={() => void onToggleActive()}
                    >
                      {flow.active ? "Desactivar flujo" : "Activar flujo"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-status-danger,#b42318)] bg-white px-3 text-[13px] font-medium text-[var(--color-status-danger,#b42318)]"
                      disabled={busy}
                      onClick={() => setConfirmDeleteFlow(true)}
                    >
                      Eliminar flujo
                    </button>
                  </>
                )}
              </div>
            ) : null
          }
        />

        {!loading && flow ? (
          <DataTableCard>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg,#f8f9fb)]">
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Etapa
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Qué se hace
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Quién
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Momento
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Firma
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Obligatoria
                    </th>
                    {!flow.isSystem ? (
                      <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                        Acciones
                      </th>
                    ) : (
                      <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                        Tipo
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {flow.stages.map((stage) => (
                    <tr
                      key={stage.id}
                      className="border-b border-[var(--color-nachipa-border-subtle)]"
                    >
                      <td className="h-12 px-4 tabular-nums font-medium">
                        {stage.position}
                      </td>
                      <td className="h-12 max-w-md px-4 text-[var(--color-nachipa-title)]">
                        {stage.label}
                      </td>
                      <td className="h-12 px-4">
                        {actorLabel(stage.actor)}
                      </td>
                      <td className="h-12 px-4">
                        {momentLabel(stage.moment)}
                      </td>
                      <td className="h-12 px-4">
                        {stage.requiresSignature ? "Sí" : "No"}
                      </td>
                      <td className="h-12 px-4">
                        <StatusChip
                          tone={stage.mandatory ? "success" : "neutral"}
                        >
                          {stage.mandatory ? "Obligatoria" : "Opcional"}
                        </StatusChip>
                      </td>
                      <td className="h-12 px-4">
                        {flow.isSystem ? (
                          <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            Fija
                          </span>
                        ) : (
                          <span className="inline-flex gap-2">
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                              onClick={() => openEditStage(stage)}
                            >
                              Editar
                            </button>
                            {stage.fixed ? (
                              <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                                Fija
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="text-[13px] font-medium text-[var(--color-status-danger,#b42318)] hover:underline"
                                onClick={() => setPendingRemove(stage)}
                              >
                                Quitar
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataTableCard>
        ) : loading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando etapas…
          </p>
        ) : null}
      </div>

      <Modal
        open={stageModal !== null}
        onClose={() => setStageModal(null)}
        title={stageModal === "add" ? "Agregar etapa" : "Editar etapa"}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => void onSaveStage(e)}
        >
          {stageModal === "add" ? (
            <TextField
              label="Clave * (snake_case)"
              name="key"
              value={stageForm.key}
              onChange={(e) =>
                setStageForm((f) => ({ ...f, key: e.target.value }))
              }
              required
            />
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Qué se hace *
            </span>
            <textarea
              className={`${textareaClass} !h-20 resize-none py-2`}
              value={stageForm.label}
              onChange={(e) =>
                setStageForm((f) => ({ ...f, label: e.target.value }))
              }
              required
              minLength={3}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Quién *
            </span>
            <FieldSelect
              value={stageForm.actor}
              onChange={(e) =>
                setStageForm((f) => ({
                  ...f,
                  actor: e.target.value as ApprovalFlowStageActor,
                }))
              }
            >
              <option value="requesting_area">Área solicitante</option>
              <option value="prevention">Prevencionista</option>
              <option value="contractor">Contratista</option>
              <option value="captain">Capitán</option>
            </FieldSelect>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Momento *
            </span>
            <FieldSelect
              value={stageForm.moment}
              onChange={(e) =>
                setStageForm((f) => ({
                  ...f,
                  moment: e.target.value as ApprovalFlowStageMoment,
                }))
              }
            >
              <option value="before">Antes</option>
              <option value="on_arrival">Al llegar</option>
              <option value="on_finish">Al terminar</option>
            </FieldSelect>
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={stageForm.requiresSignature}
              onChange={(e) =>
                setStageForm((f) => ({
                  ...f,
                  requiresSignature: e.target.checked,
                }))
              }
            />
            Requiere firma
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={stageForm.mandatory}
              onChange={(e) =>
                setStageForm((f) => ({
                  ...f,
                  mandatory: e.target.checked,
                }))
              }
            />
            Obligatoria
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium"
              onClick={() => setStageModal(null)}
              disabled={busy}
            >
              Cancelar
            </button>
            <Button type="submit" className="!h-9 !w-auto" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title="Quitar etapa"
        subtitle={pendingRemove?.label}
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          ¿Confirmás quitar esta etapa del flujo?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium"
            onClick={() => setPendingRemove(null)}
            disabled={busy}
          >
            Cancelar
          </button>
          <Button
            type="button"
            className="!h-9 !w-auto"
            disabled={busy}
            onClick={() => void onConfirmRemove()}
          >
            {busy ? "Quitando…" : "Quitar"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmDeleteFlow}
        onClose={() => {
          if (!busy) setConfirmDeleteFlow(false);
        }}
        title="Eliminar flujo"
        subtitle={flow ? `${flow.code} · ${flow.name}` : undefined}
        maxWidthClass="max-w-[440px]"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDeleteFlow(false)}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium"
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={busy}
              onClick={() => void onConfirmDeleteFlow()}
            >
              {busy ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          Se da de baja este flujo personalizado
          {flow && flow.typeCount > 0
            ? ` (tiene ${flow.typeCount} tipo${flow.typeCount === 1 ? "" : "s"} asignado${flow.typeCount === 1 ? "" : "s"}; quedan sin flujo por defecto)`
            : ""}
          . El Estándar del sistema no se puede eliminar.
        </p>
      </Modal>
    </div>
  );
}
