import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertCompleteEditorialCoverage,
  reconcileManagedCompanies,
  resolveSerpApiMediaDestination,
  reusableDownloadedMedia,
  selectTransparencyMedia,
} from "../scripts/lib/serpapi-contracts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
const source = readJson("db/serpapi-google-ads-spain-2026-08-27.json");
const review = readJson("scripts/data/serpapi-company-map.json");
const companies = readJson("public/data/companies-index.json");
const corpus = readJson("public/data/ad-corpus.json");
const media = readJson("public/data/serpapi-media-index.json");
const snapshot = readJson("public/data/serpapi-google-ads-snapshot.json");
const companyIds = new Set(companies.map((company) => company.id));
const publicStatuses = new Set(["matched", "new"]);
const publicMapping = (domain) => {
  const mapping = review.domains?.[String(domain || "").toLocaleLowerCase("en")];
  return mapping && publicStatuses.has(mapping.status) ? mapping : null;
};
const useful = (value) => String(value || "").replace(/\s+/g, " ").trim().length >= 18;
const sensitiveNames = new Set([
  "apikey",
  "xapikey",
  "serpapiapikey",
  "authorization",
  "proxyauthorization",
  "clientsecret",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "password",
  "secret",
  "token",
  "cookie",
  "setcookie",
]);
const normalizeSensitiveName = (name) =>
  String(name || "").toLocaleLowerCase("en").replace(/[-_\s]/g, "");
const findSensitiveLocations = (value, path = "$", matches = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveLocations(item, `${path}[${index}]`, matches));
    return matches;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const itemPath = `${path}.${key}`;
      if (sensitiveNames.has(normalizeSensitiveName(key))) matches.push(itemPath);
      findSensitiveLocations(item, itemPath, matches);
    }
    return matches;
  }
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return matches;
  try {
    const url = new URL(value);
    if (url.username || url.password) matches.push(`${path} (credenciales URL)`);
    for (const key of url.searchParams.keys()) {
      if (sensitiveNames.has(normalizeSensitiveName(key))) {
        matches.push(`${path} (parámetro ${key})`);
      }
    }
  } catch {
    // Los textos publicitarios que solo parecen una URL no afectan al contrato.
  }
  return matches;
};

test("el consumo SerpAPI y la matriz observada reconcilian exactamente", () => {
  assert.equal(source.schema, "redvitalia-serpapi-google-ads-v1");
  assert.equal(source.audit.creditsConsumed, 250);
  assert.equal(source.audit.successfulRequests, 216);
  assert.equal(source.audit.unavailableChargedResponses, 34);
  assert.equal(source.audit.accountedCredits, 250);
  assert.equal(
    source.audit.successfulRequests + source.audit.unavailableChargedResponses,
    source.audit.creditsConsumed,
  );
  assert.deepEqual(source.methodology.distribution, {
    googleAds: 205,
    transparency: 8,
    creativeDetails: 3,
    interruptedDuplicates: 34,
  });
  assert.deepEqual(source.summary, {
    discoveryRequests: 205,
    discoveryRequestsWithAds: 194,
    liveAdObservations: 800,
    uniqueLiveCreatives: 675,
    uniqueLiveDomains: 85,
    transparencyCreatives: 104,
    transparencyAdvertisers: 8,
    detailedCreatives: 3,
    currentCompanyDomainMatches: 19,
    domainsRequiringReview: 67,
  });
  assert.equal(source.requests.length, 205);
  assert.equal(new Set(source.requests.map((request) => request.searchId)).size, 205);
  const savedResponseCounts = [
    source.requests.length,
    source.advertiserProfiles.length,
    source.creativeDetails.length,
  ];
  assert.deepEqual(savedResponseCounts, [205, 8, 3]);
  assert.equal(
    savedResponseCounts.reduce((total, count) => total + count, 0),
    source.audit.successfulRequests,
  );
  assert.deepEqual(findSensitiveLocations(source), []);
});

