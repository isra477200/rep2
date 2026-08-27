export type Media = {
  file: string;
  type: string;
  bytes: number;
  order: number;
  width?: number | null;
  height?: number | null;
  label?: string;
  title?: string;
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
  addedAt?: string;
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
  isFallback?: boolean;
  licenseNote?: string | null;
  reason?: string | null;
  recoveryMethod?: string | null;
  /** Luminancia real del activo: light = necesita fondo oscuro para verse. */
  tone?: "light" | "dark" | "mixed" | "opaque";
};
export type LogoManifest = Record<string, LogoRecord>;

export type Takeaway = { t: string; copiable: "alta" | "media" | "baja" };
export type TakeawaysData = { generatedAt: string; items: Record<string, Takeaway> };

export type PatternsProfile = {
  n: number;
  adsActivePct: number;
  pricePublicPct: number;
  guaranteePct: number;
  multiMarketPct: number;
  medianEur: number | null;
};
export type PatternsData = {
  generatedAt: string;
  universe: number;
  winnersN: number;
  winnersProfile: PatternsProfile;
  restProfile: PatternsProfile;
  modelStats: Array<{
    id: string;
    label: string;
    n: number;
    medianEur: number | null;
    pricedN: number;
    adsActivePct: number;
    guaranteePct: number;
    winnersPct: number;
    avgScore: number;
    examples: Array<{ id: string; name: string; country: string; score: number }>;
  }>;
  winnerChannels: Array<{ channel: string; count: number; pctWinners: number }>;
  doubleValidated: Array<{ id: string; name: string; country: string; score: number; metaAds: number; googleAds: number; agencyType: string }>;
  findings: Array<{ title: string; stat: string; detail: string }>;
};

export type ExecutionAction = {
  title: string;
  categoria: string;
  impact: number;
  effort: number;
  score: number;
  detail: string;
  sources: string[];
};
export type ExecutionBacklog = { generatedAt: string; note: string; actions: ExecutionAction[] };

export type Recurso = {
  id: string;
  categoria: string;
  para: string;
  titulo: string;
  descripcion: string;
  filename: string;
  contenido: string;
};
export type FormacionPaso = { id: string; leccion: string; pregunta: string };
export type RecursosData = {
  generatedAt: string;
  note: string;
  items: Recurso[];
  formacion?: { titulo: string; nota: string; pasos: FormacionPaso[] };
};

export type Vertical = {
  id: string;
  label: string;
  n: number;
  spainN: number;
  medianEur: number | null;
  pricedN: number;
  adsActivePct: number;
  referentes: Array<{ id: string; name: string; country: string; score: number }>;
  tacticas: string[];
  clienteIdeal: string;
  estacionalidad: string;
  guionApertura: string;
};
export type VerticalesData = { generatedAt: string; nota: string; verticales: Vertical[] };

export type GarantiaItem = { id: string; name: string; country: string; score: number; text: string; kinds: string[]; fuerza: number; coste: number };
export type TitularItem = { id: string; name: string; country: string; score: number; headline: string; formulas: string[] };
export type ArsenalData = {
  generatedAt: string;
  garantias: { total: number; items: GarantiaItem[] };
  titulares: { total: number; formulaCounts: Record<string, number>; items: TitularItem[] };
  formularios: {
    n: number;
    byCountry: Array<{ country: string; n: number; medianFields: number; medianRequired: number }>;
    recommendation: { medianFieldsWinners: number | null; medianFieldsAll: number; reading: string };
  };
};

export type AdsKitData = {
  generatedAt: string;
  items: Array<{
    angulo: string;
    meta: { primaries: string[]; headlines: string[] };
    google: { titulares: string[]; descripciones: string[] };
  }>;
};

