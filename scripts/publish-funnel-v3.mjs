import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const QUEUE_FILE = "research/deep/v3/queue.json";
const REVIEW_DIR = "research/deep/v3/reviews";
const RENDERED_DIR = "research/deep/v3/rendered";
const ID_MAP_FILE = "research/deep/public-id-map.json";
const OUTPUT_DIR = "public/data/funnel-v3/records";
const INDEX_FILE = "public/data/funnel-v3/index.json";
const EVIDENCE_MEDIA_DIR = "public/evidence";
const DIMENSION_KEYS = [
  "classification", "messageArchitecture", "acquisition", "ctaLadder", "captureAndQualification",
  "offerEconomics", "proofAndTrust", "objectionsAndSales", "technologyAndNurture", "deliveryOperations",
  "competitiveAssessment",
];
const STATUS_KEYS = ["observado", "inferido", "no observable", "no aplica"];

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safePublicUrl(value) {
  try {
    const raw = clean(value);
    if (!raw || raw.endsWith("\\") || /\[\[[^\]]+\]\]/.test(raw)) return null;
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (/^(?:l|lm)\.facebook\.com$/i.test(url.hostname) && url.pathname === "/l.php") {
      const destination = url.searchParams.get("u");
      return destination ? safePublicUrl(destination) : null;
    }
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(url.hostname) || /\.notion\.site$/i.test(url.hostname)) return null;
    if (/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) return null;
    if (/(?:^|\.)validate\.perfdrive\.com$/i.test(url.hostname)) return null;
    if ([...url.searchParams.keys()].some((key) => /^(?:token|signature|x-amz-|x-goog-)/i.test(key))) return null;
    if (/^redvitalia\.srv1480016\.hstgr\.cloud$/i.test(url.hostname) && /(?:^|\/)(?:research\/deep|agent-handoffs|\.codex)(?:\/|$)/i.test(url.pathname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|fbclid|gclid|msclkid|mc_)/i.test(key)) url.searchParams.delete(key);
    if (/^request\.angi\.com$/i.test(url.hostname) && /^\/service-request\//i.test(url.pathname)) url.search = "";
    return url.href;
  } catch { return null; }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, path);
}

