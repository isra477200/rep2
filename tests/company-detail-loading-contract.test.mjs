import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const fullPath = "public/data/companies.json";
const indexPath = "public/data/companies-index.json";
const detailsDirectory = "public/data/company-details";

// El catálogo único = 712 fichas madre (proyección exacta de companies.json),
// fichas en verificación (id "amp-...") y altas suplementarias ya confirmadas.
const isVerification = (row) => row.id.startsWith("amp-");

test("the initial company index is an exact lightweight projection (712 mother records + verification records)", async () => {
  const [full, index, fullStat, indexStat] = await Promise.all([
    readFile(fullPath, "utf8").then(JSON.parse),
    readFile(indexPath, "utf8").then(JSON.parse),
    stat(fullPath),
    stat(indexPath),
  ]);
  const motherIds = new Set(full.map((row) => row.id));
  const mother = index.filter((row) => motherIds.has(row.id));
  const verification = index.filter(isVerification);
  const supplemental = index.filter(
    (row) => !motherIds.has(row.id) && !isVerification(row),
  );
  assert.equal(full.length, 712);
  assert.equal(mother.length, 712);
  assert.deepEqual(mother.map((row) => row.id), full.map((row) => row.id));
  assert.equal(new Set(index.map((row) => row.id)).size, index.length);
  assert.equal(index.length, mother.length + verification.length + supplemental.length);
  assert.ok(index.every((row) => row.body === "" && Array.isArray(row.sources) && !row.sources.length));
  assert.ok(verification.every((row) => row.evidence === "Probable" && row.review === "No aplica"), "toda ficha en verificación declara su nivel honesto");
  assert.ok(
    supplemental.every(
      (row) =>
        row.review === "Completa" ||
        (row.scrapeCreatorsManaged === true &&
          row.review === "Revisión estructurada de anuncios y destinos públicos" &&
          row.reviewedAt) ||
        (row.serpApiManaged === true &&
          row.review === "Revisión estructurada SerpAPI y landing pública" &&
          row.reviewedAt) ||
        (row.leadMarketManaged === true &&
          row.review === "Ficha estructurada; requiere revisión profunda de landing/entidad cuando no existe dominio confirmado" &&
          row.reviewedAt),
    ),
    "toda alta suplementaria está revisada y declara el método",
  );
  assert.ok(indexStat.size < fullStat.size * 0.45, `Índice inicial demasiado pesado: ${indexStat.size}/${fullStat.size}`);
});

test("every catalog dossier and source list loads from one matching per-company file", async () => {
  const [full, index] = await Promise.all([
    readFile(fullPath, "utf8").then(JSON.parse),
    readFile(indexPath, "utf8").then(JSON.parse),
  ]);
  const indexById = new Map(index.map((row) => [row.id, row]));
  const files = (await readdir(detailsDirectory)).filter((name) => name.endsWith(".json")).sort();
  assert.equal(files.length, index.length);
  const expected = index.map((row) => `${row.id}.json`).sort();
  assert.deepEqual(files, expected);
  for (const company of full) {
    const detail = JSON.parse(await readFile(`${detailsDirectory}/${company.id}.json`, "utf8"));
    assert.equal(detail.id, company.id);
    const row = indexById.get(company.id);
    const enriched = Boolean(
      row?.serpApiReviewedAt ||
      row?.leadMarketSnapshotId ||
      row?.scrapeCreatorsSnapshotId,
    );
    if (enriched) {
      assert.ok(detail.body.startsWith(company.body), `${company.id}: el enriquecimiento debe conservar el dossier madre`);
      assert.ok(
        company.sources.every((source) => detail.sources.includes(source)),
        `${company.id}: el enriquecimiento debe conservar las fuentes madre`,
      );
    } else {
      assert.equal(detail.body, company.body);
      assert.deepEqual(detail.sources, company.sources);
    }
  }
  for (const row of index.filter((item) => !full.some((company) => company.id === item.id))) {
    const detail = JSON.parse(await readFile(`${detailsDirectory}/${row.id}.json`, "utf8"));
    assert.equal(detail.id, row.id);
    if (isVerification(row)) {
      assert.ok(detail.body.length > 0, "el dossier en verificación documenta su estado");
    }
    assert.equal(typeof detail.body, "string");
    assert.ok(Array.isArray(detail.sources));
  }
});
