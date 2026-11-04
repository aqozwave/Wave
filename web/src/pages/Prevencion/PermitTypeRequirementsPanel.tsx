import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  listDocumentTypesRequest,
  type DocumentType,
} from "../../lib/api/documentTypes";
import {
  createPermitTypeRequirementRequest,
  deletePermitTypeRequirementRequest,
  updatePermitTypeRequirementRequest,
  type AccreditationScope,
  type PermitRequirementKind,
  type PermitRequirementMoment,
  type PermitRequirementScope,
  type PermitTypeRequirement,
} from "../../lib/api/permitTypes";
import {
  listTrainingsRequest,
  type Training,
} from "../../lib/api/trainings";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  /** Id del tipo de permiso. */
  permitTypeId: string;
  /** Código del tipo (para sugerir key). */
  permitTypeCode: string;
  /** Empresa del tipo (filtros de catálogos). */
  businessId: string;
  /** Filas actuales. */
  items: PermitTypeRequirement[];
  /** Tras mutar, recargar listado. */
  onChanged: () => void;
  /** Si false, solo lectura. */
  canManage: boolean;
};

/** Form exigencia. */
type ReqForm = {
  key: string;
  kind: PermitRequirementKind;
  scope: PermitRequirementScope;
  moment: PermitRequirementMoment;
  mandatory: boolean;
  label: string;
  documentTypeId: string;
  accreditationScope: "" | AccreditationScope;
  trainingId: string;
  active: boolean;
};

/** Form vacío. */
function emptyForm(code: string): ReqForm {
  const prefix = code.trim().toLowerCase() || "tipo";
  return {
    key: `${prefix}.`,
    kind: "document",
    scope: "company",
    moment: "before",
    mandatory: true,
    label: "",
    documentTypeId: "",
    accreditationScope: "",
    trainingId: "",
    active: true,
  };
}

/** Etiqueta de momento. */
function momentLabel(m: PermitRequirementMoment): string {
  return m === "before" ? "Antes" : "Cierre";
}

/** Etiqueta de kind. */
function kindLabel(k: PermitRequirementKind): string {
  if (k === "document") return "Documento";
  if (k === "training") return "Capacitación";
  return "Checklist";
}

const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/**
 * Sección Exigencias de la ficha de tipo (P15).
 * Alta / editar / desactivar; selectores de doc y capacitación.
 */
