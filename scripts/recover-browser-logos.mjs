import crypto from "node:crypto";
import dns from "node:dns/promises";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import net from "node:net";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import sharp from "sharp";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const profile = process.env.USERPROFILE;
    if (!profile) throw new Error("Playwright no está disponible.");
    return require(
      join(
        profile,
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "node",
        "node_modules",
        "playwright",
      ),
    );
  }
}

const { chromium } = loadPlaywright();
const COMPANIES_FILE = "public/data/companies-index.json";
const LOGOS_FILE = "public/data/logos.json";
const SUMMARY_FILE = "public/data/summary.json";
const AUDIT_FILE = "public/data/audit.json";
const QUALITY_FILE = "public/data/logo-quality.json";
const LOGOS_DIR = "public/logos";
const checkedAt = new Date().toISOString();

async function chromeExecutable() {
  const candidates = [
    process.env.PROGRAMFILES
      ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe")
      : null,
    process.env["PROGRAMFILES(X86)"]
      ? join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe")
      : null,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
      : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue with the next installed Chrome location.
    }
  }
  return undefined;
}

function parseArgs(argv) {
  const args = { concurrency: 3, limit: Infinity, ids: new Set() };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--concurrency")
      args.concurrency = Math.max(1, Math.min(5, Number(argv[++index] || 3)));
    if (token === "--limit") args.limit = Math.max(1, Number(argv[++index] || 1));
    if (token === "--only")
      args.ids = new Set(String(argv[++index] || "").split(",").filter(Boolean));
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

function isPrivateAddress(address) {
  if (!net.isIP(address)) return true;
  const value = address.toLowerCase();
  if (net.isIPv6(value)) {
    return (
      value === "::" ||
      value === "::1" ||
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
}

const hostChecks = new Map();
async function isPublicUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (url.port && !["80", "443"].includes(url.port)) return false;
    const host = url.hostname.toLowerCase();
    if (["localhost", "localhost.localdomain"].includes(host)) return false;
    if (!hostChecks.has(host)) {
      hostChecks.set(
        host,
        dns
          .lookup(host, { all: true })
          .then(
            (rows) =>
              rows.length > 0 && rows.every(({ address }) => !isPrivateAddress(address)),
          )
          .catch(() => false),
      );
    }
    return await hostChecks.get(host);
  } catch {
    return false;
  }
}

function cleanSource(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
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
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporary, path);
}

function qualityFromManifest(manifest) {
  const rows = Object.values(manifest);
  const authentic = rows.filter((item) => item.file && item.status !== "fallback").length;
  return {
    total: rows.length,
    official: rows.filter((item) => item.status === "official").length,
    favicon: rows.filter((item) => item.status === "favicon").length,
    platform: rows.filter((item) => item.status === "platform").length,
    authentic,
    fallback: rows.filter((item) => item.status === "fallback").length,
    coveragePercent: Number(((authentic / rows.length) * 100).toFixed(1)),
    locallyStored: true,
    hotlinked: 0,
    policy:
      "Solo activos públicos verificables; cuando no existen se muestran iniciales explícitas, nunca una marca inventada.",
    checkedAt,
    browserRecovery: true,
  };
}

const companies = JSON.parse(await readFile(COMPANIES_FILE, "utf8"));
const manifest = JSON.parse(await readFile(LOGOS_FILE, "utf8"));
const candidates = companies
  .filter((company) => manifest[company.id]?.status === "fallback")
  .filter((company) => !args.ids.size || args.ids.has(company.id))
  .slice(0, Number.isFinite(args.limit) ? args.limit : undefined);

const executablePath = await chromeExecutable();
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--disable-background-networking", "--disable-component-update"],
});
let cursor = 0;
let saveLock = Promise.resolve();
const counts = { recovered: 0, fallback: 0, error: 0 };

function persistManifest() {
  saveLock = saveLock.then(() => writeJsonAtomic(LOGOS_FILE, manifest));
  return saveLock;
}

