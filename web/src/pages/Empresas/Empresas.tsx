import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  MoreVertical,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "../../components/Button/Button";
import { Modal } from "../../components/Modal/Modal";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { TextField } from "../../components/TextField/TextField";
import { Toggle } from "../../components/Toggle/Toggle";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  createBusinessRequest,
  deleteBusinessRequest,
  listBusinessesRequest,
  updateBusinessRequest,
  type Business,
  type BusinessWriteBody,
} from "../../lib/api/businesses";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Form create (Figma 1 paso) + edit extendido. */
type FormState = {
  name: string;
  rut: string;
  giro: string;
  country: string;
  commune: string;
  city: string;
  phone: string;
  email: string;
  description: string;
  state: boolean;
  /** Solo UI create (aún no hay endpoint de invitación). */
  adminEmail: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  rut: "",
  giro: "",
  country: "Chile",
  commune: "",
  city: "",
  phone: "",
  email: "",
  description: "",
  state: true,
  adminEmail: "",
};

/** Capitaliza nombre guardado en minúsculas. */
function displayName(value: string): string {
  if (!value) return "—";
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Inicial del preview de logo (Figma). */
function initialOf(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "A";
}

/**
 * Pantalla Empresas (Figma S5 · 184:12144).
 * Lista + modal Nueva empresa (1 paso); editar con campos extendidos.
 */
export function Empresas() {
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = user?.internalRol === "superadmin";

  const [items, setItems] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  /** Menú kebab abierto por fila. */
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listBusinessesRequest(accessToken);
      setItems(result.items);
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las empresas.",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) =>
      [b.rut, b.name, b.giro, b.city, b.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(row: Business) {
    setEditing(row);
    setMenuId(null);
    setForm({
      name: row.name,
      rut: row.rut ?? "",
      giro: row.giro ?? "",
      country: row.country ?? "Chile",
      commune: row.commune ?? "",
      city: row.city ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      description: row.description ?? "",
      state: row.state,
      adminEmail: "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildBody(): BusinessWriteBody {
    if (editing && !isSuperadmin) {
      return {
        giro: form.giro || undefined,
        country: form.country || undefined,
        commune: form.commune || undefined,
        city: form.city || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        description: form.description || undefined,
      };
    }
    return {
      rut: form.rut || undefined,
      name: form.name.trim(),
      giro: form.giro || undefined,
      country: form.country || undefined,
      commune: form.commune || undefined,
      city: form.city || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      description: form.description || undefined,
      state: form.state,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    if (!form.name.trim()) {
      showToast("El nombre es requerido.", "danger");
      return;
    }
    if (form.adminEmail.trim()) {
      // UI Figma: invitación aún no cableada al API.
      showToast(
        "La invitación al administrador se habilitará en un próximo paso.",
        "info",
      );
    }

    setSubmitting(true);
    try {
      const body = buildBody();
      if (editing) {
        await updateBusinessRequest(accessToken, editing.id, body);
        showToast("Empresa actualizada.", "success");
      } else {
        await createBusinessRequest(accessToken, body);
        showToast("Empresa creada.", "success");
      }
      closeModal();
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(row: Business) {
    if (!accessToken || !isSuperadmin) return;
    setMenuId(null);
    const ok = window.confirm(
      `¿Eliminar la empresa «${displayName(row.name)}»? Quedará desactivada.`,
    );
    if (!ok) return;
    try {
      await deleteBusinessRequest(accessToken, row.id);
      showToast("Empresa eliminada.", "success");
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo eliminar.",
        "danger",
      );
    }
  }

  const lockKeyFields = Boolean(editing) && !isSuperadmin;
  const previewName = form.name.trim()
    ? displayName(form.name)
    : "Nueva empresa";

  // Un solo fondo #f9fafc (Figma): Topbar + content, sin franja blanca.
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f9fafc]">
      <Topbar
        breadcrumb="Empresas"
        breadcrumbIcon={Building2}
        actions={<UserMenu />}
      />

      {/* Content (Figma 184:12148): pl-32 pr-48, sin scroll horizontal. */}
      <div className="animate-enter flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden pb-6 pl-8 pr-12 pt-7">
        <PageHeader
          crumbs={[
            { label: "Configuración" },
            { label: "Empresas" },
          ]}
          title="Empresas"
          description={
            isSuperadmin
              ? "Administra todas las empresas del sistema."
              : "Administra la información de tu empresa."
          }
          actions={
            isSuperadmin ? (
              <Button type="button" className="!w-auto shrink-0" onClick={openCreate}>
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                Nueva empresa
              </Button>
            ) : undefined
          }
        />

        <label className="flex h-11 w-full max-w-[448px] shrink-0 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white pl-4 pr-3.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--color-nachipa-placeholder)]"
          />
          <Search
            className="size-4 shrink-0 text-[var(--color-icon-default)]"
            strokeWidth={1.5}
            aria-hidden
          />
        </label>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-tremor-border)] bg-white">
          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[12px]">
              <colgroup>
                <col style={{ width: "16%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr className="bg-[var(--color-table-head-bg,#f8f9fb)] text-[12px] font-semibold text-[var(--color-table-head-text,#6b6b73)]">
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    RUT
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Nombre
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Giro
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Ciudad
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3">
                    Estado
                  </th>
                  <th className="h-9 border-b border-[var(--color-tremor-border)] px-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-[13px] text-[var(--color-nachipa-secondary)]"
                    >
                      No hay empresas para mostrar.
                    </td>
                  </tr>
                ) : null}
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-nachipa-border-subtle)]"
                  >
                    <td className="h-[52px] truncate px-3 tabular-nums text-[var(--color-nachipa-body)]">
                      {row.rut || "—"}
                    </td>
                    <td className="h-[52px] truncate px-3 font-medium text-[var(--color-nachipa-title)]">
                      {displayName(row.name)}
                    </td>
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {row.giro || "—"}
                    </td>
                    <td className="h-[52px] truncate px-3 text-[var(--color-nachipa-body)]">
                      {row.city || "—"}
                    </td>
                    <td className="h-[52px] px-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium leading-4",
                          row.state
                            ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]"
                            : "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]",
                        ].join(" ")}
                      >
                        {row.state ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="relative h-[52px] px-3 text-right">
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-icon-default)] hover:bg-[var(--color-nachipa-bg-page)]"
                        aria-label="Acciones"
                        onClick={() =>
                          setMenuId((id) => (id === row.id ? null : row.id))
                        }
                      >
                        <MoreVertical
                          className="size-[18px]"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </button>
                      {menuId === row.id ? (
                        <div className="absolute right-3 top-11 z-10 min-w-[140px] rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
                            onClick={() => openEdit(row)}
                          >
                            Editar
                          </button>
                          {isSuperadmin ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[13px] text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
                              onClick={() => void onDelete(row)}
                            >
                              Eliminar
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex h-[68px] shrink-0 items-center gap-3 border-t border-[var(--color-nachipa-border-subtle)] bg-white px-4">
            <p className="min-w-0 flex-1 text-[12px] font-medium text-[var(--color-nachipa-title)]">
              {loading
                ? "Cargando…"
                : `Total empresas: ${filtered.length}`}
            </p>
            <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
              Ítems por página
            </p>
            <span className="flex h-8 w-[72px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] text-[12px] text-[var(--color-nachipa-body)]">
              10
            </span>
            <span className="text-[12px] text-[var(--color-nachipa-secondary)]">
              1 / 1
            </span>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        icon={Building2}
        title={editing ? "Editar empresa" : "Nueva empresa"}
        subtitle={
          editing
            ? "Actualizá los datos de la empresa. El nombre es obligatorio."
            : "Solo el nombre es obligatorio. Lo demás lo completas después en Configuración."
        }
        onClose={closeModal}
        /* Crear = 520 Figma; editar = 720 + grilla 2 cols (menos alto, sin scroll feo). */
        maxWidthClass={
          editing
            ? "w-full max-w-[720px] sm:w-[720px]"
            : "w-full max-w-[520px] sm:w-[520px]"
        }
        footer={
          <div className="flex flex-col gap-3">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                form="empresa-form"
                onClick={closeModal}
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab,#f4f4f5)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                form="empresa-form"
                className="!w-auto"
                disabled={submitting}
              >
                {submitting
                  ? "Guardando…"
                  : editing
                    ? "Guardar cambios"
                    : "Crear empresa"}
              </Button>
            </div>
            <p className="text-center text-[12px] text-[var(--color-nachipa-secondary)]">
              {editing
                ? "Los cambios se aplican de inmediato en el portal."
                : "Después podrás agregar naves, usuarios y cursos desde Configuración."}
            </p>
          </div>
        }
      >
        <form
          id="empresa-form"
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex items-center gap-3 rounded-xl bg-[var(--color-table-head-bg,#f8f9fb)] px-3.5 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-nachipa-primary)] text-[16px] font-bold text-white">
              {initialOf(form.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-[var(--color-nachipa-title)]">
                {previewName}
              </span>
              <span className="block text-[12px] text-[var(--color-nachipa-secondary)]">
                Así se verá en el selector de empresas
              </span>
            </span>
          </div>

          <div
            className={
              editing
                ? "grid gap-4 sm:grid-cols-2"
                : "flex flex-col gap-4"
            }
          >
            <TextField
              label="Nombre de la empresa *"
              name="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              disabled={lockKeyFields}
              placeholder="Austral Wellboats"
            />
            <TextField
              label="RUT"
              name="rut"
              value={form.rut}
              onChange={(e) => setField("rut", e.target.value)}
              disabled={lockKeyFields}
              placeholder="Opcional · ej. 76.123.456-7"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[13px]">
              <span className="font-medium text-[var(--color-nachipa-title)]">
                Logo
              </span>{" "}
              <span className="text-[var(--color-nachipa-secondary)]">
                opcional
              </span>
            </p>
            <div className="flex items-center gap-3 rounded-[10px] border border-[var(--color-tremor-border)] px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-nachipa-primary)] text-[16px] font-bold text-white">
                {initialOf(form.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-[var(--color-nachipa-title)]">
                  Usando la primera letra
                </span>
                <span className="block text-[12px] text-[var(--color-nachipa-secondary)]">
                  SVG o PNG cuadrado, hasta 2 MB
                </span>
              </span>
              <button
                type="button"
                className="inline-flex h-[30px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-2.5 text-[12px] font-medium text-[var(--color-nachipa-body)]"
                onClick={() =>
                  showToast(
                    "La subida de logo llega en un próximo paso.",
                    "info",
                  )
                }
              >
                <Upload className="size-3.5" strokeWidth={1.5} aria-hidden />
                Subir
              </button>
            </div>
          </div>

          {editing ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Giro"
                  name="giro"
                  value={form.giro}
                  onChange={(e) => setField("giro", e.target.value)}
                  placeholder="Opcional"
                />
                <TextField
                  label="Ciudad"
                  name="city"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="Opcional"
                />
                <TextField
                  label="País"
                  name="country"
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                />
                <TextField
                  label="Teléfono"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <TextField
                label="Correo"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="contacto@empresa.com"
              />
              {isSuperadmin ? (
                <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-nachipa-title)]">
                      Empresa activa
                    </p>
                    <p className="text-[12px] text-[var(--color-nachipa-secondary)]">
                      Visible y operable en el portal
                    </p>
                  </div>
                  <Toggle
                    checked={form.state}
                    onChange={(next) => setField("state", next)}
                    aria-label="Empresa activa"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div>
              <TextField
                label="Administrador inicial"
                name="adminEmail"
                type="email"
                value={form.adminEmail}
                onChange={(e) => setField("adminEmail", e.target.value)}
                placeholder="Correo · opcional"
              />
              <p className="mt-1.5 text-[12px] leading-4 text-[var(--color-nachipa-secondary)]">
                Le enviamos una invitación para que configure su empresa
              </p>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
