#!/usr/bin/env node

/**
 * Propone targets de landing a partir del corpus ScrapeCreators ya normalizado.
 *
 * No navega ni captura páginas. Tampoco escribe nunca el target canónico:
 * --write genera una copia completa y revisable dentro de work/.
 * Sin --write el comportamiento es dry-run.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const WORK_ROOT = resolve(ROOT, "work");
const DEFAULT_PATHS = {
  normalized: resolve(ROOT, "db/scrapecreators-spain-leadgen.json"),
  companyMap: resolve(ROOT, "scripts/data/scrapecreators-company-map.json"),
  companies: resolve(ROOT, "public/data/companies-index.json"),
  companyDetails: resolve(ROOT, "public/data/company-details"),
  targets: resolve(ROOT, "scripts/data/scrapecreators-landing-targets.json"),
  output: resolve(WORK_ROOT, "scrapecreators-landing-targets-proposal.json"),
};

const BLOCKED_HOSTS = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "messenger.com",
  "instagram.com",
  "cdninstagram.com",
  "fbcdn.net",
  "meta.com",
  "whatsapp.com",
  "wa.me",
];
const CALENDAR_HOSTS = [
  "cal.com",
  "calendly.com",
  "tidycal.com",
  "youcanbook.me",
  "acuityscheduling.com",
  "calendar.google.com",
  "meetings.hubspot.com",
];
const NON_LANDING_HOSTS = [
  "docs.google.com",
  "drive.google.com",
  "google.com",
  "goo.gl",
  "linkedin.com",
  "maps.app.goo.gl",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtu.be",
  "youtube.com",
];
const LEGAL_HOSTS = ["iubenda.com", "privacypolicies.com", "termly.io"];
const FORM_HOSTS = [
  "forms.gle",
  "forms.office.com",
  "jotform.com",
  "tally.so",
  "typeform.com",
];
const GENERIC_HOSTS = [
  "leadconnectorhq.com",
  "systeme.io",
  "clickfunnels.com",
  "myclickfunnels.com",
  "skool.com",
  "sites.google.com",
  "notion.site",
];
const TRACKING_PARAMS = /^(?:[a-z]|ad|ad_?id|campaign|code|dclid|fbclid|gclid|mc_[ce]id|msclkid|page_?id|ref|reference|ref_src|ref_url|source|src|ttclid|twclid|utm_.+)$/iu;
const SECRET_PARAMS = /(?:^|_)(?:access_?token|auth|authorization|expires?|expiry|hash|invite_?token|jwt|key|nonce|secret|signature|signed|token)(?:$|_)/iu;
const LEGAL_PATH = /(?:^|[-_/])(?:aviso[-_]?legal|legal|mentions[-_]?legales|privacy|privacy[-_]?policy|pol[ií]?tica[-_]?(?:de[-_]?)?privacidad|privacidad|politique[-_]?de[-_]?confidentialite|terms|terms[-_]?of[-_]?service|terminos|condiciones|cookies?|proteccion[-_]?de[-_]?datos)(?:\/|$|[-_.])/iu;
const OFFER_PATH = /(?:^|[-_/])(?:auditoria|captacion|clase[-_]?gratuita|clientes?|consultoria|curso|demo|diagnostico|framework|formula|leads?|llamada|masterclass|metodo|oferta|optin|registro|resultados?|saber[-_]?mas|servicios?|sistema|taller|vsl|webinar)(?:$|[-_/])/iu;
const PROOF_PATH = /(?:^|[-_/])(?:casos?|clientes?|opiniones?|resultados?|testimonios?)(?:$|[-_/])/iu;
const PRICE_PATH = /(?:^|[-_/])(?:planes?|precios?|pricing|tarifas?)(?:$|[-_/])/iu;
const CONVERSION_PATH = /(?:^|[-_/])(?:agenda|appointment|book|booking|contacto|demo|reserva|reservar|reunion)(?:$|[-_/])/iu;
const CALENDAR_PATH = /(?:^|\/)(?:agenda|appointment|appointments|book|booking|calendar|calendario|reserva|reservar|reunion)(?:[-_/]|$)/iu;
const PURE_CALENDAR_PATH = /(?:^|\/)(?:widget\/)?(?:appointments?|bookings?|calendar|calendario)(?:\/|$)/iu;
const EPHEMERAL_PATH = /(?:^|\/)(?:preview|temporary|temp|signed)(?:\/|$)/iu;
const POST_CONVERSION_PATH = /(?:^|[-_/])(?:completad[oa]|completed?|confirmacion|confirmation|gracias|thank[-_]?you|thanks)(?:$|[-_/]|\d)/iu;
const ASSET_PATH = /\.(?:avi|gif|heic|jpe?g|m4v|mov|mp4|pdf|png|svg|webm|webp)$/iu;

const usage = () => console.log(`
Actualizador seguro de targets ScrapeCreators

  --dry-run                 Analiza e imprime la propuesta; modo por defecto.
  --write                   Escribe una copia candidata dentro de work/.
  --ids id-a,id-b           Limita nuevas propuestas a esas fichas; se puede repetir.
  --max-per-company N       Máximo de URLs nuevas por ficha (1 por defecto).
  --output PATH             Salida candidata; debe permanecer dentro de work/.
  --normalized PATH         Corpus normalizado alternativo.
  --company-map PATH        Mapa pageId -> companyId alternativo.
  --companies PATH          Índice de fichas alternativo.
  --company-details PATH    Directorio de fichas detalladas alternativo.
  --targets PATH            Target canónico de entrada alternativo (solo lectura).
  --help                    Muestra esta ayuda.

El script no realiza llamadas de red ni captura páginas.
`);

const cleanText = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const asArray = (value) => (Array.isArray(value) ? value : []);
const isInside = (parent, child) => {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
};
const asPath = (value) => (isAbsolute(value) ? resolve(value) : resolve(ROOT, value));
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const atomicWriteJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
};

const parsePositiveInteger = (value, label) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} debe ser >= 1`);
  return number;
};

const parseArgs = (argv) => {
  const options = {
    write: false,
    ids: new Set(),
    maxPerCompany: 1,
    ...DEFAULT_PATHS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`Falta valor para ${arg}`);
      return value;
    };
    const addIds = (value) =>
      value
        .split(",")
        .map(cleanText)
        .filter(Boolean)
        .forEach((id) => options.ids.add(id));
    if (arg === "--write") options.write = true;
    else if (arg === "--dry-run") options.write = false;
    else if (arg === "--ids") addIds(next());
    else if (arg.startsWith("--ids=")) addIds(arg.slice("--ids=".length));
    else if (arg === "--max-per-company") {
      options.maxPerCompany = parsePositiveInteger(next(), "--max-per-company");
    } else if (arg === "--output") options.output = asPath(next());
    else if (arg === "--normalized") options.normalized = asPath(next());
    else if (arg === "--company-map") options.companyMap = asPath(next());
    else if (arg === "--companies") options.companies = asPath(next());
    else if (arg === "--company-details") options.companyDetails = asPath(next());
    else if (arg === "--targets") options.targets = asPath(next());
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else throw new Error(`Argumento desconocido: ${arg}`);
  }
  return options;
};

const hostMatches = (hostname, domains) =>
  domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

const isPrivateHost = (hostname) =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname.endsWith(".local") ||
  hostname.endsWith(".internal") ||
  hostname === "::1" ||
  /^(?:127\.|10\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/u.test(hostname);

const normalizePathname = (pathname) => {
  const compact = pathname.replace(/\/{2,}/gu, "/");
  if (compact === "/" || /\/index\.(?:html?|php)$/iu.test(compact)) {
    return compact.replace(/\/index\.(?:html?|php)$/iu, "/");
  }
  return compact.replace(/\/+$/u, "") || "/";
};

export const urlIdentity = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    return `${host}${normalizePathname(url.pathname).toLowerCase()}${url.search}`;
  } catch {
    return null;
  }
};

export function inspectCommercialUrl(value) {
  const original = cleanText(value).replace(/[),.;]+$/u, "");
  if (!original) return { accepted: false, reason: "empty" };
  let url;
  try {
    url = new URL(original);
  } catch {
    return { accepted: false, reason: "invalid_url" };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { accepted: false, reason: "non_http" };
  }
  if (url.username || url.password) return { accepted: false, reason: "credentials" };
  const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");
  if (!hostname || isPrivateHost(hostname)) return { accepted: false, reason: "private_host" };
  if (hostMatches(hostname, BLOCKED_HOSTS)) return { accepted: false, reason: "platform_or_cdn" };
  if (hostMatches(hostname, CALENDAR_HOSTS)) return { accepted: false, reason: "calendar_only" };
  if (hostMatches(hostname, LEGAL_HOSTS)) return { accepted: false, reason: "legal_or_privacy" };
  if (hostMatches(hostname, FORM_HOSTS)) return { accepted: false, reason: "form_only" };
  if (hostMatches(hostname, NON_LANDING_HOSTS)) {
    return { accepted: false, reason: "non_commercial_platform" };
  }
  if (/\{\{|\}\}|%7b%7b|%7d%7d/iu.test(original)) {
    return { accepted: false, reason: "template_or_broken_url" };
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    return { accepted: false, reason: "invalid_encoding" };
  }
  if (LEGAL_PATH.test(decodedPath)) return { accepted: false, reason: "legal_or_privacy" };
  if (EPHEMERAL_PATH.test(decodedPath)) return { accepted: false, reason: "ephemeral_path" };
  if (POST_CONVERSION_PATH.test(decodedPath)) return { accepted: false, reason: "post_conversion" };
  if (ASSET_PATH.test(decodedPath)) return { accepted: false, reason: "asset_not_page" };
  if (PURE_CALENDAR_PATH.test(decodedPath)) return { accepted: false, reason: "calendar_only" };
  if (CALENDAR_PATH.test(decodedPath) && !OFFER_PATH.test(decodedPath)) {
    return { accepted: false, reason: "calendar_only" };
  }

  for (const key of [...url.searchParams.keys()]) {
    if (SECRET_PARAMS.test(key)) return { accepted: false, reason: "ephemeral_query" };
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  if (url.href.length > 500) return { accepted: false, reason: "oversized_url" };

  url.username = "";
  url.password = "";
  url.hash = "";
  url.hostname = hostname;
  url.pathname = normalizePathname(url.pathname);
  const sortedParams = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
  );
  url.search = "";
  for (const [key, parameter] of sortedParams) url.searchParams.append(key, parameter);

  const path = url.pathname.toLowerCase();
  const role = PROOF_PATH.test(path)
    ? "proof"
    : PRICE_PATH.test(path)
      ? "pricing"
      : CONVERSION_PATH.test(path)
        ? "conversion"
        : path === "/"
          ? "homepage"
          : "landing";
  return {
    accepted: true,
    reason: null,
    url: url.href,
    identity: urlIdentity(url.href),
    hostname,
    role,
    hasOfferPath: OFFER_PATH.test(path),
    isHomepage: path === "/" && !url.search,
    genericHost: hostMatches(hostname, GENERIC_HOSTS),
  };
}

const registrableDomain = (hostname) => {
  const parts = hostname.toLowerCase().replace(/^www\./u, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const suffix = parts.slice(-2).join(".");
  if (/^(?:co\.uk|com\.au|com\.br|com\.mx|com\.ar)$/u.test(suffix) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return suffix;
};

export const targetIdentity = (value) => {
  try {
    const url = new URL(value);
    return `${registrableDomain(url.hostname)}${normalizePathname(url.pathname).toLowerCase()}${url.search}`;
  } catch {
    return null;
  }
};

const parseDomain = (value) => {
  const text = cleanText(value);
  if (!text) return null;
  try {
    return new URL(text.includes("://") ? text : `https://${text}`).hostname
      .toLowerCase()
      .replace(/^www\./u, "");
  } catch {
    return null;
  }
};

const extractUrls = (value) =>
  cleanText(value).match(/https?:\/\/[^\s<>{}"']+/giu)?.map((url) => url.replace(/[),.;]+$/u, "")) || [];

const compactBrand = (value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]/gu, "");

const candidateScore = (candidate, ownedDomains, company) => {
  const inspected = candidate.inspected;
  const candidateDomain = registrableDomain(inspected.hostname);
  const ownDomain = [...ownedDomains].some(
    (domain) => registrableDomain(domain) === candidateDomain,
  );
  const marker = compactBrand(`${inspected.hostname}${new URL(inspected.url).pathname}`);
  const brandKeys = [compactBrand(company.id), compactBrand(company.name)].filter(
    (value) => value.length >= 5,
  );
  const brandAligned = !ownDomain && brandKeys.some((value) => marker.includes(value));
  const sources = candidate.sources;
  let score = 0;
  if (ownDomain) score += 120;
  else if (brandAligned) score += 75;
  if (inspected.hasOfferPath) score += 55;
  else if (inspected.isHomepage) score += ownDomain ? 28 : 10;
  else score += 16;
  if (sources.has("normalized_ad_landing")) score += 30;
  if (sources.has("company_website")) score += 20;
  if (sources.has("company_funnel")) score += 12;
  score += Math.min(30, candidate.sightings * 3);
  score += Math.min(20, candidate.activeSightings * 4);
  if (candidate.inspected.url.startsWith("https://")) score += 5;
  if (inspected.genericHost) score -= 35;
  return { score, ownDomain, brandAligned };
};

const addCandidate = (bucket, rawUrl, metadata) => {
  const inspected = inspectCommercialUrl(rawUrl);
  if (!inspected.accepted) return inspected.reason;
  const key = inspected.identity;
  const current = bucket.get(key) || {
    inspected,
    sources: new Set(),
    sightings: 0,
    activeSightings: 0,
    pageIds: new Set(),
  };
  current.sources.add(metadata.source);
  current.sightings += 1;
  if (metadata.active) current.activeSightings += 1;
  if (metadata.pageId) current.pageIds.add(String(metadata.pageId));
  if (
    inspected.url.startsWith("https://") &&
    !current.inspected.url.startsWith("https://")
  ) {
    current.inspected = inspected;
  }
  bucket.set(key, current);
  return null;
};

export function buildLandingTargetProposal({
  normalized,
  companyMap,
  companies,
  companyDetails = [],
  existingTargets,
  ids = null,
  maxPerCompany = 1,
}) {
  const mappings = companyMap?.pageIds || {};
  const companyById = new Map(asArray(companies).map((company) => [company.id, company]));
  const detailsById = new Map(asArray(companyDetails).map((detail) => [detail.id, detail]));
  const matchedPagesByCompany = new Map();
  for (const [pageId, mapping] of Object.entries(mappings)) {
    if (mapping?.status !== "matched" || !mapping.companyId || !companyById.has(mapping.companyId)) {
      continue;
    }
    if (!matchedPagesByCompany.has(mapping.companyId)) matchedPagesByCompany.set(mapping.companyId, new Set());
    matchedPagesByCompany.get(mapping.companyId).add(String(pageId));
  }

  const requestedIds = ids
    ? new Set(ids instanceof Set ? ids : asArray(ids).map(String))
    : null;
  const candidatesByCompany = new Map(
    [...matchedPagesByCompany.keys()]
      .filter((companyId) => !requestedIds || requestedIds.has(companyId))
      .map((companyId) => [companyId, new Map()]),
  );
  const rejected = new Map();
  const markRejected = (reason) => {
    if (reason) rejected.set(reason, (rejected.get(reason) || 0) + 1);
  };

  for (const ad of asArray(normalized?.items)) {
    const pageIds = new Set([
      cleanText(ad?.pageId),
      ...asArray(ad?.observedPageIds).map((pageId) => cleanText(pageId)),
    ].filter(Boolean));
    for (const pageId of pageIds) {
      const mapping = mappings[pageId];
      if (mapping?.status !== "matched" || !candidatesByCompany.has(mapping.companyId)) continue;
      const bucket = candidatesByCompany.get(mapping.companyId);
      for (const url of asArray(ad?.landing?.urls)) {
        markRejected(addCandidate(bucket, url, {
          source: "normalized_ad_landing",
          active: Boolean(ad?.isActive),
          pageId,
        }));
      }
    }
  }

  for (const [companyId, bucket] of candidatesByCompany) {
    const company = companyById.get(companyId);
    const detail = detailsById.get(companyId);
    const pageId = [...matchedPagesByCompany.get(companyId)][0];
    markRejected(addCandidate(bucket, company.website, {
      source: "company_website",
      active: false,
      pageId,
    }));
    for (const url of extractUrls(company.funnel)) {
      markRejected(addCandidate(bucket, url, {
        source: "company_funnel",
        active: false,
        pageId,
      }));
    }
    for (const url of asArray(company.sources)) {
      markRejected(addCandidate(bucket, url, {
        source: "company_source",
        active: false,
        pageId,
      }));
    }
    for (const url of new Set([
      ...asArray(detail?.sources),
      ...extractUrls(detail?.body),
    ])) {
      markRejected(addCandidate(bucket, url, {
        source: "company_detail",
        active: false,
        pageId,
      }));
    }
  }

  const existingItems = asArray(existingTargets?.items).map((item) => ({ ...item }));
  const usedUrls = new Set(existingItems.map((item) => targetIdentity(item.url)).filter(Boolean));
  const additions = [];
  const decisions = [];
  for (const companyId of [...candidatesByCompany.keys()].sort()) {
    const company = companyById.get(companyId);
    const ownedDomains = new Set(
      [parseDomain(company.domain), parseDomain(company.website)].filter(Boolean),
    );
    const ranked = [...candidatesByCompany.get(companyId).values()]
      .map((candidate) => ({
        ...candidate,
        ...candidateScore(candidate, ownedDomains, company),
      }))
      .filter(
        (candidate) =>
          candidate.ownDomain ||
          candidate.brandAligned ||
          candidate.inspected.hasOfferPath ||
          candidate.sources.has("company_website"),
      )
      .sort((left, right) =>
        right.score - left.score ||
        Number(right.ownDomain) - Number(left.ownDomain) ||
        left.inspected.url.localeCompare(right.inspected.url),
      );
    let addedForCompany = 0;
    for (const candidate of ranked) {
      if (addedForCompany >= maxPerCompany) break;
      const dedupeIdentity = targetIdentity(candidate.inspected.url);
      if (!dedupeIdentity || usedUrls.has(dedupeIdentity)) continue;
      const target = {
        id: companyId,
        name: company.name,
        url: candidate.inspected.url,
        role: candidate.inspected.role,
      };
      additions.push(target);
      decisions.push({
        ...target,
        score: candidate.score,
        ownDomain: candidate.ownDomain,
        brandAligned: candidate.brandAligned,
        sources: [...candidate.sources].sort(),
        sightings: candidate.sightings,
        activeSightings: candidate.activeSightings,
        pageIds: [...candidate.pageIds].sort(),
      });
      usedUrls.add(dedupeIdentity);
      addedForCompany += 1;
    }
  }

  const unknownIds = requestedIds
    ? [...requestedIds].filter((id) => !matchedPagesByCompany.has(id)).sort()
    : [];
  return {
    document: {
      ...existingTargets,
      generatedAt: new Date().toISOString().slice(0, 10),
      items: [...existingItems, ...additions],
    },
    additions,
    decisions,
    summary: {
      existing: existingItems.length,
      matchedCompanies: matchedPagesByCompany.size,
      selectedCompanies: candidatesByCompany.size,
      proposed: additions.length,
      final: existingItems.length + additions.length,
      rejectedByReason: Object.fromEntries([...rejected.entries()].sort()),
      unknownIds,
    },
  };
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  for (const [label, path] of Object.entries({
    normalized: options.normalized,
    companyMap: options.companyMap,
    companies: options.companies,
    companyDetails: options.companyDetails,
    targets: options.targets,
  })) {
    if (!existsSync(path)) throw new Error(`${label}: no existe ${path}`);
  }
  if (options.write) {
    if (!isInside(WORK_ROOT, options.output)) {
      throw new Error("La salida debe permanecer dentro de work/");
    }
    if (resolve(options.output) === resolve(options.targets)) {
      throw new Error("El target canónico es de solo lectura");
    }
  }

  const [normalized, companyMap, companies, existingTargets, detailEntries] = await Promise.all([
    readJson(options.normalized),
    readJson(options.companyMap),
    readJson(options.companies),
    readJson(options.targets),
    readdir(options.companyDetails, { withFileTypes: true }),
  ]);
  const detailPaths = detailEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => resolve(options.companyDetails, entry.name));
  const companyDetails = await Promise.all(detailPaths.map(readJson));
  const proposal = buildLandingTargetProposal({
    normalized,
    companyMap,
    companies,
    companyDetails,
    existingTargets,
    ids: options.ids.size ? options.ids : null,
    maxPerCompany: options.maxPerCompany,
  });
  const report = {
    mode: options.write ? "write-proposal" : "dry-run",
    networkCalls: 0,
    captures: 0,
    canonicalTargetModified: false,
    ...proposal.summary,
    additions: proposal.decisions,
    output: options.write ? options.output : null,
  };
  if (options.write) await atomicWriteJson(options.output, proposal.document);
  console.log(JSON.stringify(report, null, 2));
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`ERROR: ${cleanText(error?.message || error)}`);
    process.exitCode = 1;
  });
}
