import { readFile, rename, writeFile } from "node:fs/promises";

const queuePath = "research/deep/queue.json";
const reportPath = "research/deep/classification-review-excluded.json";
const allowedScopes = new Set([
  "Núcleo — agencia/leadgen",
  "Vertical — broker/marketplace",
  "Adyacente — BPO/infraestructura",
  "Excluir — fuente/no negocio",
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function atomicJson(path, value) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

const [queue, report] = await Promise.all([
  readJson(queuePath),
  readJson(reportPath),
]);

if (!report.qa?.passed) {
  throw new Error("La revisión de clasificación no ha superado su control de calidad.");
}
if (report.records?.length !== report.qa.expectedRecords) {
  throw new Error("La revisión de clasificación no contiene el lote completo esperado.");
}

const queueById = new Map(queue.items.map((item) => [item.id, item]));
const counts = new Map();
let changed = 0;

for (const classification of report.records) {
  if (!allowedScopes.has(classification.recommendedScope)) {
    throw new Error(`Alcance no permitido para ${classification.id}.`);
  }
  const item = queueById.get(classification.id);
  if (!item) throw new Error(`No existe ${classification.id} en la cola.`);

  const recordPath = `research/deep/${item.recordFile}`;
  const record = await readJson(recordPath);
  const nextValues = {
    scope: classification.recommendedScope,
    relation: classification.recommendedRelation,
    decision: classification.recommendedDecision,
  };

  if (
    item.scope !== nextValues.scope ||
    item.relation !== nextValues.relation ||
    item.decision !== nextValues.decision
  ) changed += 1;

  Object.assign(item, nextValues);
  Object.assign(record, nextValues, {
    classificationReview: {
      reviewedAt: report.generatedAt,
      previousScope: classification.currentScope,
      reason: classification.reason,
      confidence: classification.confidence,
      doubt: classification.doubt || null,
      evidence: classification.evidence,
    },
  });
  await atomicJson(recordPath, record);
  counts.set(nextValues.scope, (counts.get(nextValues.scope) || 0) + 1);
}

queue.updatedAt = new Date().toISOString();
await atomicJson(queuePath, queue);

console.log(JSON.stringify({
  reviewed: report.records.length,
  changed,
  scopes: Object.fromEntries(counts),
}, null, 2));
