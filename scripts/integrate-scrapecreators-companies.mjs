#!/usr/bin/env node
/**
 * Integra las empresas españolas descubiertas por ScrapeCreators.
 *
 * A diferencia de la ampliación por dominios, esta capa admite anunciantes que
 * solo tienen una Page ID pública. Cada afirmación comercial se conserva como
 * declaración del anunciante, no como resultado validado por RedVitalia.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "db/scrapecreators-companies.json");
const normalizedPath = resolve(root, "db/scrapecreators-spain-leadgen.json");
const indexPath = resolve(root, "public/data/companies-index.json");
const detailsDir = resolve(root, "public/data/company-details");
const takeawaysPath = resolve(root, "public/data/takeaways.json");
const geoPath = resolve(root, "public/data/country-geo.json");
const OBSERVED_AT = "2026-08-26";

for (const path of [sourcePath, normalizedPath, indexPath, geoPath]) {
  if (!existsSync(path)) throw new Error(`Falta la entrada requerida: ${path}`);
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const normalized = JSON.parse(readFileSync(normalizedPath, "utf8"));
const current = JSON.parse(readFileSync(indexPath, "utf8"));
const currentById = new Map(current.map((company) => [company.id, company]));
const geo = JSON.parse(readFileSync(geoPath, "utf8")).find((row) => row.name === "España");
if (!Array.isArray(source) || !source.length) throw new Error("La fuente de empresas está vacía");
if (!geo) throw new Error("No se encontró el centroide de España");

const sourceIds = new Set(source.map((company) => company.id));
if (sourceIds.size !== source.length) throw new Error("Hay IDs duplicados en la fuente ScrapeCreators");
const pageOwners = new Map();
for (const company of source) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(company.id)) throw new Error(`ID inválido: ${company.id}`);
  if (!company.name || company.country !== "España") throw new Error(`Ficha fuente incompleta: ${company.id}`);
  for (const pageId of company.pageIds || []) {
    if (!/^\d{6,}$/.test(String(pageId))) throw new Error(`Page ID inválida: ${company.id}/${pageId}`);
    if (pageOwners.has(String(pageId))) {
      throw new Error(`Page ID duplicada: ${pageId} (${pageOwners.get(String(pageId))} y ${company.id})`);
    }
    pageOwners.set(String(pageId), company.id);
  }
}

const adsByPageId = new Map();
for (const ad of normalized.items || []) {
  const pageId = String(ad.pageId || "");
  const bucket = adsByPageId.get(pageId) || [];
  bucket.push(ad);
  adsByPageId.set(pageId, bucket);
}

const isAbsent = (value) =>
  !String(value || "").trim() ||
  /^(?:no (?:observad[oa]|localizad[oa]|publicad[oa]|disponible)|sin (?:landing|url|garant[ií]a)|n\/?a)[.\s]*$/i.test(String(value).trim());
const cleanObserved = (value) => (isAbsent(value) ? "" : String(value).trim());
const safeWebsite = (company) => {
  try {
    const url = new URL(String(company.website || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};
const mediaLibraryUrl = (pageId) =>
  `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ES&view_all_page_id=${pageId}`;

const managed = [];
for (const row of source) {
  const pageIds = [...new Set((row.pageIds || []).map(String))];
  const ads = pageIds.flatMap((pageId) => adsByPageId.get(pageId) || []);
  const uniqueAds = [...new Map(ads.map((ad) => [ad.externalId, ad])).values()];
  const activeAds = uniqueAds.filter((ad) => ad.isActive).length;
  const website = safeWebsite(row) || (pageIds[0] ? mediaLibraryUrl(pageIds[0]) : "");
  const domain = String(row.domain || "").trim() || "Sin web propia localizada";
  const direct = row.advertiserType === "directo";
  const highConfidence = row.confidence === "alta";
  const priceLocal = cleanObserved(row.priceLocal);
  const guarantee = cleanObserved(row.guarantee);
  const sources = [...new Set([
    ...(row.sources || []),
    ...pageIds.map(mediaLibraryUrl),
  ].filter((value) => /^https?:\/\//i.test(String(value))))];
  const evidence = highConfidence ? "Confirmada" : "Probable";
  const body = [
    "## Estado de la ficha",
    `Empresa descubierta en una importación estructurada de Meta Ads observada el ${OBSERVED_AT}. Asociación Page ID → empresa con confianza ${row.confidence || "media"}. Las cifras, promesas, precios y garantías se presentan como afirmaciones del anunciante; no prueban rendimiento real.`,
    "## Modelo observado",
    row.model || "No clasificado",
    "## Oferta observada",
    row.offer || "No se recuperó una oferta suficientemente clara.",
    ...(priceLocal ? ["## Precio comunicado por el anunciante", priceLocal] : []),
    ...(guarantee ? ["## Garantía o reducción de riesgo comunicada", guarantee] : []),
    "## Actividad publicitaria recuperada",
    `${uniqueAds.length} anuncios únicos recuperados para ${pageIds.length} Page ID${pageIds.length === 1 ? "" : "s"}; ${activeAds} figuraban activos en la fecha de consulta. Esta cifra es cobertura observada, no inversión ni rendimiento.`,
    "## Identidad publicitaria",
    pageIds.map((pageId) => `- Meta Page ID ${pageId}`).join("\n") || "- Sin Page ID asociada.",
    "## Relevancia para RedVitalia",
    `Relevancia ${String(row.relevance || "media").toLowerCase()}. ${direct ? "Actor directo de captación, venta de leads o citas." : "Actor adyacente de marketing, conversión, automatización o formación."}`,
    "## Fuentes consultadas",
    sources.map((url) => `- ${url}`).join("\n"),
  ].join("\n\n");

  managed.push({
    id: row.id,
    name: row.name,
    title: row.name,
    domain,
    website,
    country: "España",
    primaryCountry: "España",
    countries: ["España"],
    market: "España",
    markets: ["España"],
    scope: direct ? "Núcleo — agencia/leadgen" : "Adyacente — ecosistema de captación",
    agencyType: direct ? "Multi-nicho especializada" : "Marketing / automatización adyacente",
    offer: row.offer || "",
    priceLocal,
    priceStatus: priceLocal ? "Observado" : "No observable",
    price: {
      currency: null,
      amount: null,
      eur: null,
      label: priceLocal || "Sin precio público observable",
    },
    ticket: "",
    contract: "",
    guarantee,
    channels: ["Meta Ads"],
    metaStatus: activeAds ? "Activo observado" : uniqueAds.length ? "Inactivo en la muestra" : "No comprobado",
    metaAds: uniqueAds.length,
    googleStatus: "No comprobado",
    googleAds: 0,
    creativeArchive: uniqueAds.length,
    score: highConfidence ? (direct ? 45 : 32) : (direct ? 30 : 22),
    threat: direct ? "Media" : "Baja",
    relation: direct ? "Competidor directo" : "Competidor indirecto",
    decision: "Vigilar",
    evidence,
    proof: `${uniqueAds.length} anuncios Meta estructurados; ${sources.length} fuentes públicas enlazadas.`,
    team: "",
    cta: "",
    funnel: website && !/facebook\.com\/ads\/library/i.test(website)
      ? `Anuncio Meta → ${website}`
      : "Anuncio Meta → formulario o destino no público",
    niche: row.model || "",
    legal: "",
    review: "Revisión estructurada de anuncios y destinos públicos",
    reviewedAt: OBSERVED_AT,
    addedAt: OBSERVED_AT,
    sources,
    body,
    // La publicación multimedia es una capa posterior y también idempotente.
    // Si se regenera la ficha, conserva solo sus medios públicos ya archivados.
    media: currentById.get(row.id)?.media || [],
    mediaDeclared: (currentById.get(row.id)?.media || []).length,
    location: {
      companyId: row.id,
      latitude: geo.latitude,
      longitude: geo.longitude,
      precision: "centro_pais_mercado",
      locationLabel: "España: centro de país o mercado; no es sede.",
      locality: null,
      canonicalMarket: "España",
      commercialMarket: "España",
      locationCountry: "España",
      pointRepresents: "mercado o país canónico",
      headquartersVerified: false,
      sourceUrl: website || sources[0] || null,
      coordinateSourceUrl: null,
      limitation: "El punto representa el mercado español observado, no la sede de la empresa.",
      zoom: 4.2,
      reviewedAt: OBSERVED_AT,
    },
    scrapeCreatorsManaged: true,
  });
}

// Las fichas de esta capa son completamente regenerables y se reemplazan por ID.
const base = current.filter((company) => !sourceIds.has(company.id));
mkdirSync(detailsDir, { recursive: true });
for (const company of managed) {
  writeFileSync(
    resolve(detailsDir, `${company.id}.json`),
    `${JSON.stringify({ id: company.id, body: company.body, sources: company.sources }, null, 1)}\n`,
    "utf8",
  );
}
const lightweight = managed.map((company) => ({ ...company, body: "", sources: [] }));
writeFileSync(indexPath, `${JSON.stringify([...base, ...lightweight], null, 1)}\n`, "utf8");

// Mantiene el contrato de una conclusión por ficha sin fingir que es un ganador.
const takeaways = existsSync(takeawaysPath)
  ? JSON.parse(readFileSync(takeawaysPath, "utf8"))
  : { generatedAt: OBSERVED_AT, items: {} };
for (const company of managed) {
  takeaways.items[company.id] = {
    t: company.offer
      ? `Vigilar cómo ${company.name} formula su oferta observada: ${company.offer}`
      : `Vigilar a ${company.name}; la importación confirma actividad publicitaria, pero aún no una propuesta suficientemente detallada.`,
    copiable: "baja",
  };
}
// Elimina conclusiones de IDs que ya no forman parte del catálogo.
const finalIds = new Set([...base, ...managed].map((company) => company.id));
for (const id of Object.keys(takeaways.items)) if (!finalIds.has(id)) delete takeaways.items[id];
takeaways.generatedAt = OBSERVED_AT;
writeFileSync(takeawaysPath, `${JSON.stringify(takeaways, null, 1)}\n`, "utf8");

console.log(
  `ScrapeCreators empresas: ${managed.length} fichas integradas; catálogo ${base.length + managed.length}; ` +
    `${managed.reduce((sum, company) => sum + company.metaAds, 0)} anuncios asociados en fuente.`,
);
