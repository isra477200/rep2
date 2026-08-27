import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const outputPath = path.join(
  root,
  "public",
  "data",
  "competitive-intelligence.json",
);
const scriptPath = path.join(
  root,
  "scripts",
  "build-competitive-intelligence.mjs",
);

const runBuilder = () =>
  execFileSync(process.execPath, [scriptPath], { cwd: root, encoding: "utf8" });
const load = (file) => JSON.parse(readFileSync(file, "utf8"));

runBuilder();
const intelligence = load(outputPath);
const companies = load(
  path.join(root, "public", "data", "companies-index.json"),
);
const corpus = load(path.join(root, "public", "data", "ad-corpus.json"));

test("el builder es determinista mientras no cambien las fuentes", () => {
  const before = readFileSync(outputPath);
  runBuilder();
  const after = readFileSync(outputPath);
  assert.deepEqual(after, before);
});

test("publica el contrato canónico completo con cobertura material", () => {
  assert.equal(intelligence.schemaVersion, "rv-competitive-intelligence-v1");
  for (const key of [
    "scope",
    "methodology",
    "summary",
    "companyDna",
    "marketGaps",
    "playbooks",
    "offerMatrix",
    "patternLibrary",
    "hypothesisRanking",
  ]) {
    assert.ok(Object.hasOwn(intelligence, key), `falta ${key}`);
  }
  assert.ok(intelligence.summary.eligibleCompanies >= 250);
  assert.ok(intelligence.summary.uniqueIdentities >= 1_000);
  assert.ok(intelligence.summary.trustedSemanticIdentities >= 800);
  assert.ok(intelligence.patternLibrary.length >= 25);
  assert.ok(intelligence.playbooks.length >= 6);
  assert.equal(
    intelligence.companyDna.length,
    intelligence.summary.eligibleCompanies,
  );
  assert.equal(
    intelligence.offerMatrix.rows.length,
    intelligence.companyDna.length,
  );
  assert.equal(
    new Set(intelligence.companyDna.map((row) => row.companyId)).size,
    intelligence.companyDna.length,
  );
  for (const fingerprint of Object.values(
    intelligence.methodology.sourceFingerprints,
  ))
    assert.match(fingerprint, /^[a-f0-9]{64}$/);
});

test("la cohorte no contiene fichas adyacentes, excluidas ni cuarentena conocida", () => {
  const companyById = new Map(
    companies.map((company) => [company.id, company]),
  );
  const forbiddenKnown = new Set([
    "a9ent",
    "armando-ia",
    "fotocasa-pro",
    "ryt-school",
    "tu-equipo-ia",
    "gen-ia-lab",
    "motorsano-iberica",
    "odental-agency",
    "pbm-steph-comonfort",
    "sixbitsmedia",
    "building-blocks",
  ]);
  const allowedIds = new Set(
    intelligence.companyDna.map((row) => row.companyId),
  );
  for (const row of intelligence.companyDna) {
    const source = companyById.get(row.companyId);
    assert.ok(source, `ficha inexistente: ${row.companyId}`);
    assert.equal(source.primaryCountry || source.country, "España");
    assert.match(source.scope, /^(Núcleo|Vertical)\b/);
    assert.equal(row.eligibility.adjacentOrQuarantined, false);
    assert.ok(
      !forbiddenKnown.has(row.companyId),
      `contaminación conocida: ${row.companyId}`,
    );
  }
  for (const pattern of intelligence.patternLibrary) {
    for (const evidence of pattern.evidence)
      assert.ok(allowedIds.has(evidence.companyId));
  }
  for (const hypothesis of intelligence.hypothesisRanking.items) {
    for (const evidence of hypothesis.evidence)
      assert.ok(allowedIds.has(evidence.companyId));
  }
});

