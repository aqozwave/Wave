import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
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
import { OtpInput } from "../../components/OtpInput/OtpInput";
import { TextField } from "../../components/TextField/TextField";
import { useToast } from "../../components/Toast/ToastProvider";
import type { MfaChallenge } from "../../lib/api/auth";
import { resendMfaRequest } from "../../lib/api/auth";
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

/** Intentos máximos MFA (mismo default que api LOGIN_MFA_MAX_ATTEMPTS). */
const MFA_MAX_ATTEMPTS = 5;

/** Segundos de espera antes de poder reenviar (Figma A2 · 0:45). */
const MFA_RESEND_COOLDOWN_SECONDS = 45;

/** Formatea segundos restantes como M:SS (ej. 0:45). */
function formatCooldown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Pantalla de login (Figma A1 · 103:239) + MFA (Figma A2).
 * POST /auth/login con X-Client web; access en memoria, refresh en cookie.
 */
export function Login() {
  const {
    accessToken,
    user,
    bootstrapped,
    login,
    verifyMfa,
    clearPublicSession,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Si hay challenge, mostramos el paso MFA en lugar del form de clave. */
  const [mfa, setMfa] = useState<MfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  /** Intentos restantes mostrados bajo el OTP (bajan en cliente al fallar). */
  const [attemptsLeft, setAttemptsLeft] = useState(MFA_MAX_ATTEMPTS);
  /** Countdown para habilitar «Reenviar código». */
  const [resendIn, setResendIn] = useState(0);
  /** Evita redirigir en silencio si ya hay sesión (invitación / otra cuenta). */
  const [dismissedSessionBanner, setDismissedSessionBanner] = useState(false);

  /** Tick del cooldown de reenvío MFA. */
  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  /** Sesión restaurada desde cookie: pedir Continuar / Usar otra cuenta. */
  const existingSession =
    bootstrapped &&
    Boolean(accessToken) &&
    Boolean(user) &&
    !dismissedSessionBanner &&
    !mfa;

  async function onUseOtherAccount() {
    setSubmitting(true);
    try {
      await clearPublicSession();
      setDismissedSessionBanner(true);
      showToast("Sesión anterior cerrada. Podés iniciar con otra cuenta.", "info");
    } catch {
      showToast("No se pudo cerrar la sesión anterior.", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  /** Minutos de validez del código (desde expiresInSeconds del challenge). */
  const expiresMinutes = mfa
    ? Math.max(1, Math.round(mfa.expiresInSeconds / 60))
    : 10;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const challenge = await login(email.trim(), password);
      if (challenge) {
        setMfa(challenge);
        setMfaCode("");
        setAttemptsLeft(MFA_MAX_ATTEMPTS);
        setResendIn(MFA_RESEND_COOLDOWN_SECONDS);
        showToast(`Código enviado a ${challenge.emailMasked}`, "info");
        return;
      }
      showToast("Sesión iniciada correctamente.", "success");
      navigate("/", { replace: true });
    } catch (err) {
      // Feedback solo por Toast (Figma), no alert inline en el form.
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar sesión. Reintentá.";
      showToast(message, "danger");
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfa) {
      return;
    }
    setSubmitting(true);
    try {
      await verifyMfa(mfa.challengeId, mfaCode.trim());
      showToast("Sesión iniciada correctamente.", "success");
      navigate("/", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Código inválido. Reintentá.";
      showToast(message, "danger");
      // Baja el contador local al fallar (el API no expone remainingAttempts en error).
      if (err instanceof ApiError && err.code === "mfa_invalid_code") {
        setAttemptsLeft((n) => Math.max(0, n - 1));
        setMfaCode("");
      }
      // Sin intentos o challenge muerto → volver al login.
      if (
        err instanceof ApiError &&
        (err.code === "mfa_max_attempts" || err.code === "mfa_code_expired")
      ) {
        setMfa(null);
        setMfaCode("");
        setAttemptsLeft(MFA_MAX_ATTEMPTS);
        setResendIn(0);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onResendMfa() {
    if (!mfa || resendIn > 0) {
      return;
    }
    setSubmitting(true);
    try {
      const next = await resendMfaRequest(mfa.challengeId);
      setMfa({
        mfaRequired: true,
        challengeId: next.challengeId,
        expiresInSeconds: next.expiresInSeconds,
        emailMasked: next.emailMasked,
      });
      setMfaCode("");
      setAttemptsLeft(MFA_MAX_ATTEMPTS);
      setResendIn(MFA_RESEND_COOLDOWN_SECONDS);
      showToast(next.message, "info");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo reenviar el código.";
      showToast(message, "danger");
      if (err instanceof ApiError && err.code === "mfa_code_expired") {
        setMfa(null);
        setMfaCode("");
        setResendIn(0);
      }
    } finally {
      setSubmitting(false);
    }
  }

  /** Vuelve al form de email/clave y limpia el challenge en UI. */
  function onUseAnotherAccount() {
    setMfa(null);
    setMfaCode("");
    setAttemptsLeft(MFA_MAX_ATTEMPTS);
    setResendIn(0);
  }

  return (
    <div className="animate-fade flex min-h-full bg-white">
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
        {existingSession && user ? (
          <div className="flex w-full max-w-[400px] flex-col items-center gap-4">
            <Logo size="auth" />
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h2 className="text-2xl font-semibold leading-[30px] text-[var(--color-nachipa-title)]">
                Sesión activa
              </h2>
              <p className="text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
                Ya hay una sesión como{" "}
                <span className="font-semibold text-[var(--color-nachipa-title)]">
                  {user.firstName} {user.lastName}
                </span>{" "}
                ({user.email}).
              </p>
            </div>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => navigate("/", { replace: true })}
            >
              Continuar
            </Button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void onUseOtherAccount()}
              className="text-[13px] font-semibold text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-50"
            >
              Usar otra cuenta
            </button>
          </div>
        ) : mfa ? (
          <form
            onSubmit={onVerifyMfa}
            className="flex w-full max-w-[400px] flex-col items-center gap-4"
            noValidate
          >
            <Logo size="auth" />
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h2 className="text-2xl font-semibold leading-[30px] text-[var(--color-nachipa-title)]">
                Verifica tu identidad
              </h2>
              <p className="text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
                Enviamos un código de 6 dígitos a {mfa.emailMasked}
              </p>
            </div>

            <div className="flex w-full flex-col items-center gap-3">
              <OtpInput
                value={mfaCode}
                onChange={setMfaCode}
                disabled={submitting}
                autoFocus
              />
              <p className="text-center text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
                El código expira en {expiresMinutes} minutos · Intentos
                restantes: {attemptsLeft}
              </p>

              <Button
                type="submit"
                disabled={submitting || mfaCode.length !== 6}
              >
                {submitting ? "Verificando…" : "Verificar y entrar"}
              </Button>

              <p className="text-center text-[13px] leading-[19px]">
                <span className="text-[var(--color-nachipa-secondary)]">
                  ¿No te llegó?{" "}
                </span>
                {resendIn > 0 ? (
                  <span className="font-semibold text-[var(--color-nachipa-primary)]">
                    Reenviar código en {formatCooldown(resendIn)}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="font-semibold text-[var(--color-nachipa-primary)] hover:underline disabled:opacity-50"
                    disabled={submitting}
                    onClick={() => void onResendMfa()}
                  >
                    Reenviar código
                  </button>
                )}
              </p>

              <button
                type="button"
                className="text-[13px] text-[var(--color-nachipa-secondary)] hover:underline"
                onClick={onUseAnotherAccount}
              >
                ← Usar otra cuenta
              </button>
            </div>

            <p className="text-[12px] leading-4 text-[var(--color-nachipa-muted)]">
              © 2026 Nachipa Wellboats · v2.0.0
            </p>
          </form>
        ) : (
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

              <Button
                type="submit"
                disabled={submitting || !email || !password}
              >
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
        )}
      </main>
    </div>
  );
}