export function PermitTypeRequirementsPanel({
  permitTypeId,
  permitTypeCode,
  businessId,
  items,
  onChanged,
  canManage,
}: Props) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [docs, setDocs] = useState<DocumentType[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PermitTypeRequirement | null>(null);
  const [form, setForm] = useState<ReqForm>(() => emptyForm(permitTypeCode));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken || !open) return;
    void Promise.all([
      listDocumentTypesRequest(accessToken, 1, 100, { businessId }),
      listTrainingsRequest(accessToken, 1, 100, { businessId, active: true }),
    ])
      .then(([d, t]) => {
        setDocs(d.items.filter((x) => x.state));
        setTrainings(t.items);
      })
      .catch(() => {
        setDocs([]);
        setTrainings([]);
      });
  }, [accessToken, open, businessId]);

  /** Abre alta. */
  function openCreate() {
    setEditing(null);
    setForm(emptyForm(permitTypeCode));
    setOpen(true);
  }

  /** Abre edición. */
  function openEdit(row: PermitTypeRequirement) {
    setEditing(row);
    setForm({
      key: row.key,
      kind: row.kind,
      scope: row.scope,
      moment: row.moment,
      mandatory: row.mandatory,
      label: row.label,
      documentTypeId: row.documentTypeId ?? "",
      accreditationScope: row.accreditationScope ?? "",
      trainingId: row.trainingId ?? "",
      active: row.active,
    });
    setOpen(true);
  }

  /** Cierra modal. */
  function close() {
    if (submitting) return;
    setOpen(false);
    setEditing(null);
  }

  /** POST / PATCH. */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || submitting) return;
    if (!form.label.trim()) {
      showToast("El nombre/label es requerido.", "danger");
      return;
    }
    if (!/^[a-z][a-z0-9_.]{1,63}$/.test(form.key.trim().toLowerCase())) {
      showToast("key inválida (ej. cal.docs_company_pack).", "danger");
      return;
    }
    if (form.kind === "training" && !form.trainingId) {
      showToast("Elegí una capacitación.", "danger");
      return;
    }
    if (
      form.kind === "document" &&
      form.documentTypeId &&
      form.accreditationScope
    ) {
      showToast("No combines tipo de documento y pack.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        key: form.key.trim().toLowerCase(),
        kind: form.kind,
        scope: form.scope,
        moment: form.moment,
        mandatory: form.mandatory,
        label: form.label.trim(),
        documentTypeId:
          form.kind === "document" ? form.documentTypeId || null : null,
        accreditationScope:
          form.kind === "document"
            ? form.accreditationScope || null
            : null,
        trainingId: form.kind === "training" ? form.trainingId || null : null,
        trainingCode: null as string | null,
        active: form.active,
      };

      if (editing) {
        await updatePermitTypeRequirementRequest(
          accessToken,
          permitTypeId,
          editing.id,
          payload,
        );
        showToast("Exigencia actualizada.", "success");
      } else {
        await createPermitTypeRequirementRequest(
          accessToken,
          permitTypeId,
          payload,
        );
        showToast("Exigencia creada.", "success");
      }
      close();
      onChanged();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Soft-deactivate. */
  async function onDelete(row: PermitTypeRequirement) {
    if (!accessToken || !canManage) return;
    const ok = window.confirm(`¿Desactivar la exigencia «${row.label}»?`);
    if (!ok) return;
    try {
      await deletePermitTypeRequirementRequest(
        accessToken,
        permitTypeId,
        row.id,
      );
      showToast("Exigencia desactivada.", "success");
      onChanged();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desactivar.",
        "danger",
      );
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-tremor-border)] px-4 py-3">
          <div>
            <h2 className="m-0 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
              Exigencias ({items.length})
            </h2>
            <p className="m-0 mt-0.5 text-[12px] text-[var(--color-nachipa-secondary)]">
              Documentos, capacitaciones y checklist requeridos.
            </p>
          </div>
          {canManage ? (
            <Button
              type="button"
              size="small"
              className="!w-auto"
              onClick={openCreate}
            >
              <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
              Agregar
            </Button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="m-0 px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
            Sin exigencias activas.
          </p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] p-0">
            {items.map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                    {req.label}
                    {!req.active ? (
                      <span className="ml-2 text-[11px] font-normal text-[var(--color-nachipa-secondary)]">
                        (inactiva)
                      </span>
                    ) : null}
                  </p>
                  <p className="m-0 mt-0.5 text-[11px] text-[var(--color-nachipa-secondary)]">
                    {req.key}
                    {req.training
                      ? ` · ${req.training.code}`
                      : req.trainingCode
                        ? ` · ${req.trainingCode}`
                        : null}
                    {req.documentType
                      ? ` · ${req.documentType.code}`
                      : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip tone="info">{kindLabel(req.kind)}</StatusChip>
                  <StatusChip tone="neutral">
                    {momentLabel(req.moment)}
                  </StatusChip>
                  {req.mandatory ? (
                    <StatusChip tone="warning">Obligatorio</StatusChip>
                  ) : (
                    <StatusChip tone="neutral">Opcional</StatusChip>
                  )}
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="ml-1 text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                        onClick={() => openEdit(req)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-[12px] font-medium text-[var(--color-status-danger-fg)] hover:underline"
                        onClick={() => {
                          void onDelete(req);
                        }}
                      >
                        Desactivar
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={open}
        onClose={close}
        title={editing ? "Editar exigencia" : "Nueva exigencia"}
        subtitle="Define qué debe cumplirse antes o al cierre del permiso."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={close}
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="req-form"
              size="medium"
              className="!w-auto"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        }
      >
        <form
          id="req-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => void onSubmit(e)}
        >
          <TextField
            label="Key"
            name="key"
            required
            value={form.key}
            onChange={(e) =>
              setForm((f) => ({ ...f, key: e.target.value.toLowerCase() }))
            }
            placeholder="cal.docs_company_pack"
            disabled={Boolean(editing)}
          />
          <TextField
            label="Etiqueta"
            name="label"
            required
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Tipo
              </span>
              <select
                className={selectClass}
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as PermitRequirementKind,
                    documentTypeId: "",
                    accreditationScope: "",
                    trainingId: "",
                  }))
                }
              >
                <option value="document">Documento</option>
                <option value="training">Capacitación</option>
                <option value="checklist">Checklist</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Aplica a
              </span>
              <select
                className={selectClass}
                value={form.scope}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    scope: e.target.value as PermitRequirementScope,
                  }))
                }
              >
                <option value="company">Empresa</option>
                <option value="person">Persona</option>
                <option value="permit">Permiso</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Momento
              </span>
              <select
                className={selectClass}
                value={form.moment}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    moment: e.target.value as PermitRequirementMoment,
                  }))
                }
              >
                <option value="before">Antes</option>
                <option value="closure">Cierre</option>
              </select>
            </label>
          </div>

          {form.kind === "document" ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Tipo de documento
                </span>
                <select
                  className={selectClass}
                  value={form.documentTypeId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      documentTypeId: e.target.value,
                      accreditationScope: e.target.value
                        ? ""
                        : f.accreditationScope,
                    }))
                  }
                >
                  <option value="">Ninguno / genérico</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} · {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Pack habilitación
                </span>
                <select
                  className={selectClass}
                  value={form.accreditationScope}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      accreditationScope: e.target
                        .value as "" | AccreditationScope,
                      documentTypeId: e.target.value ? "" : f.documentTypeId,
                    }))
                  }
                >
                  <option value="">Ninguno</option>
                  <option value="company">Empresa</option>
                  <option value="person">Persona</option>
                </select>
              </label>
            </>
          ) : null}

          {form.kind === "training" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Capacitación
              </span>
              <select
                className={selectClass}
                required
                value={form.trainingId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, trainingId: e.target.value }))
                }
              >
                <option value="">Seleccionar…</option>
                {trainings.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {t.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Obligatoria
            </span>
            <Toggle
              checked={form.mandatory}
              aria-label="Obligatoria"
              onChange={(checked) =>
                setForm((f) => ({ ...f, mandatory: checked }))
              }
            />
          </div>

          {editing ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Activa
              </span>
              <Toggle
                checked={form.active}
                aria-label="Activa"
                onChange={(checked) =>
                  setForm((f) => ({ ...f, active: checked }))
                }
              />
            </div>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
