import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import {
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Star,
} from "lucide-react";
import heroUrl from "../../assets/brand/login-hero.jpg";
import { Button } from "../../components/Button/Button";
import { Logo } from "../../components/Logo/Logo";
import { TextField } from "../../components/TextField/TextField";
import { ApiError, useAuth } from "../../lib/auth/AuthContext";

/**
 * Cards del hero izquierdo (Figma A1 · Iniciar sesión).
 * Copy e íconos Lucide alineados al diseño.
 */
const features = [
  {
    icon: Star,
    title: "Modulo de gestión de cursos y sus vigencias",
    body: "La gestión de cursos OMI asegura que la tripulación marítima cumpla con los estándares internacionales de formación, seguridad y competencia, mediante capacitaciones estructuradas y certificaciones reconocidas.",
  },
  {
    icon: ShieldCheck,
    title: "Modulo de gestión de Prevención de riesgos",
    body: "La prevención de riesgos permite administrar EPP, equipos de seguridad y certificaciones para garantizar entornos de trabajo seguros y cumplir con las normativas vigentes.",
  },
  {
    icon: Clock,
    title: "Acceso a plataforma 24/7",
    body: "Disponibilidad completa todo el tiempo",
  },
] as const;

/**
 * Pantalla de login (Figma A1 · 103:239).
 * POST /auth/login con X-Client web; access en memoria, refresh en cookie.
 */
export function Login() {
  const { accessToken, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo iniciar sesión. Reintentá.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full bg-white">
      {/* 50% como Figma A1 (antes w-[720px] dejaba la foto pegada a la izquierda). */}
      <aside className="relative hidden w-1/2 shrink-0 overflow-hidden lg:block">
        <img
          src={heroUrl}
          alt=""
          // Enfoca jaulas/wellboats (centro-derecha), no la orilla de la izq. de la foto.
          className="absolute inset-0 size-full object-cover object-[62%_42%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(31,120,242,0.72)] to-[rgba(1,102,217,0.76)]" />
        <div className="relative flex flex-col items-center gap-4 px-10 pt-[96px] xl:px-14">
          <p className="text-[11px] font-semibold uppercase tracking-[3.3px] text-white">
            Nachipa Wellboats
          </p>
          <h1 className="text-center text-[28px] font-semibold leading-9 tracking-[-0.14px] text-white">
            Gestiona tu plataforma
            <br />
            de forma eficiente
          </h1>
          <p className="max-w-[560px] text-center text-[15px] leading-[22px] text-white">
            Accede a todas las herramientas que necesitas para optimizar tus
            procesos y gestión de aplicaciones
          </p>
          <div className="h-7" />
          <div className="flex w-full flex-col gap-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex gap-5 rounded-2xl border border-white/22 bg-white/12 px-8 py-7 backdrop-blur-[8px]"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-white/22">
                  <Icon
                    className="size-[22px] text-white"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 flex-1 text-white">
                  <p className="text-[17px] font-semibold leading-6">{title}</p>
                  <p className="mt-2 text-[14px] leading-[22px] opacity-90">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[var(--color-tremor-background)] px-6 py-10">
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-[400px] flex-col items-center gap-4"
          noValidate
        >
          <Logo size="auth" />

          <div className="flex flex-col items-center gap-1.5 text-center">
            <h2 className="text-2xl font-semibold leading-[30px] text-[var(--color-nachipa-title)]">
              Iniciar sesión
            </h2>
            <p className="text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
              Ingresa con tu cuenta corporativa
            </p>
          </div>

          <div className="flex w-full flex-col gap-4">
            <TextField
              label="Correo electrónico"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="nombre@nachipa-w.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leadingIcon={<Mail strokeWidth={1.5} aria-hidden />}
            />

            <TextField
              label="Contraseña"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leadingIcon={<Lock strokeWidth={1.5} aria-hidden />}
              trailing={
                <button
                  type="button"
                  className="text-[var(--color-icon-default)]"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <Eye strokeWidth={1.5} aria-hidden />
                  ) : (
                    <EyeOff strokeWidth={1.5} aria-hidden />
                  )}
                </button>
              }
            />

            <div className="flex w-full justify-end">
              <Link
                to="/forgot-password"
                className="text-[13px] font-semibold leading-[19px] text-[var(--color-nachipa-primary)] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {error ? (
              <p
                role="alert"
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-status-danger-fg)]/20 bg-[var(--color-status-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-status-danger-fg)]"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting || !email || !password}>
              {submitting ? "Ingresando…" : "Iniciar sesión"}
            </Button>

            <p className="flex justify-center gap-1 text-[13px] leading-[19px]">
              <span className="text-[var(--color-nachipa-secondary)]">
                ¿No confirmaste tu cuenta?
              </span>
              <Link
                to="/resend-confirmation"
                className="font-semibold text-[var(--color-nachipa-primary)] hover:underline"
              >
                Reenviar correo
              </Link>
            </p>
          </div>

          <p className="text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
            © 2026 Nachipa Wellboats · v2.0.0
          </p>
        </form>
      </main>
    </div>
  );
}
