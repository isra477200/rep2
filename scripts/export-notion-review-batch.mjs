import { readFile } from "node:fs/promises";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const limit = Math.max(1, Number(arg("--limit", 5)));
const requestedIds = new Set(String(arg("--ids", "")).split(",").filter(Boolean));
const queue = JSON.parse(await readFile("research/deep/queue.json", "utf8"));
const candidates = queue.items
  .filter((item) => item.review.status === "complete")
  .filter((item) => ["pending", "failed", "in_progress"].includes(item.notion.status))
  .filter((item) => requestedIds.size === 0 || requestedIds.has(item.id))
  .slice(0, limit);

const batch = [];
for (const item of candidates) {
  const review = JSON.parse(await readFile(`research/deep/reviews/${item.id}.json`, "utf8"));
  const verifiedStatus = item.qa?.status === "complete" && item.qa?.verificationLevel
    ? item.qa.verificationLevel
    : review.status;
  batch.push({
    id: item.id,
    name: item.name,
    marker: review.marker,
    properties: {
      ...review.notionProperties,
      "Funnel V2 estado": verifiedStatus,
      "Alcance megaestudio": item.scope,
      "Relación con RedVitalia": item.relation,
      "Decisión RedVitalia": item.decision,
    },
    markdown: review.notionMarkdown.replace(
      /\*\*Estado:\*\*\s*[^·\n]+(?=\s*·)/g,
      `**Estado:** ${verifiedStatus}`,
    ),
  });
}

process.stdout.write(JSON.stringify(batch));
