import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const fullPath = "public/data/companies.json";
const indexPath = "public/data/companies-index.json";
const detailsDirectory = "public/data/company-details";

test("the initial company index is an exact lightweight 712-record projection", async () => {
  const [full, index, fullStat, indexStat] = await Promise.all([
    readFile(fullPath, "utf8").then(JSON.parse),
    readFile(indexPath, "utf8").then(JSON.parse),
    stat(fullPath),
    stat(indexPath),
  ]);
  assert.equal(full.length, 712);
  assert.equal(index.length, 712);
  assert.deepEqual(index.map((row) => row.id), full.map((row) => row.id));
  assert.ok(index.every((row) => row.body === "" && Array.isArray(row.sources) && !row.sources.length));
  assert.ok(indexStat.size < fullStat.size * 0.35, `Índice inicial demasiado pesado: ${indexStat.size}/${fullStat.size}`);
});

test("every full dossier and source list loads from one matching per-company file", async () => {
  const full = await readFile(fullPath, "utf8").then(JSON.parse);
  const files = (await readdir(detailsDirectory)).filter((name) => name.endsWith(".json")).sort();
  assert.equal(files.length, 712);
  assert.deepEqual(files, full.map((row) => `${row.id}.json`).sort());
  for (const company of full) {
    const detail = JSON.parse(await readFile(`${detailsDirectory}/${company.id}.json`, "utf8"));
    assert.equal(detail.id, company.id);
    assert.equal(detail.body, company.body);
    assert.deepEqual(detail.sources, company.sources);
  }
});
