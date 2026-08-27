import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
const readOptionalJson = (relativePath, fallback) =>
  existsSync(resolve(root, relativePath)) ? readJson(relativePath) : fallback;

const companies = readJson("public/data/companies-index.json");
const corpus = readJson("public/data/ad-corpus.json");
const ocr = readJson("public/data/ad-ocr-transcripts.json");
const ocrAudit = readJson("public/data/ad-ocr-audit.json");
const identities = readJson("public/data/ad-media-identity.json");
const coverage = readJson("public/data/ad-coverage.json");
const scrapeCreators = readOptionalJson(
  "db/scrapecreators-spain-leadgen.json",
  { items: [] },
);
const scrapeCreatorsMap = readOptionalJson(
  "scripts/data/scrapecreators-company-map.json",
  { pageIds: {} },
);
const scrapeCreatorsMedia = readOptionalJson(
  "public/data/scrapecreators-media-index.json",
  { items: {} },
);

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
  assert(corpus.total >= 1600);
  assert(corpus.companies >= 185);
  // La atribución de marca es conservadora: una pieza Meta no se convierte en
  // propia solo por estar archivada dentro de una ficha.
  assert(corpus.patternReady >= 350);
  assert(corpus.withFive >= 70);
  assert(corpus.withTen >= 40);

  for (const item of corpus.items) {
    assert(item.id && item.name && item.corpusKey);
    if (item.copyAvailable) {
      assert(
        String(item.titular || item.texto || item.cta || "").trim(),
        `Pieza marcada con copy pero vacía: ${item.corpusKey}`,
      );
    } else {
      assert.equal(item.aptaPatrones, false);
      assert.equal(item.estadoTraduccion, "no_aplica");
      assert.equal(item.idioma, "und");
    }
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

test("ScrapeCreators solo incorpora Page IDs resueltos y conserva el copy exacto", () => {
  const companyIds = new Set(companies.map((company) => company.id));
  const expected = new Map();
  for (const source of scrapeCreators.items || []) {
    const externalId = String(source.externalId || "");
    const mapping = scrapeCreatorsMap.pageIds?.[String(source.pageId || "")];
    if (
      !/^\d{10,}$/.test(externalId) ||
      mapping?.status !== "matched" ||
      !companyIds.has(mapping.companyId)
    ) continue;
    if (!expected.has(externalId)) expected.set(externalId, { source, mapping });
  }

  const imported = corpus.items.filter((item) => item.origen === "api_scrapecreators");
  assert.equal(imported.length, expected.size);
  assert.deepEqual(
    new Set(imported.map((item) => item.externalId)),
    new Set(expected.keys()),
  );

  const allMetaIds = corpus.items
    .filter((item) => /^\d{10,}$/.test(String(item.externalId || "")))
    .map((item) => item.externalId);
  assert.equal(new Set(allMetaIds).size, allMetaIds.length, "ID Meta duplicado en el corpus");

  for (const item of imported) {
    const { source, mapping } = expected.get(item.externalId);
    const exactCopy = {
      title: String(source.copy?.title || ""),
      text: String(source.copy?.text || ""),
      description: String(source.copy?.description || ""),
      cta: String(source.cta?.text || ""),
    };
    const structuredCopyAvailable = Boolean(
      `${exactCopy.title}\n${exactCopy.text}\n${exactCopy.description}`.trim(),
    );
    assert.equal(item.id, mapping.companyId);
    assert.equal(item.corpusKey, `meta:${item.externalId}`);
    assert.equal(item.platformFamily, "meta");
    assert.deepEqual(item.sourceCopy, exactCopy);
    assert.equal(item.structuredCopyAvailable, structuredCopyAvailable);
    if (structuredCopyAvailable) {
      assert.equal(item.titular, exactCopy.title);
      assert.equal(item.texto, exactCopy.text);
      assert.equal(item.descripcion, exactCopy.description);
      assert.equal(item.cta, exactCopy.cta);
      assert.equal(item.estadoOcr, "no_necesario");
    }
    assert.equal(item.pageId, String(source.pageId || ""));
    assert.equal(item.pageName, String(source.pageName || ""));
    assert.equal(item.landingUrl, String(source.landing?.url || "") || null);
    assert.equal(item.isActive, source.isActive);
    assert.equal(item.startedAt, source.startedAt || null);
    assert.equal(item.endedAt, source.endedAt || null);
    assert.equal(item.sourceUrl, String(source.sourceUrl || ""));
    assert.deepEqual(item.collationIds, source.collationIds || []);
    assert.deepEqual(item.displayFormats, source.displayFormats || []);
    assert.deepEqual(item.publisherPlatforms, source.publisherPlatforms || []);
    assert.equal(item.transcript, String(source.transcription?.text || "") || null);
    const indexedMedia = scrapeCreatorsMedia.items?.[item.externalId];
    if (
      indexedMedia &&
      (!indexedMedia.companyId || indexedMedia.companyId === item.id) &&
      (!indexedMedia.pageId || String(indexedMedia.pageId) === item.pageId)
    ) {
      const existingIdentity = identities.items.find(
        (identity) =>
          identity.platform === "meta" && identity.externalId === item.externalId,
      );
      const expectedFile = existingIdentity?.file || indexedMedia.file || "";
      if (expectedFile && existsSync(resolve(root, "public", expectedFile.replace(/^\/+/, "")))) {
        assert.equal(item.file, expectedFile);
      }
      for (const field of ["videoFile", "posterFile"]) {
        const expectedMedia = indexedMedia[field];
        if (
          expectedMedia &&
          existsSync(resolve(root, "public", expectedMedia.replace(/^\/+/, "")))
        ) assert.equal(item[field], expectedMedia);
      }
      for (const asset of item.mediaAssets || []) {
        const file = typeof asset === "string"
          ? asset
          : (asset.file || asset.localFile || asset.posterFile);
        assert.match(file, /^\/media\//);
        assert(existsSync(resolve(root, "public", file.replace(/^\/+/, ""))), file);
      }
    }
    if (String(mapping.confidence || "").toLowerCase() !== "high") {
      assert.equal(item.aptaPatrones, false);
    }
  }
});

test("el OCR está limpio, acotado y fuera de patrones por defecto", () => {
  assert.equal(ocr.total, ocr.items.length);
  assert(ocr.items.length >= 550);
  for (const item of ocr.items) {
    assert(Number(item.confianza) >= 0 && Number(item.confianza) <= 100);
    assert.equal(item.aptaPatrones, false);
    assert.match(item.archivoSha256, /^[a-f0-9]{64}$/);
    assert(existsSync(resolve(root, "public", item.file.replace(/^\/+/, ""))), item.file);
    assert.doesNotMatch(
      item.texto,
      /vincular a anuncio|identificador de la biblioteca|ver detalles del anuncio|ver m.s anuncios de este anunciante/i,
    );
  }
});

test("cada creatividad exacta termina el OCR con un estado explícito", () => {
  assert.equal(ocrAudit.schema, "redvitalia-ad-ocr-audit-v2");
  assert.equal(ocrAudit.items.length, identities.items.length);
  assert.equal(
    Object.values(ocrAudit.statusCounts).reduce((sum, count) => sum + count, 0),
    ocrAudit.items.length,
  );
  assert.equal(ocrAudit.assetsPending, 0);
  assert.equal(
    ocrAudit.items.filter((item) => item.estadoOcr === "sin_texto").length,
    Number(ocrAudit.statusCounts.sin_texto || 0),
  );
  const seenIdentities = new Set();
  for (const item of ocrAudit.items) {
    const key = `${item.companyId}:${item.platform}:${item.externalId}`;
    assert(!seenIdentities.has(key), `Identidad OCR duplicada: ${key}`);
    seenIdentities.add(key);
    assert.match(item.archivoSha256, /^[a-f0-9]{64}$/);
    const absoluteFile = resolve(root, "public", item.file.replace(/^\/+/, ""));
    assert(existsSync(absoluteFile), item.file);
    assert.equal(
      createHash("sha256").update(readFileSync(absoluteFile)).digest("hex"),
      item.archivoSha256,
      item.file,
    );
    assert.doesNotMatch(item.estadoOcr, /pendiente|fallido/i);
    if (item.textoUtil) assert.match(item.estadoOcr, /^completo_|^no_necesario$/);
  }
});

test("identidad, OCR, corpus y cobertura comparten el mismo universo creativo", () => {
  const identityKey = (item) =>
    `${item.companyId}:${item.platform}:${item.externalId}:${item.file}`;
  assert.deepEqual(
    new Set(ocrAudit.items.map(identityKey)),
    new Set(identities.items.map(identityKey)),
  );
  assert.equal(
    ocrAudit.attemptedAssets,
    ocrAudit.items.filter((item) => item.estadoOcr !== "no_necesario").length,
  );
  assert.equal(
    ocrAudit.assetsWithUsableText,
    ocrAudit.items.filter((item) => item.textoUtil).length,
  );
  const recomputedStatuses = Object.fromEntries(
    Object.keys(ocrAudit.statusCounts).map((status) => [
      status,
      ocrAudit.items.filter((item) => item.estadoOcr === status).length,
    ]),
  );
  assert.deepEqual(ocrAudit.statusCounts, recomputedStatuses);

  const transcriptKeys = new Set(
    ocr.items
      .filter((item) => item.externalId)
      .map((item) => `${item.id}:${item.platformFamily}:${item.externalId}`),
  );
  for (const identity of identities.items) {
    const key = `${identity.companyId}:${identity.platform}:${identity.externalId}`;
    const rows = corpus.items.filter(
      (item) =>
        item.id === identity.companyId &&
        item.platformFamily === identity.platform &&
        item.externalId === identity.externalId,
    );
    assert.equal(rows.length, 1, key);
    const row = rows[0];
    const audit = ocrAudit.items.find(
      (item) => identityKey(item) === identityKey(identity),
    );
    assert(audit, key);
    assert.equal(row.file, identity.file);
    assert.equal(row.archivoSha256, audit.archivoSha256);
    if (row.structuredCopyAvailable) {
      assert.equal(row.estadoOcr, "no_necesario");
    } else {
      assert.equal(row.estadoOcr, audit.estadoOcr);
      assert.equal(row.copyAvailable, audit.textoUtil);
    }
    if (
      audit.estadoOcr === "sin_texto" &&
      !row.structuredCopyAvailable
    ) {
      assert.equal(`${row.titular}${row.texto}${row.cta}`, "");
      assert.equal(row.aptaPatrones, false);
      assert(!transcriptKeys.has(key));
    }
  }

  assert.deepEqual(
    new Set(coverage.creativeFiles.map(identityKey)),
    new Set(identities.items.map(identityKey)),
  );
});

test("los JSON públicos no filtran rutas ni fuentes internas", () => {
  const text = [corpus, ocr, ocrAudit, coverage].map((value) => JSON.stringify(value)).join("\n");
  assert.doesNotMatch(text, /portal-source-snapshot|prod-files-secure|amazonaws\.com|notion can[oó]nico/i);
});
