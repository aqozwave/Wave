import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { AuthFormLayout } from "../../components/AuthFormLayout/AuthFormLayout";
import { Button } from "../../components/Button/Button";
import { TextField } from "../../components/TextField/TextField";
import { ApiError, forgotPasswordRequest } from "../../lib/api/auth";

/**
 * Solicita enlace de reset (POST /auth/forgot-password).
 * Mensaje genérico aunque el email no exista.
 */
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await forgotPasswordRequest(email.trim());
      setDoneMessage(result.message);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo enviar el correo. Reintentá.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFormLayout
      title="¿Olvidaste tu contraseña?"
      subtitle="Te enviamos un enlace si el correo está registrado"
    >
      {doneMessage ? (
        <p
          role="status"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-status-success-fg)]/20 bg-[var(--color-status-success-bg)] px-3 py-2 text-center text-[13px] text-[var(--color-status-success-fg)]"
        >
          {doneMessage}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex w-full flex-col gap-4"
          noValidate
        >
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
          {error ? (
            <p
              role="alert"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-status-danger-fg)]/20 bg-[var(--color-status-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-status-danger-fg)]"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting || !email}>
            {submitting ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}
    </AuthFormLayout>
  );
}
