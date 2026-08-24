import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));

const companies = readJson("public/data/companies-index.json");
const corpus = readJson("public/data/ad-corpus.json");
const ocr = readJson("public/data/ad-ocr-transcripts.json");
const coverage = readJson("public/data/ad-coverage.json");

test("la cobertura representa las 963 fichas exactamente una vez", () => {
  assert.equal(coverage.totalCompanies, companies.length);
  assert.equal(coverage.items.length, companies.length);
  assert.equal(new Set(coverage.items.map((item) => item.companyId)).size, companies.length);
  assert.equal(
    Object.values(coverage.summary.statusCounts).reduce((sum, count) => sum + count, 0),
    companies.length,
  );
});

test("los joins ID externo a archivo son únicos, públicos y existentes", () => {
  const keys = new Set();
  for (const item of coverage.creativeFiles || []) {
    const key = `${item.companyId}:${item.platform}:${item.externalId}`;
    assert(!keys.has(key), `Join duplicado: ${key}`);
    keys.add(key);
    assert.match(item.file, /^\/media\//);
    assert(existsSync(resolve(root, "public", item.file.replace(/^\/+/, ""))), item.file);
    if (item.sourceUrl) {
      assert.match(item.sourceUrl, /^https:\/\/(?:www\.facebook\.com\/ads\/library|adstransparency\.google\.com)\//);
    }
  }
  assert.equal(keys.size, coverage.mediaJoin.uniqueExternalIdsWithPublicFile);
});

test("el corpus ampliado conserva capas, claves y archivos trazables", () => {
  assert.equal(corpus.total, corpus.items.length);
  assert.equal(new Set(corpus.items.map((item) => item.corpusKey)).size, corpus.items.length);
  assert(corpus.total >= 1000);
  assert(corpus.companies >= 180);
  assert(corpus.patternReady >= 400);
  assert(corpus.withFive >= 70);
  assert(corpus.withTen >= 40);

  for (const item of corpus.items) {
    assert(item.id && item.name && item.titular && item.texto);
    if (item.file) {
      assert.match(item.file, /^\/media\//);
      assert(existsSync(resolve(root, "public", item.file.replace(/^\/+/, ""))), item.file);
    }
    if (item.origen === "biblioteca_estructurada") {
      assert.match(item.externalId, /^(?:CR\d{10,}|\d{10,})$/i);
      assert.match(item.fuenteUrl, /^https:\/\//);
    }
  }
});

test("el OCR está limpio, acotado y fuera de patrones por defecto", () => {
  assert.equal(ocr.total, ocr.items.length);
  assert(ocr.items.length >= 550);
  for (const item of ocr.items) {
    assert(Number(item.confianza) >= 55);
    assert.equal(item.aptaPatrones, false);
    assert.match(item.archivoSha256, /^[a-f0-9]{64}$/);
    assert(existsSync(resolve(root, "public", item.file.replace(/^\/+/, ""))), item.file);
    assert.doesNotMatch(
      item.texto,
      /vincular a anuncio|identificador de la biblioteca|ver detalles del anuncio|ver m.s anuncios de este anunciante/i,
    );
  }
});

test("los JSON públicos no filtran rutas ni fuentes internas", () => {
  const text = [corpus, ocr, coverage].map((value) => JSON.stringify(value)).join("\n");
  assert.doesNotMatch(text, /portal-source-snapshot|prod-files-secure|amazonaws\.com|notion can[oó]nico/i);
});
