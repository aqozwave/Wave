import {
  AccreditationScope,
  ApprovalFlowStageActor,
  ApprovalFlowStageMoment,
  PermitAstMode,
  PermitCriticality,
  PermitRequirementKind,
  PermitRequirementMoment,
  PermitRequirementScope,
  PrismaClient,
  RoleDataScope,
} from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

/**
 * Etapas fijas del flujo sistema EST (Figma P15e · 5 etapas).
 * key cablea el motor de estados del PT más adelante.
 */
const EST_STAGES: ReadonlyArray<{
  position: number;
  key: string;
  label: string;
  actor: ApprovalFlowStageActor;
  moment: ApprovalFlowStageMoment;
  requiresSignature: boolean;
}> = [
  {
    position: 1,
    key: "notice",
    label:
      "Informa los trabajos y las contratistas que irán a bordo",
    actor: ApprovalFlowStageActor.requesting_area,
    moment: ApprovalFlowStageMoment.before,
    requiresSignature: false,
  },
  {
    position: 2,
    key: "create_permit",
    label:
      "Genera el permiso (empresa, RUT, fechas, descripción, área)",
    actor: ApprovalFlowStageActor.prevention,
    moment: ApprovalFlowStageMoment.before,
    requiresSignature: false,
  },
  {
    position: 3,
    key: "complete",
    label:
      "Completa datos, identifica trabajadores y hace el checklist",
    actor: ApprovalFlowStageActor.contractor,
    moment: ApprovalFlowStageMoment.before,
    requiresSignature: true,
  },
  {
    position: 4,
    key: "approve",
    label: "Valida los datos y aprueba el permiso",
    actor: ApprovalFlowStageActor.prevention,
    moment: ApprovalFlowStageMoment.before,
    requiresSignature: true,
  },
  {
    position: 5,
    key: "receive",
    label:
      "Recibe a los contratistas en el puente y hace el checklist",
    actor: ApprovalFlowStageActor.captain,
    moment: ApprovalFlowStageMoment.on_arrival,
    requiresSignature: true,
  },
  {
    position: 6,
    key: "close",
    label: "Cierra el trabajo",
    actor: ApprovalFlowStageActor.captain,
    moment: ApprovalFlowStageMoment.on_finish,
    requiresSignature: true,
  },
];

/**
 * Upsert del flujo sistema EST por empresa + etapas.
 * Asigna defaultApprovalFlowId a tipos sin flujo.
 */
async function seedEstApprovalFlows(): Promise<number> {
  const businesses = await prisma.business.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  let upserts = 0;

  for (const biz of businesses) {
    const flow = await prisma.approvalFlow.upsert({
      where: {
        businessId_code: { businessId: biz.id, code: "EST" },
      },
      create: {
        businessId: biz.id,
        code: "EST",
        name: "Estándar",
        description:
          "Flujo de sistema · 6 etapas fijas (aviso → recepción → cierre Capitán).",
        isSystem: true,
        active: true,
      },
      update: {
        name: "Estándar",
        description:
          "Flujo de sistema · 6 etapas fijas (aviso → recepción → cierre Capitán).",
        isSystem: true,
        active: true,
        deletedAt: null,
      },
    });
    upserts += 1;

    for (const stage of EST_STAGES) {
      await prisma.approvalFlowStage.upsert({
        where: {
          flowId_key: { flowId: flow.id, key: stage.key },
        },
        create: {
          flowId: flow.id,
          position: stage.position,
          key: stage.key,
          label: stage.label,
          actor: stage.actor,
          moment: stage.moment,
          requiresSignature: stage.requiresSignature,
          mandatory: true,
          fixed: true,
        },
        update: {
          position: stage.position,
          label: stage.label,
          actor: stage.actor,
          moment: stage.moment,
          requiresSignature: stage.requiresSignature,
          mandatory: true,
          fixed: true,
        },
      });
    }

    // Tipos sin flujo default → EST de su empresa.
    await prisma.permitType.updateMany({
      where: {
        businessId: biz.id,
        deletedAt: null,
        defaultApprovalFlowId: null,
      },
      data: { defaultApprovalFlowId: flow.id },
    });
  }

  return upserts;
}

