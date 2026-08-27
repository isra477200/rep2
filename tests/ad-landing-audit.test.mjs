import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildAdLandingAudit } from "../scripts/build-ad-landing-audit.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, "..");
const OUTPUT = path.join(ROOT, "public/data/ad-landing-audit.json");
const data = JSON.parse(fs.readFileSync(OUTPUT, "utf8"));

test("el dataset enlaza las cinco fuentes requeridas y conserva trazabilidad", () => {
  assert.equal(data.schemaVersion, "rv-ad-landing-audit-v1");
  assert.deepEqual(Object.keys(data.sources).sort(), [
    "adCorpus",
    "companiesIndex",
    "landingIntelligence",
    "scrapecreatorsLandingAnalysis",
    "siteCaptures",
  ]);
  assert.ok(data.summary.companies >= 180);
  assert.equal(data.summary.companies, data.items.length);
  assert.ok(data.summary.withCapturedLanding >= 140);
  assert.ok(data.summary.totalAds > 3_000);
  assert.ok(
    data.items.every(
      (item) => item.companyId && item.companyName && item.landing,
    ),
  );
});

test("no observado queda fuera del índice y nunca equivale a cero de calidad", () => {
  for (const item of data.items) {
    const qualityDimensions = item.dimensions.filter(
      (dimension) => dimension.weight > 0,
    );
    for (const dimension of qualityDimensions) {
      if (dimension.status === "not_observed")
        assert.equal(
          dimension.score,
          null,
          `${item.companyId}/${dimension.id}`,
        );
    }
    const evaluated = qualityDimensions.filter((dimension) =>
      Number.isFinite(dimension.score),
    );
    const evaluatedWeight = evaluated.reduce(
      (sum, dimension) => sum + dimension.weight,
      0,
    );
    if (item.qualityScore === null) {
      assert.ok(evaluated.length < 3 || evaluatedWeight < 32.9, item.companyId);
      continue;
    }
    const expected = Math.round(
      evaluated.reduce(
        (sum, dimension) => sum + dimension.score * dimension.weight,
        0,
      ) / evaluatedWeight,
    );
    assert.equal(item.qualityScore, expected, item.companyId);
  }
});

test("la confianza y los estados no convierten falta de captura en una sentencia de calidad", () => {
  for (const item of data.items) {
    assert.ok(
      item.confidence.score >= 0 && item.confidence.score <= 100,
      item.companyId,
    );
    assert.ok(
      ["high", "medium", "low"].includes(item.confidence.label),
      item.companyId,
    );
    const capture = item.dimensions.find(
      (dimension) => dimension.id === "captureCoverage",
    );
    assert.ok(capture);
    if (capture.status === "not_observed") {
      assert.match(
        capture.rationale,
        /reduce confianza, no la nota de calidad/i,
      );
    }
    if (item.confidence.score < 35)
      assert.equal(item.state, "insufficient_evidence", item.companyId);
  }
});

test("cada conclusión conserva IDs/copies de anuncio y URL o captura de landing", () => {
  for (const item of data.items) {
    assert.equal(
      item.ads.total,
      item.ads.usableForAudit + item.ads.excludedFromSemantics,
      item.companyId,
    );
    for (const ad of item.ads.evidence) {
      assert.ok(ad.id || ad.corpusKey, item.companyId);
      assert.ok(ad.copy.length > 0, item.companyId);
    }
    if (item.qualityScore !== null) {
      assert.ok(
        item.ads.evidence.length > 0 &&
          (item.landing.capture.url || item.landing.capture.captureFile),
        item.companyId,
      );
    }
    if (item.landing.capture.captureFile) {
      assert.match(
        item.landing.capture.captureFile,
        /^\/evidence\//,
        item.companyId,
      );
    }
  }
});