export type VigilanciaData = {
  generatedAt: string;
  nota: string;
  semaforo: Array<{ id: string; name: string; agencyType: string; threat: string; score: number; adsActive: boolean; metaAds: number; googleAds: number; pricePublic: boolean; priceLocal: string; hasGuarantee: boolean; nivel: "rojo" | "ambar" | "verde" }>;
  grupos: Array<{ grupo: string; evidencia: string; etiqueta: string; marcas: Array<{ id: string; name: string; country: string; score: number }> }>;
};

export type CrucesData = {
  generatedAt: string;
  nota: string;
  elasticidadGarantia: Array<{ label: string; n: number; medianEur: number | null }>;
  titularPorVertical: Array<{ vertical: string; winners: number; top: Array<{ formula: string; n: number }> }>;
  curvaEspana: { total: number; buckets: Array<{ rango: string; n: number }>; hueco: { rango: string; n: number } | null };
  madurez: Array<{ pais: string; n: number; precioPublico: number; garantia: number; adsActivos: number; indice: number }>;
  promesaRemedio: { celdas: Array<{ promesa: string; remedio: string; n: number; espana: number }>; huecosEspana: Array<{ promesa: string; remedio: string; n: number; espana: number }> };
  contradicciones: Array<{ id: string; name: string; country: string; score: number; flags: string[] }>;
  adn: { nTop: number; rasgos: Array<{ rasgo: string; pctTop: number; pctBase: number }> };
  delta10x: { nBaratos: number; nCaros: number; rasgos: Array<{ rasgo: string; baratos: number; caros: number; delta: number }> };
  promesasPais: Array<{ pais: string; n: number; dominante: string; nDominante: number }>;
  fragilidad: Array<{ id: string; name: string; agencyType: string; score: number; puntos: number; razones: string[] }>;
  lexico: Array<{ vertical: string; n: number; bigramas: Array<{ b: string; n: number }> }>;
  slas: { total: number; top: Array<{ id: string; name: string; country: string; score: number; sla: string; minutos: number }> };
  findings: string[];
};

export type AdMediaAsset =
  | string
  | {
      type?: "image" | "video" | "poster" | "other";
      kind?: "image" | "video" | "poster" | "other";
      url?: string | null;
      sourceUrl?: string | null;
      file?: string | null;
      localFile?: string | null;
      posterUrl?: string | null;
      posterFile?: string | null;
      mimeType?: string | null;
      width?: number | null;
      height?: number | null;
      duration?: number | null;
    };

