import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const IMAGE_FORMATS = {
  jpeg: { format: "jpeg", extension: "jpg", type: "image/jpeg" },
  png: { format: "png", extension: "png", type: "image/png" },
  webp: { format: "webp", extension: "webp", type: "image/webp" },
};
const TEXT_EXCERPT_LIMIT = 3_600;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const safePublicUrl = (value) => {
  try {
    const url = new URL(clean(value));
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || url.port && !["80", "443"].includes(url.port)) return null;
    if (
      host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" ||
      /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    ) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid|msclkid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
};

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const temporary = `${path}.${nonce}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rename(temporary, path);
      return;
    } catch (error) {
      if (!["EPERM", "EACCES", "EBUSY"].includes(error?.code) || attempt === 7) throw error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, 25 * (attempt + 1)));
    }
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function jpegDimensions(buffer) {
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (startOfFrame.has(marker) && length >= 7) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(buffer) {
  if (buffer.length < 30) return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8 " && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && buffer[20] === 0x2f) {
    const packed = buffer.readUInt32LE(21);
    return {
      width: 1 + (packed & 0x3fff),
      height: 1 + (packed >>> 14 & 0x3fff),
    };
  }
  return null;
}

function rasterMetadata(bytes) {
  const buffer = Buffer.from(bytes);
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  ) {
    return {
      ...IMAGE_FORMATS.png,
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  if (buffer.length >= 10 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const dimensions = jpegDimensions(buffer);
    return dimensions ? { ...IMAGE_FORMATS.jpeg, ...dimensions } : null;
  }
  if (buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const dimensions = webpDimensions(buffer);
    return dimensions ? { ...IMAGE_FORMATS.webp, ...dimensions } : null;
  }
  return null;
}

function publicPath(path, rootDir) {
  return `/${resolve(path).slice(resolve(rootDir, "public").length + 1).replaceAll("\\", "/")}`;
}

async function dismissCookieLayer(tab) {
  const patterns = [
    /rechazar(?: todas)?|solo necesarias|continuar sin aceptar/i,
    /refuser(?: tout)?|continuer sans accepter/i,
    /reject(?: all)?|only necessary|decline/i,
  ];
  for (const pattern of patterns) {
    try {
      const button = tab.playwright.getByRole("button", { name: pattern }).first();
      if (await button.count() && await button.isVisible()) {
        await button.click({ timeoutMs: 1_500 });
        await tab.playwright.waitForTimeout(250);
        return "rejected";
      }
    } catch {
      // Los banners cambian con frecuencia; la captura continúa sin interacción.
    }
  }
  return "not_observed";
}

async function prepareLongPage(tab) {
  return tab.playwright.evaluate(async () => {
    const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
    const viewport = Math.max(600, window.innerHeight || 800);
    let previousHeight = 0;
    let stable = 0;
    for (let pass = 0; pass < 28; pass += 1) {
      const height = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0,
      );
      const next = Math.min(height, pass * Math.round(viewport * 0.82));
      window.scrollTo({ top: next, behavior: "auto" });
      await wait(120);
      const currentHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0,
      );
      stable = currentHeight === previousHeight ? stable + 1 : 0;
      previousHeight = currentHeight;
      if (next >= currentHeight - viewport && stable >= 2) break;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    await wait(180);
    return {
      width: Math.max(document.documentElement?.scrollWidth || 0, window.innerWidth || 0),
      height: Math.max(document.documentElement?.scrollHeight || 0, document.body?.scrollHeight || 0),
      viewportWidth: window.innerWidth || 0,
      viewportHeight: window.innerHeight || 0,
    };
  }, undefined, { timeoutMs: 12_000 });
}

async function extractVisiblePage(tab) {
  return tab.playwright.evaluate(({ excerptLimit }) => {
    const tidy = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const safeVisibleText = () => {
      const excluded = "form,input,textarea,select,option,script,style,noscript,template,iframe,svg,[contenteditable=true],[aria-hidden=true],[hidden]";
      // The browser-client evaluation realm exposes querySelectorAll reliably,
      // but not TreeWalker on every remote document. Read semantic copy blocks
      // instead; this also avoids collecting user-entered form values.
      const blocks = [...document.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,figcaption,dt,dd")]
        .filter((element) => !element.closest(excluded) && visible(element))
        .map((element) => tidy(element.textContent))
        .filter(Boolean);
      return tidy([...new Set(blocks)].join(" "));
    };
    const truncate = (value) => {
      if (value.length <= excerptLimit) return value;
      const candidate = value.slice(0, excerptLimit - 1);
      const boundary = candidate.lastIndexOf(" ");
      const end = boundary > excerptLimit * 0.78 ? boundary : candidate.length;
      return `${candidate.slice(0, end).trim()}…`;
    };
    const headings = [...document.querySelectorAll("h1,h2,h3")]
      .filter(visible)
      .map((node) => tidy(node.textContent))
      .filter(Boolean)
      .slice(0, 36);
    const ctas = [...document.querySelectorAll("a,button,[role=button],input[type=submit]")]
      .filter(visible)
      .map((node) => tidy(node.textContent || node.getAttribute("value") || node.getAttribute("aria-label")))
      .filter((text) => text && text.length <= 160)
      .slice(0, 40);
    const visibleText = safeVisibleText();
    return {
      language: tidy(document.documentElement.lang) || null,
      h1: headings[0] || null,
      headings: [...new Set(headings)],
      ctas: [...new Set(ctas)],
      excerpt: truncate(visibleText),
      visibleText: visibleText.slice(0, 12_000),
    };
  }, { excerptLimit: TEXT_EXCERPT_LIMIT }, { timeoutMs: 8_000 });
}

function blockedReason(title, text, url) {
  const haystack = `${title} ${text.slice(0, 2_000)} ${url}`;
  if (/captcha|verify you are human|verifica que eres humano|vérifiez que vous êtes humain/i.test(haystack)) return "captcha";
  if (/access denied|forbidden|error 403|bloqueado|blocked|un moment|just a moment/i.test(haystack)) return "blocked";
  if (/(?:error|erreur)\s*404|404\s*(?:error|erreur)|page not found|página no encontrada|page introuvable/i.test(haystack)) return "not_found";
  if (/(?:error|erreur)\s*(?:500|502|503|504)|(?:500|502|503|504)\s*(?:error|erreur)|internal server error|service unavailable/i.test(haystack)) return "server_error";
  return null;
}

async function saveCapture(bytes, rootDir, record, pageRow) {
  const evidenceDir = join(rootDir, "public", "evidence", record.id);
  await mkdir(evidenceDir, { recursive: true });
  const pageKey = createHash("sha256")
    .update(`${pageRow.id || "page"}|${pageRow.requestedUrl || ""}`)
    .digest("hex")
    .slice(0, 10);
  const base = `site-${pageKey}-${String(pageRow.role || "page").replace(/[^a-z0-9-]/gi, "-").slice(0, 24)}`;
  const buffer = Buffer.from(bytes);
  const metadata = rasterMetadata(buffer);
  if (!metadata?.width || !metadata?.height) {
    throw new Error("Formato o dimensiones de captura no compatibles.");
  }
  const fullPath = join(evidenceDir, `${base}.capture.${metadata.extension}`);
  await writeFile(fullPath, buffer);
  const fullInfo = await stat(fullPath);
  return {
    image: {
      file: publicPath(fullPath, rootDir),
      type: metadata.type,
      width: metadata.width,
      height: metadata.height,
      bytes: fullInfo.size,
      sha256: await sha256(fullPath),
    },
    thumbnail: null,
  };
}

async function captureLongPageFromViewports(tab, geometry) {
  const viewportHeight = Math.max(1, Math.round(Number(geometry.viewportHeight) || 0));
  const documentHeight = Math.max(viewportHeight, Math.round(Number(geometry.height) || viewportHeight));
  if (!viewportHeight) throw new Error("El navegador no informó del alto de la ventana.");

  const positions = [];
  for (let top = 0; top < documentHeight; top += viewportHeight) positions.push(top);
  const finalTop = Math.max(0, documentHeight - viewportHeight);
  if (positions.at(-1) !== finalTop) positions.push(finalTop);

  const segments = [];
  for (const requestedTop of [...new Set(positions)]) {
    const actualTop = await tab.playwright.evaluate(({ top }) => {
      window.scrollTo({ top, behavior: "auto" });
      return Math.max(0, Math.round(window.scrollY || document.documentElement?.scrollTop || 0));
    }, { top: requestedTop }, { timeoutMs: 4_000 });
    await tab.playwright.waitForTimeout(120);
    const bytes = Buffer.from(await tab.screenshot({ fullPage: false }));
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Un tramo de la captura no tiene dimensiones válidas.");
    segments.push({ top: actualTop, bytes, width: metadata.width, height: metadata.height });
  }
  await tab.playwright.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }), undefined, { timeoutMs: 4_000 });

  if (!segments.length) throw new Error("El navegador no devolvió ningún tramo de la página.");
  const width = Math.min(...segments.map((segment) => segment.width));
  const height = Math.max(1, Math.min(documentHeight, Math.max(...segments.map((segment) => segment.top + segment.height))));
  const layers = [];
  for (const segment of segments) {
    const layerHeight = Math.min(segment.height, height - segment.top);
    if (layerHeight <= 0) continue;
    const input = await sharp(segment.bytes)
      .extract({ left: 0, top: 0, width, height: layerHeight })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    layers.push({ input, left: 0, top: segment.top });
  }
  return sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite(layers)
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

async function capturePage(tab, rootDir, record, pageRow) {
  const requestedUrl = safePublicUrl(pageRow.requestedUrl);
  if (!requestedUrl) {
    return { ...pageRow, status: "failed", issue: "URL pública no válida." };
  }
  try {
    await tab.goto(requestedUrl);
    await tab.playwright.waitForTimeout(900);
    const cookieAction = await dismissCookieLayer(tab);
    const geometry = await prepareLongPage(tab);
    const text = await extractVisiblePage(tab);
    const [finalUrlRaw, title] = await Promise.all([tab.url(), tab.title()]);
    const finalUrl = safePublicUrl(finalUrlRaw) || requestedUrl;
    const issue = blockedReason(title || "", text.visibleText || "", finalUrl);
    let bytes;
    let captureMethod = "native_full_page";
    let nativeCaptureIssue = null;
    try {
      bytes = await tab.screenshot({ fullPage: true });
    } catch (error) {
      nativeCaptureIssue = clean(error?.message || error).slice(0, 300) || "La captura nativa completa falló.";
      captureMethod = "stitched_viewports";
      try {
        bytes = await captureLongPageFromViewports(tab, geometry);
      } catch (fallbackError) {
        return {
          ...pageRow,
          requestedUrl,
          finalUrl,
          title: clean(title) || text.h1 || pageRow.label || null,
          status: "failed",
          issue: clean(fallbackError?.message || fallbackError).slice(0, 600) || "No se pudo guardar la captura.",
          nativeCaptureIssue,
          capturedAt: new Date().toISOString(),
          fullPage: false,
          captureMethod: "text_only_after_image_failure",
          viewport: { width: geometry.viewportWidth, height: geometry.viewportHeight },
          document: { width: geometry.width, height: geometry.height },
          cookieAction,
          image: null,
          thumbnail: null,
          text: {
            language: text.language,
            h1: text.h1,
            headings: text.headings,
            ctas: text.ctas,
            excerpt: text.excerpt || null,
          },
        };
      }
    }
    const saved = await saveCapture(bytes, rootDir, record, pageRow);
    return {
      ...pageRow,
      requestedUrl,
      finalUrl,
      title: clean(title) || text.h1 || pageRow.label || null,
      status: issue ? "blocked" : "captured",
      issue,
      capturedAt: new Date().toISOString(),
      fullPage: true,
      captureMethod,
      nativeCaptureIssue,
      viewport: { width: geometry.viewportWidth, height: geometry.viewportHeight },
      document: { width: geometry.width, height: geometry.height },
      cookieAction,
      image: saved.image,
      thumbnail: saved.thumbnail,
      text: {
        language: text.language,
        h1: text.h1,
        headings: text.headings,
        ctas: text.ctas,
        excerpt: text.excerpt || null,
      },
    };
  } catch (error) {
    return {
      ...pageRow,
      requestedUrl,
      status: "failed",
      issue: clean(error?.message || error).slice(0, 600) || "No se pudo capturar la página.",
      capturedAt: new Date().toISOString(),
    };
  }
}

async function manifestFiles(rootDir) {
  const directory = join(rootDir, "public", "data", "site-captures");
  const names = await readdir(directory);
  return names.filter((name) => name.endsWith(".json") && name !== "index.json").map((name) => join(directory, name));
}

function refreshRecord(record) {
  const pages = Array.isArray(record.pages) ? record.pages : [];
  const captured = pages.filter((page) => page.status === "captured").length;
  const blocked = pages.filter((page) => page.status === "blocked").length;
  const failed = pages.filter((page) => page.status === "failed").length;
  const planned = pages.length;
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    status: record.status === "no_url" ? "no_url"
      : captured === planned && planned ? "complete"
        : captured || blocked ? "partial"
          : failed === planned && planned ? "failed"
            : "pending",
    coverage: { planned, captured, blocked, failed },
  };
}

async function refreshIndex(rootDir) {
  const files = await manifestFiles(rootDir);
  const records = await Promise.all(files.map(readJson));
  records.sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
  const index = {
    schemaVersion: "rv-site-captures-index-v1",
    generatedAt: new Date().toISOString(),
    stats: {
      records: records.length,
      complete: records.filter((record) => record.status === "complete").length,
      partial: records.filter((record) => record.status === "partial").length,
      pending: records.filter((record) => record.status === "pending").length,
      noUrl: records.filter((record) => record.status === "no_url").length,
      pages: records.reduce((sum, record) => sum + (record.pages?.length || 0), 0),
      captured: records.reduce((sum, record) => sum + (record.coverage?.captured || 0), 0),
      blocked: records.reduce((sum, record) => sum + (record.coverage?.blocked || 0), 0),
      failed: records.reduce((sum, record) => sum + (record.coverage?.failed || 0), 0),
    },
    records: records.map((record) => ({
      id: record.id,
      name: record.name,
      primaryCountry: record.primaryCountry,
      status: record.status,
      coverage: record.coverage,
    })),
  };
  await writeJsonAtomic(join(rootDir, "public", "data", "site-captures", "index.json"), index);
  return index;
}

/**
 * Captura páginas públicas usando exclusivamente el navegador proporcionado por
 * browser-client. No envía formularios, no crea cuentas y no contacta empresas.
 */
export async function captureSitePages({
  browser,
  rootDir = process.cwd(),
  ids = [],
  limit = 12,
  maxPagesPerRecord = 3,
  concurrency = 2,
  pageTimeoutMs = 40_000,
  force = false,
} = {}) {
  if (!browser?.tabs?.new) throw new Error("Falta una instancia de navegador compatible.");
  const files = await manifestFiles(rootDir);
  const wanted = new Set((ids || []).map(String));
  const candidates = [];
  for (const file of files) {
    const record = await readJson(file);
    if (wanted.size && !wanted.has(record.id)) continue;
    const actionable = (record.pages || []).slice(0, maxPagesPerRecord).some((page) =>
      safePublicUrl(page.requestedUrl) && (force || !["captured", "blocked", "failed"].includes(page.status)),
    );
    if (actionable) candidates.push({ file, record });
  }
  candidates.sort((left, right) => {
    const country = (left.record.primaryCountry === "Francia" ? -1 : 0) - (right.record.primaryCountry === "Francia" ? -1 : 0);
    return country || String(left.record.name).localeCompare(String(right.record.name), "es");
  });
  const selected = candidates.slice(0, Math.max(0, Number(limit) || 0));
  const tasks = [];
  for (const current of selected) {
    current.writeChain = Promise.resolve();
    for (let pageIndex = 0; pageIndex < (current.record.pages || []).length; pageIndex += 1) {
      if (pageIndex >= maxPagesPerRecord) break;
      const page = current.record.pages[pageIndex];
      if (
        safePublicUrl(page.requestedUrl) &&
        (force || !["captured", "blocked", "failed"].includes(page.status))
      ) {
        tasks.push({ current, pageIndex });
      }
    }
  }
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length || 1)) }, async () => {
    let tab = await browser.tabs.new();
    try {
      while (cursor < tasks.length) {
        const task = tasks[cursor++];
        const { current, pageIndex } = task;
        const pageRow = current.record.pages[pageIndex];
        let timeoutHandle;
        const outcome = await Promise.race([
          capturePage(tab, rootDir, current.record, pageRow).then((page) => ({ page, timedOut: false })),
          new Promise((resolveTimeout) => {
            timeoutHandle = setTimeout(
              () => resolveTimeout({ page: null, timedOut: true }),
              Math.max(10_000, Number(pageTimeoutMs) || 40_000),
            );
          }),
        ]);
        clearTimeout(timeoutHandle);
        if (outcome.timedOut) {
          // Closing the tab aborts a navigation or screenshot that stopped
          // responding. A fresh tab keeps the rest of the batch independent.
          await Promise.race([
            tab.close().catch(() => {}),
            new Promise((resolveClose) => setTimeout(resolveClose, 2_000)),
          ]);
          tab = await browser.tabs.new();
          current.record.pages[pageIndex] = {
            ...pageRow,
            status: "failed",
            issue: `La página no respondió en ${Math.round(Math.max(10_000, Number(pageTimeoutMs) || 40_000) / 1_000)} segundos.`,
            capturedAt: new Date().toISOString(),
          };
        } else {
          current.record.pages[pageIndex] = outcome.page;
          // Una navegacion fallida de Chromium puede dejar la pestana en una
          // pagina interna `data:`. Browser Use bloquea correctamente navegar
          // desde ese origen y, sin aislarlo, el primer DNS caido haria fallar
          // en cascada todas las URLs siguientes. Cada fallo recibe por tanto
          // una pestana limpia y no contamina el resto del lote.
          if (outcome.page?.status === "failed") {
            await Promise.race([
              tab.close().catch(() => {}),
              new Promise((resolveClose) => setTimeout(resolveClose, 2_000)),
            ]);
            tab = await browser.tabs.new();
          }
        }
        // Persist after every page. If a long batch is interrupted, completed
        // captures remain available and the next run resumes the pending pages.
        current.writeChain = current.writeChain.then(() =>
          writeJsonAtomic(current.file, refreshRecord(current.record)),
        );
        await current.writeChain;
      }
    } finally {
      await tab?.close().catch(() => {});
    }
  });
  await Promise.all(workers);
  await Promise.all(selected.map((current) => current.writeChain));
  const results = selected.map((current) => {
    const refreshed = refreshRecord(current.record);
    return {
      id: refreshed.id,
      name: refreshed.name,
      status: refreshed.status,
      coverage: refreshed.coverage,
    };
  });
  const index = await refreshIndex(rootDir);
  return { selected: selected.length, results, stats: index.stats };
}

export async function markPendingPagesFailed({
  rootDir = process.cwd(),
  ids = [],
  issue = "La página agotó el tiempo de captura en intentos repetidos.",
} = {}) {
  const wanted = new Set((ids || []).map(String));
  if (!wanted.size) return { records: 0, pages: 0, stats: (await refreshIndex(rootDir)).stats };
  let records = 0;
  let pages = 0;
  for (const file of await manifestFiles(rootDir)) {
    const record = await readJson(file);
    if (!wanted.has(record.id)) continue;
    let changed = false;
    record.pages = (record.pages || []).map((page) => {
      if (!["pending", null, undefined].includes(page.status)) return page;
      changed = true;
      pages += 1;
      return {
        ...page,
        status: "failed",
        issue: clean(issue).slice(0, 600),
        capturedAt: new Date().toISOString(),
        technicalFailure: true,
      };
    });
    if (changed) {
      records += 1;
      await writeJsonAtomic(file, refreshRecord(record));
    }
  }
  const index = await refreshIndex(rootDir);
  return { records, pages, stats: index.stats };
}

export { rasterMetadata, refreshIndex };
