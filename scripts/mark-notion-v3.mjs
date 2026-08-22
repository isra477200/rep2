import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const QUEUE_FILE = "research/deep/v3/queue.json";

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

function ids(name) {
  return new Set(argument(name).split(",").map((value) => value.replaceAll("-", "").trim()).filter(Boolean));
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

const complete = ids("complete");
const failed = ids("failed");
if (!complete.size && !failed.size) throw new Error("Indica --complete=id1,id2 o --failed=id3.");
for (const id of complete) if (failed.has(id)) throw new Error(`El ID ${id} aparece como completo y fallido.`);

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const known = new Set(queue.items.map((item) => item.id));
for (const id of [...complete, ...failed]) if (!known.has(id)) throw new Error(`ID ajeno a la cola: ${id}.`);

const now = new Date().toISOString();
for (const item of queue.items) {
  if (complete.has(item.id) && item.notion?.status !== "complete") {
    item.notion = {
      status: "complete",
      attempts: Number(item.notion?.attempts || 0) + 1,
      updatedAt: now,
      error: null,
    };
  } else if (failed.has(item.id)) {
    item.notion = {
      status: "error",
      attempts: Number(item.notion?.attempts || 0) + 1,
      updatedAt: now,
      error: "La sincronización no se confirmó; el registro debe reintentarse de forma idempotente.",
    };
  }
}
queue.updatedAt = now;
queue.stats.notion = queue.items.reduce((counts, item) => {
  const status = item.notion?.status || "missing";
  counts[status] = (counts[status] || 0) + 1;
  return counts;
}, {});
await writeJsonAtomic(QUEUE_FILE, queue);
console.log(JSON.stringify({ complete: complete.size, failed: failed.size, stats: queue.stats.notion }, null, 2));