export type AnuncioReal = {
  file: string;
  id: string;
  name: string;
  /** Identidad observada antes de resolver un alias hacia la ficha canónica. */
  observedId?: string | null;
  observedName?: string | null;
  /** Capas de evidencia fusionadas cuando el mismo anuncio aparece en varias fuentes. */
  evidenceLayers?: string[];
  plataforma: string;
  titular: string;
  texto: string;
  cta: string;
  precioVisible: string;
  angulo: string;
  vertical?: string;
  capturaEnVivo?: boolean;
  fecha?: string;
  /** ID exacto de la creatividad en la biblioteca de origen, cuando existe. */
  externalId?: string | null;
  /** URL directa o pública usada para verificar la pieza. */
  fuenteUrl?: string | null;
  /** Procedencia de la evidencia: biblioteca, archivo, captura manual, etc. */
  origen?: string | null;
  /** Estado o alcance de la transcripción, no un sustituto del copy en `texto`. */
  transcripcion?: string | null;
  /** Confianza editorial declarada por el proceso de revisión. */
  confianza?: number | string | null;
  /** Estado verificable de la evidencia individual. */
  estadoEvidencia?: string | null;
  /** Calidad de la atribución de la pieza al anunciante. */
  atribucion?: string | null;
  /** `false` excluye la pieza de patrones agregados, pero no de búsqueda. */
  aptaPatrones?: boolean;
  /** SHA-256 del archivo visual local cuando ha sido archivado y verificado. */
  archivoSha256?: string | null;
  /** Identificador estable de la fila dentro del corpus consolidado. */
  corpusKey?: string | null;
  /** Metadatos públicos del anunciante/financiador cuando la biblioteca los expone. */
  anunciante?: string | null;
  /** ID estable de la página anunciante en Meta Ad Library. */
  pageId?: string | null;
  /** Destino comercial observado en la creatividad. */
  landingUrl?: string | null;
  /** Estado observado en la biblioteca; `null` significa que no se pudo determinar. */
  isActive?: boolean | null;
  /** Fechas originales de entrega. Admiten ISO o epoch para conservar la fuente sin pérdida. */
  startDate?: string | number | null;
  endDate?: string | number | null;
  /** Activos descargados o URLs públicas asociados a la creatividad. */
  mediaAssets?: AdMediaAsset[];
  /** Vídeo y poster locales preferidos para reproducción estable en el portal. */
  videoFile?: string | null;
  posterFile?: string | null;
  /** Transcripción normalizada del audio; convive con `transcripcion` del corpus histórico. */
  transcript?: string | null;
  /** País principal de la empresa; no implica que sea el mercado objetivo del anuncio. */
  country?: string;
  /** Familia normalizada, separada del origen del archivo. */
  platformFamily?: "meta" | "instagram" | "google" | "display" | "unknown";
  /** Tipo del archivo local archivado. */
  mediaType?: "image" | "video" | "document" | "other" | "none";
  /** Variantes físicas agrupadas bajo la misma identidad creativa. */
  variantCount?: number;
  variantFiles?: string[];
  /** El original contiene copy suficiente para lectura y búsqueda. */
  copyAvailable?: boolean;
  /** Huella del titular, cuerpo, CTA y oferta originales. */
  sourceCopySha256?: string;
  /** Código BCP-47 simplificado del original (`und` si no se puede determinar). */
  idioma?: string;
  idiomaNombre?: string;
  idiomaConfianza?: number | null;
  idiomaOrigen?: "detected" | "market_inferred" | "reviewed" | "unknown" | "no_text" | "insufficient_text" | "ambiguous_ocr" | "library_ui_literal";
  /** Traducción separada: nunca sustituye a titular, texto o CTA. */
  traduccionEs?: {
    titular: string;
    texto: string;
    cta: string;
    precioVisible: string;
  };
  estadoTraduccion?: "no_necesaria" | "automatica" | "revisada" | "pendiente" | "requiere_revision" | "no_disponible" | "no_aplica";
  proveedorTraduccion?: string;
  traducidoEn?: string;
  revisadoPorTraduccion?: string;
  notaRevisionTraduccion?: string;
  /** Estado exhaustivo del OCR para la creatividad archivada. */
  estadoOcr?: "no_necesario" | "completo_alta" | "completo_media" | "completo_baja" | "sin_texto" | "fallido" | "pendiente";
  confianzaOcr?: number | null;
  intentosOcr?: number;
  motorOcr?: string | null;
  idiomasOcr?: string | null;
  motivoOcr?: string | null;
};
export type AnunciosRealesData = {
  schema?: string;
  generatedAt: string;
  nota: string;
  total: number;
  companies?: number;
  patternReady?: number;
  withFive?: number;
  withTen?: number;
  byLanguage?: Array<{ label: string; n: number }>;
  byOcrStatus?: Array<{ label: string; n: number }>;
  byTranslationStatus?: Array<{ label: string; n: number }>;
  items: AnuncioReal[];
};

