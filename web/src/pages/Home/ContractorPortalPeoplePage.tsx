import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
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
  createContractorPortalPersonDocumentRequest,
  createContractorPortalPersonRequest,
  deleteContractorPortalPersonRequest,
  downloadContractorPortalPersonDocumentRequest,
  getContractorPortalAccreditationRequest,
  listContractorPortalPeopleRequest,
  listContractorPortalPersonDocumentsRequest,
  updateContractorPortalPersonRequest,
  type ContractorPortalAccreditation,
  type ContractorPortalPerson,
  type ContractorPortalPersonDocChecklistItem,
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

/** Iniciales para avatar. */
function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
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

/** Chip de progreso de docs de una persona. */
function docsChip(row: ContractorPortalPerson): {
  label: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
} {
  const { uploaded, required, observed } = row.documents;
  if (observed > 0) return { label: "Observados", tone: "danger" };
  if (required > 0 && uploaded >= required) {
    return { label: "Completo", tone: "success" };
  }
  if (required === 0) return { label: "Sin pack", tone: "neutral" };
  const missing = Math.max(required - uploaded, 0);
  return { label: `Faltan ${missing}`, tone: "warning" };
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

const outlineBtnClass =
  "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60";

type PersonForm = {
  fullName: string;
  rut: string;
  position: string;
  email: string;
  phone: string;
  emergencyContact: string;
};

/** Form vacío para alta. */
const emptyForm = (): PersonForm => ({
  fullName: "",
  rut: "",
  position: "",
  email: "",
  phone: "",
  emergencyContact: "",
});

/**
 * Mi personal del portal contratista (P2 · E5).
 * Alta/edición de personas + upload pack person por fila expandible.
 */
export function ContractorPortalPeoplePage() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const [hab, setHab] = useState<ContractorPortalAccreditation | null>(null);
  const [people, setPeople] = useState<ContractorPortalPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [personDocs, setPersonDocs] = useState<
    ContractorPortalPersonDocChecklistItem[]
  >([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContractorPortalPerson | null>(null);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [pendingUpload, setPendingUpload] = useState<{
    personId: string;
    documentTypeId: string;
    file: File;
  } | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [pendingDeactivate, setPendingDeactivate] =
    useState<ContractorPortalPerson | null>(null);

  const canUpload =
    hab?.status === "pending" || hab?.status === "observed";

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [habRow, peopleRes] = await Promise.all([
        getContractorPortalAccreditationRequest(accessToken).catch(() => null),
        listContractorPortalPeopleRequest(accessToken, {
          page: 1,
          limit: 100,
          active: true,
        }),
      ]);
      setHab(habRow);
      setPeople(peopleRes.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar el personal",
        "danger",
      );
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Filtra en cliente por nombre/RUN/cargo. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.rut.toLowerCase().includes(q) ||
        (p.position ?? "").toLowerCase().includes(q),
    );
  }, [people, search]);

  /** Carga checklist de una persona. */
  async function loadPersonDocs(personId: string) {
    if (!accessToken) return;
    setDocsLoading(true);
    try {
      const res = await listContractorPortalPersonDocumentsRequest(
        accessToken,
        personId,
      );
      setPersonDocs(res.items);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudieron cargar docs",
        "danger",
      );
      setPersonDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }

  /** Abre/cierra fila expandible. */
  function toggleExpand(personId: string) {
    if (expandedId === personId) {
      setExpandedId(null);
      setPersonDocs([]);
      return;
    }
    setExpandedId(personId);
    void loadPersonDocs(personId);
  }

  /** Abre modal alta. */
  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  /** Abre modal edición. */
  function openEdit(row: ContractorPortalPerson) {
    setEditing(row);
    setForm({
      fullName: displayName(row.fullName),
      rut: row.rut,
      position: row.position ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      emergencyContact: row.emergencyContact ?? "",
    });
    setModalOpen(true);
  }

  /** Guarda alta o edición. */
  async function onSavePerson(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || acting) return;
    if (!form.fullName.trim() || !form.rut.trim()) {
      showToast("Nombre y RUN son obligatorios.", "warning");
      return;
    }
    setActing(true);
    try {
      const payload = {
        rut: form.rut.trim(),
        fullName: form.fullName.trim(),
        position: form.position.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        emergencyContact: form.emergencyContact.trim() || null,
      };
      if (editing) {
        await updateContractorPortalPersonRequest(
          accessToken,
          editing.id,
          payload,
        );
        showToast("Persona actualizada.", "success");
      } else {
        await createContractorPortalPersonRequest(accessToken, payload);
        showToast("Persona agregada.", "success");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Soft delete. */
  async function confirmDeactivate() {
    if (!accessToken || !pendingDeactivate || acting) return;
    setActing(true);
    try {
      await deleteContractorPortalPersonRequest(
        accessToken,
        pendingDeactivate.id,
      );
      showToast("Persona desactivada.", "success");
      if (expandedId === pendingDeactivate.id) {
        setExpandedId(null);
        setPersonDocs([]);
      }
      setPendingDeactivate(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo desactivar.",
        "danger",
      );
    } finally {
      setActing(false);
    }
  }

  /** Sube archivo con vencimiento resuelto. */
  async function uploadFile(
    personId: string,
    documentTypeId: string,
    file: File,
    expiresAt: string | null,
  ) {
    if (!accessToken || acting) return;
    setUploadingTypeId(documentTypeId);
    setActing(true);
    try {
      const contentBase64 = await fileToBase64(file);
      await createContractorPortalPersonDocumentRequest(accessToken, personId, {
        documentTypeId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        contentBase64,
        expiresAt,
      });
      showToast("Documento subido.", "success");
      setPendingUpload(null);
      setExpiryDate("");
      await loadPersonDocs(personId);
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

  /** Elige archivo; pide vencimiento si el tipo lo exige. */
  function onPickFile(
    personId: string,
    documentTypeId: string,
    file: File | null,
    requiresExpiry: boolean,
  ) {
    if (!file) return;
    if (requiresExpiry) {
      setPendingUpload({ personId, documentTypeId, file });
      setExpiryDate(
        new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
      );
      return;
    }
    void uploadFile(personId, documentTypeId, file, null);
  }

  if (!user?.organizationId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar breadcrumb="Mi personal" actions={<UserMenu />} />
        <p className="px-6 py-5 text-[13px] text-[var(--color-nachipa-secondary)]">
          Esta cuenta no es de un portal contratista.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Mi personal"
        breadcrumbIcon={Users}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 lg:px-8">
        <PageHeader
          crumbs={[{ label: "Panel", to: "/" }, { label: "Mi personal" }]}
          title="Personal"
          description="Trabajadores que participarán en la habilitación. Cada uno necesita su pack de documentos."
          actions={
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              onClick={openCreate}
            >
              + Agregar persona
            </Button>
          }
        />

        {hab?.status === "observed" ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-status-warning-border,#fcd34d)] bg-[var(--color-status-warning-bg,#fffbeb)] px-4 py-3 text-[13px] text-[var(--color-status-warning-fg,#b45309)]">
            <strong className="font-semibold">
              Habilitación {hab.code} observada.
            </strong>{" "}
            Revisá los documentos marcados y volvé a enviar desde Habilitación.
            {hab.reviewNote ? (
              <span className="mt-1 block text-[12px]">
                Observación: {hab.reviewNote}
              </span>
            ) : null}
          </div>
        ) : hab ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white px-4 py-3 text-[13px] text-[var(--color-nachipa-body)]">
            HAB {hab.code} · {habStatusLabel(hab.status)} · {people.length}{" "}
            persona(s)
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RUN o cargo…"
            className="h-9 w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-title)] outline-none focus:border-[var(--color-nachipa-primary)]"
          />
        </div>

        {loading ? (
          <p className="m-0 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando personal…
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-tremor-border)] bg-white px-6 py-10 text-center">
            <p className="m-0 text-[14px] font-medium text-[var(--color-nachipa-title)]">
              Todavía no hay personal
            </p>
            <p className="m-0 mt-1 text-[13px] text-[var(--color-nachipa-secondary)]">
              Agregá a tus trabajadores para subirles el pack de documentos.
            </p>
            <Button
              type="button"
              size="medium"
              className="!mt-4 !w-auto"
              onClick={openCreate}
            >
              + Agregar persona
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-3 py-2.5">Nombre</th>
                  <th className="px-3 py-2.5">RUN</th>
                  <th className="px-3 py-2.5">Cargo</th>
                  <th className="px-3 py-2.5">Docs</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const open = expandedId === row.id;
                  const chip = docsChip(row);
                  return (
                    <PersonRows
                      key={row.id}
                      row={row}
                      open={open}
                      chip={chip}
                      canUpload={Boolean(canUpload)}
                      docsLoading={docsLoading && open}
                      personDocs={open ? personDocs : []}
                      uploadingTypeId={uploadingTypeId}
                      acting={acting}
                      accessToken={accessToken}
                      onToggle={() => toggleExpand(row.id)}
                      onEdit={() => openEdit(row)}
                      onDeactivate={() => setPendingDeactivate(row)}
                      onPickFile={onPickFile}
                      showToast={showToast}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!acting) setModalOpen(false);
        }}
        icon={Users}
        title={editing ? "Editar persona" : "Agregar persona"}
        subtitle="Datos del trabajador externo de tu organización."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => setModalOpen(false)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="portal-person-form"
              size="medium"
              className="!w-auto"
              disabled={acting}
            >
              {acting ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        <form
          id="portal-person-form"
          className="flex flex-col gap-3"
          onSubmit={(e) => void onSavePerson(e)}
        >
          <TextField
            label="Nombre completo"
            value={form.fullName}
            onChange={(e) =>
              setForm((f) => ({ ...f, fullName: e.target.value }))
            }
            required
          />
          <TextField
            label="RUN"
            value={form.rut}
            onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
            required
          />
          <TextField
            label="Cargo"
            value={form.position}
            onChange={(e) =>
              setForm((f) => ({ ...f, position: e.target.value }))
            }
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <TextField
            label="Teléfono"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextField
            label="Contacto de emergencia"
            value={form.emergencyContact}
            onChange={(e) =>
              setForm((f) => ({ ...f, emergencyContact: e.target.value }))
            }
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingDeactivate)}
        onClose={() => {
          if (!acting) setPendingDeactivate(null);
        }}
        icon={Users}
        title="Desactivar persona"
        subtitle={
          pendingDeactivate
            ? `¿Desactivar «${displayName(pendingDeactivate.fullName)}» (${pendingDeactivate.rut})?`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => setPendingDeactivate(null)}
              className={outlineBtnClass}
            >
              Cancelar
            </button>
            <Button
              type="button"
              size="medium"
              className="!w-auto"
              disabled={acting}
              onClick={() => void confirmDeactivate()}
            >
              {acting ? "Desactivando…" : "Desactivar"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-[var(--color-nachipa-body)]">
          Queda fuera del listado activo; podés reactivarla desde Prevención si
          hace falta.
        </p>
      </Modal>

      <Modal
        open={Boolean(pendingUpload)}
        onClose={() => {
          if (!acting) {
            setPendingUpload(null);
            setExpiryDate("");
          }
        }}
        icon={Users}
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
                  pendingUpload.personId,
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

/** Filas de persona + panel expandible de docs. */
function PersonRows({
  row,
  open,
  chip,
  canUpload,
  docsLoading,
  personDocs,
  uploadingTypeId,
  acting,
  accessToken,
  onToggle,
  onEdit,
  onDeactivate,
  onPickFile,
  showToast,
}: {
  row: ContractorPortalPerson;
  open: boolean;
  chip: { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" };
  canUpload: boolean;
  docsLoading: boolean;
  personDocs: ContractorPortalPersonDocChecklistItem[];
  uploadingTypeId: string | null;
  acting: boolean;
  accessToken: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onPickFile: (
    personId: string,
    documentTypeId: string,
    file: File | null,
    requiresExpiry: boolean,
  ) => void;
  showToast: (msg: string, tone: "success" | "danger" | "warning" | "info") => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const uploadedLabel =
    row.documents.required > 0
      ? `${row.documents.uploaded}/${row.documents.required}`
      : "—";

  return (
    <>
      <tr className="border-t border-[var(--color-tremor-border)]">
        <td className="px-2 py-2.5">
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-nachipa-bg-page)]"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? "Ocultar documentos" : "Ver documentos"}
          >
            <Chevron size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-info-bg)] text-[11px] font-semibold text-[var(--color-status-info-fg)]">
              {initialsOf(row.fullName)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-[var(--color-nachipa-title)]">
                {displayName(row.fullName)}
              </div>
              {row.email ? (
                <div className="truncate text-[12px] text-[var(--color-nachipa-secondary)]">
                  {row.email}
                </div>
              ) : null}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
          {row.rut}
        </td>
        <td className="px-3 py-2.5 text-[var(--color-nachipa-body)]">
          {row.position ?? "—"}
        </td>
        <td className="px-3 py-2.5 tabular-nums text-[var(--color-nachipa-body)]">
          {uploadedLabel}
        </td>
        <td className="px-3 py-2.5">
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            type="button"
            className="text-[12px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
            onClick={onEdit}
          >
            Editar
          </button>
          <span className="mx-1.5 text-[var(--color-nachipa-secondary)]">·</span>
          <button
            type="button"
            className="text-[12px] font-medium text-[var(--color-nachipa-secondary)] hover:underline"
            onClick={onDeactivate}
          >
            Desactivar
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-t border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page)]">
          <td colSpan={7} className="px-4 py-3">
            {docsLoading ? (
              <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                Cargando documentos…
              </p>
            ) : personDocs.length === 0 ? (
              <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                No hay tipos con pack «person», o todavía no hay una HAB abierta.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                {personDocs.map((item) => {
                  const doc = item.document;
                  return (
                    <li
                      key={item.documentType.id}
                      className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                            {item.documentType.name}
                          </span>
                          <span className="ml-1.5 text-[11px] text-[var(--color-nachipa-secondary)]">
                            {item.documentType.code}
                          </span>
                          <div className="text-[11px] text-[var(--color-nachipa-body)]">
                            {doc ? doc.originalName : "Sin archivo"}
                            {doc?.status === "observed" && doc.observation
                              ? ` · ${doc.observation}`
                              : ""}
                          </div>
                        </div>
                        {doc ? (
                          <StatusChip tone={docTone(doc.status)}>
                            {docLabel(doc.status)}
                          </StatusChip>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {doc && accessToken ? (
                          <button
                            type="button"
                            className="text-[11px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                            onClick={() =>
                              void downloadContractorPortalPersonDocumentRequest(
                                accessToken,
                                row.id,
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
                        {canUpload ? (
                          <label className="cursor-pointer text-[11px] font-medium text-[var(--color-nachipa-title)] hover:underline">
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
                                  row.id,
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
                })}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
