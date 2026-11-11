import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { Topbar } from "../../components/Topbar/Topbar";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import { useToast } from "../../components/Toast/ToastProvider";
import { fileToBase64 } from "../../lib/api/accreditations";
import {
  createContractorPortalDocumentRequest,
  downloadContractorPortalDocumentRequest,
  getContractorPortalAccreditationRequest,
  getContractorPortalOrganizationRequest,
  listContractorPortalDocumentsRequest,
  submitContractorPortalAccreditationRequest,
  updateContractorPortalOrganizationRequest,
  type ContractorOrganization,
  type ContractorPortalAccreditation,
  type ContractorPortalDocChecklistItem,
} from "../../lib/api/contractors";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Capitaliza nombre. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Etiqueta HAB. */
function habStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "in_review":
      return "En revisión";
    case "observed":
      return "Observada";
    case "approved":
      return "Habilitada";
    case "rejected":
      return "Rechazada";
    case "invited":
      return "Invitada";
    default:
      return status;
  }
}

/** Tono HAB. */
function habTone(
  status: string,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "approved":
      return "success";
    case "in_review":
      return "info";
    case "observed":
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

/** Etiqueta estado doc. */
function docLabel(status: string): string {
  switch (status) {
    case "pending_validation":
      return "Pendiente";
    case "validated":
      return "Vigente";
    case "observed":
      return "Observado";
    case "replaced":
      return "Reemplazado";
    default:
      return status;
  }
}

/** Tono doc. */
function docTone(
  status: string,
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "validated":
      return "success";
    case "pending_validation":
      return "info";
    case "observed":
      return "danger";
    default:
      return "neutral";
  }
}

/** Fecha corta. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL");
  } catch {
    return "—";
  }
}

const outlineBtnClass =
  "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

type TabId = "antecedentes" | "documentos";

/** Formulario de antecedentes (E19). */
type AntecedentesForm = {
  name: string;
  specialty: string;
  mutual: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  legalRepresentative: string;
  address: string;
  supervisorName: string;
  supervisorEmail: string;
  prevencionistName: string;
  prevencionistEmail: string;
  subcontractors: string;
  workDescription: string;
};

/** Mapea org → form. */
function orgToForm(org: ContractorOrganization): AntecedentesForm {
  return {
    name: displayName(org.name),
    specialty: org.specialty ?? "",
    mutual: org.mutual ?? "",
    contactName: org.contactName ?? "",
    contactEmail: org.contactEmail ?? "",
    contactPhone: org.contactPhone ?? "",
    legalRepresentative: org.legalRepresentative ?? "",
    address: org.address ?? "",
    supervisorName: org.supervisorName ?? "",
    supervisorEmail: org.supervisorEmail ?? "",
    prevencionistName: org.prevencionistName ?? "",
    prevencionistEmail: org.prevencionistEmail ?? "",
    subcontractors: org.subcontractors ?? "",
    workDescription: org.workDescription ?? "",
  };
}

/**
 * Habilitación del portal (P2 · E4 docs + E19 antecedentes).
 * Tabs: Antecedentes generales · Documentos de la empresa.
 */
