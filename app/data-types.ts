export type Media = {
  file: string;
  type: string;
  bytes: number;
  order: number;
  width?: number | null;
  height?: number | null;
};
export type Price = {
  currency: string | null;
  amount: number | null;
  eur: number | null;
  label: string;
};

export type CompanyLocation = {
  companyId: string;
  latitude: number | null;
  longitude: number | null;
  precision:
    | "exacta_publicada"
    | "centro_ciudad"
    | "centro_pais_mercado"
    | "sin_punto";
  locationLabel: string;
  locality: string | null;
  canonicalMarket: string;
  commercialMarket: string;
  locationCountry: string;
  pointRepresents:
    | "ubicación corporativa publicada"
    | "mercado o país canónico"
    | "sin punto asignado";
  headquartersVerified: false;
  sourceUrl: string | null;
  coordinateSourceUrl: string | null;
  limitation: string;
  zoom: number | null;
  reviewedAt: string;
};

export type Company = {
  id: string;
  name: string;
  title: string;
  domain: string;
  website: string;
  country: string;
  primaryCountry: string;
  countries: string[];
  market: string;
  markets: string[];
  scope: string;
  agencyType: string;
  offer: string;
  priceLocal: string;
  priceStatus: string;
  price: Price;
  ticket: string;
  contract: string;
  guarantee: string;
  channels: string[];
  metaStatus: string;
  metaAds: number;
  googleStatus: string;
  googleAds: number;
  creativeArchive: number;
  score: number;
  threat: string;
  relation: string;
  decision: string;
  evidence: string;
  proof: string;
  team: string;
  cta: string;
  funnel: string;
  niche: string;
  legal: string;
  review: string;
  reviewedAt: string | null;
  sources: string[];
  body: string;
  media: Media[];
  mediaDeclared: number;
  location: CompanyLocation | null;
};

export type Country = {
  name: string;
  count: number;
  topScore: number;
  withPublicPrice: number;
  withMedia: number;
};
export type CountryGeo = {
  name: string;
  code: string;
  code3: string;
  latitude: number;
  longitude: number;
  region: string;
  subregion: string;
  flag: string;
  precision: "country_centroid";
  locationLabel: string;
  source: string;
};
export type LogoRecord = {
  file: string | null;
  status: "official" | "favicon" | "platform" | "fallback";
  source: string | null;
  sourceHost?: string | null;
  checkedAt: string;
  contentType?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  sha256?: string | null;
  confidence?: "high" | "medium" | "fallback";
  reason?: string | null;
};
export type LogoManifest = Record<string, LogoRecord>;

export type Summary = {
  companies: number;
  countries: number;
  media: number;
  mediaFailed: number;
  withMedia: number;
  technicalArtifactsExcluded: number;
  mediaFileTypeCorrections: number;
  publicPrices: number;
  priceCoveragePercent: number;
  priceCoverage?: {
    companyIndex: { records: number; percent: number };
    commercialAuditV3: { records: number; percent: number };
    explanation: string;
  };
  sources: number;
  logos: {
    total: number;
    official: number;
    favicon: number;
    platform: number;
    authentic: number;
    fallback: number;
    coveragePercent: number;
    locallyStored: boolean;
    hotlinked: number;
    policy: string;
    checkedAt: string;
  };
  categories: { name: string; count: number }[];
  completion: {
    status: string;
    recordsInProgress: number;
    residualPending: number;
    motherlessRecords: number;
    criticalEmptyUnexplained: number;
    orphanMedia: number;
    availableEvidencePlaced: number;
    unavailableEvidenceDocumented: number;
    technicalArtifactsExcluded: number;
    recordsWithoutPublicSource: number;
    specialMarketRecords: number;
  };
  fx: { date: string; source: string; disclaimer: string };
};

export type Editorial = {
  blueprint: { title: string; body: string };
  report: { title: string; body: string };
  execution: { title: string; body: string };
};

export type DeepFunnelStage = {
  stage: string;
  status: "observado" | "inferido" | "no observable" | "no aplica";
  evidence: string[];
  note: string | null;
};