async function captureCandidate(page) {
  const rows = await page.locator("img, svg").evaluateAll((nodes) =>
    nodes
      .map((node, index) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const parent = node.closest("header, nav, [role='banner']");
        const link = node.closest("a");
        const signal = [
          node.id,
          node.getAttribute("class"),
          node.getAttribute("alt"),
          node.getAttribute("aria-label"),
          node.getAttribute("itemprop"),
          node.getAttribute("data-testid"),
          node.getAttribute("src"),
          node.getAttribute("href"),
        ]
          .filter(Boolean)
          .join(" ");
        let score = 0;
        if (/\b(?:logo|logotipo|brand|marca)\b/i.test(signal)) score += 170;
        if ((node.getAttribute("itemprop") || "").toLowerCase() === "logo") score += 80;
        if (parent) score += 70;
        if (rect.top >= -10 && rect.top < 320) score += 35;
        if (link && /^(?:\/|\.\/|#)?$/.test(link.getAttribute("href") || "")) score += 25;
        if (node.tagName.toLowerCase() === "svg") score += 12;
        if (/client|partner|payment|testimonial|review|cookie|captcha|award/i.test(signal)) score -= 180;
        if (rect.width < 16 || rect.height < 16 || rect.width / rect.height > 12 || rect.height / rect.width > 12)
          score -= 300;
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)
          score -= 300;
        return {
          index,
          score,
          width: rect.width,
          height: rect.height,
          source:
            node.currentSrc ||
            node.getAttribute("src") ||
            node.getAttribute("href") ||
            window.location.href,
        };
      })
      .filter((row) => row.score >= 120)
      .sort((left, right) => right.score - left.score),
  );
  for (const row of rows.slice(0, 12)) {
    const locator = page.locator("img, svg").nth(row.index);
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 3_000 });
      const png = await locator.screenshot({ type: "png", omitBackground: true, timeout: 8_000 });
      const image = sharp(png).rotate();
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width < 16 || metadata.height < 16) continue;
      if (metadata.width / metadata.height > 12 || metadata.height / metadata.width > 12) continue;
      const webp = await image
        .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 90, alphaQuality: 96, effort: 4 })
        .toBuffer();
      if (webp.length < 220) continue;
      const final = await sharp(webp).metadata();
      return { webp, final, source: cleanSource(row.source) || cleanSource(page.url()), score: row.score };
    } catch {
      // A detached or protected element is skipped in favour of the next candidate.
    }
  }
  return null;
}

async function inspectCompany(context, company) {
  const page = await context.newPage();
  await page.route("**/*", async (route) => {
    const request = route.request();
    const type = request.resourceType();
    if (["media", "font"].includes(type)) return route.abort();
    if (!(await isPublicUrl(request.url()))) return route.abort();
    return route.continue();
  });
  try {
    if (!(await isPublicUrl(company.website))) throw new Error("URL no pública o no resoluble");
    await page.goto(company.website, { waitUntil: "domcontentloaded", timeout: 28_000 });
    await page.waitForTimeout(1_200);
    const captured = await captureCandidate(page);
    if (!captured) throw new Error("sin elemento de marca renderizable inequívoco");
    const directory = join(LOGOS_DIR, company.id);
    const output = join(directory, "logo.webp");
    await mkdir(directory, { recursive: true });
    await writeFile(output, captured.webp);
    manifest[company.id] = {
      file: `/logos/${company.id}/logo.webp`,
      status: "official",
      source: captured.source,
      sourceHost: captured.source ? new URL(captured.source).hostname : null,
      checkedAt,
      contentType: "image/webp",
      width: captured.final.width || null,
      height: captured.final.height || null,
      bytes: captured.webp.length,
      sha256: crypto.createHash("sha256").update(captured.webp).digest("hex"),
      confidence: captured.score >= 220 ? "high" : "medium",
      isFallback: false,
      licenseNote:
        "Marca mostrada sin alteración material y únicamente para identificación; no implica afiliación.",
      reason: null,
      recoveryMethod: "captura del elemento de marca renderizado en la web oficial",
    };
    counts.recovered += 1;
    await persistManifest();
    return "recovered";
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const prior = manifest[company.id]?.reason;
    manifest[company.id] = {
      ...manifest[company.id],
      checkedAt,
      reason: [prior, `navegador: ${reason}`].filter(Boolean).join(" · ").slice(0, 600),
    };
    counts.fallback += 1;
    await persistManifest();
    return "fallback";
  } finally {
    await page.close().catch(() => {});
  }
}

async function worker(index) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: "es-ES",
    userAgent: `RedVitalia competitive research browser/${index + 1}`,
  });
  try {
    while (cursor < candidates.length) {
      const position = cursor++;
      const company = candidates[position];
      const status = await inspectCompany(context, company);
      console.log(`[${position + 1}/${candidates.length}] ${status}: ${company.name}`);
    }
  } finally {
    await context.close().catch(() => {});
  }
}

try {
  await Promise.all(Array.from({ length: Math.min(args.concurrency, candidates.length || 1) }, (_, index) => worker(index)));
  await saveLock;
} finally {
  await browser.close().catch(() => {});
}

const quality = qualityFromManifest(manifest);
const [summary, audit] = await Promise.all([
  readFile(SUMMARY_FILE, "utf8").then(JSON.parse),
  readFile(AUDIT_FILE, "utf8").then(JSON.parse),
]);
summary.logos = quality;
audit.logoQuality = quality;
await Promise.all([
  writeJsonAtomic(SUMMARY_FILE, summary),
  writeJsonAtomic(AUDIT_FILE, audit),
  writeJsonAtomic(QUALITY_FILE, quality),
]);

console.log(JSON.stringify({ candidates: candidates.length, ...counts, quality }, null, 2));
