import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "../../components/Button/Button";
import { ConfirmModal } from "../../components/ConfirmModal/ConfirmModal";
import { DataTableCard } from "../../components/DataTableCard/DataTableCard";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import {
  StatusChip,
  type StatusChipTone,
} from "../../components/StatusChip/StatusChip";
import { TableHeaderCell } from "../../components/TableHeaderCell/TableHeaderCell";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  createSystemAnnouncementRequest,
  deleteSystemAnnouncementRequest,
  listAdminSystemAnnouncementsRequest,
  updateSystemAnnouncementRequest,
  type SystemAnnouncementAdmin,
  type SystemAnnouncementKind,
} from "../../lib/api/systemAnnouncements";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Opciones de tipo de aviso. */
const KIND_OPTIONS: Array<{ value: SystemAnnouncementKind; label: string }> = [
  { value: "maintenance", label: "Mantenimiento" },
  { value: "config", label: "Configuración" },
  { value: "version", label: "Versión" },
];

/** Formulario vacío. */
const EMPTY_FORM = {
  kind: "maintenance" as SystemAnnouncementKind,
  title: "",
  body: "",
  expiresAtLocal: "",
};

/** Fecha corta es-CL. */
function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Chip de estado según vencimiento / borrado. */
function rowStatus(row: SystemAnnouncementAdmin): {
  label: string;
  tone: StatusChipTone;
} {
  if (row.deletedAt) return { label: "Eliminado", tone: "neutral" };
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
    return { label: "Vencido", tone: "warning" };
  }
  return { label: "Activo", tone: "success" };
}

/**
 * Admin de avisos de sistema (campanita).
 * Solo superadmin: publicar, editar y soft-delete.
 * Sin frame Figma dedicado: patrón ActivityLogs / DataTable.
 */
