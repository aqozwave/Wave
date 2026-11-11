import { Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "./emailBrand.js";
import { EmailLayout } from "./EmailLayout.js";

/** Props del aviso de nuevo WorkNotice a Prevención. */
export type WorkNoticeCreatedProps = {
  code: string;
  organizationName: string;
  locationName: string;
  permitTypeName: string;
  tentativeDateLabel: string;
  requestingAreaName: string;
  description: string | null;
};

/**
 * Correo a Prevención/admin: llegó un nuevo aviso de trabajo.
 */
export function WorkNoticeCreated({
  code,
  organizationName,
  locationName,
  permitTypeName,
  tentativeDateLabel,
  requestingAreaName,
  description,
}: WorkNoticeCreatedProps) {
  return (
    <EmailLayout title="Nuevo aviso de trabajo">
      <Text style={styles.paragraph}>
        Hay un nuevo aviso de trabajo pendiente de revisión en {PRODUCT_NAME}.
      </Text>
      <Section style={styles.box}>
        <Text style={styles.boxLine}>
          <strong>Código:</strong> {code}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Contratista:</strong> {organizationName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Nave / lugar:</strong> {locationName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Tipo:</strong> {permitTypeName}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Fecha tentativa:</strong> {tentativeDateLabel}
        </Text>
        <Text style={styles.boxLine}>
          <strong>Área solicitante:</strong> {requestingAreaName}
        </Text>
        {description ? (
          <Text style={styles.boxLine}>
            <strong>Descripción:</strong> {description}
          </Text>
        ) : null}
      </Section>
      <Text style={styles.muted}>
        Revisá la bandeja de avisos para validar documentación y habilitar el
        trabajo.
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
