#!/usr/bin/env node
/**
 * Archiva una muestra visual reproducible de la importación ScrapeCreators.
 *
 * Las URLs de Meta son temporales. Este paso descarga, antes de que caduquen:
 * - hasta 10 anuncios por página consultada expresamente;
 * - una imagen o póster representativo por anuncio;
 * - el vídeo y el póster de todos los anuncios cuya transcripción se obtuvo.
 *
 * La descarga queda primero en work/. La publicación y el enlace a una ficha
 * canónica se hacen después de revisar el mapa pageId -> companyId.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueAfter = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const valuesAfter = (name) => args.flatMap((argument, index) =>
  argument === name && args[index + 1] ? [args[index + 1]] : []
);
const knownArguments = new Set([
  "--data",
  "--manifest",
  "--staging-dir",
  "--reuse-staging-dir",
  "--report",
  "--company-map",
  "--published-index",
  "--max-ads-per-page",
  "--concurrency",
]);
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (!knownArguments.has(argument)) {
    throw new Error(`Argumento no reconocido: ${argument}`);
  }
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`Falta el valor de ${argument}`);
  }
  index += 1;
}

const dataPath = resolve(
  root,
  valueAfter("--data", "db/scrapecreators-spain-leadgen.json"),
);
const manifestPath = resolve(
  root,
  valueAfter(
    "--manifest",
    "work/scrapecreators-spain-leadgen/media-manifest.json",
  ),
);
const stagingDir = resolve(
  root,
  valueAfter(
    "--staging-dir",
    "work/scrapecreators-spain-leadgen/media-staging",
  ),
);
const reportPath = resolve(
  root,
  valueAfter(
    "--report",
    "work/scrapecreators-spain-leadgen/media-download-report.json",
  ),
);
const companyMapPath = resolve(
  root,
  valueAfter(
    "--company-map",
    "scripts/data/scrapecreators-company-map.json",
  ),
);
const publishedIndexPath = resolve(
  root,
  valueAfter(
    "--published-index",
    "public/data/scrapecreators-media-index.json",
  ),
);
const reuseStagingDirs = [
  stagingDir,
  ...valuesAfter("--reuse-staging-dir").map((value) => resolve(root, value)),
].filter((value, index, values) => values.indexOf(value) === index);
const MAX_ADS_PER_PAGE = Math.max(
  1,
  Number(valueAfter("--max-ads-per-page", "10")) || 10,
);
const CONCURRENCY = Math.max(
  1,
  Number(valueAfter("--concurrency", "8")) || 8,
);
const MAX_BYTES_PER_ASSET = 90 * 1024 * 1024;

if (!existsSync(dataPath) || !existsSync(manifestPath)) {
  throw new Error("Faltan el dataset normalizado o su manifiesto privado de medios");
}

mkdirSync(stagingDir, { recursive: true });
for (const directory of reuseStagingDirs.slice(1)) {
  if (!existsSync(directory)) {
    throw new Error(`No existe el staging reutilizable solicitado: ${directory}`);
  }
}
const data = JSON.parse(readFileSync(dataPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (data.schema !== "redvitalia-scrapecreators-ads-v1") {
  throw new Error("El dataset normalizado tiene un esquema no reconocido");
}
if (manifest.schema !== "redvitalia-scrapecreators-private-media-v1") {
  throw new Error("El manifiesto privado tiene un esquema no reconocido");
}
if (
  !data.source?.rawSha256 ||
  !manifest.sourceRawSha256 ||
  data.source.rawSha256 !== manifest.sourceRawSha256
) {
  throw new Error(
    "El manifiesto privado no pertenece al mismo raw canónico que el dataset normalizado",
  );
}
const assetByKey = new Map((manifest.assets || []).map((asset) => [asset.assetKey, asset]));
if (assetByKey.size !== (manifest.assets || []).length) {
  throw new Error("El manifiesto privado combinado contiene assetKey duplicadas");
}
if (
  new Set((data.items || []).map((item) => String(item.externalId || ""))).size !==
  (data.items || []).length
) {
  throw new Error("El dataset normalizado combinado contiene externalId duplicados");
}
const adById = new Map(
  (data.items || []).map((item) => [String(item.externalId || ""), item]),
);
const companyMap = existsSync(companyMapPath)
  ? JSON.parse(readFileSync(companyMapPath, "utf8"))
  : { pageIds: {} };
const publishedIndex = existsSync(publishedIndexPath)
  ? JSON.parse(readFileSync(publishedIndexPath, "utf8"))
  : null;
if (
  publishedIndex &&
  publishedIndex.schema !== "redvitalia-scrapecreators-media-index-v1"
) {
  throw new Error("El índice ScrapeCreators publicado tiene un esquema no reconocido");
}
const reviewedPageIds = new Set(
  Object.entries(companyMap.pageIds || {})
    .filter(([, match]) => match?.status === "matched")
    .map(([pageId]) => pageId),
);

const score = (ad) =>
  (ad.transcription?.available ? 1_000_000 : 0) +
  (ad.isActive ? 100_000 : 0) +
  (ad.media?.images?.length ? 20_000 : 0) +
  (ad.media?.posters?.length ? 15_000 : 0) +
  (ad.media?.videos?.length ? 10_000 : 0) +
  Math.min(8_000, String(ad.copy?.text || "").length * 10) +
  (Date.parse(ad.startedAt || "") || 0) / 1e10;

const explicitlyRequested = (ad) =>
  (ad.requestedPageIds || []).length > 0 ||
  (ad.requestedCompanyNames || []).length > 0 ||
  reviewedPageIds.has(String(ad.pageId || ""));

const groups = new Map();
for (const ad of (data.items || []).filter(explicitlyRequested)) {
  const pageId = String(ad.pageId || "");
  if (!pageId) continue;
  const bucket = groups.get(pageId) || [];
  bucket.push(ad);
  groups.set(pageId, bucket);
}

const pickAds = (ads) => {
  const sorted = [...ads].sort((a, b) => score(b) - score(a));
  const chosen = [];
  const chosenIds = new Set();
  const take = (ad) => {
    if (!ad || chosenIds.has(ad.externalId) || chosen.length >= MAX_ADS_PER_PAGE) return;
    chosen.push(ad);
    chosenIds.add(ad.externalId);
  };
  // Fuerza variedad visual antes de completar por calidad/actualidad.
  take(sorted.find((ad) => ad.transcription?.available));
  take(sorted.find((ad) => ad.media?.images?.length));
  take(sorted.find((ad) => ad.media?.videos?.length));
  take(sorted.find((ad) => (ad.displayFormats || []).some((value) => /carousel/i.test(value))));
  for (const ad of sorted) take(ad);
  return chosen;
};

const selectedAds = [...groups.values()].flatMap(pickAds);
const selectedAdIds = new Set(selectedAds.map((ad) => ad.externalId));
// Una transcripción pagada nunca queda fuera de la evidencia visual.
for (const ad of (data.items || []).filter((item) => item.transcription?.available)) {
  if (!selectedAdIds.has(ad.externalId)) {
    selectedAds.push(ad);
    selectedAdIds.add(ad.externalId);
  }
}

const selectedAssets = new Map();
const linkAsset = (ad, reference, reason, selection = {}) => {
  const key = reference?.assetKey;
  const asset = key ? assetByKey.get(key) : null;
  if (!asset) return;
  const previous = selectedAssets.get(key) || {
    ...asset,
    selectedFor: [],
  };
  if (!previous.selectedFor.some((item) => item.adId === ad.externalId && item.reason === reason)) {
    previous.selectedFor.push({
      adId: ad.externalId,
      pageId: selection.pageId || ad.pageId,
      pageName: selection.pageName || ad.pageName,
      reason,
    });
  }
  selectedAssets.set(key, previous);
};

for (const ad of selectedAds) {
  const media = ad.media || {};
  const primary = media.images?.[0] || media.posters?.[0];
  if (primary) linkAsset(ad, primary, "representative_visual");
  if (!primary && media.videos?.[0]) linkAsset(ad, media.videos[0], "representative_visual");

  if (ad.transcription?.available) {
    // Evita el vídeo accesorio común sin ordinal/póster; prioriza el vídeo propio.
    const videos = [...(media.videos || [])].sort(
      (a, b) => (b.posterAssetKeys?.length || 0) - (a.posterAssetKeys?.length || 0),
    );
    const video = videos[0];
    if (video) linkAsset(ad, video, "transcribed_video");
    for (const posterKey of video?.posterAssetKeys || []) {
      linkAsset(ad, { assetKey: posterKey }, "transcribed_video_poster");
    }
    if (!(video?.posterAssetKeys || []).length && media.posters?.[0]) {
      linkAsset(ad, media.posters[0], "transcribed_video_poster");
    }
  }
}

// El top-N combinado puede desplazar anuncios de una ejecución anterior. Todo
// lo que ya está publicado se convierte por ello en parte obligatoria de la
// selección, siempre validado contra el dataset, el manifiesto y el mapa
// canónicos actuales. Así el informe nuevo nunca propone borrar la evidencia
// histórica simplemente porque haya aparecido un anuncio con mejor score.
let publishedBaselineAds = 0;
let publishedBaselineAssetIdentities = 0;
for (const [externalId, publishedAd] of Object.entries(
  publishedIndex?.items || {},
)) {
  const ad = adById.get(String(externalId));
  if (!ad) {
    throw new Error(
      `El anuncio publicado ${externalId} no existe en el dataset combinado`,
    );
  }
  const companyId = String(publishedAd?.companyId || "");
  const candidatePageIds = [
    ...(publishedAd?.pageIds || []),
    publishedAd?.pageId,
    ad.pageId,
    ...(ad.observedPageIds || []),
  ]
    .filter(Boolean)
    .map(String);
  const pageId = [...new Set(candidatePageIds)].find((candidate) => {
    const mapping = companyMap.pageIds?.[candidate];
    return (
      mapping?.status === "matched" &&
      String(mapping.companyId || "") === companyId
    );
  });
  if (!pageId) {
    throw new Error(
      `El anuncio publicado ${externalId} ya no tiene un Page ID matched para ${companyId}`,
    );
  }
  const publishedAssets = Array.isArray(publishedAd?.mediaAssets)
    ? publishedAd.mediaAssets
    : [];
  if (!publishedAssets.length) {
    throw new Error(
      `El anuncio publicado ${externalId} no conserva mediaAssets verificables`,
    );
  }
  publishedBaselineAds += 1;
  selectedAdIds.add(String(externalId));
  for (const publishedAsset of publishedAssets) {
    const assetKey = String(publishedAsset?.assetKey || "");
    if (!assetKey || !assetByKey.has(assetKey)) {
      throw new Error(
        `El asset publicado ${externalId}:${assetKey || "(vacío)"} no existe en el manifiesto combinado`,
      );
    }
    linkAsset(
      ad,
      { assetKey },
      "published_baseline",
      { pageId, pageName: publishedAd?.pageName || ad.pageName },
    );
    publishedBaselineAssetIdentities += 1;
  }
}

const sniffExtension = (contentType, fallback) => {
  const type = String(contentType || "").toLowerCase().split(";")[0];
  const byType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return byType[type] || String(fallback || "bin").replace(/^\./, "").toLowerCase();
};

const isInside = (parent, child) => {
  const fromParent = relative(parent, child);
  return fromParent === "" || (!fromParent.startsWith("..") && !isAbsolute(fromParent));
};

const stagedFileName = (path) => relative(stagingDir, path).replaceAll("\\", "/");

const privateRootFile = (path) => {
  const fromRoot = relative(root, path).replaceAll("\\", "/");
  return fromRoot && !fromRoot.startsWith("../") ? `/${fromRoot}` : null;
};

const candidateStagedFiles = (directory, asset) => {
  if (!existsSync(directory)) return [];
  const preferred = String(asset.extensionHint || "").replace(/^\./, "").toLowerCase();
  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(`${asset.assetKey}.`) &&
        !entry.name.endsWith(".partial"),
    )
    .map((entry) => resolve(directory, entry.name))
    .filter((path) => statSync(path).size > 500)
    .sort((left, right) => {
      const leftPreferred = extname(left).slice(1).toLowerCase() === preferred ? 0 : 1;
      const rightPreferred = extname(right).slice(1).toLowerCase() === preferred ? 0 : 1;
      return leftPreferred - rightPreferred || left.localeCompare(right, "en");
    });
};

const findReusableAsset = (asset) => {
  for (const directory of reuseStagingDirs) {
    const candidate = candidateStagedFiles(directory, asset)[0];
    if (candidate) return { directory, path: candidate };
  }
  return null;
};

const existingResult = (asset, path, status, reusedFrom = null) => {
  const bytes = statSync(path).size;
  return {
    assetKey: asset.assetKey,
    kind: asset.kind,
    status,
    file: privateRootFile(path),
    stagedFile: stagedFileName(path),
    bytes,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    ...(reusedFrom ? { reusedFrom } : {}),
    selectedFor: asset.selectedFor,
  };
};

const download = async (asset) => {
  const reusable = findReusableAsset(asset);
  if (reusable) {
    if (isInside(stagingDir, reusable.path)) {
      return existingResult(asset, reusable.path, "existing");
    }
    const extension = extname(reusable.path).slice(1).toLowerCase();
    const destination = resolve(stagingDir, `${asset.assetKey}.${extension}`);
    if (!isInside(stagingDir, destination)) {
      throw new Error(`Destino staged no permitido: ${destination}`);
    }
    if (existsSync(destination)) {
      const sourceHash = createHash("sha256")
        .update(readFileSync(reusable.path))
        .digest("hex");
      const destinationHash = createHash("sha256")
        .update(readFileSync(destination))
        .digest("hex");
      if (sourceHash !== destinationHash) {
        throw new Error(
          `${asset.assetKey}: colisión entre el staging canónico y el staging reutilizado`,
        );
      }
      return existingResult(asset, destination, "existing");
    }
    copyFileSync(reusable.path, destination);
    return existingResult(
      asset,
      destination,
      "reused",
      relative(root, reusable.path).replaceAll("\\", "/"),
    );
  }

  const errors = [];
  for (const candidate of asset.candidates || []) {
    let temporaryPath = null;
    try {
      const response = await fetch(candidate.url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          accept: asset.kind === "video" ? "video/*,*/*;q=0.8" : "image/*,*/*;q=0.8",
        },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const declaredBytes = Number(response.headers.get("content-length") || 0);
      if (declaredBytes > MAX_BYTES_PER_ASSET) throw new Error(`demasiado grande: ${declaredBytes}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 500) throw new Error(`respuesta demasiado pequeña: ${buffer.length}`);
      if (buffer.length > MAX_BYTES_PER_ASSET) throw new Error(`demasiado grande: ${buffer.length}`);
      const extension = sniffExtension(response.headers.get("content-type"), asset.extensionHint);
      const finalPath = resolve(stagingDir, `${asset.assetKey}.${extension}`);
      temporaryPath = `${finalPath}.partial`;
      writeFileSync(temporaryPath, buffer);
      if (existsSync(finalPath)) rmSync(finalPath);
      renameSync(temporaryPath, finalPath);
      return {
        assetKey: asset.assetKey,
        kind: asset.kind,
        status: "downloaded",
        file: privateRootFile(finalPath),
        stagedFile: stagedFileName(finalPath),
        bytes: buffer.length,
        contentType: response.headers.get("content-type"),
        sha256: createHash("sha256").update(buffer).digest("hex"),
        quality: candidate.quality,
        selectedFor: asset.selectedFor,
      };
    } catch (error) {
      if (temporaryPath && existsSync(temporaryPath)) rmSync(temporaryPath);
      errors.push(`${candidate.quality || "candidate"}: ${error.message}`);
    }
  }
  return {
    assetKey: asset.assetKey,
    kind: asset.kind,
    status: "failed",
    errors,
    selectedFor: asset.selectedFor,
  };
};

const queue = [...selectedAssets.values()];
const results = [];
let cursor = 0;
const worker = async () => {
  while (cursor < queue.length) {
    const index = cursor;
    cursor += 1;
    results[index] = await download(queue[index]);
    if ((index + 1) % 25 === 0 || index + 1 === queue.length) {
      console.log(`Medios archivados: ${index + 1}/${queue.length}`);
    }
  }
};
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

const successful = results.filter((item) => item.status !== "failed");
const report = {
  schema: "redvitalia-scrapecreators-media-download-v1",
  generatedAt: new Date().toISOString(),
  source: {
    normalizedRawSha256: data.source.rawSha256,
    privateManifestRawSha256: manifest.sourceRawSha256,
    normalizedAds: (data.items || []).length,
    privateAssets: (manifest.assets || []).length,
    canonicalCombined: Number(data.source?.creditsCharged || 0) > 100,
  },
  selection: {
    maxAdsPerRequestedPage: MAX_ADS_PER_PAGE,
    requestedPages: groups.size,
    selectedAds: selectedAdIds.size,
    selectedAssets: queue.length,
    transcribedAds: [...selectedAdIds].filter(
      (externalId) => adById.get(String(externalId))?.transcription?.available,
    ).length,
    publishedBaselineAds,
    publishedBaselineAssetIdentities,
  },
  summary: {
    downloaded: results.filter((item) => item.status === "downloaded").length,
    existing: results.filter((item) => item.status === "existing").length,
    reused: results.filter((item) => item.status === "reused").length,
    failed: results.filter((item) => item.status === "failed").length,
    bytes: successful.reduce((sum, item) => sum + Number(item.bytes || 0), 0),
    byKind: Object.fromEntries(
      [...new Set(results.map((item) => item.kind))].map((kind) => [
        kind,
        results.filter((item) => item.kind === kind && item.status !== "failed").length,
      ]),
    ),
  },
  selectedAdIds: [...selectedAdIds].sort(),
  items: results,
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 1)}\n`, "utf8");
console.log(
  `Descarga terminada: ${report.summary.downloaded} nuevos, ${report.summary.existing} existentes, ` +
    `${report.summary.reused} reutilizados desde otro staging, ` +
    `${report.summary.failed} fallidos, ${(report.summary.bytes / 1024 / 1024).toFixed(1)} MB`,
);
