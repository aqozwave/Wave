import { Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props del aviso de curso vencido. */
export type CourseExpiredProps = {
  crewName: string;
  courseName: string;
  expiresLabel: string;
};

/**
 * Correo al tripulante: curso OMI ya vencido.
 * Solo informativo; no pide respuesta.
 */
export function CourseExpired({
  crewName,
  courseName,
  expiresLabel,
}: CourseExpiredProps) {
  return (
    <EmailLayout title="Tu curso venció">
      <Text style={styles.paragraph}>
        Hola <strong>{crewName}</strong>,
      </Text>
      <Text style={styles.paragraph}>
        Te informamos que tu curso <strong>{courseName}</strong> venció el{" "}
        {expiresLabel}. Debés renovarlo para mantener la certificación al día.
      </Text>
      <Section style={styles.box}>
        <Text style={styles.boxLine}>
          <strong>Curso:</strong> {courseName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Venció:</strong> {expiresLabel}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Estado:</strong> Vencido
        </Text>
      </Section>
      <Text style={styles.muted}>
        Este correo es solo un aviso. Si ya actualizaste el curso, avisá al
        personal de Personas de {PRODUCT_NAME}.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  paragraph: {
    margin: "0 0 14px",
    color: "#334155",
    fontSize: "15px",
    lineHeight: "1.65",
  },
  box: {
    margin: "20px 0",
    padding: "14px 16px",
    backgroundColor: "#fef2f2",
    borderRadius: "12px",
    border: "1px solid #fecaca",
  },
  boxLine: {
    margin: "0 0 6px",
    color: "#0f172a",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  muted: {
    margin: "16px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "1.55",
  },
};
