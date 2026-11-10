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
import { userHasPermission } from "../../lib/api/auth";
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

/** Mínimo de etapas (inicio + Prevención + cierre). */
const MIN_FLOW_STAGES = 3;

/**
 * ¿La etapa es cierre final? (misma heurística que el motor API).
 */
function isFinalCloseStage(stage: {
  key: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
}): boolean {
  const k = stage.key.toLowerCase();
  const isRequestClose =
    k === "request_close" ||
    k.includes("request_close") ||
    k.includes("pedir_cierre");
  const isCloseKey =
    !isRequestClose &&
    (k === "close" ||
      k === "cierra" ||
      k === "captain_close" ||
      k.includes("close") ||
      k.includes("cierre") ||
      k.includes("cierra"));
  if (isCloseKey) return true;
  if (isRequestClose && stage.actor === "prevention") return true;
  if (
    stage.moment === "on_finish" &&
    (stage.actor === "prevention" || stage.actor === "captain")
  ) {
    return true;
  }
  return false;
}

/** Inicio / solicitud (aviso). No cuenta cierres (request_close). */
function isStartOrRequestStage(stage: {
  key: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
}): boolean {
  if (isFinalCloseStage(stage)) return false;
  if (stage.actor === "requesting_area") return true;
  const k = stage.key.toLowerCase();
  const isRequestClose =
    k === "request_close" ||
    k.includes("request_close") ||
    k.includes("pedir_cierre");
  return (
    k === "notice" ||
    k.includes("notice") ||
    k.includes("aviso") ||
    k.includes("solicitud") ||
    (k.includes("request") && !isRequestClose)
  );
}

/** Prevención que no es el cierre. */
function isPreventionApprovalStage(stage: {
  key: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
}): boolean {
  if (stage.actor !== "prevention") return false;
  if (isFinalCloseStage(stage)) return false;
  return true;
}

/** Rol de orden en el flujo (select al agregar). */
type StagePlacement = "start" | "middle" | "end";

/**
 * Tipo de etapa para tabla / form (misma lógica que Inicio · Intermedio · Cierre).
 */
function stagePlacementOf(stage: {
  key: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
}): StagePlacement {
  if (isFinalCloseStage(stage)) return "end";
  if (isStartOrRequestStage(stage)) return "start";
  return "middle";
}

/** Etiqueta corta del tipo de etapa. */
function stageTypeLabel(stage: {
  key: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
}): string {
  switch (stagePlacementOf(stage)) {
    case "start":
      return "Inicio / solicitud";
    case "end":
      return "Cierre / fin";
    default:
      return "Intermedio";
  }
}

/** Form de etapa (alta / edición). */
type StageForm = {
  placement: StagePlacement;
  key: string;
  label: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
  requiresSignature: boolean;
  mandatory: boolean;
};

/**
 * Plantilla según Inicio / Intermedio / Cierre.
 * Clave libre si ya está usada.
 */
function stageFormForPlacement(
  placement: StagePlacement,
  stages: ReadonlyArray<ApprovalFlowStage>,
): StageForm {
  const used = new Set(stages.map((s) => s.key));
  const uniqueKey = (preferred: string, fallback: string) =>
    used.has(preferred) ? fallback : preferred;

  if (placement === "start") {
    return {
      placement,
      key: uniqueKey("notice", "inicio_solicitud"),
      label: "Informa los trabajos y las contratistas que irán a bordo",
      actor: "requesting_area",
      moment: "before",
      requiresSignature: false,
      mandatory: true,
    };
  }
  if (placement === "end") {
    return {
      placement,
      key: uniqueKey("close", "cierre_trabajo"),
      label: "Cierra el trabajo",
      actor: "captain",
      moment: "on_finish",
      requiresSignature: true,
      mandatory: true,
    };
  }
  return {
    placement,
    key: uniqueKey("approve", `etapa_${stages.length + 1}`),
    label: "Valida los datos y aprueba el permiso",
    actor: "prevention",
    moment: "before",
    requiresSignature: true,
    mandatory: true,
  };
}

/** Prefill al abrir «Agregar»: prioriza lo que falta. */
function suggestNewStageForm(
  stages: ReadonlyArray<ApprovalFlowStage>,
): StageForm {
  const hasStart = stages.some((s) => isStartOrRequestStage(s));
  const hasPrevention = stages.some((s) => isPreventionApprovalStage(s));
  const hasClose = stages.some((s) => isFinalCloseStage(s));
  if (!hasStart) return stageFormForPlacement("start", stages);
  if (!hasPrevention) return stageFormForPlacement("middle", stages);
  if (!hasClose) return stageFormForPlacement("end", stages);
  return stageFormForPlacement("middle", stages);
}

