import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Lock } from "lucide-react";
import { AuthFormLayout } from "../../components/AuthFormLayout/AuthFormLayout";
import { Button } from "../../components/Button/Button";
import { TextField } from "../../components/TextField/TextField";
import { useToast } from "../../components/Toast/ToastProvider";
import { ApiError, resetPasswordRequest } from "../../lib/api/auth";

/**
 * Aplica nueva contraseña con ?token= del correo (POST /auth/reset-password).
 * Errores y éxito por Toast.
 */
export function ResetPassword() {
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      showToast("La contraseña debe tener al menos 8 caracteres.", "danger");
      return;
    }
    if (password !== confirm) {
      showToast("Las contraseñas no coinciden.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordRequest(token, password);
      setDone(true);
      showToast("Contraseña actualizada.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar la contraseña.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthFormLayout
        title="Enlace inválido"
        subtitle="Falta el token en la URL. Pedí un nuevo enlace."
      >
        <Link
          to="/forgot-password"
          className="text-[13px] font-semibold text-[var(--color-nachipa-primary)] hover:underline"
        >
          Solicitar nuevo enlace
        </Link>
      </AuthFormLayout>
    );
  }

  return (
    <AuthFormLayout
      title="Nueva contraseña"
      subtitle="Elegí una contraseña de al menos 8 caracteres"
    >
      {done ? (
        <p className="w-full text-center text-[13px] leading-[19px] text-[var(--color-nachipa-secondary)]">
          Contraseña actualizada. Ya podés{" "}
          <Link
            to="/login"
            className="font-semibold text-[var(--color-nachipa-primary)] hover:underline"
          >
            iniciar sesión
          </Link>
          .
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex w-full flex-col gap-4"
          noValidate
        >
          <TextField
            label="Nueva contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            leadingIcon={<Lock strokeWidth={1.5} aria-hidden />}
          />
          <TextField
            label="Confirmar contraseña"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            leadingIcon={<Lock strokeWidth={1.5} aria-hidden />}
          />
          <Button
            type="submit"
            disabled={submitting || !password || !confirm}
          >
            {submitting ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      )}
    </AuthFormLayout>
  );
}
