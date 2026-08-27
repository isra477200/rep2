import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));

const source = readJson("db/leads-market-spain-2026-08-26.json");
const snapshot = readJson("public/data/lead-market-snapshot.json");
const review = readJson("scripts/data/leads-market-company-review.json");
const canonicalReview = readJson("scripts/data/scrapecreators-company-map.json");
const curatedCompanies = readJson("db/leads-market-companies.json");
const companies = readJson("public/data/companies-index.json");
const corpus = readJson("public/data/ad-corpus.json");

const matchedPageIds = new Set(
  [review, canonicalReview].flatMap((sourceReview) =>
    Object.entries(sourceReview.pageIds || {})
      .filter(([, value]) => value.status === "matched")
      .map(([pageId]) => pageId),
  ),
);
const matchedCompanyIds = new Set(
  Object.values(review.pageIds)
    .filter((value) => value.status === "matched")
    .map((value) => value.companyId),
);

test("el informe se importa como JSON estricto y conserva sus límites", () => {
  assert.equal(source.schema, "redvitalia-lead-market-ads-v1");
  assert.equal(source.items.length, 173);
  assert.equal(new Set(source.items.map((item) => item.externalId)).size, 173);
  assert.equal(new Set(source.items.map((item) => item.pageId)).size, 58);
  assert.equal(new Set(source.items.map((item) => item.copyBodySha256)).size, 71);
  assert.equal(new Set(source.items.map((item) => item.media.sha256)).size, 141);
  assert.equal(snapshot.kpis.analyzedAds, 733);
  assert.equal(snapshot.kpis.detailedCreatives, 173);
  assert.equal(snapshot.kpis.uniqueCopyBodies, 71);
  assert.equal(snapshot.kpis.uniqueImages, 141);
  assert.equal(snapshot.cloneClusters.length, 4);
  assert.equal(snapshot.cloneClusters.filter((cluster) => !cluster.countConsistent).length, 1);
  assert.match(snapshot.methodology.limitation, /no permite reconstruir/i);
});

test("las 173 evidencias visuales existen y coinciden con su SHA-256", () => {
  for (const item of source.items) {
    assert.match(item.externalId, /^\d{10,}$/);
    assert.match(item.media.localFile, /^\/media\/lead-market-meta-/);
    assert.match(item.media.sha256, /^[a-f0-9]{64}$/);
    const absoluteFile = resolve(root, "public", item.media.localFile.replace(/^\/+/, ""));
    assert(existsSync(absoluteFile), item.media.localFile);
    assert.equal(
      createHash("sha256").update(readFileSync(absoluteFile)).digest("hex"),
      item.media.sha256,
      item.media.localFile,
    );
  }
});

test("la revisión editorial separa altas, observación y cuarentena", () => {
  const statuses = Object.values(review.pageIds).reduce((counts, value) => {
    counts[value.status] = (counts[value.status] || 0) + 1;
    return counts;
  }, {});
  assert.equal(matchedCompanyIds.size, 23);
  assert(statuses.quarantine > 0);
  assert(statuses.watchlist > 0);
  assert.equal(snapshot.editorialReview.matchedCompanyIds, 23);
  assert.equal(snapshot.editorialReview.quarantinedPageIds, statuses.quarantine);
  assert.equal(snapshot.editorialReview.watchlistPageIds, statuses.watchlist);
  for (const company of curatedCompanies) {
    assert(matchedCompanyIds.has(company.id), company.id);
    assert(companies.some((item) => item.id === company.id), company.id);
    assert(existsSync(resolve(root, `public/data/company-details/${company.id}.json`)), company.id);
  }
});

test("el corpus solo atribuye páginas aprobadas y marca el estudio", () => {
  const imported = corpus.items.filter(
    (item) => item.researchSnapshotId === snapshot.id,
  );
  assert(imported.length > 0);
  assert(imported.every((item) => matchedPageIds.has(String(item.pageId || ""))));
  assert(imported.every((item) => item.evidenceLayers.includes("informe_mercado_leads")));
  assert.equal(new Set(imported.map((item) => item.externalId)).size, imported.length);

  const quarantineIds = new Set(
    Object.entries(review.pageIds)
      .filter(([, value]) => value.status === "quarantine")
      .map(([pageId]) => pageId),
  );
  assert.equal(imported.filter((item) => quarantineIds.has(item.pageId)).length, 0);
});

test("las cifras monetarias solo se etiquetan como precio tras revisión", () => {
  const reviewedPrices = new Map([
    ["2076944506550929", "10 €/lead"],
    ["1403656351829330", "10 €/lead"],
    ["1377645054476359", "10 €/lead"],
    ["1072452485525268", "10 €/lead"],
    ["1551160893052106", "79,99 €/mes"],
    ["1748414716364402", "129 €/mes"],
    ["1967587027234094", "19 €/mes"],
  ]);
  const imported = corpus.items.filter(
    (item) => item.researchSnapshotId === snapshot.id,
  );
  for (const item of imported) {
    if (reviewedPrices.has(item.externalId)) {
      assert.equal(item.precioVisible, reviewedPrices.get(item.externalId));
      assert.equal(item.priceEvidenceRole, "offer_price_reviewed");
    } else {
      assert.equal(item.precioVisible, "");
      assert.equal(item.priceEvidenceRole, "currency_mentions_not_treated_as_price");
    }
  }
});
