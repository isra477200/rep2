import { readFile } from "node:fs/promises";
import { normalizeNotionId, selectPlanRecords } from "./notion-v3-sync-utils.mjs";

const PLAN_FILE = "research/deep/v3/notion-plan.json";
const QUEUE_FILE = "research/deep/v3/queue.json";

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

const plan = JSON.parse(await readFile(PLAN_FILE, "utf8"));
const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const requested = new Set(argument("ids").split(",").map(normalizeNotionId).filter(Boolean));
const pendingOnly = process.argv.includes("--pending");
const offset = Math.max(0, Number(argument("offset") || 0));
const limit = Math.max(0, Number(argument("limit") || 0));
const records = selectPlanRecords(plan.records, queue.items, {
  requested,
  pendingOnly,
  offset,
  limit,
});
if (process.argv.includes("--manifest")) {
  console.log(JSON.stringify(records.map((record) => ({
    id: record.id,
    name: record.name,
    publicId: record.publicId,
    digest: record.digest,
    serializedLength: JSON.stringify(record).length,
  }))));
  process.exit(0);
}

const chunkRecordId = normalizeNotionId(argument("record"));
if (chunkRecordId) {
  const record = plan.records.find((candidate) => normalizeNotionId(candidate.id) === chunkRecordId);
  if (!record) throw new Error(`Registro no encontrado: ${chunkRecordId}`);
  const serialized = JSON.stringify(record);
  const start = Math.max(0, Number(argument("start") || 0));
  const length = Math.max(1, Math.min(20_000, Number(argument("length") || 12_000)));
  console.log(JSON.stringify({
    id: record.id,
    start,
    total: serialized.length,
    chunk: serialized.slice(start, start + length),
  }));
  process.exit(0);
}

for (const record of records) process.stdout.write(`${JSON.stringify(record)}\n`);
