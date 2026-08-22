import { readFile, rename, writeFile } from "node:fs/promises";

const QUEUE_FILE = "research/deep/queue.json";
const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const selected = onlyIndex >= 0 ? String(args[onlyIndex + 1] || "").split(",").filter(Boolean) : [];
let reset = 0;

for (const item of queue.items) {
  if (selected.length && !selected.includes(item.id) && !selected.includes(item.name)) continue;
  item.collect = { status: "pending", attempts: 0, updatedAt: new Date().toISOString(), error: null };
  item.review = { status: "pending", attempts: 0, updatedAt: null, error: null };
  item.notion = { status: "pending", attempts: 0, updatedAt: null, error: null };
  item.portal = { status: "pending", attempts: 0, updatedAt: null, error: null };
  item.qa = { status: "pending", attempts: 0, updatedAt: null, error: null };
  item.limitation = null;
  reset += 1;
}

queue.updatedAt = new Date().toISOString();
queue.stats = Object.fromEntries(["collect", "review", "notion", "portal", "qa"].map((stage) => [stage, queue.items.reduce((counts, item) => {
  counts[item[stage].status] = (counts[item[stage].status] || 0) + 1;
  return counts;
}, {})]));
const temporary = `${QUEUE_FILE}.tmp`;
await writeFile(temporary, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
await rename(temporary, QUEUE_FILE);
console.log(JSON.stringify({ reset, selected: selected.length ? selected : "all" }, null, 2));
