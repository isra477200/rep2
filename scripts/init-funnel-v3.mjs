import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const ROOT = "research/deep";
const SOURCE_QUEUE = `${ROOT}/queue.json`;
const OUTPUT_QUEUE = `${ROOT}/v3/queue.json`;
const RENDERED_DIR = `${ROOT}/v3/rendered`;
const MANUAL_ROOTS = [ROOT, "../../agent-handoffs"];

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

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

function stage(status = "pending") {
  return { status, attempts: 0, updatedAt: null, error: null };
}

function stageCounts(items, key) {
  return items.reduce((counts, item) => {
    const status = item[key]?.status || "missing";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function priority(item) {
  const bucket = { P0: 4_000_000, P1: 3_000_000, P2: 2_000_000, P3: 1_000_000 }[item.bucket] || 0;
  const scope = item.scope === "Núcleo — agencia/leadgen" ? 400_000
    : item.scope === "Vertical — broker/marketplace" ? 300_000
      : item.scope === "Adyacente — BPO/infraestructura" ? 200_000
        : 0;
  const limited = item.qa?.verificationLevel === "Limitada" ? 50_000 : 0;
  return bucket + scope + limited + Math.max(0, Number(item.score || 0)) * 100;
}

const source = JSON.parse(await readFile(SOURCE_QUEUE, "utf8"));
let previous = null;
try { previous = JSON.parse(await readFile(OUTPUT_QUEUE, "utf8")); } catch { previous = null; }
const previousById = new Map((previous?.items || []).map((item) => [item.id, item]));

const manualById = new Map();
for (const root of MANUAL_ROOTS) {
  for (const file of await walkJson(root)) {
    if (/\\v3\\queue\.json$/i.test(file) || /(?:manifest|qa-report|queue)\.json$/i.test(file)) continue;
    try {
      const value = JSON.parse(await readFile(file, "utf8"));
      const schema = String(value.schemaVersion || "");
      const normalizedFile = file.replaceAll("\\", "/");
      const isManualSchema = schema.includes("manual") || schema === "rv-funnel-forensics-v3";
      const isManualLocation = root !== ROOT || /\/manual(?:-|\/)/i.test(normalizedFile);
      const id = value.recordId || (isManualSchema ? value.id : null);
      if (!id || !isManualSchema || !isManualLocation) continue;
      const rows = manualById.get(id) || [];
      rows.push(relative(".", file).replaceAll("\\", "/"));
      manualById.set(id, rows);
    } catch {
      // A malformed research handoff is ignored here and will be surfaced by its own QA.
    }
  }
}

// The renderer runs several workers in parallel. A late queue checkpoint from one
// worker must never hide a completed artifact written by another worker, so the
// filesystem is the source of truth when the renderer is stopped and V3 is
// initialised/reconciled.
const renderedById = new Map();
for (const file of await walkJson(RENDERED_DIR)) {
  try {
    const value = JSON.parse(await readFile(file, "utf8"));
    const id = value.recordId || value.id || file.split(/[\\/]/).at(-1)?.replace(/\.json$/i, "");
    if (!id) continue;
    renderedById.set(id, {
      status: Array.isArray(value.pages) && value.pages.length ? "render_complete" : "limited",
      updatedAt: value.completedAt || value.updatedAt || null,
      error: Array.isArray(value.errors) && value.errors.length && !(value.pages || []).length
        ? `${value.errors.length} bloqueo(s) técnico(s) documentado(s)`
        : null,
    });
  } catch {
    // Malformed rendered files remain visible to the downstream QA.
  }
}

const items = source.items.map((item) => {
  const existing = previousById.get(item.id);
  const preservedManualSources = (existing?.manualSources || []).filter((file) =>
    /(?:^|\/)agent-handoffs\/|(?:^|\/)research\/deep\/manual(?:-|\/)/i.test(String(file).replaceAll("\\", "/")),
  );
  const manualSources = [...new Set([...preservedManualSources, ...(manualById.get(item.id) || [])])];
  const excluded = item.scope === "Excluir — fuente/no negocio";
  const rendered = renderedById.get(item.id);
  const research = excluded
    ? { ...(existing?.research || stage()), status: "classification_review", error: null }
    : rendered
      ? { ...(existing?.research || stage()), ...rendered }
      : existing?.research || stage(manualSources.length ? "evidence_ready" : "pending");
  return {
    id: item.id,
    name: item.name,
    website: item.website,
    country: item.country,
    scope: item.scope,
    decision: item.decision,
    relation: item.relation,
    score: item.score,
    bucket: item.bucket,
    priority: priority(item),
    sourceRecord: item.recordFile ? `${ROOT}/${item.recordFile}` : null,
    sourceReview: `${ROOT}/reviews/${item.id}.json`,
    manualSources,
    research,
    synthesis: existing?.synthesis || stage(),
    notion: existing?.notion || stage(),
    portal: existing?.portal || stage(),
    qa: existing?.qa || stage(),
    limitation: existing?.limitation || null,
  };
}).sort((a, b) => b.priority - a.priority || b.score - a.score || a.name.localeCompare(b.name, "es"));

const queue = {
  schemaVersion: "rv-funnel-forensics-v3-queue-1",
  createdAt: previous?.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  policy: {
    protocol: "../../agent-handoffs/V3_RESEARCH_PROTOCOL.md",
    canonicalDestination: "Notion ficha madre",
    publicGetOnly: true,
    formSubmissionAllowed: false,
    companyContactAllowed: false,
  },
  stats: {},
  items,
};
queue.stats = {
  total: items.length,
  research: stageCounts(items, "research"),
  synthesis: stageCounts(items, "synthesis"),
  notion: stageCounts(items, "notion"),
  portal: stageCounts(items, "portal"),
  qa: stageCounts(items, "qa"),
};

await writeJsonAtomic(OUTPUT_QUEUE, queue);
console.log(JSON.stringify(queue.stats, null, 2));
