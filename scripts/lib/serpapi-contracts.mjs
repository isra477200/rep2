import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const PUBLIC_STATUSES = new Set(["matched", "new"]);
const COMPANY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CREATIVE_ID_PATTERN = /^CR\d{10,}$/;
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;

const normalizedDomain = (value) => String(value || "")
  .trim()
  .replace(/\.$/, "")
  .toLocaleLowerCase("en");

export const assertSafeCompanyId = (value) => {
  const companyId = String(value || "");
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new Error(`companyId inseguro o inválido: ${companyId || "(vacío)"}`);
  }
  return companyId;
};

export const assertSafeCreativeId = (value) => {
  const creativeId = String(value || "");
  if (!CREATIVE_ID_PATTERN.test(creativeId)) {
    throw new Error(`creativeId inseguro o inválido: ${creativeId || "(vacío)"}`);
  }
  return creativeId;
};

const addObservedDomain = (domains, value, sourceLabel) => {
  if (!value) return;
  const domain = normalizedDomain(value);
  if (!DOMAIN_PATTERN.test(domain) || !domain.includes(".")) {
    throw new Error(`Dominio SerpAPI inválido en ${sourceLabel}: ${String(value)}`);
  }
  domains.add(domain);
};

export const observedSerpApiDomains = (source) => {
  const domains = new Set();
  for (const [index, item] of (source?.items || []).entries()) {
    addObservedDomain(domains, item.advertiser?.domain, `items[${index}].advertiser.domain`);
    addObservedDomain(domains, item.landing?.domain, `items[${index}].landing.domain`);
  }
  for (const [index, creative] of (source?.transparencyCreatives || []).entries()) {
    addObservedDomain(domains, creative.candidateDomain, `transparencyCreatives[${index}].candidateDomain`);
    addObservedDomain(domains, creative.targetDomain, `transparencyCreatives[${index}].targetDomain`);
  }
  for (const [index, detail] of (source?.creativeDetails || []).entries()) {
    addObservedDomain(domains, detail.candidateDomain, `creativeDetails[${index}].candidateDomain`);
    addObservedDomain(domains, detail.targetDomain, `creativeDetails[${index}].targetDomain`);
  }
  return [...domains].sort((left, right) => left.localeCompare(right, "en"));
};

export const assertCompleteEditorialCoverage = (source, domainMappings) => {
  const mappedDomains = new Set(
    Object.keys(domainMappings || {}).map(normalizedDomain),
  );
  const observedDomains = observedSerpApiDomains(source);
  const missing = observedDomains.filter((domain) => !mappedDomains.has(domain));
  if (missing.length) {
    throw new Error(`Mapa editorial SerpAPI incompleto; faltan: ${missing.join(", ")}`);
  }
  return observedDomains;
};

/**
 * Las altas `new` se regeneran mientras siguen gestionadas por SerpAPI. Si el
 * editor las promociona a `matched`, se conservan y dejan de ser descartables.
 */
export const reconcileManagedCompanies = (companies, publicMappings) => {
  const promotedIds = new Set(
    (publicMappings || [])
      .filter(([, mapping]) => mapping?.status === "matched")
      .map(([, mapping]) => assertSafeCompanyId(mapping.companyId)),
  );
  return (companies || []).flatMap((company) => {
    if (!company?.serpApiManaged) return [company];
    if (!promotedIds.has(company.id)) return [];
    const promoted = { ...company };
    delete promoted.serpApiManaged;
    return [promoted];
  });
};

const mediaPriority = (value) => ({ image: 0, text: 1, video: 2, unknown: 3 }[value] ?? 3);
const compareMediaRows = (left, right) => mediaPriority(left.format) - mediaPriority(right.format)
  || Number(right.lastShown || 0) - Number(left.lastShown || 0)
  || String(left.creativeId).localeCompare(String(right.creativeId), "en")
  || String(left.domain).localeCompare(String(right.domain), "en");

