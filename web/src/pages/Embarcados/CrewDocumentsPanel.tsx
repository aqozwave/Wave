import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Download, Eye, FileText, Plus, Upload } from "lucide-react";

import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  createCrewMemberDocumentRequest,
  downloadCrewMemberDocumentRequest,
  fileToBase64,
  listCrewMemberDocumentsRequest,
  previewCrewMemberDocumentRequest,
  type CrewMemberDocument,
} from "../../lib/api/crewMemberDocuments";
import {
  listDocumentTypesRequest,
  type DocumentType,
} from "../../lib/api/documentTypes";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  /** Id del tripulante cuya ficha se muestra. */
  crewMemberId: string;
};

/** MIME aceptados (alineados al API + magic bytes). */
const ACCEPT_MIME =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

/** Máximo 10 MB (mismo tope del API). */
const MAX_BYTES = 10 * 1024 * 1024;

/** Formatea bytes para UI. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fecha corta local. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Capitaliza nombre del tipo para la tabla. */
function displayTypeName(name: string): string {
  if (!name) return "—";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Listado, alta, vista previa y descarga de documentos del expediente.
 * Tipo maestro + archivo (PDF/JPEG/PNG/WebP).
 */
export function CrewDocumentsPanel({ crewMemberId }: Props) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canUpload =
    user?.internalRol === "admin" || user?.internalRol === "superadmin";
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<CrewMemberDocument[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<{
    id: string;
    mode: "preview" | "download";
  } | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [docs, types] = await Promise.all([
        listCrewMemberDocumentsRequest(accessToken, crewMemberId),
        listDocumentTypesRequest(accessToken, 1, 200),
      ]);
      setItems(docs.items);
      setDocTypes(types.items.filter((t) => t.state));
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los documentos.",
        "danger",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, crewMemberId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Abre el modal de alta. */
  function openUpload() {
    setDocumentTypeId("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadOpen(true);
  }

  /** Cierra el modal de alta. */
  function closeUpload() {
    if (uploading) return;
    setUploadOpen(false);
    setDocumentTypeId("");
    setFile(null);
  }

  /** Sube el archivo elegido con el tipo maestro. */
  async function onUpload(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canUpload) return;
    if (!documentTypeId) {
      showToast("Elegí el tipo de documento.", "danger");
      return;
    }
    if (!file) {
      showToast("Elegí un archivo PDF o imagen.", "danger");
      return;
    }
    if (file.size > MAX_BYTES) {
      showToast("El archivo supera el máximo de 10 MB.", "danger");
      return;
    }

    setUploading(true);
    try {
      const contentBase64 = await fileToBase64(file);
      await createCrewMemberDocumentRequest(accessToken, crewMemberId, {
        documentTypeId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        contentBase64,
        sourceModule: "crew",
      });
      showToast("Documento cargado.", "success");
      setUploadOpen(false);
      setDocumentTypeId("");
      setFile(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo subir el archivo.",
        "danger",
      );
    } finally {
      setUploading(false);
    }
  }

  /** Abre el archivo en pestaña nueva. */
  async function handlePreview(doc: CrewMemberDocument) {
    if (!accessToken) return;
    setBusy({ id: doc.id, mode: "preview" });
    try {
      await previewCrewMemberDocumentRequest(
        accessToken,
        crewMemberId,
        doc.id,
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo abrir el documento.",
        "danger",
      );
    } finally {
      setBusy(null);
    }
  }

  /** Descarga el archivo al disco. */
  async function handleDownload(doc: CrewMemberDocument) {
    if (!accessToken) return;
    setBusy({ id: doc.id, mode: "download" });
    try {
      await downloadCrewMemberDocumentRequest(
        accessToken,
        crewMemberId,
        doc.id,
        doc.originalName,
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo descargar.",
        "danger",
      );
    } finally {
      setBusy(null);
    }
  }

  const selectClass =
    "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]";

  return (
    <>
      <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-tremor-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Documentos del expediente
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--color-nachipa-secondary)]">
              Carga, vista previa y descarga. PDF o imagen, máx. 10 MB.
            </p>
          </div>
          {canUpload ? (
            <Button
              type="button"
              size="small"
              className="!w-auto shrink-0"
              onClick={openUpload}
            >
              <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
              Subir documento
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando documentos…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <FileText
              className="size-8 text-[var(--color-nachipa-secondary)]"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="text-[13px] text-[var(--color-nachipa-secondary)]">
              Todavía no hay documentos en este expediente.
            </p>
            {canUpload ? (
              <button
                type="button"
                className="mt-2 text-[13px] font-medium text-[var(--color-nachipa-primary)] hover:underline"
                onClick={openUpload}
              >
                Subir el primero
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="bg-[var(--color-nachipa-bg-page,#f3f4f6)] text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
                  <th className="rounded-tl-xl px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Archivo</th>
                  <th className="px-4 py-2.5">Origen</th>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="rounded-tr-xl px-4 py-2.5 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((doc) => {
                  const isPreview =
                    busy?.id === doc.id && busy.mode === "preview";
                  const isDownload =
                    busy?.id === doc.id && busy.mode === "download";
                  return (
                    <tr
                      key={doc.id}
                      className="border-t border-[var(--color-tremor-border)] text-[13px] text-[var(--color-nachipa-body)]"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-[var(--color-nachipa-title)]">
                          {doc.documentType.code}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-[var(--color-nachipa-secondary)]">
                          {displayTypeName(doc.documentType.name)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block max-w-[220px] truncate">
                          {doc.originalName}
                        </span>
                        <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                          {formatSize(doc.size)}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {doc.sourceModule}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatDate(doc.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="Ver documento"
                            aria-label={
                              isPreview ? "Abriendo…" : "Ver documento"
                            }
                            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-primary)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
                            disabled={busy?.id === doc.id}
                            onClick={() => {
                              void handlePreview(doc);
                            }}
                          >
                            <Eye
                              className="size-4"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          </button>
                          <button
                            type="button"
                            title="Descargar"
                            aria-label={
                              isDownload ? "Descargando…" : "Descargar"
                            }
                            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-primary)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
                            disabled={busy?.id === doc.id}
                            onClick={() => {
                              void handleDownload(doc);
                            }}
                          >
                            <Download
                              className="size-4"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={uploadOpen}
        icon={Upload}
        title="Subir documento"
        subtitle="Elegí el tipo del catálogo y un PDF o imagen (máx. 10 MB)."
        onClose={closeUpload}
        maxWidthClass="w-full max-w-[480px] sm:w-[480px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeUpload}
              disabled={uploading}
              className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab,#f4f4f5)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="crew-doc-upload-form"
              className="!h-9 !w-auto"
              disabled={uploading}
            >
              {uploading ? "Subiendo…" : "Subir"}
            </Button>
          </div>
        }
      >
        <form
          id="crew-doc-upload-form"
          onSubmit={onUpload}
          className="flex flex-col gap-4"
          noValidate
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Tipo de documento *
            </span>
            <select
              className={selectClass}
              value={documentTypeId}
              onChange={(e) => setDocumentTypeId(e.target.value)}
              required
              disabled={uploading}
            >
              <option value="">Seleccionar…</option>
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {displayTypeName(t.name)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Archivo *
            </span>
            <label
              htmlFor={fileInputId}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page,#f9fafc)] px-4 py-6 text-center hover:border-[var(--color-nachipa-primary)]"
            >
              <Upload
                className="size-5 text-[var(--color-nachipa-secondary)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="text-[13px] text-[var(--color-nachipa-body)]">
                {file ? file.name : "Elegir PDF, JPEG, PNG o WebP"}
              </span>
              {file ? (
                <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
                  {formatSize(file.size)}
                </span>
              ) : null}
            </label>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_MIME}
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
              }}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
