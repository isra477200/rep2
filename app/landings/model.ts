import { buildLandingHtmlV3 } from "./renderer.ts";

export type LandingArchitecture =
  | "local"
  | "diagnostic"
  | "booking"
  | "saas"
  | "marketplace"
  | "pricing";

export type LandingAngle =
  | "outcome"
  | "territory"
  | "speed"
  | "risk"
  | "authority";

export type LandingTone = "direct" | "consultative" | "premium";
export type LandingCtaMode = "whatsapp" | "phone" | "calendar";
export type LandingVariant = "a" | "b";
export type LandingObjective = "qualified" | "booking" | "quote" | "contact";
export type LandingTrafficSource = "meta" | "google" | "organic" | "outbound" | "mixed";
export type LandingAwareness = "cold" | "warm" | "hot";
export type LandingDepth = "short" | "standard" | "extended";
export type LandingIntent =
  | "vertical-default"
  | "reserva-dominio"
  | "embargo-precinto"
  | "financiado-pendiente"
  | "con-cargas";
export type LandingSectionId =
  | "problem"
  | "qualification"
  | "mechanism"
  | "offer"
  | "proof"
  | "pricing"
  | "guarantee"
  | "faq";

export type LandingEvidencePlan = {
  recipeId: string;
  strategy: "dominant" | "intent" | "contrast" | "recommended";
  strategyLabel: string;
  heroFamilyId: string;
  heroFamilyLabel: string;
  ctaFamilyId: string;
  ctaFamilyLabel: string;
  confidence: "high" | "medium" | "low";
  observedTogether: number;
  sampleBase: number;
  heroSampleBase: number;
  ctaSampleBase: number;
  sectionSequence: LandingSectionId[];
  sourceCompanies: Array<{ companyId: string; name: string; url?: string }>;
};

export type LandingBrief = {
  architecture: LandingArchitecture;
  angle: LandingAngle;
  tone: LandingTone;
  variant: LandingVariant;
  objective: LandingObjective;
  trafficSource: LandingTrafficSource;
  awareness: LandingAwareness;
  depth: LandingDepth;
  intent: LandingIntent;
  formFieldsTarget: number;
  activeRecipeId: string;
  evidencePlan: LandingEvidencePlan | null;
  verticalId: string;
  brand: string;
  zone: string;
  service: string;
  audience: string;
  unit: string;
  pain: string;
  result: string;
  filter: string;
  offer: string;
  proof: string;
  price: string;
  guarantee: string;
  ctaLabel: string;
  ctaMode: LandingCtaMode;
  destination: string;
  accent: string;
  logoUrl: string;
  heroImageUrl: string;
  privacyUrl: string;
  cookiesUrl: string;
  legalName: string;
  legalId: string;
  leadEndpoint: string;
  leadEndpointVerified: boolean;
  gtmId: string;
  trackingVerified: boolean;
};

export type LandingExample = {
  companyId: string;
  name: string;
  country: string;
  headline: string;
  primaryCta: string;
  offer: string;
  proof: string;
  price: string;
  guarantee: string;
  funnelSteps: number;
  capturedPages: number;
  pageRoles: string[];
  thumbnail: string | null;
  sourceUrl: string | null;
  completeness: number;
  fieldsPresent: string[];
  score: number;
  language?: string | null;
  sectionHeadings?: string[];
  sectionSequence?: LandingSectionId[];
  ctaTexts?: string[];
  documentHeight?: number | null;
  sourceRole?: string | null;
  salesPageValid?: boolean;
  trustedScope?: boolean;
  verticalRelevance?: number;
  verticalConfidence?: "high" | "medium" | "low";
  verticalEvidence?: string;
  curatedRank?: number | null;
};

export type LandingFamily = {
  id: string;
  label: string;
  count: number;
  share: number;
  classifiedShare?: number;
  sampleBase?: number;
  companyIds?: string[];
  examples: Array<{ companyId: string; name: string; text: string }>;
};

export type LandingVerticalIntelligence = {
  id: string;
  label: string;
  sampleSize: number;
  capturedPages: number;
  companiesWithLanding: number;
  medianFunnelSteps: number | null;
  medianFormFields: number | null;
  fieldPresence: Record<string, number>;
  ctaFamilies: LandingFamily[];
  heroFamilies: LandingFamily[];
  cooccurrences: Array<{
    id: string;
    heroId: string;
    heroLabel: string;
    ctaId: string;
    ctaLabel: string;
    count: number;
    share: number;
    sampleBase: number;
    companyIds: string[];
    examples: Array<{ companyId: string; name: string; headline: string; primaryCta: string }>;
  }>;
  examples: LandingExample[];
  recommendations: string[];
  sectionPatterns?: Array<{
    id: LandingSectionId;
    label: string;
    count: number;
    share: number;
    medianPosition: number | null;
    companyIds: string[];
    examples: Array<{ companyId: string; name: string; text: string }>;
  }>;
  study: {
    confidence: "high" | "medium" | "low";
    coverage: {
      eligibleCompanies: number;
      heroClassifiedCompanies: number;
      heroCoveragePct: number;
      ctaClassifiedCompanies: number;
      ctaCoveragePct: number;
    };
    dominantHero: LandingFamily | null;
    dominantCta: LandingFamily | null;
    strengths: Array<{ field: string; presence: number; universal: number; delta: number }>;
    opportunities: Array<{ field: string; presence: number; universal: number; delta: number }>;
    recommendedDefaults: {
      architecture: LandingArchitecture;
      angle: LandingAngle;
      ctaMode: LandingCtaMode;
      ctaLabel: string;
      formFields: number | null;
    };
    warnings: string[];
  };
};

export type LandingIntelligence = {
  schemaVersion: "rv-landing-intelligence-v3";
  generatedAt: string;
  source: {
    companies: number;
    eligibleCompanies: number;
    salesPageCompanies: number;
    pages: number;
    capturedPages: number;
    blockedPages: number;
    failedPages: number;
    countries: string[];
    methodology: string;
    qualityPolicy: string;
  };
  universal: {
    roles: Record<string, number>;
    medianFunnelSteps: number | null;
    medianFormFields: number | null;
    fieldPresence: Record<string, number>;
    ctaFamilies: LandingFamily[];
    heroFamilies: LandingFamily[];
    sectionPatterns: LandingVerticalIntelligence["sectionPatterns"];
    anatomy: Array<{ id: string; label: string; purpose: string }>;
    dataQuality: {
      eligibleCompanies: number;
      salesPageCompanies: number;
      usableCtaCompanies: number;
      ctaCoveragePct: number;
      classifiedHeroCompanies: number;
      heroCoveragePct: number;
      auditedAbsenceOverrides: {
        price: number;
        guarantee: number;
        proof: number;
      };
    };
  };
  verticals: Record<string, LandingVerticalIntelligence>;
};

export type LandingEvidenceRecipe = {
  id: string;
  label: string;
  summary: string;
  architecture: LandingArchitecture;
  angle: LandingAngle;
  variant: LandingVariant;
  ctaMode: LandingCtaMode;
  ctaLabel: string;
  heroFamily: LandingFamily;
  ctaFamily: LandingFamily;
  evidenceScope: { hero: "vertical" | "global"; cta: "vertical" | "global" };
  strategy: "dominant" | "intent" | "contrast";
  strategyLabel: string;
  confidence: "high" | "medium" | "low";
  fitReason: string;
  tradeoff: string;
  modules: string[];
  requirements: string[];
  sources: Array<{ companyId: string; name: string; text: string }>;
  sourceGroups: {
    hero: Array<{ companyId: string; name: string; text: string }>;
    cta: Array<{ companyId: string; name: string; text: string }>;
    together: Array<{ companyId: string; name: string; text: string }>;
  };
  observedTogether: number;
  sampleBase: number;
  heroSampleBase: number;
  ctaSampleBase: number;
  warnings: string[];
  sectionSequence: LandingSectionId[];
};

export type LandingStrategyRecommendation = {
  architecture: LandingArchitecture;
  angle: LandingAngle;
  ctaMode: LandingCtaMode;
  ctaLabel: string;
  compatibility: number;
  reasons: string[];
  risks: string[];
  suggestedFormFields: number | null;
  evidencePlan: LandingEvidencePlan;
};

type VerticalPreset = {
  audience: string;
  unit: string;
  service: string;
  pain: string;
  result: string;
  filter: string;
  offer: string;
};