export type AdCoverageStatus = ">=10" | "5-9" | "1-4" | "sin evidencia" | "pendiente/no atribuible";
export type AdCoverageStatusCounts = Record<AdCoverageStatus, number>;
export type AdCoveragePlatformCounts = {
  meta: number;
  google: number;
  instagram: number;
  display: number;
  other: number;
};
export type AdCoverageItem = {
  companyId: string;
  name: string;
  country: string;
  domain: string;
  status: AdCoverageStatus;
  availableEvidenceCount: number;
  targetCount: number;
  transcribedCanonicalCount: number;
  verifiedTranscribedCount: number;
  textAvailabilityGap: number;
  verifiedTranscriptionGap: number;
  transcriptionGap: number;
  textAvailableComplete: boolean;
  verifiedComplete: boolean;
  transcriptionComplete: boolean;
  transcribedByPlatform: AdCoveragePlatformCounts;
  exactCreativeIds: { meta: string[]; google: string[]; total: number };
  archivedFileCount: number;
  reportedLibraryCounts: { meta: number; google: number };
  review: {
    meta: { status: string; classification: string };
    google: { status: string; classification: string };
  };
  sourceLinks: string[];
  observedAliases: string[];
  detailAvailable: boolean;
  evidence: Array<{
    externalId: string | null;
    platform: "meta" | "google" | "instagram" | "display" | "other";
    file?: string | null;
    sourceUrl?: string | null;
    transcriptSignature?: string;
  }>;
};
export type AdCoverageData = {
  generatedAt: string;
  note: string;
  totalCompanies: number;
  summary: {
    statusCounts: AdCoverageStatusCounts;
    companiesWithEvidence: number;
    companiesWithExactIds: number;
    exactMetaIds: number;
    exactGoogleIds: number;
    transcribedCanonical: number;
    verifiedTranscribed: number;
    /** Evidencias canónicas muestreadas, limitadas al objetivo de cada empresa. */
    sampledEvidence?: number;
    /** Parte de la muestra que dispone de un archivo público verificable. */
    sampledEvidenceWithPublicFile?: number;
    targetTotal: number;
    transcriptionGap: number;
    textAvailabilityGap: number;
    verifiedTranscriptionGap: number;
    orphanAdvertisers: number;
    orphanTranscribedRecords: number;
  };
  aliasMap: Array<{ alias: string; canonical: string; reason: string; transcribedRecords: number }>;
  orphanItems: Array<{ observedId: string; name: string; transcribedRecords: number; platforms: string[] }>;
  countries: Array<{
    country: string;
    companies: number;
    withEvidence: number;
    exactCreativeIds: number;
    transcribedCanonical: number;
    statusCounts: AdCoverageStatusCounts;
  }>;
  items: AdCoverageItem[];
};

export type AngulosData = {
  generatedAt: string;
  nota: string;
  total: number;
  enVivo: number;
  plataformas: Array<{ label: string; n: number }>;
  topAngulos: Array<{ label: string; n: number }>;
  topCtas: Array<{ label: string; n: number }>;
  senales: Array<{ label: string; n: number; pct: number }>;
  findings: string[];
};

export type HomesTimelineData = {
  nota: string;
  snapshots: Record<string, Array<{ id: string; domain: string; date: string; title: string; hero: string; priceVisible: boolean; status: string }>>;
};

export type Dossier = {
  id: string;
  resumen: string;
  equipo: string;
  hitos: string[];
  stack: string[];
  economics: { supuesto: string; calculo: string; lectura: string };
  fuentes: Array<{ url: string; label: string }>;
  confianza: string;
  checkedAt: string;
};
export type DossiersData = { generatedAt: string; items: Record<string, Dossier> };

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
  url: string | null;
  title?: string;
  accessedAt?: string;
  sourceType?: string;
  relation?: "official_site" | "external_funnel_destination" | null;
  status?: string;
  supports?: string[];
  limitation?: string;
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
  usableEvidenceReferences: number;
  unavailableEvidenceReferences: number;
  uniqueEvidenceUrls: number;
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
    evidenceReferences: number;
    usableEvidenceReferences: number;
    unavailableEvidenceReferences: number;
    uniqueEvidenceUrlsWithinRecords: number;
    uniqueEvidenceUrlsGlobal: number;
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

export type InsightRef = {
  type: "ficha" | "panorama";
  id?: string;
  domain?: string;
  name: string;
  country: string;
  score?: number;
};

