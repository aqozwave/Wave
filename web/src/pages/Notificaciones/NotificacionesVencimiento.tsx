import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Bell, Check, Inbox, Mail, Users } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../../components/Button/Button";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { Topbar } from "../../components/Topbar/Topbar";
import { useToast } from "../../components/Toast/ToastProvider";
import { UserMenu } from "../../components/UserMenu/UserMenu";
import {
  ALLOWED_EXPIRY_NOTICE_DAYS,
  COURSE_EXPIRED_MAX_REMINDER_OPTIONS,
  COURSE_EXPIRED_REPEAT_DAY_OPTIONS,
  DEFAULT_EXPIRY_NOTIFICATION_SETTINGS,
  getExpiryNotificationSettingsRequest,
  updateExpiryNotificationSettingsRequest,
  type ExpiryNotificationSettings,
} from "../../lib/api/notifications";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/** Campos de arrays de días en settings. */
type DaysField =
  | "courseCrewDays"
  | "courseAdminDays"
  | "boardingBookCrewDays"
  | "boardingBookAdminDays";

/** Chip seleccionable (hito o opción numérica). */
function OptionChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={[
        "inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-medium transition-colors",
        selected
          ? "bg-[var(--color-nachipa-primary)] text-white"
          : "bg-[var(--color-nachipa-bg-page)] text-[var(--color-nachipa-secondary)] hover:bg-[var(--color-tremor-border)]",
      ].join(" ")}
    >
      <Check
        className={["size-3", selected ? "opacity-100" : "opacity-0"].join(" ")}
        strokeWidth={2.5}
        aria-hidden
      />
      {label}
    </button>
  );
}

/** Bloque de canal (correo tripulante / resumen admin). */
function ChannelRow({
  icon,
  title,
  field,
  days,
  onToggleDay,
}: {
  icon: ReactNode;
  title: string;
  field: DaysField;
  days: number[];
  onToggleDay: (field: DaysField, day: number) => void;
}) {
  return (
    <div className="border-t border-[var(--color-tremor-border)] px-4 py-3 first:border-t-0">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="m-0 text-[13px] font-medium text-[var(--color-nachipa-title)]">
          {title}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALLOWED_EXPIRY_NOTICE_DAYS.map((day) => (
          <OptionChip
            key={`${field}-${day}`}
            label={`${day} días`}
            selected={days.includes(day)}
            onToggle={() => onToggleDay(field, day)}
          />
        ))}
      </div>
    </div>
  );
}

/** Tarjeta de sección de settings. */
function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-tremor-border)] bg-white">
      <div className="border-b border-[var(--color-tremor-border)] px-4 py-3">
        <h2 className="m-0 text-[14px] font-semibold text-[var(--color-nachipa-title)]">
          {title}
        </h2>
        <p className="m-0 mt-0.5 text-[12px] text-[var(--color-nachipa-secondary)]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

/**
 * Configuración de hitos de avisos de vencimiento.
 * Ruta: /notificaciones
 */
