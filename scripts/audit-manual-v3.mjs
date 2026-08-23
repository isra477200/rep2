import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const QUEUE_FILE = "research/deep/v3/queue.json";
const OUTPUT_FILE = "research/deep/v3/manual-source-quality.json";
const ROOTS = ["../../agent-handoffs", "research/deep"];
const VALID_STATUSES = new Set(["observado", "inferido", "no observable", "no aplica"]);
const REQUIRED_DIMENSIONS = [
  "classification",
  "messageArchitecture",
  "acquisition",
  "ctaLadder",
  "captureAndQualification",
  "funnel",
  "offerEconomics",
  "proofAndTrust",
  "objectionsAndSales",
  "technologyAndNurture",
  "deliveryOperations",
  "competitiveAssessment",
];

async function walkJson(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true, recursive: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(entry.parentPath || entry.path || root, entry.name));
  } catch {
    return [];
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function isPublicUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(host) || /\.notion\.site$/i.test(host)) return false;
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    const queryKeys = [...url.searchParams.keys()].join(" ");
    return !/(?:x-amz-|signature|signed|private[-_]?token|access[-_]?token|auth[-_]?token)/i.test(queryKeys);
  } catch {
    return false;
  }
}

function normalizedName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:inc|llc|ltd|sl|slu|gmbh|operator|operador|marca|grupo|company|co)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function clean(value) {
  return String(value ?? "").trim();
}

function collectClaimChecks(value, evidenceIds, errors, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectClaimChecks(child, evidenceIds, errors, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  const row = value;
  if (typeof row.status === "string" && !VALID_STATUSES.has(row.status)) {
    errors.push({ code: "invalid_status", path, value: row.status });
  }
  const cited = Array.isArray(row.evidenceIds) ? row.evidenceIds : [];
  for (const id of cited) {
    if (!evidenceIds.has(id)) errors.push({ code: "missing_evidence_reference", path, value: id });
  }
  const materialText = [row.statement, row.text, row.detail, row.finding, row.answer, row.claim]
    .find((item) => typeof item === "string" && item.trim().length >= 12);
  if (materialText && typeof row.status === "string" && row.status !== "no aplica" && !cited.length) {
    errors.push({ code: "material_claim_without_evidence", path, value: materialText.slice(0, 180) });
  }
  for (const [key, child] of Object.entries(row)) {
    if (key === "evidence" || key === "evidenceIds" || key === "supports") continue;
    collectClaimChecks(child, evidenceIds, errors, `${path}.${key}`);
  }
}

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const canonicalById = new Map(queue.items.map((item) => [item.id, item]));
const files = [];
for (const root of ROOTS) {
  for (const file of await walkJson(root)) {
    const normalized = file.replaceAll("\\", "/");
    if (root === "research/deep" && !/\/manual(?:-|\/)/i.test(normalized)) continue;
    files.push(file);
  }
}

const rows = [];
for (const file of [...new Set(files)]) {
  let review;
  try { review = JSON.parse(await readFile(file, "utf8")); } catch { continue; }
  if (review.schemaVersion !== "rv-funnel-forensics-v3") continue;
  const errors = [];
  const warnings = [];
  const canonical = canonicalById.get(review.recordId);
  if (!canonical) errors.push({ code: "orphan_record_id", value: review.recordId || null });
  else if (normalizedName(review.name) !== normalizedName(canonical.name)) {
    warnings.push({ code: "canonical_name_alias", supplied: review.name, canonical: canonical.name });
  }
  const missingDimensions = REQUIRED_DIMENSIONS.filter((key) => review[key] === undefined || review[key] === null);
  if (missingDimensions.length) errors.push({ code: "missing_dimensions", value: missingDimensions });
  if (!Array.isArray(review.funnel) || review.funnel.length !== 12) {
    errors.push({ code: "invalid_funnel_stage_count", value: Array.isArray(review.funnel) ? review.funnel.length : null });
  }
  const evidence = Array.isArray(review.evidence) ? review.evidence : [];
  const ids = evidence.map((item) => item?.id).filter(Boolean);
  const evidenceIds = new Set(ids);
  if (evidenceIds.size !== ids.length) errors.push({ code: "duplicate_evidence_id" });
  for (const item of evidence) {
    if (!item?.id) errors.push({ code: "evidence_without_id" });
    const unavailable = item?.url === null
      && item?.status === "no disponible documentada"
      && clean(item?.limitation)
      && !(item?.supports || []).length;
    if (!unavailable && !isPublicUrl(item?.url)) errors.push({ code: "non_public_evidence_url", value: item?.url || null });
    for (const related of item?.relatedUrls || []) {
      if (!isPublicUrl(related)) errors.push({ code: "non_public_related_url", value: related });
    }
  }
  collectClaimChecks(review, evidenceIds, errors);
  rows.push({
    file: relative(".", file).replaceAll("\\", "/"),
    recordId: review.recordId,
    name: review.name,
    canonicalName: canonical?.name || null,
    dimensions: REQUIRED_DIMENSIONS.filter((key) => review[key] !== undefined && review[key] !== null).length,
    funnelStages: Array.isArray(review.funnel) ? review.funnel.length : 0,
    evidence: evidence.length,
    errors,
    warnings,
    result: errors.length ? "FAIL" : "PASS",
  });
}

const recordCounts = rows.reduce((map, row) => map.set(row.recordId, (map.get(row.recordId) || 0) + 1), new Map());
const duplicateManualCoverage = [...recordCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([recordId, count]) => ({ recordId, count, files: rows.filter((row) => row.recordId === recordId).map((row) => row.file) }));
const report = {
  schemaVersion: "rv-funnel-manual-source-quality-v3",
  generatedAt: new Date().toISOString(),
  totalReviews: rows.length,
  uniqueCanonicalRecords: new Set(rows.filter((row) => canonicalById.has(row.recordId)).map((row) => row.recordId)).size,
  pass: rows.filter((row) => row.result === "PASS").length,
  fail: rows.filter((row) => row.result === "FAIL").length,
  orphanRecordIds: rows.filter((row) => row.errors.some((error) => error.code === "orphan_record_id")).length,
  duplicateManualCoverage,
  rows,
};
await writeJsonAtomic(OUTPUT_FILE, report);
console.log(JSON.stringify({
  totalReviews: report.totalReviews,
  uniqueCanonicalRecords: report.uniqueCanonicalRecords,
  pass: report.pass,
  fail: report.fail,
  orphanRecordIds: report.orphanRecordIds,
  duplicateManualCoverage: duplicateManualCoverage.length,
}, null, 2));
if (report.fail) process.exitCode = 1;
