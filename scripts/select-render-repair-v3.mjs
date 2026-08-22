import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const INPUT = "research/deep/v3/rendered-quality.json";
const OUTPUT = "research/deep/v3/render-repair-target.json";
const RECOVERABLE = new Set([
  "missing_rendered_pages",
  "no_commercial_page",
  "root_missing",
  "fewer_than_six_commercial_pages",
  "thin_visible_copy",
  "conversion_route_not_observed",
  "offer_economics_route_not_observed",
  "fewer_than_two_evidence_screenshots",
  "embedded_capture_not_inventoried",
]);

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

const audit = JSON.parse(await readFile(INPUT, "utf8"));
const candidates = audit.rows
  .filter((row) => row.quality !== "classification_review")
  .map((row) => ({
    ...row,
    recoverableReasons: row.repairReasons.filter((reason) => RECOVERABLE.has(reason)),
  }))
  .filter((row) => {
    if (["thin", "unobservable"].includes(row.quality)) return true;
    return row.quality === "usable"
      && row.priority >= 3_000_000
      && row.recoverableReasons.length > 0;
  })
  .sort((left, right) => {
    const qualityRank = { unobservable: 3, thin: 2, usable: 1 };
    return qualityRank[right.quality] - qualityRank[left.quality]
      || right.priority - left.priority
      || left.name.localeCompare(right.name, "es");
  });

const reasonCounts = {};
for (const row of candidates) {
  for (const reason of row.recoverableReasons) {
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
}

const output = {
  format: "rv-render-repair-target-v3",
  generatedAt: new Date().toISOString(),
  sourceAudit: INPUT,
  policy: "Todos los expedientes thin/unobservable y los usable de prioridad >= 3M con una carencia técnicamente recuperable. No reintenta expedientes solo por objeciones, prueba o iframe no inspeccionable.",
  total: candidates.length,
  counts: candidates.reduce((result, row) => {
    result[row.quality] = (result[row.quality] || 0) + 1;
    return result;
  }, {}),
  reasonCounts,
  ids: candidates.map((row) => row.id),
  records: candidates.map((row) => ({
    id: row.id,
    name: row.name,
    priority: row.priority,
    quality: row.quality,
    pages: row.pages,
    screenshots: row.screenshots,
    recoverableReasons: row.recoverableReasons,
  })),
};

await writeJsonAtomic(OUTPUT, output);
console.log(JSON.stringify({ output: OUTPUT, total: output.total, counts: output.counts, reasonCounts }, null, 2));
