import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const strict = process.argv.includes("--strict");
const QUEUE_FILE = "research/deep/v3/queue.json";
const QUALITY_FILE = "research/deep/v3/rendered-quality.json";
const QA_FILE = "research/deep/v3/qa-report.json";
const COMPANIES_FILE = "public/data/companies.json";
const SUMMARY_FILE = "public/data/summary.json";
const AUDIT_FILE = "public/data/audit.json";
const FUNNEL_INDEX_FILE = "public/data/funnel-v3/index.json";
const FUNNEL_RECORDS_DIR = "public/data/funnel-v3/records";
const COMPANY_DETAILS_DIR = "public/data/company-details";
const COMPANY_LOCATIONS_FILE = "public/data/company-locations.json";
const MEDIA_DIR = "public/media";
const OUTPUT_FILE = "public/data/final-audit.json";
const CANONICAL_AUDIT_FILE = "audit/notion-final.json";

const RESEARCH_COMPLETE = new Set(["render_complete", "limited", "classification_review"]);
const CRITICAL_FIELDS = [
  "name", "country", "scope", "agencyType", "offer", "priceLocal", "priceStatus",
  "contract", "guarantee", "decision", "evidence", "review", "body",
];

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function optionalJson(path) {
  try { return await json(path); } catch { return null; }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function blank(value) {
  return !String(value ?? "").trim();
}

function stagePending(items, key, accepted = new Set(["complete"])) {
  return items.filter((item) => !accepted.has(item[key]?.status)).length;
}

const [queue, quality, qa, companies, summary, audit, funnelIndex, companyLocations, funnelFiles, detailFiles, mediaFiles, canonicalAudit] = await Promise.all([
  json(QUEUE_FILE),
  json(QUALITY_FILE),
  json(QA_FILE),
  json(COMPANIES_FILE),
  json(SUMMARY_FILE),
  json(AUDIT_FILE),
  json(FUNNEL_INDEX_FILE),
  json(COMPANY_LOCATIONS_FILE),
  readdir(FUNNEL_RECORDS_DIR),
  readdir(COMPANY_DETAILS_DIR),
  readdir(MEDIA_DIR),
  optionalJson(CANONICAL_AUDIT_FILE),
]);

const items = queue.items || [];
const stageResidual = {
  research: stagePending(items, "research", RESEARCH_COMPLETE),
  synthesis: stagePending(items, "synthesis"),
  qualityControl: stagePending(items, "qa"),
  canonicalSync: stagePending(items, "notion"),
  publicPortal: stagePending(items, "portal"),
};
const recordsInProgress = items.filter((item) =>
  [item.research, item.synthesis, item.qa, item.notion, item.portal]
    .some((stage) => stage?.status === "in_progress"),
).length;
const residualPending = items.filter((item) =>
  !RESEARCH_COMPLETE.has(item.research?.status)
  || item.synthesis?.status !== "complete"
  || item.qa?.status !== "complete"
  || item.notion?.status !== "complete"
  || item.portal?.status !== "complete",
).length;
const motherlessRecords = Number.isFinite(canonicalAudit?.motherlessRecords)
  ? canonicalAudit.motherlessRecords
  : companies.filter((company) => blank(company.body)).length;
const criticalEmptyUnexplained = companies.reduce((total, company) =>
  total + CRITICAL_FIELDS.filter((field) => blank(company[field])).length, 0);
const publicCompanyDetails = detailFiles.filter((file) => file.endsWith(".json")).length;
const publicFunnelRecords = funnelFiles.filter((file) => file.endsWith(".json")).length;
const publicMedia = companies.reduce((total, company) => total + (company.media?.length || 0), 0);
const recordsWithoutPublicSource = companies.filter((company) => !company.sources?.length).length;
const referencedMediaFiles = new Set(companies.flatMap((company) =>
  (company.media || []).map((media) => String(media.file || "").split("/").pop()).filter(Boolean),
));
const orphanMedia = mediaFiles.filter((file) => !referencedMediaFiles.has(file)).length;
const documentedLimitations = (funnelIndex.records || []).reduce((total, record) =>
  total + Number(record.limitations || 0), 0);
const unavailableEvidenceDocumented = Number(audit.failedCount || 0);
const qaErrors = Number(qa.counts?.errors || 0);
const qaWarnings = Number(qa.counts?.warnings || 0);
const companyIndexPriceRecords = Number(summary.publicPrices || 0);
const commercialAuditPriceRecords = Number(funnelIndex.insights?.commercialSignals?.recordsWithNumericPublicPrice || 0);
const priceCoverage = {
  companyIndex: {
    records: companyIndexPriceRecords,
    percent: Math.round((companyIndexPriceRecords / companies.length) * 1_000) / 10,
  },
  commercialAuditV3: {
    records: commercialAuditPriceRecords,
    percent: Math.round((commercialAuditPriceRecords / companies.length) * 1_000) / 10,
  },
  explanation: "El índice rápido muestra el precio estructurado original; la auditoría comercial V3 añade precios públicos trazables encontrados en la revisión profunda. El total más amplio no se mezcla con fichas sin importe verificable.",
};

const closureChecks = {
  exactCanonicalRecords: items.length === 712 && companies.length === 712,
  canonicalBaseAudited: canonicalAudit?.records === 712
    && canonicalAudit?.motherRecords === 712
    && canonicalAudit?.childRecords === 0
    && canonicalAudit?.motherlessRecords === 0
    && canonicalAudit?.privateReferences === 0
    && canonicalAudit?.internalTerms === 0,
  zeroInProgress: recordsInProgress === 0,
  zeroResidualPending: residualPending === 0,
  zeroMotherlessRecords: motherlessRecords === 0,
  zeroCriticalEmptyUnexplained: criticalEmptyUnexplained === 0,
  zeroOrphanMedia: orphanMedia === 0,
  zeroRecordsWithoutPublicSource: recordsWithoutPublicSource === 0,
  allCanonicalRecordsSynchronized: stageResidual.canonicalSync === 0,
  allPublicDossiersPublished: publicCompanyDetails === 712 && publicFunnelRecords === 712 && funnelIndex.stats?.total === 712,
  allQualityControlsPassed: qa.reviewed === 712 && qaErrors === 0 && qaWarnings === 0,
  allUnavailableEvidenceDocumented: unavailableEvidenceDocumented === Number(summary.mediaFailed || 0),
};
const finished = Object.values(closureChecks).every(Boolean);
const completion = {
  status: finished ? "TERMINADO" : "AMPLIACIÓN FORENSE EN CURSO",
  recordsInProgress,
  residualPending,
  motherlessRecords,
  criticalEmptyUnexplained,
  orphanMedia,
  availableEvidencePlaced: publicMedia,
  unavailableEvidenceDocumented,
  unavailableEvidenceTotal: unavailableEvidenceDocumented,
  technicalArtifactsExcluded: Number(summary.technicalArtifactsExcluded || 0),
  recordsWithoutPublicSource,
  specialMarketRecords: Number(summary.completion?.specialMarketRecords || 0),
};
const finalAudit = {
  format: "redvitalia-final-audit-1",
  generatedAt: new Date().toISOString(),
  status: completion.status,
  totals: {
    canonicalRecords: items.length,
    canonicalMotherRecords: Number(canonicalAudit?.motherRecords || 0),
    canonicalChildRecords: Number(canonicalAudit?.childRecords || 0),
    publicCompanies: companies.length,
    publicCompanyDetails,
    publicFunnelDossiers: publicFunnelRecords,
    countries: Number(summary.countries || 0),
    publicSources: Number(summary.sources || 0),
    galleryEvidence: publicMedia,
    funnelEvidenceReferences: Number(funnelIndex.stats?.evidenceReferences ?? funnelIndex.stats?.evidence ?? 0),
    funnelEvidenceUrlsWithinRecords: Number(funnelIndex.stats?.uniqueEvidenceUrlsWithinRecords || 0),
    funnelEvidenceLinks: Number(funnelIndex.stats?.uniqueEvidenceUrlsGlobal || 0),
    funnelScreenshots: Number(funnelIndex.stats?.screenshots || 0),
    canonicalRecordsSynchronized: items.length - stageResidual.canonicalSync,
    publicPricesWithEuroEquivalent: commercialAuditPriceRecords,
    companyIndexPricesWithEuroEquivalent: companyIndexPriceRecords,
    funnelV3PricesWithEuroEquivalent: commercialAuditPriceRecords,
    authenticBrandAssets: Number(summary.logos?.authentic || 0),
    neutralLogoFallbacks: Number(summary.logos?.fallback || 0),
    mappedRecords: Number(companyLocations.summary?.withPoint || 0),
    unmappedRecords: Number(companyLocations.summary?.sin_punto || 0),
    publishedCoordinateRecords: Number(companyLocations.summary?.exacta_publicada || 0),
    cityCenterRecords: Number(companyLocations.summary?.centro_ciudad || 0),
    marketCenterRecords: Number(companyLocations.summary?.centro_pais_mercado || 0),
  },
  closure: {
    ...completion,
    stageResidual,
    qaErrors,
    qaWarnings,
    checks: closureChecks,
  },
  researchQuality: {
    deep: Number(quality.counts?.deep || 0),
    usable: Number(quality.counts?.usable || 0),
    thin: Number(quality.counts?.thin || 0),
    unobservable: Number(quality.counts?.unobservable || 0),
    classificationDocumented: Number(quality.counts?.classification_review || 0),
    averageCoveragePercent: Number(funnelIndex.stats?.averageCoverage || 0),
  },
  documentedLimitations: {
    unavailableGalleryFiles: unavailableEvidenceDocumented,
    neutralLogoFallbacks: Number(summary.logos?.fallback || 0),
    technicalArtifactsExcluded: Number(summary.technicalArtifactsExcluded || 0),
    specialMarketRecords: Number(summary.completion?.specialMarketRecords || 0),
    unmappedRecords: Number(companyLocations.summary?.sin_punto || 0),
    explicitFunnelLimitations: documentedLimitations,
    pricingCoverage: priceCoverage,
    note: "La investigación utiliza únicamente evidencia pública consultable sin enviar formularios ni contactar a las empresas. La ausencia de datos se documenta; no se rellena con supuestos.",
  },
};

summary.generatedAt = finalAudit.generatedAt;
summary.completion = completion;
summary.priceCoverage = priceCoverage;
audit.generatedAt = finalAudit.generatedAt;
audit.completion = completion;
audit.finalAudit = {
  status: finalAudit.status,
  generatedAt: finalAudit.generatedAt,
  closureChecks,
  stageResidual,
  qaErrors,
  qaWarnings,
};

await Promise.all([
  writeJsonAtomic(SUMMARY_FILE, summary),
  writeJsonAtomic(AUDIT_FILE, audit),
  writeJsonAtomic(OUTPUT_FILE, finalAudit),
]);

console.log(JSON.stringify({ status: finalAudit.status, residualPending, recordsInProgress, closureChecks }, null, 2));
if (strict && !finished) process.exitCode = 1;
