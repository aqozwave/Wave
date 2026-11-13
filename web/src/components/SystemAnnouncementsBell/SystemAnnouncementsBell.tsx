import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  listSystemAnnouncementsRequest,
  markAllSystemAnnouncementsReadRequest,
  markSystemAnnouncementReadRequest,
  type SystemAnnouncement,
  type SystemAnnouncementKind,
} from "../../lib/api/systemAnnouncements";
import { useAuth } from "../../lib/auth/AuthContext";

/** Chip de tipo de aviso. */
const KIND_META: Record<
  SystemAnnouncementKind,
  { label: string; className: string }
> = {
  version: {
    label: "Versión",
    className:
      "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-fg)]",
  },
  config: {
    label: "Configuración",
    className:
      "bg-[var(--color-status-warning-bg,#ffedd5)] text-[var(--color-status-warning-fg,#c2410c)]",
  },
  maintenance: {
    label: "Mantenimiento",
    className:
      "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]",
  },
};

/** Fecha corta es-CL. */
function formatPublishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Campanita de avisos de sistema (portal viejo SystemAnnouncementsBell).
 * Vive en el Topbar; cualquier usuario autenticado.
 */
export function SystemAnnouncementsBell() {
  const { accessToken } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SystemAnnouncement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  /** Aplica respuesta de list/mark. */
  const applyResult = useCallback(
    (result: { items: SystemAnnouncement[]; unreadCount: number }) => {
      setItems(result.items);
      setUnreadCount(result.unreadCount);
    },
    [],
  );

  /** Carga avisos desde la API. */
  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const result = await listSystemAnnouncementsRequest(accessToken, 20);
      applyResult(result);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [accessToken, applyResult]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** Abre/cierra el panel y refresca al abrir. */
  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
    }
  }

  /** Marca un aviso leído. */
  async function handleMarkRead(id: string) {
    if (!accessToken) return;
    try {
      const result = await markSystemAnnouncementReadRequest(accessToken, id);
      applyResult(result);
    } catch {
      // Silencioso: el listado sigue usable.
    }
  }

  /** Marca todos leídos. */
  async function handleMarkAll() {
    if (!accessToken) return;
    try {
      const result = await markAllSystemAnnouncementsReadRequest(accessToken);
      applyResult(result);
    } catch {
      // Silencioso.
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="relative flex size-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-[var(--color-tremor-background)] text-[var(--color-icon-default)]"
        aria-label="Avisos del sistema"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => void handleToggle()}
      >
        <Bell size={16} strokeWidth={1.5} aria-hidden />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--color-status-danger-fg)]"
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Avisos del sistema"
          className="absolute right-0 z-[100] mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-tremor-border)] px-3.5 py-2.5">
            <div>
              <p className="m-0 text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                Avisos del sistema
              </p>
              <p className="m-0 text-[11px] text-[var(--color-nachipa-secondary)]">
                {unreadCount > 0 ? `${unreadCount} sin leer` : "Estás al día"}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="text-[12px] font-medium text-[var(--color-nachipa-accent,#004c8c)] hover:underline"
              >
                Marcar todos
              </button>
            ) : null}
          </div>

          <ul className="m-0 max-h-[22rem] list-none overflow-y-auto p-0">
            {loading ? (
              <li className="px-3.5 py-6 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                Cargando…
              </li>
            ) : items.length === 0 ? (
              <li className="px-3.5 py-6 text-center text-[12px] text-[var(--color-nachipa-secondary)]">
                No hay avisos.
              </li>
            ) : (
              items.map((item) => {
                const meta = KIND_META[item.kind];
                return (
                  <li
                    key={item.id}
                    className={[
                      "border-t border-[var(--color-tremor-border)] px-3.5 py-3",
                      item.read ? "bg-white" : "bg-[var(--color-nachipa-bg-page,#f9fafc)]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                          meta.className,
                        ].join(" ")}
                      >
                        {meta.label}
                      </span>
                      <span className="tabular-nums text-[10px] text-[var(--color-nachipa-secondary)]">
                        {formatPublishedAt(item.publishedAt)}
                      </span>
                    </div>
                    <p className="m-0 mt-1.5 text-[13px] font-semibold text-[var(--color-nachipa-title)]">
                      {item.title}
                    </p>
                    <p className="m-0 mt-1 text-[12px] leading-[18px] text-[var(--color-nachipa-secondary)]">
                      {item.body}
                    </p>
                    {!item.read ? (
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(item.id)}
                        className="mt-2 text-[12px] font-medium text-[var(--color-nachipa-accent,#004c8c)] hover:underline"
                      >
                        Marcar como leído
                      </button>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
