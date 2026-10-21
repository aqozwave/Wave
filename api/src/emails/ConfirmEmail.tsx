import { Button, Section, Text } from "@react-email/components";
import { ACCENT, PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props de la plantilla de confirmación de cuenta. */
export type ConfirmEmailProps = {
  firstName: string;
  confirmUrl: string;
  /** Texto legible de caducidad (ej. "24 horas"). */
  expiresLabel: string;
};

/**
 * Correo de confirmación de cuenta (shell Figma + CTA).
 * El enlace lleva al front; la API confirma con POST /auth/confirm-email.
 */
export function ConfirmEmail({
  firstName,
  confirmUrl,
  expiresLabel,
}: ConfirmEmailProps) {
  return (
    <EmailLayout title="Confirmá tu cuenta">
      <Text style={styles.paragraph}>
        Hola <strong>{firstName}</strong>,
      </Text>
      <Text style={styles.paragraph}>
        Crearon una cuenta para vos en {PRODUCT_NAME}. Para activarla, hacé
        clic en el botón. El enlace vence en {expiresLabel}.
      </Text>
      <Section style={styles.buttonWrap}>
        <Button href={confirmUrl} style={styles.button}>
          Confirmar correo
        </Button>
      </Section>
      <Text style={styles.muted}>
        Si no esperabas este correo, podés ignorarlo.
      </Text>
      <Text style={styles.muted}>
        Si el botón no funciona, copiá y pegá este enlace:
      </Text>
      <Text style={styles.link}>{confirmUrl}</Text>
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
