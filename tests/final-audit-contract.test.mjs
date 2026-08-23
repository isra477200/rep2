import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8"));

test("the published closure audit satisfies every exact completion condition", async () => {
  const [finalAudit, summary, funnelIndex] = await Promise.all([
    readJson("public/data/final-audit.json"),
    readJson("public/data/summary.json"),
    readJson("public/data/funnel-v3/index.json"),
  ]);

  assert.equal(finalAudit.status, "TERMINADO");
  assert.equal(summary.completion.status, "TERMINADO");
  assert.equal(finalAudit.totals.canonicalRecords, 712);
  assert.equal(finalAudit.totals.canonicalMotherRecords, 712);
  assert.equal(finalAudit.totals.canonicalChildRecords, 0);
  assert.equal(finalAudit.totals.publicCompanies, 712);
  assert.equal(finalAudit.totals.publicCompanyDetails, 712);
  assert.equal(finalAudit.totals.publicFunnelDossiers, 712);
  assert.equal(finalAudit.totals.canonicalRecordsSynchronized, 712);
  assert.equal(finalAudit.totals.publicPricesWithEuroEquivalent, 299);
  assert.equal(finalAudit.totals.companyIndexPricesWithEuroEquivalent, 245);
  assert.equal(finalAudit.totals.funnelV3PricesWithEuroEquivalent, 299);
  assert.equal(finalAudit.totals.funnelEvidenceReferences, 15236);
  assert.equal(finalAudit.totals.funnelEvidenceUrlsWithinRecords, 14782);
  assert.equal(finalAudit.totals.funnelEvidenceLinks, 14539);
  assert.equal(funnelIndex.stats.verified, 712);
  assert.equal(
    finalAudit.totals.mappedRecords + finalAudit.totals.unmappedRecords,
    712,
  );
  assert.equal(
    finalAudit.totals.publishedCoordinateRecords
      + finalAudit.totals.cityCenterRecords
      + finalAudit.totals.marketCenterRecords,
    finalAudit.totals.mappedRecords,
  );
  assert.equal(
    finalAudit.totals.authenticBrandAssets
      + finalAudit.totals.neutralLogoFallbacks,
    712,
  );

  for (const field of [
    "recordsInProgress",
    "residualPending",
    "motherlessRecords",
    "criticalEmptyUnexplained",
    "orphanMedia",
    "recordsWithoutPublicSource",
    "qaErrors",
    "qaWarnings",
  ]) {
    assert.equal(finalAudit.closure[field], 0, field);
  }
  assert.deepEqual(finalAudit.closure.stageResidual, {
    research: 0,
    synthesis: 0,
    qualityControl: 0,
    canonicalSync: 0,
    publicPortal: 0,
  });
  assert.ok(Object.values(finalAudit.closure.checks).every(Boolean));
  assert.equal(
    finalAudit.totals.galleryEvidence,
    summary.completion.availableEvidencePlaced,
  );
  assert.equal(
    finalAudit.documentedLimitations.unavailableGalleryFiles,
    summary.completion.unavailableEvidenceDocumented,
  );
  assert.equal(
    finalAudit.documentedLimitations.neutralLogoFallbacks,
    summary.logos.fallback,
  );
});

test("the closure artifact contains no private workspace or infrastructure reference", async () => {
  const text = await readFile(new URL("public/data/final-audit.json", root), "utf8");
  assert.doesNotMatch(
    text,
    /notion\.(?:com|so|site)|Puente\s+(?:de\s+)?IA|file:\/\/|[A-Z]:\\Users\\|\/Users\/|\.codex|agent-handoffs|research\/deep|RVC-|RV-PUB-/i,
  );
});