export function SystemAnnouncementsAdmin() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [items, setItems] = useState<SystemAnnouncementAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [includeExpired, setIncludeExpired] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SystemAnnouncementAdmin | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteRow, setDeleteRow] = useState<SystemAnnouncementAdmin | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  /** Carga listado admin. */
  const load = useCallback(async () => {
    if (!accessToken || !isSuperadmin) return;
    setLoading(true);
    try {
      const result = await listAdminSystemAnnouncementsRequest(accessToken, {
        includeExpired,
        limit: 50,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar avisos",
        "danger",
      );
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accessToken, includeExpired, isSuperadmin, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Abre modal de alta. */
  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  /** Abre modal de edición. */
  function openEdit(row: SystemAnnouncementAdmin) {
    setEditing(row);
    setForm({
      kind: row.kind,
      title: row.title,
      body: row.body,
      expiresAtLocal: row.expiresAt
        ? row.expiresAt.slice(0, 16)
        : "",
    });
    setModalOpen(true);
  }

  /** Convierte datetime-local a ISO o null. */
  function expiresToIso(local: string): string | null {
    if (!local.trim()) return null;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  /** Guarda create o patch. */
  async function onSave() {
    if (!accessToken) return;
    if (!form.title.trim() || !form.body.trim()) {
      showToast("Completá título y mensaje", "danger");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateSystemAnnouncementRequest(accessToken, editing.id, {
          kind: form.kind,
          title: form.title.trim(),
          body: form.body.trim(),
          expiresAt: expiresToIso(form.expiresAtLocal),
        });
        showToast("Aviso actualizado", "success");
      } else {
        await createSystemAnnouncementRequest(accessToken, {
          kind: form.kind,
          title: form.title.trim(),
          body: form.body.trim(),
          expiresAt: expiresToIso(form.expiresAtLocal),
        });
        showToast("Aviso publicado", "success");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar",
        "danger",
      );
    } finally {
      setSaving(false);
    }
  }

  /** Soft-delete. */
  async function onConfirmDelete() {
    if (!accessToken || !deleteRow) return;
    setDeleting(true);
    try {
      await deleteSystemAnnouncementRequest(accessToken, deleteRow.id);
      showToast("Aviso eliminado", "success");
      setDeleteRow(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar",
        "danger",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!isSuperadmin) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          breadcrumb="Avisos del sistema"
          breadcrumbIcon={Megaphone}
          actions={<UserMenu />}
        />
        <div className="px-6 py-8 text-[14px] text-[var(--color-nachipa-secondary)]">
          Solo el superadmin puede publicar avisos de sistema.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb="Avisos del sistema"
        breadcrumbIcon={Megaphone}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Sistema" },
            { label: "Avisos" },
          ]}
          title="Avisos del sistema"
          description="Mensajes de la campanita (versión, mantenimiento, configuración). Llegan a todos los usuarios."
          actions={
            <Button type="button" className="!w-auto" onClick={openCreate}>
              Nuevo aviso
            </Button>
          }
        />

        <DataTableCard
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-[var(--color-nachipa-body)]">
                <input
                  type="checkbox"
                  checked={includeExpired}
                  onChange={(e) => setIncludeExpired(e.target.checked)}
                  className="size-4 rounded border-[var(--color-tremor-border)]"
                />
                Incluir vencidos
              </label>
              <span className="text-[13px] text-[var(--color-nachipa-secondary)]">
                {loading
                  ? "Cargando…"
                  : `${total} ${total === 1 ? "aviso" : "avisos"}`}
              </span>
            </div>
          }
        >
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-[var(--color-table-head-bg)]">
                <TableHeaderCell>Tipo</TableHeaderCell>
                <TableHeaderCell>Título</TableHeaderCell>
                <TableHeaderCell>Publicado</TableHeaderCell>
                <TableHeaderCell>Vence</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                  >
                    No hay avisos. Publicá uno con «Nuevo aviso».
                  </td>
                </tr>
              ) : null}
              {items.map((row) => {
                const status = rowStatus(row);
                const kindLabel =
                  KIND_OPTIONS.find((k) => k.value === row.kind)?.label ??
                  row.kind;
                return (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-nachipa-border-subtle)]"
                  >
                    <td className="px-4 py-3 text-[13px] text-[var(--color-nachipa-body)]">
                      {kindLabel}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                      {row.title}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-[var(--color-nachipa-body)]">
                      {formatWhen(row.publishedAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-[var(--color-nachipa-body)]">
                      {formatWhen(row.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip tone={status.tone}>{status.label}</StatusChip>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px]">
                      {!row.deletedAt ? (
                        <>
                          <button
                            type="button"
                            className="text-[var(--color-nachipa-primary)] hover:underline"
                            onClick={() => openEdit(row)}
                          >
                            Editar
                          </button>
                          <span className="mx-1.5 text-[var(--color-nachipa-muted)]">
                            ·
                          </span>
                          <button
                            type="button"
                            className="text-[var(--color-status-danger-fg)] hover:underline"
                            onClick={() => setDeleteRow(row)}
                          >
                            Eliminar
                          </button>
                        </>
                      ) : (
                        <span className="text-[var(--color-nachipa-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableCard>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? "Editar aviso" : "Nuevo aviso"}
        subtitle="Se muestra en la campanita de todos los usuarios autenticados."
        icon={Megaphone}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setModalOpen(false)}
              className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab,#f4f4f5)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
            >
              Cancelar
            </button>
            <Button
              type="button"
              className="!w-auto"
              onClick={() => void onSave()}
              disabled={saving}
            >
              {saving ? "Guardando…" : editing ? "Guardar" : "Publicar"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px]">
            <span className="font-medium text-[var(--color-nachipa-body)]">
              Tipo
            </span>
            <select
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  kind: e.target.value as SystemAnnouncementKind,
                }))
              }
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3"
            >
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px]">
            <span className="font-medium text-[var(--color-nachipa-body)]">
              Título
            </span>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3"
              maxLength={160}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px]">
            <span className="font-medium text-[var(--color-nachipa-body)]">
              Mensaje
            </span>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              className="min-h-[120px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3 py-2"
              maxLength={4000}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px]">
            <span className="font-medium text-[var(--color-nachipa-body)]">
              Vence (opcional)
            </span>
            <input
              type="datetime-local"
              value={form.expiresAtLocal}
              onChange={(e) =>
                setForm((f) => ({ ...f, expiresAtLocal: e.target.value }))
              }
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3"
            />
          </label>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteRow)}
        title="Eliminar aviso"
        message={
          deleteRow
            ? `¿Eliminar «${deleteRow.title}»? Dejará de verse en la campanita.`
            : ""
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void onConfirmDelete()}
        onClose={() => setDeleteRow(null)}
      />
    </div>
  );
}
