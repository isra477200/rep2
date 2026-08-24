#!/usr/bin/env node
/**
 * Construye una vista auditable de cobertura publicitaria por ficha.
 *
 * Separa deliberadamente tres unidades que no son equivalentes:
 *   1. resultados agregados declarados por las bibliotecas (metaAds/googleAds),
 *   2. creatividades individualizables mediante ID o archivo archivado,
 *   3. piezas cuyo copy ya está transcrito en anuncios-reales.json.
 *
 * La salida nunca convierte "No revisado", "No atribuible" o estados ambiguos
 * en ausencia de anuncios. Esos casos quedan como "pendiente/no atribuible".
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));

const companies = readJson("public/data/companies-index.json");
const anuncios = readJson("public/data/anuncios-reales.json").items || [];
const detailsDir = resolve(root, "public/data/company-details");

/**
 * Alias observados en anuncios-reales.json que apuntan inequívocamente a una
 * ficha canónica existente. Los alias dudosos se conservan como huérfanos.
 */
const aliasEntries = [
  ["compra-leads", "compra-leads-ou", "Mismo ID Meta 1567766664997071 ya documentado en la ficha canónica."],
  ["cronoshare-maxory", "cronoshare", "La observación identifica expresamente Cronoshare; Maxory se conserva como nota de rebranding."],
  ["docmedia-marketing-dental", "amp-docmedia-es", "Misma marca DOCMEDIA/Docmedia."],
  ["doctoralia", "doctoralia-grupo-docplanner", "Misma marca y dominio doctoralia.es."],
  ["idealleader-io", "idealleader", "Misma marca y dominio idealleader.io."],
  ["inmomax-es", "inmomax", "Misma marca y dominio inmomax.es."],
  ["ivandebenito", "ivan-de-benito", "Misma identidad; solo cambia la normalización del slug."],
  ["kaizex-especialistas-en-seo-local", "kaizex", "Misma marca KAIZEX."],
  ["level-up-agency-vera", "level-up-agency", "Misma marca LEVEL UP AGENCY (VERA)."],
  ["presupuestos-com", "amp-presupuestos-com", "Misma marca y dominio presupuestos.com."],
];
const aliases = new Map(aliasEntries.map(([alias, canonical]) => [alias, canonical]));

const companyIds = new Set(companies.map((company) => company.id));
const canonicalId = (id) => aliases.get(id) || id;
const unique = (values) => [...new Set(values.filter(Boolean))];

const cleanUrl = (value) =>
  String(value || "")
    .replace(/\\(\[|\])/g, "$1")
    .replace(/[.,;:]+$/, "");

