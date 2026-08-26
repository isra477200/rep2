#!/usr/bin/env node
/**
 * Publica la evidencia descargada de ScrapeCreators una vez revisada su
 * correspondencia pageId -> companyId.
 *
 * El proceso es deliberadamente conservador:
 * - solo acepta asociaciones con status="matched" y una ficha existente;
 * - nunca sustituye medios ajenos a esta importación;
 * - vuelve a calcular tipo, extensión, tamaño, hash y dimensiones desde el
 *   archivo descargado, sin confiar en la extensión o cabeceras de origen;
 * - usa nombres estables para que dos ejecuciones produzcan el mismo resultado.
 *
 * Uso:
 *   node scripts/publish-scrapecreators-media.mjs
 *   node scripts/publish-scrapecreators-media.mjs --dry-run
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueAfter = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const valueArguments = new Set([
  "--normalized",
  "--report",
  "--staging-dir",
  "--map",
  "--companies",
  "--identity",
  "--output-index",
  "--public-media-dir",
]);
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--dry-run") continue;
  if (!valueArguments.has(argument)) {
    throw new Error(`Argumento no reconocido: ${argument}`);
  }
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`Falta el valor de ${argument}`);
  }
  index += 1;
}

const normalizedPath = resolve(
  root,
  valueAfter("--normalized", "db/scrapecreators-spain-leadgen.json"),
);
const reportPath = resolve(
  root,
  valueAfter(
    "--report",
    "work/scrapecreators-spain-leadgen/media-download-report.json",
  ),
);
const stagingDir = resolve(
  root,
  valueAfter(
    "--staging-dir",
    "work/scrapecreators-spain-leadgen/media-staging",
  ),
);
const mapPath = resolve(
  root,
  valueAfter("--map", "scripts/data/scrapecreators-company-map.json"),
);
const companiesPath = resolve(
  root,
  valueAfter("--companies", "public/data/companies-index.json"),
);
const identityPath = resolve(
  root,
  valueAfter("--identity", "public/data/ad-media-identity.json"),
);
const outputIndexPath = resolve(
  root,
  valueAfter(
    "--output-index",
    "public/data/scrapecreators-media-index.json",
  ),
);
const publicMediaDir = resolve(
  root,
  valueAfter("--public-media-dir", "public/media"),
);
const dryRun = args.includes("--dry-run");

for (const requiredPath of [
  normalizedPath,
  reportPath,
  mapPath,
  companiesPath,
  identityPath,
]) {
  if (!existsSync(requiredPath)) {
    throw new Error(
      `Falta una entrada obligatoria: ${relative(root, requiredPath)}`,
    );
  }
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const normalized = readJson(normalizedPath);
const report = readJson(reportPath);
const companyMap = readJson(mapPath);
const companies = readJson(companiesPath);
const identities = readJson(identityPath);
const currentOutputIndex = existsSync(outputIndexPath)
  ? readJson(outputIndexPath)
  : { items: {} };

if (!Array.isArray(normalized.items))
  throw new Error("El dataset normalizado no contiene items[]");
if (normalized.schema !== "redvitalia-scrapecreators-ads-v1")
  throw new Error("El dataset normalizado tiene un esquema no reconocido");
if (!Array.isArray(report.items))
  throw new Error("El informe de descarga no contiene items[]");
if (report.schema !== "redvitalia-scrapecreators-media-download-v1")
  throw new Error("El informe de descarga tiene un esquema no reconocido");
if (!companyMap.pageIds || typeof companyMap.pageIds !== "object") {
  throw new Error("El mapa de compañías no contiene pageIds{}");
}
if (!Array.isArray(companies))
  throw new Error("companies-index.json no es una lista");
if (!Array.isArray(identities.items))
  throw new Error("ad-media-identity.json no contiene items[]");
if (identities.schema !== "redvitalia-ad-media-identity-v1")
  throw new Error("ad-media-identity.json tiene un esquema no reconocido");
if (
  existsSync(outputIndexPath) &&
  currentOutputIndex.schema !== "redvitalia-scrapecreators-media-index-v1"
) {
  throw new Error("El índice público ScrapeCreators actual tiene un esquema no reconocido");
}
if (
  report.source?.normalizedRawSha256 &&
  report.source.normalizedRawSha256 !== normalized.source?.rawSha256
) {
  throw new Error(
    "El informe de descarga no pertenece al mismo raw canónico que el dataset normalizado",
  );
}
if (
  report.source?.privateManifestRawSha256 &&
  report.source.privateManifestRawSha256 !== normalized.source?.rawSha256
) {
  throw new Error(
    "El manifiesto usado para descargar no pertenece al mismo raw canónico que el dataset normalizado",
  );
}
if (
  currentOutputIndex.items &&
  typeof currentOutputIndex.items !== "object"
) {
  throw new Error("El índice público ScrapeCreators actual tiene items inválido");
}

const compareText = (left, right) => {
  const a = String(left ?? "");
  const b = String(right ?? "");
  return a < b ? -1 : a > b ? 1 : 0;
};
const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean).map(String))].sort(compareText);
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const stableTimestamp =
  normalized.generatedAt ||
  report.generatedAt ||
  identities.generatedAt ||
  "1970-01-01T00:00:00.000Z";
const stableDate =
  /^\d{4}-\d{2}-\d{2}/.exec(stableTimestamp)?.[0] || stableTimestamp;
const companyIds = new Set(
  companies.map((company) => String(company.id || "")).filter(Boolean),
);
const adById = new Map(
  normalized.items.map((ad) => [String(ad.externalId || ""), ad]),
);
const currentIndexEntries = Array.isArray(currentOutputIndex.items)
  ? currentOutputIndex.items.map((item) => [String(item.externalId || ""), item])
  : Object.entries(currentOutputIndex.items || {});
const currentIndexByExternalId = new Map(currentIndexEntries);
const currentAssetFileByIdentity = new Map();
const historicalFileOwners = new Map();
for (const [externalId, item] of currentIndexEntries) {
  for (const asset of item?.mediaAssets || []) {
    const assetKey = String(asset?.assetKey || "");
    const file = String(asset?.file || "");
    if (!externalId || !assetKey || !file) continue;
    const identity = `${externalId}\u0000${assetKey}`;
    if (
      currentAssetFileByIdentity.has(identity) &&
      currentAssetFileByIdentity.get(identity) !== file
    ) {
      throw new Error(
        `El índice actual asigna varios ficheros a ${externalId}:${assetKey}`,
      );
    }
    currentAssetFileByIdentity.set(identity, file);
    const fileName = basename(file);
    if (
      historicalFileOwners.has(fileName) &&
      historicalFileOwners.get(fileName) !== identity
    ) {
      throw new Error(`El fichero histórico ${fileName} tiene varios propietarios`);
    }
    historicalFileOwners.set(fileName, identity);
  }
}

const safeSegment = (value, label) => {
  const result = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  if (!result)
    throw new Error(`No se puede construir un nombre seguro para ${label}`);
  return result;
};

const isInside = (parent, child) => {
  const pathFromParent = relative(parent, child);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent))
  );
};

const resolveStagedFile = (downloaded) => {
  const stagedFile = String(downloaded?.stagedFile || "").replace(/^[/\\]+/, "");
  const legacyFile = String(downloaded?.file || "").replace(/^[/\\]+/, "");
  const absolutePath = stagedFile
    ? resolve(stagingDir, stagedFile)
    : resolve(root, legacyFile);
  if (
    (!stagedFile && !legacyFile) ||
    !isInside(stagingDir, absolutePath)
  ) {
    throw new Error(
      `Ruta staged no permitida: ${downloaded?.stagedFile || downloaded?.file || "(vacía)"}`,
    );
  }
  if (!existsSync(absolutePath))
    throw new Error(
      `No existe el archivo staged: ${downloaded?.stagedFile || downloaded?.file}`,
    );
  return absolutePath;
};

const startsWithBytes = (buffer, bytes, offset = 0) =>
  bytes.every((value, index) => buffer[offset + index] === value);

const sniffMedia = (buffer) => {
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff]))
    return { extension: "jpg", type: "image/jpeg" };
  if (
    startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return { extension: "png", type: "image/png" };
  }
  if (
    buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
    buffer.subarray(0, 6).toString("ascii") === "GIF89a"
  ) {
    return { extension: "gif", type: "image/gif" };
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", type: "image/webp" };
  }
  if (
    startsWithBytes(buffer, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWithBytes(buffer, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return { extension: "tiff", type: "image/tiff" };
  }
  if (buffer.subarray(0, 2).toString("ascii") === "BM")
    return { extension: "bmp", type: "image/bmp" };
  if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]))
    return { extension: "webm", type: "video/webm" };

  const box = buffer.subarray(4, 12).toString("ascii");
  if (box.startsWith("ftyp")) {
    const brand = box.slice(4, 8);
    if (["avif", "avis"].includes(brand))
      return { extension: "avif", type: "image/avif" };
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return { extension: "heic", type: "image/heic" };
    }
    if (brand === "qt  ") return { extension: "mov", type: "video/quicktime" };
    return { extension: "mp4", type: "video/mp4" };
  }

  const beginning = buffer
    .subarray(0, Math.min(buffer.length, 2048))
    .toString("utf8")
    .trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(beginning)) {
    return { extension: "svg", type: "image/svg+xml" };
  }
  throw new Error(
    "Formato de medio desconocido; no se publicará usando una extensión inferida",
  );
};

const imageDimensions = async (buffer, type) => {
  if (!type.startsWith("image/")) return { width: null, height: null };
  try {
    const metadata = await sharp(buffer, { animated: true }).metadata();
    return {
      width: Number.isFinite(metadata.width) ? metadata.width : null,
      height: Number.isFinite(metadata.height) ? metadata.height : null,
    };
  } catch (error) {
    throw new Error(
      `Sharp no pudo leer las dimensiones (${type}): ${error.message}`,
    );
  }
};

const mappedPage = (pageId) => {
  const mapping = companyMap.pageIds[String(pageId || "")];
  if (!mapping || mapping.status !== "matched") return null;
  const companyId = String(mapping.companyId || "");
  if (!companyId || !companyIds.has(companyId)) return null;
  return { ...mapping, companyId };
};

// Primero se extraen asociaciones válidas. Un anuncio no puede pertenecer a dos
// fichas canónicas distintas porque el índice público está claveado por externalId.
const associations = [];
const skipped = {
  failedDownload: 0,
  invalidSelection: 0,
  unmatchedPage: 0,
  missingCompany: 0,
};
for (const downloaded of report.items) {
  if (
    !downloaded ||
    !["downloaded", "existing", "reused"].includes(downloaded.status)
  ) {
    skipped.failedDownload += 1;
    continue;
  }
  if (
    !Array.isArray(downloaded.selectedFor) ||
    !downloaded.selectedFor.length
  ) {
    skipped.invalidSelection += 1;
    continue;
  }
  for (const selection of downloaded.selectedFor) {
    if (
      !selection ||
      typeof selection !== "object" ||
      !selection.adId ||
      !selection.pageId
    ) {
      skipped.invalidSelection += 1;
      continue;
    }
    const normalizedAd = adById.get(String(selection.adId));
    if (!normalizedAd) {
      throw new Error(
        `El informe contiene el anuncio ${selection.adId}, ausente del dataset canónico`,
      );
    }
    const observedPageIds = new Set([
      String(normalizedAd.pageId || ""),
      ...(normalizedAd.observedPageIds || []).map(String),
    ].filter(Boolean));
    if (!observedPageIds.has(String(selection.pageId))) {
      throw new Error(
        `El informe atribuye Meta ${selection.adId} a Page ID ${selection.pageId}, no observada en el dataset canónico`,
      );
    }
    const rawMapping = companyMap.pageIds[String(selection.pageId)] || null;
    const mapping = mappedPage(selection.pageId);
    if (!mapping) {
      if (
        rawMapping?.status === "matched" &&
        !companyIds.has(String(rawMapping.companyId || ""))
      ) {
        skipped.missingCompany += 1;
      } else {
        skipped.unmatchedPage += 1;
      }
      continue;
    }
    associations.push({ downloaded, selection, mapping });
  }
}

const companiesByAd = new Map();
for (const association of associations) {
  const adId = String(association.selection.adId);
  const values = companiesByAd.get(adId) || new Set();
  values.add(association.mapping.companyId);
  companiesByAd.set(adId, values);
}
for (const [adId, values] of companiesByAd) {
  if (values.size > 1) {
    throw new Error(
      `El anuncio Meta ${adId} está asociado a varias fichas: ${[...values].join(", ")}`,
    );
  }
}

// Una misma descarga puede figurar dos veces para el mismo anuncio (por ejemplo,
// como visual representativo y como póster del vídeo). Se publica una sola vez y
// se conservan todos los motivos en el índice.
const groupedAssets = new Map();
for (const association of associations) {
  const adId = String(association.selection.adId);
  const key = [
    association.mapping.companyId,
    adId,
    association.downloaded.assetKey,
  ].join("\u0000");
  const previous = groupedAssets.get(key) || {
    companyId: association.mapping.companyId,
    externalId: adId,
    pageIds: new Set(),
    pageNames: new Set(),
    confidences: new Set(),
    reasons: new Set(),
    downloaded: association.downloaded,
  };
  previous.pageIds.add(String(association.selection.pageId));
  if (association.selection.pageName)
    previous.pageNames.add(String(association.selection.pageName));
  if (
    association.mapping.confidence !== undefined &&
    association.mapping.confidence !== null
  ) {
    previous.confidences.add(String(association.mapping.confidence));
  }
  if (association.selection.reason)
    previous.reasons.add(String(association.selection.reason));
  groupedAssets.set(key, previous);
}

const kindPriority = { image: 0, poster: 1, video: 2 };
const prepared = [];
for (const grouped of groupedAssets.values()) {
  const sourcePath = resolveStagedFile(grouped.downloaded);
  const buffer = readFileSync(sourcePath);
  const detected = sniffMedia(buffer);
  const dimensions = await imageDimensions(buffer, detected.type);
  const reportedKind = String(grouped.downloaded.kind || "").toLowerCase();
  const kind = ["image", "poster", "video"].includes(reportedKind)
    ? reportedKind
    : detected.type.startsWith("video/")
      ? "video"
      : "image";
  if (kind === "video" && !detected.type.startsWith("video/")) {
    throw new Error(
      `${grouped.downloaded.assetKey}: declarado vídeo pero detectado ${detected.type}`,
    );
  }
  if (kind !== "video" && !detected.type.startsWith("image/")) {
    throw new Error(
      `${grouped.downloaded.assetKey}: declarado ${kind} pero detectado ${detected.type}`,
    );
  }
  prepared.push({
    ...grouped,
    sourcePath,
    buffer,
    kind,
    extension: detected.extension,
    type: detected.type,
    bytes: buffer.length,
    sha256: sha256(buffer),
    width: dimensions.width,
    height: dimensions.height,
    pageIds: uniqueSorted([...grouped.pageIds]),
    pageNames: uniqueSorted([...grouped.pageNames]),
    confidences: uniqueSorted([...grouped.confidences]),
    reasons: uniqueSorted([...grouped.reasons]),
  });
}

prepared.sort(
  (a, b) =>
    compareText(a.companyId, b.companyId) ||
    compareText(a.externalId, b.externalId) ||
    (kindPriority[a.kind] ?? 9) - (kindPriority[b.kind] ?? 9) ||
    compareText(a.downloaded.assetKey, b.downloaded.assetKey),
);

const roleTotals = new Map();
for (const asset of prepared) {
  const roleKey = [asset.companyId, asset.externalId, asset.kind].join(
    "\u0000",
  );
  roleTotals.set(roleKey, (roleTotals.get(roleKey) || 0) + 1);
}
const roleCursors = new Map();
const assignedFileNames = new Map();
for (const asset of prepared) {
  const roleKey = [asset.companyId, asset.externalId, asset.kind].join(
    "\u0000",
  );
  const ordinal = (roleCursors.get(roleKey) || 0) + 1;
  roleCursors.set(roleKey, ordinal);
  const suffix =
    roleTotals.get(roleKey) > 1 ? `-${String(ordinal).padStart(2, "0")}` : "";
  const publishedFile = currentAssetFileByIdentity.get(
    `${asset.externalId}\u0000${String(asset.downloaded.assetKey || "")}`,
  );
  const fileOwner = `${asset.externalId}:${asset.downloaded.assetKey}`;
  const historicalOwner = `${asset.externalId}\u0000${asset.downloaded.assetKey}`;
  let fileName;
  if (publishedFile) {
    fileName = basename(publishedFile);
    if (
      publishedFile !== `/media/${fileName}` ||
      !fileName.includes("-sc-meta-")
    ) {
      throw new Error(
        `Ruta histórica ScrapeCreators no permitida: ${publishedFile}`,
      );
    }
    if (extname(fileName).slice(1).toLowerCase() !== asset.extension) {
      throw new Error(
        `${asset.externalId}:${asset.downloaded.assetKey} cambiaría de extensión histórica`,
      );
    }
  } else {
    fileName =
      `${safeSegment(asset.companyId, "companyId")}-sc-meta-` +
      `${safeSegment(asset.externalId, "externalId")}-${asset.kind}${suffix}.${asset.extension}`;
    if (
      (historicalFileOwners.has(fileName) &&
        historicalFileOwners.get(fileName) !== historicalOwner) ||
      assignedFileNames.has(fileName)
    ) {
      const assetSuffix = safeSegment(
        asset.downloaded.assetKey,
        "assetKey",
      ).slice(-16);
      fileName =
        `${safeSegment(asset.companyId, "companyId")}-sc-meta-` +
        `${safeSegment(asset.externalId, "externalId")}-${asset.kind}-${assetSuffix}.${asset.extension}`;
    }
  }
  if (
    historicalFileOwners.has(fileName) &&
    historicalFileOwners.get(fileName) !== historicalOwner
  ) {
    throw new Error(
      `El nuevo nombre ${fileName} colisiona con un medio histórico`,
    );
  }
  if (
    assignedFileNames.has(fileName) &&
    assignedFileNames.get(fileName) !== fileOwner
  ) {
    throw new Error(
      `Colisión de nombre público ${fileName} entre ${assignedFileNames.get(fileName)} y ${fileOwner}`,
    );
  }
  assignedFileNames.set(fileName, fileOwner);
  asset.fileName = fileName;
  asset.publicFile = `/media/${fileName}`;
}

const desiredFileNames = new Set(prepared.map((asset) => asset.fileName));
let copied = 0;
let unchanged = 0;
let staleRemoved = 0;

const publicAsset = (asset) => ({
  assetKey: String(asset.downloaded.assetKey || ""),
  kind: asset.kind,
  role: asset.kind,
  file: asset.publicFile,
  type: asset.type,
  extension: asset.extension,
  bytes: asset.bytes,
  width: asset.width,
  height: asset.height,
  sha256: asset.sha256,
  quality: asset.downloaded.quality || null,
  reasons: asset.reasons,
});

const assetsByAd = new Map();
for (const asset of prepared) {
  const bucket = assetsByAd.get(asset.externalId) || [];
  bucket.push(asset);
  assetsByAd.set(asset.externalId, bucket);
}

const indexItems = {};
const generatedMediaByCompany = new Map();
const generatedIdentities = [];
for (const externalId of [...assetsByAd.keys()].sort(compareText)) {
  const assets = assetsByAd.get(externalId);
  const companyId = assets[0].companyId;
  const ad = adById.get(externalId) || null;
  const images = assets.filter((asset) => asset.kind === "image");
  const posters = assets.filter((asset) => asset.kind === "poster");
  const videos = assets.filter((asset) => asset.kind === "video");
  const currentItem = currentIndexByExternalId.get(externalId) || null;
  const representative =
    assets.find((asset) => asset.publicFile === currentItem?.file) ||
    images[0] ||
    posters[0] ||
    videos[0];
  const representativeVideo =
    videos.find((asset) => asset.publicFile === currentItem?.videoFile) ||
    videos[0];
  const representativePoster =
    posters.find((asset) => asset.publicFile === currentItem?.posterFile) ||
    posters[0];
  const pageIds = uniqueSorted(assets.flatMap((asset) => asset.pageIds));
  const pageNames = uniqueSorted(assets.flatMap((asset) => asset.pageNames));
  const confidences = uniqueSorted(
    assets.flatMap((asset) => asset.confidences),
  );
  const mediaAssets = assets.map(publicAsset);

  indexItems[externalId] = {
    externalId,
    companyId,
    pageId: pageIds[0] || String(ad?.pageId || "") || null,
    pageIds,
    pageName: pageNames[0] || ad?.pageName || null,
    pageNames,
    mappingConfidence: confidences.length === 1 ? confidences[0] : confidences,
    sourceUrl: ad?.sourceUrl || null,
    landingUrl: ad?.landing?.url || null,
    isActive: typeof ad?.isActive === "boolean" ? ad.isActive : null,
    startedAt: ad?.startedAt || null,
    endedAt: ad?.endedAt || null,
    transcriptionAvailable: Boolean(ad?.transcription?.available),
    file: representative?.publicFile || null,
    videoFile: representativeVideo?.publicFile || null,
    posterFile: representativePoster?.publicFile || null,
    mediaAssets,
  };

  generatedIdentities.push({
    companyId,
    platform: "meta",
    externalId,
    file: representative.publicFile,
    variantCount: mediaAssets.length,
  });

  const companyMedia = generatedMediaByCompany.get(companyId) || [];
  for (const asset of assets) {
    companyMedia.push({
      file: asset.publicFile,
      type: asset.type,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      label: `Anuncio Meta · ${asset.kind === "poster" ? "póster" : asset.kind === "video" ? "vídeo" : "imagen"}`,
      title: `${ad?.pageName || companyId} · Meta ${externalId}`,
      _externalId: externalId,
      _kind: asset.kind,
    });
  }
  generatedMediaByCompany.set(companyId, companyMedia);
}

const nextCompanies = companies.map((company) => {
  const foreignMedia = (
    Array.isArray(company.media) ? company.media : []
  ).filter((media) => !String(media?.file || "").includes("-sc-meta-"));
  const additions = (
    generatedMediaByCompany.get(String(company.id)) || []
  ).sort(
    (a, b) =>
      compareText(a._externalId, b._externalId) ||
      (kindPriority[a._kind] ?? 9) - (kindPriority[b._kind] ?? 9) ||
      compareText(a.file, b.file),
  );
  const maxExistingOrder = foreignMedia.reduce(
    (maximum, media) =>
      Math.max(
        maximum,
        Number.isFinite(Number(media?.order)) ? Number(media.order) : 0,
      ),
    0,
  );
  const publishedAdditions = additions.map((media, index) => ({
    file: media.file,
    type: media.type,
    bytes: media.bytes,
    width: media.width,
    height: media.height,
    label: media.label,
    title: media.title,
    order: maxExistingOrder + index + 1,
  }));
  return { ...company, media: [...foreignMedia, ...publishedAdditions] };
});

const publishedIds = new Set(Object.keys(indexItems));
const foreignIdentities = identities.items.filter((identity) => {
  const ownFile = String(identity?.file || "").includes("-sc-meta-");
  const replacesSameMetaAd =
    String(identity?.platform || "").toLowerCase() === "meta" &&
    publishedIds.has(String(identity?.externalId || ""));
  return !ownFile && !replacesSameMetaAd;
});
const nextIdentityItems = [...foreignIdentities, ...generatedIdentities];
const nextIdentities = {
  ...identities,
  generatedAt: stableDate,
  total: nextIdentityItems.length,
  items: nextIdentityItems,
};

const outputIndex = {
  schema: "redvitalia-scrapecreators-media-index-v1",
  generatedAt: stableTimestamp,
  note: "Índice público de medios ScrapeCreators con asociación canónica revisada. No contiene URLs temporales del proveedor.",
  summary: {
    ads: Object.keys(indexItems).length,
    companies: generatedMediaByCompany.size,
    assets: prepared.length,
    bytes: prepared.reduce((sum, asset) => sum + asset.bytes, 0),
    images: prepared.filter((asset) => asset.kind === "image").length,
    posters: prepared.filter((asset) => asset.kind === "poster").length,
    videos: prepared.filter((asset) => asset.kind === "video").length,
    skipped,
  },
  items: indexItems,
};

const currentExternalIds = new Set(
  currentIndexEntries.map(([externalId]) => externalId).filter(Boolean),
);
const nextExternalIds = new Set(Object.keys(indexItems));
const currentAssetIdentities = new Set();
const nextAssetIdentities = new Set(
  prepared
    .filter((asset) => asset.downloaded.assetKey)
    .map(
      (asset) =>
        `${asset.externalId}:${String(asset.downloaded.assetKey)}`,
    ),
);
const currentIndexedFiles = new Set();
for (const [externalId, item] of currentIndexEntries) {
  for (const asset of item?.mediaAssets || []) {
    if (asset?.assetKey) {
      currentAssetIdentities.add(`${externalId}:${String(asset.assetKey)}`);
    }
    if (asset?.file) currentIndexedFiles.add(String(asset.file));
  }
  for (const file of [item?.file, item?.videoFile, item?.posterFile]) {
    if (file) currentIndexedFiles.add(String(file));
  }
}
const desiredPublicFiles = new Set(
  prepared.map((asset) => asset.publicFile),
);
const currentCompanyMediaFiles = new Set(
  companies.flatMap((company) =>
    (company.media || [])
      .map((media) => String(media?.file || ""))
      .filter((file) => file.includes("-sc-meta-")),
  ),
);
const currentDiskFiles = new Set(
  existsSync(publicMediaDir)
    ? readdirSync(publicMediaDir)
        .filter((fileName) => fileName.includes("-sc-meta-"))
        .map((fileName) => `/media/${fileName}`)
    : [],
);
const currentScIdentities = new Set(
  identities.items
    .filter(
      (identity) =>
        String(identity?.platform || "").toLowerCase() === "meta" &&
        String(identity?.file || "").includes("-sc-meta-"),
    )
    .map(
      (identity) =>
        `${String(identity.externalId || "")}:${String(identity.file || "")}`,
    ),
);
const nextScIdentities = new Set(
  generatedIdentities.map(
    (identity) => `${identity.externalId}:${identity.file}`,
  ),
);
const difference = (current, next) =>
  [...current].filter((value) => !next.has(value)).sort(compareText);
const additions = (current, next) =>
  [...next].filter((value) => !current.has(value)).sort(compareText);
const losses = {
  externalIds: difference(currentExternalIds, nextExternalIds),
  assetIdentities: difference(currentAssetIdentities, nextAssetIdentities),
  indexedFiles: difference(currentIndexedFiles, desiredPublicFiles),
  companyMediaFiles: difference(currentCompanyMediaFiles, desiredPublicFiles),
  publicFiles: difference(currentDiskFiles, desiredPublicFiles),
  identities: difference(currentScIdentities, nextScIdentities),
};
const lossTotal = Object.values(losses).reduce(
  (sum, values) => sum + values.length,
  0,
);
const destinationState = prepared.map((asset) => {
  const destination = resolve(publicMediaDir, asset.fileName);
  if (!isInside(publicMediaDir, destination)) {
    throw new Error(`Destino público no permitido: ${asset.fileName}`);
  }
  const identical =
    existsSync(destination) &&
    sha256(readFileSync(destination)) === asset.sha256;
  return { asset, destination, identical };
});
const replacements = destinationState
  .filter(
    ({ asset, destination, identical }) =>
      existsSync(destination) &&
      currentDiskFiles.has(asset.publicFile) &&
      !identical,
  )
  .map(({ asset }) => asset.publicFile)
  .sort(compareText);
const unsafeChangeTotal = lossTotal + replacements.length;
const plan = {
  schema: "redvitalia-scrapecreators-media-publish-plan-v1",
  mode: dryRun ? "dry-run" : "publish",
  safeToPublish: unsafeChangeTotal === 0,
  sourceBinding: report.source?.normalizedRawSha256
    ? "canonical_raw_sha256"
    : "legacy_report_validated_by_identity",
  current: {
    ads: currentExternalIds.size,
    assetIdentities: currentAssetIdentities.size,
    indexedFiles: currentIndexedFiles.size,
    companyMediaFiles: currentCompanyMediaFiles.size,
    publicFiles: currentDiskFiles.size,
    identities: currentScIdentities.size,
  },
  next: {
    ads: nextExternalIds.size,
    assetIdentities: nextAssetIdentities.size,
    files: desiredPublicFiles.size,
    identities: nextScIdentities.size,
  },
  additions: {
    externalIds: additions(currentExternalIds, nextExternalIds).length,
    assetIdentities: additions(currentAssetIdentities, nextAssetIdentities).length,
    files: additions(currentDiskFiles, desiredPublicFiles).length,
  },
  changes: {
    wouldCopy: destinationState.filter((entry) => !entry.identical).length,
    unchanged: destinationState.filter((entry) => entry.identical).length,
    wouldPrune: losses.publicFiles.length,
    replacements: {
      count: replacements.length,
      sample: replacements.slice(0, 12),
    },
  },
  losses: Object.fromEntries(
    Object.entries(losses).map(([key, values]) => [
      key,
      { count: values.length, sample: values.slice(0, 12) },
    ]),
  ),
};

if (unsafeChangeTotal > 0) {
  console.error(JSON.stringify(plan, null, 2));
  throw new Error(
    `Publicación bloqueada: el plan perdería ${lossTotal} referencias y reemplazaría ${replacements.length} medios ScrapeCreators actuales`,
  );
}

if (!dryRun) {
  mkdirSync(publicMediaDir, { recursive: true });
  for (const fileName of readdirSync(publicMediaDir)) {
    if (!fileName.includes("-sc-meta-") || desiredFileNames.has(fileName))
      continue;
    const stalePath = resolve(publicMediaDir, fileName);
    if (!isInside(publicMediaDir, stalePath))
      throw new Error(`Ruta pública no permitida: ${fileName}`);
    rmSync(stalePath, { force: true });
    staleRemoved += 1;
  }
  for (const { asset, destination, identical } of destinationState) {
    if (identical) {
      unchanged += 1;
      continue;
    }
    copyFileSync(asset.sourcePath, destination);
    copied += 1;
  }
}

if (!dryRun) {
  mkdirSync(dirname(outputIndexPath), { recursive: true });
  mkdirSync(dirname(companiesPath), { recursive: true });
  mkdirSync(dirname(identityPath), { recursive: true });
  writeFileSync(
    outputIndexPath,
    `${JSON.stringify(outputIndex, null, 1)}\n`,
    "utf8",
  );
  writeFileSync(
    companiesPath,
    `${JSON.stringify(nextCompanies, null, 1)}\n`,
    "utf8",
  );
  writeFileSync(
    identityPath,
    `${JSON.stringify(nextIdentities, null, 1)}\n`,
    "utf8",
  );
}

console.log(JSON.stringify(plan, null, 2));
console.log(
  `${dryRun ? "Simulación" : "Publicación"}: ${outputIndex.summary.ads} anuncios, ` +
    `${outputIndex.summary.assets} archivos, ${outputIndex.summary.companies} fichas, ` +
    `${(outputIndex.summary.bytes / 1024 / 1024).toFixed(1)} MB.`,
);
if (!dryRun) {
  console.log(
    `${copied} copiados, ${unchanged} ya idénticos y ${staleRemoved} obsoletos retirados.`,
  );
}