export const VERTICAL_PRESETS: Record<string, VerticalPreset> = {
  "clinicas-salud": {
    audience: "clínicas privadas con capacidad para atender nuevos pacientes",
    unit: "pacientes",
    service: "captación de pacientes",
    pain: "huecos de agenda, consultas sin intención y seguimiento irregular",
    result: "más conversaciones con pacientes que encajan con tus tratamientos",
    filter: "tratamiento, zona, disponibilidad, intención y capacidad de pago",
    offer: "Diagnóstico de demanda, campaña, filtro de entrada y seguimiento hasta la conversación comercial.",
  },
  "reformas-hogar": {
    audience: "empresas de reformas y gremios con capacidad para ejecutar nuevas obras",
    unit: "proyectos",
    service: "captación de obras",
    pain: "leads compartidos y visitas que no terminan en un presupuesto viable",
    result: "más solicitudes de presupuesto con propietarios que encajan",
    filter: "tipo de obra, propiedad, zona, plazo y presupuesto orientativo",
    offer: "Campaña local, precualificación y entrega de solicitudes con contexto suficiente para presupuestar.",
  },
  "solar-energia": {
    audience: "instaladoras solares con equipo técnico y cobertura definida",
    unit: "instalaciones",
    service: "captación de instalaciones solares",
    pain: "visitas a viviendas inviables y contactos revendidos",
    result: "más oportunidades con propietarios y viviendas que pasan el filtro inicial",
    filter: "tipo de vivienda, titularidad, consumo, zona, decisión y plazo",
    offer: "Captación geográfica, filtro de viabilidad y entrega de oportunidades trazables.",
  },
  inmobiliario: {
    audience: "agencias inmobiliarias que quieren captar propietarios vendedores",
    unit: "propietarios",
    service: "captación de propietarios",
    pain: "contactos curiosos y propietarios sin intención real de vender",
    result: "más conversaciones de valoración con propietarios vendedores",
    filter: "propiedad, zona, motivo de venta, plazo y capacidad de decisión",
    offer: "Campaña de propietarios, cualificación y entrega inmediata con historial de contacto.",
  },
  legal: {
    audience: "despachos que quieren crecer en una especialidad concreta",
    unit: "casos",
    service: "captación de casos jurídicos",
    pain: "consultas fuera de especialidad y llamadas que consumen horas sin encaje",
    result: "más consultas que encajan con la especialidad del despacho",
    filter: "materia, jurisdicción, urgencia, ubicación y encaje inicial",
    offer: "Página especializada, campaña, filtro de materia y solicitud de consulta con contexto.",
  },
  "coches-motor": {
    audience: "concesionarios, compraventas y talleres con capacidad comercial disponible",
    unit: "oportunidades",
    service: "captación de clientes de automoción",
    pain: "solicitudes sin vehículo, presupuesto o intención suficiente",
    result: "más oportunidades de automoción listas para atender",
    filter: "vehículo, servicio, ubicación, presupuesto y plazo",
    offer: "Campaña específica, formulario de vehículo y entrega de la solicitud con datos accionables.",
  },
  "b2b-sdr": {
    audience: "empresas B2B con una oferta validada y capacidad para cerrar nuevas cuentas",
    unit: "reuniones",
    service: "generación de reuniones B2B",
    pain: "prospección irregular y reuniones sin el decisor adecuado",
    result: "más conversaciones con cuentas y decisores que encajan",
    filter: "sector, tamaño, cargo, necesidad, momento y capacidad de compra",
    offer: "Definición del ICP, mensaje, prospección multicanal, cualificación y agenda compartida.",
  },
  "belleza-bienestar": {
    audience: "centros de estética y bienestar con huecos disponibles en agenda",
    unit: "reservas",
    service: "captación de reservas",
    pain: "consultas que no reservan y una agenda difícil de prever",
    result: "más solicitudes de reserva para los tratamientos prioritarios",
    filter: "tratamiento, ubicación, disponibilidad, intención y presupuesto",
    offer: "Campaña local, página por tratamiento y solicitud de reserva con filtro inicial.",
  },
  "hosteleria-turismo": {
    audience: "negocios de hostelería y turismo que quieren aumentar la demanda directa",
    unit: "reservas",
    service: "captación de reservas directas",
    pain: "dependencia de intermediarios y demanda poco previsible",
    result: "más solicitudes de reserva directa con datos propios",
    filter: "fechas, número de personas, ubicación, disponibilidad y presupuesto",
    offer: "Campaña de demanda directa, página de oferta y solicitud de disponibilidad.",
  },
  "directorios-marketplaces": {
    audience: "negocios que necesitan solicitudes trazables y comparables",
    unit: "solicitudes",
    service: "captación de solicitudes",
    pain: "visibilidad sin intención verificable y contactos compartidos",
    result: "más solicitudes con una necesidad concreta y trazable",
    filter: "servicio, zona, necesidad, plazo, presupuesto y contacto",
    offer: "Entrada guiada, clasificación de la solicitud y conexión con el proveedor adecuado.",
  },
  generalista: {
    audience: "negocios con una oferta clara y capacidad para atender nueva demanda",
    unit: "oportunidades",
    service: "captación de oportunidades",
    pain: "contactos sin contexto y seguimiento inconsistente",
    result: "más conversaciones comerciales con oportunidades que encajan",
    filter: "servicio, ubicación, necesidad, plazo y presupuesto",
    offer: "Diagnóstico, campaña, cualificación y entrega trazable de cada oportunidad.",
  },
};

export const ARCHITECTURES: Array<{
  id: LandingArchitecture;
  label: string;
  description: string;
  bestFor: string;
}> = [
  {
    id: "local",
    label: "Servicio local",
    description: "Demanda por zona, filtro de encaje y contacto rápido.",
    bestFor: "Clínicas, hogar, solar, inmobiliario y belleza",
  },
  {
    id: "diagnostic",
    label: "Diagnóstico B2B",
    description: "Venta consultiva con problema, método y solicitud cualificada.",
    bestFor: "Servicios complejos, despachos y B2B",
  },
  {
    id: "booking",
    label: "Reserva directa",
    description: "Recorrido corto con prueba temprana y CTA a agenda.",
    bestFor: "Demo, consulta, valoración o primera cita",
  },
  {
    id: "saas",
    label: "SaaS / producto",
    description: "Problema, producto visual, capacidades, prueba y demo o trial.",
    bestFor: "Software, automatización y servicios productizados",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Una sola audiencia principal, búsqueda o solicitud y confianza.",
    bestFor: "Directorios, comparadores y plataformas de dos caras",
  },
  {
    id: "pricing",
    label: "Oferta y precio",
    description: "Aclara alcance, precio, condiciones y objeciones antes del contacto.",
    bestFor: "Producto estandarizado o paquete comparable",
  },
];

export const ANGLES: Array<{
  id: LandingAngle;
  label: string;
  description: string;
}> = [
  { id: "outcome", label: "Resultado", description: "Abre con el cambio deseado y el público." },
  { id: "territory", label: "Zona", description: "Convierte ubicación y disponibilidad en relevancia." },
  { id: "speed", label: "Velocidad", description: "Destaca respuesta y seguimiento sin inventar un SLA." },
  { id: "risk", label: "Riesgo", description: "Da claridad contractual; solo muestra garantías escritas." },
  { id: "authority", label: "Autoridad", description: "Abre con especialización y prueba identificable." },
];

const recipeHeroSettings: Record<
  string,
  { angle: LandingAngle; variant: LandingVariant; modules: string[]; requirements: string[] }
> = {
  outcome: {
    angle: "outcome",
    variant: "a",
    modules: ["Resultado", "Público", "Mecanismo", "Cualificación", "Prueba"],
    requirements: ["Resultado específico", "Público reconocible"],
  },
  pain: {
    angle: "outcome",
    variant: "b",
    modules: ["Dolor", "Contraste", "Resultado", "Mecanismo", "Prueba"],
    requirements: ["Problema reconocido por el cliente", "Resultado verificable"],
  },
  proof: {
    angle: "authority",
    variant: "a",
    modules: ["Autoridad", "Prueba identificable", "Oferta", "Proceso", "CTA"],
    requirements: ["Caso, reseña o dato con fuente"],
  },
  identity: {
    angle: "authority",
    variant: "a",
    modules: ["Especialización", "Público", "Oferta", "Proceso", "CTA"],
    requirements: ["Especialización que pueda demostrarse"],
  },
  mechanism: {
    angle: "outcome",
    variant: "a",
    modules: ["Resultado", "Mecanismo", "Pasos", "Cualificación", "CTA"],
    requirements: ["Proceso real y explicable"],
  },
  risk: {
    angle: "risk",
    variant: "a",
    modules: ["Condiciones", "Oferta", "Garantía", "Prueba", "CTA"],
    requirements: ["Garantía escrita con métrica, periodo y remedio"],
  },
};

const recipeCtaSettings: Record<
  string,
  { architecture: LandingArchitecture; ctaMode: LandingCtaMode; ctaLabel: string; module: string }
> = {
  booking: {
    architecture: "booking",
    ctaMode: "calendar",
    ctaLabel: "Reservar una primera conversación",
    module: "Agenda",
  },
  contact: {
    architecture: "local",
    ctaMode: "whatsapp",
    ctaLabel: "Hablar con un especialista",
    module: "Contacto directo",
  },
  audit: {
    architecture: "diagnostic",
    ctaMode: "calendar",
    ctaLabel: "Solicitar diagnóstico de encaje",
    module: "Diagnóstico",
  },
  availability: {
    architecture: "local",
    ctaMode: "whatsapp",
    ctaLabel: "Comprobar disponibilidad en mi zona",
    module: "Disponibilidad",
  },
  quote: {
    architecture: "pricing",
    ctaMode: "whatsapp",
    ctaLabel: "Solicitar propuesta y condiciones",
    module: "Propuesta",
  },
  start: {
    architecture: "booking",
    ctaMode: "calendar",
    ctaLabel: "Comprobar si encaja",
    module: "Inicio",
  },
};

const meaningfulFamilies = (families: LandingFamily[]) =>
  families.filter((family) => family.id !== "other" && family.count > 0);

const withUniversalFallback = (vertical: LandingFamily[], universal: LandingFamily[]) => {
  const families = [...meaningfulFamilies(vertical), ...meaningfulFamilies(universal)];
  const ids = new Set<string>();
  return families.filter((family) => {
    if (ids.has(family.id)) return false;
    ids.add(family.id);
    return true;
  });
};

const objectiveCtaFamily: Record<LandingObjective, string> = {
  qualified: "audit",
  booking: "booking",
  quote: "quote",
  contact: "contact",
};

const objectiveArchitecture: Record<LandingObjective, LandingArchitecture> = {
  qualified: "diagnostic",
  booking: "booking",
  quote: "pricing",
  contact: "local",
};

const trafficHeroPriority: Record<LandingTrafficSource, string[]> = {
  meta: ["pain", "outcome", "proof", "mechanism", "identity", "risk"],
  google: ["outcome", "identity", "proof", "mechanism", "risk", "pain"],
  organic: ["proof", "identity", "mechanism", "outcome", "pain", "risk"],
  outbound: ["proof", "identity", "outcome", "mechanism", "pain", "risk"],
  mixed: ["outcome", "proof", "identity", "mechanism", "pain", "risk"],
};

const SECTION_FALLBACK: LandingSectionId[] = [
  "problem",
  "qualification",
  "mechanism",
  "offer",
  "proof",
  "pricing",
  "guarantee",
  "faq",
];

const buildSectionSequence = (
  vertical: LandingVerticalIntelligence | null | undefined,
  heroFamilyId = "outcome",
  ctaFamilyId = "contact",
): LandingSectionId[] => {
  const observed = [...(vertical?.sectionPatterns || [])]
    .filter((item) => item.count > 0)
    .sort(
      (left, right) =>
        (left.medianPosition ?? 99) - (right.medianPosition ?? 99) ||
        right.share - left.share,
    )
    .map((item) => item.id);
  const priority: LandingSectionId[] =
    heroFamilyId === "pain"
      ? ["problem", "qualification"]
      : heroFamilyId === "proof"
        ? ["proof", "qualification"]
        : heroFamilyId === "mechanism"
          ? ["mechanism", "qualification"]
          : heroFamilyId === "risk"
            ? ["guarantee", "qualification"]
            : ["qualification", "mechanism"];
  if (ctaFamilyId === "quote") priority.push("pricing", "offer");
  if (["booking", "availability", "contact"].includes(ctaFamilyId)) {
    priority.push("mechanism", "offer");
  }
  const sequence = [...priority, ...observed, ...SECTION_FALLBACK];
  return sequence.filter(
    (id, index, values): id is LandingSectionId => values.indexOf(id) === index,
  );
};

const familyConfidence = (
  hero: LandingFamily,
  cta: LandingFamily,
  together: number,
  scopes: { hero: "vertical" | "global"; cta: "vertical" | "global" },
): LandingEvidenceRecipe["confidence"] => {
  if (together >= 3 && scopes.hero === "vertical" && scopes.cta === "vertical") return "high";
  if (together >= 1 || (hero.count >= 3 && cta.count >= 3)) return "medium";
  return "low";
};

