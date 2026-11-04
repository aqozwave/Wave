import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { useToast } from "../../components/Toast/ToastProvider";
import {
  createPermitChecklistItemRequest,
  deletePermitChecklistItemRequest,
  updatePermitChecklistItemRequest,
  type PermitChecklistItem,
} from "../../lib/api/permitTypes";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

type Props = {
  /** Id del tipo de permiso. */
  permitTypeId: string;
  /** Ítems actuales (ordenados). */
  items: PermitChecklistItem[];
  /** Tras mutar, recargar. */
  onChanged: () => void;
  /** Si false, solo lectura. */
  canManage: boolean;
};

/** Form ítem checklist. */
type ItemForm = {
  text: string;
  order: string;
  active: boolean;
};

/**
 * Sección Checklist de la ficha de tipo (P15).
 * Alta / editar texto-orden / desactivar.
 */
export function PermitTypeChecklistPanel({
  permitTypeId,
  items,
  onChanged,
  canManage,
}: Props) {
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PermitChecklistItem | null>(null);
  const [form, setForm] = useState<ItemForm>({
    text: "",
    order: "",
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  /** Fila pendiente de confirmar desactivar. */
  const [pendingDeactivate, setPendingDeactivate] =
    useState<PermitChecklistItem | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  /** Abre alta. */
  function openCreate() {
    setEditing(null);
    setForm({ text: "", order: "", active: true });
    setOpen(true);
  }

  /** Abre edición. */
  function openEdit(row: PermitChecklistItem) {
    setEditing(row);
    setForm({
      text: row.text,
      order: String(row.order),
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
    if (!form.text.trim()) {
      showToast("El texto es requerido.", "danger");
      return;
    }

    let order: number | undefined;
    if (form.order.trim()) {
      const n = Number(form.order);
      if (!Number.isInteger(n) || n < 1) {
        showToast("Orden: entero ≥ 1, o vacío al crear.", "danger");
        return;
      }
      order = n;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updatePermitChecklistItemRequest(
          accessToken,
          permitTypeId,
          editing.id,
          {
            text: form.text.trim(),
            ...(order !== undefined ? { order } : {}),
            active: form.active,
          },
        );
        showToast("Ítem actualizado.", "success");
      } else {
        await createPermitChecklistItemRequest(accessToken, permitTypeId, {
          text: form.text.trim(),
          ...(order !== undefined ? { order } : {}),
        });
        showToast("Ítem agregado.", "success");
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

  /** Confirma desactivar ítem (Modal del sistema). */
  async function confirmDeactivate() {
    if (!accessToken || !canManage || !pendingDeactivate || deactivating) {
      return;
    }
    setDeactivating(true);
    try {
      await deletePermitChecklistItemRequest(
        accessToken,
        permitTypeId,
        pendingDeactivate.id,
      );
      showToast("Ítem desactivado.", "success");
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
          <h2 className="m-0 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
            Checklist ({items.length})
          </h2>
          {canManage ? (
            <Button
              type="button"
              size="small"
              className="!w-auto"
              onClick={openCreate}
            >
              <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
              Agregar ítem
            </Button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="m-0 px-4 py-6 text-[13px] text-[var(--color-nachipa-secondary)]">
            Sin ítems de checklist.
          </p>
        ) : (
          <ol className="m-0 list-decimal space-y-2 px-4 py-3 pl-8 text-[13px] text-[var(--color-nachipa-title)]">
            {items.map((item) => (
              <li key={item.id} className="pr-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={!item.active ? "opacity-50" : undefined}>
                    {item.text}
                    {!item.active ? " (inactivo)" : ""}
                  </span>
                  {canManage ? (
                    <span className="flex gap-2 text-[12px]">
                      <button
                        type="button"
                        className="font-medium text-[var(--color-nachipa-primary)] hover:underline"
                        onClick={() => openEdit(item)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="font-medium text-[var(--color-status-danger-fg)] hover:underline"
                        onClick={() => setPendingDeactivate(item)}
                      >
                        Desactivar
                      </button>
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Modal
        open={open}
        onClose={close}
        title={editing ? "Editar ítem" : "Nuevo ítem de checklist"}
        subtitle="Texto que se marca en el permiso de trabajo."
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
              form="checklist-item-form"
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
          id="checklist-item-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => void onSubmit(e)}
        >
          <TextField
            label="Texto"
            name="text"
            required
            value={form.text}
            onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
          />
          <TextField
            label="Orden"
            name="order"
            inputMode="numeric"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
            placeholder={editing ? undefined : "Vacío = al final"}
          />
          {editing ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Activo
              </span>
              <Toggle
                checked={form.active}
                aria-label="Activo"
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
        title="Desactivar ítem"
        subtitle={
          pendingDeactivate
            ? `¿Desactivar «${pendingDeactivate.text}»?`
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
          El ítem deja de aparecer en checklists nuevos; no se borra el
          historial.
        </p>
      </Modal>
    </>
  );
}