export function ContractorPortalAccreditationPage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId =
    tabParam === "documentos" ? "documentos" : "antecedentes";

  const [hab, setHab] = useState<ContractorPortalAccreditation | null>(null);
  const [org, setOrg] = useState<ContractorOrganization | null>(null);
  const [form, setForm] = useState<AntecedentesForm | null>(null);
  const [items, setItems] = useState<ContractorPortalDocChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    documentTypeId: string;
    file: File;
  } | null>(null);
  const [expiryDate, setExpiryDate] = useState("");

  const canEditAntecedentes =
    !hab ||
    hab.status === "pending" ||
    hab.status === "observed" ||
    hab.status === "invited";
  /**
   * Pack en HAB abierta, o huecos si Prevención pidió docs adicionales
   * sobre HAB aprobada.
   */
  const canUploadEditable =
    hab?.status === "pending" ||
    hab?.status === "observed" ||
    hab?.status === "invited" ||
    hab?.status === "in_review";
  const canUploadAdditionalGaps =
    hab?.status === "approved" && Boolean(hab.awaitingAdditionalDocs);
  /** true si ese slot admite Subir/Reemplazar. */
  function canUploadSlot(
    hasDocument: boolean,
    requestedAdditional: boolean,
  ): boolean {
    if (canUploadEditable) return true;
    if (canUploadAdditionalGaps && !hasDocument && requestedAdditional) {
      return true;
    }
    return false;
  }
  const canSubmit =
    hab?.status === "pending" || hab?.status === "observed";
  /** Pack empresa con archivo en cada tipo (para habilitar «Enviar a revisión»). */
  const packUploadedComplete =
    items.length > 0 && items.every((i) => Boolean(i.document));
  const canSubmitPack = canSubmit && packUploadedComplete;

  /** Cambia tab sin perder el resto de query. */
  function setTab(next: TabId) {
    setSearchParams(next === "antecedentes" ? {} : { tab: next });
  }

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const orgRow = await getContractorPortalOrganizationRequest(accessToken);
      setOrg(orgRow);
      setForm(orgToForm(orgRow));

      try {
        const [habRow, docs] = await Promise.all([
          getContractorPortalAccreditationRequest(accessToken),
          listContractorPortalDocumentsRequest(accessToken),
        ]);
        setHab(habRow);
        setItems(docs.items);
      } catch (err) {
        // Sin HAB abierta: antecedentes igual se editan.
        if (err instanceof ApiError && err.status === 404) {
          setHab(null);
          setItems([]);
        } else {
          throw err;
        }
      }
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar la habilitación",
        "danger",
      );
      setOrg(null);
      setForm(null);
      setHab(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Guarda antecedentes E19. */
  async function onSaveAntecedentes(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !form || acting || !canEditAntecedentes) return;
    if (!form.name.trim()) {
      showToast("La razón social es obligatoria.", "warning");
      return;
    }
    setActing(true);
    try {
      const updated = await updateContractorPortalOrganizationRequest(
        accessToken,
        {
          name: form.name.trim(),
          specialty: form.specialty.trim() || null,
          mutual: form.mutual.trim() || null,
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          legalRepresentative: form.legalRepresentative.trim() || null,
          address: form.address.trim() || null,
          supervisorName: form.supervisorName.trim() || null,
          supervisorEmail: form.supervisorEmail.trim() || null,
          prevencionistName: form.prevencionistName.trim() || null,
          prevencionistEmail: form.prevencionistEmail.trim() || null,
          subcontractors: form.subcontractors.trim() || null,
          workDescription: form.workDescription.trim() || null,
        },
      );
      setOrg(updated);
      setForm(orgToForm(updated));
      showToast("Antecedentes guardados.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Sube archivo con vencimiento ya resuelto. */
  async function uploadFile(
    documentTypeId: string,
    file: File,
    expiresAt: string | null,
  ) {
    if (!accessToken || acting) return;
    setUploadingTypeId(documentTypeId);
    setActing(true);
    try {
      const contentBase64 = await fileToBase64(file);
      await createContractorPortalDocumentRequest(accessToken, {
        documentTypeId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        contentBase64,
        expiresAt,
      });
      showToast("Documento subido.", "success");
      setPendingUpload(null);
      setExpiryDate("");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo subir.",
        "danger",
      );
    } finally {
      setActing(false);
      setUploadingTypeId(null);
    }
  }

  /** Elige archivo. */
  function onPickFile(
    documentTypeId: string,
    file: File | null,
    requiresExpiry: boolean,
  ) {
    if (!file) return;
    if (requiresExpiry) {
      setPendingUpload({ documentTypeId, file });
      setExpiryDate(
        new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
      );
      return;
    }
    void uploadFile(documentTypeId, file, null);
  }

  /** Envía a revisión (exige pack empresa completo). */
  async function onSubmit() {
    if (!accessToken || !canSubmit || !canSubmitPack || acting) return;
    setActing(true);
    try {
      await submitContractorPortalAccreditationRequest(accessToken);
      showToast("Documentación enviada a revisión.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo enviar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Actualiza un campo del form. */
  function patchForm(field: keyof AntecedentesForm, value: string) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  /** Progreso solo sobre obligatorios (opcionales no bloquean envío). */
  const requiredItems = items.filter((i) => i.packRequired);
  const uploaded = requiredItems.filter((i) => i.document).length;
  const required = requiredItems.length;

  if (!user?.organizationId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar breadcrumb="Habilitación" actions={<UserMenu />} />
        <p className="px-6 py-5 text-[13px] text-[var(--color-nachipa-secondary)]">
          Esta cuenta no es de un portal contratista.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Habilitación"
        breadcrumbIcon={ClipboardCheck}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader
          crumbs={[
            { label: "Panel", to: "/" },
            { label: "Habilitación" },
          ]}
          title="Habilitación"
          description={
            org
              ? `${displayName(org.name)} · RUT ${org.rut}${hab ? ` · ${hab.code}` : ""}`
              : "Antecedentes y documentos de tu empresa."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              {tab === "antecedentes" && canEditAntecedentes ? (
                <Button
                  type="submit"
                  form="portal-antecedentes-form"
                  size="medium"
                  className="!w-auto"
                  disabled={acting || loading || !form}
                >
                  {acting ? "Guardando…" : "Guardar antecedentes"}
                </Button>
              ) : null}
              {canSubmit ? (
                <Button
                  type="button"
                  size="medium"
                  className="!w-auto"
                  disabled={acting || loading || !canSubmitPack}
                  title={
                    canSubmitPack
                      ? undefined
                      : "Subí todos los documentos del pack empresa antes de enviar"
                  }
                  onClick={() => void onSubmit()}
                >
                  {acting ? "Enviando…" : "Enviar a revisión"}
                </Button>
              ) : null}
            </div>
          }
        />

        {loading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando…
          </p>
        ) : (
          <>
            {hab ? (
              <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-4 py-3">
                <StatusChip tone={habTone(hab.status)}>
                  {habStatusLabel(hab.status)}
                </StatusChip>
                <span className="text-[13px] text-[var(--color-nachipa-body)]">
                  {uploaded} de {required} documentos cargados
                </span>
                {hab.reviewNote ? (
                  <span className="w-full text-[12px] text-[var(--color-status-warning-fg,#b45309)]">
                    Observación: {hab.reviewNote}
                  </span>
                ) : null}
                {hab.awaitingAdditionalDocs ? (
                  <span className="w-full text-[13px] text-[var(--color-nachipa-body)]">
                    <span className="font-medium text-[var(--color-nachipa-title)]">
                      Prevención pide documentos adicionales.{" "}
                    </span>
                    {hab.additionalDocsMessage ??
                      "Subí los tipos marcados como pedido adicional."}
                    {items.some((i) => i.requestedAdditional) ? (
                      <span className="mt-1 block text-[12px] text-[var(--color-nachipa-secondary)]">
                        Pedidos:{" "}
                        {items
                          .filter((i) => i.requestedAdditional)
                          .map((i) => i.documentType.name)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-4 py-3 text-[13px] text-[var(--color-nachipa-body)]">
                Todavía no hay una habilitación abierta. Podés completar
                antecedentes; los documentos se habilitan cuando Prevención
                solicite la HAB.
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-b border-[var(--color-tremor-border)]">
              <TabButton
                active={tab === "antecedentes"}
                onClick={() => setTab("antecedentes")}
                label="Antecedentes generales"
              />
              <TabButton
                active={tab === "documentos"}
                onClick={() => setTab("documentos")}
                label={`Documentos de la empresa (${required})`}
              />
              <Link
                to="/portal/personal"
                className="px-3 pb-2 text-[13px] text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]"
              >
                Personal
              </Link>
            </div>

            {tab === "antecedentes" ? (
              form && org ? (
                <form
                  id="portal-antecedentes-form"
                  className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-6"
                  onSubmit={(e) => void onSaveAntecedentes(e)}
                >
                  <div>
                    <h2 className="m-0 text-[15px] font-semibold text-[var(--color-nachipa-title)]">
                      Antecedentes generales
                    </h2>
                    <p className="m-0 mt-1 text-[13px] text-[var(--color-nachipa-secondary)]">
                      Lo que Prevención pide antes de habilitar a una empresa.
                      Si cambia algo, se envía de nuevo a revisión.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField
                      label="Razón social"
                      value={form.name}
                      onChange={(e) => patchForm("name", e.target.value)}
                      disabled={!canEditAntecedentes || acting}
                      required
                    />
                    <TextField
                      label="RUT"
                      value={org.rut}
                      disabled
                    />
                    <TextField
                      label="Especialidad"
                      value={form.specialty}
                      onChange={(e) => patchForm("specialty", e.target.value)}
                      disabled={!canEditAntecedentes || acting}
                    />
                    <TextField
                      label="Mutualidad adherida"
                      value={form.mutual}
                      onChange={(e) => patchForm("mutual", e.target.value)}
                      disabled={!canEditAntecedentes || acting}
                      placeholder="ACHS, Mutual de Seguridad…"
                    />
                    <TextField
                      label="Contacto de la empresa"
                      value={form.contactName}
                      onChange={(e) => patchForm("contactName", e.target.value)}
                      disabled={!canEditAntecedentes || acting}
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:col-span-1">
                      <TextField
                        label="Correo de contacto"
                        type="email"
                        value={form.contactEmail}
                        onChange={(e) =>
                          patchForm("contactEmail", e.target.value)
                        }
                        disabled={!canEditAntecedentes || acting}
                      />
                      <TextField
                        label="Teléfono"
                        value={form.contactPhone}
                        onChange={(e) =>
                          patchForm("contactPhone", e.target.value)
                        }
                        disabled={!canEditAntecedentes || acting}
                      />
                    </div>
                    <TextField
                      label="Representante legal"
                      value={form.legalRepresentative}
                      onChange={(e) =>
                        patchForm("legalRepresentative", e.target.value)
                      }
                      disabled={!canEditAntecedentes || acting}
                    />
                    <TextField
                      label="Dirección de la empresa"
                      value={form.address}
                      onChange={(e) => patchForm("address", e.target.value)}
                      disabled={!canEditAntecedentes || acting}
                    />
                    <TextField
                      label="Supervisor (nombre)"
                      value={form.supervisorName}
                      onChange={(e) =>
                        patchForm("supervisorName", e.target.value)
                      }
                      disabled={!canEditAntecedentes || acting}
                    />
                    <TextField
                      label="Supervisor (correo)"
                      type="email"
                      value={form.supervisorEmail}
                      onChange={(e) =>
                        patchForm("supervisorEmail", e.target.value)
                      }
                      disabled={!canEditAntecedentes || acting}
                    />
                    <TextField
                      label="Prevencionista (nombre)"
                      value={form.prevencionistName}
                      onChange={(e) =>
                        patchForm("prevencionistName", e.target.value)
                      }
                      disabled={!canEditAntecedentes || acting}
                    />
                    <TextField
                      label="Prevencionista (correo)"
                      type="email"
                      value={form.prevencionistEmail}
                      onChange={(e) =>
                        patchForm("prevencionistEmail", e.target.value)
                      }
                      disabled={!canEditAntecedentes || acting}
                    />
                  </div>

                  <TextField
                    label="Subcontratistas (si corresponde)"
                    value={form.subcontractors}
                    onChange={(e) =>
                      patchForm("subcontractors", e.target.value)
                    }
                    disabled={!canEditAntecedentes || acting}
                    placeholder="Ninguno declarado"
                  />
                  <TextField
                    label="Descripción de los trabajos a realizar"
                    value={form.workDescription}
                    onChange={(e) =>
                      patchForm("workDescription", e.target.value)
                    }
                    disabled={!canEditAntecedentes || acting}
                  />
                </form>
              ) : (
                <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                  No se pudo cargar la organización.
                </p>
              )
            ) : !hab ? (
              <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
                Todavía no hay una habilitación abierta. Prevención debe
                solicitarte la documentación.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--color-tremor-border)] rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white p-0">
                {items.length === 0 ? (
                  <li className="px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
                    Pack empresa vacío. Pedile a Prevención que configure los
                    tipos.
                  </li>
                ) : (
                  items.map((item) => {
                    const doc = item.document;
                    const sourceHint =
                      item.source === "permit_requirement"
                        ? "Exigencia de tipo de permiso"
                        : item.source === "both"
                          ? "Pack + exigencia"
                          : item.source === "additional"
                            ? "Pedido adicional"
                            : null;
                    return (
                      <li
                        key={item.documentType.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="mr-2 text-[12px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
                            {item.documentType.code}
                          </span>
                          <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                            {item.documentType.name}
                          </span>
                          {sourceHint ? (
                            <span className="ml-2 text-[12px] text-[var(--color-nachipa-secondary)]">
                              · {sourceHint}
                            </span>
                          ) : null}
                          <div className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            {doc
                              ? `${doc.originalName}${doc.expiresAt ? ` · vence ${formatDate(doc.expiresAt)}` : ""}`
                              : "Sin archivo"}
                            {doc?.status === "observed" && doc.observation
                              ? ` · ${doc.observation}`
                              : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusChip
                            tone={item.packRequired ? "warning" : "neutral"}
                          >
                            {item.packRequired ? "Obligatorio" : "Opcional"}
                          </StatusChip>
                          {item.requestedAdditional ? (
                            <StatusChip tone="info">Pedido adicional</StatusChip>
                          ) : null}
                          {doc ? (
                            <StatusChip tone={docTone(doc.status)}>
                              {docLabel(doc.status)}
                            </StatusChip>
                          ) : null}
                          {doc && accessToken ? (
                            <button
                              type="button"
                              className="text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                              onClick={() =>
                                void downloadContractorPortalDocumentRequest(
                                  accessToken,
                                  doc.id,
                                  doc.originalName,
                                ).catch((err) =>
                                  showToast(
                                    err instanceof ApiError
                                      ? err.message
                                      : "No se pudo descargar.",
                                    "danger",
                                  ),
                                )
                              }
                            >
                              Descargar
                            </button>
                          ) : null}
                          {canUploadSlot(
                            Boolean(doc),
                            item.requestedAdditional,
                          ) ? (
                            <label className="cursor-pointer text-[12px] font-medium text-[var(--color-nachipa-title)] hover:underline">
                              {uploadingTypeId === item.documentType.id
                                ? "Subiendo…"
                                : doc
                                  ? "Reemplazar"
                                  : "Subir"}
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                                disabled={acting}
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  e.target.value = "";
                                  onPickFile(
                                    item.documentType.id,
                                    f,
                                    item.documentType.requiresExpiry,
                                  );
                                }}
                              />
                            </label>
                          ) : null}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </>
        )}
      </div>

      <Modal
        open={Boolean(pendingUpload)}
        onClose={() => {
          if (!acting) {
            setPendingUpload(null);
            setExpiryDate("");
          }
        }}
        icon={ClipboardCheck}
        title="Vencimiento del documento"
        subtitle={
          pendingUpload ? `Archivo: ${pendingUpload.file.name}` : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                setPendingUpload(null);
                setExpiryDate("");
              }}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={acting || !expiryDate}
              onClick={() => {
                if (!pendingUpload || !expiryDate) return;
                void uploadFile(
                  pendingUpload.documentTypeId,
                  pendingUpload.file,
                  new Date(`${expiryDate}T12:00:00.000Z`).toISOString(),
                );
              }}
            >
              {acting ? "Subiendo…" : "Subir"}
            </Button>
          </div>
        }
      >
        <TextField
          label="Vence el"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          required
        />
      </Modal>
    </div>
  );
}

/** Botón de tab estilo Figma. */
function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "border-b-2 border-[var(--color-nachipa-primary)] px-1 pb-2 text-[13px] font-medium text-[var(--color-nachipa-primary)]"
          : "px-3 pb-2 text-[13px] text-[var(--color-nachipa-secondary)] hover:text-[var(--color-nachipa-title)]"
      }
    >
      {label}
    </button>
  );
}
