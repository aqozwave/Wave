import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import {
  ACCENT,
  BRAND_OVERLINE,
  LOGO_CONTENT_ID,
  PRODUCT_NAME,
} from "./emailBrand.js";

/** Props del shell común de correos (diseño Figma Nachipa). */
export type EmailLayoutProps = {
  /** Overline azul en mayúsculas (default: NACHIPA WELLBOATS). */
  overline?: string;
  /** Título principal bajo el header. */
  title: string;
  children: ReactNode;
};

/**
 * Layout de correo: logo + wordmark | avatar, overline, título, cuerpo, footer.
 * Sin franja navy a todo el ancho (referencia Figma de plantillas).
 */
export function EmailLayout({
  overline = BRAND_OVERLINE,
  title,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.topBar}>
            <Row>
              <Column style={styles.markCol}>
                <Img
                  src={`cid:${LOGO_CONTENT_ID}`}
                  width="36"
                  height="36"
                  alt="Nachipa"
                  style={styles.logoImg}
                />
              </Column>
              <Column style={styles.wordmarkCol}>
                <Text style={styles.wordmarkTitle}>NACHIPA</Text>
                <Text style={styles.wordmarkSub}>Wellboats</Text>
              </Column>
              <Column align="right" style={styles.avatarCol}>
                {/* Círculo avatar genérico (persona) del diseño. */}
                <Text style={styles.avatar}>👤</Text>
              </Column>
            </Row>
          </Section>

          <Section style={styles.content}>
            <Text style={styles.overline}>{overline}</Text>
            <Heading style={styles.title}>{title}</Heading>
            {children}
          </Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Este es un correo automático de {PRODUCT_NAME}. Por favor, no
              respondas a este mensaje.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Estilos inline (clientes de correo). */
const styles = {
  body: {
    margin: "0",
    padding: "24px 12px",
    backgroundColor: "#f5f5f5",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden" as const,
  },
  topBar: {
    padding: "20px 28px 12px",
    borderBottom: "1px solid #f0f0f0",
  },
  markCol: {
    verticalAlign: "middle" as const,
    width: "44px",
  },
  logoImg: {
    display: "block",
    border: "0",
  },
  wordmarkCol: {
    verticalAlign: "middle" as const,
  },
  wordmarkTitle: {
    margin: "0",
    color: ACCENT,
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "1.2px",
    lineHeight: "18px",
  },
  wordmarkSub: {
    margin: "0",
    color: ACCENT,
    fontSize: "10px",
    fontWeight: 400,
    lineHeight: "12px",
    paddingLeft: "1px",
  },
  avatarCol: {
    verticalAlign: "middle" as const,
    width: "48px",
  },
  avatar: {
    margin: "0",
    display: "inline-block",
    width: "36px",
    height: "36px",
    lineHeight: "36px",
    textAlign: "center" as const,
    borderRadius: "50%",
    backgroundColor: "#eef2f6",
    fontSize: "16px",
  },
  content: {
    padding: "24px 28px 8px",
  },
  overline: {
    margin: "0 0 8px",
    color: ACCENT,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 20px",
    color: "#0f172a",
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: "1.25",
  },
  footer: {
    padding: "8px 28px 24px",
  },
  footerText: {
    margin: "16px 0 0",
    color: "#a3a3a3",
    fontSize: "12px",
    lineHeight: "1.5",
    textAlign: "center" as const,
  },
};
