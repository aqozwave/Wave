import { Section, Text } from "@react-email/components";
import { ACCENT } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props del correo MFA de login (código 6 dígitos). */
export type LoginMfaProps = {
  firstName: string;
  code: string;
  /** Texto de caducidad (ej. "10 minutos"). */
  expiresLabel: string;
};

/**
 * Verificación de acceso (Figma correos · MFA).
 * Código grande en caja azul clara.
 */
export function LoginMfa({ firstName, code, expiresLabel }: LoginMfaProps) {
  // Espaciado visual tipo "380 196".
  const displayCode = `${code.slice(0, 3)} ${code.slice(3)}`;

  return (
    <EmailLayout title="Verificación de acceso">
      <Text style={styles.paragraph}>
        Hola <strong>{firstName}</strong>, usá este código para completar tu
        inicio de sesión en Portal Nachipa Wellboats.
      </Text>
      <Section style={styles.codeBox}>
        <Text style={styles.code}>{displayCode}</Text>
      </Section>
      <Text style={styles.expires}>El código expira en {expiresLabel}.</Text>
      <Text style={styles.muted}>
        Si no pediste este acceso, ignorá este correo.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  paragraph: {
    margin: "0 0 20px",
    color: "#334155",
    fontSize: "15px",
    lineHeight: "1.65",
  },
  codeBox: {
    margin: "0 0 16px",
    padding: "20px 16px",
    backgroundColor: "#e8f1fc",
    borderRadius: "12px",
    textAlign: "center" as const,
  },
  code: {
    margin: "0",
    color: ACCENT,
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: "4px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  expires: {
    margin: "0 0 16px",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "1.5",
    textAlign: "center" as const,
  },
  muted: {
    margin: "0 0 8px",
    color: "#737373",
    fontSize: "13px",
    lineHeight: "1.5",
  },
};
