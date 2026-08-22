import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { readPublicIdentityMap } from "./public-identity.mjs";

const queueFile = "research/deep/queue.json";
const queue = JSON.parse(await readFile(queueFile, "utf8"));
const publicIds = await readPublicIdentityMap();

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(temporary, path);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error?.code) || attempt === 5) throw error;
      await delay(40 * (attempt + 1));
    }
  }
}

const dashedUuid = (value) => `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
const internalIdPattern = new RegExp(
  [...publicIds.keys()].flatMap((id) => [id, dashedUuid(id)]).sort((a, b) => b.length - a.length).join("|"),
  "i",
);
const privatePattern = new RegExp(
  [
    "notion\\.(?:com|so|site)",
    "notion-static\\.com",
    "notionusercontent\\.com",
    "Puente\\s+(?:de\\s+)?IA",
    "file:\\/\\/",
    "C:\\\\Users\\\\",
    "\\.codex",
    "portal-source-snapshot",
    "research\\/deep",
    "localhost",
    "(?:10|127|169\\.254|192\\.168|172\\.(?:1[6-9]|2\\d|3[01]))(?:\\.\\d{1,3}){3}",
    "[?&](?:X-Amz-(?:Credential|Signature|Security-Token)|spaceId|access_token|api_?key)=",
    "perfdrive\\.com",
  ].join("|"),
  "i",
);

function assertShareable(value, id) {
  const serialized = JSON.stringify(value);
  if (privatePattern.test(serialized) || internalIdPattern.test(serialized)) {
    throw new Error(`La salida de ${id} conserva una referencia no compartible`);
  }
  return value;
}

function isShareableUrl(input) {
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (
      /(?:^|\.)(?:notion\.(?:com|so|site)|notion-static\.com|notionusercontent\.com|perfdrive\.com)$/i.test(hostname) ||
      /^(?:localhost|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(hostname)
    ) return false;
    for (const key of url.searchParams.keys()) {
      if (/^(?:x-amz-|spaceid$|token$|access_token$|refresh_token$|api_?key$|signature$|credential$|authorization$)/i.test(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function cleanShareableUrl(input) {
  if (!isShareableUrl(input)) return "";
  const url = new URL(input);
  if (/^(?:l|lm)\.facebook\.com$/i.test(url.hostname) && url.pathname === "/l.php") {
    const destination = url.searchParams.get("u");
    return destination ? cleanShareableUrl(destination) : "";
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|fbclid|gclid|msclkid|mc_|h$)/i.test(key))
      url.searchParams.delete(key);
  }
  return url.href;
}

function cleanLegacyProjectNaming(value) {
  return String(value || "")
    .split(/(https?:\/\/[^\s<>"')\]]+)/gi)
    .map((part, index) => index % 2
      ? part
      : part
          .replace(/\bRadar\s+B2B\b/gi, "módulo de prospección B2B")
          .replace(/\bRadar\b/gi, "estudio")
          .replace(/\bUniverso\s+activo\b/gi, "cobertura activa"))
    .join("");
}

function cleanPublicText(value) {
  if (Array.isArray(value)) return value.map(cleanPublicText);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cleanPublicText(item)]),
    );
  }
  return typeof value === "string" ? cleanLegacyProjectNaming(value) : value;
}

const index = [];
let exported = 0;
for (const item of queue.items) {
  if (item.review.status !== "complete") continue;
  try {
    const publicId = publicIds.get(item.id);
    if (!publicId) throw new Error("No existe una identidad pública para la ficha");
    const review = JSON.parse(await readFile(`research/deep/reviews/${item.id}.json`, "utf8"));
    const publicManual = review.manual
      ? {
          ...Object.fromEntries(
            Object.entries(review.manual).filter(
              ([key]) => !["sourceFile", "schemaVersion", "wave"].includes(key),
            ),
          ),
          sources: (review.manual.sources || [])
            .map((source) => ({
              ...source,
              url: cleanShareableUrl(source.url),
            }))
            .filter((source) => source.url),
          reviewLabel: "Revisión manual contrastada",
        }
      : null;
    const verifiedStatus = item.qa?.status === "complete" && item.qa?.verificationLevel
      ? item.qa.verificationLevel
      : review.status;
    const manualReviewed = Boolean(publicManual);
    const researchReadiness = item.scope?.startsWith("Excluir")
      ? "not_applicable"
      : review.coveragePercent === 0
        ? manualReviewed ? "manual_only" : "no_observable"
        : verifiedStatus === "Limitada" || review.confidence === "Limitada" || review.coveragePercent < 50
          ? "partial"
          : "usable";
    const publicEvidence = review.evidence
      .map((source) => ({
        ...source,
        url: cleanShareableUrl(source.url),
      }))
      .filter((source) => source.url);
    const archivedEvidenceCount = review.evidence.length - publicEvidence.length;
    const publicReview = assertShareable(cleanPublicText({
      id: publicId,
      name: review.name,
      reviewedAt: review.reviewedAt,
      status: verifiedStatus,
      confidence: review.confidence,
      coveragePercent: review.coveragePercent,
      message: review.message,
      conversion: review.conversion,
      offer: review.offer,
      funnel: review.funnel,
      route: review.route,
      evidence: publicEvidence,
      archivedEvidenceCount,
      archivedEvidenceNote: archivedEvidenceCount
        ? "Los enlaces temporales o técnicos no compartibles se retiraron; los activos recuperables permanecen en la galería local de la ficha."
        : null,
      limitations: review.limitations,
      redVitalia: review.redVitalia,
      manual: publicManual,
      schemaValid: item.qa?.status === "complete",
      reviewMethod: manualReviewed ? "manual" : "automatic",
      researchReadiness,
    }), publicId);
    await writeJsonAtomic(`public/data/deep/records/${publicId}.json`, publicReview);
    const evidenceUrls = new Set([
      ...publicReview.evidence.map((source) => source.url),
      ...(publicReview.manual?.sources.map((source) => source.url) || []),
    ]);
    index.push({
      id: publicId,
      status: publicReview.status,
      confidence: publicReview.confidence,
      coveragePercent: publicReview.coveragePercent,
      hero: publicReview.message.hero,
      primaryCta: publicReview.conversion.primaryCta,
      captureType: publicReview.conversion.captureType,
      minFormFields: publicReview.conversion.formAnalysis.minFields,
      maxFormFields: publicReview.conversion.formAnalysis.maxFields,
      technologies: publicReview.conversion.technologies,
      evidenceCount: evidenceUrls.size,
      archivedEvidenceCount: publicReview.archivedEvidenceCount,
      automaticEvidenceCount: publicReview.evidence.length,
      manualEvidenceCount: publicReview.manual?.sources.length || 0,
      limitationCount: publicReview.limitations.length,
      manualReviewed: Boolean(publicReview.manual),
      manualLabel: publicReview.manual?.reviewLabel || null,
      bookingObserved: publicReview.conversion.bookingObserved,
      bookingIntentObserved: publicReview.conversion.captureType.startsWith("Agenda"),
      schemaValid: publicReview.schemaValid,
      reviewMethod: publicReview.reviewMethod,
      researchReadiness: publicReview.researchReadiness,
    });
    item.portal = { status: "complete", attempts: (item.portal.attempts || 0) + 1, updatedAt: new Date().toISOString(), error: null };
    exported += 1;
  } catch (error) {
    item.portal = { status: "failed", attempts: (item.portal.attempts || 0) + 1, updatedAt: new Date().toISOString(), error: String(error.message || error) };
  }
}

index.sort((a, b) => b.coveragePercent - a.coveragePercent || a.id.localeCompare(b.id));
const stats = {
  generatedAt: new Date().toISOString(),
  total: index.length,
  // `complete` remains for backwards compatibility and now means a review
  // that passed either manual or structural verification.
  complete: index.filter((item) => item.schemaValid).length,
  verified: index.filter((item) => item.status === "Verificada manual").length,
  schemaValid: index.filter((item) => item.schemaValid).length,
  automaticDrafts: index.filter((item) => item.status === "Borrador automático").length,
  manualVerified: index.filter((item) => item.status === "Verificada manual").length,
  structuralVerified: index.filter((item) => item.status === "Verificada estructural").length,
  limited: index.filter((item) => item.status === "Limitada").length,
  notApplicable: index.filter((item) => item.status === "No aplica verificado").length,
  highConfidence: index.filter((item) => item.confidence === "Alta").length,
  withForms: index.filter((item) => item.maxFormFields > 0).length,
  withBooking: index.filter((item) => item.bookingObserved).length,
  bookingObserved: index.filter((item) => item.bookingObserved).length,
  bookingIntentObserved: index.filter((item) => item.bookingIntentObserved).length,
  withWhatsApp: index.filter((item) => item.captureType === "WhatsApp" || item.technologies.includes("WhatsApp")).length,
  technologySignals: index.reduce((sum, item) => sum + item.technologies.length, 0),
  evidenceUrls: index.reduce((sum, item) => sum + item.evidenceCount, 0),
  archivedEvidenceAssets: index.reduce((sum, item) => sum + item.archivedEvidenceCount, 0),
  averageObservableCoverage: index.length ? Math.round(index.reduce((sum, item) => sum + item.coveragePercent, 0) / index.length) : 0,
  manualReviewed: index.filter((item) => item.manualReviewed).length,
  zeroObservableCoverage: index.filter((item) => item.coveragePercent === 0).length,
  limitedConfidence: index.filter((item) => item.confidence === "Limitada").length,
  readiness: index.reduce((counts, item) => {
    counts[item.researchReadiness] = (counts[item.researchReadiness] || 0) + 1;
    return counts;
  }, {}),
};
await writeJsonAtomic("public/data/deep/index.json", { stats, records: index });
const expectedRecordFiles = new Set(index.map((item) => `${item.id}.json`));
for (const name of await readdir("public/data/deep/records")) {
  if (name.endsWith(".json") && !expectedRecordFiles.has(name)) {
    await rm(`public/data/deep/records/${name}`, { force: true });
  }
}
queue.updatedAt = new Date().toISOString();
queue.stats.portal = queue.items.reduce((counts, item) => {
  counts[item.portal.status] = (counts[item.portal.status] || 0) + 1;
  return counts;
}, {});
await writeJsonAtomic(queueFile, queue);
console.log(JSON.stringify({ exported, stats, portal: queue.stats.portal }, null, 2));
