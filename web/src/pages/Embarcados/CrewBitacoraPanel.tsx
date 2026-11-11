import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  FileCheck,
  FileText,
  LogIn,
  Plus,
  Ship,
  Star,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "../../components/Button/Button";
import { ConfirmModal } from "../../components/ConfirmModal/ConfirmModal";
import { Modal } from "../../components/Modal/Modal";
import { StatusChip } from "../../components/StatusChip/StatusChip";
import { TextField } from "../../components/TextField/TextField";
import { useToast } from "../../components/Toast/ToastProvider";
import { userHasPermission } from "../../lib/api/auth";
import {
  fileToBase64,
} from "../../lib/api/crewMemberDocuments";
import {
  createCrewMemberLogEntryRequest,
  deleteCrewMemberLogEntryRequest,
  listCrewMemberHistoryRequest,
  type CrewHistoryCategory,
  type CrewHistoryItem,
  type CrewHistorySummary,
  type CrewLogEntryKind,
} from "../../lib/api/crewMembers";
import {
  listDocumentTypesRequest,
  type DocumentType,
} from "../../lib/api/documentTypes";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  /** Id del tripulante de la ficha. */
  crewMemberId: string;
  /** Empresa del tripulante (catálogo de tipos para adjunto). */
  businessId: string;
  /** Callback al pulsar «Ver todos» de documentos recientes (ir a tab Documentos). */
  onOpenDocuments?: () => void;
};

/** MIME aceptados (alineados al API de documentos). */
const ACCEPT_MIME =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";

/** Máximo 10 MB (mismo tope del API). */
const MAX_BYTES = 10 * 1024 * 1024;

/** MIME declarado: fallback por extensión si el navegador manda vacío. */
function resolveUploadMime(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/** Filtros pill de la timeline (Figma D31). */
const FILTERS: { id: CrewHistoryCategory; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "contract", label: "Contrato" },
  { id: "document", label: "Documentos" },
  { id: "observation", label: "Observaciones" },
  { id: "sanction", label: "Amonestaciones" },
  { id: "boarding", label: "Embarques" },
];

/** Opciones del select de alta (solo kinds cargables a mano). */
const LOG_KIND_OPTIONS: { id: CrewLogEntryKind; label: string }[] = [
  { id: "observation", label: "Observación" },
  { id: "sanction", label: "Amonestación" },
  { id: "boarding", label: "Embarque" },
];