const urlsFrom = (value) => {
  const matches = String(value || "").match(/https?:\/\/[^\s<>"')\]]+/g) || [];
  return matches.map(cleanUrl).filter((url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
};

const isLibraryUrl = (url) =>
  /facebook\.com\/ads\/library|adstransparency\.google\.com/i.test(url);

const metaIdFromUrl = (url) => {
  if (!/facebook\.com\/ads\/library/i.test(url)) return null;
  return url.match(/[?&]id=(\d{10,})/i)?.[1] || null;
};

const googleIdFromUrl = (url) =>
  url.match(/adstransparency\.google\.com\/advertiser\/[^/\s]+\/creative\/(CR\d+)/i)?.[1]?.toUpperCase() || null;

const exactMetaUrl = (id) => `https://www.facebook.com/ads/library/?id=${id}`;

/**
 * El nombre original del archivo es la única unión determinista entre el ID
 * externo y el media archivado. Después se traduce companyId interno -> slug
 * público y `order` -> companies-index[].media[].file. Nunca se usa la URL S3
 * firmada como fuente: caduca y no es evidencia pública trazable.
 */
const externalIdFromMediaUrl = (value) => {
  let filename = "";
  try {
    filename = decodeURIComponent(new URL(String(value || "")).pathname.split("/").pop() || "");
  } catch {
    return null;
  }
  const googleId = filename.match(/(?:^|[-_])(CR\d{10,})(?=[-_.]|$)/i)?.[1];
  if (googleId) return { platform: "google", externalId: googleId.toUpperCase() };
  const metaId = filename.match(/(?:^|[-_])meta[-_](\d{10,})(?=[-_.]|$)/i)?.[1];
  if (metaId) return { platform: "meta", externalId: metaId };
  return null;
};

const publicMediaByCompanyAndOrder = new Map(
  companies.map((company) => [
    company.id,
    new Map((company.media || []).map((media) => [Number(media.order), media])),
  ]),
);
const mediaEvidenceByCompany = new Map();
const mediaJoin = {
  sourceMediaAvailable: false,
  sourceRows: 0,
  idBearingRows: 0,
  uniqueExternalIdsIdentified: 0,
  mappedToCompanyAndOrder: 0,
  validPublicFiles: 0,
  uniqueExternalIdsWithPublicFile: 0,
  variantFilesCollapsed: 0,
};
const sourceExternalEvidenceKeys = new Set();

const identityMapPath = resolve(root, "research/deep/public-id-map.json");
const sourceSnapshotDir = resolve(root, "../portal-source-snapshot");
if (existsSync(identityMapPath) && existsSync(sourceSnapshotDir)) {
  const identityMap = JSON.parse(readFileSync(identityMapPath, "utf8")).ids || {};
  const mediaMapFiles = readdirSync(sourceSnapshotDir)
    .filter((name) => /^media-map-.*\.json$/i.test(name))
    .sort();
  mediaJoin.sourceMediaAvailable = mediaMapFiles.length > 0;

  for (const mediaMapFile of mediaMapFiles) {
    const sourceRows = JSON.parse(readFileSync(resolve(sourceSnapshotDir, mediaMapFile), "utf8"));
    for (const sourceMedia of sourceRows) {
      mediaJoin.sourceRows += 1;
      if (!sourceMedia.ok) continue;
      const external = externalIdFromMediaUrl(sourceMedia.url);
      if (!external) continue;
      mediaJoin.idBearingRows += 1;

      const internalId = String(sourceMedia.companyId || "").replaceAll("-", "").toLowerCase();
      const publicId = identityMap[internalId];
      if (!publicId || !companyIds.has(publicId)) continue;
      sourceExternalEvidenceKeys.add(`${publicId}:${external.platform}:${external.externalId}`);
      const publicMedia = publicMediaByCompanyAndOrder.get(publicId)?.get(Number(sourceMedia.order));
      if (!publicMedia) continue;
      mediaJoin.mappedToCompanyAndOrder += 1;

      const publicFile = String(publicMedia.file || "");
      const absolutePublicFile = resolve(root, "public", publicFile.replace(/^\/+/, ""));
      const indexBytes = Number(publicMedia.bytes || 0);
      const sourceBytes = Number(sourceMedia.bytes || 0);
      if (
        !publicFile.startsWith("/media/") ||
        !existsSync(absolutePublicFile) ||
        statSync(absolutePublicFile).size !== indexBytes ||
        (sourceBytes > 0 && sourceBytes !== indexBytes)
      ) {
        continue;
      }
      mediaJoin.validPublicFiles += 1;

      const companyBucket = mediaEvidenceByCompany.get(publicId) || new Map();
      const key = `${external.platform}:${external.externalId}`;
      const previous = companyBucket.get(key);
      const candidate = {
        ...external,
        file: publicFile,
        bytes: indexBytes,
        order: Number(sourceMedia.order),
        variantCount: (previous?.variantCount || 0) + 1,
      };

      // Una creatividad puede tener imagen, vídeo, miniatura o varias variantes.
      // Se conserva un único archivo representativo: el mayor y, en empate, el
      // de menor orden. variantCount documenta lo que se colapsó.
      if (
        !previous ||
        candidate.bytes > previous.bytes ||
        (candidate.bytes === previous.bytes && candidate.order < previous.order)
      ) {
        companyBucket.set(key, candidate);
      } else {
        previous.variantCount += 1;
      }
      mediaEvidenceByCompany.set(publicId, companyBucket);
    }
  }

  const selectedMedia = [...mediaEvidenceByCompany.values()].flatMap((bucket) => [...bucket.values()]);
  mediaJoin.uniqueExternalIdsIdentified = sourceExternalEvidenceKeys.size;
  mediaJoin.uniqueExternalIdsWithPublicFile = selectedMedia.length;
  mediaJoin.variantFilesCollapsed = selectedMedia.reduce(
    (sum, evidence) => sum + Math.max(0, evidence.variantCount - 1),
    0,
  );
}

const detailsById = new Map();
for (const file of readdirSync(detailsDir).filter((name) => name.endsWith(".json"))) {
  const detail = readJson(`public/data/company-details/${file}`);
  const body = String(detail.body || "");
  const declaredSources = Array.isArray(detail.sources) ? detail.sources : [];
  const sourceUrls = unique([...declaredSources.flatMap(urlsFrom), ...urlsFrom(body)]);

  const metaIds = new Set();
  const googleIds = new Set();
  const googleUrlsById = new Map();
  const sourceUrlByExternalId = new Map();

  for (const url of sourceUrls) {
    const metaId = metaIdFromUrl(url);
    if (metaId) {
      metaIds.add(metaId);
      sourceUrlByExternalId.set(`meta:${metaId}`, exactMetaUrl(metaId));
    }
    const googleId = googleIdFromUrl(url);
    if (googleId) {
      googleIds.add(googleId);
      if (!googleUrlsById.has(googleId)) {
        const sourceUrl = cleanUrl(url);
        googleUrlsById.set(googleId, sourceUrl);
        sourceUrlByExternalId.set(`google:${googleId}`, sourceUrl);
      }
    }
  }

  // Algunos bloques conservan el ID aunque la URL oficial dejara de exponerse.
  for (const match of body.matchAll(/^## Anuncio consolidado · (\d{10,}|CR\d+)\s*$/gim)) {
    const externalId = match[1];
    if (/^CR/i.test(externalId)) googleIds.add(externalId.toUpperCase());
    else {
      metaIds.add(externalId);
      sourceUrlByExternalId.set(`meta:${externalId}`, exactMetaUrl(externalId));
    }
  }

  const libraryLinks = unique(sourceUrls.filter(isLibraryUrl));
  const exactLinks = unique([
    ...[...metaIds].map(exactMetaUrl),
    ...[...googleIds].map((id) => googleUrlsById.get(id)).filter(Boolean),
  ]);

  detailsById.set(detail.id, {
    metaIds,
    googleIds,
    libraryLinks,
    exactLinks,
    sourceUrlByExternalId,
    hasDetail: true,
  });
}

const platformOf = (value) => {
  const platform = String(value || "").toLowerCase();
  if (platform.includes("instagram")) return "instagram";
  if (platform.includes("meta")) return "meta";
  if (platform.includes("google") || platform.includes("transparencia")) return "google";
  if (platform.includes("display")) return "display";
  return "other";
};

const embeddedIds = (anuncio) => {
  const platform = platformOf(anuncio.plataforma);
  if (platform !== "meta") return [];
  return unique(String(anuncio.plataforma || "").match(/\d{10,}/g) || []);
};

const isActualAdObservation = (anuncio) => {
  const title = String(anuncio.titular || "").trim();
  const text = String(anuncio.texto || "").trim();
  if (/^[-—–]+$/.test(title) && /sin anuncios|0 anuncios/i.test(text)) return false;
  if (/^sin anuncios activos|^0 anuncios/i.test(text)) return false;
  return Boolean(anuncio.file || embeddedIds(anuncio).length || title || text);
};

const transcriptByCompany = new Map();
const orphanTranscripts = new Map();
for (const anuncio of anuncios) {
  if (!isActualAdObservation(anuncio)) continue;
  const resolvedId = canonicalId(anuncio.id);
  const ids = embeddedIds(anuncio);
  const signature = anuncio.file
    ? `file:${anuncio.file}`
    : ids.length === 1
      ? `${platformOf(anuncio.plataforma)}:${ids[0]}`
      : `text:${createHash("sha256")
          .update(`${resolvedId}\n${anuncio.plataforma}\n${anuncio.titular}\n${anuncio.texto}`)
          .digest("hex")}`;
  const record = {
    signature,
    platform: platformOf(anuncio.plataforma),
    ids,
    file: anuncio.file || null,
  };

  if (!companyIds.has(resolvedId)) {
    const orphan = orphanTranscripts.get(anuncio.id) || {
      observedId: anuncio.id,
      name: anuncio.name,
      records: [],
    };
    orphan.records.push(record);
    orphanTranscripts.set(anuncio.id, orphan);
    continue;
  }

  const bucket = transcriptByCompany.get(resolvedId) || {
    records: new Map(),
    aliases: new Set(),
    metaIds: new Set(),
  };
  bucket.records.set(signature, record);
  if (resolvedId !== anuncio.id) bucket.aliases.add(anuncio.id);
  for (const id of ids) bucket.metaIds.add(id);
  transcriptByCompany.set(resolvedId, bucket);
}

const uncertainPattern = /no revisad|no comprob|no atribu|pendient|no concluyente|bloquead|sin verificar|no disponible|no localizado/i;
const checkedZeroPattern = /sin anuncios activos|sin anuncios por nombre|0 anuncios|no mostr[oó] anuncios|sin resultados atribuibles/i;
const noisyPattern = /posible ruido|coincidencias por marca/i;

const reviewClass = ({ status, reportedCount, exactIds, transcriptCount }) => {
  const value = String(status || "").trim();
  if (exactIds > 0 || transcriptCount > 0) return "evidencia atribuible";
  if (uncertainPattern.test(value)) return "pendiente/no atribuible";
  if (checkedZeroPattern.test(value) && Number(reportedCount || 0) <= 0) return "sin evidencia comprobada";
  if (Number(reportedCount || 0) > 0) {
    return noisyPattern.test(value) ? "recuento ruidoso/no atribuible" : "recuento agregado pendiente de muestra";
  }
  return "pendiente/no atribuible";
};

const coverageStatus = (available, noEvidenceConfirmed) => {
  if (available >= 10) return ">=10";
  if (available >= 5) return "5-9";
  if (available >= 1) return "1-4";
  return noEvidenceConfirmed ? "sin evidencia" : "pendiente/no atribuible";
};

const publicFileIfPresent = (value) => {
  const file = String(value || "");
  if (!file.startsWith("/")) return null;
  const absoluteFile = resolve(root, "public", file.replace(/^\/+/, ""));
  return existsSync(absoluteFile) ? file : null;
};

const evidenceRank = (evidence) => {
  if (evidence.externalId && evidence.file) return 0;
  if (evidence.externalId && evidence.sourceUrl) return 1;
  if (evidence.file) return 2;
  if (evidence.externalId) return 3;
  return 4;
};

const items = companies.map((company) => {
  const detail = detailsById.get(company.id) || {
    metaIds: new Set(),
    googleIds: new Set(),
    libraryLinks: [],
    exactLinks: [],
    sourceUrlByExternalId: new Map(),
    hasDetail: false,
  };
  const transcript = transcriptByCompany.get(company.id) || {
    records: new Map(),
    aliases: new Set(),
    metaIds: new Set(),
  };

  for (const id of transcript.metaIds) {
    detail.metaIds.add(id);
    detail.sourceUrlByExternalId.set(`meta:${id}`, exactMetaUrl(id));
  }
  const records = [...transcript.records.values()];
  const transcribedByPlatform = {
    meta: records.filter((record) => record.platform === "meta").length,
    google: records.filter((record) => record.platform === "google").length,
    instagram: records.filter((record) => record.platform === "instagram").length,
    display: records.filter((record) => record.platform === "display").length,
    other: records.filter((record) => record.platform === "other").length,
  };
  const transcribedCanonicalCount = records.length;

  const metaIds = [...detail.metaIds].sort();
  const googleIds = [...detail.googleIds].sort();
  const exactCreativeCount = metaIds.length + googleIds.length;
  const archivedFileCount = Math.max(0, Number(company.creativeArchive || 0));

  const sourceLinks = unique([
    ...detail.exactLinks,
    ...metaIds.map(exactMetaUrl),
    ...detail.libraryLinks,
  ]).sort();

  const mediaBucket = mediaEvidenceByCompany.get(company.id) || new Map();
  const evidenceByKey = new Map();
  for (const [platform, externalIds] of [
    ["meta", metaIds],
    ["google", googleIds],
  ]) {
    for (const externalId of externalIds) {
      const key = `${platform}:${externalId}`;
      const media = mediaBucket.get(key);
      const transcriptRecord = records.find((record) => record.ids.includes(externalId));
      evidenceByKey.set(key, {
        externalId,
        platform,
        file: publicFileIfPresent(media?.file || transcriptRecord?.file),
        sourceUrl:
          detail.sourceUrlByExternalId.get(key) ||
          (platform === "meta" ? exactMetaUrl(externalId) : null),
      });
    }
  }

  // Las transcripciones antiguas no siempre conservaban el ID externo. Siguen
  // siendo observaciones auditables por archivo o firma, pero no se les inventa
  // un ID ni una URL de biblioteca.
  const exactFiles = new Set(
    [...evidenceByKey.values()].map((evidence) => evidence.file).filter(Boolean),
  );
  for (const record of records.filter((candidate) => candidate.ids.length === 0)) {
    const file = publicFileIfPresent(record.file);
    if (file && exactFiles.has(file)) continue;
    evidenceByKey.set(`transcript:${record.signature}`, {
      externalId: null,
      platform: record.platform,
      file,
      sourceUrl: null,
      transcriptSignature: record.signature,
    });
  }

  const evidence = [...evidenceByKey.values()]
    .sort(
      (a, b) =>
        evidenceRank(a) - evidenceRank(b) ||
        a.platform.localeCompare(b.platform, "es") ||
        String(a.externalId || a.transcriptSignature).localeCompare(
          String(b.externalId || b.transcriptSignature),
          "es",
        ),
    )
    .slice(0, 10);

  // `creativeArchive` es un recuento bruto de archivos y puede contener
  // miniaturas, recursos auxiliares o varias variantes del mismo anuncio. Se
  // informa, pero nunca determina el objetivo ni el estado de cobertura.
  const availableEvidenceCount = evidenceByKey.size;
  const targetCount = Math.min(10, availableEvidenceCount);
  const metaReview = reviewClass({
    status: company.metaStatus,
    reportedCount: company.metaAds,
    exactIds: metaIds.length,
    transcriptCount: transcribedByPlatform.meta + transcribedByPlatform.instagram,
  });
  const googleReview = reviewClass({
    status: company.googleStatus,
    reportedCount: company.googleAds,
    exactIds: googleIds.length,
    transcriptCount: transcribedByPlatform.google + transcribedByPlatform.display,
  });
  const noEvidenceConfirmed =
    availableEvidenceCount === 0 &&
    metaReview === "sin evidencia comprobada" &&
    googleReview === "sin evidencia comprobada";

  const observedAliases = [...transcript.aliases].sort();
  return {
    companyId: company.id,
    name: company.name,
    country: company.primaryCountry || company.country || "Sin país",
    domain: company.domain || "",
    status: coverageStatus(availableEvidenceCount, noEvidenceConfirmed),
    availableEvidenceCount,
    targetCount,
    transcribedCanonicalCount,
    transcriptionGap: Math.max(0, targetCount - transcribedCanonicalCount),
    transcriptionComplete: transcribedCanonicalCount >= targetCount,
    transcribedByPlatform,
    exactCreativeIds: {
      meta: metaIds,
      google: googleIds,
      total: exactCreativeCount,
    },
    archivedFileCount,
    reportedLibraryCounts: {
      meta: Math.max(0, Number(company.metaAds || 0)),
      google: Math.max(0, Number(company.googleAds || 0)),
    },
    review: {
      meta: { status: company.metaStatus || "No revisado", classification: metaReview },
      google: { status: company.googleStatus || "No revisado", classification: googleReview },
    },
    evidence,
    sourceLinks,
    observedAliases,
    detailAvailable: detail.hasDetail,
  };
});

const allowedStatuses = new Set([">=10", "5-9", "1-4", "sin evidencia", "pendiente/no atribuible"]);
const assert = (condition, message) => {
  if (!condition) throw new Error(`build-ad-coverage: ${message}`);
};

assert(items.length === companies.length, `esperadas ${companies.length} fichas, generadas ${items.length}`);
assert(new Set(items.map((item) => item.companyId)).size === companies.length, "hay companyId duplicados");
for (const [alias, canonical] of aliases) {
  assert(companyIds.has(canonical), `el alias ${alias} apunta a una ficha inexistente: ${canonical}`);
}
for (const item of items) {
  assert(allowedStatuses.has(item.status), `estado inválido en ${item.companyId}: ${item.status}`);
  assert(item.targetCount === Math.min(10, item.availableEvidenceCount), `objetivo incoherente en ${item.companyId}`);
  assert(item.evidence.length === item.targetCount, `muestra y objetivo no coinciden en ${item.companyId}`);
  assert(item.exactCreativeIds.total === item.exactCreativeIds.meta.length + item.exactCreativeIds.google.length, `total de IDs incoherente en ${item.companyId}`);
  assert(new Set(item.exactCreativeIds.meta).size === item.exactCreativeIds.meta.length, `IDs Meta duplicados en ${item.companyId}`);
  assert(new Set(item.exactCreativeIds.google).size === item.exactCreativeIds.google.length, `IDs Google duplicados en ${item.companyId}`);
  assert(item.sourceLinks.every(isLibraryUrl), `fuente no publicitaria en ${item.companyId}`);
  assert(item.evidence.length <= 10, `muestra de evidencia mayor que 10 en ${item.companyId}`);
  const evidenceKeys = item.evidence.map((evidence) =>
    evidence.externalId
      ? `${evidence.platform}:${evidence.externalId}`
      : `transcript:${evidence.transcriptSignature}`,
  );
  assert(new Set(evidenceKeys).size === evidenceKeys.length, `evidencia duplicada en ${item.companyId}`);
  for (const evidence of item.evidence) {
    assert(
      evidence.sourceUrl === null || isLibraryUrl(evidence.sourceUrl),
      `sourceUrl no oficial en ${item.companyId}`,
    );
    assert(
      evidence.file === null || publicFileIfPresent(evidence.file) === evidence.file,
      `archivo público inexistente en ${item.companyId}: ${evidence.file}`,
    );
    if (evidence.externalId && evidence.platform === "meta") {
      assert(item.exactCreativeIds.meta.includes(evidence.externalId), `ID Meta de muestra no catalogado en ${item.companyId}`);
    }
    if (evidence.externalId && evidence.platform === "google") {
      assert(item.exactCreativeIds.google.includes(evidence.externalId), `ID Google de muestra no catalogado en ${item.companyId}`);
    }
    if (!evidence.externalId) {
      assert(Boolean(evidence.transcriptSignature), `transcripción sin referencia en ${item.companyId}`);
    }
  }
  if (item.status === "sin evidencia") {
    assert(item.availableEvidenceCount === 0, `sin evidencia con activos en ${item.companyId}`);
    assert(item.review.meta.classification === "sin evidencia comprobada", `Meta no confirma ausencia en ${item.companyId}`);
    assert(item.review.google.classification === "sin evidencia comprobada", `Google no confirma ausencia en ${item.companyId}`);
  }
  if (/no revisad|no atribu|pendient/i.test(`${item.review.meta.status} ${item.review.google.status}`) && item.availableEvidenceCount === 0) {
    assert(item.status !== "sin evidencia", `estado incierto convertido en ausencia en ${item.companyId}`);
  }
}

const statusCounts = Object.fromEntries([...allowedStatuses].map((status) => [status, items.filter((item) => item.status === status).length]));
assert(Object.values(statusCounts).reduce((sum, count) => sum + count, 0) === companies.length, "los estados no cubren todo el catálogo");

const countries = [...new Set(items.map((item) => item.country))]
  .map((country) => {
    const rows = items.filter((item) => item.country === country);
    return {
      country,
      companies: rows.length,
      withEvidence: rows.filter((item) => item.availableEvidenceCount > 0).length,
      exactCreativeIds: rows.reduce((sum, item) => sum + item.exactCreativeIds.total, 0),
      transcribedCanonical: rows.reduce((sum, item) => sum + item.transcribedCanonicalCount, 0),
      statusCounts: Object.fromEntries([...allowedStatuses].map((status) => [status, rows.filter((item) => item.status === status).length])),
    };
  })
  .sort((a, b) => b.companies - a.companies || a.country.localeCompare(b.country, "es"));

const aliasMap = aliasEntries.map(([alias, canonical, reason]) => ({
  alias,
  canonical,
  reason,
  transcribedRecords: anuncios.filter((anuncio) => anuncio.id === alias && isActualAdObservation(anuncio)).length,
}));

const creativeFiles = [...mediaEvidenceByCompany.entries()]
  .flatMap(([companyId, bucket]) =>
    [...bucket.values()].map((media) => ({
      companyId,
      externalId: media.externalId,
      platform: media.platform,
      file: media.file,
      sourceUrl:
        detailsById.get(companyId)?.sourceUrlByExternalId.get(
          `${media.platform}:${media.externalId}`,
        ) || (media.platform === "meta" ? exactMetaUrl(media.externalId) : null),
      variantCount: media.variantCount,
    })),
  )
  .sort(
    (a, b) =>
      a.companyId.localeCompare(b.companyId, "es") ||
      a.platform.localeCompare(b.platform, "es") ||
      a.externalId.localeCompare(b.externalId, "es"),
  );

assert(
  creativeFiles.length === mediaJoin.uniqueExternalIdsWithPublicFile,
  "el índice completo ID→archivo no coincide con el diagnóstico de media",
);
assert(
  new Set(
    creativeFiles.map(
      (evidence) => `${evidence.companyId}:${evidence.platform}:${evidence.externalId}`,
    ),
  ).size === creativeFiles.length,
  "el índice completo ID→archivo contiene anuncios duplicados",
);
for (const evidence of creativeFiles) {
  assert(companyIds.has(evidence.companyId), `archivo asociado a ficha inexistente: ${evidence.companyId}`);
  assert(publicFileIfPresent(evidence.file) === evidence.file, `archivo asociado inexistente: ${evidence.file}`);
  assert(
    evidence.sourceUrl === null || isLibraryUrl(evidence.sourceUrl),
    `fuente no oficial en archivo asociado: ${evidence.companyId}/${evidence.externalId}`,
  );
}

const orphanItems = [...orphanTranscripts.values()]
  .map((orphan) => ({
    observedId: orphan.observedId,
    name: orphan.name,
    transcribedRecords: new Set(orphan.records.map((record) => record.signature)).size,
    platforms: unique(orphan.records.map((record) => record.platform)).sort(),
  }))
  .sort((a, b) => a.observedId.localeCompare(b.observedId, "es"));

const output = {
  generatedAt: new Date().toISOString().slice(0, 10),
  note: "Cobertura de evidencia individualizable, no rendimiento publicitario. Los recuentos agregados de Meta/Google y creativeArchive se conservan aparte: no crean anuncios ni inflan el objetivo con variantes. El objetivo es min(10, evidencia canónica disponible).",
  totalCompanies: companies.length,
  summary: {
    statusCounts,
    companiesWithEvidence: items.filter((item) => item.availableEvidenceCount > 0).length,
    companiesWithExactIds: items.filter((item) => item.exactCreativeIds.total > 0).length,
    exactMetaIds: items.reduce((sum, item) => sum + item.exactCreativeIds.meta.length, 0),
    exactGoogleIds: items.reduce((sum, item) => sum + item.exactCreativeIds.google.length, 0),
    transcribedCanonical: items.reduce((sum, item) => sum + item.transcribedCanonicalCount, 0),
    sampledEvidence: items.reduce((sum, item) => sum + item.evidence.length, 0),
    sampledEvidenceWithPublicFile: items.reduce(
      (sum, item) => sum + item.evidence.filter((evidence) => evidence.file).length,
      0,
    ),
    targetTotal: items.reduce((sum, item) => sum + item.targetCount, 0),
    transcriptionGap: items.reduce((sum, item) => sum + item.transcriptionGap, 0),
    orphanAdvertisers: orphanItems.length,
    orphanTranscribedRecords: orphanItems.reduce((sum, item) => sum + item.transcribedRecords, 0),
  },
  aliasMap,
  mediaJoin,
  creativeFiles,
  orphanItems,
  countries,
  items,
};

writeFileSync(resolve(root, "public/data/ad-coverage.json"), `${JSON.stringify(output, null, 1)}\n`, "utf8");
console.log(
  `ad-coverage.json: ${output.totalCompanies} fichas · ${output.summary.exactMetaIds + output.summary.exactGoogleIds} IDs exactos · ${output.summary.transcribedCanonical} transcripciones canónicas · gap ${output.summary.transcriptionGap}`,
);