/**
 * Catálogo base P1: 5 tipos oficiales de Nachipa.
 * Idempotente por (businessId, code). No pisa name/criticality si ya existe
 * (solo asegura que la fila esté; update vacío).
 */
const DEFAULT_PERMIT_TYPES: ReadonlyArray<{
  code: string;
  name: string;
  criticality: PermitCriticality;
  requiresAst: boolean;
  astMode: PermitAstMode | null;
  description: string;
}> = [
  {
    code: "ALT",
    name: "Trabajo en altura",
    criticality: PermitCriticality.high,
    requiresAst: false,
    astMode: null,
    description: "Trabajos con riesgo de caída a distinto nivel.",
  },
  {
    code: "ECF",
    name: "Trabajo en espacios confinados",
    criticality: PermitCriticality.high,
    requiresAst: false,
    astMode: null,
    description: "Ingreso a espacios con ventilación limitada.",
  },
  {
    code: "BUC",
    name: "Faena de buceo",
    criticality: PermitCriticality.high,
    requiresAst: true,
    astMode: PermitAstMode.both,
    description: "Operaciones de buceo; exige AST (formulario y/o PDF).",
  },
  {
    code: "GEN",
    name: "Trabajos generales",
    criticality: PermitCriticality.medium,
    requiresAst: false,
    astMode: null,
    description: "Trabajos de riesgo estándar a bordo.",
  },
  {
    code: "CAL",
    name: "Trabajos en caliente",
    criticality: PermitCriticality.high,
    requiresAst: false,
    astMode: null,
    description: "Soldadura, corte u otras fuentes de ignición.",
  },
];

/** Upsert de los 5 tipos en cada empresa activa (sin soft-delete). */
async function seedPermitTypesForBusinesses(): Promise<number> {
  const businesses = await prisma.business.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  let upserts = 0;
  for (const business of businesses) {
    for (const type of DEFAULT_PERMIT_TYPES) {
      await prisma.permitType.upsert({
        where: {
          businessId_code: {
            businessId: business.id,
            code: type.code,
          },
        },
        create: {
          businessId: business.id,
          code: type.code,
          name: type.name,
          criticality: type.criticality,
          requiresAst: type.requiresAst,
          astMode: type.astMode,
          description: type.description,
          active: true,
        },
        // No pisar personalización local en re-seed.
        update: {},
      });
      upserts += 1;
    }
  }
  return upserts;
}

/**
 * Exigencias de ejemplo · CAL (spec Anexo + Figma P15).
 * documentTypeCode: busca DocumentType de la empresa (PS, PP); null si no hay.
 */