test("deduplica identidades y mantiene denominadores ponderados por empresa", () => {
  assert.equal(
    intelligence.summary.rawCorpusRows - intelligence.summary.uniqueIdentities,
    intelligence.summary.duplicateRowsCollapsed,
  );
  assert.ok(intelligence.summary.duplicateRowsCollapsed > 0);
  assert.equal(
    intelligence.companyDna.reduce(
      (sum, company) => sum + company.metrics.uniqueIdentities,
      0,
    ),
    intelligence.summary.uniqueIdentities,
  );
  for (const pattern of intelligence.patternLibrary) {
    assert.ok(pattern.metrics.companies <= pattern.denominator.companies);
    assert.equal(
      pattern.metrics.adoptionPct,
      Math.round(
        (pattern.metrics.companies / pattern.denominator.companies) * 1_000,
      ) / 10,
    );
    assert.ok(pattern.metrics.uniqueIdentities >= pattern.metrics.companies);
    assert.ok(pattern.metrics.companies >= 3);
    assert.ok(pattern.evidence.length <= 4);
    assert.equal(
      new Set(pattern.evidence.map((item) => item.companyId)).size,
      pattern.evidence.length,
    );
  }
});

test("huecos y ofertas publican denominadores válidos y porcentajes coherentes", () => {
  for (const vertical of intelligence.marketGaps.verticals) {
    assert.ok(vertical.denominator.companies >= 4);
    assert.ok(
      vertical.denominator.landingCompanies <= vertical.denominator.companies,
    );
    assert.ok(vertical.gaps.length <= 5);
    for (const gap of vertical.gaps) {
      assert.equal(gap.denominatorCompanies, vertical.denominator.companies);
      assert.ok(gap.observedCompanies <= gap.denominatorCompanies);
      assert.equal(
        gap.adoptionPct,
        Math.round((gap.observedCompanies / gap.denominatorCompanies) * 1_000) /
          10,
      );
      assert.ok(Math.abs(gap.adoptionPct + gap.gapPct - 100) <= 0.11);
      assert.equal(gap.measurementStatus, "observed_frequency");
      assert.equal(gap.opportunityStatus, "inferred_hypothesis");
      assert.ok(gap.evidence.length <= 3);
    }
  }
  const grouped = intelligence.marketGaps.groupedSignals;
  const verticalReadings = intelligence.marketGaps.verticals.flatMap(
    (vertical) =>
      vertical.gaps.map((gap) => `${vertical.verticalId}:${gap.signalId}`),
  );
  assert.ok(grouped.length > 0);
  assert.equal(grouped.length, intelligence.summary.distinctGapSignals);
  assert.equal(
    new Set(grouped.map((gap) => gap.signalId)).size,
    grouped.length,
  );
  assert.ok(grouped.length < verticalReadings.length);
  assert.equal(
    grouped.reduce((sum, gap) => sum + gap.verticalCount, 0),
    verticalReadings.length,
  );
  for (const gap of grouped) {
    assert.equal(gap.verticalCount, gap.verticals.length);
    assert.ok(gap.observedCompanies <= gap.denominatorCompanies);
    assert.equal(
      gap.adoptionPct,
      Math.round((gap.observedCompanies / gap.denominatorCompanies) * 1_000) /
        10,
    );
    assert.ok(Math.abs(gap.adoptionPct + gap.gapPct - 100) <= 0.11);
    assert.ok(gap.evidence.length <= 6);
    assert.equal(
      new Set(gap.verticals.map((vertical) => vertical.verticalId)).size,
      gap.verticals.length,
    );
  }
  const offer = intelligence.offerMatrix;
  assert.equal(offer.denominatorCompanies, offer.rows.length);
  assert.equal(
    offer.summary.publicPriceObserved,
    offer.rows.filter((row) => row.pricing.status === "observed_attributed")
      .length,
  );
  assert.equal(
    offer.summary.guaranteeObserved,
    offer.rows.filter((row) => row.guarantee.status === "observed_attributed")
      .length,
  );
  for (const row of offer.rows) {
    assert.ok(row.evidence.length <= 1);
    if (row.pricing.status === "not_observed")
      assert.equal(row.pricing.excerpt, null);
    if (row.guarantee.status === "not_observed")
      assert.equal(row.guarantee.excerpt, null);
  }
});