/**
 * Deduplica cada CR de forma global y aplica el límite a la ficha final, no a
 * cada alias de dominio que apunte a ella.
 */
export const selectTransparencyMedia = ({
  creatives,
  domainMappings,
  safePreview,
  perCompany = 10,
}) => {
  if (!Number.isInteger(perCompany) || perCompany < 1) {
    throw new Error(`Límite por empresa inválido: ${perCompany}`);
  }
  const published = new Map(
    Object.entries(domainMappings || {})
      .filter(([, mapping]) => PUBLIC_STATUSES.has(mapping?.status))
      .map(([domain, mapping]) => [normalizedDomain(domain), {
        ...mapping,
        companyId: assertSafeCompanyId(mapping.companyId),
      }]),
  );
  const byCreativeId = new Map();
  for (const creative of creatives || []) {
    const domain = normalizedDomain(creative.candidateDomain || creative.targetDomain);
    const mapping = published.get(domain);
    if (!mapping) continue;
    const preview = safePreview(creative.previewUrl);
    const creativeId = String(creative.creativeId || "");
    if (!preview || !CREATIVE_ID_PATTERN.test(creativeId)) continue;
    const row = {
      ...creative,
      creativeId,
      domain,
      companyId: mapping.companyId,
      previewUrl: typeof preview === "string" ? preview : preview.href,
    };
    const existing = byCreativeId.get(creativeId);
    if (existing && existing.companyId !== row.companyId) {
      throw new Error(
        `Creatividad ${creativeId} asociada a dos fichas: ${existing.companyId} y ${row.companyId}`,
      );
    }
    if (!existing || compareMediaRows(row, existing) < 0) byCreativeId.set(creativeId, row);
  }

  const rowsByCompany = new Map();
  for (const row of byCreativeId.values()) {
    const bucket = rowsByCompany.get(row.companyId) || [];
    bucket.push(row);
    rowsByCompany.set(row.companyId, bucket);
  }

  return [...rowsByCompany.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "es"))
    .flatMap(([, rows]) => [...rows]
      .sort(compareMediaRows)
      .slice(0, perCompany)
      .map((row, index) => ({ ...row, selectionRank: index + 1 })));
};

export const resolveSerpApiMediaDestination = (mediaRoot, companyIdValue, creativeIdValue) => {
  const companyId = assertSafeCompanyId(companyIdValue);
  const creativeId = assertSafeCreativeId(creativeIdValue);
  const root = resolve(mediaRoot);
  const directory = resolve(root, companyId);
  const absolute = resolve(directory, `${creativeId}.webp`);
  const relativePath = relative(root, absolute);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`Destino de media fuera del directorio permitido: ${absolute}`);
  }
  return {
    directory,
    absolute,
    file: `/media/serpapi-google/${companyId}/${creativeId}.webp`,
  };
};

/** Devuelve el índice anterior actualizado si el binario local sigue íntegro. */
export const reusableDownloadedMedia = ({ item, row, mediaRoot }) => {
  if (!item || item.status !== "downloaded") return null;
  const destination = resolveSerpApiMediaDestination(mediaRoot, row.companyId, row.creativeId);
  if (
    item.companyId !== row.companyId
    || item.creativeId !== row.creativeId
    || item.file !== destination.file
    || !existsSync(destination.absolute)
  ) return null;
  const bytes = readFileSync(destination.absolute);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!bytes.length || Number(item.bytes) !== bytes.length || item.sha256 !== sha256) return null;
  const asset = (item.mediaAssets || []).find((candidate) => candidate.file === destination.file);
  if (!asset || Number(asset.bytes) !== bytes.length || asset.sha256 !== sha256) return null;
  return {
    ...item,
    advertiserId: row.advertiserId || item.advertiserId,
    companyId: row.companyId,
    domain: row.domain,
    format: row.format,
    selectionRank: row.selectionRank,
    previewUrl: row.previewUrl || item.previewUrl,
    sourceUrl: row.detailsUrl || item.sourceUrl,
    reason: undefined,
    status: "downloaded",
  };
};
