import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Section,
  Text,
} from "@react-email/components";

/** Nombre visible del producto en correos (UI, no el nombre de código Wave). */
const PRODUCT_NAME = "Portal Nachipa Wellboats";

/** Acento navy Nachipa (Figma / design system). */
const ACCENT = "#004c8c";

/** Props de la plantilla de confirmación de cuenta. */
export type ConfirmEmailProps = {
  firstName: string;
  confirmUrl: string;
  /** Texto legible de caducidad (ej. "24 horas"). */
  expiresLabel: string;
};

/**
 * Correo de confirmación de cuenta (React Email).
 * El enlace lleva al front; la API confirma con POST /auth/confirm-email.
 */
export function ConfirmEmail({
  firstName,
  confirmUrl,
  expiresLabel,
}: ConfirmEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brand}>{PRODUCT_NAME}</Text>
            <Heading style={styles.title}>Confirmá tu cuenta</Heading>
          </Section>
          <Section style={styles.content}>
            <Text style={styles.paragraph}>
              Hola <strong>{firstName}</strong>,
            </Text>
            <Text style={styles.paragraph}>
              Crearon una cuenta para vos en {PRODUCT_NAME}. Para activarla,
              hacé clic en el botón. El enlace vence en {expiresLabel}.
            </Text>
            <Section style={styles.buttonWrap}>
              <Button href={confirmUrl} style={styles.button}>
                Confirmar correo
              </Button>
            </Section>
            <Text style={styles.muted}>
              Si el botón no funciona, copiá y pegá este enlace en el
              navegador:
            </Text>
            <Text style={styles.link}>{confirmUrl}</Text>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Correo automático de {PRODUCT_NAME}. No respondas a este mensaje.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Estilos inline (clientes de correo no usan CSS externo). */
const styles = {
  body: {
    margin: "0",
    padding: "24px 12px",
    backgroundColor: "#f5f5f5",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: "16px",
    overflow: "hidden" as const,
  },
  header: {
    padding: "22px 28px",
    backgroundColor: ACCENT,
  },
  brand: {
    margin: "0 0 6px",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    opacity: 0.88,
  },
  title: {
    margin: "0",
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: "1.25",
  },
  content: {
    padding: "28px 28px 8px",
  },
  paragraph: {
    margin: "0 0 14px",
    color: "#404040",
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
  footer: {
    padding: "8px 28px 24px",
    borderTop: "1px solid #e5e5e5",
  },
  footerText: {
    margin: "18px 0 0",
    color: "#a3a3a3",
    fontSize: "12px",
    lineHeight: "1.5",
    textAlign: "center" as const,
  },
};