/**
 * Compone recetas descriptivas desde las familias observadas en el vertical.
 * No usa conversión ni rellena claims: solo propone estructura y siguiente acción.
 */
export const buildEvidenceRecipes = (
  vertical: LandingVerticalIntelligence | null | undefined,
  universal?: LandingIntelligence["universal"] | null,
  brief?: LandingBrief | null,
): LandingEvidenceRecipe[] => {
  const heroFamilies = withUniversalFallback(
    vertical?.heroFamilies || [],
    universal?.heroFamilies || [],
  );
  const ctaFamilies = withUniversalFallback(
    vertical?.ctaFamilies || [],
    universal?.ctaFamilies || [],
  );
  const verticalHeroIds = new Set(meaningfulFamilies(vertical?.heroFamilies || []).map((family) => family.id));
  const verticalCtaIds = new Set(meaningfulFamilies(vertical?.ctaFamilies || []).map((family) => family.id));
  if (!heroFamilies.length || !ctaFamilies.length) return [];
  const heroById = new Map(heroFamilies.map((family) => [family.id, family]));
  const ctaById = new Map(ctaFamilies.map((family) => [family.id, family]));
  const objective = brief?.objective || "qualified";
  const preferredCta = ctaById.get(objectiveCtaFamily[objective]) || ctaFamilies[0];
  const preferredHero = (trafficHeroPriority[brief?.trafficSource || "mixed"] || [])
    .map((id) => heroById.get(id))
    .find(Boolean) || heroFamilies[0];
  const cooccurrences = [...(vertical?.cooccurrences || [])].sort(
    (left, right) => right.count - left.count || left.id.localeCompare(right.id),
  );
  const dominantPair = cooccurrences
    .map((pair) => ({ pair, hero: heroById.get(pair.heroId), cta: ctaById.get(pair.ctaId) }))
    .find((row) => row.hero && row.cta);
  const candidates: Array<{
    strategy: LandingEvidenceRecipe["strategy"];
    hero: LandingFamily;
    cta: LandingFamily;
  }> = [];
  if (dominantPair?.hero && dominantPair.cta) {
    candidates.push({ strategy: "dominant", hero: dominantPair.hero, cta: dominantPair.cta });
  } else {
    candidates.push({ strategy: "dominant", hero: heroFamilies[0], cta: ctaFamilies[0] });
  }
  candidates.push({ strategy: "intent", hero: preferredHero, cta: preferredCta });
  const usedHeroIds = new Set(candidates.map((candidate) => candidate.hero.id));
  const contrastHero = heroFamilies.find((family) => !usedHeroIds.has(family.id)) || heroFamilies[heroFamilies.length - 1];
  const contrastCta = ctaFamilies.find((family) => family.id !== candidates[0].cta.id) || preferredCta;
  candidates.push({ strategy: "contrast", hero: contrastHero, cta: contrastCta });

  const unique = new Map<string, (typeof candidates)[number]>();
  candidates.forEach((candidate) => unique.set(`${candidate.hero.id}-${candidate.cta.id}`, candidate));
  for (const hero of heroFamilies) {
    for (const cta of ctaFamilies) {
      if (unique.size >= 3) break;
      const id = `${hero.id}-${cta.id}`;
      if (!unique.has(id)) unique.set(id, { strategy: "contrast", hero, cta });
    }
  }

  return [...unique.values()].slice(0, 3).map(({ strategy, hero, cta }) => {
    const heroSettings = recipeHeroSettings[hero.id] || recipeHeroSettings.outcome;
    const ctaSettings = recipeCtaSettings[cta.id] || recipeCtaSettings.contact;
    const heroScope = verticalHeroIds.has(hero.id) ? "vertical" : "global";
    const ctaScope = verticalCtaIds.has(cta.id) ? "vertical" : "global";
    const cooccurrence = cooccurrences.find((row) => row.heroId === hero.id && row.ctaId === cta.id);
    const sourceGroups = {
      hero: hero.examples.slice(0, 3),
      cta: cta.examples.slice(0, 3),
      together: (cooccurrence?.examples || []).map((source) => ({
        companyId: source.companyId,
        name: source.name,
        text: `${source.headline} → ${source.primaryCta}`,
      })),
    };
    const sourceMap = new Map<string, { companyId: string; name: string; text: string }>();
    [sourceGroups.hero[0], sourceGroups.cta[0], ...sourceGroups.together, ...hero.examples, ...cta.examples]
      .filter(Boolean)
      .forEach((source) => {
      if (!sourceMap.has(source.companyId)) sourceMap.set(source.companyId, source);
    });
    const heroSampleBase = hero.sampleBase || vertical?.sampleSize || 0;
    const ctaSampleBase = cta.sampleBase || vertical?.sampleSize || 0;
    const sampleBase = Math.max(heroSampleBase, ctaSampleBase);
    const observedTogether = cooccurrence?.count || 0;
    const scopes = { hero: heroScope, cta: ctaScope } as const;
    const strategyLabel = {
      dominant: "Patrón dominante",
      intent: "Ajuste a tu intención",
      contrast: "Alternativa de contraste",
    }[strategy];
    const fitReason =
      strategy === "dominant"
        ? observedTogether
          ? `${observedTogether} empresas muestran juntas esta apertura y esta acción.`
          : "Combina las dos señales más visibles; úsala como control descriptivo."
        : strategy === "intent"
          ? `Prioriza ${objective === "qualified" ? "cualificación" : objective === "booking" ? "reserva" : objective === "quote" ? "propuesta" : "contacto"} y tráfico ${brief?.trafficSource || "mixto"}.`
          : "Introduce una ruta menos repetida para probar una diferencia interpretable.";
    const tradeoff =
      strategy === "dominant"
        ? "Familiar para el mercado, pero con menor diferenciación."
        : strategy === "intent"
          ? "Mejor encaje operativo; necesita que el destino y el formulario estén preparados."
          : "Más diferenciación; exige una prueba propia más clara.";
    return {
      id: `${strategy}-${hero.id}-${cta.id}`,
      label: `${hero.label} → ${cta.label}`,
      summary: `${hero.count} de ${hero.sampleBase || sampleBase} empresas muestran “${hero.label.toLocaleLowerCase("es")}” y ${cta.count} de ${cta.sampleBase || sampleBase} usan “${cta.label.toLocaleLowerCase("es")}”. Frecuencia observada; no es una tasa de conversión.`,
      architecture: strategy === "intent" && brief ? objectiveArchitecture[objective] : ctaSettings.architecture,
      angle: heroSettings.angle,
      variant: heroSettings.variant,
      ctaMode: ctaSettings.ctaMode,
      ctaLabel: ctaSettings.ctaLabel,
      heroFamily: hero,
      ctaFamily: cta,
      evidenceScope: scopes,
      strategy,
      strategyLabel,
      confidence: familyConfidence(hero, cta, observedTogether, scopes),
      fitReason,
      tradeoff,
      modules: [...heroSettings.modules, ctaSettings.module].filter(
        (module, index, values) => values.indexOf(module) === index,
      ),
      requirements: heroSettings.requirements,
      sources: [...sourceMap.values()].slice(0, 6),
      sourceGroups,
      observedTogether,
      sampleBase,
      heroSampleBase,
      ctaSampleBase,
      sectionSequence: buildSectionSequence(vertical, hero.id, cta.id),
      warnings: observedTogether
        ? []
        : ["Apertura y CTA se observan por separado; valida la combinación como experimento."],
    };
  });
};

export const destinationCompatible = (value: string, mode: LandingCtaMode) => {
  const text = value.trim();
  if (!text) return false;
  if (mode === "calendar") {
    try {
      return new URL(text).protocol === "https:";
    } catch {
      return false;
    }
  }
  if (/^https?:/i.test(text)) return false;
  const digits = text.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
};

/** Aplica decisiones de estrategia sin borrar datos aportados; readiness detecta incompatibilidades. */
export const applyEvidenceRecipe = (
  brief: LandingBrief,
  recipe: LandingEvidenceRecipe,
): LandingBrief => {
  if (brief.verticalId === "coches-motor" && brief.intent !== "vertical-default") return brief;
  return {
    ...brief,
    architecture: recipe.architecture,
    angle: recipe.angle,
    variant: recipe.variant,
    ctaMode: recipe.ctaMode,
    ctaLabel: recipe.ctaLabel,
    destination: brief.destination,
    activeRecipeId: recipe.id,
    evidencePlan: {
      recipeId: recipe.id,
      strategy: recipe.strategy,
      strategyLabel: recipe.strategyLabel,
      heroFamilyId: recipe.heroFamily.id,
      heroFamilyLabel: recipe.heroFamily.label,
      ctaFamilyId: recipe.ctaFamily.id,
      ctaFamilyLabel: recipe.ctaFamily.label,
      confidence: recipe.confidence,
      observedTogether: recipe.observedTogether,
      sampleBase: recipe.sampleBase,
      heroSampleBase: recipe.heroSampleBase,
      ctaSampleBase: recipe.ctaSampleBase,
      sectionSequence: recipe.sectionSequence,
      sourceCompanies: recipe.sources.map((source) => ({
        companyId: source.companyId,
        name: source.name,
      })),
    },
  };
};

