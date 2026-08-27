#!/usr/bin/env node
/**
 * Convierte el informe HTML "El Mercado de los Leads" en datos trazables.
 *
 * El HTML se trata exclusivamente como entrada no confiable: solo se extrae
 * el objeto JSON asignado a `const D`. No se evalúa JavaScript ni se ejecuta
 * ningún contenido del documento.
 *
 * Uso:
 *   node scripts/import-leads-market-html.mjs C:/ruta/leads.html
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv[2] ? resolve(process.argv[2]) : "";
const outputPath = resolve(root, "db/leads-market-spain-2026-08-26.json");
const snapshotPath = resolve(root, "public/data/lead-market-snapshot.json");
const mediaDir = resolve(root, "public/media");
const legacyMediaDir = resolve(mediaDir, "lead-market");
const reviewPath = resolve(root, "scripts/data/leads-market-company-review.json");
const canonicalMapPath = resolve(root, "scripts/data/scrapecreators-company-map.json");
const SNAPSHOT_ID = "mercado-leads-es-2026-08-26";
const OBSERVED_AT = "2026-08-26";

if (!inputPath || !existsSync(inputPath)) {
  throw new Error(
    "Indica el HTML de entrada: node scripts/import-leads-market-html.mjs C:/ruta/leads.html",
  );
}

const html = readFileSync(inputPath, "utf8");
const payloadMatch = html.match(/const D = (\{.*\});\s*\r?\nconst K/s);
if (!payloadMatch) {
  throw new Error("No se encontró el objeto de datos `const D` esperado");
}

let raw;
try {
  raw = JSON.parse(payloadMatch[1]);
} catch (error) {
  throw new Error(`El objeto D no es JSON válido: ${error.message}`);
}

const requiredArrays = ["provs", "gal", "clones", "cat", "vert", "gar", "cta", "fmt", "dst", "bandas"];
for (const key of requiredArrays) {
  if (!Array.isArray(raw[key])) throw new Error(`Falta el array D.${key}`);
}
if (!raw.kpi || typeof raw.kpi !== "object") throw new Error("Falta D.kpi");
if (raw.gal.length !== 173) throw new Error(`Galería inesperada: ${raw.gal.length}; se esperaban 173 piezas`);
if (raw.provs.length !== 40) throw new Error(`Ranking inesperado: ${raw.provs.length}; se esperaban 40 filas`);
if (raw.clones.length !== 4) throw new Error(`Clústeres inesperados: ${raw.clones.length}; se esperaban 4`);

const externalIds = raw.gal.map((item) => String(item.id || "").trim());
if (externalIds.some((id) => !/^\d{6,}$/.test(id))) throw new Error("Hay IDs de anuncio inválidos");
if (new Set(externalIds).size !== externalIds.length) throw new Error("Hay IDs de anuncio duplicados");

const review = existsSync(reviewPath)
  ? JSON.parse(readFileSync(reviewPath, "utf8"))
  : { pageIds: {} };
const canonicalMap = existsSync(canonicalMapPath)
  ? JSON.parse(readFileSync(canonicalMapPath, "utf8"))
  : { pageIds: {} };

const cleanText = (value) => String(value ?? "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const normalizedCopy = (value) => cleanText(value)
  .toLocaleLowerCase("es")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/https?:\/\/\S+/g, " ")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();
const normalizeMetaUrl = (value, externalId) => {
  const text = cleanText(value);
  if (/facebook\.com\/ads\/library\?id=\d+/i.test(text)) return text;
  return `https://www.facebook.com/ads/library/?id=${externalId}`;
};
const firstHttpUrl = (value) => {
  const match = cleanText(value).match(/https?:\/\/[^\s<>)\]}]+/i);
  return match ? match[0].replace(/[.,;:!?]+$/, "") : null;
};
const formatCode = (value) => {
  const normalized = cleanText(value).toLocaleLowerCase("es");
  if (normalized.includes("vídeo") || normalized.includes("video")) return "VIDEO";
  if (normalized.includes("catálogo") || normalized.includes("catalogo")) return "DYNAMIC_PRODUCT";
  if (normalized.includes("carrusel")) return "CAROUSEL";
  if (normalized.includes("imagen")) return "IMAGE";
  return normalized ? normalized.toUpperCase() : "UNKNOWN";
};

mkdirSync(mediaDir, { recursive: true });
const mediaById = new Map();
for (const item of raw.gal) {
  const externalId = String(item.id);
  const bytes = Buffer.from(cleanText(item.img), "base64");
  if (!bytes.length) throw new Error(`La pieza ${externalId} no contiene imagen`);
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== "jpeg" || !metadata.width || !metadata.height) {
    throw new Error(`La pieza ${externalId} no es un JPEG válido`);
  }
  const fileName = `lead-market-meta-${externalId}.jpg`;
  writeFileSync(resolve(mediaDir, fileName), bytes);
  mediaById.set(externalId, {
    file: `/media/${fileName}`,
    type: "image/jpeg",
    bytes: bytes.length,
    width: metadata.width,
    height: metadata.height,
    sha256: sha256(bytes),
  });
}

// Migración segura desde la primera versión del importador, que guardaba los
// mismos archivos en una subcarpeta incompatible con el índice plano legado.
// Solo se elimina esa carpeta si contiene exactamente activos de este snapshot
// y cada uno ya existe en la ubicación nueva con idéntico contenido.
if (existsSync(legacyMediaDir)) {
  if (dirname(legacyMediaDir) !== mediaDir) {
    throw new Error(`Ruta legacy inesperada: ${legacyMediaDir}`);
  }
  const legacyEntries = readdirSync(legacyMediaDir, { withFileTypes: true });
  for (const entry of legacyEntries) {
    const match = entry.isFile() && entry.name.match(/^lead-market-meta-(\d+)\.jpg$/);
    if (!match || !externalIds.includes(match[1])) {
      throw new Error(`La carpeta legacy contiene un activo ajeno: ${entry.name}`);
    }
    const legacyBytes = readFileSync(resolve(legacyMediaDir, entry.name));
    const currentBytes = readFileSync(resolve(mediaDir, entry.name));
    if (sha256(legacyBytes) !== sha256(currentBytes)) {
      throw new Error(`La copia legacy no coincide con el activo migrado: ${entry.name}`);
    }
  }
  rmSync(legacyMediaDir, { recursive: true });
}

const items = raw.gal.map((item) => {
  const externalId = String(item.id);
  const pageId = String(item.pid || "");
  const media = mediaById.get(externalId);
  const copyText = cleanText(item.cuerpo);
  const copyBodySha256 = sha256(Buffer.from(normalizedCopy(copyText), "utf8"));
  return {
    externalId,
    platform: "meta",
    sourceUrl: normalizeMetaUrl(item.ficha, externalId),
    pageId,
    pageName: cleanText(item.page),
    isActive: true,
    activeStateSource: "Metodología del informe: anuncios activos en el corte",
    startedAt: item.inicio ? `${item.inicio}T00:00:00.000Z` : null,
    endedAt: null,
    firstFetchedAt: `${OBSERVED_AT}T00:00:00.000Z`,
    lastFetchedAt: `${OBSERVED_AT}T00:00:00.000Z`,
    publisherPlatforms: unique((item.plataformas || []).map(cleanText)),
    displayFormats: [formatCode(item.fmt_es)],
    categories: unique([cleanText(item.cat_es), cleanText(item.cat)]),
    copy: {
      text: copyText || null,
      title: cleanText(item.titulo) || null,
      description: cleanText(item.desc) || null,
      bodies: copyText ? [copyText] : [],
      titles: cleanText(item.titulo) ? [cleanText(item.titulo)] : [],
      descriptions: cleanText(item.desc) ? [cleanText(item.desc)] : [],
      extraTexts: [],
    },
    cta: {
      text: cleanText(item.cta_es) || null,
      type: null,
      texts: cleanText(item.cta_es) ? [cleanText(item.cta_es)] : [],
      types: [],
    },
    landing: {
      url: firstHttpUrl(`${copyText}\n${cleanText(item.desc)}`),
      urls: unique([firstHttpUrl(`${copyText}\n${cleanText(item.desc)}`)]),
      domains: [],
      destinationType: cleanText(item.destino) || null,
    },
    media: {
      localFile: media.file,
      type: media.type,
      bytes: media.bytes,
      width: media.width,
      height: media.height,
      sha256: media.sha256,
      role: cleanText(item.fmt_es).toLocaleLowerCase("es").includes("vídeo")
        ? "video_poster"
        : "creative_image",
    },
    copyBodySha256,
    creativeDedupeKey: `${pageId}:${copyBodySha256}:${media.sha256}`,
    transcription: { available: false, text: null, variants: [] },
    variantCount: Number(item.variantes || 1),
    pageLikesObserved: Number(item.likes || 0),
    marketIntelligence: {
      sourceSnapshotId: SNAPSHOT_ID,
      categoryCode: cleanText(item.cat),
      category: cleanText(item.cat_es),
      destination: cleanText(item.destino),
      verticals: unique((item.verts || []).map(cleanText)),
      guarantees: unique((item.garan || []).map(cleanText)),
      pricesEurMentioned: (item.precios || []).map(Number).filter(Number.isFinite),
      format: cleanText(item.fmt_es),
      classificationIsSourceClaim: true,
    },
    sourceKind: "informe_mercado_leads",
    observationCount: 1,
  };
});

const topProviders = raw.provs.map((provider, index) => {
  const pageId = String(provider.pid || "");
  const editorial = review.pageIds?.[pageId] || canonicalMap.pageIds?.[pageId] || null;
  const detailedCreatives = items.filter((item) => item.pageId === pageId).length;
  return {
    rank: index + 1,
    pageId,
    pageName: cleanText(provider.page),
    observedActiveAds: Number(provider.n || 0),
    detailedCreatives,
    pageLikesObserved: Number(provider.likes || 0),
    categoryCode: cleanText(provider.cat),
    category: cleanText(provider.cat_es),
    pricesEurMentioned: (provider.precios || []).map(Number).filter(Number.isFinite),
    guarantees: unique((provider.garan || []).map(cleanText)),
    verticals: unique((provider.verts || []).map(cleanText)),
    firstStartDateObserved: provider.desde || null,
    leadingFormat: cleanText(provider.fmt),
    review: editorial
      ? {
          status: editorial.status,
          companyId: editorial.companyId || null,
          confidence: editorial.confidence || null,
          note: editorial.note || null,
        }
      : { status: "pending", companyId: null, confidence: null, note: "Sin resolución editorial explícita." },
  };
});

const publicSnapshot = {
  schema: "redvitalia-lead-market-snapshot-v1",
  id: SNAPSHOT_ID,
  observedAt: OBSERVED_AT,
  importedAt: new Date().toISOString(),
  title: "El mercado de los leads · España",
  note: "Fuente secundaria importada como evidencia, no como verdad automática. Las categorías, garantías, precios y condición de proveedor proceden del informe y pueden contener falsos positivos. Solo las Page ID resueltas editorialmente alimentan fichas y patrones.",
  methodology: {
    source: "ScrapeCreators API / Meta Ads Library, según el propio informe",
    market: "España",
    searchTerms: 50,
    apiCallsOrCredits: Number(raw.kpi.creditos || 84),
    scope: "Anuncios activos; hasta dos páginas por término de búsqueda",
    rawAds: 1074,
    discardedAsNoise: 341,
    analyzedAds: Number(raw.kpi.ads || 733),
    limitation: "El HTML identifica 65 páginas y entrega 173 creatividades detalladas; no permite reconstruir individualmente las 733 piezas ni identificar las 319 páginas declaradas.",
    gallerySelection: "La regla con la que se eligieron las 173 piezas detalladas no está documentada; por tanto, la galería no es una muestra representativa garantizada.",
    performanceDataAvailable: false,
  },
  kpis: {
    analyzedAds: Number(raw.kpi.ads || 0),
    providerAds: Number(raw.kpi.prov_ads || 0),
    finalAdvertiserAds: Number(raw.kpi.final_ads || 0),
    pages: Number(raw.kpi.pages || 0),
    providerPages: Number(raw.kpi.prov_pages || 0),
    pagesWithPrice: Number(raw.kpi.con_precio || 0),
    pagesWithGuarantee: Number(raw.kpi.garan || 0),
    clonePages: Number(raw.kpi.clon_pages || 0),
    detailedCreatives: items.length,
    detailedPages: new Set(items.map((item) => item.pageId)).size,
    uniqueCopyBodies: new Set(items.map((item) => item.copyBodySha256)).size,
    uniqueImages: new Set(items.map((item) => item.media.sha256)).size,
    topProviders: topProviders.length,
    copyCloneClusters: raw.clones.length,
  },
  distributions: {
    categories: raw.cat,
    verticals: raw.vert,
    guarantees: raw.gar,
    ctas: raw.cta,
    formats: raw.fmt,
    destinations: raw.dst,
    activityBands: raw.bandas,
  },
  editorialReview: {
    matchedPageIds: Object.values(review.pageIds || {}).filter((item) => item.status === "matched").length,
    matchedCompanyIds: new Set(Object.values(review.pageIds || {})
      .filter((item) => item.status === "matched" && item.companyId)
      .map((item) => item.companyId)).size,
    quarantinedPageIds: Object.values(review.pageIds || {}).filter((item) => item.status === "quarantine").length,
    watchlistPageIds: Object.values(review.pageIds || {}).filter((item) => item.status === "watchlist").length,
    policy: "Solo matched alimenta fichas y patrones; quarantine y watchlist permanecen consultables en el snapshot sin atribución competitiva.",
  },
  topProviders,
  cloneClusters: raw.clones.map((cluster, index) => ({
    id: `clone-${index + 1}`,
    signature: cleanText(cluster.firma),
    pages: unique((cluster.paginas || []).map(cleanText)),
    pageCount: Number(cluster.n_pag || 0),
    adCount: Number(cluster.n_ads || 0),
    listedExternalIdCount: unique((cluster.ids || []).map(String)).length,
    countConsistent: Number(cluster.n_ads || 0) === unique((cluster.ids || []).map(String)).length,
    example: cleanText(cluster.ejemplo),
    title: cleanText(cluster.titulo),
    externalIds: unique((cluster.ids || []).map(String)),
  })),
  creativeIndex: items.map((item) => ({
    externalId: item.externalId,
    pageId: item.pageId,
    pageName: item.pageName,
    category: item.marketIntelligence.category,
    format: item.marketIntelligence.format,
    image: item.media.localFile,
    copyBodySha256: item.copyBodySha256,
    imageSha256: item.media.sha256,
    sourceUrl: item.sourceUrl,
  })),
  qualityWarnings: [
    "No hay gasto, impresiones, conversiones ni validación independiente de claims; frecuencia no equivale a rendimiento.",
    "España es la región de búsqueda, no una prueba del país, sede o targeting de cada anunciante.",
    "Las cifras con símbolo monetario mezclan precios pagables, criterios de cualificación, resultados, presupuestos, deudas y ahorros.",
    "Los vídeos solo incluyen un póster; el HTML no aporta vídeo, audio ni transcripción.",
    "Los cuatro clústeres cross-page indican copy compartido, pero no demuestran por sí solos una agencia o autor común.",
    "El clúster Real Estate Rocket/Pablo Valverde declara 14 anuncios, pero enumera 12 IDs; se preservan ambas cifras.",
  ],
};

const normalized = {
  schema: "redvitalia-lead-market-ads-v1",
  generatedAt: new Date().toISOString(),
  note: publicSnapshot.note,
  source: {
    snapshotId: SNAPSHOT_ID,
    observedAt: OBSERVED_AT,
    inputFileName: inputPath.split(/[\\/]/).at(-1),
    extraction: "JSON.parse del objeto literal D; no se ejecutó JavaScript del HTML",
  },
  summary: publicSnapshot.kpis,
  topProviders,
  cloneClusters: publicSnapshot.cloneClusters,
  items,
};

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(snapshotPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
writeFileSync(snapshotPath, `${JSON.stringify(publicSnapshot, null, 2)}\n`, "utf8");

console.log(
  `Leads market: ${items.length} creatividades, ${new Set(items.map((item) => item.pageId)).size} páginas detalladas, ` +
    `${topProviders.length} proveedores resumidos y ${raw.clones.length} clústeres.`,
);
