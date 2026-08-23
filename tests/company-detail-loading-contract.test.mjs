import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const fullPath = "public/data/companies.json";
const indexPath = "public/data/companies-index.json";
const detailsDirectory = "public/data/company-details";

// El catálogo único = 712 fichas madre (proyección exacta de companies.json)
// + fichas en verificación integradas por scripts/integrate-ampliacion.mjs (id "amp-...").
const isVerification = (row) => row.id.startsWith("amp-");

test("the initial company index is an exact lightweight projection (712 mother records + verification records)", async () => {
  const [full, index, fullStat, indexStat] = await Promise.all([
    readFile(fullPath, "utf8").then(JSON.parse),
    readFile(indexPath, "utf8").then(JSON.parse),
    stat(fullPath),
    stat(indexPath),
  ]);
  const mother = index.filter((row) => !isVerification(row));
  const verification = index.filter(isVerification);
  assert.equal(full.length, 712);
  assert.equal(mother.length, 712);
  assert.deepEqual(mother.map((row) => row.id), full.map((row) => row.id));
  assert.ok(verification.length >= 0);
  assert.ok(index.every((row) => row.body === "" && Array.isArray(row.sources) && !row.sources.length));
  assert.ok(verification.every((row) => row.evidence === "Probable" && row.review === "No aplica"), "toda ficha en verificación declara su nivel honesto");
  assert.ok(indexStat.size < fullStat.size * 0.45, `Índice inicial demasiado pesado: ${indexStat.size}/${fullStat.size}`);
});

test("every full dossier and source list loads from one matching per-company file", async () => {
  const [full, index] = await Promise.all([
    readFile(fullPath, "utf8").then(JSON.parse),
    readFile(indexPath, "utf8").then(JSON.parse),
  ]);
  const verification = index.filter(isVerification);
  const files = (await readdir(detailsDirectory)).filter((name) => name.endsWith(".json")).sort();
  assert.equal(files.length, full.length + verification.length);
  const expected = [...full.map((row) => `${row.id}.json`), ...verification.map((row) => `${row.id}.json`)].sort();
  assert.deepEqual(files, expected);
  for (const company of full) {
    const detail = JSON.parse(await readFile(`${detailsDirectory}/${company.id}.json`, "utf8"));
    assert.equal(detail.id, company.id);
    assert.equal(detail.body, company.body);
    assert.deepEqual(detail.sources, company.sources);
  }
  for (const row of verification) {
    const detail = JSON.parse(await readFile(`${detailsDirectory}/${row.id}.json`, "utf8"));
    assert.equal(detail.id, row.id);
    assert.ok(detail.body.length > 0, "el dossier en verificación documenta su estado");
    assert.ok(Array.isArray(detail.sources));
  }
});