const CAL_REQUIREMENTS: ReadonlyArray<{
  key: string;
  kind: PermitRequirementKind;
  scope: PermitRequirementScope;
  moment: PermitRequirementMoment;
  label: string;
  accreditationScope?: AccreditationScope;
  documentTypeCode?: string;
  trainingCode?: string;
}> = [
  {
    key: "cal.company_accreditation",
    kind: PermitRequirementKind.document,
    scope: PermitRequirementScope.company,
    moment: PermitRequirementMoment.before,
    label: "Habilitación de la empresa vigente",
  },
  {
    key: "cal.docs_company_pack",
    kind: PermitRequirementKind.document,
    scope: PermitRequirementScope.company,
    moment: PermitRequirementMoment.before,
    label: "8 documentos de la empresa",
    accreditationScope: AccreditationScope.company,
  },
  {
    key: "cal.doc_ps",
    kind: PermitRequirementKind.document,
    scope: PermitRequirementScope.company,
    moment: PermitRequirementMoment.before,
    label: "PS · Procedimiento de trabajo seguro en caliente",
    documentTypeCode: "PS",
  },
  {
    key: "cal.docs_person_pack",
    kind: PermitRequirementKind.document,
    scope: PermitRequirementScope.person,
    moment: PermitRequirementMoment.before,
    label: "8 documentos por persona",
    accreditationScope: AccreditationScope.person,
  },
  {
    key: "cal.training_ext01",
    kind: PermitRequirementKind.training,
    scope: PermitRequirementScope.person,
    moment: PermitRequirementMoment.before,
    label: "EXT-01 · Uso y manejo de extintores",
    trainingCode: "EXT-01",
  },
  {
    key: "cal.training_odi01",
    kind: PermitRequirementKind.training,
    scope: PermitRequirementScope.person,
    moment: PermitRequirementMoment.before,
    label: "ODI-01 · Obligación de informar los riesgos",
    trainingCode: "ODI-01",
  },
  {
    key: "cal.checklist_hot_work",
    kind: PermitRequirementKind.checklist,
    scope: PermitRequirementScope.permit,
    moment: PermitRequirementMoment.before,
    label: "Checklist de trabajos en caliente (6 ítems)",
  },
  {
    key: "cal.doc_pp_closure",
    kind: PermitRequirementKind.document,
    scope: PermitRequirementScope.permit,
    moment: PermitRequirementMoment.closure,
    label: "PP · Check list post permiso de trabajo",
    documentTypeCode: "PP",
  },
];

/**
 * Checklist CAL (6 ítems). El anexo del spec no lista el texto;
 * estos son ítems típicos de hot work a bordo (provisional hasta OK de Prevención).
 */
const CAL_CHECKLIST: ReadonlyArray<string> = [
  "Extintor operativo y a menos de 10 m del frente de trabajo",
  "Área libre de combustibles o protegida con mantas ignífugas",
  "Equipo de soldadura/corte/esmerilado en buen estado",
  "Ventilación adecuada del área de trabajo",
  "Vigía o apoyo asignado durante la faena",
  "EPP completo (careta, guantes, ropa de protección)",
];

/**
 * Checklist ECF (8 ítems) — texto oficial del anexo del spec.
 */
const ECF_CHECKLIST: ReadonlyArray<string> = [
  "Medición de atmósfera (O₂, CO, H₂S, LEL) antes de ingresar",
  "Ventilación forzada operativa",
  "Permiso de ingreso firmado por el supervisor",
  "Vigía exterior con comunicación permanente",
  "Equipo de rescate y arnés con línea de vida",
  "Bloqueo y etiquetado de energías (LOTO)",
  "Iluminación antiexplosiva",
  "EPP completo incluido el respirador",
];

/** Upsert de ítems de checklist por código de tipo. */
async function seedChecklistForCode(
  code: string,
  texts: ReadonlyArray<string>,
): Promise<number> {
  const types = await prisma.permitType.findMany({
    where: { code, deletedAt: null },
    select: { id: true },
  });

  let upserts = 0;
  for (const type of types) {
    for (let i = 0; i < texts.length; i += 1) {
      const order = i + 1;
      await prisma.permitChecklistItem.upsert({
        where: {
          permitTypeId_order: {
            permitTypeId: type.id,
            order,
          },
        },
        create: {
          permitTypeId: type.id,
          order,
          text: texts[i]!,
          active: true,
        },
        update: {},
      });
      upserts += 1;
    }
  }
  return upserts;
}

/**
 * Catálogo P1 capacitaciones (ejemplos del diseño).
 * PAU/ECF/SPE: nombres provisionales («por confirmar» en el spec).
 */
