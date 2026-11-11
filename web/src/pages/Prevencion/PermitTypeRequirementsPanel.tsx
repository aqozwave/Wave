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
  /** Alta de exigencia (permit_types.create). */
  canCreate: boolean;
  /** Editar exigencia (permit_types.update). */
  canUpdate: boolean;
  /** Desactivar exigencia (permit_types.deactivate). */
  canDeactivate: boolean;
};

/** Form exigencia (sin key: la genera el sistema al crear). */
type ReqForm = {
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
function emptyForm(): ReqForm {
  return {
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

/** Slug corto para armar keys a partir de label o códigos. */
function slugPart(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return s || "item";
}

/**
 * Genera key estable: {códigoTipo}.{tipo}_{ref}.
 * Ej. alt.doc_ane, alt.training_ext01, alt.docs_company_pack.
 * Si choca con una existente, agrega _2, _3…
 */
function buildRequirementKey(input: {
  permitTypeCode: string;
  form: ReqForm;
  docs: DocumentType[];
  trainings: Training[];
  existingKeys: string[];
}): string {
  const prefix = input.permitTypeCode.trim().toLowerCase() || "tipo";
  const { form, docs, trainings } = input;

  let suffix = "req";
  if (form.kind === "document") {
    if (form.accreditationScope) {
      suffix = `docs_${form.accreditationScope}_pack`;
    } else if (form.documentTypeId) {
      const doc = docs.find((d) => d.id === form.documentTypeId);
      suffix = `doc_${slugPart(doc?.code ?? form.label)}`;
    } else {
      suffix = `doc_${slugPart(form.label)}`;
    }
  } else if (form.kind === "training") {
    const tr = trainings.find((t) => t.id === form.trainingId);
    suffix = `training_${slugPart(tr?.code ?? form.label)}`;
  } else {
    suffix = `checklist_${slugPart(form.label)}`;
  }

  let candidate = `${prefix}.${suffix}`;
  // Cumple schema: ^[a-z][a-z0-9_.]{1,63}$
  candidate = candidate.replace(/[^a-z0-9_.]/g, "_").slice(0, 64);
  if (!/^[a-z]/.test(candidate)) candidate = `r.${candidate}`;

  const taken = new Set(input.existingKeys.map((k) => k.toLowerCase()));
  if (!taken.has(candidate)) return candidate;
  for (let i = 2; i < 50; i += 1) {
    const next = `${candidate}_${i}`.slice(0, 64);
    if (!taken.has(next)) return next;
  }
  return `${candidate}_${Date.now().toString(36)}`.slice(0, 64);
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

/**
 * Etiqueta de scope (a quién aplica la exigencia).
 * permit = instancia del PT, no el pack HAB de empresa ni el de cada trabajador.
 */
function scopeLabel(s: PermitRequirementScope): string {
  if (s === "company") return "Empresa";
  if (s === "person") return "Persona";
  return "Permiso";
}

const selectClass =
  "h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3.5 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-brand-sky)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-brand-sky)_25%,transparent)]";

/**
 * Sección Exigencias de la ficha de tipo (P15).
 * Alta / editar / desactivar; selectores de doc y capacitación.
 * El contenido del pack viene del maestro document_types.accreditationPack.
 */
export function PermitTypeRequirementsPanel({
  permitTypeId,
  permitTypeCode,
  businessId,
  items,
  onChanged,
  canCreate,
  canUpdate,
  canDeactivate,
}: Props) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [docs, setDocs] = useState<DocumentType[]>([]);
  const [packCompany, setPackCompany] = useState<DocumentType[]>([]);
  const [packPerson, setPackPerson] = useState<DocumentType[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PermitTypeRequirement | null>(null);
  const [form, setForm] = useState<ReqForm>(() => emptyForm());
  const [submitting, setSubmitting] = useState(false);
  /** Fila pendiente de confirmar desactivar (Modal del sistema, no alert). */
  const [pendingDeactivate, setPendingDeactivate] =
    useState<PermitTypeRequirement | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!accessToken || !open) return;
    void Promise.all([
      listDocumentTypesRequest(accessToken, 1, 100, { businessId }),
      listDocumentTypesRequest(accessToken, 1, 100, {
        businessId,
        accreditationPack: "company",
      }),
      listDocumentTypesRequest(accessToken, 1, 100, {
        businessId,
        accreditationPack: "person",
      }),
      listTrainingsRequest(accessToken, 1, 100, { businessId, active: true }),
    ])
      .then(([d, company, person, t]) => {
        setDocs(d.items.filter((x) => x.state));
        setPackCompany(company.items.filter((x) => x.state));
        setPackPerson(person.items.filter((x) => x.state));
        setTrainings(t.items);
      })
      .catch(() => {
        setDocs([]);
        setPackCompany([]);
        setPackPerson([]);
        setTrainings([]);
      });
  }, [accessToken, open, businessId]);

  /** Docs del pack seleccionado (maestro editable). */
  const packPreview =
    form.accreditationScope === "company"
      ? packCompany
      : form.accreditationScope === "person"
        ? packPerson
        : [];

  /** Abre alta. */
  function openCreate() {
    if (!canCreate) return;
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  /** Abre edición (key no se toca: es id interno del sistema). */
  function openEdit(row: PermitTypeRequirement) {
    if (!canUpdate) return;
    setEditing(row);
    setForm({
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
    if (editing ? !canUpdate : !canCreate) return;
    if (!form.label.trim()) {
      showToast("El nombre es requerido.", "danger");
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
      // Key solo en alta: id interno; en edición no se envía.
      const key = editing
        ? editing.key
        : buildRequirementKey({
            permitTypeCode,
            form,
            docs,
            trainings,
            existingKeys: items.map((r) => r.key),
          });

      const payload = {
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
          { ...payload, key },
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

  /** Confirma desactivar exigencia (tras Modal). */
  async function confirmDeactivate() {
    if (!accessToken || !canDeactivate || !pendingDeactivate || deactivating) {
      return;
    }
    setDeactivating(true);
    try {
      await deletePermitTypeRequirementRequest(
        accessToken,
        permitTypeId,
        pendingDeactivate.id,
      );
      showToast("Exigencia desactivada.", "success");
      setPendingDeactivate(null);
      onChanged();
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
          {canCreate ? (
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
                    {[
                      req.training?.code ?? req.trainingCode,
                      req.documentType?.code,
                      req.accreditationScope === "company"
                        ? "Pack empresa"
                        : req.accreditationScope === "person"
                          ? "Pack persona"
                          : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || kindLabel(req.kind)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip tone="info">{kindLabel(req.kind)}</StatusChip>
                  <StatusChip tone="neutral">
                    {scopeLabel(req.scope)}
                  </StatusChip>
                  <StatusChip tone="neutral">
                    {momentLabel(req.moment)}
                  </StatusChip>
                  {req.mandatory ? (
                    <StatusChip tone="warning">Obligatorio</StatusChip>
                  ) : (
                    <StatusChip tone="neutral">Opcional</StatusChip>
                  )}
                  {canUpdate || canDeactivate ? (
                    <>
                      {canUpdate ? (
                        <button
                          type="button"
                          className="ml-1 text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                          onClick={() => openEdit(req)}
                        >
                          Editar
                        </button>
                      ) : null}
                      {canDeactivate ? (
                        <button
                          type="button"
                          className="text-[12px] font-medium text-[var(--color-status-danger-fg)] hover:underline"
                          onClick={() => setPendingDeactivate(req)}
                        >
                          Desactivar
                        </button>
                      ) : null}
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
            label="Nombre"
            name="label"
            required
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Ej. Anexo ANE vigente"
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
            <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] p-3">
              <p className="m-0 text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                Elegí <strong>una</strong> opción: un documento suelto del
                catálogo, o el pack completo de habilitación (los 8 de empresa
                o los 8 de persona). No se pueden combinar.
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Tipo de documento (uno solo)
                </span>
                <select
                  className={selectClass}
                  value={form.documentTypeId}
                  disabled={Boolean(form.accreditationScope)}
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
                  Pack habilitación (los 8)
                </span>
                <select
                  className={selectClass}
                  value={form.accreditationScope}
                  disabled={Boolean(form.documentTypeId)}
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
                  <option value="company">
                    Empresa — 8 docs de la organización
                  </option>
                  <option value="person">
                    Persona — 8 docs del trabajador
                  </option>
                </select>
              </label>
              {form.accreditationScope ? (
                <div className="rounded-[var(--radius-md)] bg-[var(--color-nachipa-bg-page)] px-3 py-2.5">
                  <p className="m-0 text-[12px] font-medium text-[var(--color-nachipa-title)]">
                    {form.accreditationScope === "company"
                      ? `Pack empresa · ${packPreview.length} documento(s) del maestro:`
                      : `Pack persona · ${packPreview.length} documento(s) del maestro:`}
                  </p>
                  {packPreview.length === 0 ? (
                    <p className="m-0 mt-2 text-[12px] text-[var(--color-nachipa-secondary)]">
                      Vacío. Configuralo en Prevención → Packs de habilitación
                      (o en Catálogos → Tipos de documento).
                    </p>
                  ) : (
                    <ul className="m-0 mt-2 list-none space-y-1 p-0">
                      {packPreview.map((line) => (
                        <li
                          key={line.id}
                          className="flex gap-2 text-[12px] text-[var(--color-nachipa-body)]"
                        >
                          <span className="w-8 shrink-0 font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                            {line.code}
                          </span>
                          <span>{line.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
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

      <Modal
        open={pendingDeactivate !== null}
        onClose={() => {
          if (!deactivating) setPendingDeactivate(null);
        }}
        title="Desactivar exigencia"
        subtitle={
          pendingDeactivate
            ? `¿Desactivar «${pendingDeactivate.label}»? Dejará de pedirse en permisos nuevos.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deactivating}
              onClick={() => setPendingDeactivate(null)}
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
          No se borra el historial; solo deja de estar activa en el catálogo.
        </p>
      </Modal>
    </>
  );
}
