import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  ChevronDown,
  Lock,
  LogOut,
  Star,
  Upload,
  User,
} from "lucide-react";
import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";
import { TextField } from "../TextField/TextField";
import { useToast } from "../Toast/ToastProvider";
import {
  ApiError,
  deleteMyPhotoRequest,
  updateMeRequest,
  uploadMyPhotoRequest,
} from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";

/** MIME de foto (misma lista que la API). */
const PHOTO_MIME_OK = new Set(["image/jpeg", "image/png", "image/webp"]);
/** 2 MB: tope de la API. */
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Iniciales a partir de nombre y apellido (máx. 2 letras). */
function initialsOf(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/** Etiqueta corta del rol para el chip del menú. */
function roleChipLabel(internalRol: string): string {
  if (internalRol === "superadmin") return "Superadmin";
  if (internalRol === "admin") return "Administrador";
  return internalRol.charAt(0).toUpperCase() + internalRol.slice(1);
}

/**
 * Menú de usuario del header (Figma D39).
 * Avatar + chevron; Mi perfil (foto y datos); Cerrar sesión.
 */
export function UserMenu() {
  const { user, accessToken, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPending, setPhotoPending] = useState<{
    fileName: string;
    mimeType: string;
    contentBase64: string;
  } | null>(null);
  const [photoRemove, setPhotoRemove] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initials = user
    ? initialsOf(user.firstName, user.lastName)
    : "?";

  /** Abre Mi perfil con los datos actuales. */
  function openProfile() {
    if (!user) return;
    setOpen(false);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setPhotoPreview(null);
    setPhotoPending(null);
    setPhotoRemove(false);
    setProfileOpen(true);
  }

  function closeProfile() {
    setProfileOpen(false);
    setPhotoPreview(null);
    setPhotoPending(null);
    setPhotoRemove(false);
  }

  /** Lee el archivo elegido para la foto. */
  function onPhotoFileChange(file: File | null) {
    if (!file) return;
    if (!PHOTO_MIME_OK.has(file.type)) {
      showToast("La foto debe ser JPEG, PNG o WebP.", "danger");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      showToast("La foto no puede superar 2 MB.", "danger");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      const contentBase64 = comma >= 0 ? result.slice(comma + 1) : result;
      setPhotoPreview(result);
      setPhotoPending({
        fileName: file.name,
        mimeType: file.type,
        contentBase64,
      });
      setPhotoRemove(false);
    };
    reader.readAsDataURL(file);
  }

  function clearPhotoSelection() {
    setPhotoPreview(null);
    setPhotoPending(null);
    setPhotoRemove(true);
  }

  async function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !user) return;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      showToast("Nombre, apellido y correo son requeridos.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      await updateMeRequest(accessToken, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      });
      if (photoPending) {
        await uploadMyPhotoRequest(accessToken, photoPending);
      } else if (photoRemove && user.photoProfile) {
        await deleteMyPhotoRequest(accessToken);
      }
      await refreshProfile();
      showToast("Perfil actualizado.", "success");
      closeProfile();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "No se pudo guardar el perfil.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** Cierra sesión local (+ API si responde) y vuelve al login. */
  async function onLogout() {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  /** Foto visible en el menú / modal (preview, actual o null). */
  const displayPhoto =
    photoPreview ??
    (!photoRemove && user?.photoProfile ? user.photoProfile : null);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-1.5 hover:bg-[var(--color-nav-item-active-bg)]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú de usuario"
        onClick={() => setOpen((v) => !v)}
      >
        {user?.photoProfile ? (
          <img
            src={user.photoProfile}
            alt=""
            className="size-8 rounded-2xl border-2 border-white object-cover"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-2xl border-2 border-white bg-[var(--color-kpi-indigo-soft)] text-[12px] font-semibold text-[var(--color-kpi-indigo)]">
            {initials}
          </span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className="text-[var(--color-nav-icon)]"
          aria-hidden
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full z-30 mt-2 w-[280px] overflow-hidden rounded-xl border border-[var(--color-tremor-border)] bg-white p-1.5 shadow-[0px_10px_28px_0px_rgba(0,0,0,0.14)]"
            role="menu"
          >
            {user ? (
              <>
                <div className="flex items-center gap-2.5 p-2.5">
                  {user.photoProfile ? (
                    <img
                      src={user.photoProfile}
                      alt=""
                      className="size-10 shrink-0 rounded-[20px] object-cover"
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[20px] bg-[var(--color-kpi-indigo-soft)] text-[14px] font-semibold text-[var(--color-kpi-indigo)]">
                      {initials}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold capitalize text-[var(--color-nachipa-title)]">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--color-nachipa-secondary)]">
                      {user.email}
                    </span>
                  </span>
                </div>
                <div className="pb-2 pl-[60px]">
                  <span className="inline-flex rounded-full bg-[var(--color-status-info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-status-info-fg)]">
                    {roleChipLabel(user.internalRol)}
                  </span>
                </div>
                <div className="h-px bg-[var(--color-tremor-border)]" />
              </>
            ) : null}

            <MenuRow
              icon={User}
              label="Mi perfil"
              hint="Foto y datos"
              onClick={openProfile}
            />
            <MenuRow
              icon={Lock}
              label="Seguridad"
              hint="Contraseña"
              disabled
              title="Próximamente"
            />
            <MenuRow
              icon={Star}
              label="Apariencia"
              hint="Claro"
              disabled
              title="Próximamente"
            />
            <MenuRow
              icon={BookOpen}
              label="Manual de usuario"
              disabled
              title="Próximamente"
            />

            <div className="h-px bg-[var(--color-tremor-border)]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
            >
              <LogOut size={16} strokeWidth={1.5} aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </>
      ) : null}

      <Modal
        open={profileOpen}
        icon={User}
        title="Mi perfil"
        subtitle="Actualizá tu foto, nombre y correo."
        onClose={closeProfile}
        maxWidthClass="w-full max-w-[520px] sm:w-[520px]"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="h-9 rounded-[var(--radius-md)] bg-[var(--color-nachipa-tab)] px-3.5 text-[13px] font-medium text-[var(--color-nachipa-body)] hover:brightness-95 disabled:opacity-60"
              onClick={closeProfile}
              disabled={submitting}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              form="mi-perfil-form"
              className="!w-auto !font-medium"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        <form
          id="mi-perfil-form"
          className="flex flex-col gap-4"
          onSubmit={onSaveProfile}
        >
          <div className="flex items-center gap-3 rounded-xl bg-[var(--color-table-head-bg)] px-3.5 py-3">
            {displayPhoto ? (
              <img
                src={displayPhoto}
                alt=""
                className="size-12 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-kpi-indigo-soft)] text-[13px] font-semibold text-[var(--color-kpi-indigo)]">
                {initialsOf(firstName || "?", lastName || "")}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-[var(--color-nachipa-title)]">
                Foto de perfil
              </span>
              <span className="block text-[12px] text-[var(--color-nachipa-secondary)]">
                JPEG, PNG o WebP · hasta 2 MB
              </span>
              <span className="mt-2 flex flex-wrap gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[12px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]">
                  <Upload className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {displayPhoto ? "Cambiar" : "Subir foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) =>
                      onPhotoFileChange(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
                {displayPhoto ? (
                  <button
                    type="button"
                    className="h-8 rounded-[var(--radius-md)] px-3 text-[12px] font-medium text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
                    onClick={clearPhotoSelection}
                  >
                    Quitar
                  </button>
                ) : null}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Nombre"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
            <TextField
              label="Apellido"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </div>
          <TextField
            label="Correo"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  );
}

/** Fila del menú D39: ícono + etiqueta + pista a la derecha. */
function MenuRow({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled = false,
  title,
}: {
  icon: typeof User;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "hover:bg-[var(--color-nachipa-bg-page)]",
      ].join(" ")}
    >
      <Icon
        size={16}
        strokeWidth={1.5}
        className="shrink-0 text-[var(--color-icon-default)]"
        aria-hidden
      />
      <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--color-nachipa-title)]">
        {label}
      </span>
      {hint ? (
        <span className="shrink-0 text-[12px] text-[var(--color-nachipa-secondary)]">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