test("ranking limita componentes a 0–100 y reproduce exactamente la fórmula", () => {
  const defaultWeights = {
    adoption: 25,
    activity: 20,
    longevity: 15,
    variants: 15,
    format: 10,
    landingCoherence: 15,
  };
  assert.ok(intelligence.hypothesisRanking.items.length > 0);
  for (const item of intelligence.hypothesisRanking.items) {
    assert.equal(item.claimStatus, "hypothesis");
    assert.ok(item.evidence.length <= 3);
    const available = Object.entries(item.components).filter(
      ([, value]) => value !== null,
    );
    for (const [, value] of available) assert.ok(value >= 0 && value <= 100);
    const weight = available.reduce(
      (sum, [key]) => sum + defaultWeights[key],
      0,
    );
    const score =
      available.reduce(
        (sum, [key, value]) => sum + value * defaultWeights[key],
        0,
      ) / weight;
    assert.ok(
      Math.abs(item.score - Math.round(score * 10) / 10) <= 0.11,
      `${item.patternId}: ${item.score} vs ${score}`,
    );
    assert.equal(item.availableWeight, weight);
    assert.deepEqual(
      item.weightsApplied,
      Object.fromEntries(available.map(([key]) => [key, defaultWeights[key]])),
    );
  }
});

test("las evidencias publicitarias son trazables al corpus y están acotadas", () => {
  const evidenceIds = new Set(
    corpus.items.flatMap((ad) => [ad.externalId, ad.corpusKey]).filter(Boolean),
  );
  for (const company of intelligence.companyDna) {
    assert.ok(company.evidence.adExamples.length <= 3);
    for (const category of Object.values(company.signals)) {
      assert.ok(category.values.length <= 8);
      for (const value of category.values) {
        assert.ok(value.evidence.length <= 3);
        for (const evidence of value.evidence) {
          if (evidence.sourceType === "ad_copy")
            assert.ok(
              evidenceIds.has(evidence.adId),
              `ID no trazable: ${evidence.adId}`,
            );
        }
      }
    }
  }
});

test("el lenguaje separa observación, inferencia y rendimiento", () => {
  assert.equal(
    intelligence.methodology.status,
    "descriptive_not_performance_validated",
  );
  assert.match(
    intelligence.methodology.note,
    /no demuestran conversión, causalidad ni rendimiento/i,
  );
  assert.match(
    intelligence.hypothesisRanking.disclaimer,
    /no contiene métricas de rendimiento/i,
  );
  for (const pattern of intelligence.patternLibrary) {
    assert.equal(pattern.observationStatus, "observed_frequency");
    assert.equal(pattern.whenToUse.status, "inferred_recommendation");
    assert.match(
      pattern.saturationMeaning,
      /no equivale a fatiga ni rendimiento/i,
    );
  }
  for (const item of intelligence.hypothesisRanking.items) {
    assert.doesNotMatch(
      item.claim,
      /ganador|demuestra|convierte mejor|funciona mejor/i,
    );
    assert.match(item.interpretation, /necesita métricas propias/i);
    assert.ok(item.successMetric);
  }
  assert.equal(
    new Set(intelligence.hypothesisRanking.items.map((item) => item.claim))
      .size,
    intelligence.hypothesisRanking.items.length,
  );
  assert.equal(
    new Set(
      intelligence.hypothesisRanking.items.map((item) => item.interpretation),
    ).size,
    intelligence.hypothesisRanking.items.length,
  );
  for (const playbook of intelligence.playbooks) {
    assert.match(playbook.summary, new RegExp(playbook.label, "i"));
    assert.ok(
      Object.values(playbook.observedModules).every((module) =>
        ["observed_frequency", "not_observed"].includes(module.status),
      ),
    );
    assert.ok(
      playbook.opportunityTests.every(
        (item) => item.status === "inferred_hypothesis",
      ),
    );
  }
});