export const buildStrategyRecommendation = (
  brief: LandingBrief,
  vertical?: LandingVerticalIntelligence | null,
): LandingStrategyRecommendation => {
  const trafficAngle: Record<LandingTrafficSource, LandingAngle> = {
    meta: brief.awareness === "cold" ? "outcome" : "authority",
    google: brief.zone && brief.zone !== "tu zona" ? "territory" : "outcome",
    organic: "authority",
    outbound: "authority",
    mixed: vertical?.study?.recommendedDefaults.angle || "outcome",
  };
  const ctaId = objectiveCtaFamily[brief.objective];
  const cta = recipeCtaSettings[ctaId] || recipeCtaSettings.audit;
  const confidence = vertical?.study?.confidence || "low";
  const coverage = vertical?.study?.coverage.ctaCoveragePct || 0;
  const objectiveFormFields: Record<LandingObjective, number> = {
    qualified: 7,
    booking: 4,
    quote: 6,
    contact: 3,
  };
  const observedFormFields = vertical?.study?.recommendedDefaults.formFields ?? vertical?.medianFormFields;
  const suggestedFormFields = Math.max(
    3,
    Math.min(8, Math.round(observedFormFields || objectiveFormFields[brief.objective])),
  );
  const compatibility = Math.min(
    96,
    58 + (confidence === "high" ? 18 : confidence === "medium" ? 10 : 3) + Math.round(coverage / 8),
  );
  const dominantHero = vertical?.study?.dominantHero || null;
  const dominantCta = vertical?.study?.dominantCta || null;
  const referenceMap = new Map<string, { companyId: string; name: string }>();
  [
    ...(dominantHero?.examples || []),
    ...(dominantCta?.examples || []),
    ...(vertical?.examples || []).slice(0, 4).map((example) => ({
      companyId: example.companyId,
      name: example.name,
    })),
  ].forEach((source) => {
    if (source?.companyId && !referenceMap.has(source.companyId)) {
      referenceMap.set(source.companyId, { companyId: source.companyId, name: source.name });
    }
  });
  const recommendedCtaFamily = objectiveCtaFamily[brief.objective];
  const recommendedHeroFamily = trafficHeroPriority[brief.trafficSource]?.[0] || "outcome";
  return {
    architecture: objectiveArchitecture[brief.objective],
    angle: trafficAngle[brief.trafficSource],
    ctaMode: cta.ctaMode,
    ctaLabel: cta.ctaLabel,
    compatibility,
    suggestedFormFields,
    reasons: [
      `El objetivo «${brief.objective === "qualified" ? "solicitud cualificada" : brief.objective === "booking" ? "reserva" : brief.objective === "quote" ? "presupuesto" : "contacto"}» define la arquitectura y la acción principal.`,
      `El tráfico ${brief.trafficSource} y la temperatura ${brief.awareness} orientan la apertura del hero.`,
      vertical?.study
        ? `La recomendación usa una muestra ${confidence === "high" ? "amplia" : confidence === "medium" ? "suficiente" : "exploratoria"} de ${vertical.sampleSize} empresas.`
        : "La recomendación usa patrones globales hasta disponer de estudio vertical.",
    ],
    risks: [
      ...(coverage < 35 ? ["La cobertura de CTA del vertical es baja; contrasta el destino manualmente."] : []),
      ...(confidence === "low" ? ["Muestra pequeña: trata esta configuración como hipótesis exploratoria."] : []),
    ],
    evidencePlan: {
      recipeId: `recommended-${brief.verticalId}-${brief.objective}-${brief.trafficSource}`,
      strategy: "recommended",
      strategyLabel: "Blueprint recomendado",
      heroFamilyId: recommendedHeroFamily,
      heroFamilyLabel: dominantHero?.label || "Apertura orientada a intención",
      ctaFamilyId: recommendedCtaFamily,
      ctaFamilyLabel: dominantCta?.label || "Acción alineada con el objetivo",
      confidence,
      observedTogether: 0,
      sampleBase: vertical?.sampleSize || 0,
      heroSampleBase: dominantHero?.sampleBase || vertical?.sampleSize || 0,
      ctaSampleBase: dominantCta?.sampleBase || vertical?.sampleSize || 0,
      sectionSequence: buildSectionSequence(vertical, recommendedHeroFamily, recommendedCtaFamily),
      sourceCompanies: [...referenceMap.values()].slice(0, 6),
    },
  };
};

export const applyStrategyRecommendation = (
  brief: LandingBrief,
  recommendation: LandingStrategyRecommendation,
): LandingBrief => {
  if (brief.verticalId === "coches-motor" && brief.intent !== "vertical-default") return brief;
  return {
    ...brief,
    architecture: recommendation.architecture,
    angle: recommendation.angle,
    ctaMode: recommendation.ctaMode,
    ctaLabel: recommendation.ctaLabel,
    formFieldsTarget: recommendation.suggestedFormFields || brief.formFieldsTarget,
    destination: brief.destination,
    activeRecipeId: "",
    evidencePlan: recommendation.evidencePlan,
  };
};

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const capitalize = (value: string) => {
  const text = clean(value);
  return text ? text.charAt(0).toLocaleUpperCase("es") + text.slice(1) : "";
};
const esc = (value: string) =>
  clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const jsLiteral = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");
