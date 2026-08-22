import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const SCHEMA_VERSION = "rv-funnel-forensics-v1.1";
const DATA_FILE = "public/data/companies.json";
const QUEUE_FILE = "research/deep/queue.json";

const companies = JSON.parse(await readFile(DATA_FILE, "utf8"));
let previous = null;
try {
  previous = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
} catch {
  previous = null;
}

const previousById = new Map(
  previous?.schemaVersion === SCHEMA_VERSION
    ? (previous.items || []).map((item) => [item.id, item])
    : [],
);

function priorityFor(company) {
  const scopeRank = {
    "Núcleo — agencia/leadgen": 0,
    "Vertical — broker/marketplace": 1,
    "Adyacente — BPO/infraestructura": 2,
    "Excluir — fuente/no negocio": 3,
  }[company.scope] ?? 4;
  const decisionRank = {
    Copiar: 0,
    Adaptar: 1,
    Probar: 2,
    Vigilar: 3,
    Descartar: 4,
    "Sin decidir": 5,
  }[company.decision] ?? 5;
  const relationRank = company.relation === "Competidor directo" ? 0 : 1;
  return scopeRank * 1_000_000 + decisionRank * 100_000 + relationRank * 10_000 - (company.score || 0);
}

function bucketFor(company) {
  if (company.scope === "Núcleo — agencia/leadgen" && ["Copiar", "Adaptar"].includes(company.decision)) return "P0";
  if (company.scope === "Núcleo — agencia/leadgen" || company.relation === "Competidor directo") return "P1";
  if (company.scope === "Vertical — broker/marketplace" || company.scope === "Adyacente — BPO/infraestructura") return "P2";
  return "P3";
}

function cleanStage(stage, fallback) {
  if (!stage || typeof stage !== "object") return { status: fallback, attempts: 0, updatedAt: null };
  return {
    status: stage.status || fallback,
    attempts: Number(stage.attempts || 0),
    updatedAt: stage.updatedAt || null,
    error: stage.error || null,
  };
}

const items = companies.map((company) => {
  const old = previousById.get(company.id);
  return {
    id: company.id,
    name: company.name,
    website: company.website,
    country: company.country,
    scope: company.scope,
    decision: company.decision,
    relation: company.relation,
    score: company.score,
    priority: priorityFor(company),
    bucket: bucketFor(company),
    collect: cleanStage(old?.collect, "pending"),
    review: cleanStage(old?.review, "pending"),
    notion: cleanStage(old?.notion, "pending"),
    portal: cleanStage(old?.portal, "pending"),
    qa: cleanStage(old?.qa, "pending"),
    recordFile: old?.recordFile || `records/${company.id}.json`,
    limitation: old?.limitation || null,
  };
}).sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "es"));

function stageCounts(stage) {
  return items.reduce((counts, item) => {
    const value = item[stage].status;
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

const queue = {
  schemaVersion: SCHEMA_VERSION,
  createdAt: previous?.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  policy: {
    canonicalRecords: companies.length,
    onlyMainAgentWritesNotion: true,
    noFormSubmission: true,
    noContact: true,
    publicSourcesOnly: true,
    evidenceLabels: ["observado", "inferido", "no observable", "no aplica"],
    completionRule: "Cada registro termina únicamente con QA completo y limitaciones explícitas.",
  },
  stats: {
    total: items.length,
    collect: stageCounts("collect"),
    review: stageCounts("review"),
    notion: stageCounts("notion"),
    portal: stageCounts("portal"),
    qa: stageCounts("qa"),
  },
  items,
};

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

await writeJsonAtomic(QUEUE_FILE, queue);
console.log(JSON.stringify(queue.stats, null, 2));
