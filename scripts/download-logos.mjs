import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { load } from "cheerio";
import sharp from "sharp";

const root = process.cwd();
const companiesPath = path.join(root, "public", "data", "companies.json");
const manifestPath = path.join(root, "public", "data", "logos.json");
const logosRoot = path.join(root, "public", "logos");
const concurrency = Math.max(
  1,
  Math.min(8, Number(process.env.LOGO_CONCURRENCY || 4)),
);
const retryFallbacks = process.argv.includes("--retry-fallbacks");
const requestedIds = new Set(
  (
    process.argv
      .find((argument) => argument.startsWith("--company-ids="))
      ?.split("=")[1] || ""
  )
    .split(",")
    .filter(Boolean),
);
const retrievedAt = new Date().toISOString();

const companies = JSON.parse(await fs.readFile(companiesPath, "utf8"));
let manifest = {};
try {
  manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
} catch {
  // A missing or unreadable manifest starts a fresh resumable audit.
}
await fs.mkdir(logosRoot, { recursive: true });

const isPrivateAddress = (address) => {
  if (!net.isIP(address)) return true;
  const value = address.toLowerCase();
  if (net.isIPv6(value)) {
    return (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe8") ||
      value.startsWith("fe9") ||
      value.startsWith("fea") ||
      value.startsWith("feb") ||
      value.startsWith("::ffff:127.") ||
      value.startsWith("::ffff:10.") ||
      value.startsWith("::ffff:192.168.")
    );
  }
  const octets = value.split(".").map(Number);
  return (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    octets[0] >= 224 ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
};

const assertPublicUrl = async (input) => {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("protocolo no permitido");
  if (url.username || url.password) throw new Error("credenciales incrustadas");
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("puerto no permitido");
  if (
    ["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())
  )
    throw new Error("host local");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  )
    throw new Error("destino de red privado");
  return url;
};

const readLimited = async (response, limit) => {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > limit) throw new Error("archivo demasiado grande");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("respuesta demasiado grande");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
};

const safeFetch = async (input, limit, accept, redirects = 0) => {
  if (redirects > 5) throw new Error("demasiadas redirecciones");
  const url = await assertPublicUrl(input);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
    headers: {
      "user-agent":
        "RedVitaliaRadar/1.0 (public brand identification research)",
      accept,
    },
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location)
      throw new Error(`redirección ${response.status} sin destino`);
    return safeFetch(new URL(location, url).href, limit, accept, redirects + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    response,
    buffer: await readLimited(response, limit),
    finalUrl: url.href,
  };
};

const cleanSource = (input) => {
  try {
    const url = new URL(input);
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/token|key|auth|signature|session|utm_|fbclid|gclid/i.test(key))
        url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
};

const resolveCandidate = (value, baseUrl) => {
  if (!value || /^data:/i.test(value)) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
};

const collectJsonLogos = (value, results = []) => {
  if (!value || typeof value !== "object") return results;
  for (const [key, nested] of Object.entries(value)) {
    if (key.toLowerCase() === "logo") {
      if (typeof nested === "string") results.push(nested);
      else if (nested && typeof nested === "object") {
        for (const candidateKey of ["url", "contentUrl", "@id"]) {
          if (typeof nested[candidateKey] === "string")
            results.push(nested[candidateKey]);
        }
      }
    }
    if (nested && typeof nested === "object") collectJsonLogos(nested, results);
  }
  return results;
};

