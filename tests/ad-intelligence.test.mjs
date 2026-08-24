import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AD_ALIAS_ENTRIES,
  AD_ALIASES,
  canonicalAdCompanyId,
} from "../scripts/ad-aliases.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));

const companies = readJson("public/data/companies-index.json");
const corpus = readJson("public/data/ad-corpus.json");
const coverage = readJson("public/data/ad-coverage.json");
const manifest = readJson("public/data/data-manifest.json");
const companyIds = new Set(companies.map((company) => company.id));

test("el grafo de alias es único, terminal y apunta al índice", () => {
  assert.equal(AD_ALIASES.size, AD_ALIAS_ENTRIES.length);
  for (const [alias, canonical] of AD_ALIAS_ENTRIES) {
    assert(alias && canonical);
    assert.notEqual(alias, canonical);
    assert(companyIds.has(canonical), `${alias} apunta a ${canonical}`);
    assert(!AD_ALIASES.has(canonical), `cadena de alias desde ${alias}`);
    assert.equal(canonicalAdCompanyId(alias), canonical);
  }
});

test("el linaje de alias sobrevive a la canonización", () => {
  for (const entry of coverage.aliasMap) {
    const rows = corpus.items.filter(
      (item) =>
        item.observedId === entry.alias &&
        !/(?:^|\b)(?:0 anuncios|sin anuncios activos|sin resultados atribuibles)(?:\b|$)/i.test(
          `${item.titular || ""} ${item.texto || ""}`,
        ),
    );
    assert.equal(entry.transcribedRecords, rows.length, entry.alias);
    for (const row of rows) assert.equal(row.id, entry.canonical);
  }
});

test("la plataforma se deriva del tipo de ID, nunca del copy", () => {
  const correctedMetaIds = new Set([
    "1048031190974938",
    "1086589450448465",
    "1696507908094911",
    "833192399862271",
  ]);
  for (const item of corpus.items.filter((row) => row.externalId)) {
    if (/^CR/i.test(item.externalId))
      assert.match(item.plataforma, /google/i, item.externalId);
    if (/^\d+$/.test(item.externalId)) {
      assert.doesNotMatch(item.plataforma, /google/i, item.externalId);
      if (correctedMetaIds.has(item.externalId))
        assert.match(item.plataforma, /meta/i, item.externalId);
    }
  }
});

test("ausencias editoriales no se convierten en anuncios ni patrones", () => {
  const absences = corpus.items.filter((item) =>
    /(?:^|\b)(?:0 anuncios|sin anuncios activos|sin resultados atribuibles)(?:\b|$)/i.test(
      `${item.titular || ""} ${item.texto || ""}`,
    ),
  );
  for (const item of absences) assert.equal(item.aptaPatrones, false);
  assert.equal(
    corpus.items.filter((item) => item.aptaPatrones !== false).length,
    corpus.patternReady,
  );
});

test("los agregados de cobertura se recomputan desde las fichas", () => {
  const sum = (key) =>
    coverage.items.reduce((total, item) => total + Number(item[key] || 0), 0);
  assert.equal(coverage.totalCompanies, companies.length);
  assert.equal(sum("targetCount"), coverage.summary.targetTotal);
  assert.equal(sum("transcribedCanonicalCount"), coverage.summary.transcribedCanonical);
  assert.equal(sum("verifiedTranscribedCount"), coverage.summary.verifiedTranscribed);
  assert.equal(sum("textAvailabilityGap"), coverage.summary.textAvailabilityGap);
  assert.equal(sum("verifiedTranscriptionGap"), coverage.summary.verifiedTranscriptionGap);
  assert.equal(coverage.summary.transcriptionGap, coverage.summary.verifiedTranscriptionGap);
  assert.equal(
    coverage.items.reduce((total, item) => total + item.evidence.length, 0),
    coverage.summary.sampledEvidence,
  );

  for (const item of coverage.items) {
    assert.equal(item.targetCount, Math.min(10, item.availableEvidenceCount));
    assert(item.verifiedTranscribedCount <= item.transcribedCanonicalCount);
    assert.equal(
      item.textAvailableComplete,
      item.targetCount > 0 && item.transcribedCanonicalCount >= item.targetCount,
    );
    assert.equal(
      item.verifiedComplete,
      item.targetCount > 0 && item.verifiedTranscribedCount >= item.targetCount,
    );
    assert.equal(item.transcriptionComplete, item.verifiedComplete);
    if (item.targetCount === 0) {
      assert.equal(item.textAvailableComplete, false);
      assert.equal(item.verifiedComplete, false);
      assert.equal(item.transcriptionComplete, false);
    }
  }
});

test("cada pieza estructurada enlaza un ID exacto de su ficha", () => {
  const coverageById = new Map(
    coverage.items.map((item) => [item.companyId, item.exactCreativeIds]),
  );
  for (const item of corpus.items.filter((row) => row.externalId)) {
    const exact = coverageById.get(item.id);
    assert(exact, item.id);
    if (/^CR/i.test(item.externalId))
      assert(exact.google.includes(item.externalId.toUpperCase()), item.externalId);
    else assert(exact.meta.includes(item.externalId), item.externalId);
  }
});

test("el índice ID→archivo publicado es material y verificable", () => {
  assert.equal(coverage.mediaJoin.sourceMediaAvailable, true);
  assert(coverage.creativeFiles.length >= 900);
  for (const item of coverage.creativeFiles) {
    assert(existsSync(resolve(root, "public", item.file.replace(/^\/+/, ""))), item.file);
    if (item.sourceUrl)
      assert.match(
        item.sourceUrl,
        /^https:\/\/(?:www\.facebook\.com\/ads\/library|adstransparency\.google\.com)\//,
      );
  }
});

test("el manifiesto separa universo, snapshot y publicidad", () => {
  assert.match(manifest.revision, /^[a-f0-9]{16}$/);
  assert.equal(manifest.universe.companies, companies.length);
  assert.equal(
    manifest.universe.representedPrimaryMarkets,
    new Set(companies.map((company) => company.primaryCountry)).size,
  );
  assert.equal(manifest.deepSnapshot.companies, 712);
  assert.equal(
    manifest.advertising.searchableTranscriptions,
    coverage.summary.transcribedCanonical,
  );
  assert.equal(
    manifest.advertising.verifiedTranscriptions,
    coverage.summary.verifiedTranscribed,
  );
  assert.equal(manifest.advertising.patternReady, corpus.patternReady);
});
