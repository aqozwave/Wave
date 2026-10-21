import {
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

/** Cantidad de dígitos del código MFA (Figma A2). */
const OTP_LENGTH = 6;

/** Props del input OTP de 6 cajas. */
type OtpInputProps = {
  /** Valor actual (solo dígitos, máx. 6). */
  value: string;
  /** Se llama con el string completo al tipar, pegar o borrar. */
  onChange: (next: string) => void;
  /** Deshabilita todas las cajas (submit en curso). */
  disabled?: boolean;
  /** id base para accesibilidad (cajas = `${id}-0` …). */
  id?: string;
  /** Autofocus en la primera caja vacía. */
  autoFocus?: boolean;
};

/**
 * Seis cajas para el código MFA (Figma A2 · Código de verificación).
 * Soporta tipeo, backspace, flechas y pegar un código de 6 dígitos.
 */
export function OtpInput({
  value,
  onChange,
  disabled = false,
  id = "otp",
  autoFocus = false,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>(
    Array.from({ length: OTP_LENGTH }, () => null),
  );

  /** Digitos normalizados a longitud fija (vacíos = ""). */
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  /** Actualiza un índice y enfoca la siguiente caja si hay dígito. */
  function setDigitAt(index: number, digit: string) {
    const next = digits.map((d, i) => (i === index ? digit : d));
    const joined = next.join("").replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(joined);
    if (digit && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  /** Backspace: borra el actual o salta a la anterior. */
  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        setDigitAt(index, "");
      } else if (index > 0) {
        setDigitAt(index - 1, "");
        refs.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  /** Pega hasta 6 dígitos y enfoca la última caja llena. */
  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) {
      return;
    }
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
    refs.current[Math.max(0, focusIndex)]?.focus();
  }

  return (
    <div
      role="group"
      aria-label="Código de verificación de 6 dígitos"
      className="flex w-full justify-center gap-2.5"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          id={`${id}-${index}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Dígito ${index + 1} de ${OTP_LENGTH}`}
          value={digit}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            // Si el browser pega varios en un solo onChange, tomamos el último.
            const char = raw.slice(-1);
            setDigitAt(index, char);
          }}
          onKeyDown={(e) => onKeyDown(index, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={[
            "size-11 shrink-0 rounded-[var(--radius-md)] border bg-white text-center text-[18px] font-semibold tabular-nums text-[var(--color-nachipa-title)] outline-none transition",
            "border-[var(--color-tremor-border)]",
            "focus:border-[var(--color-nachipa-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-nachipa-primary)_20%,transparent)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