const extractCandidates = async (website) => {
  const page = await safeFetch(
    website,
    3_000_000,
    "text/html,application/xhtml+xml;q=0.9,*/*;q=0.2",
  );
  const contentType = page.response.headers.get("content-type") || "";
  if (
    !contentType.includes("html") &&
    !page.buffer.subarray(0, 256).toString("utf8").includes("<")
  )
    throw new Error("la web no devolvió HTML");
  const html = page.buffer.toString("utf8");
  const $ = load(html);
  const candidates = [];
  const seen = new Set();
  const add = (raw, score, kind) => {
    const url = resolveCandidate(raw, page.finalUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const pageHost = new URL(page.finalUrl).hostname;
    const candidateHost = new URL(url).hostname;
    const tracedKind =
      /(^|\.)skool\.com$/i.test(pageHost) &&
      /(^|\.)assets\.skool\.com$/i.test(candidateHost)
        ? "platform"
        : kind;
    candidates.push({ url, score, kind: tracedKind });
  };

  for (const match of html.matchAll(
    /https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\/[^"'\s]+\/AppIcon[^"'\s]+\/1200x630wa\.(?:png|jpg)/gi,
  )) {
    add(
      match[0].replace(/\/1200x630wa\.(?:png|jpg)$/i, "/512x512bb.webp"),
      135,
      "platform",
    );
  }

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed = JSON.parse($(element).text());
      for (const logo of collectJsonLogos(parsed)) add(logo, 120, "official");
    } catch {
      // Malformed JSON-LD is ignored; the remaining official sources are tried.
    }
  });
  $('[itemprop="logo"]').each((_, element) =>
    add(
      $(element).attr("src") ||
        $(element).attr("href") ||
        $(element).attr("content"),
      112,
      "official",
    ),
  );
  $("img").each((_, element) => {
    const node = $(element);
    const signal = [
      node.attr("id"),
      node.attr("class"),
      node.attr("alt"),
      node.attr("data-testid"),
    ]
      .filter(Boolean)
      .join(" ");
    if (/logo|logotipo|brand|marca/i.test(signal))
      add(
        node.attr("src") || node.attr("data-src") || node.attr("data-lazy-src"),
        /header|navbar|site-logo|main-logo/i.test(signal) ? 108 : 98,
        "official",
      );
  });
  $(
    'link[rel~="apple-touch-icon"],link[rel~="icon"],link[rel="shortcut icon"]',
  ).each((_, element) =>
    add(
      $(element).attr("href"),
      $(element).attr("rel")?.includes("apple") ? 82 : 74,
      "favicon",
    ),
  );
  $('meta[name="msapplication-TileImage"],meta[property="og:logo"]').each(
    (_, element) => add($(element).attr("content"), 76, "favicon"),
  );

  const manifestUrl = resolveCandidate(
    $('link[rel="manifest"]').first().attr("href"),
    page.finalUrl,
  );
  if (manifestUrl) {
    try {
      const manifestResponse = await safeFetch(
        manifestUrl,
        600_000,
        "application/manifest+json,application/json,*/*;q=0.1",
      );
      const webManifest = JSON.parse(manifestResponse.buffer.toString("utf8"));
      for (const icon of webManifest.icons || [])
        add(
          resolveCandidate(icon.src, manifestResponse.finalUrl),
          icon.purpose?.includes("maskable") ? 92 : 86,
          "favicon",
        );
    } catch {
      // An invalid web manifest must not stop the remaining logo candidates.
    }
  }
  add("/favicon.ico", 45, "favicon");
  return candidates.sort((a, b) => b.score - a.score).slice(0, 14);
};

const storeCandidate = async (company, candidate) => {
  const image = await safeFetch(
    candidate.url,
    5_000_000,
    "image/avif,image/webp,image/svg+xml,image/png,image/jpeg,image/gif,image/x-icon,*/*;q=0.1",
  );
  const declaredType = image.response.headers.get("content-type") || "";
  if (
    declaredType.includes("text/html") ||
    image.buffer
      .subarray(0, 64)
      .toString("utf8")
      .match(/<!doctype|<html/i)
  )
    throw new Error("HTML disfrazado de imagen");
  const pipeline = sharp(image.buffer, {
    animated: false,
    density: 192,
    failOn: "warning",
  }).rotate();
  const input = await pipeline.metadata();
  if (!input.width || !input.height || input.width < 16 || input.height < 16)
    throw new Error("dimensiones insuficientes");
  if (input.width / input.height > 12 || input.height / input.width > 12)
    throw new Error("proporción no apta como identidad visual");
  const directory = path.join(logosRoot, company.id);
  const output = path.join(directory, "logo.webp");
  await fs.mkdir(directory, { recursive: true });
  const finalBuffer = await pipeline
    .resize({
      width: 512,
      height: 512,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88, alphaQuality: 95, effort: 4 })
    .toBuffer();
  const final = await sharp(finalBuffer).metadata();
  await fs.writeFile(output, finalBuffer);
  const source = cleanSource(image.finalUrl);
  return {
    file: `/logos/${company.id}/logo.webp`,
    status: candidate.kind,
    source,
    sourceHost: source ? new URL(source).hostname : null,
    checkedAt: retrievedAt,
    contentType: "image/webp",
    width: final.width || null,
    height: final.height || null,
    bytes: finalBuffer.length,
    sha256: crypto.createHash("sha256").update(finalBuffer).digest("hex"),
    confidence: candidate.kind === "official" ? "high" : "medium",
    isFallback: false,
    licenseNote:
      "Marca mostrada sin alteración material y únicamente para identificación; no implica afiliación.",
    reason: null,
  };
};