const safeUrl = (value: string) => {
  const text = clean(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};
const safeLeadEndpoint = (value: string) => {
  const text = clean(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};
const safeGtmId = (value: string) => /^GTM-[A-Z0-9]{4,}$/i.test(clean(value)) ? clean(value).toUpperCase() : "";
const safeColor = (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : "#1769e0");
const singular = (value: string) => {
  const text = clean(value);
  if (/iones$/i.test(text)) return text.replace(/iones$/i, "ión");
  if (/udes$/i.test(text)) return text.replace(/udes$/i, "ud");
  if (/ces$/i.test(text)) return text.replace(/ces$/i, "z");
  return text.replace(/s$/i, "") || text;
};

export const defaultBrief = (verticalId = "clinicas-salud"): LandingBrief => {
  const preset = VERTICAL_PRESETS[verticalId] || VERTICAL_PRESETS.generalista;
  return {
    architecture:
      verticalId === "directorios-marketplaces"
        ? "marketplace"
        : verticalId === "b2b-sdr" || verticalId === "legal"
          ? "diagnostic"
          : "local",
    angle: "outcome",
    tone: "consultative",
    variant: "a",
    objective: verticalId === "belleza-bienestar" || verticalId === "hosteleria-turismo" ? "booking" : "qualified",
    trafficSource: "mixed",
    awareness: "cold",
    depth: "standard",
    intent: "vertical-default",
    formFieldsTarget: 5,
    activeRecipeId: "",
    evidencePlan: null,
    verticalId,
    brand: "RedVitalia",
    zone: "tu zona",
    service: preset.service,
    audience: preset.audience,
    unit: preset.unit,
    pain: preset.pain,
    result: preset.result,
    filter: preset.filter,
    offer: preset.offer,
    proof: "",
    price: "",
    guarantee: "",
    ctaLabel: "",
    ctaMode: "whatsapp",
    destination: "",
    accent: "#1769e0",
    logoUrl: "",
    heroImageUrl: "",
    privacyUrl: "",
    cookiesUrl: "",
    legalName: "",
    legalId: "",
    leadEndpoint: "",
    leadEndpointVerified: false,
    gtmId: "",
    trackingVerified: false,
  };
};

export const applyVerticalPreset = (brief: LandingBrief, verticalId: string): LandingBrief => {
  const preset = VERTICAL_PRESETS[verticalId] || VERTICAL_PRESETS.generalista;
  return {
    ...brief,
    verticalId,
    architecture:
      verticalId === "directorios-marketplaces"
        ? "marketplace"
        : verticalId === "b2b-sdr" || verticalId === "legal"
          ? "diagnostic"
          : "local",
    audience: preset.audience,
    unit: preset.unit,
    service: preset.service,
    pain: preset.pain,
    result: preset.result,
    filter: preset.filter,
    offer: preset.offer,
    ctaLabel: "",
    objective: verticalId === "belleza-bienestar" || verticalId === "hosteleria-turismo" ? "booking" : "qualified",
    formFieldsTarget: verticalId === "belleza-bienestar" || verticalId === "hosteleria-turismo" ? 4 : 5,
    activeRecipeId: "",
    evidencePlan: null,
    intent: "vertical-default",
    leadEndpointVerified: false,
    trackingVerified: false,
  };
};

type AutomotiveIntentPlaybook = {
  label: string;
  route: string;
  eventName: string;
  service: string;
  audience: string;
  pain: string;
  result: string;
  filter: string;
  offer: string;
  ctaLabel: string;
  formFields: string[];
  accepted: string[];
  rejected: string[];
  steps: Array<{ title: string; text: string }>;
  faqs: Array<{ question: string; answer: string }>;
  referenceIds: string[];
};

export const AUTOMOTIVE_MARKET_REFERENCES = [
  {
    id: "export-coches-financiados",
    name: "Export Coches Financiados",
    url: "https://exportcochesfinanciados.com/",
    market: "España",
    language: "es",
    reviewedAt: "2026-08-27",
    observedSections: ["formulario inicial", "casos", "proceso", "opiniones", "FAQ"],
    observed: "Formulario de vehículo y deuda en el primer bloque; después ventajas, casuística, proceso, opiniones y FAQ.",
  },
  {
    id: "oto-exportacion",
    name: "OtoExportación",
    url: "https://otoexportacion.es/",
    market: "España",
    language: "es",
    reviewedAt: "2026-08-27",
    observedSections: ["tasación", "filtro del vehículo", "proceso", "prueba social", "FAQ"],
    observed: "Tasación arriba, filtro por estado del coche, proceso, prueba social y preguntas sobre documentación y deuda.",
  },
  {
    id: "valorami-auto-deuda",
    name: "Valórame Auto · coche con deuda",
    url: "https://www.valoramiauto.com/vender-coche-con-deuda/",
    market: "España",
    language: "es",
    reviewedAt: "2026-08-27",
    observedSections: ["situación", "opciones", "cancelación", "valoración", "contacto"],
    observed: "Promesa prudente: evaluar situación, explicar opciones y gestionar cancelación si resulta posible.",
  },
  {
    id: "reserva-y-embargo",
    name: "Reserva y Embargo",
    url: "https://www.reservayembargo.es/",
    market: "España",
    language: "es",
    reviewedAt: "2026-08-27",
    observedSections: ["formulario inicial", "tipos de carga", "proceso", "territorio", "testimonios"],
    observed: "Formulario compacto en primer viewport, explicación de tipos de carga, proceso, territorio y testimonios.",
  },
  {
    id: "paga-tu-coche",
    name: "PagaTuCoche",
    url: "https://pagatucoche.com/",
    market: "España",
    language: "es",
    reviewedAt: "2026-08-27",
    observedSections: ["situaciones", "proceso", "alternativas", "objeciones", "pago"],
    observed: "Segmenta situaciones, explica cuatro pasos, compara alternativas y responde objeciones legales y de pago.",
  },
  {
    id: "compro-coches-export",
    name: "Compro Coches Export",
    url: "https://comprocochesexport.es/",
    market: "España",
    language: "es",
    reviewedAt: "2026-08-27",
    observedSections: ["alcance", "gestión", "responsabilidad", "deuda", "contacto"],
    observed: "Aclara de forma visible qué gestión realiza y qué deuda continúa siendo responsabilidad del titular.",
  },
] as const;

export const AUTOMOTIVE_INTENTS: Record<Exclude<LandingIntent, "vertical-default">, AutomotiveIntentPlaybook> = {
  "reserva-dominio": {
    label: "Reserva de dominio",
    route: "/vender-coche-reserva-dominio/",
    eventName: "lead_form_submit_reserva",
    service: "valoración de coches con reserva de dominio",
    audience: "propietarios que quieren vender un coche con reserva de dominio o deuda pendiente",
    pain: "cancelar deuda o iniciar trámites sin saber antes si la operación tiene sentido",
    result: "saber si la venta es viable antes de cancelar nada a ciegas",
    filter: "vehículo, kilometraje, financiera, deuda pendiente, titularidad y provincia",
    offer: "Revisamos el vehículo y la deuda pendiente, calculamos la viabilidad de la operación y explicamos el siguiente paso con la financiera.",
    ctaLabel: "Comprobar si mi venta es viable",
    formFields: ["vehicle", "year", "mileage", "debt", "financeCompany", "zone", "phone"],
    accepted: ["Reserva de dominio activa", "Deuda pendiente con financiera", "Propietario que quiere vender", "Vehículo con documentación revisable"],
    rejected: ["Personas que buscan comprar coches baratos", "Consultas jurídicas sin intención de venta", "Vehículos sin titularidad acreditable"],
    steps: [
      { title: "Envías los datos", text: "Vehículo, kilómetros, financiera y deuda aproximada." },
      { title: "Revisamos viabilidad", text: "Contrastamos valor, deuda y situación documental antes de prometer una oferta." },
      { title: "Recibes un siguiente paso", text: "Te explicamos si encaja y cómo se resolvería la reserva si avanzas." },
      { title: "Firma, pago y gestión", text: "Solo si aceptas y la documentación permite completar la operación." },
    ],
    faqs: [
      { question: "¿Tengo que cancelar la reserva antes?", answer: "No conviene cancelar a ciegas. Primero revisamos deuda, vehículo y documentación para saber si la venta puede ser viable." },
      { question: "¿Qué pasa si debo más de lo que vale el coche?", answer: "Hay que calcular la diferencia real. Te diremos si existe una vía viable o si la operación no encaja antes de pedirte más trámites." },
      { question: "¿Quién habla con la financiera?", answer: "Depende del caso y de la entidad. Tras la revisión te explicamos qué gestiona cada parte y qué documentos hacen falta." },
      { question: "¿Recibiré una oferta al enviar el formulario?", answer: "El formulario inicia una revisión. No podemos prometer una oferta hasta comprobar el vehículo, la deuda y la titularidad." },
    ],
    referenceIds: ["export-coches-financiados", "valorami-auto-deuda", "reserva-y-embargo", "paga-tu-coche"],
  },
  "embargo-precinto": {
    label: "Embargo o precinto",
    route: "/vender-coche-embargado/",
    eventName: "lead_form_submit_embargo",
    service: "revisión de coches con embargo o precinto",
    audience: "propietarios que quieren vender un coche con embargo, precinto o anotación administrativa",
    pain: "recibir respuestas genéricas sin que nadie revise el tipo de embargo y la titularidad",
    result: "obtener una respuesta clara sobre la viabilidad de vender el coche embargado",
    filter: "vehículo, tipo e importe del embargo, titularidad, provincia y documentación disponible",
    offer: "Revisamos el tipo de embargo o precinto y la documentación antes de decir si la operación puede avanzar.",
    ctaLabel: "Revisar mi caso de embargo",
    formFields: ["vehicle", "year", "mileage", "embargoType", "amount", "ownership", "phone"],
    accepted: ["Embargo administrativo o judicial", "Precinto o anotación que pueda documentarse", "Propietario con intención real de vender", "Importe aproximado conocido o por confirmar"],
    rejected: ["Búsqueda de coches de subasta", "Asesoría legal sin intención de venta", "Vehículo robado o sin titularidad", "Promesas de compra sin revisar la carga"],
    steps: [
      { title: "Identificamos la carga", text: "Tipo de embargo, organismo, importe aproximado y titularidad." },
      { title: "Revisamos el coche", text: "Valor, documentación y límites reales de la operación." },
      { title: "Confirmamos viabilidad", text: "Te decimos qué se puede hacer y qué no antes de prometer un precio." },
      { title: "Formalizamos si encaja", text: "Firma, pago y gestión según las condiciones comprobadas." },
    ],
    faqs: [
      { question: "¿Se puede vender un coche con embargo?", answer: "Depende del tipo de embargo, su importe, la titularidad y la forma de levantar o gestionar la carga. Por eso lo revisamos antes de prometer una compra." },
      { question: "¿Esta página vende coches de subasta?", answer: "No. Está dirigida a propietarios que quieren vender su propio vehículo." },
      { question: "¿Y si el coche tiene un precinto?", answer: "Un precinto puede cambiar por completo la viabilidad. Indícalo en el formulario para que el caso se revise por la ruta adecuada." },
      { question: "¿Qué documentos pueden pedirme?", answer: "Después del primer filtro pueden solicitarse permiso de circulación, ficha técnica, acreditación de titularidad y documentación de la carga." },
    ],
    referenceIds: ["reserva-y-embargo", "oto-exportacion", "paga-tu-coche", "compro-coches-export"],
  },
  "financiado-pendiente": {
    label: "Financiación pendiente",
    route: "/vender-coche-financiado/",
    eventName: "lead_form_submit_financiado",
    service: "valoración de coches con financiación pendiente",
    audience: "propietarios que quieren vender un coche financiado y no saben si existe reserva de dominio",
    pain: "hablar de precio sin calcular antes la deuda neta y las condiciones de la financiera",
    result: "conocer la viabilidad y el importe neto orientativo antes de decidir",
    filter: "vehículo, kilómetros, financiera o tipo de préstamo, deuda aproximada, provincia y titularidad",
    offer: "Revisamos financiación, posible reserva y valor del vehículo antes de plantear una operación neta.",
    ctaLabel: "Calcular la viabilidad de mi coche",
    formFields: ["vehicle", "year", "mileage", "financeCompany", "debt", "zone", "phone"],
    accepted: ["Préstamo o financiación pendiente", "Reserva desconocida", "Propietario que quiere vender", "Deuda aproximada disponible"],
    rejected: ["Solicitud de nueva financiación", "Consulta sin vehículo concreto", "Promesa de importe neto sin revisar deuda"],
    steps: [
      { title: "Describes la financiación", text: "Entidad, deuda aproximada y datos del vehículo." },
      { title: "Comprobamos el escenario", text: "Diferenciamos préstamo, reserva y venta ordinaria." },
      { title: "Calculamos el neto", text: "Valoramos qué quedaría después de atender la deuda, si el caso es viable." },
      { title: "Decides con claridad", text: "Solo se piden documentos adicionales si merece la pena avanzar." },
    ],
    faqs: [
      { question: "¿Financiado y reserva de dominio son lo mismo?", answer: "No siempre. Puede existir deuda sin una reserva activa o una reserva que todavía no se haya cancelado. La documentación permite distinguirlo." },
      { question: "¿Puedo vender si todavía pago cuotas?", answer: "Puede ser posible, pero primero hay que revisar deuda, contrato, valor del coche y restricciones registrales." },
      { question: "¿Qué importe recibiría yo?", answer: "El importe neto depende del valor aceptado y de la deuda que deba atenderse. No debe prometerse antes de revisar ambos datos." },
      { question: "¿Qué documentos se revisan después?", answer: "Normalmente contrato o certificado de deuda, permiso de circulación, ficha técnica y acreditación de titularidad." },
    ],
    referenceIds: ["export-coches-financiados", "valorami-auto-deuda", "oto-exportacion", "paga-tu-coche"],
  },
  "con-cargas": {
    label: "No sé qué carga tiene",
    route: "/vender-coche-con-cargas/",
    eventName: "lead_form_submit_con_cargas",
    service: "diagnóstico de coches con cargas",
    audience: "propietarios que quieren vender y no saben si el coche tiene reserva, embargo, precinto o financiación pendiente",
    pain: "no saber qué anotación tiene el vehículo ni a qué trámite afecta",
    result: "identificar la ruta correcta y saber qué información falta para valorar la venta",
    filter: "vehículo, carga conocida o desconocida, importe aproximado, titularidad, provincia y teléfono",
    offer: "Clasificamos el tipo de carga y enviamos el caso a la revisión correcta antes de hablar de una oferta.",
    ctaLabel: "Identificar mi caso",
    formFields: ["vehicle", "year", "mileage", "chargeType", "amount", "zone", "phone"],
    accepted: ["Reserva de dominio", "Embargo o precinto", "Financiación pendiente", "Carga desconocida"],
    rejected: ["Compra de coches de subasta", "Asesoría jurídica sin intención de venta", "Vehículo sin titularidad acreditable"],
    steps: [
      { title: "Eliges lo que sabes", text: "Reserva, embargo, financiación o «no lo sé»." },
      { title: "Clasificamos el caso", text: "Pedimos solo la información necesaria para la ruta correcta." },
      { title: "Revisamos viabilidad", text: "Vehículo, titularidad, importe y documentación disponible." },
      { title: "Te damos un siguiente paso", text: "Una respuesta clara sin prometer una compra antes de comprobar el caso." },
    ],
    faqs: [
      { question: "¿Y si no sé qué carga tiene el coche?", answer: "Selecciona «No lo sé» y describe cualquier carta, anotación o deuda que conozcas. El objetivo inicial es clasificar el caso." },
      { question: "¿Todas las cargas permiten vender?", answer: "No. La viabilidad depende del tipo, importe, titularidad y documentación. La revisión evita iniciar trámites que no llevan a una operación." },
      { question: "¿Tengo que pagar algo por enviar los datos?", answer: "El envío del formulario no autoriza ningún cobro. Cualquier coste o condición adicional debe comunicarse y aceptarse antes de avanzar." },
      { question: "¿Cuánto tarda la revisión?", answer: "El tiempo depende de la documentación y del tipo de carga. Tras recibir los datos, el equipo confirmará el plazo aplicable al caso." },
    ],
    referenceIds: ["paga-tu-coche", "reserva-y-embargo", "compro-coches-export", "oto-exportacion"],
  },
};

export const applyAutomotiveIntent = (
  brief: LandingBrief,
  intent: LandingIntent,
): LandingBrief => {
  if (intent === "vertical-default") return { ...brief, intent, evidencePlan: null, activeRecipeId: "" };
  const playbook = AUTOMOTIVE_INTENTS[intent];
  const references = AUTOMOTIVE_MARKET_REFERENCES.filter((reference) =>
    playbook.referenceIds.includes(reference.id),
  );
  return {
    ...brief,
    verticalId: "coches-motor",
    intent,
    architecture: "diagnostic",
    angle: "outcome",
    objective: "qualified",
    trafficSource: "google",
    awareness: "hot",
    depth: "extended",
    formFieldsTarget: 7,
    service: playbook.service,
    audience: playbook.audience,
    pain: playbook.pain,
    result: playbook.result,
    filter: playbook.filter,
    offer: playbook.offer,
    ctaLabel: playbook.ctaLabel,
    leadEndpointVerified: false,
    trackingVerified: false,
    activeRecipeId: "",
    evidencePlan: {
      recipeId: `automotive-${intent}`,
      strategy: "intent",
      strategyLabel: "Intención exacta + mercado observado",
      heroFamilyId: "outcome",
      heroFamilyLabel: "Situación concreta y siguiente paso",
      ctaFamilyId: "audit",
      ctaFamilyLabel: "Revisión de viabilidad",
      confidence: "medium",
      observedTogether: 0,
      sampleBase: AUTOMOTIVE_MARKET_REFERENCES.length,
      heroSampleBase: AUTOMOTIVE_MARKET_REFERENCES.length,
      ctaSampleBase: AUTOMOTIVE_MARKET_REFERENCES.length,
      sectionSequence: ["qualification", "mechanism", "problem", "offer", "proof", "faq", "pricing", "guarantee"],
      sourceCompanies: references.map((reference) => ({
        companyId: reference.id,
        name: reference.name,
        url: reference.url,
      })),
    },
  };
};

const headlineFor = (brief: LandingBrief) => {
  const zone = clean(brief.zone) || "tu zona";
  const result = clean(brief.result) || "más oportunidades que encajan";
  const service = clean(brief.service) || "captación de oportunidades";
  if (brief.variant === "b")
    return `Deja atrás ${clean(brief.pain) || "la captación imprevisible"}`;
  if (brief.angle === "territory") return `Comprueba el potencial de ${service} en ${zone}`;
  if (brief.angle === "speed") return `Convierte cada solicitud en una conversación mientras aún importa`;
  if (brief.angle === "risk") return `Evalúa ${service} con condiciones claras antes de invertir`;
  if (brief.angle === "authority") return `${capitalize(service)} para ${clean(brief.audience) || "negocios que quieren crecer"}`;
  return `${capitalize(result)} en ${zone}`;
};

const subheadlineFor = (brief: LandingBrief) => {
  if (brief.variant === "b") return `${capitalize(brief.result)} mediante un proceso visible de filtro, entrega y seguimiento.`;
  if (brief.tone === "direct") return `${capitalize(brief.offer)} Sin rodeos: sabrás qué entra, qué se mide y cuál es el siguiente paso.`;
  if (brief.tone === "premium") return `${capitalize(brief.offer)} Una experiencia cuidada desde el primer contacto hasta la conversación comercial.`;
  return `${capitalize(brief.offer)} Alcance, responsabilidades y medición quedan claros antes de lanzar.`;
};

const automotiveSubheadlineFor = (brief: LandingBrief, playbook: AutomotiveIntentPlaybook) => {
  const offer = capitalize(playbook.offer);
  if (brief.variant === "b") return `${offer} Antes de cancelar, firmar o asumir un coste, sabrás qué documentación y qué siguiente paso requiere tu caso.`;
  if (brief.tone === "direct") return `${offer} Una respuesta basada en vehículo, carga y documentación disponible; sin prometer una compra antes de comprobarlo.`;
  if (brief.tone === "premium") return `${offer} Revisamos cada condición con criterio y te explicamos con precisión si merece la pena avanzar.`;
  return `${offer} Primero aclaramos la viabilidad; después te explicamos condiciones, responsables y siguiente paso.`;
};

const ctaFor = (brief: LandingBrief) => {
  if (clean(brief.ctaLabel)) return clean(brief.ctaLabel);
  if (brief.architecture === "booking") return "Reservar una primera conversación";
  if (brief.architecture === "pricing") return "Solicitar propuesta y condiciones";
  if (brief.architecture === "diagnostic") return "Solicitar diagnóstico de encaje";
  return `Comprobar encaje en ${clean(brief.zone) || "mi zona"}`;
};

export const landingCopyPreview = (brief: LandingBrief) => ({
  headline: headlineFor(brief),
  subheadline: subheadlineFor(brief),
  cta: ctaFor(brief),
});

export const landingReadiness = (brief: LandingBrief) => {
  const sensitiveClaim = /\b(?:\d+(?:[.,]\d+)?|garant|exclusiv|sin permanencia|no pagas|resultado asegurado|en \d+ (?:d[ií]as|semanas|meses))\b/i.test(
    `${brief.result} ${brief.guarantee} ${brief.ctaLabel}`,
  );
  const concreteEvidence =
    clean(brief.proof).length >= 20 &&
    /\b(?:caso|fuente|reseña|cliente|empresa|periodo|per[ií]odo|entre|durante|https?:\/\/|\d{2,})\b/i.test(brief.proof);
  const concreteGuarantee =
    clean(brief.guarantee).length >= 28 &&
    /\b(?:d[ií]as|semanas|meses|contrato|remedio|reembolso|contin[uú]a|excluye|condiciones)\b/i.test(brief.guarantee);
  const authorityRequiresProof = brief.angle === "authority";
  const automotiveRequiresIntent = brief.verticalId === "coches-motor";
  const expectedArchitecture = objectiveArchitecture[brief.objective];
  const minimumFormFields: Record<LandingObjective, number> = {
    qualified: 5,
    booking: 4,
    quote: 5,
    contact: 3,
  };
  const checks = [
    { id: "audience", label: "Público definido", ok: clean(brief.audience).length >= 12, weight: 10, severity: "important", section: "message" },
    { id: "offer", label: "Oferta concreta", ok: clean(brief.offer).length >= 24, weight: 12, severity: "important", section: "evidence" },
    { id: "result", label: "Resultado comprensible", ok: clean(brief.result).length >= 12 && clean(brief.result).length <= 170, weight: 12, severity: "important", section: "message" },
    { id: "filter", label: "Criterios de cualificación", ok: clean(brief.filter).length >= 12, weight: 8, severity: "important", section: "evidence" },
    { id: "destination", label: "Destino compatible con el CTA", ok: destinationCompatible(brief.destination, brief.ctaMode), weight: 12, severity: "blocker", section: "conversion" },
    { id: "endpoint", label: "Endpoint HTTPS configurado", ok: Boolean(safeLeadEndpoint(brief.leadEndpoint)), weight: 14, severity: "blocker", section: "conversion" },
    { id: "endpoint-verified", label: "Envío real comprobado con respuesta 2xx", ok: Boolean(brief.leadEndpointVerified), weight: 10, severity: "blocker", section: "conversion" },
    { id: "proof", label: authorityRequiresProof ? "Autoridad respaldada" : "Prueba identificable", ok: !authorityRequiresProof || concreteEvidence, weight: 10, severity: authorityRequiresProof ? "blocker" : "opportunity", section: "evidence" },
    { id: "legal", label: "Política de privacidad", ok: Boolean(safeUrl(brief.privacyUrl)), weight: 12, severity: "blocker", section: "conversion" },
    { id: "identity", label: "Responsable legal identificado", ok: clean(brief.legalName).length >= 3, weight: 10, severity: "blocker", section: "conversion" },
    { id: "tracking", label: "Medición conectada con Google Tag Manager", ok: Boolean(safeGtmId(brief.gtmId)), weight: 10, severity: "blocker", section: "conversion" },
    { id: "tracking-verified", label: "Evento de conversión comprobado", ok: Boolean(brief.trackingVerified), weight: 8, severity: "blocker", section: "conversion" },
    { id: "cookies", label: "Cookies y consentimiento analítico", ok: Boolean(safeUrl(brief.cookiesUrl)), weight: 6, severity: "blocker", section: "conversion" },
    { id: "intent", label: "Intención de campaña definida", ok: !automotiveRequiresIntent || brief.intent !== "vertical-default", weight: 12, severity: automotiveRequiresIntent ? "blocker" : "opportunity", section: "strategy" },
    { id: "blueprint", label: "Blueprint conectado a evidencia", ok: Boolean(brief.evidencePlan), weight: 6, severity: automotiveRequiresIntent ? "blocker" : "warning", section: "strategy" },
    {
      id: "claim",
      label: "Claim sensible respaldado",
      ok: !sensitiveClaim || concreteEvidence || concreteGuarantee,
      weight: 10,
      severity: "blocker",
      section: "evidence",
    },
    { id: "price", label: "Precio para arquitectura comercial", ok: brief.architecture !== "pricing" || clean(brief.price).length >= 5, weight: 8, severity: brief.architecture === "pricing" ? "blocker" : "opportunity", section: "evidence" },
    { id: "strategy", label: "Arquitectura alineada con el objetivo", ok: brief.architecture === expectedArchitecture || brief.objective === "qualified", weight: 6, severity: "warning", section: "strategy" },
    { id: "form", label: "Formulario acorde al objetivo", ok: brief.formFieldsTarget >= minimumFormFields[brief.objective], weight: 6, severity: "warning", section: "strategy" },
  ];
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const passedWeight = checks.filter((check) => check.ok).reduce((sum, check) => sum + check.weight, 0);
  const blockers = checks.filter((check) => !check.ok && check.severity === "blocker");
  const warnings = checks.filter((check) => !check.ok && check.severity !== "blocker");
  return {
    checks,
    passed: checks.filter((check) => check.ok).length,
    total: checks.length,
    score: Math.round((passedWeight / totalWeight) * 100),
    blockers,
    warnings,
    publishable: blockers.length === 0,
  };
};

export const buildLegacyLandingHtml = (brief: LandingBrief) => {
  const rawService = clean(brief.service || "captación de oportunidades");
  const rawDestination = clean(brief.destination);
  const brand = esc(brief.brand || "Tu marca");
  const zone = esc(brief.zone || "tu zona");
  const service = esc(rawService);
  const audience = esc(brief.audience || "negocios con capacidad para crecer");
  const unit = esc(brief.unit || "oportunidades");
  const pain = esc(brief.pain || "una captación difícil de prever");
  const result = esc(brief.result || "más conversaciones comerciales con encaje");
  const filter = esc(brief.filter || "necesidad, ubicación, plazo y encaje");
  const offer = esc(brief.offer || "Diagnóstico, campaña, cualificación y entrega trazable.");
  const proof = esc(brief.proof);
  const price = esc(brief.price);
  const guarantee = esc(brief.guarantee);
  const headline = esc(headlineFor(brief));
  const subheadline = esc(subheadlineFor(brief));
  const cta = esc(ctaFor(brief));
  const accent = safeColor(brief.accent);
  const logoUrl = safeUrl(brief.logoUrl);
  const heroImageUrl = safeUrl(brief.heroImageUrl);
  const privacyUrl = safeUrl(brief.privacyUrl);
  const destinationUrl = brief.ctaMode === "calendar" && destinationCompatible(rawDestination, "calendar")
    ? safeUrl(rawDestination)
    : "";
  const phone = brief.ctaMode !== "calendar" && destinationCompatible(rawDestination, brief.ctaMode)
    ? rawDestination.replace(/\D/g, "")
    : "";
  const destination =
    brief.ctaMode === "calendar"
      ? destinationUrl || "#lead-form"
      : brief.ctaMode === "phone"
        ? phone
          ? `tel:+${phone}`
          : "#lead-form"
        : "#lead-form";
  const logo = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${brand}" class="brand-logo">`
    : `<span class="brand-mark">${brand.slice(0, 2).toUpperCase()}</span><b>${brand}</b>`;
  const visual = heroImageUrl
    ? `<figure class="hero-visual"><img src="${esc(heroImageUrl)}" alt="${service} en ${zone}"></figure>`
    : `<aside class="fit-card"><span>ANTES DE EMPEZAR</span><h2>Qué dejamos definido</h2><ul><li>Público y zona de trabajo</li><li>Filtro: ${filter}</li><li>Responsable y velocidad de respuesta</li><li>Métrica y siguiente decisión</li></ul></aside>`;
  const proofSection = proof
    ? `<section class="proof section"><div class="wrap"><p class="eyebrow">PRUEBA IDENTIFICABLE</p><blockquote>${proof}</blockquote><p class="proof-note">Comprueba esta afirmación y conserva su fuente antes de publicar.</p></div></section>`
    : "";
  const priceSection = price
    ? `<section class="pricing section"><div class="wrap split"><div><p class="eyebrow">OFERTA Y CONDICIONES</p><h2>Que el precio no aparezca por sorpresa</h2><p>${offer}</p></div><article class="price-card"><span>INVERSIÓN</span><strong>${price}</strong><small>Confirma impuestos, duración, renovación, cancelación y qué queda incluido.</small><a class="button" href="${destination}">${cta}</a></article></div></section>`
    : "";
  const guaranteeSection = guarantee
    ? `<section class="guarantee section"><div class="wrap"><div><span>COMPROMISO PUBLICABLE</span><h2>Condiciones que se pueden comprobar</h2></div><p>${guarantee}</p></div></section>`
    : "";
  const privacy = privacyUrl
    ? `He leído la <a href="${esc(privacyUrl)}" target="_blank" rel="noopener">política de privacidad</a> y acepto que ${brand} contacte conmigo.`
    : `Acepto que ${brand} contacte conmigo para responder a esta solicitud.`;
  const fieldDefinitions: Record<string, string> = {
    name: `<label>Nombre<input id="name" name="name" autocomplete="name" required></label>`,
    phone: `<label>Teléfono<input id="phone" name="phone" inputmode="tel" autocomplete="tel" required></label>`,
    email: `<label>Email<input id="email" name="email" type="email" autocomplete="email"></label>`,
    company: `<label>Empresa<input id="company" name="company" autocomplete="organization"></label>`,
    service: `<label>Servicio prioritario<input id="service" name="service" value="${service}"></label>`,
    zone: `<label>Zona<input id="zone" name="zone" value="${zone}"></label>`,
    availability: `<label>Disponibilidad<input id="availability" name="availability" placeholder="Día, franja o fecha preferida"></label>`,
    budget: `<label>Presupuesto orientativo<input id="budget" name="budget" placeholder="Rango o límite previsto"></label>`,
    timeframe: `<label>Plazo de decisión<input id="timeframe" name="timeframe" placeholder="Ahora, 30 días, este trimestre…"></label>`,
    context: `<label class="wide">Qué quieres conseguir<textarea id="context" name="context" placeholder="Situación actual, prioridad y contexto útil"></textarea></label>`,
  };
  const formPlans: Record<LandingObjective, string[]> = {
    contact: ["name", "phone", "context", "zone", "company", "email", "service", "timeframe"],
    booking: ["name", "phone", "availability", "service", "zone", "context", "email", "company"],
    quote: ["name", "phone", "service", "zone", "budget", "context", "company", "email"],
    qualified: ["name", "phone", "company", "service", "zone", "context", "budget", "timeframe"],
  };
  const formFieldsTarget = Math.max(3, Math.min(8, Math.round(brief.formFieldsTarget || 5)));
  const formFields = formPlans[brief.objective]
    .slice(0, formFieldsTarget)
    .map((field) => fieldDefinitions[field])
    .join("");

  const sections = {
    problem: `<section class="section problem"><div class="wrap split"><div><p class="eyebrow">EL PROBLEMA REAL</p><h2>No necesitas más contactos sin contexto</h2></div><div><p>El coste no está solo en captar. Está en ${pain}.</p><p>Esta propuesta prioriza <strong>${result}</strong> y explica cómo se decide qué oportunidad encaja.</p></div></div></section>`,
    mechanism: `<section class="section mechanism" id="proceso"><div class="wrap"><p class="eyebrow">EL MECANISMO</p><h2>Un recorrido visible de principio a fin</h2><div class="steps"><article><i>01</i><h3>Definir</h3><p>Concretamos ${service}, público, zona, capacidad y la economía del test.</p></article><article><i>02</i><h3>Filtrar</h3><p>La solicitud recoge ${filter}; el criterio se aprueba antes de captar.</p></article><article><i>03</i><h3>Entregar y aprender</h3><p>Cada oportunidad llega con contexto. Revisamos respuesta, cita, asistencia y resultado.</p></article></div></div></section>`,
    qualification: `<section class="section qualification"><div class="wrap split"><div><p class="eyebrow">ENCAJE</p><h2>Esta propuesta es para ${audience}</h2><p>Antes de hablar, la página permite comprobar si servicio, zona y capacidad tienen sentido.</p></div><ul class="check-list"><li>Necesidad relacionada con ${service}</li><li>Datos suficientes para valorar el encaje</li><li>Zona dentro de la cobertura acordada</li><li>Capacidad real para atender más ${unit}</li></ul></div></section>`,
    offer: `<section class="section offer"><div class="wrap"><p class="eyebrow">QUÉ INCLUYE</p><h2>Una oferta que se entiende sin una reunión de una hora</h2><div class="offer-grid"><article><b>01 · Preparación</b><p>Mensaje, página, medición y criterios aprobados.</p></article><article><b>02 · Captación</b><p>${offer}</p></article><article><b>03 · Operación</b><p>Entrega, seguimiento y revisión del recorrido comercial.</p></article><article><b>04 · Decisión</b><p>Escalar, corregir o parar con datos comparables.</p></article></div></div></section>`,
  };
  const architectureSections: Record<LandingArchitecture, string> = {
    local: `<section class="section architecture-block local-block"><div class="wrap split"><div><p class="eyebrow">COBERTURA Y CAPACIDAD</p><h2>Primero zona y capacidad; después volumen</h2></div><div><p>La propuesta se limita a ${zone} y comprueba que existe capacidad real para atender más ${unit}. La cobertura nunca se presenta como exclusividad si no está pactada.</p></div></div></section>`,
    diagnostic: `<section class="section architecture-block diagnostic-block"><div class="wrap split"><div><p class="eyebrow">DIAGNÓSTICO</p><h2>La primera conversación debe producir una decisión</h2></div><div><p>Se revisan problema, datos disponibles, capacidad comercial y economía del test antes de recomendar un alcance. El objetivo no es agendar por agendar, sino confirmar encaje.</p></div></div></section>`,
    booking: `<section class="section architecture-block booking-block"><div class="wrap split"><div><p class="eyebrow">RESERVA</p><h2>Disponibilidad, preparación y siguiente paso sin fricción</h2></div><div><p>La página explica qué ocurrirá en la cita, cuánto contexto debe aportar el usuario y qué no queda confirmado hasta revisar la solicitud.</p></div></div></section>`,
    saas: `<section class="section architecture-block saas-block"><div class="wrap"><p class="eyebrow">PRODUCTO Y CAPACIDADES</p><h2>De la promesa a una demostración comprensible</h2><div class="offer-grid"><article><b>Problema</b><p>${pain}</p></article><article><b>Capacidad principal</b><p>${offer}</p></article><article><b>Datos e integración</b><p>Explica entradas, salidas, permisos y responsable de cada paso.</p></article><article><b>Prueba del producto</b><p>Demo, captura o caso identificable antes de pedir una decisión.</p></article></div></div></section>`,
    marketplace: `<section class="section architecture-block marketplace-block"><div class="wrap"><p class="eyebrow">SOLICITUD Y MATCHING</p><h2>Una petición clara antes de presentar proveedores</h2><div class="steps"><article><i>01</i><h3>Solicitar</h3><p>El usuario describe ${filter}.</p></article><article><i>02</i><h3>Comprobar</h3><p>Se valida cobertura, necesidad y datos de contacto.</p></article><article><i>03</i><h3>Conectar</h3><p>Se explica con quién se compartirán los datos y qué ocurre después.</p></article></div></div></section>`,
    pricing: `<section class="section architecture-block pricing-block"><div class="wrap split"><div><p class="eyebrow">ALCANCE COMPARABLE</p><h2>Precio, límites y condiciones antes del contacto</h2></div><div><p>${offer}</p><p>La comparación debe dejar visibles duración, inversión externa, renovación, cancelación y exclusiones.</p></div></div></section>`,
  };
  const orders: Record<LandingArchitecture, Array<keyof typeof sections>> = {
    local: ["problem", "mechanism", "qualification", "offer"],
    diagnostic: ["problem", "qualification", "mechanism", "offer"],
    booking: ["qualification", "mechanism", "offer", "problem"],
    saas: ["problem", "offer", "mechanism", "qualification"],
    marketplace: ["qualification", "mechanism", "problem", "offer"],
    pricing: ["problem", "offer", "mechanism", "qualification"],
  };
  const depthLimit = brief.depth === "short" ? 2 : brief.depth === "standard" ? 3 : 4;
  const orderedSections = orders[brief.architecture].slice(0, depthLimit).map((key) => sections[key]).join("");
  const faqItems = [
    `<details><summary>¿Qué cuenta como ${singular(unit)} con encaje?</summary><p>Se documenta usando ${filter}. También se acuerda cómo tratar duplicados, datos incorrectos y solicitudes fuera de zona.</p></details>`,
    `<details><summary>¿Qué resultado se mide?</summary><p>La página propone medir la cadena completa: solicitud, contacto, cita, asistencia y resultado comercial. No confunde una visita con una venta.</p></details>`,
    `<details><summary>¿Hay exclusividad territorial?</summary><p>Solo se ofrece si la zona, el alcance y la duración se confirman expresamente. Si no existe ese compromiso, no debe aparecer como claim.</p></details>`,
    `<details><summary>¿Existe permanencia o renovación automática?</summary><p>Duración, renovación y cancelación deben figurar en la propuesta y el contrato antes de cualquier pago.</p></details>`,
  ];
  const faqLimit = brief.depth === "short" ? 2 : brief.depth === "standard" ? 3 : 4;
  const faqSection = `<section class="faq section"><div class="wrap"><p class="eyebrow">PREGUNTAS CLAVE</p><h2>Lo que conviene aclarar antes de empezar</h2>${faqItems.slice(0, faqLimit).join("")}</div></section>`;
  const metaDescription = esc(`${capitalize(brief.result)} en ${brief.zone || "tu zona"}. ${brief.offer}`.slice(0, 155));
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Service",
    name: clean(brief.service),
    provider: { "@type": "Organization", name: clean(brief.brand) },
    areaServed: clean(brief.zone),
    audience: clean(brief.audience),
  }).replace(/</g, "\\u003c");
  const actionScript =
    brief.ctaMode === "whatsapp" && phone
      ? `var service=v('service')||${jsLiteral(rawService)};var intro='Hola, soy '+v('name')+(v('company')?' de '+v('company'):'')+'.';var message=[intro,v('zone')?'Zona: '+v('zone')+'.':'','Me interesa: '+service+'.',v('context')?'Contexto: '+v('context')+'.':'',v('availability')?'Disponibilidad: '+v('availability')+'.':'',v('budget')?'Presupuesto: '+v('budget')+'.':'',v('timeframe')?'Plazo: '+v('timeframe')+'.':'',v('phone')?'Mi teléfono: '+v('phone')+'.':'',utm()].filter(Boolean).join('\\n');location.href='https://wa.me/${phone}?text='+encodeURIComponent(message);`
      : brief.ctaMode === "calendar" && destinationUrl
        ? `window.open(${jsLiteral(destinationUrl)},'_blank','noopener');`
        : phone
          ? `location.href='tel:+${phone}';`
          : `alert('Configura el destino del formulario antes de publicar.');`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand} · ${service} en ${zone}</title><meta name="description" content="${metaDescription}">