/**
 * P15e / P15f · Detalle de flujo de aprobación.
 * Sistema: solo lectura + Duplicar. Personalizado: editar etapas.
 */
export function ApprovalFlowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  /** Lectura del detalle. */
  const canRead = userHasPermission(user, "approval_flows", "read");
  /** Crear copia (Duplicar). */
  const canCreate = userHasPermission(user, "approval_flows", "create");
  /** Editar etapas / metadatos. */
  const canUpdate = userHasPermission(user, "approval_flows", "update");
  /** Soft-delete del flujo. */
  const canDeactivate = userHasPermission(user, "approval_flows", "deactivate");

  const [flow, setFlow] = useState<ApprovalFlowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [stageModal, setStageModal] = useState<"add" | "edit" | null>(null);
  const [editingStage, setEditingStage] = useState<ApprovalFlowStage | null>(
    null,
  );
  const [stageForm, setStageForm] = useState<StageForm>(() =>
    suggestNewStageForm([]),
  );
  const [pendingRemove, setPendingRemove] = useState<ApprovalFlowStage | null>(
    null,
  );
  /** Soft-delete del flujo personalizado. */
  const [confirmDeleteFlow, setConfirmDeleteFlow] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !id || !canRead) return;
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
  }, [accessToken, id, canRead, showToast]);

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
    setStageForm(suggestNewStageForm(flow?.stages ?? []));
    setStageModal("add");
  }

  function openEditStage(stage: ApprovalFlowStage) {
    setEditingStage(stage);
    setStageForm({
      placement: stagePlacementOf(stage),
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
              placement: stageForm.placement,
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

  const startCount = flow
    ? flow.stages.filter((s) => isStartOrRequestStage(s)).length
    : 0;
  const preventionCount = flow
    ? flow.stages.filter((s) => isPreventionApprovalStage(s)).length
    : 0;
  const finalCloseCount = flow
    ? flow.stages.filter((s) => isFinalCloseStage(s)).length
    : 0;
  const flowCoverageOk =
    Boolean(flow) &&
    flow!.stages.length >= MIN_FLOW_STAGES &&
    startCount === 1 &&
    preventionCount >= 1 &&
    finalCloseCount === 1;

  /**
   * Se puede quitar si:
   * - sobra un cierre o un inicio duplicado, o
   * - al sacar la etapa sigue habiendo inicio + Prevención + cierre (≥ 3).
   */
  function canRemoveStage(stage: ApprovalFlowStage): boolean {
    if (!flow || flow.stages.length <= 1) return false;
    /** Duplicados: siempre se pueden limpiar. */
    if (isFinalCloseStage(stage) && finalCloseCount > 1) return true;
    if (isStartOrRequestStage(stage) && startCount > 1) return true;

    if (flow.stages.length <= MIN_FLOW_STAGES) return false;
    let nextStart = startCount;
    let nextPrev = preventionCount;
    let nextClose = finalCloseCount;
    if (isStartOrRequestStage(stage)) nextStart -= 1;
    if (isPreventionApprovalStage(stage)) nextPrev -= 1;
    if (isFinalCloseStage(stage)) nextClose -= 1;
    return nextStart >= 1 && nextPrev >= 1 && nextClose >= 1;
  }

  /** Texto cuando la etapa no se puede quitar. */
  function requiredStageLabel(stage: ApprovalFlowStage): string {
    if (isFinalCloseStage(stage) && finalCloseCount <= 1) {
      return "Cierre requerido";
    }
    if (isStartOrRequestStage(stage) && startCount <= 1) {
      return "Inicio requerido";
    }
    if (isPreventionApprovalStage(stage) && preventionCount <= 1) {
      return "Prevención requerida";
    }
    if (flow && flow.stages.length <= MIN_FLOW_STAGES) {
      return "Mín. 3 etapas";
    }
    return "—";
  }

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Configuración"
          breadcrumbIcon={GitBranch}
          actions={<UserMenu />}
        />
        <div className="px-6 py-5 text-[13px] text-[var(--color-nachipa-secondary)]">
          No tenés permiso para ver este flujo.
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
                {flow.isSystem && canCreate ? (
                  <Button
                    type="button"
                    size="medium"
                    className="!w-auto"
                    disabled={busy}
                    onClick={() => void onDuplicate()}
                  >
                    + Duplicar flujo
                  </Button>
                ) : null}
                {!flow.isSystem && canUpdate ? (
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
                  </>
                ) : null}
                {!flow.isSystem && canDeactivate ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-status-danger,#b42318)] bg-white px-3 text-[13px] font-medium text-[var(--color-status-danger,#b42318)]"
                    disabled={busy}
                    onClick={() => setConfirmDeleteFlow(true)}
                  >
                    Eliminar flujo
                  </button>
                ) : null}
              </div>
            ) : null
          }
        />

        {!loading && flow && (finalCloseCount > 1 || startCount > 1) ? (
          <p
            className="m-0 rounded-[var(--radius-md)] border border-[var(--color-status-warning-fg,#d97706)]/30 bg-[var(--color-status-warning-bg,#fef3c7)] px-3 py-2 text-[13px] text-[var(--color-status-warning-fg,#d97706)]"
            role="alert"
          >
            Solo puede haber un inicio y un cierre.
            {finalCloseCount > 1
              ? ` Tenés ${finalCloseCount} cierres: quitá los de más.`
              : ""}
            {startCount > 1
              ? ` Tenés ${startCount} inicios: quitá los de más.`
              : ""}
          </p>
        ) : null}

        {!loading && flow && !flowCoverageOk && finalCloseCount <= 1 && startCount <= 1 ? (
          <p
            className="m-0 rounded-[var(--radius-md)] border border-[var(--color-status-danger,#b42318)]/30 bg-[var(--color-status-danger-bg,#fef2f2)] px-3 py-2 text-[13px] text-[var(--color-status-danger-fg,#b42318)]"
            role="alert"
          >
            Todo flujo necesita al menos 3 etapas: inicio/solicitud, aprobación
            de Prevención y cierre
            {startCount < 1 ? " · falta inicio" : ""}
            {preventionCount < 1 ? " · falta Prevención" : ""}
            {finalCloseCount < 1 ? " · falta cierre" : ""}
            {flow.stages.length < MIN_FLOW_STAGES
              ? ` · hoy ${flow.stages.length}`
              : ""}
            . Usá «Agregar etapa».
          </p>
        ) : null}

        {!loading && flow ? (
          <DataTableCard>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-tremor-border)] bg-[var(--color-table-head-bg,#f8f9fb)]">
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Etapa
                    </th>
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Tipo de etapa
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
                    <th className="h-10 px-4 font-semibold text-[var(--color-table-head-text)]">
                      Acciones
                    </th>
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
                      <td className="h-12 whitespace-nowrap px-4 text-[var(--color-nachipa-body)]">
                        {stageTypeLabel(stage)}
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
                        {flow.isSystem || !canUpdate ? (
                          <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            {flow.isSystem ? "Fija" : "—"}
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
                            {canRemoveStage(stage) ? (
                              <button
                                type="button"
                                className="text-[13px] font-medium text-[var(--color-status-danger,#b42318)] hover:underline"
                                onClick={() => setPendingRemove(stage)}
                              >
                                Quitar
                              </button>
                            ) : (
                              <span
                                className="text-[12px] text-[var(--color-nachipa-secondary)]"
                                title="El flujo debe conservar al menos un cierre"
                              >
                                {requiredStageLabel(stage)}
                              </span>
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
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Tipo de etapa *
                </span>
                <FieldSelect
                  name="stagePlacement"
                  value={stageForm.placement}
                  onChange={(e) => {
                    const placement = e.target.value as StagePlacement;
                    setStageForm(
                      stageFormForPlacement(placement, flow?.stages ?? []),
                    );
                  }}
                  required
                >
                  <option value="start" disabled={startCount >= 1}>
                    Inicio / solicitud
                    {startCount >= 1 ? " (ya existe)" : ""}
                  </option>
                  <option value="middle">Intermedio</option>
                  <option value="end" disabled={finalCloseCount >= 1}>
                    Cierre / fin
                    {finalCloseCount >= 1 ? " (ya existe)" : ""}
                  </option>
                </FieldSelect>
                <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                  Solo un inicio y un cierre. Intermedio va antes del cierre.
                </span>
              </label>
              <TextField
                label="Clave * (snake_case)"
                name="key"
                value={stageForm.key}
                onChange={(e) =>
                  setStageForm((f) => ({ ...f, key: e.target.value }))
                }
                required
              />
            </>
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
