#!/usr/bin/env node
/**
 * Aplica el mapa editorial de SerpAPI al catálogo. Enriquece fichas existentes
 * y crea únicamente las altas marcadas como `new`; `review`, `watchlist` y
 * `excluded` nunca alcanzan el portal.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCompleteEditorialCoverage,
  assertSafeCompanyId,
  reconcileManagedCompanies,
} from "./lib/serpapi-contracts.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = resolve(ROOT, "db/serpapi-google-ads-spain-2026-08-27.json");
const MAP_PATH = resolve(ROOT, "scripts/data/serpapi-company-map.json");
const INDEX_PATH = resolve(ROOT, "public/data/companies-index.json");
const DETAILS_DIR = resolve(ROOT, "public/data/company-details");
const TAKEAWAYS_PATH = resolve(ROOT, "public/data/takeaways.json");
const GEO_PATH = resolve(ROOT, "public/data/country-geo.json");
const SNAPSHOT_PATH = resolve(ROOT, "public/data/serpapi-google-ads-snapshot.json");
const CAPTURES_DIR = resolve(ROOT, "public/data/site-captures");
const OBSERVED_AT = "2026-08-27";
const SECTION_START = "<!-- SERPAPI_GOOGLE_ADS_START -->";
const SECTION_END = "<!-- SERPAPI_GOOGLE_ADS_END -->";

for (const path of [SOURCE_PATH, MAP_PATH, INDEX_PATH, GEO_PATH]) {
  if (!existsSync(path)) throw new Error(`Falta la entrada requerida: ${path}`);
}

const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
const review = JSON.parse(readFileSync(MAP_PATH, "utf8"));
const current = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
const geos = JSON.parse(readFileSync(GEO_PATH, "utf8"));
const currentById = new Map(current.map((company) => [company.id, company]));
const previouslyManagedIds = new Set(
  current.filter((company) => company.serpApiManaged).map((company) => company.id),
);
const geoByCountry = new Map(geos.map((row) => [row.name, row]));
if (source.schema !== "redvitalia-serpapi-google-ads-v1") throw new Error("Esquema SerpAPI no reconocido");
if (review.schema !== "redvitalia-serpapi-company-map-v1") throw new Error("Mapa editorial SerpAPI no reconocido");
if (Number(source.audit?.creditsConsumed) !== 250) throw new Error("El barrido SerpAPI no acredita 250 créditos");
assertCompleteEditorialCoverage(source, review.domains);

const domainEntries = Object.entries(review.domains || {});
const allowedStatuses = new Set(["matched", "new", "excluded", "watchlist"]);
for (const [domain, mapping] of domainEntries) {
  if (!allowedStatuses.has(mapping.status)) throw new Error(`Estado editorial inválido: ${domain}`);
  if (!mapping.note) throw new Error(`Falta nota editorial: ${domain}`);
}
const publicMappings = domainEntries.filter(([, mapping]) => ["matched", "new"].includes(mapping.status));
const newMappings = publicMappings.filter(([, mapping]) => mapping.status === "new");
const newIdsInMap = newMappings.map(([, mapping]) => mapping.companyId);
if (new Set(newIdsInMap).size !== newIdsInMap.length) throw new Error("Un alta SerpAPI aparece en más de un dominio canónico");
for (const [domain, mapping] of publicMappings) {
  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error(`Dominio inválido: ${domain}`);
  assertSafeCompanyId(mapping.companyId);
  if (!/^(?:high|medium)$/.test(mapping.confidence || "")) throw new Error(`Confianza inválida: ${domain}`);
  if (mapping.status === "matched" && !currentById.has(mapping.companyId)) throw new Error(`Ficha enlazada inexistente: ${mapping.companyId}`);
  if (mapping.status === "new" && currentById.has(mapping.companyId) && !currentById.get(mapping.companyId)?.serpApiManaged) {
    throw new Error(`El alta ${mapping.companyId} colisiona con una ficha no gestionada por SerpAPI`);
  }
}

const liveByDomain = new Map();
for (const ad of source.items || []) {
  const domain = String(ad.advertiser?.domain || ad.landing?.domain || "").toLocaleLowerCase("en");
  const bucket = liveByDomain.get(domain) || [];
  bucket.push(ad);
  liveByDomain.set(domain, bucket);
}
const transparencyByDomain = new Map();
for (const creative of source.transparencyCreatives || []) {
  if (!creative.targetMatchesCandidate) continue;
  const domain = String(creative.candidateDomain || creative.targetDomain || "").toLocaleLowerCase("en");
  const bucket = transparencyByDomain.get(domain) || [];
  bucket.push(creative);
  transparencyByDomain.set(domain, bucket);
}
const detailsByDomain = new Map();
for (const detail of source.creativeDetails || []) {
  const domain = String(detail.candidateDomain || "").toLocaleLowerCase("en");
  const bucket = detailsByDomain.get(domain) || [];
  bucket.push(detail);
  detailsByDomain.set(domain, bucket);
}

const unique = (values) => [...new Set(values.filter(Boolean))];
const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};
const replaceSection = (body, section) => {
  const value = String(body || "");
  const pattern = new RegExp(`${SECTION_START}[\\s\\S]*?${SECTION_END}`, "g");
  const without = value.replace(pattern, "").trim();
  return [without, section].filter(Boolean).join("\n\n");
};
const detailPath = (companyId) => resolve(DETAILS_DIR, `${companyId}.json`);
const readDetail = (companyId) => existsSync(detailPath(companyId))
  ? JSON.parse(readFileSync(detailPath(companyId), "utf8"))
  : { id: companyId, body: "", sources: [] };
const writeDetail = (companyId, body, sources) => writeFileSync(
  detailPath(companyId),
  `${JSON.stringify({ id: companyId, body, sources: unique(sources) }, null, 1)}\n`,
  "utf8",
);

const metricsFor = (domain) => {
  const live = liveByDomain.get(domain) || [];
  const transparency = transparencyByDomain.get(domain) || [];
  const details = detailsByDomain.get(domain) || [];
  const observations = live.reduce((sum, ad) => sum + Number(ad.observationCount || 0), 0);
  const queries = unique(live.flatMap((ad) => ad.queries || []));
  const locations = unique(live.flatMap((ad) => ad.locations || []));
  const devices = unique(live.flatMap((ad) => ad.devices || []));
  const advertiserIds = unique([
    ...transparency.map((item) => item.advertiserId),
    ...details.map((item) => item.advertiserId),
  ]);
  const landingUrls = unique([
    ...live.map((ad) => safeUrl(ad.landing?.url)),
    ...details.flatMap((detail) => (detail.variants || []).map((variant) => safeUrl(variant.landingUrl))),
  ]);
  const sourceUrls = unique([
    ...live.flatMap((ad) => (ad.observations || []).map((row) => safeUrl(row.googleUrl))),
    ...transparency.map((creative) => safeUrl(creative.detailsUrl)),
    ...details.map((detail) => safeUrl(detail.sourceUrl)),
  ]);
  const lastObservedAt = unique(live.map((ad) => ad.lastObservedAt)).sort().at(-1) || OBSERVED_AT;
  return {
    live,
    transparency,
    details,
    observations,
    queries,
    locations,
    devices,
    advertiserIds,
    landingUrls,
    sourceUrls,
    lastObservedAt,
  };
};

const metricsForDomains = (domains) => {
  const rows = domains.map(metricsFor);
  return {
    live: rows.flatMap((item) => item.live),
    transparency: rows.flatMap((item) => item.transparency),
    details: rows.flatMap((item) => item.details),
    observations: rows.reduce((sum, item) => sum + item.observations, 0),
    queries: unique(rows.flatMap((item) => item.queries)),
    locations: unique(rows.flatMap((item) => item.locations)),
    devices: unique(rows.flatMap((item) => item.devices)),
    advertiserIds: unique(rows.flatMap((item) => item.advertiserIds)),
    landingUrls: unique(rows.flatMap((item) => item.landingUrls)),
    sourceUrls: unique(rows.flatMap((item) => item.sourceUrls)),
    lastObservedAt: unique(rows.map((item) => item.lastObservedAt)).sort().at(-1) || OBSERVED_AT,
  };
};

const evidenceSection = (domain, metrics) => {
  const examples = metrics.live.slice(0, 5).map((ad) =>
    `- **${ad.copy?.title || "Sin titular separado"}** — ${ad.copy?.description || "Sin descripción separada"}`,
  );
  return [
    SECTION_START,
    `## Google Ads observado mediante SerpAPI · ${OBSERVED_AT}`,
    `${metrics.live.length} anuncios de búsqueda únicos aparecieron en ${metrics.observations} subastas, ${metrics.queries.length} consultas, ${metrics.locations.length} ubicaciones y ${metrics.devices.length} tipos de dispositivo. Esta frecuencia describe cobertura observada; no equivale a impresiones, inversión, conversiones ni rendimiento.`,
    "### Identidad y destinos",
    `- Dominio revisado: ${domain}`,
    ...(metrics.advertiserIds.length ? [`- Google advertiser IDs: ${metrics.advertiserIds.join(", ")}`] : []),
    ...metrics.landingUrls.slice(0, 10).map((url) => `- Landing observada: ${url}`),
    ...(examples.length ? ["### Copy representativo observado", ...examples] : []),
    "### Cobertura de consultas",
    metrics.queries.slice(0, 30).map((query) => `- ${query}`).join("\n") || "- Sin consulta publicable.",
    SECTION_END,
  ].join("\n\n");
};

const updated = reconcileManagedCompanies(current, publicMappings);
const updatedById = new Map(updated.map((company) => [company.id, company]));
mkdirSync(DETAILS_DIR, { recursive: true });
mkdirSync(CAPTURES_DIR, { recursive: true });

const matchedGroups = new Map();
for (const [domain, mapping] of publicMappings.filter(([, item]) => item.status === "matched")) {
  const group = matchedGroups.get(mapping.companyId) || { mapping, mappings: [], domains: [] };
  group.domains.push(domain);
  group.mappings.push(mapping);
  matchedGroups.set(mapping.companyId, group);
}
for (const [companyId, group] of matchedGroups) {
  const company = updatedById.get(companyId);
  const metrics = metricsForDomains(group.domains);
  if (!metrics.live.length && !metrics.transparency.length) {
    throw new Error(`La asociación ${group.domains.join(" · ")} no tiene evidencia SerpAPI`);
  }
  company.channels = unique([...(company.channels || []), "Google Ads"]);
  if (!/Activo confirmado/i.test(company.googleStatus || "")) {
    company.googleStatus = metrics.live.length
      ? "Activo observado en Google Search"
      : "Actividad observada en Google Ads Transparency";
  }
  company.googleSearchAdsObserved = metrics.live.length;
  company.googleSearchObservations = metrics.observations;
  company.googleSearchQueries = metrics.queries.length;
  company.googleSearchQueryTerms = metrics.queries;
  company.googleSearchLocations = metrics.locations;
  company.googleSearchDevices = metrics.devices;
  company.googleSearchLastObservedAt = metrics.lastObservedAt;
  company.googleAdvertiserIds = metrics.advertiserIds;
  company.googleSearchLandingUrls = metrics.landingUrls;
  company.serpApiReviewedAt = OBSERVED_AT;
  company.websiteAliases = unique([
    ...(company.websiteAliases || []),
    ...group.domains.map((domain) => `https://${domain}/`),
  ]);
  const enrichment = Object.assign({}, ...group.mappings.map((mapping) => mapping.enrichment || {}));
  for (const field of ["legal", "offer", "cta", "priceLocal", "guarantee", "niche", "agencyType"]) {
    if (enrichment[field]) company[field] = enrichment[field];
  }
  const reviewedSources = unique(group.mappings.flatMap((mapping) => (mapping.sources || []).map(safeUrl)));
  const detail = readDetail(company.id);
  writeDetail(
    company.id,
    replaceSection(detail.body, evidenceSection(group.domains.join(" · "), metrics)),
    [...(detail.sources || []), ...reviewedSources, ...metrics.sourceUrls, ...metrics.landingUrls],
  );
}

const newCompanies = [];
for (const [domain, mapping] of newMappings) {
  const metrics = metricsFor(domain);
  if (!metrics.live.length || !mapping.name || !safeUrl(mapping.website)) {
    throw new Error(`Alta SerpAPI incompleta: ${domain}`);
  }
  const country = mapping.country || "España";
  const geo = geoByCountry.get(country) || (country === "España" ? geoByCountry.get("España") : null);
  const sources = unique([
    ...(mapping.sources || []).map(safeUrl),
    ...metrics.sourceUrls,
    ...metrics.landingUrls,
  ]);
  const body = [
    "## Estado de la ficha",
    `Competidor descubierto en Google Search Ads y revisado el ${OBSERVED_AT}. La empresa se incorpora porque su landing ofrece a terceros leads, citas, prospección o captación; no por el mero hecho de anunciarse. País corporativo: ${country} (${mapping.countryConfidence || "confianza no indicada"}); mercado publicitario observado: España.`,
    "## Oferta observada",
    mapping.offer || "Servicio de captación observado; alcance comercial pendiente de mayor verificación.",
    ...(mapping.priceLocal ? ["## Precio comunicado", mapping.priceLocal] : []),
    ...(mapping.guarantee ? ["## Garantía o reducción de riesgo", mapping.guarantee] : []),
    "## Evidencia de Google Ads",
    evidenceSection(domain, metrics),
    "## Fuentes consultadas",
    sources.map((url) => `- ${url}`).join("\n"),
  ].join("\n\n");
  const company = {
    id: mapping.companyId,
    name: mapping.name,
    title: mapping.name,
    domain: safeUrl(mapping.website),
    website: safeUrl(mapping.website),
    country,
    primaryCountry: country,
    countries: unique([country, "España"]),
    market: "España",
    markets: ["España"],
    scope: mapping.scope || "Núcleo — agencia/leadgen",
    agencyType: mapping.agencyType || "Multi-nicho especializada",
    offer: mapping.offer || "",
    priceLocal: mapping.priceLocal || "",
    priceStatus: mapping.priceLocal ? (mapping.priceStatus || "Observado en landing") : "No observable",
    price: { currency: null, amount: null, eur: null, label: mapping.priceLocal || "Sin precio público observable" },
    ticket: mapping.ticket || "",
    contract: mapping.contract || "",
    guarantee: mapping.guarantee || "",
    channels: unique(["Google Ads", ...(mapping.channels || [])]),
    metaStatus: "No comprobado",
    metaAds: 0,
    googleStatus: "Activo observado en Google Search",
    googleAds: new Set(metrics.transparency.map((item) => item.creativeId)).size,
    creativeArchive: 0,
    score: Number(mapping.score || 45),
    threat: mapping.threat || "Media",
    relation: mapping.relation || "Competidor directo",
    decision: mapping.decision || "Vigilar",
    evidence: "Confirmada",
    proof: mapping.proof || `${metrics.live.length} anuncios de búsqueda únicos y ${metrics.observations} subastas observadas; identidad revisada por dominio y landing.`,
    team: mapping.team || "",
    cta: mapping.cta || "",
    funnel: mapping.funnel || `Google Ads → ${safeUrl(mapping.website)} → contacto o solicitud comercial`,
    niche: mapping.niche || "",
    legal: mapping.legal || "",
    review: "Revisión estructurada SerpAPI y landing pública",
    reviewedAt: OBSERVED_AT,
    addedAt: OBSERVED_AT,
    sources: [],
    body: "",
    media: currentById.get(mapping.companyId)?.media || [],
    mediaDeclared: (currentById.get(mapping.companyId)?.media || []).length,
    location: {
      companyId: mapping.companyId,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      precision: "centro_pais_mercado",
      locationLabel: `${country}: centro de país o mercado; no es sede.`,
      locality: null,
      canonicalMarket: country,
      commercialMarket: "España",
      locationCountry: country,
      pointRepresents: "mercado o país canónico",
      headquartersVerified: false,
      sourceUrl: safeUrl(mapping.website),
      coordinateSourceUrl: null,
      limitation: "El punto representa el país o mercado asociado a la ficha, no una sede corporativa verificada.",
      zoom: 4.2,
      reviewedAt: OBSERVED_AT,
    },
    googleSearchAdsObserved: metrics.live.length,
    googleSearchObservations: metrics.observations,
    googleSearchQueries: metrics.queries.length,
    googleSearchQueryTerms: metrics.queries,
    googleSearchLocations: metrics.locations,
    googleSearchDevices: metrics.devices,
    googleSearchLastObservedAt: metrics.lastObservedAt,
    googleAdvertiserIds: metrics.advertiserIds,
    googleSearchLandingUrls: metrics.landingUrls,
    serpApiReviewedAt: OBSERVED_AT,
    serpApiManaged: true,
  };
  writeDetail(company.id, body, sources);
  const capturePath = resolve(CAPTURES_DIR, `${company.id}.json`);
  const originalLanguage = mapping.language || "es";
  if (!existsSync(capturePath)) {
    const plannedUrls = unique([safeUrl(mapping.website), ...metrics.landingUrls]).slice(0, 3);
    const pages = plannedUrls.map((url, index) => ({
      id: `${company.id}-${index === 0 ? "homepage" : `landing-${index}`}`,
      role: index === 0 ? "homepage" : "landing",
      label: index === 0 ? "Página principal" : `Landing comercial ${index}`,
      requestedUrl: url,
      finalUrl: null,
      title: null,
      status: "pending",
      capturedAt: null,
      fullPage: true,
      image: null,
      thumbnail: null,
      text: null,
      issue: null,
    }));
    writeFileSync(capturePath, `${JSON.stringify({
      schemaVersion: "rv-site-captures-v1",
      id: company.id,
      name: company.name,
      primaryCountry: company.primaryCountry,
      markets: company.markets,
      website: company.website,
      status: pages.length ? "pending" : "no_url",
      coverage: { planned: pages.length, captured: 0, blocked: 0, failed: 0 },
      language: {
        original: originalLanguage,
        translationStatus: originalLanguage === "es" ? "not_needed" : "not_available",
      },
      commercialRead: {
        headline: mapping.headline || null,
        promise: mapping.promise || mapping.offer || null,
        audience: mapping.audience || null,
        offer: mapping.offer || null,
        mechanism: mapping.mechanism || [],
        primaryCta: mapping.cta || null,
        proof: mapping.proof || null,
        price: mapping.priceLocal || "No observado",
        guarantee: mapping.guarantee || null,
        funnel: [company.funnel].filter(Boolean),
      },
      pages,
      updatedAt: new Date().toISOString(),
      commercialReadAttribution: {
        status: "observed_not_performance_validated",
        note: "Oferta y copy atribuidos a la landing pública y al anuncio observado; no prueban resultados.",
        observedAt: OBSERVED_AT,
      },
    }, null, 2)}\n`, "utf8");
  } else {
    const existingCapture = JSON.parse(readFileSync(capturePath, "utf8"));
    if (Number(existingCapture.coverage?.captured || 0) === 0) {
      existingCapture.language = {
        original: originalLanguage,
        translationStatus: originalLanguage === "es" ? "not_needed" : "not_available",
      };
      writeFileSync(capturePath, `${JSON.stringify(existingCapture, null, 2)}\n`, "utf8");
    }
  }
  newCompanies.push(company);
}

const newIds = new Set(newCompanies.map((company) => company.id));
const finalCompanies = [...updated.filter((company) => !newIds.has(company.id)), ...newCompanies];
writeFileSync(INDEX_PATH, `${JSON.stringify(finalCompanies, null, 1)}\n`, "utf8");

const takeaways = existsSync(TAKEAWAYS_PATH)
  ? JSON.parse(readFileSync(TAKEAWAYS_PATH, "utf8"))
  : { generatedAt: OBSERVED_AT, items: {} };
for (const companyId of previouslyManagedIds) delete takeaways.items[companyId];
for (const [, mapping] of newMappings) {
  if (!mapping.takeaway) continue;
  takeaways.items[mapping.companyId] = {
    t: mapping.takeaway,
    copiable: mapping.takeawayPriority || "baja",
  };
}
takeaways.generatedAt = OBSERVED_AT;
writeFileSync(TAKEAWAYS_PATH, `${JSON.stringify(takeaways, null, 1)}\n`, "utf8");

const statusCounts = Object.fromEntries([...allowedStatuses].map((status) => [
  status,
  domainEntries.filter(([, mapping]) => mapping.status === status).length,
]));
const publishedByDomain = new Map(publicMappings);
const publishedGroups = new Map();
for (const [domain, mapping] of publicMappings) {
  const group = publishedGroups.get(mapping.companyId) || { mapping, domains: [] };
  group.domains.push(domain);
  publishedGroups.set(mapping.companyId, group);
}
const topCompanies = [...publishedGroups.entries()].map(([companyId, group]) => {
  const metrics = metricsForDomains(group.domains);
  return {
    domain: group.domains[0],
    domains: group.domains,
    companyId,
    name: group.mapping.name || updatedById.get(companyId)?.name || companyId,
    status: group.mapping.status,
    uniqueAds: metrics.live.length,
    observations: metrics.observations,
    queryCount: metrics.queries.length,
    locations: metrics.locations.length,
    devices: metrics.devices,
    transparencyCreatives: metrics.transparency.length,
  };
}).filter((item) => item.observations || item.transparencyCreatives)
  .sort((left, right) => right.observations - left.observations
    || right.queryCount - left.queryCount
    || right.transparencyCreatives - left.transparencyCreatives
    || left.name.localeCompare(right.name, "es"));

const queryBuckets = new Map();
const locationBuckets = new Map();
const deviceBuckets = new Map();
for (const ad of source.items || []) {
  const domain = String(ad.advertiser?.domain || ad.landing?.domain || "").toLocaleLowerCase("en");
  const mapping = publishedByDomain.get(domain);
  if (!mapping) continue;
  for (const observation of ad.observations || []) {
    const query = String(observation.query || "").trim();
    if (query) {
      const bucket = queryBuckets.get(query) || { observations: 0, companies: new Set(), creatives: new Set() };
      bucket.observations += 1;
      bucket.companies.add(mapping.companyId);
      bucket.creatives.add(ad.creativeKey);
      queryBuckets.set(query, bucket);
    }
    const location = String(observation.location || "").trim();
    if (location) locationBuckets.set(location, (locationBuckets.get(location) || 0) + 1);
    const device = String(observation.device || "").trim();
    if (device) deviceBuckets.set(device, (deviceBuckets.get(device) || 0) + 1);
  }
}
const topQueries = [...queryBuckets.entries()].map(([query, bucket]) => ({
  query,
  observations: bucket.observations,
  companies: bucket.companies.size,
  uniqueAds: bucket.creatives.size,
})).sort((left, right) => right.companies - left.companies
  || right.observations - left.observations
  || left.query.localeCompare(right.query, "es")).slice(0, 16);
const multiDeviceCompanies = topCompanies.filter((item) => item.devices.length > 1).length;
const snapshot = {
  schema: "redvitalia-serpapi-google-ads-snapshot-v1",
  id: "serpapi-google-ads-es-2026-08-27",
  observedAt: OBSERVED_AT,
  market: "España",
  credits: {
    consumed: Number(source.audit?.creditsConsumed || 0),
    savedResponses: Number(source.methodology?.savedResponses || source.audit?.successfulRequests || 0),
    interruptedDuplicates: Number(source.methodology?.distribution?.interruptedDuplicates || 0),
  },
  coverage: {
    discoveryRequests: Number(source.summary?.discoveryRequests || 0),
    requestsWithAds: Number(source.summary?.discoveryRequestsWithAds || 0),
    observations: Number(source.summary?.liveAdObservations || 0),
    uniqueAds: Number(source.summary?.uniqueLiveCreatives || 0),
    observedDomains: Number(source.summary?.uniqueLiveDomains || 0),
    transparencyCreatives: Number(source.summary?.transparencyCreatives || 0),
    transparencyAdvertisers: Number(source.summary?.transparencyAdvertisers || 0),
    detailedCreatives: Number(source.summary?.detailedCreatives || 0),
  },
  editorialReview: {
    reviewedDomains: domainEntries.length,
    statusCounts,
    publishedCompanies: publishedGroups.size,
    enrichedCompanies: matchedGroups.size,
    newCompanies: newCompanies.length,
    policy: "Solo se publica una ficha cuando la oferta vende leads, citas, datos o captación a terceros y la identidad es verificable.",
  },
  topCompanies: topCompanies.slice(0, 16),
  topQueries,
  locations: [...locationBuckets.entries()].map(([location, observations]) => ({ location, observations }))
    .sort((left, right) => right.observations - left.observations),
  devices: [...deviceBuckets.entries()].map(([device, observations]) => ({ device, observations }))
    .sort((left, right) => right.observations - left.observations),
  conclusions: [
    topCompanies[0]
      ? `${topCompanies[0].name} fue el proveedor con mayor cobertura observada: ${topCompanies[0].observations} apariciones en ${topCompanies[0].queryCount} consultas. Es presión publicitaria observada, no cuota ni rendimiento.`
      : "No hubo un proveedor publicable con cobertura suficiente para encabezar el corte.",
    `${multiDeviceCompanies} proveedores publicables aparecieron tanto en escritorio como en móvil; esta repetición entre dispositivos refuerza la señal de cobertura, no la de conversión.`,
    `${topQueries.filter((item) => item.companies >= 3).length} consultas del ranking reúnen al menos tres proveedores revisados y sirven como subastas prioritarias para comparar propuesta, precio, garantía y CTA.`,
    "Las plataformas de CRM, automatización y directorios se conservan en el mapa editorial como excluidas; no inflan el catálogo de competidores de generación de demanda.",
  ],
  limitations: [
    "Una aparición describe presencia en una SERP concreta; no equivale a impresiones, inversión, clics, leads ni ventas.",
    "La mejor posición observada no identifica un ganador.",
    "España es mercado publicitario observado; el país corporativo se documenta por separado.",
  ],
};
writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(
  `SerpAPI empresas: ${matchedGroups.size} fichas enriquecidas, `
  + `${newCompanies.length} altas y ${finalCompanies.length} fichas totales.`,
);