export type InsightMethod = {
  id: string;
  title: string;
  what: string;
  who: InsightRef[];
  apply: string;
  risk: string;
};

export type Insights = {
  generatedAt: string;
  universe: number;
  pricedCount: number;
  worldMedianEur: number;
  spainCount: number;
  models: Array<{ type: string; count: number; pct: number }>;
  priceBuckets: Array<{ label: string; count: number }>;
  countryMedians: Array<{ country: string; n: number; medianEur: number }>;
  guarantees: Array<{
    kind: string;
    count: number;
    spain: number;
    examples: Array<{ id: string; name: string; country: string }>;
  }>;
  threatsSpain: Array<{ id: string; name: string; score: number; agencyType: string; relation: string }>;
  threatsSpainTotal: number;
  copyNow: Array<{ id: string; name: string; country: string; decision: string; score: number; agencyType: string; offer: string }>;
  gaps: Array<{ title: string; stat: string; detail: string }>;
  methods: InsightMethod[];
};

export type PanoramaCompany = {
  name: string;
  domain: string;
  country: string;
  flag: string;
  model: string;
  offer: string;
  publicPrice: string;
  guarantee: string;
  relevance: string;
  website: string;
};

export type PanoramaData = {
  observedAt: string;
  status: string;
  total: number;
  countries: Array<{ country: string; flag: string; count: number }>;
  companies: PanoramaCompany[];
};

export type Analytics = {
  generatedAt: string;
  universe: number;
  matrix: { countries: string[]; rows: Array<{ niche: string; total: number; cells: Array<{ country: string; count: number }> }> };
  saturation: Array<{ niche: string; count: number }>;
  priceGuarantee: {
    withGuarantee: { n: number; medianEur: number | null };
    withoutGuarantee: { n: number; medianEur: number | null };
    reading: string | null;
  };
  elasticity: Array<{ country: string; n: number; p25: number; p50: number; p75: number }>;
  copyAnalysis: {
    winnersN: number;
    laggardsN: number;
    winnerWords: Array<{ word: string; count: number }>;
    laggardWords: Array<{ word: string; count: number }>;
  };
  scoringV2: {
    formula: string;
    spain: Array<{ id: string; name: string; v2: number; v1: number; agencyType: string }>;
    global: Array<{ id: string; name: string; country: string; v2: number; v1: number }>;
  };
  holdings: Array<{ id: string; name: string; country: string; offer: string }>;
  mortality: { cases: Array<{ name: string; domain_last_known?: string; country?: string; closed_when?: string; cause?: string; lesson?: string; sources?: string[] }>; patterns: string[] } | null;
  leadEconomy: { verticals: Array<{ vertical: string; typical_cpl_range?: string; typical_appointment_price?: string; who_buys?: string; where_they_buy?: string; sources?: string[] }>; notes: string[] } | null;
  pending: string[];
};

export type ExpansionData = {
  generatedAt: string;
  note: string;
  playbook: string[];
  dossiers: Array<{
    country: string;
    priority: number;
    fichas: number;
    inVerification: number;
    medianEur: number | null;
    pricedN: number;
    highThreats: number;
    referents: Array<{ id: string; name: string; decision: string; score: number }>;
    regulation: { b2b: string; requirements: string; recentChanges: string; risk: string; sources: string[] } | null;
    strategy: string;
  }>;
  regulationAll: Array<{ country: string; b2b: string; requirements: string; b2cNote: string; recentChanges: string; risk: string; sources: string[] }>;
};

export type MysteryData = {
  generatedAt: string;
  intro: string;
  legal: string[];
  setup: string[];
  identities: Array<{ id: string; label: string; story: string; dataToGive: string; goodFor: string }>;
  baseQuestions: string[];
  captureChecklist: string[];
  flow: string[];
  registryTemplate: string[];
  targets: Array<{ order: number; id: string; name: string; website: string; threat: string; agencyType: string; identity: string; focus: string; priceRef: string; hipotesis?: string[] }>;
};
