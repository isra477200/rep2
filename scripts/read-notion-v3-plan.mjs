import { readFile } from "node:fs/promises";

const PLAN_FILE = "research/deep/v3/notion-plan.json";
const QUEUE_FILE = "research/deep/v3/queue.json";

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

function normalizedId(value) {
  return String(value || "").replaceAll("-", "").trim().toLowerCase();
}

const plan = JSON.parse(await readFile(PLAN_FILE, "utf8"));
const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const requested = new Set(argument("ids").split(",").map(normalizedId).filter(Boolean));
const pendingOnly = process.argv.includes("--pending");
const offset = Math.max(0, Number(argument("offset") || 0));
const limit = Math.max(0, Number(argument("limit") || 0));
const queueById = new Map(queue.items.map((item) => [normalizedId(item.id), item]));

let records = plan.records.slice(offset, limit ? offset + limit : undefined).filter((record) => {
  const id = normalizedId(record.id);
  if (requested.size && !requested.has(id)) return false;
  if (pendingOnly && queueById.get(id)?.notion?.status === "complete") return false;
  return true;
});
for (const record of records) process.stdout.write(`${JSON.stringify(record)}\n`);
