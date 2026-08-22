import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";

const forbiddenProductNames = /\bRadar\s+Mundial\b|\bUniverso\s+Activo\b/i;
const firstPartyJson = [
  "public/data/summary.json",
  "public/data/audit.json",
  "public/data/portal-quality.json",
  "public/data/final-audit.json",
  "public/data/editorial.json",
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.(?:ts|tsx|css)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

test("the first-party interface and strategy use only the canonical RedVitalia name", async () => {
  const files = [...await sourceFiles("app"), ...firstPartyJson, "README.md", "DEPLOYMENT.md"];
  const failures = [];
  for (const path of files) {
    const text = await readFile(path, "utf8");
    if (forbiddenProductNames.test(text)) failures.push(relative(".", path).replaceAll("\\", "/"));
  }
  assert.deepEqual(failures, [], `Nombres de producto retirados: ${failures.join(", ")}`);
});

test("legitimate competitor copy containing radar remains evidence, not product naming", async () => {
  const record = JSON.parse(await readFile("public/data/funnel-v3/records/clientify.json", "utf8"));
  assert.match(JSON.stringify(record), /Radar B2B/i);
  assert.equal(record.format, "rv-funnel-forensics-public-v3");
});
