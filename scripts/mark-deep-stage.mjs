import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const stage = arg("--stage");
const status = arg("--status");
const ids = String(arg("--ids", "")).split(",").filter(Boolean);
const error = arg("--error");
if (!["collect", "review", "notion", "portal", "qa"].includes(stage)) throw new Error("Etapa no válida");
if (!status || !ids.length) throw new Error("Faltan --status o --ids");

const queueFile = "research/deep/queue.json";
const queue = JSON.parse(await readFile(queueFile, "utf8"));
const idSet = new Set(ids);
let changed = 0;
for (const item of queue.items) {
  if (!idSet.has(item.id)) continue;
  item[stage] = {
    status,
    attempts: (item[stage]?.attempts || 0) + 1,
    updatedAt: new Date().toISOString(),
    error: error || null,
  };
  changed += 1;
}
queue.updatedAt = new Date().toISOString();
queue.stats[stage] = queue.items.reduce((counts, item) => {
  counts[item[stage].status] = (counts[item[stage].status] || 0) + 1;
  return counts;
}, {});

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

await writeJsonAtomic(queueFile, queue);
console.log(JSON.stringify({ changed, stage, status }));
