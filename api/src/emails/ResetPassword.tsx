import { Button, Section, Text } from "@react-email/components";
import { ACCENT, PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props de la plantilla de restablecimiento de contraseña. */
export type ResetPasswordProps = {
  firstName: string;
  resetUrl: string;
  /** Texto legible de caducidad (ej. "1 hora"). */
  expiresLabel: string;
};

/**
 * Correo de reset de contraseña (shell Figma + CTA).
 * El enlace lleva al front; la API aplica el cambio con POST /auth/reset-password.
 */
export function ResetPassword({
  firstName,
  resetUrl,
  expiresLabel,
}: ResetPasswordProps) {
  return (
    <EmailLayout title="Restablecé tu contraseña">
      <Text style={styles.paragraph}>
        Hola <strong>{firstName}</strong>,
      </Text>
      <Text style={styles.paragraph}>
        Recibimos un pedido para cambiar la contraseña de tu cuenta en{" "}
        {PRODUCT_NAME}. Si fuiste vos, usá el botón. El enlace vence en{" "}
        {expiresLabel}.
      </Text>
      <Section style={styles.buttonWrap}>
        <Button href={resetUrl} style={styles.button}>
          Elegir nueva contraseña
        </Button>
      </Section>
      <Text style={styles.muted}>
        Si no pediste este cambio, ignorá este correo. Tu contraseña actual
        sigue vigente.
      </Text>
      <Text style={styles.muted}>
        Si el botón no funciona, copiá y pegá este enlace:
      </Text>
      <Text style={styles.link}>{resetUrl}</Text>
    </EmailLayout>
  );
}

/** Estilos del cuerpo (el shell vive en EmailLayout). */
const styles = {
  paragraph: {
    margin: "0 0 14px",
    color: "#334155",
    fontSize: "15px",
    lineHeight: "1.65",
  },
  buttonWrap: {
    margin: "24px 0",
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: ACCENT,
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
    padding: "12px 22px",
    borderRadius: "10px",
  },
  muted: {
    margin: "0 0 8px",
    color: "#737373",
    fontSize: "13px",
    lineHeight: "1.5",
  },
  link: {
    margin: "0 0 16px",
    color: ACCENT,
    fontSize: "12px",
    lineHeight: "1.5",
    wordBreak: "break-all" as const,
  },
};
