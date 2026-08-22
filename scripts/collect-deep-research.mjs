import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import * as cheerio from "cheerio";

const QUEUE_FILE = "research/deep/queue.json";
const COMPANIES_FILE = "public/data/companies.json";
const USER_AGENT = "RedVitaliaMarketResearch/1.0 (+https://redvitalia.srv1480016.hstgr.cloud/)";
const DEFAULT_TIMEOUT = 15_000;
const MAX_BYTES = 2_500_000;

function parseArgs(argv) {
  const args = { limit: Infinity, concurrency: 5, pages: 7, retries: 3, only: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--limit") args.limit = Number(argv[++index] || Infinity);
    if (token === "--concurrency") args.concurrency = Math.max(1, Number(argv[++index] || 5));
    if (token === "--pages") args.pages = Math.max(1, Number(argv[++index] || 7));
    if (token === "--retries") args.retries = Math.max(1, Number(argv[++index] || 3));
    if (token === "--only") args.only = String(argv[++index] || "").split(",").filter(Boolean);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const companies = JSON.parse(await readFile(COMPANIES_FILE, "utf8"));
const companyById = new Map(companies.map((company) => [company.id, company]));
const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
let stopping = false;
let writeLock = Promise.resolve();

function stageCounts(stage) {
  return queue.items.reduce((counts, item) => {
    const value = item[stage].status;
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function refreshStats() {
  queue.updatedAt = new Date().toISOString();
  queue.stats = {
    total: queue.items.length,
    collect: stageCounts("collect"),
    review: stageCounts("review"),
    notion: stageCounts("notion"),
    portal: stageCounts("portal"),
    qa: stageCounts("qa"),
  };
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function persistQueue() {
  refreshStats();
  writeLock = writeLock.then(() => writeJsonAtomic(QUEUE_FILE, queue));
  return writeLock;
}

process.once("SIGINT", () => {
  stopping = true;
  console.log("Interrupción recibida: se cerrará tras guardar el trabajo activo.");
});
process.once("SIGTERM", () => {
  stopping = true;
});

function isUnsafeHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "localhost"
    || host.endsWith(".local")
    || host === "0.0.0.0"
    || host === "127.0.0.1"
    || host === "::1"
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^169\.254\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function safeUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password || isUnsafeHost(url.hostname)) return null;
    if (url.port && !["80", "443"].includes(url.port)) return null;
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(url.hostname) || /\.notion\.site$/i.test(url.hostname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|msclkid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
}

function extractPublicUrls(value) {
  const text = Array.isArray(value) ? value.join("\n") : String(value || "");
  const matches = text.match(/https?:\/\/(?:(?!\s|<|>|"|'|\[|\]|\(|\)).)+/g) || [];
  return [...new Set(matches.map((candidate) => safeUrl(candidate)).filter(Boolean))];
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shortEvidence(value, maxWords = 22, maxChars = 240) {
  const text = cleanText(value);
  if (!text) return "";
  const words = text.split(" ").slice(0, maxWords).join(" ");
  return words.length > maxChars ? `${words.slice(0, maxChars - 1).trim()}…` : words;
}

function unique(values, limit = Infinity) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

const lastHostRequest = new Map();
async function rateLimit(url) {
  const host = new URL(url).hostname;
  const last = lastHostRequest.get(host) || 0;
  const wait = Math.max(0, 450 - (Date.now() - last));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastHostRequest.set(host, Date.now());
}

async function readLimitedBody(response, maxBytes = MAX_BYTES) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`Respuesta demasiado grande (${declared} bytes)`);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error(`Respuesta supera ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function fetchText(initialUrl, { timeout = DEFAULT_TIMEOUT, maxBytes = MAX_BYTES } = {}) {
  let current = safeUrl(initialUrl);
  if (!current) throw new Error("URL pública no válida");
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await rateLimit(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.2",
          "accept-language": "es,en;q=0.9,*;q=0.5",
        },
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        const redirected = safeUrl(response.headers.get("location"), current);
        if (!redirected) throw new Error("Redirección a URL no permitida");
        current = redirected;
        continue;
      }
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!/(?:text|html|xml|json|javascript)/i.test(contentType)) throw new Error(`Contenido no textual: ${contentType || "desconocido"}`);
      const text = await readLimitedBody(response, maxBytes);
      return { url: current, status: response.status, contentType, text };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Demasiadas redirecciones");
}

const robotsCache = new Map();
function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}`);
}

function parseRobots(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  const sitemaps = [];
  const commit = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (rules.length) commit();
      agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && agents.length) {
      if (value) rules.push({ type: key, path: value, regex: globToRegex(value) });
    } else if (key === "sitemap") {
      const url = safeUrl(value);
      if (url) sitemaps.push(url);
    }
  }
  commit();
  const applicable = groups.filter((group) => group.agents.some((agent) => agent === "*" || USER_AGENT.toLowerCase().includes(agent)));
  return { rules: applicable.flatMap((group) => group.rules), sitemaps: unique(sitemaps, 5) };
}

async function robotsFor(url) {
  const origin = new URL(url).origin;
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const task = (async () => {
    try {
      const response = await fetchText(`${origin}/robots.txt`, { timeout: 8_000, maxBytes: 300_000 });
      return { ...parseRobots(response.text), url: response.url, available: true };
    } catch (error) {
      return { rules: [], sitemaps: [], url: `${origin}/robots.txt`, available: false, error: String(error.message || error) };
    }
  })();
  robotsCache.set(origin, task);
  return task;
}

function robotsAllows(url, robots) {
  const parsed = new URL(url);
  const target = `${parsed.pathname}${parsed.search}`;
  const matches = robots.rules.filter((rule) => rule.regex.test(target)).sort((a, b) => b.path.length - a.path.length);
  return !matches.length || matches[0].type !== "disallow";
}

const LINK_CATEGORIES = [
  ["pricing", /(?:pricing|price|prices|cost|tarif|precio|precios|preise|料金|価格|plan)/i],
  ["conversion", /(?:contact|book|booking|demo|consult|audit|quote|proposal|estimate|apply|start|get-started|contacto|reserva|agenda|presupuesto|cotiza|consulta|contato|devis|termin)/i],
  ["proof", /(?:case|cases|results|success|testimonial|reviews|clientes|casos|resultados|témoignage|referen)/i],
  ["offer", /(?:service|services|solution|lead-generation|appointment|demand-generation|servicios|soluciones|leistungen|servizi|サービス)/i],
  ["objections", /(?:faq|frequently|questions|preguntas|preguntas-frecuentes|help|guarantee|garant|refund)/i],
  ["team", /(?:about|company|team|nosotros|quienes-somos|empresa|equipe|uber-uns|chi-siamo)/i],
];

function classifyLink(url, label = "") {
  const haystack = `${new URL(url).pathname} ${label}`;
  for (const [category, pattern] of LINK_CATEGORIES) if (pattern.test(haystack)) return category;
  return "other";
}

function linkScore(url, label = "") {
  const category = classifyLink(url, label);
  const categoryScore = { conversion: 100, pricing: 95, proof: 90, offer: 85, objections: 80, team: 60, other: 10 }[category];
  const depth = new URL(url).pathname.split("/").filter(Boolean).length;
  return categoryScore - Math.min(depth, 8);
}

const TECHNOLOGIES = [
  ["Google Tag Manager", /googletagmanager\.com|gtm\.js/i],
  ["Google Analytics", /google-analytics\.com|gtag\(|google analytics/i],
  ["Google Ads", /googleadservices\.com|aw-[0-9]{5,}/i],
  ["Meta Pixel", /connect\.facebook\.net|fbq\(/i],
  ["LinkedIn Insight", /snap\.licdn\.com|_linkedin_partner_id/i],
  ["Microsoft Clarity", /clarity\.ms|clarity\(/i],
  ["Hotjar", /hotjar\.com|hj\(/i],
  ["HubSpot", /hubspot|hsforms|hs-script/i],
  ["Salesforce / Pardot", /salesforce|pardot|pi\.pardot/i],
  ["Marketo", /marketo|munchkin/i],
  ["GoHighLevel", /leadconnectorhq|gohighlevel|msgsndr/i],
  ["ActiveCampaign", /activecampaign|trackcmp/i],
  ["Mailchimp", /mailchimp|list-manage\.com/i],
  ["Klaviyo", /klaviyo/i],
  ["Calendly", /calendly/i],
  ["Cal.com", /cal\.com/i],
  ["Typeform", /typeform/i],
  ["Tally", /tally\.so/i],
  ["Jotform", /jotform/i],
  ["Gravity Forms", /gform_wrapper|gravityforms/i],
  ["Intercom", /intercom/i],
  ["Drift", /drift\.com|driftt/i],
  ["Crisp", /crisp\.chat|\$crisp/i],
  ["Tidio", /tidio/i],
  ["WhatsApp", /wa\.me|api\.whatsapp|whatsapp/i],
  ["WordPress", /wp-content|wp-includes/i],
  ["Webflow", /webflow/i],
  ["Wix", /wixstatic|wix-code/i],
  ["Squarespace", /squarespace/i],
  ["Shopify", /cdn\.shopify|shopify/i],
  ["Unbounce", /unbouncepages|unbounce/i],
  ["Instapage", /instapage/i],
];

function detectTechnologies(resourceMarkup, inlineScriptMarkup) {
  const markup = `${resourceMarkup} ${inlineScriptMarkup}`;
  return TECHNOLOGIES.filter(([, pattern]) => pattern.test(markup)).map(([name]) => name);
}

const SIGNALS = {
  price: /(?:[$€£¥₹₩₽₺₦₫₱฿₪₾]|円|원|د\.?إ|ر\.?س|\b(?:USD|EUR|GBP|AED|JPY|CAD|AUD|CHF|INR|MXN|BRL|PLN|SAR|QAR|PKR|GEL|KRW|CNY|RMB|KZT|NGN|ZAR|SGD|MYR|IDR|VND|THB|PHP|EGP|MAD|TRY)\b).{0,45}\d|\d.{0,25}(?:[$€£¥₹₩₽₺₦₫₱฿₪₾]|円|원|د\.?إ|ر\.?س|\b(?:USD|EUR|GBP|AED|JPY|CAD|AUD|CHF|INR|MXN|BRL|PLN|SAR|QAR|PKR|GEL|KRW|CNY|RMB|KZT|NGN|ZAR|SGD|MYR|IDR|VND|THB|PHP|EGP|MAD|TRY)\b)/,
  guarantee: /(?:guarantee|guaranteed|refund|money.back|risk.free|garantía|garantizado|devolución|sin riesgo|garantie|rembours|garantia|保証|返金|보장|환불|ضمان|استرداد|გარანტია|თანხის დაბრუნება|гарантия|возврат)/i,
  proof: /(?:case stud|testimonial|success stor|results|clients|customers|review|rating|casos de éxito|testimonios|resultados|clientes|reseñas|avis clients|referenzen|導入事例|お客様の声|実績|成功事例|고객 사례|후기|성과|آراء العملاء|نتائج|دراسة حالة|მომხმარებელთა შეფასებები|შედეგები|отзывы|результаты|кейсы)/i,
  urgency: /(?:limited|today|now|spots?|deadline|last chance|ahora|hoy|plazas?|limitad|última oportunidad|maintenant|places limitées|限定|今すぐ|本日|마감|오늘|지금|لفترة محدودة|اليوم|الآن|შეზღუდული|დღეს|сегодня|сейчас|ограничен)/i,
  leadMagnet: /(?:free guide|download|ebook|checklist|template|calculator|assessment|audit|health check|guía gratis|descargar|plantilla|calculadora|diagnóstico|auditoría gratuita|livre blanc|無料ガイド|資料請求|ダウンロード|무료 가이드|다운로드|دليل مجاني|تحميل|უფასო გზამკვლევი|ჩამოტვირთვა|бесплатн.{0,12}(?:гайд|аудит)|скачать)/i,
  objection: /(?:faq|frequently asked|questions|why us|what if|how long|cancel|contract|commitment|preguntas frecuentes|por qué|qué pasa si|cuánto tarda|cancelar|permanencia|sans engagement|よくある質問|解約|契約期間|자주 묻는 질문|취소|계약|الأسئلة الشائعة|إلغاء|عقد|ხშირად დასმული კითხვები|გაუქმება|договор|отмена|частые вопросы)/i,
};

function sentenceSnippets(text, pattern, limit = 6) {
  return unique(
    String(text || "")
      .split(/(?<=[.!?。！？])\s+|\n+/)
      .map(cleanText)
      .filter((sentence) => sentence.length >= 12 && sentence.length <= 500 && pattern.test(sentence))
      .map((sentence) => {
        const match = sentence.match(pattern);
        if (!match || match.index == null || sentence.length <= 360) return shortEvidence(sentence, 45, 360);
        const start = Math.max(0, match.index - 120);
        const end = Math.min(sentence.length, match.index + match[0].length + 180);
        return `${start ? "…" : ""}${sentence.slice(start, end).trim()}${end < sentence.length ? "…" : ""}`;
      }),
    limit,
  );
}

function absoluteUrl(value, base) {
  return safeUrl(value, base);
}

function classifyForm(form, pageUrl) {
  const visible = (form.fields || []).filter((field) => !field.hidden);
  const marker = cleanText([
    pageUrl,
    form.action,
    form.submitText,
    ...visible.flatMap((field) => [field.type, field.name, field.label, field.placeholder]),
  ].filter(Boolean).join(" ")).toLowerCase();
  const contactFields = visible.filter((field) => /email|e-mail|mail|phone|tel|mobile|whatsapp|name|nombre|nom|company|empresa|message|mensaje|budget|presupuesto|website|sitio|url|textarea/i.test(`${field.type} ${field.name || ""} ${field.label || ""} ${field.placeholder || ""}`));
  const hasEmail = visible.some((field) => field.type === "email" || /email|e-mail|correo|mail/i.test(`${field.name || ""} ${field.label || ""} ${field.placeholder || ""}`));
  const hasPassword = visible.some((field) => field.type === "password");
  const searchOnly = visible.length <= 3
    && visible.length > 0
    && visible.every((field) => field.type === "search" || /^(?:q|s|query|search|keyword)$/i.test(field.name || "") || /search|buscar|rechercher|suche|検索/i.test(field.placeholder || ""));
  if (!visible.length) return "empty";
  if (hasPassword || /(?:\/|\b)(?:login|log-in|signin|sign-in|auth|account)(?:\/|\b)/i.test(marker)) return "login";
  if (searchOnly || /(?:\/|\b)(?:site-?search|search)(?:\/|\b)/i.test(`${form.action || ""} ${form.submitText || ""}`)) return "search";
  const paymentRoute = /\/(?:checkout|cart|payment|pay-now|buy-now)(?:[/?#]|$)|stripepay|razorpay|paypal/i.test(form.action || "");
  const paymentSubmit = /^(?:buy(?: now)?|purchase(?: now)?|pay(?: now)?|checkout|add to cart|comprar(?: ahora)?|pagar(?: ahora)?|finalizar compra|proceder al pago|beli|購入|支払|결제|شراء|ادفع)(?:\b|\s|$)/i.test(form.submitText || "");
  if (paymentRoute || paymentSubmit) return "checkout";
  if (/(?:calendly|cal\.com|hubspot.*meetings|savvycal|acuity|setmore|youcanbook|schedule|booking|book-a|agenda|reserva)/i.test(`${form.action || ""} ${form.submitText || ""}`)) return "booking";
  if (hasEmail && /newsletter|subscribe|suscrib|bolet[ií]n|updates|inscrivez|abonn|tagchimp|mailchimp/i.test(marker)) return "newsletter";
  if (visible.length >= 3 && /(?:add[_-]?company|add[_-]?business|list[_-]?business|register[_-]?business|claim[_-]?(?:business|listing)|join[_-]?(?:as[_-])?(?:provider|pro|professional)|partners?|vendors?|suppliers?|for-pros|earn)/i.test(marker)) return "listing";
  if (form.method === "GET" && !contactFields.length && /filter|filtro|category|categor[ií]a|location|ubicaci[oó]n|postcode|zip|sort|price|min|max|keyword/i.test(marker)) return "filter";
  if (contactFields.length >= 2 || (contactFields.length && form.submitText) || /quote|presupuesto|cotiza|consult|demo|apply|solicita|request|send|enviar|submit|whatsapp/i.test(form.submitText || "")) return "commercial";
  return "unknown";
}

function isContentPath(url) {
  return /\/(?:blog|article|articles|resources|resource|guides?|news|academy|glossary|help)(?:\/|$)/i.test(new URL(url).pathname);
}

function isRootPath(url) {
  return !new URL(url).pathname.split("/").filter(Boolean).length;
}

function analyzePage(html, url, status, contentType) {
  const $ = cheerio.load(html);
  const language = cleanText($("html").attr("lang") || "").split("-")[0] || null;
  const title = shortEvidence($("title").first().text(), 18, 180);
  const description = shortEvidence($("meta[name='description']").attr("content"), 30, 300);
  const headings = $("h1,h2,h3").map((_, element) => ({
    level: element.tagName.toLowerCase(),
    text: shortEvidence($(element).text(), 25, 260),
  })).get().filter((heading) => heading.text).slice(0, 40);

  const links = $("a[href]").map((_, element) => {
    const href = absoluteUrl($(element).attr("href"), url);
    if (!href) return null;
    return {
      href,
      label: shortEvidence($(element).attr("aria-label") || $(element).text() || $(element).attr("title"), 12, 120),
      rel: cleanText($(element).attr("rel")),
    };
  }).get().filter(Boolean);

  const contactAnchors = $("a[href]").map((_, element) => {
    const href = String($(element).attr("href") || "").trim().toLowerCase();
    if (href.startsWith("mailto:")) return "Email";
    if (href.startsWith("tel:")) return "Teléfono";
    if (/^(?:https?:\/\/)?(?:api\.)?wa\.me|whatsapp/.test(href)) return "WhatsApp";
    if (/calendly|cal\.com|booking|book-a|schedule|agenda/.test(href)) return "Agenda online";
    return null;
  }).get().filter(Boolean);

  const buttonLike = $("button,a[href],input[type='submit'],input[type='button'],[role='button']").map((_, element) => {
    const node = $(element);
    const text = shortEvidence(node.attr("aria-label") || node.text() || node.attr("value") || node.attr("title"), 14, 140);
    const href = element.tagName === "a" ? absoluteUrl(node.attr("href"), url) : null;
    const marker = `${text} ${href || ""} ${node.attr("class") || ""} ${node.attr("id") || ""}`;
    const explicitAction = /(?:^|[.!?]\s+|\b(?:ready|listo|prêt|bereit)\b.{0,24}\b)(?:book|schedule|reserve|request|contact|call|consult|audit|quote|get (?:a |your )?(?:quote|demo|audit|plan|proposal)|start|apply|download|talk|speak|chat|whatsapp|agenda|reserva|consulta|contacto|presupuesto|cotiza|empieza|descarga|llama|hablar|solicita|réserver|devis|termin|kontakt|health check)\b/i.test(text);
    const multilingualAction = /^(?:お問い合わせ|無料相談|相談予約|資料請求|見積もり|予約する|申し込む|始める|費用を診断|문의하기|무료 상담|상담 예약|견적 요청|예약하기|신청하기|시작하기|تواصل معنا|احجز|استشارة مجانية|اطلب عرض|ابدأ|سجل الآن|დაგვიკავშირდით|დაჯავშნა|კონსულტაცია|ფასის მოთხოვნა|დაიწყეთ|связаться|забронировать|консультаци|получить расч[её]т|оставить заявку|начать)/i.test(text);
    const contentAction = /^(?:learn more|read more|see how|view case|download|saber más|ver caso|leer más|descarga|en savoir plus|mehr erfahren)\b/i.test(text);
    const hrefPath = href ? new URL(href).pathname : "";
    const contentDestination = /\/(?:blog|articles?|media|resources?|guides?|help|faq|case-stud|reviews?|careers?|about|team)(?:[/?#-]|$)/i.test(hrefPath);
    const hrefAction = href ? (!contentDestination && /\/(?:contact|contacto|book|booking|schedule|agenda|reserva|demo|consult|audit|quote|estimate|proposal|apply|start|get-started|signup|sign-up|register|download|health-check|checkout|cart)(?:[/?#-]|$)/i.test(hrefPath)) || /(?:calendly|cal\.com|hubspot.*meetings|savvycal|acuity|setmore|youcanbook|wa\.me|whatsapp)/i.test(href) : false;
    const noisePattern = /(?:cookie|consent|privacy settings|ajustes|aceptar|rechazar|menú|menu|anterior|siguiente|previous|next|slider|carousel|skip|saltar al contenido|navigation|nav-toggle|close|cerrar|share on|compartir|facebook|instagram|linkedin|youtube|tiktok|twitter)/i;
    const parentForm = node.closest("form");
    const formMarker = `${parentForm.attr("action") || ""} ${parentForm.attr("class") || ""} ${parentForm.find("input").map((__, input) => `${$(input).attr("type") || ""} ${$(input).attr("name") || ""} ${$(input).attr("placeholder") || ""}`).get().join(" ")}`;
    const noisyForm = /search|buscar|rechercher|suche|login|signin|password|filter|filtro|newsletter|subscribe|suscrib|bolet[ií]n|tagchimp|mailchimp/i.test(`${formMarker} ${text}`);
    const formSubmit = parentForm.length > 0 && !noisyForm && /^(?:button|input)$/i.test(element.tagName);
    const questionLike = /[?¿？]\s*$/.test(text) || /^(?:what|why|how|when|where|do i|can i|qué|por qué|cómo|cuándo|dónde|faq)\b/i.test(text);
    const numericLike = /^[\d\s/.,:+-]+$/.test(text);
    const titleLike = /^(?:call|contact|book|audit|consult)(?:ing)?\s+(?:service|services|software|platform|solution|solutions|management|handling|center|centre|agency|company|tool|tools|guide|tips|strategy|strategies)\b/i.test(text);
    if (!text || text.length > 110 || questionLike || numericLike || titleLike || noisePattern.test(marker) || (!explicitAction && !multilingualAction && !contentAction && !hrefAction && !formSubmit)) return null;
    return { text, href, element: element.tagName.toLowerCase(), kind: contentAction && !explicitAction && !hrefAction ? "content" : "conversion" };
  }).get().filter(Boolean);

  const forms = $("form").map((formIndex, formElement) => {
    const form = $(formElement);
    const fields = form.find("input,select,textarea").map((fieldIndex, fieldElement) => {
      const field = $(fieldElement);
      const type = (field.attr("type") || fieldElement.tagName || "text").toLowerCase();
      if (["submit", "button", "reset", "image"].includes(type)) return null;
      const id = field.attr("id");
      const label = id ? $(`label[for='${id.replaceAll("'", "\\'")}']`).first().text() : field.closest("label").first().text();
      const ancestorMarker = `${field.attr("class") || ""} ${field.attr("style") || ""} ${field.closest("[class],[style],[aria-hidden]").attr("class") || ""} ${field.closest("[class],[style],[aria-hidden]").attr("style") || ""} ${field.closest("[aria-hidden]").attr("aria-hidden") || ""}`;
      const honeypot = /(?:honeypot|wpcf7-akismet|hidden|display\s*:\s*none|deja este campo vacío|leave this field empty)/i.test(`${ancestorMarker} ${label} ${field.attr("name") || ""} ${field.attr("placeholder") || ""}`);
      return {
        type,
        name: shortEvidence(field.attr("name"), 8, 80) || null,
        label: shortEvidence(label, 12, 120) || null,
        placeholder: shortEvidence(field.attr("placeholder"), 12, 120) || null,
        required: field.is("[required]") || field.attr("aria-required") === "true",
        hidden: type === "hidden" || field.is("[hidden]") || field.css("display") === "none" || honeypot,
      };
    }).get().filter(Boolean);
    const submitText = shortEvidence(form.find("button[type='submit'],input[type='submit'],button:not([type])").first().text() || form.find("input[type='submit']").first().attr("value"), 14, 140);
    const groupedFields = [];
    const seenGroups = new Set();
    for (const field of fields) {
      const groupKey = /^(?:radio|checkbox)$/i.test(field.type) && field.name ? `${field.type}:${field.name}` : `${field.type}:${field.name || field.label || field.placeholder || groupedFields.length}`;
      if (seenGroups.has(groupKey)) continue;
      seenGroups.add(groupKey);
      groupedFields.push(field);
    }
    const formData = {
      index: formIndex + 1,
      action: absoluteUrl(form.attr("action") || url, url),
      method: String(form.attr("method") || "GET").toUpperCase(),
      submitText: submitText || null,
      visibleFieldCount: groupedFields.filter((field) => !field.hidden).length,
      requiredFieldCount: groupedFields.filter((field) => !field.hidden && field.required).length,
      hiddenFieldCount: fields.filter((field) => field.hidden).length,
      fields: groupedFields.filter((field) => !field.hidden).slice(0, 30),
    };
    const kind = classifyForm(formData, url);
    return {
      ...formData,
      kind,
      isConversion: ["commercial", "booking", "checkout", "listing"].includes(kind),
      isLeadCapture: ["commercial", "booking", "checkout", "listing", "newsletter"].includes(kind),
    };
  }).get().slice(0, 10);

  const iframes = $("iframe[src]").map((_, element) => ({
    src: absoluteUrl($(element).attr("src"), url),
    title: shortEvidence($(element).attr("title"), 14, 140) || null,
  })).get().filter((item) => item.src).slice(0, 20);

  const contacts = unique([...contactAnchors, ...links.map((link) => {
    const raw = link.href.toLowerCase();
    if (raw.startsWith("mailto:")) return "Email";
    if (raw.startsWith("tel:")) return "Teléfono";
    if (/wa\.me|whatsapp/.test(raw)) return "WhatsApp";
    if (/calendly|cal\.com|booking|book-a|schedule/.test(raw)) return "Agenda online";
    return null;
  })]);

  const originHost = new URL(url).hostname.replace(/^www\./, "");
  const internalLinks = links.filter((link) => {
    const host = new URL(link.href).hostname.replace(/^www\./, "");
    return host === originHost || host.endsWith(`.${originHost}`) || originHost.endsWith(`.${host}`);
  });
  const legalLinks = unique(internalLinks
    .filter((link) => /privacy|terms|legal|cookies|privacidad|aviso-legal|mentions-legales|impressum|datenschutz/i.test(`${link.href} ${link.label}`))
    .map((link) => link.href), 12);

  $("script,style,noscript,svg,template").remove();
  const bodyText = cleanText($("body").text());
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  const hero = headings.find((heading) => heading.level === "h1")?.text || headings[0]?.text || title || null;
  const resourceMarkup = $("script[src],iframe[src],link[href],form[action]").map((_, element) => {
    const node = $(element);
    return node.attr("src") || node.attr("href") || node.attr("action") || "";
  }).get().join(" ");
  const inlineScriptMarkup = $("script:not([src])").map((_, element) => $(element).text().slice(0, 120_000)).get().join(" ");
  const technologies = detectTechnologies(resourceMarkup, inlineScriptMarkup);
  if (iframes.some((frame) => /calendly/i.test(frame.src))) technologies.push("Calendly");
  if (iframes.some((frame) => /typeform/i.test(frame.src))) technologies.push("Typeform");
  if (links.some((link) => /wa\.me|whatsapp/i.test(link.href))) technologies.push("WhatsApp");

  return {
    url,
    status,
    contentType,
    language,
    title,
    description,
    hero,
    headings,
    ctas: unique(buttonLike.map((item) => JSON.stringify(item)), 35).map(JSON.parse),
    forms,
    iframes,
    contacts,
    legalLinks,
    technologies: unique(technologies),
    category: classifyLink(url),
    contentPage: isContentPath(url),
    signals: Object.fromEntries(Object.entries(SIGNALS).map(([key, pattern]) => [key, sentenceSnippets(bodyText, pattern)])),
    textStats: {
      words: wordCount,
      questions: (bodyText.match(/[?¿？]/g) || []).length,
      exclamations: (bodyText.match(/[!¡！]/g) || []).length,
      numericTokens: (bodyText.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []).length,
      firstPersonPlural: (bodyText.match(/\b(?:we|our|us|nosotros|nuestro|nuestra|nous|notre|wir|unser|nós|nosso)\b/gi) || []).length,
      secondPerson: (bodyText.match(/\b(?:you|your|tú|tu|usted|vosotros|votre|vous|dein|sie|você|seu)\b/gi) || []).length,
    },
    internalLinks: internalLinks.map((link) => ({ ...link, category: classifyLink(link.href, link.label), score: linkScore(link.href, link.label) })),
  };
}

async function sitemapCandidates(robots, seedUrl) {
  const sitemapUrls = robots.sitemaps.length ? robots.sitemaps : [`${new URL(seedUrl).origin}/sitemap.xml`];
  const candidates = [];
  for (const sitemapUrl of sitemapUrls.slice(0, 2)) {
    try {
      const response = await fetchText(sitemapUrl, { timeout: 10_000, maxBytes: 1_500_000 });
      for (const match of response.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
        const url = safeUrl(match[1], seedUrl);
        if (!url || new URL(url).origin !== new URL(seedUrl).origin) continue;
        const category = classifyLink(url);
        if (category !== "other") candidates.push({ href: url, label: "", category, score: linkScore(url) });
      }
    } catch {
      // A sitemap is optional; the limitation is represented by discovered-page coverage.
    }
  }
  return candidates;
}

function chooseNextLink(candidates, visited, chosenCategories) {
  const available = candidates
    .filter((candidate) => !visited.has(candidate.href))
    .sort((a, b) => {
      const diversityA = chosenCategories.has(a.category) ? 0 : 50;
      const diversityB = chosenCategories.has(b.category) ? 0 : 50;
      return b.score + diversityB - (a.score + diversityA);
    });
  return available[0] || null;
}

function toneSignals(pages) {
  const stats = pages.reduce((sum, page) => {
    for (const [key, value] of Object.entries(page.textStats)) sum[key] = (sum[key] || 0) + value;
    return sum;
  }, {});
  const signals = [];
  if ((stats.secondPerson || 0) > (stats.firstPersonPlural || 0) * 1.4) signals.push("orientado al lector");
  if ((stats.numericTokens || 0) >= 20) signals.push("cuantitativo");
  if ((stats.questions || 0) >= 8) signals.push("interrogativo / diagnóstico");
  if ((stats.exclamations || 0) >= 8) signals.push("enérgico");
  if (pages.filter((page) => !page.contentPage).flatMap((page) => page.signals.proof).length >= 4) signals.push("autoridad basada en prueba");
  if (pages.filter((page) => !page.contentPage).flatMap((page) => page.signals.urgency).length >= 2) signals.push("urgencia comercial");
  if (!signals.length) signals.push("tono no clasificable automáticamente; requiere revisión humana");
  return { signals, metrics: stats };
}

function dimension(name, status, evidence = [], explanation = null) {
  return { name, status, evidence: unique(evidence, 8), explanation };
}

function buildRecord(company, recoveredPages, errors, robots, seedUrl) {
  const isUsablePage = (page) => {
    const pureXml = /^(?:application|text)\/xml/i.test(page.contentType || "") || /\/(?:sitemap(?:_index)?\.xml)$/i.test(new URL(page.url).pathname);
    const htmlDocument = /(?:text\/html|application\/xhtml\+xml)/i.test(page.contentType || "");
    const hasConversion = page.ctas.some((cta) => cta.kind === "conversion") || page.forms.some((form) => form.isLeadCapture);
    const hasCommercialSignal = Object.values(page.signals || {}).some((values) => values.length) && ["pricing", "conversion", "offer", "proof", "objections"].includes(page.category);
    return htmlDocument && !pureXml && (page.textStats.words >= 80 || hasConversion || (page.textStats.words >= 25 && hasCommercialSignal));
  };
  const pages = recoveredPages.filter(isUsablePage);
  const discardedPages = recoveredPages.filter((page) => !isUsablePage(page)).map((page) => ({
    url: page.url,
    reason: /^(?:application|text)\/xml/i.test(page.contentType || "")
      ? "XML/sitemap no tratado como landing comercial"
      : !/(?:text\/html|application\/xhtml\+xml)/i.test(page.contentType || "")
        ? `Recurso no HTML (${page.contentType || "tipo desconocido"}) no tratado como landing comercial`
        : `Contenido insuficiente (${page.textStats.words} palabras) sin conversión inequívoca`,
  }));
  const allCtaEvidence = unique(pages.flatMap((page) => page.ctas
    .filter((cta) => cta.kind === "conversion")
    .map((cta) => JSON.stringify({ pageUrl: page.url, ...cta }))), 80).map(JSON.parse);
  const contentCtaEvidence = unique(pages.flatMap((page) => page.ctas
    .filter((cta) => cta.kind === "content")
    .map((cta) => JSON.stringify({ pageUrl: page.url, ...cta }))), 40).map(JSON.parse);
  const allCtas = unique(allCtaEvidence.map((cta) => cta.text), 60);
  const allForms = pages.flatMap((page) => page.forms
    .filter((form) => form.isConversion)
    .map((form) => ({ pageUrl: page.url, ...form })));
  const auxiliaryForms = pages.flatMap((page) => page.forms
    .filter((form) => !form.isConversion)
    .map((form) => ({ pageUrl: page.url, ...form })));
  const leadCaptureForms = pages.flatMap((page) => page.forms
    .filter((form) => form.isLeadCapture)
    .map((form) => ({ pageUrl: page.url, ...form })));
  const allTechnologies = unique(pages.flatMap((page) => page.technologies));
  const allContacts = unique(pages.flatMap((page) => page.contacts));
  const heroEvidence = unique(pages
    .filter((page) => !page.contentPage && ["other", "offer", "conversion", "pricing"].includes(page.category))
    .map((page) => JSON.stringify({ text: page.hero, url: page.url, pageTitle: page.title, pageCategory: page.category, isRoot: isRootPath(page.url) })), 20)
    .map(JSON.parse)
    .filter((hero) => hero.text);
  const heroes = unique(heroEvidence.map((hero) => hero.text), 12);
  const eligibleCommercialPage = (page) => !page.contentPage && (isRootPath(page.url) || ["pricing", "conversion", "offer", "proof", "objections"].includes(page.category));
  const signalRows = (signal, predicate = eligibleCommercialPage, limit = 30) => unique(pages
    .filter(predicate)
    .flatMap((page) => (page.signals[signal] || []).map((text) => JSON.stringify({ text, url: page.url, pageTitle: page.title, pageCategory: page.category }))), limit)
    .map(JSON.parse);
  const priceRows = signalRows("price", (page) => !page.contentPage && (isRootPath(page.url) || page.category === "pricing" || /\/(?:pricing|prices|plans?|packages?|tarif|precio|precios|cost)(?:[/?#-]|$)/i.test(new URL(page.url).pathname)), 32)
    .map((row) => {
      const text = row.text.toLowerCase();
      const hasCurrency = /[$€£¥₹₩₽₺₦₫₱฿₪₾]|円|원|د\.?إ|ر\.?س|\b(?:USD|EUR|GBP|AED|JPY|CAD|AUD|CHF|INR|MXN|BRL|PLN|SAR|QAR|PKR|GEL|KRW|CNY|RMB|KZT|NGN|ZAR|SGD|MYR|IDR|VND|THB|PHP|EGP|MAD|TRY)\b/.test(row.text)
        || /\b(?:dollars?|euros?|yen|dirhams?)\b/i.test(row.text);
      let amountType = "ambiguous";
      if (/ad spend|advertising spend|media spend|budget spent|inversi[oó]n publicitaria|presupuesto publicitario|gasto publicitario|paid media budget/.test(text)) amountType = "ad_spend";
      else if (/client|cliente|customer|revenue|facturaci[oó]n|funding|raised|ventas generadas|sales generated/.test(text)) amountType = "client_result";
      else if (/subvenci[oó]n|grant|kit digital|ayuda p[úu]blica/.test(text)) amountType = "subsidy";
      else if (/excluir|marketplace|directorio|directory|plataforma de servicios/i.test(company.scope) && row.pageCategory !== "pricing") amountType = "marketplace_or_third_party";
      else if (hasCurrency && (row.pageCategory === "pricing" || /price|pricing|tarifa|precio|fee|setup|retainer|per (?:lead|meeting|month)|al mes|mensual|plan|paquete|desde|starting at|月額|料金|価格|가격|요금|شهري|السعر|ფასი|тариф/i.test(text))) amountType = "own_fee_candidate";
      return { ...row, amountType };
    });
  const guaranteeRowsAll = signalRows("guarantee", eligibleCommercialPage, 24).map((row) => {
    const disclaimer = /(?:cannot|can'?t|do not|does not|don'?t|no|not|without|never|aucune|pas de|sans|nicht|keine|no se|no podemos|no garantizamos|sin)\s+(?:\w+\s+){0,3}(?:guarantee|guaranteed|garant[ií]a|garantizamos|garantie|garantia)|(?:results?|resultados?|roas|sales|ventas)\s+(?:are\s+)?not\s+guaranteed|保証しません|保証されません|보장하지|لا نضمن|არ ვიძლევით გარანტიას|не гарант/i.test(row.text);
    let guaranteeType = disclaimer ? "disclaimer" : "result_or_refund_candidate";
    if (!disclaimer && /maintenance|repair|defect|warranty period|mantenimiento|reparaci[oó]n|defecto|garant[ií]a t[ée]cnica|保証期間|修理|유지보수|수리|صيانة|إصلاح|техническ|ремонт/i.test(row.text)) guaranteeType = "technical_warranty";
    else if (!disclaimer && company.scope === "Excluir — fuente/no negocio" && row.pageCategory !== "pricing") guaranteeType = "marketplace_or_third_party";
    return { ...row, polarity: disclaimer ? "negative" : "positive_or_unclear", guaranteeType };
  });
  const guaranteeDisclaimerRows = guaranteeRowsAll.filter((row) => row.guaranteeType === "disclaimer");
  const guaranteeRows = guaranteeRowsAll.filter((row) => row.guaranteeType === "result_or_refund_candidate");
  const proofRows = signalRows("proof", (page) => !page.contentPage && (isRootPath(page.url) || page.category === "proof" || page.category === "offer"), 30)
    .filter((row) => /(?:\b\d+(?:[.,]\d+)?%|\b\d+[kKmM+]?\b|testimonial|testimonio|review|reseña|case stud|caso de éxito|client|cliente|customer|rating|stars?|estrellas?)/i.test(row.text));
  const objectionRows = signalRows("objection", (page) => !page.contentPage && (page.category === "objections" || isRootPath(page.url) || page.category === "offer"), 24);
  const priceEvidence = unique(priceRows.filter((row) => row.amountType === "own_fee_candidate").map((row) => row.text), 20);
  const guaranteeEvidence = unique(guaranteeRows.map((row) => row.text), 16);
  const proofEvidence = unique(proofRows.map((row) => row.text), 24);
  const objectionEvidence = unique(objectionRows.map((row) => row.text), 20);
  const leadMagnets = unique(pages.flatMap((page) => page.signals.leadMagnet), 16);
  const voice = toneSignals(pages);
  const schedulerPattern = /(?:calendly|cal\.com|hubspot.*meetings|savvycal|acuity|setmore|youcanbook|oncehub|simplybook|\/(?:book|booking|schedule|agenda|reserva)(?:[/?#-]|$))/i;
  const bookingEvidence = unique(pages.flatMap((page) => [
    ...page.iframes.filter((frame) => schedulerPattern.test(frame.src)).map((frame) => JSON.stringify({ pageUrl: page.url, text: frame.title || "Agenda incrustada", url: frame.src, type: "iframe" })),
    ...page.ctas.filter((cta) => cta.href && schedulerPattern.test(cta.href)).map((cta) => JSON.stringify({ pageUrl: page.url, text: cta.text, url: cta.href, type: "link" })),
    ...page.ctas.filter((cta) => /^(?:book|schedule|agenda|reserva|réserver|termin)\b/i.test(cta.text) || /(?:相談予約|予約する|상담 예약|예약하기|احجز|دაჯავშნა|забронировать)/i.test(cta.text)).map((cta) => JSON.stringify({ pageUrl: page.url, text: cta.text, url: cta.href, type: cta.href ? "link" : "intent" })),
  ]), 30).map(JSON.parse);
  const bookingDestinationObserved = bookingEvidence.some((evidence) => evidence.url && schedulerPattern.test(evidence.url));
  const bookingIntentObserved = bookingEvidence.length > 0;
  const purchaseTextPattern = /^(?:buy now|purchase now|checkout|pay now|add to cart|comprar ahora|pagar ahora|finalizar compra|proceder al pago|acheter maintenant|jetzt kaufen)(?:\b|\s|$)/i;
  const checkoutEvidence = unique(pages.flatMap((page) => [
    ...page.ctas.filter((cta) => (cta.href && /\/(?:checkout|cart|payment|pay-now|buy-now)(?:[/?#]|$)/i.test(new URL(cta.href).pathname)) || purchaseTextPattern.test(cta.text)).map((cta) => JSON.stringify({ pageUrl: page.url, text: cta.text, url: cta.href, type: "cta" })),
    ...page.forms.filter((form) => form.kind === "checkout").map((form) => JSON.stringify({ pageUrl: page.url, text: form.submitText || "Formulario de pago", url: form.action, type: "form" })),
  ]), 20).map(JSON.parse);
  const bookingObserved = bookingDestinationObserved;
  const checkoutObserved = checkoutEvidence.length > 0;
  const legalObserved = pages.some((page) => page.legalLinks.length > 0);
  const teamObserved = pages.some((page) => /about|team|nosotros|quienes-somos|empresa|equipe|uber-uns|chi-siamo/i.test(new URL(page.url).pathname));
  const faqObserved = pages.some((page) => /faq|questions|preguntas|help/i.test(new URL(page.url).pathname)) || objectionEvidence.length > 0;
  const lowTextPages = recoveredPages.filter((page) => page.textStats.words < 80).length;

  const stages = [
    { stage: "Entrada / adquisición", status: company.channels?.length ? "inferido" : "no observable", evidence: company.channels || [], note: "Los canales proceden de la investigación previa; el sitio no revela por sí solo la fuente de tráfico." },
    { stage: "Landing / página de entrada", status: pages.length ? "observado" : "no observable", evidence: pages.slice(0, 3).map((page) => page.url), note: pages.length ? null : "No se pudo recuperar una página pública." },
    { stage: "Promesa y encaje", status: heroes.length ? "observado" : "no observable", evidence: heroes.slice(0, 4), note: null },
    { stage: "CTA", status: allCtas.length ? "observado" : "no observable", evidence: allCtas.slice(0, 8), note: allCtas.length ? null : "No se localizó una acción comercial inequívoca; se excluyeron navegación, redes, FAQ y tarjetas." },
    { stage: "Captura / cualificación", status: allForms.length ? "observado" : "no observable", evidence: allForms.slice(0, 4).map((form) => `${form.pageUrl} · ${form.visibleFieldCount} campos`), note: "No se envió ningún formulario." },
    { stage: "Reserva o contacto directo", status: bookingIntentObserved || allContacts.length ? "observado" : "no observable", evidence: [...allContacts, ...bookingEvidence.map((evidence) => evidence.text)].slice(0, 8), note: bookingDestinationObserved ? "Se observó un destino de agenda; no se reservó." : bookingIntentObserved ? "Se observó intención de reserva, pero no un destino público verificable." : null },
    { stage: "Conversación comercial", status: bookingIntentObserved || allContacts.length ? "inferido" : "no observable", evidence: bookingIntentObserved ? ["El CTA invita a reserva/contacto; no se ejecutó la conversación."] : [], note: "No se contactó con la empresa." },
    { stage: "Propuesta / cierre", status: checkoutObserved ? "observado" : "no observable", evidence: checkoutObserved ? ["Checkout o compra directa visible."] : [], note: checkoutObserved ? null : "No se puede confirmar sin interactuar o contactar." },
    { stage: "Seguimiento / nurturing", status: "no observable", evidence: [], note: "No se enviaron datos ni se activaron secuencias." },
    { stage: "Entrega / retención", status: company.funnel ? "inferido" : "no observable", evidence: company.funnel ? [shortEvidence(company.funnel, 28, 320)] : [], note: "Basado en información pública previa; no se auditó como cliente." },
  ];

  const coverage = [
    dimension("Página pública accesible", pages.length ? "observado" : "no observable", pages.map((page) => page.url), pages.length ? null : "No se recuperó una página comercial utilizable; XML, contenido vacío y páginas técnicas no cuentan como landing."),
    dimension("Mensaje principal", heroes.length ? "observado" : "no observable", heroes),
    dimension("Oferta", pages.some((page) => !page.contentPage && page.headings.length) ? "observado" : (company.offer ? "inferido" : "no observable"), [company.offer], pages.some((page) => !page.contentPage && page.headings.length) ? null : "La oferta disponible procede de la síntesis canónica previa, no de una página comercial recuperada en esta pasada."),
    dimension("Público objetivo", company.niche ? "inferido" : "no observable", [company.niche]),
    dimension("Precio", priceEvidence.length ? "observado" : (["Público en web", "Público solo en propuesta", "Conseguido por el equipo"].includes(company.priceStatus) ? "inferido" : "no observable"), [...priceEvidence, company.priceLocal], priceEvidence.length ? null : "No se localizó una tarifa propia nueva con contexto suficiente; el precio canónico previo, si existe, se conserva como evidencia previa."),
    dimension("CTA", allCtas.length ? "observado" : "no observable", allCtas),
    dimension("Formulario", allForms.length ? "observado" : "no observable", allForms.map((form) => form.pageUrl)),
    dimension("Reserva/contacto", bookingIntentObserved || allContacts.length ? "observado" : "no observable", [...allContacts, ...bookingEvidence.map((evidence) => evidence.text)]),
    dimension("Prueba social", proofEvidence.length ? "observado" : (company.proof ? "inferido" : "no observable"), [...proofEvidence, company.proof], proofEvidence.length ? null : "No se localizó prueba nueva con métrica, cliente, rating o testimonio identificable; la síntesis previa no se eleva a observación actual."),
    dimension("Garantía", guaranteeEvidence.length ? "observado" : (company.guarantee && !/^(?:no publicada|no aplica)/i.test(company.guarantee) ? "inferido" : "no observable"), [...guaranteeEvidence, company.guarantee], guaranteeEvidence.length ? null : "No se localizó una garantía pública positiva nueva; las síntesis previas y negaciones no se presentan como observación actual."),
    dimension("Objeciones / FAQ", faqObserved ? "observado" : "no observable", objectionEvidence),
    dimension("Lead magnet", leadMagnets.length ? "observado" : "no observable", leadMagnets),
    dimension("Tecnología comercial", allTechnologies.length ? "observado" : "no observable", allTechnologies),
    dimension("Equipo", teamObserved || company.team ? (teamObserved ? "observado" : "inferido") : "no observable", [company.team]),
    dimension("Legal / confianza", legalObserved ? "observado" : "no observable", pages.flatMap((page) => page.legalLinks)),
    dimension("Seguimiento posterior", "no observable", [], "No se enviaron formularios ni datos personales."),
    dimension("Conversación de ventas", "no observable", [], "No se contactó con la empresa."),
    dimension("Cumplimiento / entrega", "no observable", [], "No se contrató el servicio."),
  ];
  const applicable = coverage.length;
  const observed = coverage.filter((item) => item.status === "observado").length;
  const explained = coverage.filter((item) => item.status !== "no observable" || item.explanation).length;

  const declaredSources = Array.isArray(company.sources) ? company.sources : [];
  const cleanSources = extractPublicUrls(declaredSources);
  const malformedSources = declaredSources.filter((source) => !safeUrl(source));
  const limitations = unique([
    ...errors.map((error) => `${error.url}: ${error.error}`),
    ...(lowTextPages ? [`${lowTextPages} página(s) con menos de 80 palabras; posible renderizado JavaScript o contenido mínimo.`] : []),
    ...(robots?.blocked?.length ? [`robots.txt impidió ${robots.blocked.length} URL(s).`] : []),
    ...(!pages.length ? ["No se recuperó contenido comercial HTML utilizable; requiere navegador o documentación externa."] : []),
    ...(recoveredPages.length && !pages.length ? [`Se recuperaron ${recoveredPages.length} recurso(s), pero ninguno superó el umbral de página comercial utilizable; XML, contenido vacío y páginas técnicas se excluyeron de cobertura.`] : []),
    ...(guaranteeDisclaimerRows.length ? [`Se localizaron ${guaranteeDisclaimerRows.length} negación(es) o disclaimer(s) de garantía; no se clasificaron como garantía positiva.`] : []),
    "No se enviaron formularios, no se contactó a la empresa y no se inventaron etapas posteriores al CTA.",
  ]);

  return {
    schemaVersion: queue.schemaVersion,
    id: company.id,
    name: company.name,
    website: company.website,
    seedUrl,
    country: company.country,
    scope: company.scope,
    decision: company.decision,
    relation: company.relation,
    collectedAt: new Date().toISOString(),
    collectionPolicy: {
      publicGetRequestsOnly: true,
      respectedRobotsTxt: true,
      submittedForms: false,
      contactedCompany: false,
      storedQuoteLimitWords: 22,
    },
    sourceAudit: {
      declaredEntries: declaredSources.length,
      cleanPublicUrls: cleanSources,
      malformedDeclaredEntries: malformedSources,
      recoveredPageUrls: recoveredPages.map((page) => page.url),
      observedPageUrls: pages.map((page) => page.url),
      discardedPages,
    },
    commercialForensics: {
      message: {
        heroes,
        heroEvidence,
        descriptions: unique(pages.map((page) => page.description), 12),
        supportingHeadings: unique(pages.flatMap((page) => page.headings.map((heading) => heading.text)), 30),
        voice,
      },
      offer: {
        existingSummary: company.offer || null,
        audience: company.niche || null,
        prices: priceEvidence,
        guarantee: guaranteeEvidence,
        proof: proofEvidence,
        objections: objectionEvidence,
        urgency: unique(pages.flatMap((page) => page.signals.urgency), 12),
        evidence: {
          prices: priceRows,
          guarantee: guaranteeRows,
          guaranteeDisclaimers: guaranteeDisclaimerRows,
          guaranteeOther: guaranteeRowsAll.filter((row) => !["result_or_refund_candidate", "disclaimer"].includes(row.guaranteeType)),
          proof: proofRows,
          objections: objectionRows,
        },
      },
      conversion: {
        ctas: allCtas,
        ctaEvidence: allCtaEvidence,
        contentCtaEvidence,
        leadMagnets,
        contacts: allContacts,
        forms: allForms,
        leadCaptureForms,
        auxiliaryForms,
        bookingObserved,
        bookingIntentObserved,
        bookingDestinationObserved,
        bookingEvidence,
        checkoutObserved,
        checkoutEvidence,
        technologies: allTechnologies,
      },
      funnel: stages,
      coverage: {
        dimensions: coverage,
        observed,
        applicable,
        observedPercent: Math.round((observed / applicable) * 100),
        explainedPercent: Math.round((explained / applicable) * 100),
        recoveredPageCount: recoveredPages.length,
        usablePageCount: pages.length,
        discardedPageCount: discardedPages.length,
      },
    },
    pages: pages.map((page) => Object.fromEntries(Object.entries(page).filter(([key]) => key !== "internalLinks"))),
    robots: robots ? { url: robots.url, available: robots.available, blocked: robots.blocked || [], sitemaps: robots.sitemaps || [] } : null,
    errors,
    limitations,
    review: {
      status: "pending",
      requirement: "Revisión humana/IA de evidencia, síntesis estratégica y etiquetado observado/inferido/no observable antes de escribir en Notion.",
    },
  };
}

async function collectCompany(company) {
  const seedUrl = safeUrl(company.website || company.domain);
  if (!seedUrl) throw new Error("La ficha no contiene una URL pública válida");
  const robots = await robotsFor(seedUrl);
  robots.blocked = [];
  if (!robotsAllows(seedUrl, robots)) {
    robots.blocked.push(seedUrl);
    return buildRecord(company, [], [{ url: seedUrl, error: "Bloqueado por robots.txt" }], robots, seedUrl);
  }

  const pages = [];
  const errors = [];
  const visited = new Set();
  const candidates = [];
  const chosenCategories = new Set();

  async function crawl(url) {
    visited.add(url);
    if (!robotsAllows(url, robots)) {
      robots.blocked.push(url);
      errors.push({ url, error: "Bloqueado por robots.txt" });
      return;
    }
    try {
      const response = await fetchText(url);
      visited.add(response.url);
      if (pages.some((page) => page.url === response.url)) return;
      const page = analyzePage(response.text, response.url, response.status, response.contentType);
      pages.push(page);
      chosenCategories.add(classifyLink(response.url));
      for (const link of page.internalLinks) {
        if (new URL(link.href).origin === new URL(seedUrl).origin || new URL(link.href).hostname.replace(/^www\./, "") === new URL(seedUrl).hostname.replace(/^www\./, "")) candidates.push(link);
      }
    } catch (error) {
      errors.push({ url, error: String(error.message || error) });
    }
  }

  await crawl(seedUrl);
  if (pages.length && candidates.length < 4) candidates.push(...await sitemapCandidates(robots, seedUrl));
  while (!stopping && pages.length < args.pages) {
    const next = chooseNextLink(candidates, visited, chosenCategories);
    if (!next) break;
    await crawl(next.href);
  }
  return buildRecord(company, pages, errors, robots, seedUrl);
}

const staleCutoff = Date.now() - 30 * 60 * 1000;
for (const item of queue.items) {
  if (item.collect.status === "in_progress" && (!item.collect.updatedAt || Date.parse(item.collect.updatedAt) < staleCutoff)) {
    item.collect.status = "pending";
    item.collect.error = "Reanudado tras una interrupción antes de completar la captura.";
  }
}
await persistQueue();

const selected = queue.items
  .filter((item) => !args.only.length || args.only.includes(item.id) || args.only.includes(item.name))
  .filter((item) => ["pending", "failed"].includes(item.collect.status) && item.collect.attempts < args.retries)
  .slice(0, Number.isFinite(args.limit) ? args.limit : undefined);

let cursor = 0;
let completed = 0;
async function worker(workerId) {
  while (!stopping) {
    const item = selected[cursor++];
    if (!item) return;
    const company = companyById.get(item.id);
    if (!company) {
      item.collect = { status: "failed", attempts: item.collect.attempts + 1, updatedAt: new Date().toISOString(), error: "Registro ausente de companies.json" };
      await persistQueue();
      continue;
    }
    item.collect = { status: "in_progress", attempts: item.collect.attempts + 1, updatedAt: new Date().toISOString(), error: null };
    await persistQueue();
    try {
      const record = await collectCompany(company);
      const recordPath = `research/deep/${item.recordFile}`;
      await writeJsonAtomic(recordPath, record);
      const limited = record.pages.length === 0;
      item.collect = {
        status: limited ? "limited" : "complete",
        attempts: item.collect.attempts,
        updatedAt: new Date().toISOString(),
        error: limited ? record.limitations.join(" ") : null,
      };
      item.limitation = limited ? record.limitations.join(" ") : null;
    } catch (error) {
      item.collect = {
        status: "failed",
        attempts: item.collect.attempts,
        updatedAt: new Date().toISOString(),
        error: String(error.message || error),
      };
    }
    completed += 1;
    await persistQueue();
    console.log(`[${completed}/${selected.length}] W${workerId} ${item.name}: ${item.collect.status}`);
  }
}

await Promise.all(Array.from({ length: Math.min(args.concurrency, selected.length || 1) }, (_, index) => worker(index + 1)));
await persistQueue();
console.log(JSON.stringify({ selected: selected.length, completed, stopping, stats: queue.stats.collect }, null, 2));
