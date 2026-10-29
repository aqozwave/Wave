import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileText } from "lucide-react";

import { useToast } from "../../components/Toast/ToastProvider";
import {
  downloadCrewMemberDocumentRequest,
  listCrewMemberDocumentsRequest,
  previewCrewMemberDocumentRequest,
  type CrewMemberDocument,
} from "../../lib/api/crewMemberDocuments";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  /** Id del tripulante cuya ficha se muestra. */
  crewMemberId: string;
};

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
 * Listado, vista previa y descarga de documentos del expediente (ficha).
 * Sin alta desde el modal de crear/editar (queda para Prevención / Activos / HR).
 */
export function CrewDocumentsPanel({ crewMemberId }: Props) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<CrewMemberDocument[]>([]);
  const [loading, setLoading] = useState(true);
  /** Id en acción + modo (ver | descargar). */
  const [busy, setBusy] = useState<{
    id: string;
    mode: "preview" | "download";
  } | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listCrewMemberDocumentsRequest(
        accessToken,
        crewMemberId,
      );
      setItems(result.items);
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

  return (
    <div className="rounded-2xl border border-[var(--color-tremor-border)] bg-white">
      <div className="border-b border-[var(--color-tremor-border)] px-4 py-3">
        <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
          Documentos del expediente
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--color-nachipa-secondary)]">
          Vista previa y descarga. La carga la hacen Prevención, Activos u HR.
        </p>
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
                    <td className="px-4 py-3 capitalize">{doc.sourceModule}</td>
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
  );
}
