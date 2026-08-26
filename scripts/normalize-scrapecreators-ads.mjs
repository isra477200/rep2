#!/usr/bin/env node
/* eslint-disable no-control-regex */
/**
 * Normaliza el volcado privado de ScrapeCreators sin publicar URLs efímeras.
 *
 * Entradas/salidas por defecto:
 *   work/scrapecreators-spain-leadgen/raw.json
 *   db/scrapecreators-spain-leadgen.json
 *   work/scrapecreators-spain-leadgen/media-manifest.json
 *
 * La salida de db conserva copy, destino y trazabilidad estable. Las URLs CDN
 * firmadas solo viven en el manifiesto privado, que sirve para descargar los
 * medios inmediatamente. El proceso es determinista e idempotente para un
 * mismo raw.json.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_PATH = resolve(
  process.argv[2] || resolve(ROOT, "work/scrapecreators-spain-leadgen/raw.json"),
);
const OUTPUT_PATH = resolve(
  process.argv[3] || resolve(ROOT, "db/scrapecreators-spain-leadgen.json"),
);
const PRIVATE_MEDIA_PATH = resolve(
  process.argv[4] ||
    resolve(ROOT, "work/scrapecreators-spain-leadgen/media-manifest.json"),
);
const EXPECTED_CREDITS_INPUT =
  process.argv[5] || process.env.SCRAPECREATORS_EXPECTED_CREDITS || null;

const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

const compareText = (left, right) => {
  const a = String(left ?? "");
  const b = String(right ?? "");
  return a < b ? -1 : a > b ? 1 : 0;
};

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort(compareText);

const asArray = (value) => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const cleanText = (value) => {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const cleanId = (value) => {
  const id = String(value || "").trim();
  return /^\d{10,20}$/.test(id) ? id : "";
};

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const epochIso = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const milliseconds = number > 10_000_000_000 ? number : number * 1_000;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const minIso = (values) =>
  uniqueSorted(values.map(validDate)).sort(compareText)[0] || null;

const maxIso = (values) =>
  uniqueSorted(values.map(validDate)).sort(compareText).at(-1) || null;

class ValueBag {
  constructor() {
    this.counts = new Map();
  }

  add(value) {
    const text = cleanText(value);
    if (!text) return;
    this.counts.set(text, (this.counts.get(text) || 0) + 1);
  }

  values() {
    return [...this.counts]
      .sort(
        ([left, leftCount], [right, rightCount]) =>
          rightCount - leftCount || right.length - left.length || compareText(left, right),
      )
      .map(([value]) => value);
  }

  primary() {
    return this.values()[0] || null;
  }
}

const addAll = (target, values) => {
  for (const value of asArray(values)) {
    if (Array.isArray(value)) addAll(target, value);
    else {
      const text = cleanText(value);
      if (text) target.add(text);
    }
  }
};

const ASSET_HOST = /(?:^|\.)(?:fbcdn\.net|cdninstagram\.com)$/i;
const PLATFORM_HOST = /(?:^|\.)(?:facebook\.com|instagram\.com|messenger\.com)$/i;
const SIGNED_PARAM = /^(?:x-amz-|x-goog-|signature$|sig$|token$|access_token$|auth$|authorization$|expires?$|expiry$|policy$|key-pair-id$|credential$|oh$|oe$|efg$|ccb$|_nc_)/i;
const TRACKING_PARAM = /^(?:utm_|fbclid$|gclid$|msclkid$|dclid$|mc_|hsa_|campaign_id$|ad_id$|adset_id$|placement$)/i;

const parseHttpUrl = (value) => {
  const text = cleanText(value)
    .replace(/^[<([{'"\s]+/, "")
    .replace(/[>\])}'",.;:\s]+$/, "");
  if (!text || text.length > 8_192) return null;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "127.0.0.1" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

const isEphemeralUrl = (value) => {
  const url = parseHttpUrl(value);
  if (!url) return false;
  if (ASSET_HOST.test(url.hostname)) return true;
  return [...url.searchParams.keys()].some((key) => SIGNED_PARAM.test(key));
};

const cleanLandingUrl = (value, depth = 0) => {
  const url = parseHttpUrl(value);
  if (!url || depth > 2 || ASSET_HOST.test(url.hostname)) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    /^(?:l|lm)\.facebook\.com$/i.test(url.hostname) &&
    /\/l\.php$/i.test(url.pathname)
  ) {
    const destination = url.searchParams.get("u");
    return destination ? cleanLandingUrl(destination, depth + 1) : null;
  }

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (SIGNED_PARAM.test(key) || TRACKING_PARAM.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = host;
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  }
  return url.toString();
};

const urlsFrom = (value) => {
  const output = [];
  const visit = (entry) => {
    if (entry == null) return;
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item);
      return;
    }
    if (typeof entry === "object") return;
    const text = String(entry);
    if (parseHttpUrl(text)) output.push(text);
    for (const match of text.match(/https?:\/\/[^\s<>"')\]]+/gi) || []) {
      output.push(match.replace(/[.,;:]+$/, ""));
    }
  };
  visit(value);
  return uniqueSorted(output);
};

const scrubEphemeralUrls = (value) => {
  const text = cleanText(value);
  if (!text) return "";
  return text.replace(/https?:\/\/[^\s<>"')\]]+/gi, (match) => {
    const trailing = match.match(/[.,;:]+$/)?.[0] || "";
    const core = trailing ? match.slice(0, -trailing.length) : match;
    return `${isEphemeralUrl(core) ? "[URL efímera omitida]" : core}${trailing}`;
  });
};

const stableAssetFingerprint = (url) => {
  const parsed = parseHttpUrl(url);
  if (!parsed) return "";
  return `${parsed.hostname.toLowerCase()}${decodeURIComponent(parsed.pathname)}`;
};

const extensionHint = (kind, url) => {
  const parsed = parseHttpUrl(url);
  const extension = parsed?.pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (extension && /^(?:jpe?g|png|webp|gif|avif|mp4|webm|mov)$/.test(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }
  if (kind === "video") return "mp4";
  return "jpg";
};

const privateAssets = new Map();

const registerPrivateAsset = ({
  externalId,
  pageId,
  kind,
  role,
  candidates,
}) => {
  const usable = candidates
    .map((candidate) => ({
      quality: cleanText(candidate.quality) || "source",
      url: cleanText(candidate.url),
    }))
    .filter((candidate) => parseHttpUrl(candidate.url));
  if (!usable.length) return null;
  const fingerprint = usable.map((candidate) => stableAssetFingerprint(candidate.url)).find(Boolean);
  if (!fingerprint) return null;
  const assetKey = `sc-${kind}-${sha256(`${kind}|${fingerprint}`).slice(0, 20)}`;
  const current = privateAssets.get(assetKey) || {
    assetKey,
    kind,
    extensionHint: extensionHint(kind, usable[0].url),
    suggestedFilename: `${assetKey}.${extensionHint(kind, usable[0].url)}`,
    adIds: new Set(),
    pageIds: new Set(),
    roles: new Set(),
    candidates: new Map(),
  };
  if (externalId) current.adIds.add(externalId);
  if (pageId) current.pageIds.add(pageId);
  if (role) current.roles.add(role);
  for (const candidate of usable) {
    const key = `${candidate.quality}|${candidate.url}`;
    current.candidates.set(key, candidate);
  }
  privateAssets.set(assetKey, current);
  return assetKey;
};

const newAccumulator = (externalId) => ({
  externalId,
  sightings: 0,
  pageIds: new ValueBag(),
  pageNames: new ValueBag(),
  body: new ValueBag(),
  title: new ValueBag(),
  description: new ValueBag(),
  caption: new ValueBag(),
  extraText: new ValueBag(),
  ctaText: new ValueBag(),
  ctaType: new ValueBag(),
  landingUrls: new ValueBag(),
  queries: new Set(),
  requestedCompanyNames: new Set(),
  requestedPageIds: new Set(),
  requestLabels: new Set(),
  requestPaths: new Set(),
  publisherPlatforms: new Set(),
  displayFormats: new Set(),
  categories: new Set(),
  collationIds: new Set(),
  activeStates: new Set(),
  pageDeletedStates: new Set(),
  startDates: [],
  endDates: [],
  fetchedDates: [],
  totalActiveTimes: [],
  media: new Map(),
  transcripts: new ValueBag(),
  transcriptAvailableStates: new Set(),
  transcriptFetchedDates: [],
});

const accumulators = new Map();
const getAccumulator = (externalId) => {
  if (!accumulators.has(externalId)) {
    accumulators.set(externalId, newAccumulator(externalId));
  }
  return accumulators.get(externalId);
};

const addMediaReference = (
  accumulator,
  { assetKey, kind, role, ordinal = null, cardIndex = null, posterAssetKey = null },
) => {
  if (!assetKey) return;
  const current = accumulator.media.get(assetKey) || {
    assetKey,
    kind,
    roles: new Set(),
    ordinals: new Set(),
    cardIndexes: new Set(),
    posterAssetKeys: new Set(),
  };
  if (role) current.roles.add(role);
  if (Number.isInteger(ordinal)) current.ordinals.add(ordinal);
  if (Number.isInteger(cardIndex)) current.cardIndexes.add(cardIndex);
  if (posterAssetKey) current.posterAssetKeys.add(posterAssetKey);
  accumulator.media.set(assetKey, current);
};

const registerImage = (
  accumulator,
  image,
  { role, ordinal = null, cardIndex = null, pageId = null } = {},
) => {
  if (!image || typeof image !== "object") return null;
  const assetKey = registerPrivateAsset({
    externalId: accumulator.externalId,
    pageId,
    kind: "image",
    role,
    candidates: [
      { quality: "original", url: image.original_image_url },
      { quality: "resized", url: image.resized_image_url },
      { quality: "watermarked", url: image.watermarked_resized_image_url },
    ],
  });
  addMediaReference(accumulator, { assetKey, kind: "image", role, ordinal, cardIndex });
  return assetKey;
};

const registerVideo = (
  accumulator,
  video,
  { role, ordinal = null, cardIndex = null, pageId = null } = {},
) => {
  if (!video || typeof video !== "object") return null;
  const posterAssetKey = registerPrivateAsset({
    externalId: accumulator.externalId,
    pageId,
    kind: "poster",
    role: `${role || "video"}_poster`,
    candidates: [{ quality: "preview", url: video.video_preview_image_url }],
  });
  addMediaReference(accumulator, {
    assetKey: posterAssetKey,
    kind: "poster",
    role: `${role || "video"}_poster`,
    ordinal,
    cardIndex,
  });
  const assetKey = registerPrivateAsset({
    externalId: accumulator.externalId,
    pageId,
    kind: "video",
    role,
    candidates: [
      { quality: "hd", url: video.video_hd_url },
      { quality: "sd", url: video.video_sd_url },
      { quality: "watermarked_hd", url: video.watermarked_video_hd_url },
      { quality: "watermarked_sd", url: video.watermarked_video_sd_url },
    ],
  });
  addMediaReference(accumulator, {
    assetKey,
    kind: "video",
    role,
    ordinal,
    cardIndex,
    posterAssetKey,
  });
  return assetKey;
};

const addLandingValues = (accumulator, value) => {
  for (const candidate of urlsFrom(value)) {
    const cleaned = cleanLandingUrl(candidate);
    if (cleaned) accumulator.landingUrls.add(cleaned);
  }
};

const addSnapshot = (accumulator, row) => {
  const snapshot = row?.snapshot && typeof row.snapshot === "object" ? row.snapshot : {};
  const pageId = cleanId(row.page_id || snapshot.page_id);
  accumulator.pageIds.add(pageId);
  accumulator.pageNames.add(row.page_name || snapshot.page_name);
  accumulator.body.add(scrubEphemeralUrls(snapshot.body?.text));
  accumulator.title.add(scrubEphemeralUrls(snapshot.title));
  accumulator.description.add(scrubEphemeralUrls(snapshot.link_description));
  accumulator.caption.add(scrubEphemeralUrls(snapshot.caption));
  accumulator.ctaText.add(snapshot.cta_text);
  accumulator.ctaType.add(snapshot.cta_type);
  addAll(accumulator.publisherPlatforms, row.publisher_platform);
  addAll(accumulator.categories, [row.categories, snapshot.page_categories]);
  accumulator.displayFormats.add(cleanText(snapshot.display_format));
  accumulator.collationIds.add(cleanId(row.collation_id));
  if (typeof row.is_active === "boolean") accumulator.activeStates.add(row.is_active);
  if (typeof row.page_is_deleted === "boolean") {
    accumulator.pageDeletedStates.add(row.page_is_deleted);
  }
  if (typeof snapshot.page_is_deleted === "boolean") {
    accumulator.pageDeletedStates.add(snapshot.page_is_deleted);
  }
  const startedAt = epochIso(row.start_date) || validDate(row.start_date_string);
  const endedAt = epochIso(row.end_date) || validDate(row.end_date_string);
  if (startedAt) accumulator.startDates.push(startedAt);
  if (endedAt) accumulator.endDates.push(endedAt);
  if (Number.isFinite(Number(row.total_active_time))) {
    accumulator.totalActiveTimes.push(Number(row.total_active_time));
  }

  addLandingValues(accumulator, snapshot.link_url);
  addLandingValues(accumulator, snapshot.extra_links);
  for (const text of asArray(snapshot.extra_texts)) {
    accumulator.extraText.add(scrubEphemeralUrls(text?.text ?? text));
  }

  asArray(snapshot.images).forEach((image, index) =>
    registerImage(accumulator, image, {
      role: "snapshot_image",
      ordinal: index,
      pageId,
    }),
  );
  asArray(snapshot.extra_images).forEach((image, index) =>
    registerImage(accumulator, image, {
      role: "extra_image",
      ordinal: index,
      pageId,
    }),
  );
  asArray(snapshot.videos).forEach((video, index) =>
    registerVideo(accumulator, video, {
      role: "snapshot_video",
      ordinal: index,
      pageId,
    }),
  );
  asArray(snapshot.extra_videos).forEach((video, index) =>
    registerVideo(accumulator, video, {
      role: "extra_video",
      ordinal: index,
      pageId,
    }),
  );

  asArray(snapshot.cards).forEach((card, index) => {
    if (!card || typeof card !== "object") return;
    accumulator.body.add(scrubEphemeralUrls(card.body));
    accumulator.title.add(scrubEphemeralUrls(card.title));
    accumulator.description.add(scrubEphemeralUrls(card.link_description));
    accumulator.caption.add(scrubEphemeralUrls(card.caption));
    accumulator.ctaText.add(card.cta_text);
    accumulator.ctaType.add(card.cta_type);
    addLandingValues(accumulator, card.link_url);
    registerImage(accumulator, card, {
      role: "card_image",
      ordinal: index,
      cardIndex: index,
      pageId,
    });
    registerVideo(accumulator, card, {
      role: "card_video",
      ordinal: index,
      cardIndex: index,
      pageId,
    });
  });

  const profileAssetKey = registerPrivateAsset({
    externalId: accumulator.externalId,
    pageId,
    kind: "profile_image",
    role: "page_profile",
    candidates: [{ quality: "profile", url: snapshot.page_profile_picture_url }],
  });
  addMediaReference(accumulator, {
    assetKey: profileAssetKey,
    kind: "profile_image",
    role: "page_profile",
  });
};

const rawText = await readFile(RAW_PATH, "utf8");
const raw = JSON.parse(rawText);
if (!raw || !Array.isArray(raw.requests)) {
  throw new Error("ScrapeCreators: raw.json no contiene un array requests válido");
}
const EXPECTED_CREDITS = Number(
  EXPECTED_CREDITS_INPUT || raw.expectedCredits || 100,
);
if (!Number.isFinite(EXPECTED_CREDITS) || EXPECTED_CREDITS < 0) {
  throw new Error(
    `ScrapeCreators: expectedCredits inválido (${EXPECTED_CREDITS_INPUT || raw.expectedCredits})`,
  );
}

const endpointStats = new Map();
const requestDates = [];
const creditSnapshots = [];
let reportedCreditsCharged = 0;
let rawAdRows = 0;
let invalidAdRows = 0;
let successfulRequests = 0;
let failedRequests = 0;

for (const request of raw.requests) {
  const path = cleanText(request.path) || "unknown";
  const status = Number(request.status || 0);
  const statKey = `${path}|${status}`;
  endpointStats.set(statKey, (endpointStats.get(statKey) || 0) + 1);
  if (status >= 200 && status < 300) successfulRequests += 1;
  else failedRequests += 1;
  const fetchedAt = validDate(request.fetchedAt);
  if (fetchedAt) requestDates.push(fetchedAt);
  reportedCreditsCharged += Math.max(
    0,
    Number(request.data?.credits_charged || 0),
  );
  if (Number.isFinite(Number(request.data?.creditCount))) {
    creditSnapshots.push({
      label: cleanText(request.label) || path,
      fetchedAt,
      credits: Number(request.data.creditCount),
    });
  }

  const params = request.params && typeof request.params === "object" ? request.params : {};
  const rows = path.endsWith("/company/ads")
    ? asArray(request.data?.results)
    : path.endsWith("/search/ads")
      ? asArray(request.data?.searchResults)
      : [];

  for (const row of rows) {
    rawAdRows += 1;
    const externalId = cleanId(row?.ad_archive_id);
    if (!externalId) {
      invalidAdRows += 1;
      continue;
    }
    const accumulator = getAccumulator(externalId);
    accumulator.sightings += 1;
    accumulator.requestPaths.add(path);
    accumulator.requestLabels.add(cleanText(request.label));
    if (fetchedAt) accumulator.fetchedDates.push(fetchedAt);
    const query = cleanText(params.query);
    const companyName = cleanText(params.companyName);
    const requestedPageId = cleanId(params.pageId);
    if (query) accumulator.queries.add(query);
    if (companyName) accumulator.requestedCompanyNames.add(companyName);
    if (requestedPageId) accumulator.requestedPageIds.add(requestedPageId);
    addSnapshot(accumulator, row);
  }
}

let orphanTranscripts = 0;
for (const request of raw.requests) {
  if (!String(request.path || "").endsWith("/ad/transcript")) continue;
  const externalId = cleanId(request.data?.ad_id || request.params?.id);
  if (!externalId) continue;
  if (!accumulators.has(externalId)) orphanTranscripts += 1;
  const accumulator = getAccumulator(externalId);
  const fetchedAt = validDate(request.fetchedAt);
  accumulator.requestPaths.add(cleanText(request.path));
  accumulator.requestLabels.add(cleanText(request.label));
  if (fetchedAt) accumulator.transcriptFetchedDates.push(fetchedAt);
  if (typeof request.data?.transcript_available === "boolean") {
    accumulator.transcriptAvailableStates.add(request.data.transcript_available);
  }
  accumulator.transcripts.add(scrubEphemeralUrls(request.data?.transcript));

  const transcriptUrl = cleanText(request.data?.url);
  const transcriptAssetKey = registerPrivateAsset({
    externalId,
    pageId: accumulator.pageIds.primary(),
    kind: "video",
    role: "transcript_source",
    candidates: [{ quality: "transcript_source", url: transcriptUrl }],
  });
  addMediaReference(accumulator, {
    assetKey: transcriptAssetKey,
    kind: "video",
    role: "transcript_source",
  });
}

const commercialDomain = (urlValue) => {
  const url = parseHttpUrl(urlValue);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    ASSET_HOST.test(host) ||
    PLATFORM_HOST.test(host) ||
    /^(?:fb\.me|wa\.me|whatsapp\.com|youtube\.com|youtu\.be|tiktok\.com|linkedin\.com)$/i.test(host)
  ) {
    return null;
  }
  return host;
};

const finalizeMediaReference = (reference) => ({
  assetKey: reference.assetKey,
  kind: reference.kind,
  roles: uniqueSorted([...reference.roles]),
  ordinals: [...reference.ordinals].sort((left, right) => left - right),
  cardIndexes: [...reference.cardIndexes].sort((left, right) => left - right),
  posterAssetKeys: uniqueSorted([...reference.posterAssetKeys]),
});

const items = [...accumulators.values()]
  .map((accumulator) => {
    const pageId = accumulator.pageIds.primary();
    const pageName = accumulator.pageNames.primary();
    const landingUrls = accumulator.landingUrls.values();
    const landingDomains = uniqueSorted(landingUrls.map(commercialDomain));
    const media = [...accumulator.media.values()]
      .map(finalizeMediaReference)
      .sort(
        (left, right) =>
          compareText(left.kind, right.kind) || compareText(left.assetKey, right.assetKey),
      );
    const byKind = (kind) => media.filter((asset) => asset.kind === kind);
    const active = accumulator.activeStates.has(true);
    const transcripts = accumulator.transcripts.values();
    return {
      externalId: accumulator.externalId,
      platform: "meta",
      sourceUrl: `https://www.facebook.com/ads/library/?id=${accumulator.externalId}`,
      pageId,
      pageName,
      observedPageIds: accumulator.pageIds.values(),
      observedPageNames: accumulator.pageNames.values(),
      queries: uniqueSorted([...accumulator.queries]),
      requestedCompanyNames: uniqueSorted([...accumulator.requestedCompanyNames]),
      requestedPageIds: uniqueSorted([...accumulator.requestedPageIds]),
      requestLabels: uniqueSorted([...accumulator.requestLabels]),
      requestPaths: uniqueSorted([...accumulator.requestPaths]),
      isActive: active,
      activeStateConflict: accumulator.activeStates.size > 1,
      pageIsDeleted: accumulator.pageDeletedStates.has(true),
      startedAt: minIso(accumulator.startDates),
      endedAt: active ? null : maxIso(accumulator.endDates),
      endDateObservedAt: maxIso(accumulator.endDates),
      firstFetchedAt: minIso(accumulator.fetchedDates),
      lastFetchedAt: maxIso(accumulator.fetchedDates),
      totalActiveTime: accumulator.totalActiveTimes.length
        ? Math.max(...accumulator.totalActiveTimes)
        : null,
      publisherPlatforms: uniqueSorted([...accumulator.publisherPlatforms]),
      displayFormats: uniqueSorted([...accumulator.displayFormats]),
      categories: uniqueSorted([...accumulator.categories]),
      collationIds: uniqueSorted([...accumulator.collationIds]),
      copy: {
        text: accumulator.body.primary(),
        title: accumulator.title.primary(),
        description: accumulator.description.primary(),
        caption: accumulator.caption.primary(),
        bodies: accumulator.body.values(),
        titles: accumulator.title.values(),
        descriptions: accumulator.description.values(),
        captions: accumulator.caption.values(),
        extraTexts: accumulator.extraText.values(),
      },
      cta: {
        text: accumulator.ctaText.primary(),
        type: accumulator.ctaType.primary(),
        texts: accumulator.ctaText.values(),
        types: accumulator.ctaType.values(),
      },
      landing: {
        url: landingUrls[0] || null,
        urls: landingUrls,
        domains: landingDomains,
      },
      media: {
        images: byKind("image"),
        videos: byKind("video"),
        posters: byKind("poster"),
        profileImages: byKind("profile_image"),
        totalAssets: media.length,
      },
      transcription: {
        available:
          transcripts.length > 0 || accumulator.transcriptAvailableStates.has(true),
        text: transcripts[0] || null,
        variants: transcripts,
        firstFetchedAt: minIso(accumulator.transcriptFetchedDates),
        lastFetchedAt: maxIso(accumulator.transcriptFetchedDates),
      },
      observationCount: accumulator.sightings,
    };
  })
  .sort((left, right) => compareText(left.externalId, right.externalId));

const buildReport = (normalizedItems) => {
  const advertiserMap = new Map();
  const pageMap = new Map();
  const domainMap = new Map();

  const addItem = (map, key, factory, item) => {
    if (!key) return;
    const record = map.get(key) || factory();
    record.adIds.add(item.externalId);
    if (item.isActive) record.activeAdIds.add(item.externalId);
    for (const query of item.queries) record.queries.add(query);
    for (const pageId of item.observedPageIds) record.pageIds.add(pageId);
    for (const pageName of item.observedPageNames) record.pageNames.add(pageName);
    for (const domain of item.landing.domains) record.domains.add(domain);
    map.set(key, record);
  };

  const baseRecord = () => ({
    adIds: new Set(),
    activeAdIds: new Set(),
    queries: new Set(),
    pageIds: new Set(),
    pageNames: new Set(),
    domains: new Set(),
  });

  for (const item of normalizedItems) {
    const advertiserKey = cleanText(item.pageName)
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() || `page ${item.pageId || "unknown"}`;
    addItem(advertiserMap, advertiserKey, baseRecord, item);
    for (const pageId of item.observedPageIds) {
      addItem(pageMap, pageId, baseRecord, item);
    }
    for (const domain of item.landing.domains) {
      addItem(domainMap, domain, baseRecord, item);
    }
  }

  const finalize = (keyName, map) =>
    [...map.entries()]
      .map(([key, record]) => ({
        [keyName]: key,
        name: record.pageNames.size
          ? [...record.pageNames].sort(compareText)[0]
          : null,
        pageIds: uniqueSorted([...record.pageIds]),
        pageNames: uniqueSorted([...record.pageNames]),
        domains: uniqueSorted([...record.domains]),
        adCount: record.adIds.size,
        activeAdCount: record.activeAdIds.size,
        queries: uniqueSorted([...record.queries]),
      }))
      .sort(
        (left, right) =>
          right.adCount - left.adCount || compareText(left[keyName], right[keyName]),
      );

  return {
    advertisers: finalize("advertiserKey", advertiserMap),
    pageIds: finalize("pageId", pageMap),
    domains: finalize("domain", domainMap),
  };
};

const report = buildReport(items);
const sourceGeneratedAt =
  validDate(raw.generatedAt) || maxIso(requestDates) || minIso(requestDates);
const orderedCreditSnapshots = creditSnapshots.sort((left, right) =>
  compareText(left.fetchedAt, right.fetchedAt),
);
let balanceCreditsCharged = 0;
for (let index = 1; index < orderedCreditSnapshots.length; index += 1) {
  const previous = orderedCreditSnapshots[index - 1].credits;
  const current = orderedCreditSnapshots[index].credits;
  if (current < previous) balanceCreditsCharged += previous - current;
}
const creditsCharged = orderedCreditSnapshots.length >= 2
  ? balanceCreditsCharged
  : reportedCreditsCharged;
const endpointSummary = [...endpointStats.entries()]
  .map(([key, count]) => {
    const [path, status] = key.split("|");
    return { path, status: Number(status), count };
  })
  .sort(
    (left, right) =>
      compareText(left.path, right.path) || left.status - right.status,
  );
const latestReportedRemaining = raw.requests
  .map((request) => ({
    fetchedAt: validDate(request.fetchedAt),
    value: Number(request.data?.credits_remaining),
  }))
  .filter((entry) => entry.fetchedAt && Number.isFinite(entry.value))
  .sort((left, right) => compareText(left.fetchedAt, right.fetchedAt))
  .at(-1)?.value;

const normalized = {
  schema: "redvitalia-scrapecreators-ads-v1",
  generatedAt: sourceGeneratedAt,
  note: "Volcado normalizado y deduplicado por ID de Meta. Las URLs efímeras o firmadas de medios no se publican: solo existen en el manifiesto privado de descarga.",
  source: {
    provider: "ScrapeCreators",
    rawSchema: cleanText(raw.schema) || null,
    rawSha256: sha256(rawText),
    firstFetchedAt: minIso(requestDates),
    lastFetchedAt: maxIso(requestDates),
    requests: raw.requests.length,
    successfulRequests,
    failedRequests,
    creditsCharged,
    reportedCreditsCharged,
    balanceCreditsCharged:
      orderedCreditSnapshots.length >= 2 ? balanceCreditsCharged : null,
    creditAccountingAdjustment: creditsCharged - reportedCreditsCharged,
    creditsRemaining: orderedCreditSnapshots.length
      ? orderedCreditSnapshots.at(-1).credits
      : Number.isFinite(latestReportedRemaining)
        ? latestReportedRemaining
        : null,
    creditSnapshots: orderedCreditSnapshots
      .map((entry) => ({ ...entry, fetchedAt: entry.fetchedAt || sourceGeneratedAt })),
    endpoints: endpointSummary,
  },
  summary: {
    rawAdRows,
    invalidAdRows,
    uniqueAds: items.length,
    duplicateRowsCollapsed: Math.max(0, rawAdRows - (items.length - orphanTranscripts)),
    advertisers: report.advertisers.length,
    pageIds: report.pageIds.length,
    commercialDomains: report.domains.length,
    activeAds: items.filter((item) => item.isActive).length,
    adsWithCopy: items.filter((item) => item.copy.text || item.copy.title).length,
    adsWithLanding: items.filter((item) => item.landing.urls.length).length,
    adsWithImages: items.filter((item) => item.media.images.length).length,
    adsWithVideos: items.filter((item) => item.media.videos.length).length,
    adsWithTranscription: items.filter((item) => item.transcription.available).length,
    orphanTranscripts,
    privateMediaAssets: privateAssets.size,
  },
  report,
  items,
};

const privateMedia = {
  schema: "redvitalia-scrapecreators-private-media-v1",
  generatedAt: sourceGeneratedAt,
  private: true,
  note: "Manifiesto privado para descarga inmediata. Contiene URLs CDN efímeras y nunca debe copiarse a public/ ni a respuestas de usuario.",
  sourceRawSha256: normalized.source.rawSha256,
  totalAssets: privateAssets.size,
  byKind: Object.fromEntries(
    ["image", "video", "poster", "profile_image"].map((kind) => [
      kind,
      [...privateAssets.values()].filter((asset) => asset.kind === kind).length,
    ]),
  ),
  assets: [...privateAssets.values()]
    .map((asset) => ({
      assetKey: asset.assetKey,
      kind: asset.kind,
      extensionHint: asset.extensionHint,
      suggestedFilename: asset.suggestedFilename,
      adIds: uniqueSorted([...asset.adIds]),
      pageIds: uniqueSorted([...asset.pageIds]),
      roles: uniqueSorted([...asset.roles]),
      candidates: [...asset.candidates.values()].sort(
        (left, right) =>
          compareText(left.quality, right.quality) || compareText(left.url, right.url),
      ),
    }))
    .sort((left, right) => compareText(left.assetKey, right.assetKey)),
};

const assertNoPrivateUrls = (value) => {
  const text = JSON.stringify(value);
  if (/(?:fbcdn\.net|cdninstagram\.com)/i.test(text)) {
    throw new Error("ScrapeCreators: una URL CDN efímera alcanzó la salida normalizada");
  }
  for (const match of text.match(/https?:\\?\/\\?\/[^"\s]+/gi) || []) {
    const decoded = match.replaceAll("\\/", "/");
    if (isEphemeralUrl(decoded)) {
      throw new Error("ScrapeCreators: una URL firmada alcanzó la salida normalizada");
    }
  }
};

assertNoPrivateUrls(normalized);
if (new Set(items.map((item) => item.externalId)).size !== items.length) {
  throw new Error("ScrapeCreators: la salida contiene IDs publicitarios duplicados");
}
if (creditsCharged !== EXPECTED_CREDITS) {
  throw new Error(
    `ScrapeCreators: el ledger normalizado suma ${creditsCharged} créditos, se esperaban ${EXPECTED_CREDITS}`,
  );
}
if (!privateMedia.assets.length) {
  throw new Error("ScrapeCreators: no se extrajeron medios al manifiesto privado");
}

const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

await Promise.all([
  writeJson(OUTPUT_PATH, normalized),
  writeJson(PRIVATE_MEDIA_PATH, privateMedia),
]);

console.log(
  JSON.stringify(
    {
      output: OUTPUT_PATH,
      privateMediaManifest: PRIVATE_MEDIA_PATH,
      ...normalized.summary,
      creditsCharged,
      reportedCreditsCharged,
      expectedCredits: EXPECTED_CREDITS,
    },
    null,
    2,
  ),
);
