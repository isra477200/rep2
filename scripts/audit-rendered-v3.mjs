import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const QUEUE_FILE = "research/deep/v3/queue.json";
const RENDERED_DIR = "research/deep/v3/rendered";
const OUTPUT_FILE = "research/deep/v3/rendered-quality.json";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function readOptional(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function isUtilityPage(page) {
  let path = "";
  try { path = new URL(page?.url || "").pathname.toLowerCase(); } catch { path = String(page?.url || "").toLowerCase(); }
  return /(?:^|\/)(?:legal|imprint|privacy|privacidad|privacy-policy|politica-de-privacidad|cookies?|politica-de-cookies|aviso-legal|legal-notice|terms(?:-and-conditions)?|terms-of-(?:use|service)|impressum|datenschutz|mentions-legales)(?:\/|$|\.)/i.test(path);
}

function isRoot(page) {
  try { return new URL(page.url).pathname.replace(/\/+$/, "") === ""; } catch { return false; }
}

const categories = [
  ["pricing", /(?:pricing|prices?|cost|plans?|tarif|precio|preise|料金|価格|prezzi|prix)/i],
  ["conversion", /(?:contact|book|booking|schedule|demo|consult|audit|quote|estimate|apply|get-started|contacto|agenda|reserva|presupuesto|cotiza|contato|devis|consulta)/i],
  ["proof", /(?:case-stud|cases?|results?|success|testimonial|reviews?|clientes|casos|resultados|referen)/i],
  ["objections", /(?:faq|questions?|preguntas|help|guarantee|garant|refund|contract)/i],
  ["offer", /(?:services?|solutions?|lead-generation|appointment|demand-generation|servicios|soluciones|leistungen|servizi)/i],
  ["team", /(?:about|company|team|nosotros|quienes-somos|empresa|equipe|uber-uns|chi-siamo)/i],
];

function pageCategories(page) {
  const corpus = `${page.url || ""} ${page.title || ""} ${(page.headings || []).map((row) => row.text).join(" ")}`;
  return categories.filter(([, regex]) => regex.test(corpus)).map(([name]) => name);
}

function likelyCta(row) {
  const value = `${clean(row?.text || row?.ariaLabel)} ${row?.href || ""}`;
  return /(?:book|agenda|reserva|schedule|demo|consult|audit|contact|quote|presupuesto|cotiza|apply|start|empieza|whatsapp|call|llama|download|descarga|pricing|precio|plan|trial|prueba|free|gratis)/i.test(value);
}

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const rows = [];
for (const item of queue.items) {
  const rendered = await readOptional(`${RENDERED_DIR}/${item.id}.json`);
  const pages = rendered?.pages || [];
  const funnelPages = pages.filter((page) => !isUtilityPage(page));
  const commercial = funnelPages.filter((page) => page.sourceRelation !== "external_funnel_destination");
  const embeddedFrames = funnelPages.flatMap((page) => page.embeddedFrames || []);
  const topForms = funnelPages.flatMap((page) => page.forms || []);
  const embeddedForms = embeddedFrames.flatMap((frame) => frame.forms || []);
  const forms = [...topForms, ...embeddedForms];
  const pageIframes = funnelPages.flatMap((page) => page.iframes || []);
  const observedCategories = [...new Set(commercial.flatMap(pageCategories))].sort();
  const ctas = funnelPages.flatMap((page) => [
    ...(page.links || []),
    ...(page.buttons || []),
    ...(page.embeddedFrames || []).flatMap((frame) => frame.buttons || []),
  ]).filter(likelyCta);
  const words = commercial.reduce((sum, page) => sum + clean(page.visibleText).split(/\s+/).filter(Boolean).length, 0);
  const screenshotCount = pages.filter((page) => page.screenshot).length;
  const repairReasons = [];
  if (item.scope === "Excluir — fuente/no negocio") repairReasons.push("classification_review");
  else if (!rendered || !pages.length) repairReasons.push("missing_rendered_pages");
  else {
    if (!commercial.length) repairReasons.push("no_commercial_page");
    if (!commercial.some(isRoot)) repairReasons.push("root_missing");
    if (commercial.length < 6) repairReasons.push("fewer_than_six_commercial_pages");
    if (words < 1_200) repairReasons.push("thin_visible_copy");
    if (!observedCategories.includes("conversion") && !ctas.length) repairReasons.push("conversion_route_not_observed");
    if (!observedCategories.includes("proof")) repairReasons.push("proof_route_not_observed");
    if (!observedCategories.some((value) => ["offer", "pricing"].includes(value))) repairReasons.push("offer_economics_route_not_observed");
    if (!observedCategories.includes("objections")) repairReasons.push("objection_route_not_observed");
    if (screenshotCount < 2) repairReasons.push("fewer_than_two_evidence_screenshots");
    if (pageIframes.length && !embeddedFrames.length) repairReasons.push("embedded_flow_not_inspected");
    if (!forms.length && pageIframes.some((url) => /calendly|typeform|hubspot|jotform|leadconnector|gohighlevel|forms?/i.test(url))) repairReasons.push("embedded_capture_not_inventoried");
  }
  const quality = item.scope === "Excluir — fuente/no negocio" ? "classification_review"
    : !rendered || !pages.length ? "unobservable"
      : commercial.length >= 6
          && words >= 2_500
          && observedCategories.length >= 4
          && observedCategories.includes("conversion")
          && observedCategories.includes("proof")
          && observedCategories.some((value) => ["offer", "pricing"].includes(value))
          && (ctas.length || forms.length)
          && screenshotCount >= 2 ? "deep"
        : commercial.length && words >= 300 ? "usable"
          : "thin";
  rows.push({
    id: item.id,
    name: item.name,
    priority: item.priority,
    quality,
    pages: pages.length,
    commercialPages: commercial.length,
    externalFunnelPages: funnelPages.length - commercial.length,
    utilityPages: pages.filter(isUtilityPage).length,
    wordsObserved: words,
    categories: observedCategories,
    ctaVariants: ctas.length,
    forms: forms.length,
    visibleFields: forms.reduce((sum, form) => sum + Number(form.visibleFieldCount || 0), 0),
    iframes: pageIframes.length,
    embeddedFrames: embeddedFrames.length,
    screenshots: screenshotCount,
    errors: rendered?.errors?.length || 0,
    repairReasons,
  });
}

const counts = rows.reduce((result, row) => {
  result[row.quality] = (result[row.quality] || 0) + 1;
  return result;
}, {});
const repairRows = rows
  .filter((row) => row.quality !== "classification_review" && row.repairReasons.length)
  .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name, "es"));
const report = {
  format: "rv-rendered-quality-v3",
  generatedAt: new Date().toISOString(),
  total: rows.length,
  counts,
  repair: {
    total: repairRows.length,
    ids: repairRows.map((row) => row.id),
  },
  rows,
};
await writeJsonAtomic(OUTPUT_FILE, report);
console.log(JSON.stringify({ total: report.total, counts, repair: report.repair.total }, null, 2));