/** YYYY-MM-DD local para input date. */
function todayInputValue(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convierte fecha del input a ISO al mediodía local (evita corrimiento de día). */
function dateInputToIso(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  return local.toISOString();
}

/** kind inicial del modal según el filtro activo. */
function defaultKindForFilter(filter: CrewHistoryCategory): CrewLogEntryKind {
  if (filter === "sanction") return "sanction";
  if (filter === "boarding") return "boarding";
  return "observation";
}

/** Fecha corta DD-MM-YYYY es-CL. */
function formatDay(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Hora HH:mm local. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Año del evento para agrupación. */
function yearOf(iso: string): number {
  return new Date(iso).getFullYear();
}

/** Ícono + fondo del rail según categoría. */
function eventVisual(category: CrewHistoryItem["category"]): {
  Icon: typeof FileText;
  tileClass: string;
  iconClass: string;
} {
  switch (category) {
    case "document":
      return {
        Icon: FileCheck,
        tileClass: "bg-[var(--color-status-info-bg)]",
        iconClass: "text-[var(--color-status-info-fg)]",
      };
    case "observation":
      return {
        Icon: Star,
        tileClass: "bg-[var(--color-status-success-bg)]",
        iconClass: "text-[var(--color-status-success-fg)]",
      };
    case "sanction":
      return {
        Icon: AlertTriangle,
        tileClass: "bg-[var(--color-status-warning-bg,#fef3c7)]",
        iconClass: "text-[var(--color-status-warning-fg,#d97706)]",
      };
    case "boarding":
      return {
        Icon: Ship,
        tileClass: "bg-[var(--color-kpi-indigo-soft,#e0ecfd)]",
        iconClass: "text-[var(--color-nachipa-primary)]",
      };
    case "course":
      return {
        Icon: FileText,
        tileClass: "bg-[var(--color-status-info-bg)]",
        iconClass: "text-[var(--color-status-info-fg)]",
      };
    default:
      return {
        Icon: LogIn,
        tileClass: "bg-[var(--color-status-neutral-bg,#f4f4f5)]",
        iconClass: "text-[var(--color-nachipa-secondary)]",
      };
  }
}

/**
 * Bitácora del tripulante (Figma D31 / AQO-68).
 * Timeline + filtros + alta/baja de observaciones, amonestaciones y embarques.
 */
export function CrewBitacoraPanel({
  crewMemberId,
  businessId,
  onOpenDocuments,
}: Props) {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const canManage = userHasPermission(user, "embarcados", "update");
  const canUploadDoc = userHasPermission(user, "embarcados.docs", "create");

  const [category, setCategory] = useState<CrewHistoryCategory>("all");
  const [allItems, setAllItems] = useState<CrewHistoryItem[]>([]);
  const [summary, setSummary] = useState<CrewHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<CrewLogEntryKind>("observation");
  const [addNote, setAddNote] = useState("");
  const [addDate, setAddDate] = useState(todayInputValue);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Entrada pendiente de confirmar borrado (modal del sistema). */
  const [pendingDelete, setPendingDelete] = useState<CrewHistoryItem | null>(
    null,
  );

  /** Carga historial completo una vez; el filtro es local. */
  const reload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listCrewMemberHistoryRequest(
        accessToken,
        crewMemberId,
        { page: 1, limit: 100, category: "all" },
      );
      setAllItems(result.items);
      setSummary(result.summary);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar la bitácora.",
        "danger",
      );
      setAllItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, crewMemberId, showToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Tipos subibles de la empresa (solo para adjunto de amonestación). */
  useEffect(() => {
    if (!accessToken || !businessId || !canUploadDoc) {
      setDocTypes([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const types = await listDocumentTypesRequest(accessToken, 1, 200, {
          businessId,
          forUpload: true,
        });
        if (cancelled) return;
        setDocTypes(
          types.items.filter((t) => t.state && t.businessId === businessId),
        );
      } catch {
        if (!cancelled) setDocTypes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, businessId, canUploadDoc]);

  /** Ítems visibles según pill activa. */
  const items = useMemo(
    () =>
      category === "all"
        ? allItems
        : allItems.filter((e) => e.category === category),
    [allItems, category],
  );

  /** Agrupa por año (desc) para encabezados de período. */
  const groups = useMemo(() => {
    const map = new Map<number, CrewHistoryItem[]>();
    for (const item of items) {
      const y = yearOf(item.createdAt);
      const bucket = map.get(y) ?? [];
      bucket.push(item);
      map.set(y, bucket);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [items]);

  /** Documentos recientes desde el set completo (no dependen del filtro). */
  const recentDocs = useMemo(
    () =>
      allItems
        .filter((e) => e.category === "document" && e.attachmentName)
        .slice(0, 5),
    [allItems],
  );

  const currentYear = new Date().getFullYear();

  /** Abre modal de alta con kind acorde al filtro. */
  function openAdd() {
    setAddKind(defaultKindForFilter(category));
    setAddNote("");
    setAddDate(todayInputValue());
    setDocumentTypeId("");
    setFile(null);
    setAddOpen(true);
  }

  /** Cierra modal sin guardar. */
  function closeAdd() {
    if (saving) return;
    setAddOpen(false);
  }

  /** Crea entrada (y adjunto si amonestación) y refresca timeline. */
  async function onSubmitAdd(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !canManage) return;
    const note = addNote.trim();
    if (!note) {
      showToast("Escribí una nota.", "danger");
      return;
    }
    if (!addDate) {
      showToast("Indicá la fecha.", "danger");
      return;
    }
    if (addKind === "sanction" && file) {
      if (!canUploadDoc) {
        showToast("No tenés permiso para subir documentos.", "danger");
        return;
      }
      if (!documentTypeId) {
        showToast("Elegí el tipo de documento del adjunto.", "danger");
        return;
      }
      if (file.size > MAX_BYTES) {
        showToast("El archivo supera el máximo de 10 MB.", "danger");
        return;
      }
    }
    setSaving(true);
    try {
      let attachment:
        | {
            documentTypeId: string;
            fileName: string;
            mimeType: string;
            contentBase64: string;
          }
        | undefined;
      if (addKind === "sanction" && file && documentTypeId) {
        const contentBase64 = await fileToBase64(file);
        attachment = {
          documentTypeId,
          fileName: file.name,
          mimeType: resolveUploadMime(file),
          contentBase64,
        };
      }
      await createCrewMemberLogEntryRequest(accessToken, crewMemberId, {
        kind: addKind,
        note,
        occurredAt: dateInputToIso(addDate),
        ...(attachment ? { attachment } : {}),
      });
      showToast(
        attachment
          ? "Amonestación guardada; el archivo quedó en Documentos."
          : "Entrada agregada a la bitácora.",
        "success",
      );
      setAddOpen(false);
      await reload();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar la entrada.",
        "danger",
      );
    } finally {
      setSaving(false);
    }
  }

  /** Abre modal de confirmación para soft delete. */
  function requestDeleteEntry(item: CrewHistoryItem) {
    if (!canManage || item.source !== "log_entry") return;
    setPendingDelete(item);
  }

  /** Confirma soft delete de una entrada manual. */
  async function confirmDeleteEntry() {
    if (!accessToken || !canManage || !pendingDelete) return;
    if (pendingDelete.source !== "log_entry") return;
    setDeletingId(pendingDelete.id);
    try {
      await deleteCrewMemberLogEntryRequest(
        accessToken,
        crewMemberId,
        pendingDelete.id,
      );
      showToast("Entrada eliminada.", "success");
      setPendingDelete(null);
      await reload();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo eliminar la entrada.",
        "danger",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
      {/* Timeline: scrollea adentro; la ficha no hace scroll de página. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[var(--color-tremor-border)] bg-white">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-tremor-border)] px-[18px] py-3.5">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = category === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCategory(f.id)}
                  className={
                    active
                      ? "rounded-full border border-[var(--color-nachipa-primary)] bg-[var(--color-table-row-selected,#eaf2fe)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-nachipa-link,#1d6fe8)]"
                      : "rounded-full border border-[var(--color-tremor-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--color-nachipa-body)]"
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {canManage ? (
            <Button
              type="button"
              size="small"
              className="!w-auto"
              onClick={openAdd}
            >
              <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
              Agregar
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-4">
        {loading ? (
          <p className="py-8 text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando bitácora…
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-[13px] text-[var(--color-nachipa-secondary)]">
            Sin eventos todavía. Agregá una observación, amonestación o
            embarque, o esperá altas de documentos y cambios de ficha.
          </p>
        ) : (
          <div className="flex flex-col">
            {groups.map(([year, yearItems]) => (
              <div key={year}>
                <div className="flex items-center gap-2.5 pb-2.5 pt-1.5">
                  <p className="shrink-0 text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                    {year}
                  </p>
                  <div className="h-px min-w-0 flex-1 bg-[var(--color-tremor-border)]" />
                  {year === currentYear ? (
                    <p className="shrink-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                      Período actual
                    </p>
                  ) : null}
                </div>

                {yearItems.map((item, idx) => {
                  const { Icon, tileClass, iconClass } = eventVisual(
                    item.category,
                  );
                  const isLastInYear = idx === yearItems.length - 1;
                  const isLastYear =
                    year === groups[groups.length - 1]?.[0];
                  const isLast = isLastInYear && isLastYear;
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3.5 items-start"
                    >
                      <div className="flex w-[76px] shrink-0 flex-col items-end gap-0.5 pt-1.5 whitespace-nowrap">
                        <p className="text-[12px] font-semibold text-[var(--color-nachipa-title)]">
                          {formatDay(item.createdAt)}
                        </p>
                        <p className="text-[11px] text-[var(--color-nachipa-secondary)]">
                          {formatTime(item.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-center self-stretch">
                        <div
                          className={`flex size-8 items-center justify-center rounded-2xl ${tileClass}`}
                        >
                          <Icon
                            className={`size-4 ${iconClass}`}
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </div>
                        {!isLast ? (
                          <div className="w-0.5 min-h-[12px] flex-1 bg-[var(--color-tremor-border)]" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 pb-5 pt-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-semibold text-[var(--color-nachipa-title)]">
                            {item.title}
                          </p>
                          {item.statusLabel ? (
                            <StatusChip tone={item.statusTone}>
                              {item.statusLabel}
                            </StatusChip>
                          ) : null}
                          {canManage && item.source === "log_entry" ? (
                            <button
                              type="button"
                              className="ml-auto inline-flex size-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-status-danger-bg,#fee2e2)] hover:text-[var(--color-status-danger-fg,#b91c1c)] disabled:opacity-50"
                              aria-label="Eliminar entrada"
                              disabled={deletingId === item.id}
                              onClick={() => {
                                requestDeleteEntry(item);
                              }}
                            >
                              <Trash2
                                className="size-3.5"
                                strokeWidth={1.5}
                                aria-hidden
                              />
                            </button>
                          ) : null}
                        </div>
                        {item.detail ? (
                          <p className="mb-1 text-[13px] text-[var(--color-nachipa-body)]">
                            {item.detail}
                          </p>
                        ) : null}
                        {item.actor ? (
                          <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                            {item.actor}
                          </p>
                        ) : null}
                        {item.attachmentName ? (
                          <div className="mt-1.5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-table-head-bg,#f8f9fb)] px-2.5 py-1.5">
                            <FileText
                              className="size-3.5 text-[var(--color-nachipa-secondary)]"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                            <span className="text-[12px] font-medium text-[var(--color-nachipa-title)]">
                              {item.attachmentName}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Lateral: scrollea si no entra; no empuja la página. */}
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto lg:w-[340px] lg:max-h-full">
        <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-white px-[18px] py-4">
          <p className="mb-3 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
            Períodos laborales
          </p>
          <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
            Todavía no hay períodos registrados para este tripulante.
          </p>
        </div>

        <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-white px-[18px] py-4">
          <p className="mb-3 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
            Resumen de la bitácora
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryStat
              label="Observaciones"
              value={summary?.observations ?? 0}
              tileClass="bg-[var(--color-status-success-bg)]"
              Icon={Star}
              iconClass="text-[var(--color-status-success-fg)]"
            />
            <SummaryStat
              label="Amonestaciones"
              value={summary?.sanctions ?? 0}
              tileClass="bg-[var(--color-status-warning-bg,#fef3c7)]"
              Icon={AlertTriangle}
              iconClass="text-[var(--color-status-warning-fg,#d97706)]"
            />
            <SummaryStat
              label="Documentos"
              value={summary?.documents ?? 0}
              tileClass="bg-[var(--color-status-info-bg)]"
              Icon={FileText}
              iconClass="text-[var(--color-status-info-fg)]"
            />
            <SummaryStat
              label="Cambios de nave"
              value={summary?.boardings ?? 0}
              tileClass="bg-[var(--color-kpi-indigo-soft,#e0ecfd)]"
              Icon={Ship}
              iconClass="text-[var(--color-nachipa-primary)]"
            />
          </div>
        </div>

        <div className="rounded-[14px] border border-[var(--color-tremor-border)] bg-white px-[18px] py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-[var(--color-nachipa-title)]">
              Documentos recientes
            </p>
            {onOpenDocuments && (summary?.documents ?? 0) > 0 ? (
              <button
                type="button"
                onClick={onOpenDocuments}
                className="text-[12px] font-medium text-[var(--color-nachipa-link,#1d6fe8)]"
              >
                Ver todos ({summary?.documents ?? 0})
              </button>
            ) : null}
          </div>
          {recentDocs.length === 0 ? (
            <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Sin documentos en este filtro.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {recentDocs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-status-neutral-bg,#f4f4f5)]">
                    <FileText
                      className="size-3.5 text-[var(--color-nachipa-secondary)]"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-[var(--color-nachipa-title)]">
                      {doc.attachmentName}
                    </p>
                    <p className="text-[11px] text-[var(--color-nachipa-secondary)]">
                      {doc.categoryLabel} · {formatDay(doc.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <Modal
        open={addOpen}
        icon={Plus}
        title="Agregar a bitácora"
        subtitle="Observación, amonestación o embarque con fecha y nota."
        onClose={closeAdd}
        maxWidthClass="w-full max-w-[480px] sm:w-[480px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              onClick={closeAdd}
              disabled={saving}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="crew-log-entry-form"
              className="!w-auto !font-medium"
              disabled={saving || !canManage}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        <form
          id="crew-log-entry-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            void onSubmitAdd(e);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Tipo *
            </span>
            <select
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]"
              value={addKind}
              onChange={(e) => {
                const next = e.target.value as CrewLogEntryKind;
                setAddKind(next);
                // Adjunto solo en amonestación: limpia al cambiar de tipo.
                if (next !== "sanction") {
                  setFile(null);
                  setDocumentTypeId("");
                }
              }}
              required
            >
              {LOG_KIND_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Fecha *"
            type="date"
            value={addDate}
            onChange={(e) => setAddDate(e.target.value)}
            required
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
              Nota *
            </span>
            <textarea
              className="min-h-[100px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]"
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
              maxLength={2000}
              placeholder="Descripción del evento"
              required
            />
            <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Máximo 2000 caracteres
            </span>
          </label>

          {addKind === "sanction" && canUploadDoc ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-nachipa-bg-page,#f9fafc)] px-3.5 py-3">
              <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Documento (opcional)
              </p>
              <p className="m-0 text-[12px] text-[var(--color-nachipa-secondary)]">
                Queda en el tab Documentos del expediente.
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Tipo de documento
                </span>
                <select
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)] outline-none focus:border-[var(--color-nachipa-primary)]"
                  value={documentTypeId}
                  onChange={(e) => setDocumentTypeId(e.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {docTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex cursor-pointer flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Archivo
                </span>
                <span className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-tremor-border)] bg-white px-3 text-[13px] text-[var(--color-nachipa-body)]">
                  <Upload
                    className="size-3.5 shrink-0 text-[var(--color-nachipa-secondary)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span className="truncate">
                    {file ? file.name : "PDF, Word o imagen (máx. 10 MB)"}
                  </span>
                </span>
                <input
                  type="file"
                  accept={ACCEPT_MIME}
                  className="sr-only"
                  onChange={(e) => {
                    const next = e.target.files?.[0] ?? null;
                    setFile(next);
                  }}
                />
              </label>
              {file ? (
                <button
                  type="button"
                  className="self-start text-[12px] font-medium text-[var(--color-nachipa-link,#1d6fe8)]"
                  onClick={() => setFile(null)}
                >
                  Quitar archivo
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminar entrada"
        message="¿Eliminar esta entrada de la bitácora?"
        detail={
          pendingDelete?.detail
            ? pendingDelete.detail.slice(0, 160)
            : undefined
        }
        confirmLabel="Eliminar"
        busyLabel="Eliminando…"
        busy={deletingId !== null}
        onClose={() => {
          if (deletingId === null) setPendingDelete(null);
        }}
        onConfirm={() => {
          void confirmDeleteEntry();
        }}
      />
    </div>
  );
}

/** Stat del resumen lateral. */
function SummaryStat({
  label,
  value,
  tileClass,
  Icon,
  iconClass,
}: {
  label: string;
  value: number;
  tileClass: string;
  Icon: typeof FileText;
  iconClass: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] bg-[var(--color-table-head-bg,#f8f9fb)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div
          className={`flex size-6 items-center justify-center rounded-xl ${tileClass}`}
        >
          <Icon className={`size-3 ${iconClass}`} strokeWidth={1.5} aria-hidden />
        </div>
        <p className="text-[12px] font-medium text-[var(--color-nachipa-secondary)]">
          {label}
        </p>
      </div>
      <p className="text-[20px] font-semibold tabular-nums text-[var(--color-nachipa-title)]">
        {value}
      </p>
    </div>
  );
}