const DEFAULT_TRAININGS: ReadonlyArray<{
  code: string;
  name: string;
  validityMonths: number | null;
  appliesTo: string[];
}> = [
  {
    code: "ALT-01",
    name: "Trabajo en altura física",
    validityMonths: 12,
    appliesTo: ["crew", "external_person"],
  },
  {
    code: "IND-SEG",
    name: "Inducción de seguridad a bordo",
    validityMonths: null,
    appliesTo: ["crew", "external_person"],
  },
  {
    code: "ODI-01",
    name: "Obligación de informar los riesgos (ODI)",
    validityMonths: 12,
    appliesTo: ["crew", "external_person"],
  },
  {
    code: "EXT-01",
    name: "Uso y manejo de extintores",
    validityMonths: 12,
    appliesTo: ["crew", "external_person"],
  },
  {
    code: "PAU-01",
    name: "PAU-01 (nombre por confirmar)",
    validityMonths: 12,
    appliesTo: ["external_person"],
  },
  {
    code: "ECF-01",
    name: "ECF-01 (nombre por confirmar)",
    validityMonths: 12,
    appliesTo: ["external_person"],
  },
  {
    code: "SPE-01",
    name: "SPE-01 (nombre por confirmar)",
    validityMonths: 12,
    appliesTo: ["external_person"],
  },
];

/**
 * Pack document_types Prevención (Anexo A del spec).
 * 8 empresa + 8 persona + CA + PP. Códigos 2 letras; nombres provisionales
 * marcados «por confirmar» cuando el anexo no los fija.
 * Sin @@unique Prisma en (businessId, code): findFirst + create/update.
 */
const PREVENCION_DOCUMENT_TYPES: ReadonlyArray<{
  code: string;
  name: string;
  /** crew | external | crew_and_external */
  appliesTo: "crew" | "external" | "crew_and_external";
  requiresExpiry: boolean;
  /** Membresía del pack editable (null = fuera). */
  accreditationPack: "company" | "person" | null;
}> = [
  // Empresa externa — los «8»
  {
    code: "NT",
    name: "Nómina de trabajadores",
    appliesTo: "external",
    requiresExpiry: false,
    accreditationPack: "company",
  },
  {
    code: "SA",
    name: "Certificado de siniestralidad",
    appliesTo: "external",
    requiresExpiry: true,
    accreditationPack: "company",
  },
  {
    code: "RS",
    name: "RS (nombre por confirmar)",
    appliesTo: "external",
    requiresExpiry: true,
    accreditationPack: "company",
  },
  {
    code: "RI",
    name: "RI · RIOHS (nombre por confirmar)",
    appliesTo: "external",
    requiresExpiry: true,
    accreditationPack: "company",
  },
  {
    code: "MP",
    name: "Matriz de peligros (MIPER)",
    appliesTo: "external",
    requiresExpiry: true,
    accreditationPack: "company",
  },
  {
    code: "AF",
    name: "AF · Afiliación (nombre por confirmar)",
    appliesTo: "external",
    requiresExpiry: true,
    accreditationPack: "company",
  },
  {
    code: "PS",
    name: "Procedimiento de trabajo seguro",
    appliesTo: "external",
    requiresExpiry: false,
    accreditationPack: "company",
  },
  {
    code: "PA",
    name: "PA (nombre por confirmar)",
    appliesTo: "external",
    requiresExpiry: true,
    accreditationPack: "company",
  },
  // Persona — los «8»
  {
    code: "CD",
    name: "CD (nombre por confirmar)",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: "person",
  },
  {
    code: "CO",
    name: "CO (nombre por confirmar)",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: "person",
  },
  {
    code: "EN",
    name: "Entrega de EPP",
    appliesTo: "crew_and_external",
    requiresExpiry: false,
    accreditationPack: "person",
  },
  {
    code: "CE",
    name: "CE (nombre por confirmar)",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: "person",
  },
  {
    code: "OD",
    name: "Informar los riesgos laborales (ODI)",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: "person",
  },
  {
    code: "DA",
    name: "DA (nombre por confirmar)",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: "person",
  },
  {
    code: "DE",
    name: "DE (nombre por confirmar)",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: "person",
  },
  {
    code: "EO",
    name: "Examen ocupacional",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: "person",
  },
  // Acredita capacitaciones (fuera de pack)
  {
    code: "CA",
    name: "Certificado de capacitación",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: null,
  },
  // Evidencia por código de capacitación (faena; no pack HAB)
  {
    code: "EXT-01",
    name: "Uso y manejo de extintores",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: null,
  },
  {
    code: "ODI-01",
    name: "Obligación de informar los riesgos (ODI)",
    appliesTo: "crew_and_external",
    requiresExpiry: true,
    accreditationPack: null,
  },
  // Procedimiento del tipo CAL (empresa / faena)
  {
    code: "PS",
    name: "Procedimiento de trabajo seguro en caliente",
    appliesTo: "external",
    requiresExpiry: false,
    accreditationPack: null,
  },
  // Cierre de permiso (fuera de pack)
  {
    code: "PP",
    name: "Check list post permiso de trabajo",
    appliesTo: "external",
    requiresExpiry: false,
    accreditationPack: null,
  },
];