test("los 86 dominios tienen una resolución editorial explícita y publicable", () => {
  const entries = Object.entries(review.domains || {});
  const statusCounts = entries.reduce((counts, [, mapping]) => {
    counts[mapping.status] = (counts[mapping.status] || 0) + 1;
    return counts;
  }, {});
  assert.equal(entries.length, 86);
  assert.deepEqual(statusCounts, { matched: 22, watchlist: 4, excluded: 44, new: 16 });
  for (const [domain, mapping] of entries) {
    assert.match(domain, /^[a-z0-9.-]+$/i);
    assert.match(mapping.note, /\S/);
    if (!publicStatuses.has(mapping.status)) continue;
    assert(companyIds.has(mapping.companyId), `${domain} → ${mapping.companyId}`);
    assert.match(mapping.confidence, /^(?:high|medium)$/);
  }
  const observedDomains = new Set([
    ...source.items.map((item) => item.advertiser?.domain || item.landing?.domain),
    ...source.transparencyCreatives.map((item) => item.candidateDomain || item.targetDomain),
  ].filter(Boolean).map((domain) => domain.toLocaleLowerCase("en")));
  assert.equal(observedDomains.size, 85);
  for (const domain of observedDomains) assert(review.domains[domain], domain);
  assert.equal(assertCompleteEditorialCoverage(source, review.domains).length, 85);
  const managed = companies.filter((company) => company.serpApiManaged);
  assert.equal(managed.length, 16);
  assert.equal(new Set(managed.map((company) => company.id)).size, 16);
});

test("cada anuncio Search publicable conserva su identidad y todas sus observaciones", () => {
  const expected = source.items.filter((item) =>
    publicMapping(item.advertiser?.domain || item.landing?.domain),
  );
  const imported = corpus.items.filter((item) => item.origen === "api_serpapi_google_search");
  assert.equal(imported.length, expected.length);
  assert.equal(new Set(imported.map((item) => item.creativeKey)).size, imported.length);
  const byCreativeKey = new Map(imported.map((item) => [item.creativeKey, item]));
  for (const item of expected) {
    const importedItem = byCreativeKey.get(item.creativeKey);
    const mapping = publicMapping(item.advertiser?.domain || item.landing?.domain);
    assert(importedItem, item.creativeKey);
    assert.equal(importedItem.id, mapping.companyId);
    assert.equal(importedItem.externalId, null);
    assert.equal(importedItem.observationId, item.observationId);
    assert.equal(importedItem.observationCount, item.observationCount);
    assert.deepEqual(importedItem.observedQueries, item.queries);
    assert.deepEqual(importedItem.observedLocations, item.locations);
    assert.deepEqual(importedItem.observedDevices, item.devices);
    assert.deepEqual(importedItem.observations, item.observations);
    assert(importedItem.evidenceLayers.includes("api_serpapi_google_search"));
  }
});