let saveQueue = Promise.resolve();
const saveManifest = () => {
  saveQueue = saveQueue.then(async () => {
    const ordered = Object.fromEntries(
      companies
        .filter((company) => manifest[company.id])
        .map((company) => [company.id, manifest[company.id]]),
    );
    await fs.writeFile(manifestPath, `${JSON.stringify(ordered)}\n`, "utf8");
  });
  return saveQueue;
};

const shouldSkip = async (company) => {
  const current = manifest[company.id];
  if (!current?.checkedAt) return false;
  if (current.file) {
    try {
      await fs.access(
        path.join(root, "public", current.file.replace(/^\//, "")),
      );
      return true;
    } catch {
      return false;
    }
  }
  return !retryFallbacks;
};

const inspectCompany = async (company) => {
  if (!requestedIds.has(company.id) && (await shouldSkip(company)))
    return { status: "skipped", company: company.name };
  let reason = "No se localizó una identidad visual pública verificable";
  try {
    const candidates = await extractCandidates(company.website);
    for (const candidate of candidates) {
      try {
        manifest[company.id] = await storeCandidate(company, candidate);
        await saveManifest();
        return { status: manifest[company.id].status, company: company.name };
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error);
      }
    }
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  }
  manifest[company.id] = {
    file: null,
    status: "fallback",
    source: cleanSource(company.website),
    sourceHost: (() => {
      try {
        return new URL(company.website).hostname;
      } catch {
        return null;
      }
    })(),
    checkedAt: retrievedAt,
    contentType: null,
    width: null,
    height: null,
    bytes: null,
    sha256: null,
    confidence: "fallback",
    isFallback: true,
    licenseNote: null,
    reason,
  };
  await saveManifest();
  return { status: "fallback", company: company.name };
};

let cursor = 0;
const counts = { official: 0, favicon: 0, fallback: 0, skipped: 0 };
const queue = requestedIds.size
  ? companies.filter((company) => requestedIds.has(company.id))
  : companies;
const worker = async () => {
  while (cursor < queue.length) {
    const index = cursor++;
    const result = await inspectCompany(queue[index]);
    counts[result.status] = (counts[result.status] || 0) + 1;
    console.log(
      `[${index + 1}/${queue.length}] ${result.status}: ${result.company}`,
    );
  }
};

await Promise.all(Array.from({ length: concurrency }, worker));
await saveQueue;
const finalValues = Object.values(manifest);
const logoAudit = {
  total: finalValues.length,
  official: finalValues.filter((item) => item.status === "official").length,
  favicon: finalValues.filter((item) => item.status === "favicon").length,
  platform: finalValues.filter((item) => item.status === "platform").length,
  authentic: finalValues.filter(
    (item) => item.file && item.status !== "fallback",
  ).length,
  fallback: finalValues.filter((item) => item.status === "fallback").length,
  coveragePercent: Number(
    (
      (finalValues.filter((item) => item.file && item.status !== "fallback")
        .length /
        finalValues.length) *
      100
    ).toFixed(1),
  ),
  locallyStored: true,
  hotlinked: 0,
  policy:
    "Solo activos públicos verificables; cuando no existen se muestran iniciales explícitas, nunca una marca inventada.",
  checkedAt: retrievedAt,
  resumed: counts.skipped,
};
const summaryPath = path.join(root, "public", "data", "summary.json");
const auditPath = path.join(root, "public", "data", "audit.json");
const summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));
const audit = JSON.parse(await fs.readFile(auditPath, "utf8"));
summary.logos = logoAudit;
audit.logoQuality = logoAudit;
await fs.writeFile(summaryPath, `${JSON.stringify(summary)}\n`, "utf8");
await fs.writeFile(auditPath, `${JSON.stringify(audit)}\n`, "utf8");
await fs.writeFile(
  path.join(root, "public", "data", "logo-quality.json"),
  `${JSON.stringify(logoAudit)}\n`,
  "utf8",
);
console.log(JSON.stringify(logoAudit, null, 2));