/** Upsert pack Prevención por empresa (idempotente por code). */
async function seedPrevencionDocumentTypes(): Promise<number> {
  const businesses = await prisma.business.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  let upserts = 0;
  for (const business of businesses) {
    for (const doc of PREVENCION_DOCUMENT_TYPES) {
      const existing = await prisma.documentType.findFirst({
        where: {
          businessId: business.id,
          code: doc.code,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existing) {
        // No pisa nombres ETL ni la membresía del pack (Prevención la edita a mano).
        await prisma.documentType.update({
          where: { id: existing.id },
          data: {
            subtype: "prevencion",
            uploadBy: "prevention_or_admin",
            viewBy: "prevention_or_admin",
          },
        });
      } else {
        await prisma.documentType.create({
          data: {
            businessId: business.id,
            code: doc.code,
            name: doc.name.toLowerCase(),
            subtype: "prevencion",
            appliesTo: doc.appliesTo,
            requiresExpiry: doc.requiresExpiry,
            uploadBy: "prevention_or_admin",
            viewBy: "prevention_or_admin",
            crewCanView: true,
            visibility: "employee",
            accreditationPack: doc.accreditationPack,
            state: true,
          },
        });
      }
      upserts += 1;
    }
  }
  return upserts;
}

/**
 * Upsert de capacitaciones por empresa.
 * Enlaza documentTypeId cuando existe un DocumentType con el mismo código
 * (evidencia subible en ficha de persona / faena del PT).
 */
async function seedTrainingsForBusinesses(): Promise<number> {
  const businesses = await prisma.business.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  let upserts = 0;
  for (const business of businesses) {
    for (const t of DEFAULT_TRAININGS) {
      const evidenceDoc = await prisma.documentType.findFirst({
        where: {
          businessId: business.id,
          code: t.code,
          deletedAt: null,
        },
        select: { id: true },
      });

      await prisma.training.upsert({
        where: {
          businessId_code: {
            businessId: business.id,
            code: t.code,
          },
        },
        create: {
          businessId: business.id,
          code: t.code,
          name: t.name,
          validityMonths: t.validityMonths,
          appliesTo: [...t.appliesTo],
          documentTypeId: evidenceDoc?.id ?? null,
          active: true,
        },
        update: {
          ...(evidenceDoc ? { documentTypeId: evidenceDoc.id } : {}),
        },
      });
      upserts += 1;
    }
  }
  return upserts;
}

/** Upsert de las 8 exigencias CAL por cada empresa que tenga el tipo. */
async function seedCalRequirements(): Promise<number> {
  const calTypes = await prisma.permitType.findMany({
    where: { code: "CAL", deletedAt: null },
    select: { id: true, businessId: true },
  });

  let upserts = 0;
  for (const cal of calTypes) {
    for (const req of CAL_REQUIREMENTS) {
      let documentTypeId: string | null = null;
      if (req.documentTypeCode) {
        const doc = await prisma.documentType.findFirst({
          where: {
            businessId: cal.businessId,
            code: req.documentTypeCode,
            deletedAt: null,
          },
          select: { id: true },
        });
        documentTypeId = doc?.id ?? null;
      }

      let trainingId: string | null = null;
      if (req.trainingCode) {
        const training = await prisma.training.findFirst({
          where: {
            businessId: cal.businessId,
            code: req.trainingCode,
            deletedAt: null,
          },
          select: { id: true },
        });
        trainingId = training?.id ?? null;
      }

      await prisma.permitTypeRequirement.upsert({
        where: {
          permitTypeId_key: {
            permitTypeId: cal.id,
            key: req.key,
          },
        },
        create: {
          permitTypeId: cal.id,
          key: req.key,
          kind: req.kind,
          scope: req.scope,
          moment: req.moment,
          mandatory: true,
          label: req.label,
          accreditationScope: req.accreditationScope ?? null,
          documentTypeId,
          trainingCode: req.trainingCode ?? null,
          trainingId,
          active: true,
        },
        // Enlaza FKs si el seed de docs/capacitaciones corrió después o faltaba.
        update: {
          ...(trainingId
            ? { trainingId, trainingCode: req.trainingCode ?? null }
            : {}),
          ...(documentTypeId ? { documentTypeId } : {}),
        },
      });
      upserts += 1;
    }
  }
  return upserts;
}

async function main() {
  const role = await prisma.role.upsert({
    where: { key: "superadmin" },
    update: {},
    create: {
      key: "superadmin",
      name: "Superadmin",
      description: "Acceso total al sistema",
      isSystem: true,
      dataScope: RoleDataScope.all,
      permissions: [],
    },
  });

  const passwordHash = await hashPassword("Password1!");

  // Correo real de Francisco: los mails de Resend llegan; .local rebotaba.
  const superadminEmail = "fsoto@nachipa-w.com";

  await prisma.user.upsert({
    where: { legacyMongoId: "seed-superadmin" },
    update: {
      email: superadminEmail,
      username: "fsoto",
      firstName: "Francisco",
      lastName: "Soto",
      passwordHash,
      confirmed: true,
      state: true,
      deletedAt: null,
      roleId: role.id,
      internalRol: "superadmin",
    },
    create: {
      legacyMongoId: "seed-superadmin",
      run: "1-9",
      username: "fsoto",
      passwordHash,
      firstName: "Francisco",
      lastName: "Soto",
      email: superadminEmail,
      internalRol: "superadmin",
      roleId: role.id,
      confirmed: true,
      state: true,
    },
  });

  const permitUpserts = await seedPermitTypesForBusinesses();
  console.log(`permit_types seed: ${permitUpserts} upserts`);

  // Docs primero: trainings y exigencias CAL enlazan documentTypeId (EXT-01, PS…).
  const docUpserts = await seedPrevencionDocumentTypes();
  console.log(`document_types (prevención pack) seed: ${docUpserts} upserts`);

  const trainingUpserts = await seedTrainingsForBusinesses();
  console.log(`trainings seed: ${trainingUpserts} upserts`);

  const reqUpserts = await seedCalRequirements();
  console.log(`permit_type_requirements (CAL) seed: ${reqUpserts} upserts`);

  const calCheck = await seedChecklistForCode("CAL", CAL_CHECKLIST);
  console.log(`permit_checklist_items (CAL) seed: ${calCheck} upserts`);

  const ecfCheck = await seedChecklistForCode("ECF", ECF_CHECKLIST);
  console.log(`permit_checklist_items (ECF) seed: ${ecfCheck} upserts`);

  // Después de tipos: EST sistema + default en permit types.
  const flowUpserts = await seedEstApprovalFlows();
  console.log(`approval_flows (EST) seed: ${flowUpserts} upserts`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