export type DeepForm = {
  pageUrl: string;
  action: string | null;
  method: string;
  submitText: string | null;
  visibleFieldCount: number;
  requiredFieldCount: number;
  hiddenFieldCount: number;
  kind?: "commercial" | "booking" | "checkout" | "listing" | "newsletter" | "search" | "login" | "filter" | "empty" | "unknown";
  fields: Array<{
    type: string;
    name: string | null;
    label: string | null;
    placeholder: string | null;
    required: boolean;
    hidden: boolean;
  }>;
};

export type ManualDeepReview = {
  reviewLabel: string;
  reviewedAt: string;
  message: {
    headline: string | null;
    promise: string | null;
    positioning: string | null;
    audience: string | null;
    voice: string[];
    patterns: string[];
  };
  cta: {
    primary: string | null;
    secondary: string[];
    forms: Array<{
      url: string | null;
      purpose: string;
      fields: string[];
      fieldCount: number | null;
      friction: string;
      submitted: false;
    }>;
  };
  funnel: Array<{ stage: string; status: string; detail: string }>;
  terms: { pricing: string[]; contract: string[]; guarantee: string[] };
  proof: string[];
  objections: string[];
  technology: string[];
  contradictions: string[];
  inferences: string[];
  notObservable: string[];
  limitations: string[];
  lessons: { copy: string[]; adapt: string[]; avoid: string[]; test: string[] };
  sources: Array<{ url: string; label: string; status: string }>;
};

export type DeepReview = {
  id: string;
  name: string;
  reviewedAt: string;
  status: "Borrador automático" | "Verificada manual" | "Verificada estructural" | "Limitada" | "No aplica verificado";
  confidence: "Alta" | "Media" | "Limitada";
  coveragePercent: number;
  message: {
    hero: string;
    heroObserved?: boolean;
    priorSummary?: string | null;
    voice: string;
    supportingHeadings: string[];
  };
  conversion: {
    primaryCta: string | null;
    primaryCtaEvidence?: string | null;
    ctas: string[];
    captureType: string;
    forms: DeepForm[];
    formAnalysis: {
      text: string;
      friction: string;
      minFields: number;
      maxFields: number;
      qualification: string[];
    };
    contacts: string[];
    bookingObserved: boolean;
    checkoutObserved: boolean;
    technologies: string[];
  };
  offer: {
    existingSummary: string | null;
    audience: string | null;
    prices: string[];
    guarantee: string[];
    proof: string[];
    objections: string[];
    urgency: string[];
    evidence?: Partial<
      Record<
        | "prices"
        | "guarantee"
        | "guaranteeDisclaimers"
        | "guaranteeOther"
        | "proof"
        | "objections",
        Array<{
          text: string;
          url?: string;
          pageTitle?: string;
          pageCategory?: string;
          polarity?: string;
          guaranteeType?: string;
        }>
      >
    >;
  };
  funnel: DeepFunnelStage[];
  route: string;
  evidence: Array<{ id: number; url: string; label: string }>;
  archivedEvidenceCount: number;
  archivedEvidenceNote: string | null;
  limitations: string[];
  redVitalia: string[];
  manual: ManualDeepReview | null;
  schemaValid: boolean;
  reviewMethod: "manual" | "automatic";
  researchReadiness: "usable" | "partial" | "manual_only" | "no_observable" | "not_applicable";
};

export type DeepIndexItem = {
  id: string;
  status: DeepReview["status"];
  confidence: DeepReview["confidence"];
  coveragePercent: number;
  hero: string;
  primaryCta: string | null;
  captureType: string;
  minFormFields: number;
  maxFormFields: number;
  technologies: string[];
  evidenceCount: number;
  archivedEvidenceCount: number;
  automaticEvidenceCount: number;
  manualEvidenceCount: number;
  limitationCount: number;
  manualReviewed: boolean;
  manualLabel: string | null;
  bookingObserved: boolean;
  bookingIntentObserved: boolean;
  schemaValid: boolean;
  reviewMethod: "manual" | "automatic";
  researchReadiness: DeepReview["researchReadiness"];
};

