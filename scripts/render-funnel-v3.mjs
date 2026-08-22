import { createRequire } from "node:module";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  try { return require("playwright"); } catch {
    const profile = process.env.USERPROFILE;
    if (!profile) throw new Error("Playwright no está disponible en este entorno.");
    return require(join(profile, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright"));
  }
}

const { chromium } = loadPlaywright();
const QUEUE_FILE = "research/deep/v3/queue.json";
const PUBLIC_COMPANIES = "public/data/companies.json";
const ID_MAP_FILE = "research/deep/public-id-map.json";
const OUTPUT_DIR = "research/deep/v3/rendered";
const SCREENSHOT_DIR = "research/deep/v3/screens";
const CHECKPOINT_DIR = "research/deep/v3/checkpoints";
const RENDERER_VERSION = "rv-funnel-renderer-v3.7";
const DEFAULT_TIMEOUT = 25_000;
const EVALUATION_TIMEOUT = 15_000;
const FRAME_EVALUATION_TIMEOUT = 7_000;
const SCREENSHOT_TIMEOUT = 15_000;

function withTimeout(promise, milliseconds, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} superó ${milliseconds} ms.`)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function parseArgs(argv) {
  const args = { limit: Infinity, concurrency: 2, pages: 8, retries: 3, only: [], onlyFile: null, screenshots: true, force: false, resume: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--limit") args.limit = Number(argv[++index] || Infinity);
    if (token === "--concurrency") args.concurrency = Math.max(1, Number(argv[++index] || 2));
    if (token === "--pages") args.pages = Math.max(1, Number(argv[++index] || 8));
    if (token === "--retries") args.retries = Math.max(1, Number(argv[++index] || 3));
    if (token === "--only") args.only = String(argv[++index] || "").split(",").filter(Boolean);
    if (token === "--only-file") args.onlyFile = String(argv[++index] || "") || null;
    if (token === "--no-screenshots") args.screenshots = false;
    if (token === "--force") args.force = true;
    if (token === "--resume") args.resume = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values, limit = Infinity) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function isUnsafeHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1"
    || host.endsWith(".local") || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function safeUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || isUnsafeHost(url.hostname)) return null;
    if (url.port && !["80", "443"].includes(url.port)) return null;
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(url.hostname) || /\.notion\.site$/i.test(url.hostname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid|msclkid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return null;
  }
}

function isResearchPage(value) {
  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();
    if (/(?:^|\/)(?:legal|privacy|privacidad|privacy-policy|politica-de-privacidad|cookies?|politica-de-cookies|aviso-legal|legal-notice|terms(?:-and-conditions)?|terms-of-(?:use|service)|impressum|datenschutz|mentions-legales)(?:\/|$|\.)/i.test(path)) return false;
    return !/\.(?:avif|bmp|css|eot|gif|ico|jpe?g|js|json|m4a|m4v|mov|mp3|mp4|mpeg|ogg|otf|png|rar|svg|tar|tiff?|ttf|txt|wav|webm|webp|woff2?|xml|zip)$/i.test(path);
  } catch {
    return false;
  }
}

function siteKey(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

function sameSite(left, right) {
  const a = siteKey(left);
  const b = siteKey(right);
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function isPublicFunnelDestination(value, officialUrl) {
  if (sameSite(value, officialUrl)) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const route = `${url.pathname}${url.search}`;
    if (/(?:^|\.)calendly\.com$/i.test(host)) return !/^\/?(?:blog|features|pricing|about)(?:\/|$)/i.test(url.pathname);
    if (/(?:^|\.)typeform\.com$/i.test(host)) return /\/(?:to|form|forms)\//i.test(url.pathname) || (!/^(?:www\.)?typeform\.com$/i.test(url.hostname) && /\/to\//i.test(url.pathname));
    if (/(?:^|\.)jotform\.com$/i.test(host)) return /\/(?:form|app|build)\/|\/\d{8,}/i.test(url.pathname);
    if (/(?:^|\.)(?:hsforms\.com|meetings\.hubspot\.com)$/i.test(host)) return true;
    if (/(?:^|\.)(?:leadconnectorhq\.com|gohighlevel\.com)$/i.test(host)) return /\/(?:widget|form|survey|book|appointment|calendar|payments?)\b/i.test(url.pathname);
    if (/(?:^|\.)tally\.so$/i.test(host)) return /\/(?:r|forms?)\//i.test(url.pathname);
    if (/(?:^|\.)acuityscheduling\.com$/i.test(host)) return /schedule|appointment|calendar|booking/i.test(route);
    if (/(?:^|\.)tidycal\.com$/i.test(host)) return url.pathname.replace(/\/+$/, "") !== "";
    if (/(?:^|\.)(?:zohopublic\.(?:com|eu)|forms\.zoho\.com)$/i.test(host)) return /form|survey|book|appointment/i.test(route);
    if (/(?:^|\.)(?:forms\.office\.com|forms\.microsoft\.com)$/i.test(host)) return true;
    return /(?:^|\.)docs\.google\.com$/i.test(host) && /\/forms\//i.test(url.pathname)
      || /(?:^|\.)forms\.gle$/i.test(host);
  } catch {
    return false;
  }
}

const routeSignals = [
  ["legal", /(?:legal|privacy|terms|cookies|privacidad|aviso-legal|impressum|datenschutz|mentions-legales)/i],
  ["pricing", /(?:pricing|prices?|cost|plans?|tarif|precio|preise|料金|価格|prezzi|prix)/i],
  ["conversion", /(?:contact|book|booking|schedule|demo|consult|audit|quote|estimate|apply|get-started|contacto|agenda|reserva|presupuesto|cotiza|contato|devis|consulta)/i],
  ["proof", /(?:case-stud|cases?|results?|success|testimonial|reviews?|clientes|casos|resultados|referen)/i],
  ["objections", /(?:faq|questions?|preguntas|help|guarantee|garant|refund|terms|contract)/i],
  ["offer", /(?:services?|solutions?|lead-generation|appointment|demand-generation|servicios|soluciones|leistungen|servizi)/i],
  ["team", /(?:about|company|team|nosotros|quienes-somos|empresa|equipe|uber-uns|chi-siamo)/i],
];

function classify(url, label = "") {
  const value = `${url} ${label}`;
  return routeSignals.find(([, regex]) => regex.test(value))?.[0] || "other";
}

function candidateScore(candidate) {
  const weights = { conversion: 100, pricing: 95, proof: 85, objections: 80, offer: 70, team: 35, legal: -200, other: 0 };
  let score = weights[candidate.category] || 0;
  if (/calendly|hubspot|typeform|jotform|forms?\./i.test(candidate.href)) score += 100;
  if (/\/blog\/|\/tag\/|\/author\//i.test(candidate.href)) score -= 80;
  if (new URL(candidate.href).pathname === "/") score += 30;
  return score;
}

function isRootUrl(value) {
  try { return new URL(value).pathname.replace(/\/+$/, "") === ""; } catch { return false; }
}

function takeNextCandidate(candidates, visited, pages) {
  const available = candidates.filter((candidate) => candidate?.href && isResearchPage(candidate.href) && !visited.has(candidate.href));
  if (!available.length) return null;
  if (!pages.length) return available.find((candidate) => isRootUrl(candidate.href)) || available[0];
  const covered = new Set(pages.map((page) => classify(page.url, page.title)));
  const desired = new Set(["conversion", "pricing", "proof", "objections", "offer", "team"]);
  return available.sort((left, right) => {
    const leftGap = desired.has(left.category) && !covered.has(left.category) ? 180 : 0;
    const rightGap = desired.has(right.category) && !covered.has(right.category) ? 180 : 0;
    return rightGap + candidateScore(right) - (leftGap + candidateScore(left));
  })[0];
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function readJsonOptional(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

function stageCounts(items, key) {
  return items.reduce((counts, item) => {
    const status = item[key]?.status || "missing";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function refreshQueue(queue) {
  queue.updatedAt = new Date().toISOString();
  queue.stats = {
    total: queue.items.length,
    research: stageCounts(queue.items, "research"),
    synthesis: stageCounts(queue.items, "synthesis"),
    notion: stageCounts(queue.items, "notion"),
    portal: stageCounts(queue.items, "portal"),
    qa: stageCounts(queue.items, "qa"),
  };
}

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
if (args.onlyFile) {
  const selection = JSON.parse(await readFile(args.onlyFile, "utf8"));
  const ids = Array.isArray(selection)
    ? selection
    : selection?.repair?.ids || selection?.ids || selection?.records?.map((row) => row.id) || [];
  args.only = unique([...args.only, ...ids.map(String)]);
  if (!args.only.length) throw new Error(`El archivo de selección no contiene IDs: ${args.onlyFile}`);
}
const publicCompanies = JSON.parse(await readFile(PUBLIC_COMPANIES, "utf8"));
const idMap = JSON.parse(await readFile(ID_MAP_FILE, "utf8")).ids || {};
const publicById = new Map(publicCompanies.map((company) => [company.id, company]));
let writeLock = Promise.resolve();
function persistQueue() {
  writeLock = writeLock.then(async () => {
    const latest = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
    const localById = new Map(queue.items.map((item) => [item.id, item]));
    queue.items = latest.items.map((item) => {
      const local = localById.get(item.id);
      return local ? { ...item, research: local.research, limitation: local.limitation } : item;
    });
    refreshQueue(queue);
    await writeJsonAtomic(QUEUE_FILE, queue);
  });
  return writeLock;
}

function extractSeedCandidates(item, sourceRecord, publicCompany) {
  const seed = safeUrl(item.website || sourceRecord?.website || sourceRecord?.seedUrl || publicCompany?.website || publicCompany?.domain);
  if (!seed) return [];
  const origin = safeUrl(new URL(seed).origin);
  const rows = [
    { href: origin, label: "Portada oficial" },
    { href: seed, label: "Sitio principal" },
    ...(sourceRecord?.sourceAudit?.recoveredPageUrls || []).map((href) => ({ href, label: "Página ya recuperada" })),
    ...(sourceRecord?.pages || []).map((page) => ({ href: page.url, label: page.title || "Página ya observada" })),
    ...((publicCompany?.sources || []).map((href) => ({ href, label: "Fuente pública" }))),
  ]
    .map((row) => ({ ...row, href: safeUrl(row.href, seed) }))
    .filter((row) => row.href && sameSite(row.href, seed))
    .map((row) => ({ ...row, category: classify(row.href, row.label) }));
  const seen = new Set();
  const deduped = rows.filter((row) => !seen.has(row.href) && seen.add(row.href));
  const root = deduped.find((row) => {
    try { return new URL(row.href).pathname.replace(/\/+$/, "") === ""; } catch { return false; }
  }) || deduped[0];
  return [root, ...deduped.filter((row) => row !== root).sort((a, b) => candidateScore(b) - candidateScore(a))];
}

function decodeXmlText(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
}

async function fetchPublicText(input, officialUrl, maximumBytes = 2_000_000) {
  let current = safeUrl(input, officialUrl);
  for (let redirect = 0; current && redirect < 5; redirect += 1) {
    if (!sameSite(current, officialUrl)) return null;
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/xml,text/xml,text/plain;q=0.9,*/*;q=0.2",
        "user-agent": "RedVitaliaResearch/1.0 (+public commercial funnel audit; GET only)",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status >= 300 && response.status < 400) {
      current = safeUrl(response.headers.get("location"), current);
      continue;
    }
    if (!response.ok) return null;
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > maximumBytes) return null;
    const text = await response.text();
    return { url: current, text: text.slice(0, maximumBytes) };
  }
  return null;
}

function sitemapLocations(xml, base) {
  return unique(
    [...String(xml || "").matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
      .map((match) => safeUrl(decodeXmlText(match[1]).trim(), base))
      .filter(Boolean),
    2_000,
  );
}

async function extractSitemapCandidates(officialUrl) {
  const origin = safeUrl(new URL(officialUrl).origin);
  if (!origin) return [];
  const sitemapUrls = [
    safeUrl("/sitemap.xml", origin),
    safeUrl("/sitemap_index.xml", origin),
    safeUrl("/wp-sitemap.xml", origin),
  ];
  try {
    const robots = await fetchPublicText(safeUrl("/robots.txt", origin), origin, 500_000);
    if (robots?.text) {
      for (const match of robots.text.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)) {
        const url = safeUrl(match[1], origin);
        if (url) sitemapUrls.unshift(url);
      }
    }
  } catch { /* sitemap discovery remains best effort */ }

  const pageUrls = [];
  const visitedSitemaps = new Set();
  for (const sitemapUrl of unique(sitemapUrls, 8)) {
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);
    try {
      const sitemap = await fetchPublicText(sitemapUrl, origin);
      if (!sitemap?.text) continue;
      const locations = sitemapLocations(sitemap.text, sitemap.url);
      const nested = locations.filter((url) => /(?:sitemap|\.xml(?:$|\?))/i.test(new URL(url).pathname));
      pageUrls.push(...locations.filter((url) => !nested.includes(url)));
      for (const nestedUrl of nested.slice(0, 8)) {
        if (visitedSitemaps.has(nestedUrl)) continue;
        visitedSitemaps.add(nestedUrl);
        try {
          const child = await fetchPublicText(nestedUrl, origin);
          if (child?.text) pageUrls.push(...sitemapLocations(child.text, child.url));
        } catch { /* a missing child sitemap is a documented discovery limit */ }
      }
    } catch { /* a site may block or omit its sitemap */ }
  }

  const seen = new Set();
  return pageUrls
    .map((href) => ({ href: safeUrl(href, origin), label: "Ruta comercial recuperada del sitemap" }))
    .filter((row) => row.href && sameSite(row.href, origin) && isResearchPage(row.href))
    .map((row) => ({ ...row, category: classify(row.href, row.label) }))
    .filter((row) => row.category !== "other" && !seen.has(row.href) && seen.add(row.href))
    .sort((left, right) => candidateScore(right) - candidateScore(left))
    .slice(0, 120);
}

async function chromeExecutable() {
  const candidates = unique([
    process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe") : null,
    process.env["PROGRAMFILES(X86)"] ? join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe") : null,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : null,
  ]);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* continue */ }
  }
  return undefined;
}

async function analyzePage(page, initialUrl, item, index, officialUrl) {
  const networkHosts = new Set();
  const networkListener = (request) => {
    try { networkHosts.add(new URL(request.url()).hostname.toLowerCase()); } catch { /* ignore */ }
  };
  page.on("request", networkListener);
  try {
    const response = await page.goto(initialUrl, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
    await page.waitForTimeout(1_200);
    const finalUrl = safeUrl(page.url());
    if (!finalUrl || !sameSite(finalUrl, initialUrl)) throw new Error("La navegación salió del sitio oficial.");
    const sourceRelation = sameSite(finalUrl, officialUrl) ? "official_site" : "external_funnel_destination";
    await withTimeout(page.evaluate(async () => {
      document.querySelectorAll("details").forEach((node) => { node.open = true; });
      const expandable = [...document.querySelectorAll('[aria-expanded="false"][aria-controls]')]
        .filter((node) => !node.closest("form") && /faq|pregunta|question|precio|pricing|plan|servicio|service|proceso|process|cómo|how|caso|result|testimonial/i.test(`${node.textContent || ""} ${node.getAttribute("aria-label") || ""}`))
        .slice(0, 30);
      expandable.forEach((node) => node.click());
      window.scrollTo(0, document.body?.scrollHeight || 0);
      await new Promise((resolve) => setTimeout(resolve, 450));
      window.scrollTo(0, 0);
    }), EVALUATION_TIMEOUT, "La expansión y el scroll de la página");
    await page.waitForTimeout(450);
    const extracted = await withTimeout(page.evaluate(() => {
      const tidy = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const visible = (element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      const text = (element) => tidy(element?.innerText || element?.textContent || element?.getAttribute?.("aria-label") || "");
      const labelFor = (field) => {
        const id = field.getAttribute("id");
        const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        const wrapping = field.closest("label");
        return text(explicit || wrapping);
      };
      const links = [...document.querySelectorAll("a[href]")].filter(visible).map((node) => ({
        text: text(node).slice(0, 240),
        href: node.href,
        ariaLabel: tidy(node.getAttribute("aria-label")),
      }));
      const buttons = [...document.querySelectorAll("button,[role=button],input[type=submit],input[type=button]")].filter(visible).map((node) => ({
        text: (text(node) || node.getAttribute("value") || "").slice(0, 240),
        type: node.getAttribute("type") || node.getAttribute("role") || node.tagName.toLowerCase(),
        ariaLabel: tidy(node.getAttribute("aria-label")),
      }));
      const fieldData = (field) => ({
        tag: field.tagName.toLowerCase(),
        type: (field.getAttribute("type") || field.tagName).toLowerCase(),
        name: tidy(field.getAttribute("name")),
        label: labelFor(field).slice(0, 300),
        placeholder: tidy(field.getAttribute("placeholder")).slice(0, 300),
        required: field.required || field.getAttribute("aria-required") === "true",
        autocomplete: tidy(field.getAttribute("autocomplete")),
        inputMode: tidy(field.getAttribute("inputmode")),
        pattern: tidy(field.getAttribute("pattern")).slice(0, 300),
        minimum: tidy(field.getAttribute("min")),
        maximum: tidy(field.getAttribute("max")),
        multiple: field.hasAttribute("multiple"),
        options: field.tagName === "SELECT" ? [...field.options].map((option) => tidy(option.textContent)).filter(Boolean).slice(0, 60) : [],
      });
      const forms = [...document.querySelectorAll("form")].filter(visible).map((form) => {
        const fields = [...form.querySelectorAll("input,select,textarea")].filter((field) => {
          const type = (field.getAttribute("type") || field.tagName).toLowerCase();
          return !["hidden", "submit", "button", "image", "reset"].includes(type) && visible(field);
        }).map(fieldData);
        return {
          action: form.action,
          method: (form.method || "get").toUpperCase(),
          fields,
          visibleFieldCount: fields.length,
          requiredFieldCount: fields.filter((field) => field.required).length,
          submitLabels: [...form.querySelectorAll("button,input[type=submit]")].map((node) => text(node) || tidy(node.getAttribute("value"))).filter(Boolean).slice(0, 12),
          consentText: [...form.querySelectorAll("label,.consent,.privacy,.terms")].map(text).filter((value) => /consent|privacy|privacidad|terms|acepto|agree|datos/i.test(value)).slice(0, 12),
        };
      });
      const orphanFields = [...document.querySelectorAll("input,select,textarea")].filter((field) => {
        const type = (field.getAttribute("type") || field.tagName).toLowerCase();
        return !field.closest("form") && !["hidden", "submit", "button", "image", "reset", "search"].includes(type) && visible(field);
      }).map(fieldData);
      if (orphanFields.length) {
        forms.push({
          action: null,
          method: null,
          fields: orphanFields,
          visibleFieldCount: orphanFields.length,
          requiredFieldCount: orphanFields.filter((field) => field.required).length,
          submitLabels: buttons.filter((button) => /send|submit|enviar|solicitar|reserv|book|contact|continuar|next|siguiente/i.test(`${button.text} ${button.ariaLabel}`)).map((button) => button.text || button.ariaLabel).slice(0, 12),
          consentText: [],
          inferredContainer: "controles visibles fuera de una etiqueta form",
        });
      }
      const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => tidy(node.textContent).slice(0, 12_000)).filter(Boolean).slice(0, 12);
      return {
        title: tidy(document.title),
        language: document.documentElement.lang || null,
        description: tidy(document.querySelector('meta[name="description"]')?.content),
        canonical: document.querySelector('link[rel="canonical"]')?.href || null,
        headings: [...document.querySelectorAll("h1,h2,h3")].filter(visible).map((node) => ({ level: node.tagName.toLowerCase(), text: text(node).slice(0, 500) })).filter((row) => row.text).slice(0, 120),
        links: links.slice(0, 800),
        buttons: buttons.slice(0, 200),
        forms,
        iframes: [...document.querySelectorAll("iframe[src]")].map((node) => node.src).filter(Boolean).slice(0, 80),
        scripts: [...document.scripts].map((node) => node.src).filter(Boolean).slice(0, 250),
        jsonLd,
        visibleText: tidy(document.body?.innerText).slice(0, 60_000),
      };
    }), EVALUATION_TIMEOUT, "La extracción del DOM público");
    const embeddedFrames = [];
    const inspectableFrames = page.frames().slice(1)
      .filter((frame) => {
        const frameUrl = safeUrl(frame.url());
        return frameUrl && isPublicFunnelDestination(frameUrl, finalUrl);
      })
      .slice(0, 6);
    for (const frame of inspectableFrames) {
      const frameUrl = safeUrl(frame.url());
      if (!frameUrl) continue;
      try {
        const frameData = await withTimeout(frame.evaluate(() => {
          const tidy = (value) => String(value || "").replace(/\s+/g, " ").trim();
          const visible = (element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
          };
          const text = (element) => tidy(element?.innerText || element?.textContent || element?.getAttribute?.("aria-label") || "");
          const labelFor = (field) => {
            const id = field.getAttribute("id");
            const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
            return text(explicit || field.closest("label"));
          };
          const fieldData = (field) => ({
            tag: field.tagName.toLowerCase(),
            type: (field.getAttribute("type") || field.tagName).toLowerCase(),
            name: tidy(field.getAttribute("name")),
            label: labelFor(field).slice(0, 300),
            placeholder: tidy(field.getAttribute("placeholder")).slice(0, 300),
            required: field.required || field.getAttribute("aria-required") === "true",
            autocomplete: tidy(field.getAttribute("autocomplete")),
            inputMode: tidy(field.getAttribute("inputmode")),
            pattern: tidy(field.getAttribute("pattern")).slice(0, 300),
            minimum: tidy(field.getAttribute("min")),
            maximum: tidy(field.getAttribute("max")),
            multiple: field.hasAttribute("multiple"),
            options: field.tagName === "SELECT" ? [...field.options].map((option) => tidy(option.textContent)).filter(Boolean).slice(0, 60) : [],
          });
          const forms = [...document.querySelectorAll("form")].filter(visible).map((form) => {
            const fields = [...form.querySelectorAll("input,select,textarea")].filter((field) => {
              const type = (field.getAttribute("type") || field.tagName).toLowerCase();
              return !["hidden", "submit", "button", "image", "reset"].includes(type) && visible(field);
            }).map(fieldData);
            return {
              action: form.action,
              method: (form.method || "get").toUpperCase(),
              fields,
              visibleFieldCount: fields.length,
              requiredFieldCount: fields.filter((field) => field.required).length,
              submitLabels: [...form.querySelectorAll("button,input[type=submit]")].map((node) => text(node) || tidy(node.getAttribute("value"))).filter(Boolean).slice(0, 12),
              consentText: [...form.querySelectorAll("label,.consent,.privacy,.terms")].map(text).filter((value) => /consent|privacy|privacidad|terms|acepto|agree|datos/i.test(value)).slice(0, 12),
            };
          });
          const orphanFields = [...document.querySelectorAll("input,select,textarea")].filter((field) => {
            const type = (field.getAttribute("type") || field.tagName).toLowerCase();
            return !field.closest("form") && !["hidden", "submit", "button", "image", "reset", "search"].includes(type) && visible(field);
          }).map(fieldData);
          if (orphanFields.length) {
            forms.push({
              action: null,
              method: null,
              fields: orphanFields,
              visibleFieldCount: orphanFields.length,
              requiredFieldCount: orphanFields.filter((field) => field.required).length,
              submitLabels: [...document.querySelectorAll("button,[role=button],input[type=submit],input[type=button]")].filter(visible).map((node) => text(node) || tidy(node.getAttribute("value"))).filter((value) => /send|submit|enviar|solicitar|reserv|book|contact|continuar|next|siguiente/i.test(value)).slice(0, 12),
              consentText: [],
              inferredContainer: "controles visibles fuera de una etiqueta form",
            });
          }
          return {
            title: tidy(document.title),
            language: document.documentElement.lang || null,
            headings: [...document.querySelectorAll("h1,h2,h3")].filter(visible).map((node) => ({ level: node.tagName.toLowerCase(), text: text(node).slice(0, 500) })).filter((row) => row.text).slice(0, 80),
            buttons: [...document.querySelectorAll("button,[role=button],input[type=submit],input[type=button]")].filter(visible).map((node) => ({ text: (text(node) || node.getAttribute("value") || "").slice(0, 240), type: node.getAttribute("type") || node.getAttribute("role") || node.tagName.toLowerCase() })).slice(0, 120),
            forms,
            stepSignals: [...document.querySelectorAll('[aria-current="step"],[data-step],.step,.progress')].filter(visible).map(text).filter(Boolean).slice(0, 30),
            visibleText: tidy(document.body?.innerText).slice(0, 30_000),
          };
        }), FRAME_EVALUATION_TIMEOUT, "La inspección del iframe público");
        if (frameData.forms.length || frameData.buttons.length || frameData.visibleText.length >= 40) embeddedFrames.push({ url: frameUrl, ...frameData });
      } catch { /* cross-origin or detached frame without readable public DOM */ }
    }
    extracted.embeddedFrames = embeddedFrames;
    let screenshot = null;
    if (args.screenshots && index < 2 && extracted.visibleText.length >= 80) {
      const path = `${SCREENSHOT_DIR}/${item.id}/${String(index + 1).padStart(2, "0")}.webp`;
      await mkdir(dirname(path), { recursive: true });
      await page.screenshot({ path, type: "webp", quality: 78, fullPage: false, animations: "disabled", caret: "hide", timeout: SCREENSHOT_TIMEOUT });
      screenshot = path;
    }
    const internalLinks = sourceRelation === "official_site" ? extracted.links
      .map((row) => ({ href: safeUrl(row.href, finalUrl), label: row.text || row.ariaLabel }))
      .filter((row) => row.href && isResearchPage(row.href) && isPublicFunnelDestination(row.href, finalUrl))
      .map((row) => ({ ...row, category: classify(row.href, row.label) })) : [];
    return {
      url: finalUrl,
      requestedUrl: initialUrl,
      status: response?.status() || null,
      capturedAt: new Date().toISOString(),
      sourceRelation,
      ...extracted,
      networkHosts: [...networkHosts].sort(),
      screenshot,
      internalLinks,
    };
  } finally {
    page.off("request", networkListener);
  }
}

async function renderCompany(browser, item) {
  let sourceRecord = null;
  try { sourceRecord = JSON.parse(await readFile(item.sourceRecord, "utf8")); } catch { sourceRecord = null; }
  const portalId = idMap[item.id];
  const publicCompany = publicById.get(portalId);
  const seedCandidates = extractSeedCandidates(item, sourceRecord, publicCompany);
  if (!seedCandidates.length) throw new Error("No existe una URL oficial pública utilizable.");
  const sitemapCandidates = await extractSitemapCandidates(seedCandidates[0].href);
  const checkpointPath = `${CHECKPOINT_DIR}/${item.id}.json`;
  const priorCheckpoint = args.resume ? await readJsonOptional(checkpointPath) : null;
  const resumable = priorCheckpoint?.rendererVersion === RENDERER_VERSION && priorCheckpoint?.complete === false
    ? priorCheckpoint
    : null;
  const context = await browser.newContext({
    locale: "es-ES",
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
    javaScriptEnabled: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT);
  page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
  await page.route("**/*", async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    const url = safeUrl(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.abort();
    if (!url || ["media", "font"].includes(resourceType)) return route.abort();
    return route.continue();
  });
  const candidates = [...seedCandidates, ...sitemapCandidates, ...(resumable?.candidates || [])];
  const visited = new Set(resumable?.visited || []);
  const pages = Array.isArray(resumable?.pages) ? resumable.pages : [];
  const errors = Array.isArray(resumable?.errors) ? resumable.errors : [];
  console.log(`[resume] ${item.name}: ${pages.length}/${args.pages} página(s), ${visited.size} visitada(s), ${candidates.length} candidata(s)`);
  const maximumAttempts = args.pages + 6;
  let consecutiveErrors = Number(resumable?.consecutiveErrors || 0);
  const saveCheckpoint = async () => writeJsonAtomic(checkpointPath, {
    rendererVersion: RENDERER_VERSION,
    complete: false,
    recordId: item.id,
    portalId,
    name: item.name,
    website: seedCandidates[0]?.href || item.website,
    updatedAt: new Date().toISOString(),
    pages,
    errors,
    candidates: candidates.filter((row) => row?.href && !visited.has(row.href)),
    visited: [...visited],
    consecutiveErrors,
  });
  try {
    while (candidates.length && pages.length < args.pages && visited.size < maximumAttempts) {
      const candidate = takeNextCandidate(candidates, visited, pages);
      if (!candidate) break;
      candidates.splice(candidates.indexOf(candidate), 1);
      if (!candidate.href || visited.has(candidate.href)) continue;
      visited.add(candidate.href);
      console.log(`[attempt] ${item.name}: ${visited.size}/${maximumAttempts} ${candidate.href}`);
      try {
        const result = await analyzePage(page, candidate.href, item, pages.length, seedCandidates[0].href);
        if (!pages.some((row) => row.url === result.url)) pages.push(result);
        consecutiveErrors = 0;
        for (const link of result.internalLinks) {
          if (!visited.has(link.href) && link.category !== "other") candidates.push(link);
        }
      } catch (error) {
        consecutiveErrors += 1;
        errors.push({ url: candidate.href, error: clean(error?.message || error) });
      }
      await saveCheckpoint();
      console.log(`[checkpoint] ${item.name}: ${pages.length}/${args.pages} página(s), ${visited.size}/${maximumAttempts} intento(s), ${errors.length} error(es)`);
      if ((!pages.length && consecutiveErrors >= 4) || consecutiveErrors >= 6) break;
    }
  } finally {
    console.log(`[context-close] ${item.name}`);
    await withTimeout(context.close(), 20_000, "El cierre del contexto del navegador").catch(() => undefined);
  }
  console.log(`[company-ready] ${item.name}: ${pages.length} página(s), ${errors.length} error(es)`);
  return {
    schemaVersion: "rv-funnel-rendered-evidence-v3",
    rendererVersion: RENDERER_VERSION,
    recordId: item.id,
    portalId,
    name: item.name,
    website: seedCandidates[0]?.href || item.website,
    capturedAt: new Date().toISOString(),
    policy: { publicGetOnly: true, formsSubmitted: false, accountsCreated: false, companyContacted: false },
    pages,
    errors,
    limitations: [
      "La captura renderizó páginas públicas sin pulsar CTA, enviar formularios ni crear cuentas.",
      "Las etapas privadas posteriores a la captura no son observables.",
      ...(pages.length ? [] : ["No se obtuvo una página renderizada utilizable; requiere fuente alternativa o revisión visual manual."]),
    ],
  };
}

const staleCutoff = Date.now() - 45 * 60 * 1000;
for (const item of queue.items) {
  if (item.research?.status === "in_progress" && (!item.research.updatedAt || Date.parse(item.research.updatedAt) < staleCutoff)) {
    item.research.status = "pending";
    item.research.error = "Reanudado tras una captura interrumpida.";
  }
}
await persistQueue();

const selected = queue.items
  .filter((item) => item.scope !== "Excluir — fuente/no negocio")
  .filter((item) => !args.only.length || args.only.includes(item.id) || args.only.includes(item.name))
  .filter((item) => !(args.resume && item.research?.rendererVersion === RENDERER_VERSION && ["render_complete", "limited"].includes(item.research?.status)))
  .filter((item) => args.force || ["pending", "failed", "evidence_ready"].includes(item.research?.status))
  .filter((item) => args.force || (item.research?.attempts || 0) < args.retries)
  .slice(0, Number.isFinite(args.limit) ? args.limit : undefined);

const executablePath = await chromeExecutable();
const browser = await chromium.launch({ headless: true, executablePath, args: ["--disable-background-networking", "--disable-component-update"] });
let cursor = 0;
let completed = 0;
async function worker(workerId) {
  while (true) {
    const item = selected[cursor++];
    if (!item) return;
    item.research = { status: "in_progress", attempts: (item.research?.attempts || 0) + 1, updatedAt: new Date().toISOString(), error: null, rendererVersion: RENDERER_VERSION };
    await persistQueue();
    try {
      const result = await renderCompany(browser, item);
      await writeJsonAtomic(`${OUTPUT_DIR}/${item.id}.json`, result);
      item.research = {
        status: result.pages.length ? "render_complete" : "limited",
        attempts: item.research.attempts,
        updatedAt: new Date().toISOString(),
        error: result.pages.length ? null : result.errors.map((row) => `${row.url}: ${row.error}`).join(" | ").slice(0, 4_000),
        rendererVersion: RENDERER_VERSION,
      };
      item.limitation = result.pages.length ? null : result.limitations.join(" ");
      await writeJsonAtomic(`${CHECKPOINT_DIR}/${item.id}.json`, {
        rendererVersion: RENDERER_VERSION,
        complete: true,
        recordId: item.id,
        completedAt: item.research.updatedAt,
        pages: result.pages.length,
        errors: result.errors.length,
      });
    } catch (error) {
      item.research = { status: "failed", attempts: item.research.attempts, updatedAt: new Date().toISOString(), error: clean(error?.message || error), rendererVersion: RENDERER_VERSION };
    }
    completed += 1;
    await persistQueue();
    console.log(`[${completed}/${selected.length}] W${workerId} ${item.name}: ${item.research.status}`);
  }
}

try {
  await Promise.all(Array.from({ length: Math.min(args.concurrency, selected.length || 1) }, (_, index) => worker(index + 1)));
} finally {
  await browser.close();
  await persistQueue();
}
console.log(JSON.stringify({ selected: selected.length, completed, stats: queue.stats.research }, null, 2));
