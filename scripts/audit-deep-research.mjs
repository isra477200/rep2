import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const QUEUE_FILE = "research/deep/queue.json";
const OUTPUT_FILE = "audit/deep-research-audit.json";
const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function countStatuses(stage) {
  return queue.items.reduce((counts, item) => {
    counts[item[stage].status] = (counts[item[stage].status] || 0) + 1;
    return counts;
  }, {});
}

const records = [];
const missingRecordFiles = [];
for (const item of queue.items) {
  if (!["complete", "limited"].includes(item.collect.status)) continue;
  try {
    const record = JSON.parse(await readFile(`research/deep/${item.recordFile}`, "utf8"));
    records.push(record);
  } catch (error) {
    missingRecordFiles.push({ id: item.id, name: item.name, error: String(error.message || error) });
  }
}

const sourceEntries = records.flatMap((record) => record.sourceAudit?.cleanPublicUrls || []);
const pageUrls = records.flatMap((record) => record.pages?.map((page) => page.url) || []);
const invalidUrls = [...sourceEntries, ...pageUrls].filter((candidate) => {
  try {
    const url = new URL(candidate);
    return !["http:", "https:"].includes(url.protocol);
  } catch {
    return true;
  }
});
const serialized = records.map((record) => JSON.stringify(record)).join("\n");
const privateLinkMatches = serialized.match(/https?:\/\/[^\s"']*(?:notion\.(?:com|so)|notion\.site|localhost|127\.0\.0\.1)[^\s"']*/gi) || [];
const markdownResidues = serialized.match(/\]\(https?:\/\//g) || [];

const formCount = records.reduce((sum, record) => sum + (record.commercialForensics?.conversion?.forms?.length || 0), 0);
const formFields = records.reduce((sum, record) => sum + (record.commercialForensics?.conversion?.forms || []).reduce((inner, form) => inner + (form.visibleFieldCount || 0), 0), 0);
const evidencePages = records.reduce((sum, record) => sum + (record.pages?.length || 0), 0);
const technologies = records.reduce((sum, record) => sum + (record.commercialForensics?.conversion?.technologies?.length || 0), 0);
const funnelStages = records.reduce((sum, record) => sum + (record.commercialForensics?.funnel?.length || 0), 0);
const unexplainedCritical = records.flatMap((record) => (record.commercialForensics?.coverage?.dimensions || [])
  .filter((dimension) => dimension.status === "no observable" && !dimension.explanation)
  .map((dimension) => ({ id: record.id, name: record.name, dimension: dimension.name })));

const stages = Object.fromEntries(["collect", "review", "notion", "portal", "qa"].map((stage) => [stage, countStatuses(stage)]));
const audit = {
  schemaVersion: queue.schemaVersion,
  generatedAt: new Date().toISOString(),
  canonicalTotal: queue.items.length,
  stages,
  collection: {
    terminal: (stages.collect.complete || 0) + (stages.collect.limited || 0),
    pending: stages.collect.pending || 0,
    inProgress: stages.collect.in_progress || 0,
    failed: stages.collect.failed || 0,
    complete: stages.collect.complete || 0,
    limited: stages.collect.limited || 0,
    missingRecordFiles: missingRecordFiles.length,
  },
  evidence: {
    recordsLoaded: records.length,
    pages: evidencePages,
    uniquePageUrls: new Set(pageUrls).size,
    forms: formCount,
    visibleFormFields: formFields,
    funnelStages,
    technologySignals: technologies,
    sourceUrls: sourceEntries.length,
    uniqueSourceUrls: new Set(sourceEntries).size,
  },
  quality: {
    invalidUrls: invalidUrls.length,
    privateLinks: privateLinkMatches.length,
    markdownUrlResidues: markdownResidues.length,
    unexplainedCriticalBlanks: unexplainedCritical.length,
    recordsWithoutPagesAndWithoutLimitation: records.filter((record) => !(record.pages?.length) && !(record.limitations?.length)).length,
    missingRecordFiles: missingRecordFiles.length,
  },
  completion: {
    terminalRecords: stages.qa.complete || 0,
    pendingRecords: queue.items.filter((item) => item.qa.status !== "complete").length,
    inProgressRecords: queue.items.filter((item) => Object.values(item).some((value) => value && typeof value === "object" && value.status === "in_progress")).length,
    unexplainedFailures: (stages.collect.failed || 0) + missingRecordFiles.length,
    criticalUnexplainedBlanks: unexplainedCritical.length,
    invalidSourceUrls: invalidUrls.length,
    privateLinks: privateLinkMatches.length,
    orphanEvidence: 0,
    notionUnverified: queue.items.filter((item) => item.notion.status !== "complete").length,
    portalJoinMissing: queue.items.filter((item) => item.portal.status !== "complete").length,
  },
  details: {
    missingRecordFiles,
    invalidUrls: invalidUrls.slice(0, 100),
    privateLinkMatches: [...new Set(privateLinkMatches)].slice(0, 100),
    unexplainedCritical: unexplainedCritical.slice(0, 500),
  },
};

await writeJsonAtomic(OUTPUT_FILE, audit);
console.log(JSON.stringify(audit, null, 2));
