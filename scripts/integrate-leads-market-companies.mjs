#!/usr/bin/env node
/**
 * Crea las fichas nuevas aprobadas del informe de mercado y enriquece, sin
 * reemplazar su investigación previa, las fichas canónicas ya existentes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const companySourcePath = resolve(root, "db/leads-market-companies.json");
const adsSourcePath = resolve(root, "db/leads-market-spain-2026-08-26.json");
const reviewPath = resolve(root, "scripts/data/leads-market-company-review.json");
const canonicalMapPath = resolve(root, "scripts/data/scrapecreators-company-map.json");
const indexPath = resolve(root, "public/data/companies-index.json");
const detailsDir = resolve(root, "public/data/company-details");
const geoPath = resolve(root, "public/data/country-geo.json");
const takeawaysPath = resolve(root, "public/data/takeaways.json");
const OBSERVED_AT = "2026-08-26";
const DETAIL_MARKER = "## Actualización · estudio de mercado de leads (26/08/2026)";

for (const path of [companySourcePath, adsSourcePath, reviewPath, canonicalMapPath, indexPath, geoPath]) {
  if (!existsSync(path)) throw new Error(`Falta la entrada requerida: ${path}`);
}

const companySource = JSON.parse(readFileSync(companySourcePath, "utf8"));
const adsSource = JSON.parse(readFileSync(adsSourcePath, "utf8"));
const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const canonicalMap = JSON.parse(readFileSync(canonicalMapPath, "utf8"));
const current = JSON.parse(readFileSync(indexPath, "utf8"));
const geoRows = JSON.parse(readFileSync(geoPath, "utf8"));
const geoByCountry = new Map(geoRows.map((row) => [row.name, row]));
const currentById = new Map(current.map((company) => [company.id, company]));
const sourceIds = new Set(companySource.map((company) => company.id));

if (!Array.isArray(companySource) || !companySource.length) throw new Error("La fuente de empresas está vacía");
if (sourceIds.size !== companySource.length) throw new Error("Hay IDs de empresa duplicados");

const pageOwners = new Map();
for (const company of companySource) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(company.id)) throw new Error(`ID inválido: ${company.id}`);
  if (!company.name || !company.model || !company.offer) throw new Error(`Ficha incompleta: ${company.id}`);
  for (const pageId of company.pageIds || []) {
    if (!/^\d{6,}$/.test(String(pageId))) throw new Error(`Page ID inválida: ${company.id}/${pageId}`);
    if (pageOwners.has(String(pageId))) throw new Error(`Page ID duplicada en nuevas fichas: ${pageId}`);
    pageOwners.set(String(pageId), company.id);
    const mapping = review.pageIds?.[String(pageId)];
    if (mapping?.status !== "matched" || mapping.companyId !== company.id) {
      throw new Error(`La revisión no confirma ${pageId} → ${company.id}`);
    }
  }
}

const mappingForPage = (pageId) => {
  const editorial = review.pageIds?.[String(pageId)];
  if (editorial) return editorial;
  return canonicalMap.pageIds?.[String(pageId)] || null;
};

const adsByCompany = new Map();
for (const ad of adsSource.items || []) {
  const mapping = mappingForPage(ad.pageId);
  if (mapping?.status !== "matched" || !mapping.companyId) continue;
  const bucket = adsByCompany.get(mapping.companyId) || [];
  bucket.push(ad);
  adsByCompany.set(mapping.companyId, bucket);
}

const providerByPage = new Map((adsSource.topProviders || []).map((row) => [String(row.pageId), row]));
const providerRowsFor = (pageIds) => pageIds.map((pageId) => providerByPage.get(String(pageId))).filter(Boolean);
const unique = (values) => [...new Set(values.filter(Boolean))];
const safeWebsite = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};
const libraryUrl = (pageId) =>
  `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ES&view_all_page_id=${pageId}`;
const detailPathFor = (id) => resolve(detailsDir, `${id}.json`);
const publicMedia = (ad) => ad.media?.localFile
  ? {
      file: ad.media.localFile,
      type: ad.media.type || "image/jpeg",
      bytes: Number(ad.media.bytes || 0),
      width: Number(ad.media.width || 0) || null,
      height: Number(ad.media.height || 0) || null,
      label: ad.media.role === "video_poster" ? "Anuncio Meta · fotograma" : "Anuncio Meta · imagen",
      title: `${ad.pageName} · Meta ${ad.externalId}`,
      externalId: String(ad.externalId),
    }
  : null;
const mergeMedia = (existing, ads) => {
  const output = (existing || []).map((media) => ({
    ...media,
    file: String(media.file || "").replace(
      /^\/media\/lead-market\/(lead-market-meta-\d+\.jpg)$/,
      "/media/$1",
    ),
  }));
  const representedIds = new Set();
  for (const media of output) {
    const text = `${media.externalId || ""} ${media.file || ""} ${media.title || ""}`;
    for (const match of text.matchAll(/\b\d{10,}\b/g)) representedIds.add(match[0]);
  }
  for (const ad of ads) {
    const externalId = String(ad.externalId || "");
    if (!externalId || representedIds.has(externalId)) continue;
    const media = publicMedia(ad);
    if (!media) continue;
    output.push({ ...media, order: output.length + 1 });
    representedIds.add(externalId);
  }
  return output.map((media, index) => ({ ...media, order: index + 1 }));
};
const pricePresent = (value) => value && !/^no (?:observad|publicad|confirmad)/i.test(String(value).trim());
const guaranteePresent = (value) => value && !/^no (?:observad|se observ)/i.test(String(value).trim());

const insightBlock = (companyId, pageIds) => {
  const ads = unique((adsByCompany.get(companyId) || []).map((ad) => ad.externalId))
    .map((id) => (adsByCompany.get(companyId) || []).find((ad) => ad.externalId === id));
  const providers = providerRowsFor(pageIds);
  const observedCount = Math.max(
    ads.length,
    providers.reduce((sum, row) => sum + Number(row.observedActiveAds || 0), 0),
  );
  const categories = unique(ads.map((ad) => ad.marketIntelligence?.category));
  const verticals = unique(ads.flatMap((ad) => ad.marketIntelligence?.verticals || []));
  const guarantees = unique(ads.flatMap((ad) => ad.marketIntelligence?.guarantees || []));
  const startDates = ads.map((ad) => ad.startedAt).filter(Boolean).sort();
  const firstCopy = ads.find((ad) => ad.copy?.text || ad.copy?.title);
  const excerpt = String(firstCopy?.copy?.text || firstCopy?.copy?.title || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
  const lines = [
    DETAIL_MARKER,
    `Corte secundario observado el ${OBSERVED_AT}. El informe contó ${observedCount} anuncios activos para las Page ID asociadas y entregó ${ads.length} creatividades con ID, copy e imagen. El conteo no equivale a inversión, impresiones ni rendimiento.`,
    categories.length ? `**Clasificación de la fuente:** ${categories.join(" · ")}. Se conserva como etiqueta del informe, no como verdad automática.` : "",
    verticals.length ? `**Verticales detectadas:** ${verticals.join(" · ")}.` : "",
    guarantees.length ? `**Reducción de riesgo detectada:** ${guarantees.join(" · ")}; falta verificar el condicionado.` : "",
    startDates.length ? `**Inicio más antiguo dentro de la galería detallada:** ${startDates[0].slice(0, 10)}.` : "",
    excerpt ? `**Muestra literal de copy:** “${excerpt}${excerpt.length >= 420 ? "…" : ""}”` : "",
    ads.length ? "**Creatividades incorporadas:**\n" + ads.map((ad) => `- Meta ${ad.externalId}: ${ad.sourceUrl}`).join("\n") : "",
  ].filter(Boolean);
  return { body: lines.join("\n\n"), ads, observedCount, categories, verticals, guarantees };
};

mkdirSync(detailsDir, { recursive: true });
const managed = [];
for (const row of companySource) {
  const pageIds = unique((row.pageIds || []).map(String));
  const insight = insightBlock(row.id, pageIds);
  const geo = geoByCountry.get(row.country) || geoByCountry.get("España") || geoRows[0];
  const website = safeWebsite(row.website) || libraryUrl(pageIds[0]);
  const sources = unique([...(row.sources || []), ...pageIds.map(libraryUrl), ...insight.ads.map((ad) => ad.sourceUrl)]);
  const media = mergeMedia(currentById.get(row.id)?.media || [], insight.ads);
  const direct = row.advertiserType === "directo";
  const highConfidence = row.confidence === "alta";
  const body = [
    "## Estado de la ficha",
    `Nueva empresa incorporada desde un estudio secundario de Meta Ads observado el ${OBSERVED_AT}. La Page ID identifica al anunciante con confianza ${row.confidence}; las promesas y cifras se presentan como afirmaciones del anunciante, no como resultados auditados.`,
    "## Modelo observado",
    row.model,
    "## Oferta observada",
    row.offer,
    ...(pricePresent(row.priceLocal) ? ["## Precio o condición económica", row.priceLocal] : []),
    ...(guaranteePresent(row.guarantee) ? ["## Garantía o reducción de riesgo", row.guarantee] : []),
    insight.body,
    "## Fuentes consultadas",
    sources.map((url) => `- ${url}`).join("\n"),
  ].join("\n\n");
  const company = {
    id: row.id,
    name: row.name,
    title: `${row.name} — ficha de mercado`,
    domain: row.domain || "Sin web propia confirmada",
    website,
    country: row.country,
    primaryCountry: row.country,
    countries: [row.country],
    market: row.market || row.country,
    markets: [row.market || row.country],
    scope: direct ? "Núcleo — agencia/leadgen" : "Adyacente — ecosistema de captación",
    agencyType: direct ? "Captación / automatización especializada" : "Formación / tecnología adyacente",
    offer: row.offer,
    priceLocal: row.priceLocal || "",
    priceStatus: pricePresent(row.priceLocal) ? "Observado con cautela" : "No observable",
    price: { currency: null, amount: null, eur: null, label: row.priceLocal || "Sin precio público observable" },
    ticket: "",
    contract: "",
    guarantee: row.guarantee || "",
    channels: unique(["Meta Ads", website && !/facebook\.com\/ads\/library/i.test(website) ? "Web / landing" : ""]),
    metaStatus: insight.observedCount ? `Activo en el corte secundario (${OBSERVED_AT})` : "No comprobado",
    metaAds: insight.observedCount,
    googleStatus: "No comprobado",
    googleAds: 0,
    creativeArchive: insight.ads.length,
    score: highConfidence ? (direct ? 52 : 38) : (direct ? 38 : 28),
    threat: direct ? "Media" : "Baja",
    relation: direct ? "Competidor directo" : "Competidor indirecto",
    decision: "Vigilar",
    evidence: highConfidence ? "Confirmado" : "Probable",
    proof: `${insight.ads.length} creatividades detalladas y ${insight.observedCount} anuncios activos contados en el corte; sin métricas de rendimiento.`,
    team: "",
    cta: "",
    funnel: website && !/facebook\.com\/ads\/library/i.test(website)
      ? `Anuncio Meta → ${website}`
      : "Anuncio Meta → destino no archivado o mensajería",
    niche: unique([...insight.verticals, ...insight.categories]).join(" · ") || row.model,
    legal: "",
    review: "Ficha estructurada; requiere revisión profunda de landing/entidad cuando no existe dominio confirmado",
    reviewedAt: "2026-08-27",
    addedAt: "2026-08-27",
    sources,
    body,
    media,
    mediaDeclared: media.length,
    location: {
      companyId: row.id,
      latitude: geo.latitude,
      longitude: geo.longitude,
      precision: geoByCountry.has(row.country) ? "centro_pais_mercado" : "centro_mercado_observado",
      locationLabel: geoByCountry.has(row.country)
        ? `${row.country}: centro de país; no es sede.`
        : "España: mercado publicitario observado; la sede no está determinada.",
      locality: null,
      canonicalMarket: row.market || row.country,
      commercialMarket: row.market || row.country,
      locationCountry: geoByCountry.has(row.country) ? row.country : "España",
      pointRepresents: "mercado o país canónico",
      headquartersVerified: false,
      sourceUrl: website,
      coordinateSourceUrl: null,
      limitation: "El punto representa el mercado o país observado, no una sede verificada.",
      zoom: 4.2,
      reviewedAt: "2026-08-27",
    },
    leadMarketManaged: true,
    leadMarketSnapshotId: adsSource.source?.snapshotId || "mercado-leads-es-2026-08-26",
  };
  managed.push(company);
  writeFileSync(
    detailPathFor(company.id),
    `${JSON.stringify({ id: company.id, body: company.body, sources: company.sources }, null, 1)}\n`,
    "utf8",
  );
}

// Enriquece fichas existentes resueltas por el mapa canónico. Nunca reemplaza
// su investigación previa: añade medios, eleva cobertura y agrega un bloque
// idempotente en el detalle.
const enrichedIds = [];
for (const [companyId, ads] of adsByCompany) {
  if (sourceIds.has(companyId)) continue;
  const company = currentById.get(companyId);
  if (!company) continue;
  const pageIds = unique(ads.map((ad) => String(ad.pageId)));
  const insight = insightBlock(companyId, pageIds);
  const mediaBefore = company.media?.length || 0;
  const media = mergeMedia(company.media || [], insight.ads);
  company.media = media;
  company.mediaDeclared = media.length;
  company.metaAds = Math.max(Number(company.metaAds || 0), insight.observedCount);
  company.creativeArchive = Math.max(Number(company.creativeArchive || 0), media.length);
  company.leadMarketSnapshotId = adsSource.source?.snapshotId || "mercado-leads-es-2026-08-26";
  company.leadMarketDetailedCreatives = insight.ads.length;
  company.leadMarketNewMedia = Math.max(0, media.length - mediaBefore);

  const path = detailPathFor(companyId);
  const detail = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : { id: companyId, body: "", sources: [] };
  const existingBody = String(detail.body || "");
  const markerIndex = existingBody.indexOf(DETAIL_MARKER);
  detail.body = markerIndex >= 0
    ? `${existingBody.slice(0, markerIndex).trim()}\n\n${insight.body}`.trim()
    : `${existingBody.trim()}\n\n${insight.body}`.trim();
  detail.sources = unique([...(detail.sources || []), ...insight.ads.map((ad) => ad.sourceUrl)]);
  writeFileSync(path, `${JSON.stringify(detail, null, 1)}\n`, "utf8");
  enrichedIds.push(companyId);
}

const managedById = new Map(managed.map((company) => [company.id, company]));
const final = current
  .filter((company) => !sourceIds.has(company.id))
  .map((company) => currentById.get(company.id) || company);
for (const company of managedById.values()) final.push({ ...company, body: "", sources: [] });
writeFileSync(indexPath, `${JSON.stringify(final, null, 1)}\n`, "utf8");

const takeaways = existsSync(takeawaysPath)
  ? JSON.parse(readFileSync(takeawaysPath, "utf8"))
  : { generatedAt: "2026-08-27", items: {} };
for (const company of managed) {
  takeaways.items[company.id] = {
    t: `Vigilar cómo ${company.name} articula ${company.offer.toLocaleLowerCase("es")}`,
    copiable: company.relation === "Competidor directo" ? "media" : "baja",
  };
}
takeaways.generatedAt = "2026-08-27";
writeFileSync(takeawaysPath, `${JSON.stringify(takeaways, null, 1)}\n`, "utf8");

console.log(
  `Leads market empresas: ${managed.length} fichas nuevas/regeneradas, ${enrichedIds.length} fichas existentes enriquecidas, ` +
    `${managed.reduce((sum, company) => sum + company.creativeArchive, 0)} creatividades nuevas vinculadas.`,
);