test("las 104 creatividades Transparency permanecen enlazables y las 41 previews son íntegras", () => {
  const expected = source.transparencyCreatives.filter((creative) =>
    creative.targetMatchesCandidate !== false &&
    publicMapping(creative.candidateDomain || creative.targetDomain),
  );
  assert.equal(expected.length, 104);
  for (const creative of expected) {
    const rows = corpus.items.filter((item) => item.externalId === creative.creativeId);
    assert.equal(rows.length, 1, creative.creativeId);
    const [row] = rows;
    assert.equal(row.id, publicMapping(creative.candidateDomain || creative.targetDomain).companyId);
    assert.equal(row.advertiserId, creative.advertiserId);
    assert(row.evidenceLayers.some((layer) => layer.startsWith("api_serpapi_google_transparency")));
    assert.match(row.sourceUrl || row.fuenteUrl, /^https:\/\/adstransparency\.google\.com\//);
  }

  const downloaded = Object.values(media.items || {}).filter((item) => item.status === "downloaded");
  assert.equal(downloaded.length, 41);
  assert.equal(media.summary.failed, 0);
  assert.equal(Object.keys(media.items || {}).length, media.summary.selected);
  const mediaCountByCompany = new Map();
  for (const item of downloaded) {
    mediaCountByCompany.set(item.companyId, (mediaCountByCompany.get(item.companyId) || 0) + 1);
    assert.match(item.creativeId, /^CR\d{10,}$/);
    const absoluteFile = resolve(root, "public", item.file.replace(/^\/+/, ""));
    assert(existsSync(absoluteFile), item.file);
    const bytes = readFileSync(absoluteFile);
    assert.equal(bytes.length, item.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256);
    const row = corpus.items.find((candidate) => candidate.externalId === item.creativeId);
    assert.equal(row.file, item.file);
  }
  for (const [companyId, count] of mediaCountByCompany) {
    assert(count <= 10, `${companyId} supera el límite: ${count}`);
  }
});

test("una alta SerpAPI puede promocionarse a matched sin perder la ficha", () => {
  const current = [
    { id: "ficha-promovida", name: "Promovida", serpApiManaged: true },
    { id: "alta-vigente", name: "Alta", serpApiManaged: true },
    { id: "alta-retirada", name: "Retirada", serpApiManaged: true },
    { id: "ficha-editorial", name: "Editorial" },
  ];
  const reconciled = reconcileManagedCompanies(current, [
    ["promovida.example", { status: "matched", companyId: "ficha-promovida" }],
    ["alta.example", { status: "new", companyId: "alta-vigente" }],
  ]);
  assert.deepEqual(reconciled.map((company) => company.id), ["ficha-promovida", "ficha-editorial"]);
  assert.equal("serpApiManaged" in reconciled[0], false);
  assert.equal(current[0].serpApiManaged, true, "la reconciliación no debe mutar la entrada");
});

test("la selección de previews deduplica CR y limita por companyId entre alias", () => {
  const creative = (index, domain, overrides = {}) => ({
    creativeId: `CR${String(index).padStart(12, "0")}`,
    candidateDomain: domain,
    previewUrl: `https://tpc.googlesyndication.com/archive/simgad/${index}`,
    format: "image",
    lastShown: index,
    ...overrides,
  });
  const creatives = [
    ...Array.from({ length: 8 }, (_, index) => creative(index, "alias-a.example")),
    ...Array.from({ length: 8 }, (_, index) => creative(index + 5, "alias-b.example")),
  ];
  const selected = selectTransparencyMedia({
    creatives,
    domainMappings: {
      "alias-a.example": { status: "matched", companyId: "misma-empresa" },
      "alias-b.example": { status: "matched", companyId: "misma-empresa" },
    },
    safePreview: (value) => new URL(value),
    perCompany: 10,
  });
  assert.equal(selected.length, 10);
  assert.equal(new Set(selected.map((row) => row.creativeId)).size, 10);
  assert.deepEqual(selected.map((row) => row.selectionRank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert(selected.every((row) => row.companyId === "misma-empresa"));

  assert.throws(() => selectTransparencyMedia({
    creatives: [
      creative(99, "empresa-a.example"),
      creative(99, "empresa-b.example"),
    ],
    domainMappings: {
      "empresa-a.example": { status: "matched", companyId: "empresa-a" },
      "empresa-b.example": { status: "matched", companyId: "empresa-b" },
    },
    safePreview: (value) => new URL(value),
  }), /asociada a dos fichas/);
});

test("los destinos de media son confinados y una descarga íntegra se reutiliza", (context) => {
  const mediaRoot = mkdtempSync(resolve(tmpdir(), "rv-serpapi-media-"));
  context.after(() => rmSync(mediaRoot, { recursive: true, force: true }));
  const row = {
    creativeId: "CR123456789012",
    advertiserId: "AR123",
    companyId: "empresa-segura",
    domain: "empresa.example",
    format: "image",
    selectionRank: 2,
    previewUrl: "https://tpc.googlesyndication.com/archive/simgad/123",
    detailsUrl: "https://adstransparency.google.com/advertiser/AR123/creative/CR123456789012",
  };
  const destination = resolveSerpApiMediaDestination(mediaRoot, row.companyId, row.creativeId);
  assert(destination.absolute.startsWith(resolve(mediaRoot)));
  assert.throws(
    () => resolveSerpApiMediaDestination(mediaRoot, "../escape", row.creativeId),
    /companyId inseguro/,
  );
  assert.throws(
    () => resolveSerpApiMediaDestination(mediaRoot, row.companyId, "../../escape"),
    /creativeId inseguro/,
  );

  const bytes = Buffer.from("webp-fixture-integrity");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  mkdirSync(destination.directory, { recursive: true });
  writeFileSync(destination.absolute, bytes);
  const item = {
    creativeId: row.creativeId,
    companyId: row.companyId,
    file: destination.file,
    bytes: bytes.length,
    sha256,
    status: "downloaded",
    mediaAssets: [{ file: destination.file, bytes: bytes.length, sha256 }],
  };
  const reusable = reusableDownloadedMedia({ item, row, mediaRoot });
  assert.equal(reusable?.status, "downloaded");
  assert.equal(reusable?.selectionRank, 2);
  assert.equal(reusable?.sourceUrl, row.detailsUrl);
  assert.equal(reusableDownloadedMedia({ item: { ...item, sha256: "0".repeat(64) }, row, mediaRoot }), null);
});

test("la cobertura editorial falla si aparece un dominio SerpAPI sin resolver", () => {
  const fixture = {
    items: [{ advertiser: { domain: "anunciante.example" }, landing: { domain: "landing.example" } }],
    transparencyCreatives: [{ candidateDomain: "transparency.example" }],
    creativeDetails: [{ targetDomain: "detalle.example" }],
  };
  assert.throws(
    () => assertCompleteEditorialCoverage(fixture, { "anunciante.example": {} }),
    /detalle\.example.*landing\.example.*transparency\.example/,
  );
  assert.deepEqual(assertCompleteEditorialCoverage(fixture, {
    "anunciante.example": {},
    "landing.example": {},
    "transparency.example": {},
    "detalle.example": {},
  }), ["anunciante.example", "detalle.example", "landing.example", "transparency.example"]);
});

test("el copy estructurado prevalece y los detalles vacíos no falsean el estado OCR", () => {
  for (const detail of source.creativeDetails) {
    const row = corpus.items.find((item) => item.externalId === detail.creativeId);
    assert(row, detail.creativeId);
    const copy = (detail.variants || [])
      .map((variant) => `${variant.headline || variant.title || ""}\n${variant.snippet || ""}`)
      .join("\n");
    if (useful(copy)) {
      assert.equal(row.structuredCopyAvailable, true);
      assert.equal(row.origen, "api_serpapi_google_transparency");
      assert.equal(row.estadoOcr, "no_necesario");
      assert.equal(row.copyAvailable, true);
    } else {
      assert.notEqual(row.structuredCopyAvailable, true);
      assert.notEqual(row.estadoOcr, "pendiente");
    }
  }
});

test("el snapshot público reconcilia fuente, mapa editorial y catálogo", () => {
  assert.equal(snapshot.credits.consumed, source.audit.creditsConsumed);
  assert.equal(snapshot.credits.savedResponses, source.audit.successfulRequests);
  assert.equal(snapshot.credits.interruptedDuplicates, source.audit.unavailableChargedResponses);
  assert.equal(snapshot.coverage.discoveryRequests, source.summary.discoveryRequests);
  assert.equal(snapshot.coverage.observations, source.summary.liveAdObservations);
  assert.equal(snapshot.coverage.uniqueAds, source.summary.uniqueLiveCreatives);
  assert.equal(snapshot.coverage.transparencyCreatives, source.summary.transparencyCreatives);
  assert.equal(snapshot.editorialReview.reviewedDomains, 86);
  assert.deepEqual(snapshot.editorialReview.statusCounts, {
    matched: 22,
    new: 16,
    excluded: 44,
    watchlist: 4,
  });
  assert.equal(snapshot.editorialReview.enrichedCompanies, 19);
  assert.equal(snapshot.editorialReview.newCompanies, 16);
  assert.equal(snapshot.editorialReview.publishedCompanies, 35);
});
