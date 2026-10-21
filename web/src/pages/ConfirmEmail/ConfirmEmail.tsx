import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AuthFormLayout } from "../../components/AuthFormLayout/AuthFormLayout";
import { ApiError, confirmEmailRequest } from "../../lib/api/auth";

/** Estados de la confirmación automática al abrir el enlace. */
type Status = "loading" | "ok" | "error";

/**
 * Confirma la cuenta con ?token= del correo (POST /auth/confirm-email).
 * Se ejecuta al montar; no pide datos al usuario.
 */
export function ConfirmEmail() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";

  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [message, setMessage] = useState(
    token ? "Confirmando tu cuenta…" : "Falta el token en el enlace.",
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await confirmEmailRequest(token);
        if (!cancelled) {
          setStatus("ok");
          setMessage(result.message);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            err instanceof ApiError
              ? err.message
              : "No se pudo confirmar la cuenta.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const boxClass =
    status === "ok"
      ? "border-[var(--color-status-success-fg)]/20 bg-[var(--color-status-success-bg)] text-[var(--color-status-success-fg)]"
      : status === "error"
        ? "border-[var(--color-status-danger-fg)]/20 bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-fg)]"
        : "border-[var(--color-tremor-border)] bg-white text-[var(--color-nachipa-secondary)]";

  return (
    <AuthFormLayout
      title="Confirmación de correo"
      subtitle="Activación de tu cuenta en Portal Nachipa Wellboats"
    >
      <p
        role="status"
        className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-center text-[13px] ${boxClass}`}
      >
        {message}
      </p>
      {status === "ok" ? (
        <Link
          to="/login"
          className="text-[13px] font-semibold text-[var(--color-nachipa-primary)] hover:underline"
        >
          Ir a iniciar sesión
        </Link>
      ) : null}
      {status === "error" && token ? (
        <Link
          to="/resend-confirmation"
          className="text-[13px] font-semibold text-[var(--color-nachipa-primary)] hover:underline"
        >
          Reenviar correo de confirmación
        </Link>
      ) : null}
    </AuthFormLayout>
  );
}