async function readOptional(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

function stageCounts(items, key) {
  return items.reduce((counts, item) => {
    const status = item[key]?.status || "missing";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

const forbiddenText = /\bnotion\b|Puente\s+(?:de\s+)?IA|file:\/\/|[A-Z]:\\Users\\|\/Users\/|\.codex|research\/deep|agent-handoffs|manual-wave|RV-FUNNEL|RVC-|RV-PUB-|Bandeja de registro|Origen de la migraci[oó]n/i;

function sanitize(value, privateIdPattern, key = "") {
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((child) => sanitize(child, privateIdPattern, key)).filter((child) => child !== undefined);
  if (typeof value === "object") {
    const output = {};
    for (const [childKey, child] of Object.entries(value)) {
      if (/^(?:schemaVersion|recordId|portalId|marker|sourceFile|sourceRecord|sourceReview|manualSources|privateLinksIncluded|automaticQueueModified|recordsModified|reviewsModified)$/i.test(childKey)) continue;
      const sanitized = sanitize(child, privateIdPattern, childKey);
      if (sanitized !== undefined) output[childKey] = sanitized;
    }
    return output;
  }
  const text = String(value)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    // eslint-disable-next-line no-control-regex -- elimina controles inválidos del JSON público.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (/url|href|source|destination/i.test(key) && /^https?:/i.test(text)) return safePublicUrl(text) || undefined;
  if (privateIdPattern.test(text) || forbiddenText.test(text)) return undefined;
  return text;
}

function primaryCta(review) {
  const row = review.ctaLadder?.primary;
  return clean(row?.text || row?.label || row);
}

function headline(review) {
  return clean(review.messageArchitecture?.headline || review.messageArchitecture?.promise);
}

function formStats(review) {
  const forms = Array.isArray(review.captureAndQualification?.forms) ? review.captureAndQualification.forms : [];
  return {
    forms: forms.length,
    fields: forms.reduce((sum, form) => sum + Number(form.visibleFieldCount || form.fields?.length || 0), 0),
    requiredFields: forms.reduce((sum, form) => sum + Number(form.requiredFieldCount || 0), 0),
  };
}

function emptyStatusCounts() {
  return Object.fromEntries(STATUS_KEYS.map((status) => [status, 0]));
}

function addStatus(target, status) {
  const normalized = STATUS_KEYS.includes(status) ? status : "no observable";
  target[normalized] = (target[normalized] || 0) + 1;
}

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const idMap = JSON.parse(await readFile(ID_MAP_FILE, "utf8")).ids || {};
const privateIds = Object.keys(idMap);
const dashedUuid = (value) => `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
const privateIdPattern = new RegExp(privateIds.flatMap((id) => [id, dashedUuid(id)]).join("|"), "i");
if (queue.items.length !== 712 || privateIds.length !== 712) throw new Error("La publicación V3 exige una biyección exacta de 712 fichas.");

const rows = [];
const globallyUniqueEvidenceUrls = new Set();
const dimensionCounts = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, emptyStatusCounts()]));
const funnelStageCounts = new Map();
let recordsWithNumericPublicPrice = 0;
for (const item of queue.items) {
  if (item.synthesis?.status !== "complete" || item.qa?.status !== "complete") throw new Error(`Ficha V3 no aprobada: ${item.name}.`);
  const publicId = idMap[item.id];
  if (!publicId) throw new Error(`Falta identidad pública para ${item.name}.`);
  const review = await readOptional(`${REVIEW_DIR}/${item.id}.json`);
  if (!review) throw new Error(`Falta revisión V3: ${item.name}.`);
  const rendered = await readOptional(`${RENDERED_DIR}/${item.id}.json`);
  const screenshots = [];
  for (const [index, source] of (rendered?.pages || []).map((page) => page.screenshot).filter(Boolean).slice(0, 2).entries()) {
    const absolute = resolve(source);
    const allowedRoot = `${resolve("research/deep/v3/screens")}${sep}`;
    if (!absolute.startsWith(allowedRoot)) throw new Error(`Captura fuera del directorio autorizado: ${item.name}.`);
    const destination = `${EVIDENCE_MEDIA_DIR}/${publicId}/funnel-${String(index + 1).padStart(2, "0")}.webp`;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(absolute, destination);
    const buffer = await readFile(destination);
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") throw new Error(`Captura inválida: ${destination}.`);
    screenshots.push({
      file: `/${destination.replaceAll("\\", "/").replace(/^public\//, "")}`,
      type: "image/webp",
      bytes: (await stat(destination)).size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      label: `Evidencia visual pública ${index + 1}`,
    });
  }
  const sanitized = sanitize(review, privateIdPattern);
  const publicReview = {
    ...sanitized,
    format: "rv-funnel-forensics-public-v3",
    id: publicId,
    name: item.name,
    reviewedAt: review.reviewedAt,
    status: item.scope === "Excluir — fuente/no negocio" ? "Clasificación documentada" : "Auditoría comercial verificada",
    coveragePercent: Number(review.coveragePercent || 0),
    verification: {
      qa: "verificada",
      manualEvidence: Boolean(item.manualSources?.length),
      publicGetOnly: true,
      formsSubmitted: false,
      companyContacted: false,
    },
    evidenceScreenshots: screenshots,
  };
  delete publicReview.qa;
  await writeJsonAtomic(`${OUTPUT_DIR}/${publicId}.json`, publicReview);
  const stats = formStats(publicReview);
  const recordEvidenceUrls = new Set(
    (Array.isArray(publicReview.evidence) ? publicReview.evidence : [])
      .map((source) => safePublicUrl(source?.url))
      .filter(Boolean),
  );
  const usableEvidenceReferences = (Array.isArray(publicReview.evidence) ? publicReview.evidence : [])
    .filter((source) => safePublicUrl(source?.url)).length;
  for (const url of recordEvidenceUrls) globallyUniqueEvidenceUrls.add(url);
  for (const key of DIMENSION_KEYS) addStatus(dimensionCounts[key], publicReview[key]?.status);
  for (const stage of publicReview.funnel || []) {
    if (!funnelStageCounts.has(stage.stage)) funnelStageCounts.set(stage.stage, emptyStatusCounts());
    addStatus(funnelStageCounts.get(stage.stage), stage.status);
  }
  const normalizedAmount = publicReview.offerEconomics?.normalizedPrice?.amount;
  const manualConversions = publicReview.offerEconomics?.manualPriceConversions || [];
  if (Number.isFinite(normalizedAmount) || manualConversions.some((row) => Number.isFinite(row?.local?.amount))) {
    recordsWithNumericPublicPrice += 1;
  }
  rows.push({
    id: publicId,
    name: item.name,
    status: publicReview.status,
    scope: item.scope,
    coveragePercent: publicReview.coveragePercent,
    headline: headline(publicReview),
    primaryCta: primaryCta(publicReview) || null,
    forms: stats.forms,
    fields: stats.fields,
    requiredFields: stats.requiredFields,
    evidence: Array.isArray(publicReview.evidence) ? publicReview.evidence.length : 0,
    usableEvidenceReferences,
    unavailableEvidenceReferences: (Array.isArray(publicReview.evidence) ? publicReview.evidence.length : 0) - usableEvidenceReferences,
    uniqueEvidenceUrls: recordEvidenceUrls.size,
    screenshots: screenshots.length,
    manualEvidence: Boolean(item.manualSources?.length),
    limitations: Array.isArray(publicReview.limitations) ? publicReview.limitations.length : 0,
  });
  item.portal = { status: "complete", attempts: (item.portal?.attempts || 0) + 1, updatedAt: new Date().toISOString(), error: null };
}

rows.sort((left, right) => right.coveragePercent - left.coveragePercent || left.name.localeCompare(right.name, "es"));
const index = {
  format: "rv-funnel-forensics-public-index-v3",
  generatedAt: new Date().toISOString(),
  stats: {
    total: rows.length,
    verified: rows.length,
    manualEvidence: rows.filter((row) => row.manualEvidence).length,
    withForms: rows.filter((row) => row.forms).length,
    forms: rows.reduce((sum, row) => sum + row.forms, 0),
    visibleFields: rows.reduce((sum, row) => sum + row.fields, 0),
    evidence: rows.reduce((sum, row) => sum + row.evidence, 0),
    evidenceReferences: rows.reduce((sum, row) => sum + row.evidence, 0),
    usableEvidenceReferences: rows.reduce((sum, row) => sum + row.usableEvidenceReferences, 0),
    unavailableEvidenceReferences: rows.reduce((sum, row) => sum + row.unavailableEvidenceReferences, 0),
    uniqueEvidenceUrlsWithinRecords: rows.reduce((sum, row) => sum + row.uniqueEvidenceUrls, 0),
    uniqueEvidenceUrlsGlobal: globallyUniqueEvidenceUrls.size,
    screenshots: rows.reduce((sum, row) => sum + row.screenshots, 0),
    averageCoverage: Math.round((rows.reduce((sum, row) => sum + row.coveragePercent, 0) / rows.length) * 10) / 10,
  },
  insights: {
    coverageBands: [
      { label: "75–100%", count: rows.filter((row) => row.coveragePercent >= 75).length },
      { label: "50–74%", count: rows.filter((row) => row.coveragePercent >= 50 && row.coveragePercent < 75).length },
      { label: "25–49%", count: rows.filter((row) => row.coveragePercent >= 25 && row.coveragePercent < 50).length },
      { label: "0–24%", count: rows.filter((row) => row.coveragePercent < 25).length },
    ],
    commercialSignals: {
      primaryCtaObserved: rows.filter((row) => row.primaryCta).length,
      withForms: rows.filter((row) => row.forms).length,
      withoutForms: rows.filter((row) => !row.forms).length,
      recordsWithNumericPublicPrice,
      manualEvidence: rows.filter((row) => row.manualEvidence).length,
      explicitLimitations: rows.reduce((sum, row) => sum + row.limitations, 0),
    },
    dimensions: DIMENSION_KEYS.map((key) => ({ key, ...dimensionCounts[key] })),
    funnelStages: [...funnelStageCounts.entries()].map(([stage, counts]) => ({
      stage,
      ...counts,
      observedPercent: Math.round(((counts.observado || 0) / rows.length) * 1_000) / 10,
    })),
  },
  records: rows,
};
await writeJsonAtomic(INDEX_FILE, index);

const latest = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const portalById = new Map(queue.items.map((item) => [item.id, item.portal]));
latest.items = latest.items.map((item) => ({ ...item, portal: portalById.get(item.id) || item.portal }));
latest.updatedAt = new Date().toISOString();
latest.stats.portal = stageCounts(latest.items, "portal");
await writeJsonAtomic(QUEUE_FILE, latest);
console.log(JSON.stringify(index.stats, null, 2));