export function NotificacionesVencimiento() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ExpiryNotificationSettings>({
    ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS,
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await getExpiryNotificationSettingsRequest(accessToken);
      setSettings({ ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS, ...data });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar la configuración";
      showToast(message, "danger");
    } finally {
      setLoading(false);
    }
  }, [accessToken, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Alterna un hito en un canal. */
  function toggleDay(field: DaysField, day: number) {
    setSettings((prev) => {
      const current = prev[field] ?? [];
      const next = current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => b - a);
      return { ...prev, [field]: next };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || saving) return;
    setSaving(true);
    try {
      const saved = await updateExpiryNotificationSettingsRequest(
        accessToken,
        settings,
      );
      setSettings({ ...DEFAULT_EXPIRY_NOTIFICATION_SETTINGS, ...saved });
      showToast("Configuración guardada", "success");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar la configuración";
      showToast(message, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar
        breadcrumb="Notificaciones"
        breadcrumbIcon={Bell}
        actions={<UserMenu />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <PageHeader
          crumbs={[
            { label: "Configuración" },
            { label: "Notificaciones" },
          ]}
          title="Notificaciones de vencimiento"
          description="Definí en qué hitos se avisa al tripulante y cuándo entra en el resumen diario a administradores. Los envíos de prueba van a tu correo override."
          actions={
            <Link
              to="/notificaciones/outbox"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[13px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)]"
            >
              <Inbox className="size-3.5" strokeWidth={1.5} aria-hidden />
              Ver outbox
            </Link>
          }
        />

        {loading ? (
          <p className="text-[13px] text-[var(--color-nachipa-secondary)]">
            Cargando configuración…
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex max-w-[720px] flex-col gap-4"
          >
            <SettingsCard
              title="Cursos OMI"
              description="Vigencia de cursos asignados al tripulante (por vencer)."
            >
              <ChannelRow
                icon={
                  <Mail
                    className="size-3.5 text-[var(--color-nachipa-primary)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                }
                title="Correo al tripulante"
                field="courseCrewDays"
                days={settings.courseCrewDays}
                onToggleDay={toggleDay}
              />
              <ChannelRow
                icon={
                  <Users
                    className="size-3.5 text-[var(--color-nachipa-primary)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                }
                title="Resumen a administradores"
                field="courseAdminDays"
                days={settings.courseAdminDays}
                onToggleDay={toggleDay}
              />
            </SettingsCard>

            <SettingsCard
              title="Cursos vencidos"
              description="Recordatorios cuando el curso ya venció. El admin sigue viéndolos en el resumen sin tope."
            >
              <div className="border-t border-[var(--color-tremor-border)] px-4 py-3 first:border-t-0">
                <div className="mb-1 flex items-center gap-2">
                  <Mail
                    className="size-3.5 text-[var(--color-nachipa-primary)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <p className="m-0 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                    Cada cuántos días
                  </p>
                </div>
                <p className="m-0 mb-2 text-[11px] text-[var(--color-nachipa-secondary)]">
                  0 = desactivado (no se envían recordatorios al tripulante).
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {COURSE_EXPIRED_REPEAT_DAY_OPTIONS.map((value) => (
                    <OptionChip
                      key={`repeat-${value}`}
                      label={value === 0 ? "Off" : `${value} d`}
                      selected={settings.courseExpiredCrewRepeatDays === value}
                      onToggle={() =>
                        setSettings((prev) => ({
                          ...prev,
                          courseExpiredCrewRepeatDays: value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="border-t border-[var(--color-tremor-border)] px-4 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <Bell
                    className="size-3.5 text-[var(--color-nachipa-primary)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <p className="m-0 text-[13px] font-medium text-[var(--color-nachipa-title)]">
                    Máximo de recordatorios
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COURSE_EXPIRED_MAX_REMINDER_OPTIONS.map((value) => (
                    <OptionChip
                      key={`max-${value}`}
                      label={value === 1 ? "1 vez" : `${value} veces`}
                      selected={
                        settings.courseExpiredCrewMaxReminders === value
                      }
                      onToggle={() =>
                        setSettings((prev) => ({
                          ...prev,
                          courseExpiredCrewMaxReminders: value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Libreta de embarque"
              description="Hitos para el generador de libreta (run-boarding-book-expiry / job)."
            >
              <ChannelRow
                icon={
                  <Mail
                    className="size-3.5 text-[var(--color-nachipa-primary)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                }
                title="Correo al tripulante"
                field="boardingBookCrewDays"
                days={settings.boardingBookCrewDays}
                onToggleDay={toggleDay}
              />
              <ChannelRow
                icon={
                  <Users
                    className="size-3.5 text-[var(--color-nachipa-primary)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                }
                title="Resumen a administradores"
                field="boardingBookAdminDays"
                days={settings.boardingBookAdminDays}
                onToggleDay={toggleDay}
              />
            </SettingsCard>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => void load()}
                className="inline-flex h-[30px] items-center rounded-[var(--radius-md)] border border-[var(--color-tremor-border)] bg-white px-3 text-[12px] font-medium text-[var(--color-nachipa-title)] hover:bg-[var(--color-nachipa-bg-page)] disabled:opacity-60"
              >
                Descartar
              </button>
              <Button type="submit" size="small" className="!w-auto" disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