export type DeepIndex = {
  stats: {
    generatedAt: string;
    total: number;
    complete: number;
    verified: number;
    schemaValid: number;
    automaticDrafts: number;
    manualVerified: number;
    structuralVerified: number;
    limited: number;
    notApplicable: number;
    highConfidence: number;
    withForms: number;
    withBooking: number;
    bookingObserved: number;
    bookingIntentObserved: number;
    withWhatsApp: number;
    technologySignals: number;
    evidenceUrls: number;
    archivedEvidenceAssets: number;
    averageObservableCoverage: number;
    manualReviewed: number;
    zeroObservableCoverage: number;
    limitedConfidence: number;
    readiness: Partial<Record<DeepReview["researchReadiness"], number>>;
  };
  records: DeepIndexItem[];
};

export type FunnelV3Evidence = {
  id: string;
  url: string;
  title?: string;
  accessedAt?: string;
  sourceType?: string;
  relation?: "official_site" | "external_funnel_destination" | null;
  status?: string;
  supports?: string[];
};

export type FunnelV3Field = {
  tag?: string;
  type: string;
  name?: string | null;
  label?: string | null;
  placeholder?: string | null;
  required: boolean;
  options?: string[];
  [key: string]: unknown;
};

export type FunnelV3Form = {
  pageUrl?: string | null;
  sourceUrl?: string | null;
  purpose?: string | null;
  action?: string | null;
  method?: string | null;
  visibleFieldCount: number;
  requiredFieldCount: number;
  fields: FunnelV3Field[];
  submitLabels?: string[];
  consentText?: string[];
  qualificationDimensions?: string[];
  friction?: string | Record<string, unknown>;
  submissionPerformed: false;
  [key: string]: unknown;
};

export type FunnelV3Stage = {
  stage: string;
  status: "observado" | "inferido" | "no observable" | "no aplica";
  detail: string;
  limitation?: string | null;
  evidenceIds?: string[];
  manualFindings?: Array<Record<string, unknown>>;
};

export type FunnelV3Review = {
  format: "rv-funnel-forensics-public-v3";
  id: string;
  name: string;
  reviewedAt: string;
  status: string;
  coveragePercent: number;
  verification: {
    qa: string;
    manualEvidence: boolean;
    publicGetOnly: true;
    formsSubmitted: false;
    companyContacted: false;
  };
  classification: Record<string, unknown>;
  messageArchitecture: Record<string, unknown>;
  acquisition: Record<string, unknown>;
  ctaLadder: Record<string, unknown>;
  captureAndQualification: Record<string, unknown> & { forms?: FunnelV3Form[] };
  funnel: FunnelV3Stage[];
  offerEconomics: Record<string, unknown>;
  proofAndTrust: Record<string, unknown>;
  objectionsAndSales: Record<string, unknown>;
  technologyAndNurture: Record<string, unknown>;
  deliveryOperations: Record<string, unknown>;
  competitiveAssessment: Record<string, unknown>;
  evidence: FunnelV3Evidence[];
  evidenceScreenshots: Array<{
    file: string;
    type: "image/webp";
    bytes: number;
    sha256: string;
    label: string;
  }>;
  limitations: string[];
};

export type FunnelV3IndexItem = {
  id: string;
  name: string;
  status: string;
  scope: string;
  coveragePercent: number;
  headline: string;
  primaryCta: string | null;
  forms: number;
  fields: number;
  requiredFields: number;
  evidence: number;
  screenshots: number;
  manualEvidence: boolean;
  limitations: number;
};

export type FunnelV3Index = {
  stats: {
    total: number;
    verified: number;
    manualEvidence: number;
    withForms: number;
    forms: number;
    visibleFields: number;
    evidence: number;
    screenshots: number;
    averageCoverage: number;
  };
  insights?: {
    coverageBands: Array<{ label: string; count: number }>;
    commercialSignals: {
      primaryCtaObserved: number;
      withForms: number;
      withoutForms: number;
      recordsWithNumericPublicPrice: number;
      manualEvidence: number;
      explicitLimitations: number;
    };
    dimensions: Array<{
      key: string;
      observado: number;
      inferido: number;
      "no observable": number;
      "no aplica": number;
    }>;
    funnelStages: Array<{
      stage: string;
      observado: number;
      inferido: number;
      "no observable": number;
      "no aplica": number;
      observedPercent: number;
    }>;
  };
  records: FunnelV3IndexItem[];
};