test("STAMINA excluye del análisis semántico el boilerplate OCR del visor", () => {
  const item = data.items.find(
    (candidate) =>
      candidate.companyId === "stamina-marketing-marca-conseguir-pacientes",
  );
  assert.ok(item);
  assert.equal(item.ads.total, 13);
  assert.equal(item.ads.usableForAudit, 3);
  assert.equal(item.ads.excludedFromSemantics, 10);
  assert.equal(item.ads.evidence.length, 3);
  for (const evidence of item.ads.evidence) {
    assert.doesNotMatch(
      evidence.copy,
      /información sobre este anuncio puede variar/i,
    );
    assert.doesNotMatch(
      evidence.copy,
      /detalles del anuncio preguntas frecuentes/i,
    );
  }
});

test("las fugas y acciones solo nacen de señales evaluadas", () => {
  const actionTexts = [];
  for (const item of data.items) {
    const dimensions = new Map(
      item.dimensions.map((dimension) => [dimension.id, dimension]),
    );
    item.leaks.forEach((leak, index) => {
      assert.equal(leak.priority, index + 1, item.companyId);
      assert.equal(
        dimensions.get(leak.dimension)?.status,
        "leak",
        `${item.companyId}/${leak.dimension}`,
      );
      assert.ok(
        leak.finding && leak.action,
        `${item.companyId}/${leak.dimension}`,
      );
    });
    assert.ok(item.actions.length <= 3, item.companyId);
    if (
      item.qualityScore === null ||
      item.confidence.label === "low" ||
      item.state === "coherent_sample"
    ) {
      assert.equal(item.actions.length, 0, item.companyId);
    }
    item.actions.forEach((action, index) => {
      assert.equal(action.priority, index + 1, item.companyId);
      const dimension = dimensions.get(action.dimension);
      assert.ok(
        ["leak", "partial"].includes(dimension?.status),
        `${item.companyId}/${action.dimension}`,
      );
      assert.ok(
        (dimension.weight * (100 - dimension.score)) / 100 >= 4,
        `${item.companyId}/${action.dimension}`,
      );
      assert.ok(
        !Object.hasOwn(action, "basis"),
        `${item.companyId}/${action.dimension}`,
      );
      actionTexts.push(action.action);
    });
    assert.equal(
      new Set(item.actions.map((action) => action.action)).size,
      item.actions.length,
      item.companyId,
    );
  }
  assert.ok(new Set(actionTexts).size >= 20);
  assert.ok(actionTexts.length < 350);
});

test("los ejes semánticos explican conceptos concretos en vez de repetir una plantilla", () => {
  const semantic = data.items.flatMap((item) =>
    item.dimensions.filter((dimension) =>
      ["promise", "audience", "offerMechanism"].includes(dimension.id),
    ),
  );
  assert.ok(semantic.length > 0);
  assert.ok(
    semantic.every(
      (dimension) =>
        !/Existe continuidad parcial, pero la formulación o el foco cambia/i.test(
          dimension.rationale,
        ),
    ),
  );
  assert.ok(
    new Set(semantic.map((dimension) => dimension.rationale)).size >= 80,
  );
});

test("el builder es determinista salvo por la fecha de generación", () => {
  const rebuilt = buildAdLandingAudit({ root: ROOT, write: false });
  assert.deepEqual(rebuilt.summary, data.summary);
  assert.deepEqual(rebuilt.items, data.items);
  assert.deepEqual(rebuilt.methodology, data.methodology);
});

test("la salida evita atribuir ganadores o rendimiento no observado", () => {
  assert.match(data.methodology.warning, /no identifica ganadores/i);
  assert.match(data.methodology.warning, /no contiene métricas de conversión/i);
  for (const item of data.items) {
    assert.match(
      item.scoreMeaning,
      /no mide conversión ni rendimiento|no calculado/i,
      item.companyId,
    );
    assert.match(
      item.limitation,
      /no identifica campañas ganadoras/i,
      item.companyId,
    );
  }
});