<script type="application/ld+json">${schema}</script>
<style>
:root{--accent:${accent};--accent-soft:color-mix(in srgb,var(--accent) 9%,white);--ink:#122033;--muted:#5f6b7b;--line:#dce4ee;--paper:#f5f8fc;--white:#fff;--ok:#087c52;--shadow:0 22px 60px rgba(21,43,74,.12)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:#fff;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}a{color:inherit}.wrap{width:min(1120px,calc(100% - 40px));margin:auto}
.topbar{position:sticky;top:0;z-index:10;border-bottom:1px solid rgba(220,228,238,.85);background:rgba(255,255,255,.92);backdrop-filter:blur(14px)}.topbar .wrap{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:10px;text-decoration:none}.brand-logo{display:block;max-width:160px;max-height:38px}.brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--accent);color:#fff;font-weight:900}.topbar nav{display:flex;align-items:center;gap:24px}.topbar nav>a:not(.button){color:var(--muted);text-decoration:none;font-size:14px}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:12px;background:var(--accent);color:#fff;text-decoration:none;font-weight:800;box-shadow:0 10px 25px color-mix(in srgb,var(--accent) 24%,transparent);border:0;cursor:pointer}.button.secondary{background:#fff;color:var(--ink);border:1px solid var(--line);box-shadow:none}.hero{padding:88px 0 72px;background:radial-gradient(circle at 84% 8%,var(--accent-soft),transparent 36%),linear-gradient(180deg,#fff,var(--paper));overflow:hidden}.hero-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(300px,.72fr);gap:64px;align-items:center}.eyebrow{margin:0 0 12px;color:var(--accent);font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.hero h1{max-width:18ch;margin:0;font-size:clamp(40px,5.7vw,68px);line-height:1.02;letter-spacing:-.045em}.hero .lead{max-width:62ch;margin:22px 0 0;color:var(--muted);font-size:19px}.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.microcopy{margin:14px 0 0;color:var(--muted);font-size:12px}.fit-card,.hero-visual{margin:0;border:1px solid rgba(220,228,238,.9);border-radius:24px;background:rgba(255,255,255,.94);box-shadow:var(--shadow);overflow:hidden}.fit-card{padding:30px}.fit-card>span{color:var(--accent);font-size:11px;font-weight:900;letter-spacing:.12em}.fit-card h2{font-size:26px;line-height:1.15}.fit-card ul{display:grid;gap:13px;margin:22px 0 0;padding:0;list-style:none}.fit-card li{position:relative;padding-left:28px;color:var(--muted)}.fit-card li:before{content:'✓';position:absolute;left:0;color:var(--ok);font-weight:900}.hero-visual img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}
.section{padding:84px 0}.section h2{max-width:22ch;margin:0 0 18px;font-size:clamp(30px,4vw,48px);line-height:1.08;letter-spacing:-.035em}.section p{color:var(--muted);font-size:17px}.split{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:76px;align-items:start}.problem{background:#fff}.mechanism,.pricing{background:var(--paper)}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:36px}.steps article,.offer-grid article{border:1px solid var(--line);border-radius:18px;background:#fff;padding:24px}.steps i{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--accent-soft);color:var(--accent);font-style:normal;font-weight:900}.steps h3{margin:18px 0 8px}.steps p,.offer-grid p{margin:0;font-size:15px}.qualification{background:#0f1d2f;color:#fff}.qualification .eyebrow{color:#83b6ff}.qualification p,.qualification li{color:#c9d4e3}.check-list{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0;padding:0;list-style:none}.check-list li{padding:16px 18px;border:1px solid rgba(255,255,255,.13);border-radius:14px}.check-list li:before{content:'✓';margin-right:9px;color:#57d7a2;font-weight:900}.offer-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:34px}.offer-grid b{color:var(--accent)}
.proof{background:var(--accent-soft);text-align:center}.proof blockquote{max-width:900px;margin:12px auto;font-size:clamp(25px,3.5vw,42px);line-height:1.25;font-weight:750;letter-spacing:-.025em}.proof-note{font-size:12px!important}.price-card{border:1px solid var(--line);border-radius:22px;background:#fff;padding:28px;box-shadow:var(--shadow)}.price-card>span{font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--accent)}.price-card strong{display:block;margin:8px 0;font-size:36px}.price-card small{display:block;margin-bottom:22px;color:var(--muted)}.guarantee{background:#0f1d2f;color:#fff}.guarantee .wrap{display:grid;grid-template-columns:.85fr 1.15fr;gap:60px;align-items:center}.guarantee span{font-size:11px;font-weight:900;letter-spacing:.12em;color:#83b6ff}.guarantee h2{margin-top:10px}.guarantee p{color:#d6dfeb}
.faq details{border-top:1px solid var(--line);padding:20px 0}.faq details:last-child{border-bottom:1px solid var(--line)}.faq summary{cursor:pointer;font-weight:800;font-size:18px}.faq details p{max-width:760px}.conversion{background:linear-gradient(145deg,var(--accent-soft),#fff)}.form-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:60px;align-items:start}.lead-form{border:1px solid var(--line);border-radius:22px;background:#fff;padding:28px;box-shadow:var(--shadow)}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fields label{display:grid;gap:7px;color:var(--ink);font-size:13px;font-weight:750}.fields .wide{grid-column:1/-1}.fields input,.fields textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:13px 14px;font:inherit;color:var(--ink);background:#fff}.fields textarea{min-height:92px;resize:vertical}.consent{display:flex!important;grid-column:1/-1;grid-template-columns:18px 1fr!important;align-items:start;gap:9px!important;color:var(--muted)!important;font-size:12px!important}.consent input{width:16px;margin-top:3px}.lead-form .button{width:100%;margin-top:18px}.form-note{font-size:12px!important;margin-bottom:0}footer{padding:28px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
@media(max-width:820px){.topbar nav>a:not(.button){display:none}.hero{padding:58px 0}.hero-grid,.split,.form-grid,.guarantee .wrap{grid-template-columns:1fr;gap:34px}.hero h1{font-size:42px}.steps{grid-template-columns:1fr}.section{padding:60px 0}.check-list,.offer-grid{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.fields .wide{grid-column:auto}}
@media(max-width:520px){.wrap{width:min(100% - 28px,1120px)}.topbar .button{display:none}.hero h1{font-size:36px}.hero-actions{display:grid}.hero-actions .button{width:100%}.lead-form{padding:20px}.section h2{font-size:32px}}
</style></head><body>
<header class="topbar"><div class="wrap"><a class="brand" href="#">${logo}</a><nav><a href="#proceso">Cómo funciona</a><a class="button" href="${destination}">${cta}</a></nav></div></header>
<main><section class="hero"><div class="wrap hero-grid"><div><p class="eyebrow">${service} · ${zone}</p><h1>${headline}</h1><p class="lead">${subheadline}</p><div class="hero-actions"><a class="button" href="${destination}">${cta}</a><a class="button secondary" href="#proceso">Ver cómo funciona</a></div><p class="microcopy">Sin compromiso automático · primero comprobamos alcance y encaje</p></div>${visual}</div></section>
${proofSection}${architectureSections[brief.architecture]}${orderedSections}${brief.architecture === "pricing" ? priceSection : `${priceSection}${proofSection ? "" : proofSection}`}${guaranteeSection}
${faqSection}
<section class="conversion section" id="lead-form"><div class="wrap form-grid"><div><p class="eyebrow">SIGUIENTE PASO</p><h2>${cta}</h2><p>Comparte el contexto mínimo para que la primera conversación sirva para decidir, no para repetir preguntas.</p><p class="microcopy">Formulario de ${formFieldsTarget} campos adaptado al objetivo «${brief.objective === "qualified" ? "solicitud cualificada" : brief.objective === "booking" ? "reserva" : brief.objective === "quote" ? "propuesta" : "contacto"}».</p></div><form class="lead-form"><div class="fields">${formFields}<label class="consent"><input type="checkbox" required><span>${privacy}</span></label></div><button class="button" type="submit">${cta} →</button><p class="form-note">El envío no confirma disponibilidad, precio, exclusividad ni resultados.</p></form></div></section></main>
<footer><div class="wrap">${brand} · ${service} · ${zone}</div></footer>
<script>(function(){var form=document.querySelector('.lead-form');if(!form)return;var v=function(id){var n=document.getElementById(id);return n&&'value'in n?String(n.value).trim():''};var utm=function(){var p=new URLSearchParams(location.search);var out=['utm_source','utm_medium','utm_campaign'].map(function(k){return p.get(k)?k+': '+p.get(k):''}).filter(Boolean);return out.length?'Origen: '+out.join(', '):''};form.addEventListener('submit',function(e){e.preventDefault();${actionScript}})})();</script>
</body></html>`;
};

export const buildLandingHtml = (brief: LandingBrief) => {
  const automotive = brief.intent !== "vertical-default" ? AUTOMOTIVE_INTENTS[brief.intent] : null;
  return buildLandingHtmlV3(brief, {
    headline: headlineFor(brief),
    subheadline: automotive ? automotiveSubheadlineFor(brief, automotive) : subheadlineFor(brief),
    cta: ctaFor(brief),
    publishable: landingReadiness(brief).publishable,
    automotive,
  });
};
