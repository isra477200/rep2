#!/usr/bin/env node
/**
 * Convierte el barrido privado de SerpAPI en un dataset versionado, compacto y
 * sin secretos. No decide por similitud qué empresa es cada anuncio: propone
 * coincidencias por dominio, pero la asociación publicable vive en el mapa
 * editorial scripts/data/serpapi-company-map.json.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { domainToASCII, fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUN_DATE = "2026-08-27";
const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const INPUT = resolve(ROOT, valueAfter("--input", `work/serpapi-google-ads-spain-${RUN_DATE}`));
const OUTPUT = resolve(ROOT, valueAfter("--output", `db/serpapi-google-ads-spain-${RUN_DATE}.json`));
const CANDIDATES_OUTPUT = resolve(INPUT, "company-candidates.json");

const readJson = (path, fallback = null) => existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : fallback;
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`, "utf8");
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const cleanText = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/\p{Cc}/gu, " ")
  .replace(/\s+/g, " ")
  .trim();
const comparable = (value) => cleanText(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();
const unique = (values) => [...new Set(values.filter(Boolean))];

const parseHost = (value) => {
  let input = cleanText(value);
  if (!input) return "";
  if (!/^https?:\/\//i.test(input)) input = `https://${input.replace(/^\/+/, "")}`;
  try {
    const clean = domainToASCII(new URL(input).hostname.toLocaleLowerCase("en"))
      .replace(/^www\./, "")
      .replace(/\.$/, "");
    return clean.includes(".") ? clean : "";
  } catch {
    return "";
  }
};

const registrableDomain = (value) => {
  const host = parseHost(value);
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  const compound = new Set(["co.uk", "com.es", "org.es", "com.mx", "com.ar", "com.co", "com.br"]);
  return compound.has(parts.slice(-2).join("."))
    ? parts.slice(-3).join(".")
    : parts.slice(-2).join(".");
};

const cleanUrl = (value) => {
  const input = cleanText(value);
  if (!input) return "";
  try {
    const url = new URL(input);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    const tracking = /^(?:utm_.+|gclid|dclid|gbraid|wbraid|gad_.+|fbclid|msclkid|campaign|campaignid|adgroup|adgroupid|creative|keyword|matchtype|device|network|source|medium)$/i;
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
    url.hostname = domainToASCII(url.hostname.toLocaleLowerCase("en"));
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return "";
  }
};

const destinationFromAd = (ad) => {
  try {
    const target = new URL(String(ad?.tracking_link || "")).searchParams.get("adurl");
    if (/^https?:\/\//i.test(String(target || ""))) return target;
  } catch {
    // Si el enlace de tracking no es una URL válida, se prueban los destinos directos.
  }
  const direct = String(ad?.link || "");
  const directHost = parseHost(direct);
  if (directHost && !/(?:^|\.)google\.[a-z.]+$/i.test(directHost)) return direct;
  return String(ad?.displayed_link || "");
};

const hostFromAd = (ad) => {
  for (const value of [destinationFromAd(ad), ad?.displayed_link, ad?.source, ad?.link]) {
    const host = parseHost(value);
    if (host && !/(?:^|\.)google\.[a-z.]+$/i.test(host)) return host;
  }
  return "";
};

const companies = readJson(resolve(ROOT, "public/data/companies-index.json"), []);
const companyDomainRows = [];
for (const company of companies) {
  for (const value of [company.website, company.domain]) {
    const domain = registrableDomain(value);
    if (domain) companyDomainRows.push({ domain, companyId: company.id, companyName: company.name });
  }
}
const companyByDomain = new Map(companyDomainRows.map((row) => [row.domain, row]));
const ledger = readJson(resolve(INPUT, "ledger.json"));
const runState = readJson(resolve(INPUT, "run-state.json"));
if (!ledger || !runState) throw new Error(`Falta un barrido SerpAPI completo en ${INPUT}`);
const successful = (ledger.requests || []).filter((item) => item.status === "success");
const phaseCounts = Object.fromEntries(["discovery", "transparency", "details"].map((phase) => [
  phase,
  successful.filter((item) => item.phase === phase).length,
]));
if (
  phaseCounts.discovery !== 205
  || Number(runState.creditsConsumed) !== 250
  || Number(runState.accountedCredits) !== 250
) {
  throw new Error(`Barrido incompleto: ${successful.length} peticiones y ${runState.creditsConsumed || 0} créditos`);
}

const rawFor = (id) => readJson(resolve(INPUT, "raw", `${id}.json`));
const liveBuckets = new Map();
const requestSummaries = [];

for (const request of successful.filter((item) => item.phase === "discovery")) {
  const data = rawFor(request.id);
  if (!data) throw new Error(`Falta raw de ${request.id}`);
  const observedAt = data.search_metadata?.processed_at || request.completedAt || null;
  const googleUrl = cleanUrl(data.search_metadata?.google_ads_url || "");
  const ads = Array.isArray(data.ads) ? data.ads : [];
  requestSummaries.push({
    id: request.id,
    searchId: request.searchId,
    query: request.params.q,
    location: request.params.location,
    device: request.params.device,
    language: request.params.hl,
    observedAt,
    googleUrl,
    adsReturned: ads.length,
  });
  for (const ad of ads) {
    const observedLandingUrl = destinationFromAd(ad);
    const landingUrl = cleanUrl(observedLandingUrl);
    const host = hostFromAd(ad);
    const domain = registrableDomain(host);
    if (!domain) continue;
    const title = cleanText(ad.title);
    const description = cleanText(ad.description);
    const displayedLink = cleanText(ad.displayed_link);
    const source = cleanText(ad.source);
    const signature = [domain, landingUrl, comparable(title), comparable(description)].join("\n");
    const creativeKey = `SG${hash(signature).slice(0, 22).toUpperCase()}`;
    const observationId = `SO${hash([
      request.searchId,
      creativeKey,
      ad.position,
      ad.block_position,
    ].join("\n")).slice(0, 22).toUpperCase()}`;
    const observation = {
      observationId,
      requestId: request.id,
      searchId: request.searchId,
      query: request.params.q,
      segment: request.segment,
      location: request.params.location,
      device: request.params.device,
      language: request.params.hl,
      position: Number.isFinite(Number(ad.position)) ? Number(ad.position) : null,
      blockPosition: cleanText(ad.block_position) || null,
      observedAt,
      googleUrl,
    };
    const current = liveBuckets.get(creativeKey) || {
      creativeKey,
      domain,
      host,
      title,
      description,
      displayedLink,
      source,
      landingUrl,
      originalLandingUrls: [],
      extensions: [],
      sitelinks: [],
      thumbnailUrl: "",
      observations: [],
    };
    current.originalLandingUrls.push(cleanText(observedLandingUrl));
    current.extensions.push(...(Array.isArray(ad.extensions) ? ad.extensions.map(cleanText) : []));
    current.sitelinks.push(...(Array.isArray(ad.sitelinks) ? ad.sitelinks.map((item) => ({
      title: cleanText(item.title),
      link: cleanUrl(item.link),
      snippets: Array.isArray(item.snippets) ? item.snippets.map(cleanText).filter(Boolean) : [],
    })) : []));
    current.thumbnailUrl ||= cleanUrl(ad.thumbnail || "");
    current.observations.push(observation);
    liveBuckets.set(creativeKey, current);
  }
}

const liveAds = [...liveBuckets.values()].map((item) => {
  const observations = [...new Map(item.observations.map((row) => [row.observationId, row])).values()]
    .sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)) || a.observationId.localeCompare(b.observationId));
  const companyMatch = companyByDomain.get(item.domain) || null;
  const positions = observations.map((row) => row.position).filter(Number.isFinite);
  return {
    creativeKey: item.creativeKey,
    observationId: observations[0]?.observationId || null,
    companyMatch,
    advertiser: {
      observedName: item.source || item.domain,
      domain: item.domain,
      host: item.host,
    },
    copy: {
      title: item.title,
      description: item.description,
      displayedLink: item.displayedLink,
      extensions: unique(item.extensions),
      sitelinks: [...new Map(item.sitelinks.map((row) => [`${row.title}|${row.link}`, row])).values()],
    },
    landing: {
      url: item.landingUrl || null,
      observedUrls: unique(item.originalLandingUrls),
      domain: item.domain,
    },
    media: item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : null,
    observationCount: observations.length,
    queryCount: new Set(observations.map((row) => row.query)).size,
    queries: unique(observations.map((row) => row.query)),
    locations: unique(observations.map((row) => row.location)),
    devices: unique(observations.map((row) => row.device)),
    bestPosition: positions.length ? Math.min(...positions) : null,
    firstObservedAt: observations[0]?.observedAt || null,
    lastObservedAt: observations.at(-1)?.observedAt || null,
    observations,
  };
}).sort((a, b) => b.observationCount - a.observationCount
  || b.queryCount - a.queryCount
  || a.advertiser.domain.localeCompare(b.advertiser.domain, "es")
  || a.creativeKey.localeCompare(b.creativeKey));

const transparencyCandidates = readJson(resolve(INPUT, "transparency-candidates.json"), { selected: [] });
const candidateByDomain = new Map((transparencyCandidates.selected || []).map((item) => [item.domain, item]));
const transparencyCreatives = [];
const advertiserProfiles = new Map();
for (const request of successful.filter((item) => item.phase === "transparency")) {
  const data = rawFor(request.id);
  if (!data) throw new Error(`Falta raw de ${request.id}`);
  const candidate = candidateByDomain.get(request.candidateDomain) || null;
  const rows = Array.isArray(data.ad_creatives) ? data.ad_creatives : [];
  for (const creative of rows) {
    const advertiserId = cleanText(creative.advertiser_id);
    const creativeId = cleanText(creative.ad_creative_id);
    if (!/^AR\d+$/.test(advertiserId) || !/^CR\d+$/.test(creativeId)) continue;
    const targetDomain = registrableDomain(creative.target_domain || request.candidateDomain);
    const row = {
      advertiserId,
      advertiser: cleanText(creative.advertiser),
      creativeId,
      format: cleanText(creative.format) || "unknown",
      targetDomain,
      candidateDomain: request.candidateDomain,
      targetMatchesCandidate: targetDomain === request.candidateDomain,
      previewUrl: cleanUrl(creative.image || creative.link || ""),
      width: Number(creative.width || 0) || null,
      height: Number(creative.height || 0) || null,
      firstShown: Number(creative.first_shown || 0) || null,
      lastShown: Number(creative.last_shown || 0) || null,
      detailsUrl: cleanUrl(creative.details_link || ""),
      candidateExistingCompany: candidate?.existingCompany || null,
    };
    transparencyCreatives.push(row);
    const profile = advertiserProfiles.get(advertiserId) || {
      advertiserId,
      names: new Set(),
      domains: new Set(),
      creativeIds: new Set(),
      formats: new Set(),
      firstShown: null,
      lastShown: null,
    };
    if (row.advertiser) profile.names.add(row.advertiser);
    if (row.targetDomain) profile.domains.add(row.targetDomain);
    profile.creativeIds.add(row.creativeId);
    profile.formats.add(row.format);
    if (row.firstShown) profile.firstShown = profile.firstShown
      ? Math.min(profile.firstShown, row.firstShown)
      : row.firstShown;
    if (row.lastShown) profile.lastShown = profile.lastShown
      ? Math.max(profile.lastShown, row.lastShown)
      : row.lastShown;
    advertiserProfiles.set(advertiserId, profile);
  }
}

const detailRows = [];
for (const request of successful.filter((item) => item.phase === "details")) {
  const data = rawFor(request.id);
  if (!data) throw new Error(`Falta raw de ${request.id}`);
  const information = data.search_information || {};
  const creatives = Array.isArray(data.ad_creatives) ? data.ad_creatives : [];
  detailRows.push({
    advertiserId: request.params.advertiser_id,
    creativeId: request.params.creative_id,
    candidateDomain: request.candidateDomain,
    format: cleanText(information.format) || "unknown",
    firstShown: Number(information.first_shown || 0) || null,
    lastShown: Number(information.last_shown || 0) || null,
    regionName: cleanText(information.region_name) || null,
    fundedBy: cleanText(information.ad_funded_by) || null,
    regions: Array.isArray(information.regions) ? information.regions.map((region) => ({
      region: region.region || null,
      regionName: cleanText(region.region_name),
      firstShown: Number(region.first_shown || 0) || null,
      lastShown: Number(region.last_shown || 0) || null,
    })) : [],
    sourceUrl: `https://adstransparency.google.com/advertiser/${request.params.advertiser_id}/creative/${request.params.creative_id}?region=ES`,
    variants: creatives.map((creative, index) => ({
      variant: index + 1,
      title: cleanText(creative.title),
      headline: cleanText(creative.headline),
      snippet: cleanText(creative.snippet),
      callToAction: cleanText(creative.call_to_action),
      visibleLink: cleanText(creative.visible_link),
      landingUrl: cleanUrl(creative.link || ""),
      imageUrl: cleanUrl(creative.image || ""),
      logoUrl: cleanUrl(creative.advertiser_logo || ""),
      videoUrl: cleanUrl(creative.video_link || ""),
      videoDuration: cleanText(creative.video_duration) || null,
      sitelinkTexts: Array.isArray(creative.sitelink_texts)
        ? creative.sitelink_texts.map(cleanText).filter(Boolean)
        : [],
    })),
  });
}

const profiles = [...advertiserProfiles.values()].map((profile) => ({
  advertiserId: profile.advertiserId,
  names: [...profile.names].sort((a, b) => a.localeCompare(b, "es")),
  domains: [...profile.domains].sort(),
  creativeCount: profile.creativeIds.size,
  creativeIds: [...profile.creativeIds].sort(),
  formats: [...profile.formats].sort(),
  firstShown: profile.firstShown,
  lastShown: profile.lastShown,
})).sort((a, b) => b.creativeCount - a.creativeCount || a.advertiserId.localeCompare(b.advertiserId));

const liveByDomain = new Map();
for (const item of liveAds) {
  const bucket = liveByDomain.get(item.advertiser.domain) || [];
  bucket.push(item);
  liveByDomain.set(item.advertiser.domain, bucket);
}
const transparencyByDomain = new Map();
for (const item of transparencyCreatives.filter((row) => row.targetMatchesCandidate)) {
  const bucket = transparencyByDomain.get(item.candidateDomain) || [];
  bucket.push(item);
  transparencyByDomain.set(item.candidateDomain, bucket);
}
const allDomains = unique([
  ...liveByDomain.keys(),
  ...(transparencyCandidates.selected || []).map((item) => item.domain),
]);
const companyCandidates = allDomains.map((domain) => {
  const live = liveByDomain.get(domain) || [];
  const transparency = transparencyByDomain.get(domain) || [];
  const current = companyByDomain.get(domain) || null;
  return {
    domain,
    proposedStatus: current ? "matched" : "review",
    proposedCompanyId: current?.companyId || null,
    proposedCompanyName: current?.companyName || null,
    evidence: {
      liveCreatives: live.length,
      liveObservations: live.reduce((sum, item) => sum + item.observationCount, 0),
      distinctQueries: new Set(live.flatMap((item) => item.queries)).size,
      devices: unique(live.flatMap((item) => item.devices)),
      locations: unique(live.flatMap((item) => item.locations)),
      advertiserIds: unique(transparency.map((item) => item.advertiserId)),
      transparencyCreatives: transparency.length,
      observedNames: unique([
        ...live.map((item) => item.advertiser.observedName),
        ...transparency.map((item) => item.advertiser),
      ]),
      landingUrls: unique(live.map((item) => item.landing.url)),
      sampleCopy: live.slice(0, 5).map((item) => ({
        title: item.copy.title,
        description: item.copy.description,
        landingUrl: item.landing.url,
        observationCount: item.observationCount,
      })),
    },
    reviewRule: current
      ? "El dominio coincide exactamente; confirmar alias/operador antes de publicar."
      : "Crear ficha solo si la landing vende leads, citas o captación a terceros y la identidad es verificable.",
  };
}).sort((a, b) => Number(Boolean(b.proposedCompanyId)) - Number(Boolean(a.proposedCompanyId))
  || b.evidence.liveObservations - a.evidence.liveObservations
  || b.evidence.transparencyCreatives - a.evidence.transparencyCreatives
  || a.domain.localeCompare(b.domain, "es"));

const output = {
  schema: "redvitalia-serpapi-google-ads-v1",
  generatedAt: new Date().toISOString(),
  provider: "SerpAPI",
  market: "España",
  methodology: {
    searches: 250,
    savedResponses: successful.length,
    distribution: {
      googleAds: phaseCounts.discovery,
      transparency: phaseCounts.transparency,
      creativeDetails: phaseCounts.details,
      interruptedDuplicates: Number(runState.unavailableChargedResponses || 0),
    },
    note: "Observación de presencia publicitaria. La posición, frecuencia y duración no demuestran inversión, conversiones ni rendimiento.",
  },
  audit: {
    creditsConsumed: Number(runState.creditsConsumed),
    successfulRequests: successful.length,
    unavailableChargedResponses: Number(runState.unavailableChargedResponses || 0),
    accountedCredits: Number(runState.accountedCredits || 0),
    accountBefore: {
      totalSearchesLeft: Number(runState.accountBefore?.totalSearchesLeft || 0),
      thisMonthUsage: Number(runState.accountBefore?.thisMonthUsage || 0),
    },
    accountAfter: {
      totalSearchesLeft: Number(runState.accountAfter?.totalSearchesLeft || 0),
      thisMonthUsage: Number(runState.accountAfter?.thisMonthUsage || 0),
    },
  },
  summary: {
    discoveryRequests: requestSummaries.length,
    discoveryRequestsWithAds: requestSummaries.filter((item) => item.adsReturned > 0).length,
    liveAdObservations: liveAds.reduce((sum, item) => sum + item.observationCount, 0),
    uniqueLiveCreatives: liveAds.length,
    uniqueLiveDomains: new Set(liveAds.map((item) => item.advertiser.domain)).size,
    transparencyCreatives: transparencyCreatives.length,
    transparencyAdvertisers: profiles.length,
    detailedCreatives: detailRows.length,
    currentCompanyDomainMatches: companyCandidates.filter((item) => item.proposedCompanyId).length,
    domainsRequiringReview: companyCandidates.filter((item) => !item.proposedCompanyId).length,
  },
  requests: requestSummaries,
  items: liveAds,
  advertiserProfiles: profiles,
  transparencyCreatives,
  creativeDetails: detailRows,
};

writeJson(OUTPUT, output);
writeJson(CANDIDATES_OUTPUT, {
  schema: "redvitalia-serpapi-company-candidates-v1",
  generatedAt: output.generatedAt,
  source: OUTPUT.replace(`${ROOT}\\`, "").replaceAll("\\", "/"),
  total: companyCandidates.length,
  matchedByDomain: companyCandidates.filter((item) => item.proposedCompanyId).length,
  requiringReview: companyCandidates.filter((item) => !item.proposedCompanyId).length,
  items: companyCandidates,
});
console.log(
  `SerpAPI normalizado: ${output.summary.liveAdObservations} observaciones, `
  + `${output.summary.uniqueLiveCreatives} anuncios, ${output.summary.uniqueLiveDomains} dominios, `
  + `${output.summary.transparencyCreatives} creatividades de transparencia.`,
);
