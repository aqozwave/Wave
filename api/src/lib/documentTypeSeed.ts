/**
 * Catálogo inicial de tipos de documento (códigos del sistema HR).
 * Se siembra por empresa al migrar / al crear empresa.
 */

/** Una fila del seed (sin businessId). */
export type DocumentTypeSeedRow = {
  code: string;
  name: string;
  subtype: string;
  visibility: string;
};

/** Subset náutico + prevención + expediente útil (códigos HR). */
export const DOCUMENT_TYPE_SEED: DocumentTypeSeedRow[] = [
  { code: "CO", name: "Contrato", subtype: "general", visibility: "employee_supervisor" },
  {
    code: "ANE",
    name: "Anexo contrato aumento y prev delito",
    subtype: "general",
    visibility: "supervisor",
  },
  {
    code: "VI",
    name: "Vigencia libreta de embarco",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "TI",
    name: "Título libreta de embarco",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "DT",
    name: "Datos personales libreta de embarco",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "CR",
    name: "Certificado médico libreta de embarco",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "HA",
    name: "Habilitación practicaje (pasadas)",
    subtype: "maritimo",
    visibility: "employee",
  },
  { code: "EN", name: "Entrega de EPP", subtype: "prevencion", visibility: "employee" },
  {
    code: "WL",
    name: "Carta de amonestación",
    subtype: "prevencion",
    visibility: "supervisor",
  },
  { code: "AS", name: "Asignación de activo", subtype: "activo", visibility: "employee" },
  { code: "DA", name: "Devolución activos", subtype: "activo", visibility: "employee" },
  {
    code: "EX",
    name: "Examen ocupacional básico",
    subtype: "prevencion",
    visibility: "employee",
  },
  {
    code: "EA",
    name: "Examen ocupacional altura",
    subtype: "prevencion",
    visibility: "employee",
  },
  {
    code: "EE",
    name: "Examen ocupacional trabajo a bordo",
    subtype: "prevencion",
    visibility: "employee",
  },
  {
    code: "EM",
    name: "Examen ocupacional espacios confinados",
    subtype: "prevencion",
    visibility: "employee",
  },
  {
    code: "EC",
    name: "Examen ocupacional exposición a ruido",
    subtype: "prevencion",
    visibility: "employee",
  },
  {
    code: "EO",
    name: "Examen ocupacional conducción vehículo",
    subtype: "prevencion",
    visibility: "employee",
  },
  {
    code: "HI",
    name: "Historia ocupacional",
    subtype: "prevencion",
    visibility: "employee",
  },
  {
    code: "CU",
    name: "Cuestionario de salud",
    subtype: "prevencion",
    visibility: "employee",
  },
  { code: "DS", name: "Derecho a saber", subtype: "prevencion", visibility: "employee" },
  { code: "RI", name: "Reglamento interno", subtype: "general", visibility: "employee" },
  { code: "CD", name: "Cédula de identidad", subtype: "general", visibility: "employee_supervisor" },
  {
    code: "CE",
    name: "Certificado académico",
    subtype: "general",
    visibility: "employee_supervisor",
  },
  {
    code: "OM",
    name: "OMI 1-13 primeros auxilios",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "OI",
    name: "OMI 1-19 supervivencia personal",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "OF",
    name: "OMI 3-26 formación gente de mar",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "OC",
    name: "OMI 1-28 control multitudes",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "OA",
    name: "OMI 1-10 cargas peligrosas",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "OP",
    name: "OMI 1-20 prevención y lucha contra incendio",
    subtype: "maritimo",
    visibility: "employee",
  },
  {
    code: "OS",
    name: "OMI 1-21 seguridad social",
    subtype: "maritimo",
    visibility: "employee",
  },
  { code: "OV", name: "OMI varios", subtype: "maritimo", visibility: "employee" },
];
