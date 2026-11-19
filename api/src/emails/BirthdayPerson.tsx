import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Section,
  Text,
} from "@react-email/components";
import { ACCENT, LOGO_CONTENT_ID, PRODUCT_NAME } from "./emailBrand.js";

/** Props de la felicitación al cumpleañero. */
export type BirthdayPersonProps = {
  /** Nombre completo para personalizar el saludo. */
  personName: string;
};

/**
 * Felicitación minimalista: logo Nachipa + nombre + mensaje corto.
 * El “¡Feliz cumpleaños!” va solo en el asunto (no se repite).
 */
export function BirthdayPerson({ personName }: BirthdayPersonProps) {
  const displayName = personName.trim() || "equipo Nachipa";

  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src={`cid:${LOGO_CONTENT_ID}`}
              width={48}
              height={48}
              alt="Nachipa"
              style={styles.logo}
            />
            <Text style={styles.brand}>NACHIPA WELLBOATS</Text>
          </Section>

          <Section style={styles.content}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.message}>
              Hoy celebramos tu día. Gracias por ser parte del equipo. Te
              deseamos un excelente cumpleaños.
            </Text>
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

const styles = {
  body: {
    margin: "0",
    padding: "32px 16px",
    backgroundColor: "#f5f5f5",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden" as const,
  },
  header: {
    padding: "28px 28px 8px",
    textAlign: "center" as const,
  },
  logo: {
    display: "block",
    margin: "0 auto 12px",
    border: "0",
  },
  brand: {
    margin: "0",
    color: ACCENT,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
  },
  content: {
    padding: "20px 28px 8px",
    textAlign: "center" as const,
  },
  name: {
    margin: "0 0 14px",
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: 600,
    lineHeight: "1.35",
  },
  message: {
    margin: "0",
    color: "#475569",
    fontSize: "15px",
    lineHeight: "1.65",
  },
  footer: {
    padding: "24px 28px 28px",
  },
  footerText: {
    margin: "0",
    color: "#a3a3a3",
    fontSize: "12px",
    lineHeight: "1.5",
    textAlign: "center" as const,
  },
};
