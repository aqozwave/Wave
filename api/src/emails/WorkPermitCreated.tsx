import { Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props del mail al contratista cuando Prevención crea el PT. */
export type WorkPermitCreatedProps = {
  code: string;
  organizationName: string;
  locationName: string;
  permitTypeName: string;
  scheduledDateLabel: string;
  workNoticeCode: string | null;
  description: string | null;
};

/**
 * Correo al portal contratista: Prevención abrió un permiso de trabajo.
 * Indica completar personal/checklist en el portal.
 */
export function WorkPermitCreated({
  code,
  organizationName,
  locationName,
  permitTypeName,
  scheduledDateLabel,
  workNoticeCode,
  description,
}: WorkPermitCreatedProps) {
  return (
    <EmailLayout title="Nuevo permiso de trabajo">
      <Text style={styles.paragraph}>
        Prevención creó un permiso de trabajo para{" "}
        <strong>{organizationName}</strong> en {PRODUCT_NAME}.
      </Text>
      <Text style={styles.paragraph}>
        Entrá al portal contratista para completar personal, checklist y
        documentación antes de enviarlo a aprobación.
      </Text>
      <Section style={styles.box}>
        <Text style={styles.boxLine}>
          <strong>Permiso:</strong> {code}
        </Text>
        {workNoticeCode ? (
          <Text style={styles.boxLine}>
            <strong>Aviso:</strong> {workNoticeCode}
          </Text>
        ) : null}
        <Text style={styles.boxLine}>
          <strong>Nave / lugar:</strong> {locationName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Tipo:</strong> {permitTypeName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Fecha programada:</strong> {scheduledDateLabel}
        </Text>
        {description ? (
          <Text style={styles.boxLine}>
            <strong>Descripción:</strong> {description}
          </Text>
        ) : null}
      </Section>
      <Text style={styles.muted}>
        Si no esperabas este aviso, contactá a Prevención de tu mandante.
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
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  boxLine: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  muted: {
    margin: "16px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "1.5",
  },
};
