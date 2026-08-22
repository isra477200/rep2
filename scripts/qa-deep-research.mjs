import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { createHash } from "node:crypto";

const DEFAULT_QUEUE_FILE = "research/deep/queue.json";
const DEFAULT_OUTPUT_FILE = "audit/deep-research-qa.json";
const MANUAL_ROOT = "research/deep";
const ALLOWED_FORM_KINDS = new Set([
  "booking",
  "checkout",
  "commercial",
  "contact",
  "lead-magnet",
  "listing",
  "login",
  "newsletter",
  "search",
  "support",
  "unknown",
  "empty",
  "filter",
  "other",
]);
const ALLOWED_AMOUNT_TYPES = new Set([
  "ad_spend",
  "ambiguous",
  "client_result",
  "market_benchmark",
  "marketplace_or_third_party",
  "own_fee_candidate",
  "product_price",
  "subsidy",
]);
const ALLOWED_GUARANTEE_POLARITIES = new Set(["negative", "positive_or_unclear"]);
const SOCIAL_OR_NAVIGATION = /\b(?:facebook|instagram|linkedin|youtube|tiktok|twitter|privacidad|privacy|cookies?|legal|t[eé]rminos|terms|inicio|home|blog|men[uú]|compartir|share)\b/i;
const NUMERIC_ONLY = /^[+\d\s()./-]+$/;
const MONEY = /(?:[$€£¥₹]|\b(?:aed|aud|brl|cad|chf|cny|cop|dkk|eur|gbp|inr|jpy|mxn|nok|nzd|pen|pln|ron|sek|sgd|usd|zar)\b)\s*\d|\d[\d.,\s]*\s*(?:[$€£¥₹]|\b(?:aed|aud|brl|cad|chf|cny|cop|dkk|eur|gbp|inr|jpy|mxn|nok|nzd|pen|pln|ron|sek|sgd|usd|zar)\b)/i;
const PRIVATE_HOST = /(?:^|\.)(?:localhost|notion\.com|notion\.so|notion\.site)$/i;
const BOOKING_SIGNAL = /(?:calendly|cal\.com|hubspot\/meetings|book|booking|agenda|agendar|reservar|cita)/i;
const CHECKOUT_SIGNAL = /(?:checkout|cart|carrito|stripe|paypal|pago|payment|comprar|buy)/i;

function parseArguments(argv) {
  const result = {
    apply: false,
    strict: false,
    queueFile: DEFAULT_QUEUE_FILE,
    outputFile: DEFAULT_OUTPUT_FILE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") result.apply = true;
    else if (argument === "--strict") result.strict = true;
    else if (argument === "--queue") result.queueFile = argv[++index];
    else if (argument === "--output") result.outputFile = argv[++index];
    else if (argument === "--help") result.help = true;
    else throw new Error(`Argumento desconocido: ${argument}`);
  }
  if (!result.queueFile || !result.outputFile) throw new Error("--queue y --output requieren una ruta.");
  return result;
}

function printHelp() {
  console.log(`Uso: node scripts/qa-deep-research.mjs [opciones]

Opciones:
  --output <ruta>  Informe JSON (por defecto: ${DEFAULT_OUTPUT_FILE})
  --queue <ruta>   Cola canónica (por defecto: ${DEFAULT_QUEUE_FILE})
  --strict         Devuelve código 1 si existe cualquier error o bloqueo
  --apply          Escribe el veredicto en queue.items[].qa (nunca implícito)
  --help           Muestra esta ayuda

Sin --apply la cola se abre únicamente en modo lectura.`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJsonIfPresent(path) {
  try {
    return { value: await readJson(path), error: null };
  } catch (error) {
    if (error?.code === "ENOENT") return { value: null, error: "missing" };
    return { value: null, error: String(error?.message || error) };
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizedName(value) {
  return normalized(value).replace(/\b(?:sl|slu|sa|sas|llc|ltd|limited|inc|ou|gmbh)\b/g, "").replace(/\s+/g, " ").trim();
}

function validPublicUrl(candidate) {
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (PRIVATE_HOST.test(url.hostname)) return false;
    if (/^(?:127\.|10\.|192\.168\.|0\.)/.test(url.hostname)) return false;
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}

function containsPrivateReference(value) {
  const serialized = JSON.stringify(value);
  return /https?:\/\/[^\s"']*(?:notion\.(?:com|so)|notion\.site|localhost|127\.0\.0\.1)/i.test(serialized);
}

function nonEmptyEvidence(value) {
  if (Array.isArray(value)) return value.some(nonEmptyEvidence);
  if (value && typeof value === "object") {
    return Object.values(value).some(nonEmptyEvidence);
  }
  return Boolean(text(value));
}

function addIssue(issues, severity, code, message, path, evidence) {
  const issue = { severity, code, message };
  if (path) issue.path = path;
  if (evidence !== undefined) issue.evidence = evidence;
  issues.push(issue);
}

function isCommercialCta(candidate) {
  const label = text(candidate?.text ?? candidate?.label ?? candidate);
  if (!label || label.length < 2 || NUMERIC_ONLY.test(label) || SOCIAL_OR_NAVIGATION.test(label)) return false;
  const href = text(candidate?.href ?? candidate?.destination);
  if (href && /(?:facebook|instagram|linkedin|youtube|tiktok|twitter)\.com/i.test(href)) return false;
  return true;
}

function pageIsUsable(page) {
  const status = Number(page?.status);
  const html = /html|xhtml/i.test(text(page?.contentType));
  const words = Number(page?.textStats?.words || 0);
  const meaningful = Boolean(text(page?.hero) || text(page?.title) || array(page?.headings).length || array(page?.ctas).length || array(page?.forms).length);
  return validPublicUrl(page?.url) && status >= 200 && status < 400 && html && meaningful && words >= 25;
}

function heroEvidenceFor(record, hero) {
  const target = normalized(hero);
  const explicit = array(record?.commercialForensics?.message?.heroEvidence).find((entry) => {
    const candidate = normalized(entry?.text ?? entry?.hero ?? entry?.value);
    return validPublicUrl(entry?.url) && (candidate === target || candidate.includes(target) || target.includes(candidate));
  });
  if (explicit) return explicit.url;
  const page = array(record?.pages).find((candidate) => {
    const pageHero = normalized(candidate?.hero);
    return pageIsUsable(candidate) && pageHero && (pageHero === target || pageHero.includes(target) || target.includes(pageHero));
  });
  return page?.url || null;
}

function structuredCtas(record) {
  return array(record?.pages).flatMap((page) => array(page?.ctas).map((cta) => ({
    ...cta,
    pageUrl: page.url,
  })));
}

function formEvidenceUrl(form) {
  return text(form?.pageUrl ?? form?.url ?? form?.action);
}

function bookingEvidence(record) {
  const conversion = record?.commercialForensics?.conversion || {};
  const direct = array(conversion.bookingEvidence).filter((entry) => validPublicUrl(entry?.url ?? entry?.pageUrl ?? entry));
  const forms = array(conversion.forms).filter((form) => form?.kind === "booking" && validPublicUrl(formEvidenceUrl(form)));
  const pageSignals = array(record?.pages).flatMap((page) => [
    ...array(page?.ctas).filter((cta) => BOOKING_SIGNAL.test(`${text(cta?.text)} ${text(cta?.href)}`)),
    ...array(page?.iframes).filter((iframe) => BOOKING_SIGNAL.test(text(iframe?.src ?? iframe))),
  ]).filter((entry) => nonEmptyEvidence(entry));
  return [...direct, ...forms, ...pageSignals];
}

function checkoutEvidence(record) {
  const conversion = record?.commercialForensics?.conversion || {};
  const direct = array(conversion.checkoutEvidence).filter((entry) => validPublicUrl(entry?.url ?? entry?.pageUrl ?? entry));
  const forms = array(conversion.forms).filter((form) => form?.kind === "checkout" && validPublicUrl(formEvidenceUrl(form)));
  const pageSignals = array(record?.pages).flatMap((page) => array(page?.ctas)
    .filter((cta) => CHECKOUT_SIGNAL.test(`${text(cta?.text)} ${text(cta?.href)}`)));
  return [...direct, ...forms, ...pageSignals];
}

function validatePages(record, review, issues) {
  const pages = array(record?.pages);
  for (const [index, page] of pages.entries()) {
    const path = `record.pages[${index}]`;
    if (!validPublicUrl(page?.url)) addIssue(issues, "error", "PAGE_URL_INVALID", "La página no tiene una URL pública HTTP(S).", `${path}.url`, page?.url);
    const status = Number(page?.status);
    if (!(status >= 200 && status < 400)) addIssue(issues, "error", "PAGE_STATUS_UNUSABLE", "La página conservada no tiene un estado HTTP utilizable.", `${path}.status`, page?.status);
    if (!/html|xhtml/i.test(text(page?.contentType))) addIssue(issues, "error", "PAGE_CONTENT_NOT_HTML", "La página conservada no es HTML utilizable.", `${path}.contentType`, page?.contentType);
    if (!pageIsUsable(page)) addIssue(issues, "warning", "PAGE_CONTENT_THIN", "La página carece de suficiente contenido comercial estructurado para contar como usable.", path, page?.url);
  }
  const usable = pages.filter(pageIsUsable);
  const declaredUsable = record?.commercialForensics?.coverage?.usablePageCount;
  if (Number.isFinite(declaredUsable) && declaredUsable !== usable.length) {
    addIssue(issues, "warning", "USABLE_PAGE_COUNT_MISMATCH", "El contador declarado de páginas usables no coincide con las páginas verificables.", "record.commercialForensics.coverage.usablePageCount", { declared: declaredUsable, computed: usable.length });
  }
  if (/completa/i.test(text(review?.status)) && usable.length === 0) {
    addIssue(issues, "error", "COMPLETE_WITHOUT_USABLE_PAGE", "Una revisión marcada como completa no tiene ninguna página pública usable.", "review.status");
  }
  return usable;
}

function validateHeroes(record, review, issues) {
  const heroes = array(record?.commercialForensics?.message?.heroes).filter(text);
  for (const [index, hero] of heroes.entries()) {
    const url = heroEvidenceFor(record, hero);
    if (!url) addIssue(issues, "error", "HERO_WITHOUT_URL", "Un hero marcado como observado no está unido a una URL pública que lo contenga.", `record.commercialForensics.message.heroes[${index}]`, hero);
  }
  const reviewHero = text(review?.message?.hero);
  const observedReviewHero = heroes.find((hero) => {
    const left = normalized(hero);
    const right = normalized(reviewHero);
    return left && right && (left === right || left.includes(right) || right.includes(left));
  });
  if (reviewHero && observedReviewHero && !heroEvidenceFor(record, observedReviewHero)) {
    addIssue(issues, "error", "REVIEW_HERO_UNSOURCED", "El hero publicado por la revisión parece observado, pero no conserva su URL de evidencia.", "review.message.hero", reviewHero);
  }
}

function validateCtas(record, review, issues) {
  const pageCtas = structuredCtas(record);
  const primary = review?.conversion?.primaryCta;
  if (primary !== null && primary !== undefined && typeof primary !== "string") {
    addIssue(issues, "error", "PRIMARY_CTA_NOT_STRING", "El CTA primario de la revisión debe ser una etiqueta legible.", "review.conversion.primaryCta", primary);
    return;
  }
  const label = text(primary);
  if (!label) return;
  if (!isCommercialCta(label)) addIssue(issues, "error", "PRIMARY_CTA_NOT_COMMERCIAL", "El CTA primario es social, navegación o un valor puramente numérico.", "review.conversion.primaryCta", label);
  const target = normalized(label);
  const matchingCta = pageCtas.find((cta) => {
    const candidate = normalized(cta?.text ?? cta?.label);
    return candidate && (candidate === target || candidate.includes(target) || target.includes(candidate));
  });
  const matchingSubmit = array(record?.commercialForensics?.conversion?.forms).find((form) => normalized(form?.submitText) === target && validPublicUrl(formEvidenceUrl(form)));
  if (!matchingCta && !matchingSubmit) {
    addIssue(issues, "error", "PRIMARY_CTA_UNSTRUCTURED", "El CTA primario no existe como CTA o submit estructurado en una página pública.", "review.conversion.primaryCta", label);
  } else if (matchingCta && (!validPublicUrl(matchingCta.pageUrl) || !isCommercialCta(matchingCta))) {
    addIssue(issues, "error", "PRIMARY_CTA_BAD_EVIDENCE", "La evidencia estructurada del CTA no es comercial o no tiene URL pública.", "review.conversion.primaryCta", matchingCta);
  }
}

function validateFormsAndCapture(record, review, issues) {
  const conversion = record?.commercialForensics?.conversion || {};
  const forms = array(conversion.forms);
  for (const [index, form] of forms.entries()) {
    const path = `record.commercialForensics.conversion.forms[${index}]`;
    if (!text(form?.kind)) addIssue(issues, "error", "FORM_KIND_MISSING", "El formulario no está clasificado por kind.", `${path}.kind`, formEvidenceUrl(form));
    else if (!ALLOWED_FORM_KINDS.has(form.kind)) addIssue(issues, "error", "FORM_KIND_UNKNOWN", "El kind del formulario no pertenece al vocabulario permitido.", `${path}.kind`, form.kind);
    if (!validPublicUrl(formEvidenceUrl(form))) addIssue(issues, "error", "FORM_WITHOUT_URL", "El formulario no conserva una URL pública de evidencia.", path, formEvidenceUrl(form));
    const visibleFields = array(form?.fields).filter((field) => !field?.hidden).length;
    if (Number.isFinite(form?.visibleFieldCount) && form.visibleFieldCount !== visibleFields) {
      addIssue(issues, "warning", "FORM_FIELD_COUNT_MISMATCH", "El recuento de campos visibles no coincide con los campos estructurados.", `${path}.visibleFieldCount`, { declared: form.visibleFieldCount, computed: visibleFields });
    }
  }

  const reviewForms = array(review?.conversion?.forms);
  for (const [index, form] of reviewForms.entries()) {
    const path = `review.conversion.forms[${index}]`;
    if (!text(form?.kind)) addIssue(issues, "error", "REVIEW_FORM_KIND_MISSING", "El formulario publicado en la revisión no declara kind.", `${path}.kind`, formEvidenceUrl(form));
    else if (!ALLOWED_FORM_KINDS.has(form.kind)) addIssue(issues, "error", "REVIEW_FORM_KIND_UNKNOWN", "El formulario publicado usa un kind no permitido.", `${path}.kind`, form.kind);
    if (!validPublicUrl(formEvidenceUrl(form))) addIssue(issues, "error", "REVIEW_FORM_WITHOUT_URL", "El formulario publicado no conserva URL pública.", path, formEvidenceUrl(form));
  }
  if (reviewForms.length && forms.length === 0) addIssue(issues, "error", "REVIEW_FORMS_WITHOUT_RECORD_EVIDENCE", "La revisión publica formularios que no existen en el registro automático de evidencia.", "review.conversion.forms", reviewForms.length);

  const leadForms = forms.filter((form) => form?.isLeadCapture === true || ["commercial", "contact", "lead-magnet", "booking", "checkout"].includes(form?.kind));
  const captureType = text(review?.conversion?.captureType);
  const saysNone = /(?:sin captura|no observable|ninguna|no visible)/i.test(captureType);
  if (saysNone && leadForms.length) addIssue(issues, "error", "CAPTURE_SAYS_NONE_WITH_FORMS", "La revisión declara ausencia de captura, pero existen formularios de conversión.", "review.conversion.captureType", { captureType, leadForms: leadForms.length });
  if (/formulario/i.test(captureType) && leadForms.length === 0) addIssue(issues, "error", "CAPTURE_FORM_WITHOUT_FORM", "La revisión declara captura por formulario sin formulario comercial estructurado.", "review.conversion.captureType", captureType);
  if (/(?:agenda|reserva|cita)/i.test(captureType) && bookingEvidence(record).length === 0) addIssue(issues, "error", "CAPTURE_BOOKING_WITHOUT_EVIDENCE", "La captura se presenta como agenda/reserva sin evidencia pública.", "review.conversion.captureType", captureType);
  if (/(?:checkout|pago|compra)/i.test(captureType) && checkoutEvidence(record).length === 0) addIssue(issues, "error", "CAPTURE_CHECKOUT_WITHOUT_EVIDENCE", "La captura se presenta como checkout/compra sin evidencia pública.", "review.conversion.captureType", captureType);

  const bookingObserved = conversion.bookingObserved === true || review?.conversion?.bookingObserved === true;
  if (bookingObserved && bookingEvidence(record).length === 0) addIssue(issues, "error", "BOOKING_WITHOUT_EVIDENCE", "Se declara agenda observada sin URL, CTA, iframe o formulario que la demuestre.", "record.commercialForensics.conversion.bookingObserved");
  const checkoutObserved = conversion.checkoutObserved === true || review?.conversion?.checkoutObserved === true;
  if (checkoutObserved && checkoutEvidence(record).length === 0) addIssue(issues, "error", "CHECKOUT_WITHOUT_EVIDENCE", "Se declara checkout observado sin URL, CTA o formulario que lo demuestre.", "record.commercialForensics.conversion.checkoutObserved");
}

function validateAmounts(record, review, issues) {
  const evidence = array(record?.commercialForensics?.offer?.evidence?.prices);
  for (const [index, entry] of evidence.entries()) {
    const path = `record.commercialForensics.offer.evidence.prices[${index}]`;
    if (!ALLOWED_AMOUNT_TYPES.has(entry?.amountType)) addIssue(issues, "error", "AMOUNT_TYPE_INVALID", "El importe no tiene un amountType permitido.", `${path}.amountType`, entry?.amountType);
    if (!validPublicUrl(entry?.url)) addIssue(issues, "error", "AMOUNT_WITHOUT_URL", "El importe tipificado no conserva una URL pública.", `${path}.url`, entry?.url);
    if (!MONEY.test(text(entry?.text))) addIssue(issues, "warning", "AMOUNT_WITHOUT_MONEY_TOKEN", "La evidencia tipificada como importe no contiene moneda y cifra reconocibles.", `${path}.text`, entry?.text);
  }
  const typedTexts = evidence.map((entry) => normalized(entry?.text));
  for (const [index, claim] of array(record?.commercialForensics?.offer?.prices).entries()) {
    const value = text(claim);
    if (!MONEY.test(value)) continue;
    const target = normalized(value).slice(0, 80);
    const matched = typedTexts.some((candidate) => candidate && target && (candidate.includes(target) || target.includes(candidate.slice(0, 80))));
    if (!matched) addIssue(issues, "error", "UNTYPED_AMOUNT_CLAIM", "Una señal monetaria publicada como precio no está unida a evidencia con amountType.", `record.commercialForensics.offer.prices[${index}]`, value.slice(0, 260));
  }
  for (const [index, claim] of array(review?.offer?.prices).entries()) {
    const value = text(claim);
    if (!MONEY.test(value) || evidence.length) continue;
    addIssue(issues, "error", "REVIEW_AMOUNT_UNTYPED", "La revisión contiene un importe sin ninguna evidencia monetaria tipificada.", `review.offer.prices[${index}]`, value.slice(0, 260));
  }
}

function validateGuarantees(record, review, issues) {
  const offer = record?.commercialForensics?.offer || {};
  const typed = offer?.evidence || {};
  const buckets = [
    ["guarantee", array(typed.guarantee)],
    ["guaranteeDisclaimers", array(typed.guaranteeDisclaimers)],
    ["guaranteeOther", array(typed.guaranteeOther)],
  ];
  const typedEntries = buckets.flatMap(([, entries]) => entries);
  for (const [bucket, entries] of buckets) {
    for (const [index, entry] of entries.entries()) {
      const path = `record.commercialForensics.offer.evidence.${bucket}[${index}]`;
      if (!ALLOWED_GUARANTEE_POLARITIES.has(entry?.polarity)) addIssue(issues, "error", "GUARANTEE_POLARITY_INVALID", "La evidencia de garantía no tiene polaridad válida.", `${path}.polarity`, entry?.polarity);
      if (!text(entry?.guaranteeType)) addIssue(issues, "error", "GUARANTEE_TYPE_MISSING", "La evidencia de garantía no está tipificada.", `${path}.guaranteeType`);
      if (!validPublicUrl(entry?.url)) addIssue(issues, "error", "GUARANTEE_WITHOUT_URL", "La garantía o disclaimer no conserva URL pública.", `${path}.url`, entry?.url);
      if (bucket === "guaranteeDisclaimers" && entry?.polarity !== "negative") addIssue(issues, "error", "DISCLAIMER_POLARITY_MISMATCH", "Un disclaimer debe tener polaridad negativa.", path, entry);
      if (bucket === "guarantee" && entry?.polarity === "negative") addIssue(issues, "error", "POSITIVE_GUARANTEE_POLARITY_MISMATCH", "Una negación no puede vivir en el bloque de garantías positivas.", path, entry);
    }
  }
  if (array(offer.guarantee).length && typedEntries.length === 0) addIssue(issues, "error", "GUARANTEE_CLAIMS_UNPOLARIZED", "Hay señales de garantía, pero ninguna se separó como promesa, disclaimer u otra garantía.", "record.commercialForensics.offer.guarantee");
  if (array(review?.offer?.guarantee).length && typedEntries.length === 0) addIssue(issues, "error", "REVIEW_GUARANTEE_UNPOLARIZED", "La revisión publica garantía sin evidencia polarizada.", "review.offer.guarantee");
}

function validateStack(record, review, issues) {
  const conversion = record?.commercialForensics?.conversion || {};
  const technologies = array(conversion.technologies).map(text).filter(Boolean);
  const observed = new Set(array(record?.pages).flatMap((page) => array(page?.technologies).map(normalized)).filter(Boolean));
  for (const technology of technologies) {
    if (!observed.has(normalized(technology))) addIssue(issues, "error", "STACK_TECH_UNSUPPORTED", "Una tecnología del stack agregado no aparece en evidencia de página.", "record.commercialForensics.conversion.technologies", technology);
  }
  if (technologies.length > 20) addIssue(issues, "warning", "STACK_SUSPICIOUSLY_LARGE", "El stack observado supera 20 tecnologías y necesita revisión de falsos positivos.", "record.commercialForensics.conversion.technologies", technologies.length);
  const reviewStack = array(review?.conversion?.technologies).map(text).filter(Boolean);
  for (const technology of reviewStack) {
    if (!technologies.some((candidate) => normalized(candidate) === normalized(technology))) addIssue(issues, "error", "REVIEW_STACK_INFLATED", "La revisión añade una tecnología que no está en el registro observado.", "review.conversion.technologies", technology);
  }
}

function commercialActivity(record, review) {
  const conversion = record?.commercialForensics?.conversion || {};
  const typedPrices = array(record?.commercialForensics?.offer?.evidence?.prices).filter((entry) => entry?.amountType === "own_fee_candidate");
  const positiveGuarantees = array(record?.commercialForensics?.offer?.evidence?.guarantee);
  const commercialCtas = structuredCtas(record).filter(isCommercialCta);
  const forms = array(conversion.forms).filter((form) => form?.isLeadCapture === true || ["commercial", "contact", "lead-magnet", "booking", "checkout"].includes(form?.kind));
  const signals = {
    usablePages: array(record?.pages).filter(pageIsUsable).length,
    commercialCtas: commercialCtas.length,
    conversionForms: forms.length,
    booking: conversion.bookingObserved === true || review?.conversion?.bookingObserved === true,
    checkout: conversion.checkoutObserved === true || review?.conversion?.checkoutObserved === true,
    ownPriceEvidence: typedPrices.length,
    positiveGuarantees: positiveGuarantees.length,
  };
  signals.score = Number(signals.commercialCtas > 0) + Number(signals.conversionForms > 0) + Number(signals.booking) + Number(signals.checkout) + Number(signals.ownPriceEvidence > 0) + Number(signals.positiveGuarantees > 0);
  return signals;
}

function validateScope(item, record, review, issues, retainedExclusions) {
  if (!/^excluir\b/i.test(text(item?.scope ?? record?.scope))) return;
  const activity = commercialActivity(record, review);
  if (activity.score > 0 && !retainedExclusions.has(item.id)) {
    addIssue(issues, "blocker", "EXCLUDED_WITH_COMMERCIAL_ACTIVITY", "El registro está en scope Excluir, pero conserva actividad comercial observable; requiere reclasificación humana.", "queue.scope", activity);
  }
}

function manualSourceUrls(manual) {
  return [...array(manual?.sources), ...array(manual?.evidence)]
    .map((source) => text(source?.url ?? source))
    .filter(validPublicUrl);
}

function manualIsVerified(manual) {
  if (!manual || !text(manual.reviewedAt) || manualSourceUrls(manual).length === 0 || containsPrivateReference(manual)) return false;
  const schema = text(manual.schemaVersion);
  if (schema === "rv-funnel-manual-pilot-v1") {
    return array(manual.sources).length > 0
      && array(manual.sources).every((source) => source?.verified === true && validPublicUrl(source?.url))
      && manual?.collectionPolicy?.formsSubmitted === false
      && manual?.collectionPolicy?.companiesContacted === false;
  }
  if (/manual-wave-01/i.test(schema)) {
    return array(manual.sources).length > 0
      && array(manual.sources).every((source) => normalized(source?.status) === "observado" && validPublicUrl(source?.url))
      && manual?.method?.formsSubmitted === false
      && manual?.method?.companyContacted === false;
  }
  const qa = manual.qa;
  if (qa) {
    return qa.allMaterialClaimsHaveEvidence === true
      && qa.observedInferredUnknownSeparated === true
      && qa.formsSubmitted === false
      && qa.privateLinksIncluded === false
      && qa.automaticQueueModified === false;
  }
  return false;
}

function manualHeroEvidence(manual) {
  const direct = array(manual?.messageAndVoice?.evidence)
    .filter((entry) => validPublicUrl(entry?.url) && /observ|verif/i.test(text(entry?.status)));
  if (direct.length) return direct.map((entry) => entry.url);
  const supported = array(manual?.sources).filter((source) => {
    const supports = array(source?.supports).join(" ");
    return validPublicUrl(source?.url) && /(?:message|mensaje|hero|headline|voice|voz|offer|oferta)/i.test(supports);
  });
  if (supported.length) return supported.map((source) => source.url);
  if (text(manual?.schemaVersion) === "rv-funnel-manual-pilot-v1") {
    return array(manual.sources).filter((source) => source?.verified === true && /landing|service|home|headline|offer|pricing/i.test(text(source?.role))).map((source) => source.url);
  }
  return [];
}

function manualForms(manual) {
  return [
    ...array(manual?.observed?.conversion?.forms),
    ...array(manual?.conversion?.forms),
    ...array(manual?.ctaAndForms?.forms),
  ];
}

function validateManual(manual, file, issues) {
  const prefix = `manual:${file}`;
  const headline = text(manual?.observed?.messageAndVoice?.headline ?? manual?.messageAndVoice?.headline ?? manual?.voice?.headline);
  if (headline && manualHeroEvidence(manual).length === 0) addIssue(issues, "error", "MANUAL_HERO_WITHOUT_URL", "El hero manual observado no tiene evidencia URL directa o fuente que declare soporte.", `${prefix}.headline`, headline);

  const primaryObject = manual?.ctaAndForms?.primaryCta;
  const primaryLabel = text(primaryObject?.label ?? manual?.conversion?.primaryCta ?? manual?.observed?.conversion?.primaryCtas?.[0]);
  if (primaryLabel && !isCommercialCta(primaryLabel)) addIssue(issues, "error", "MANUAL_PRIMARY_CTA_NOT_COMMERCIAL", "El CTA manual primario es social, navegación o numérico.", `${prefix}.primaryCta`, primaryLabel);
  if (primaryObject) {
    if (!text(primaryObject.label) || !validPublicUrl(primaryObject.destination)) addIssue(issues, "error", "MANUAL_PRIMARY_CTA_UNSTRUCTURED", "El CTA manual necesita label y destination HTTP(S) públicos.", `${prefix}.ctaAndForms.primaryCta`, primaryObject);
  } else if (primaryLabel) {
    addIssue(issues, "warning", "MANUAL_PRIMARY_CTA_LEGACY_SHAPE", "El CTA manual está documentado como texto, no como objeto label/destination/status.", `${prefix}.primaryCta`, primaryLabel);
  }

  for (const [index, form] of manualForms(manual).entries()) {
    if (!text(form?.kind)) addIssue(issues, "warning", "MANUAL_FORM_KIND_MISSING", "El formulario manual no declara kind; debe normalizarse antes de fusionarlo con la ficha canónica.", `${prefix}.forms[${index}].kind`, form?.url);
    else if (!ALLOWED_FORM_KINDS.has(form.kind)) addIssue(issues, "error", "MANUAL_FORM_KIND_UNKNOWN", "El formulario manual usa un kind no permitido.", `${prefix}.forms[${index}].kind`, form.kind);
    if (!validPublicUrl(form?.url ?? form?.pageUrl)) addIssue(issues, "error", "MANUAL_FORM_WITHOUT_URL", "El formulario manual no tiene URL pública.", `${prefix}.forms[${index}]`, form?.url ?? form?.pageUrl);
  }

  const booking = manual?.conversion?.booking ?? manual?.observed?.conversion?.booking;
  if (booking && /observ/i.test(text(booking?.status ?? "observed")) && manualSourceUrls(manual).length === 0) addIssue(issues, "error", "MANUAL_BOOKING_WITHOUT_EVIDENCE", "La agenda manual observada no tiene fuente pública.", `${prefix}.booking`);

  const pilotPricing = array(manual?.observed?.offer?.pricing).filter((entry) => MONEY.test(text(entry)));
  if (pilotPricing.length) addIssue(issues, "warning", "MANUAL_AMOUNT_LEGACY_SHAPE", "Hay importes manuales en texto libre; deben tipificarse con moneda, concepto, amountType y evidencia antes de publicar.", `${prefix}.observed.offer.pricing`, pilotPricing);
  for (const [index, entry] of array(manual?.commercialTerms?.pricing).entries()) {
    if (MONEY.test(text(entry?.value)) && (!text(entry?.term) || array(entry?.evidenceIds).length === 0)) addIssue(issues, "error", "MANUAL_AMOUNT_UNTYPED", "El importe manual necesita concepto y evidenceIds.", `${prefix}.commercialTerms.pricing[${index}]`, entry);
  }
  const packages = array(manual?.offer?.pricing?.packages);
  if (packages.length && !text(manual?.offer?.pricing?.currency)) addIssue(issues, "error", "MANUAL_PACKAGE_CURRENCY_MISSING", "Los paquetes numéricos manuales no declaran moneda.", `${prefix}.offer.pricing.currency`);

  const manualGuarantee = manual?.observed?.offer?.guarantee ?? manual?.offer?.guarantee ?? manual?.commercialTerms?.guarantee;
  if (nonEmptyEvidence(manualGuarantee)) addIssue(issues, "warning", "MANUAL_GUARANTEE_UNPOLARIZED", "La garantía manual no declara explícitamente polarity y guaranteeType en el esquema normalizado.", `${prefix}.guarantee`);

  const legacyStack = array(manual?.observed?.technology);
  if (legacyStack.length) addIssue(issues, "warning", "MANUAL_STACK_LEGACY_SHAPE", "El stack manual en texto libre no separa tecnología observada, afirmada e inferida.", `${prefix}.observed.technology`, legacyStack);
  for (const [index, entry] of array(manual?.technology).entries()) {
    if (!text(entry?.name) || !text(entry?.status) || !text(entry?.basis)) addIssue(issues, "error", "MANUAL_STACK_UNSUPPORTED", "Cada tecnología manual necesita name, status y basis.", `${prefix}.technology[${index}]`, entry);
  }
  const detected = array(manual?.stack?.detectedOnPublicSite);
  const claimed = new Set(array(manual?.stack?.claimedDeliveryStack).map((entry) => normalized(entry?.technology)));
  for (const [index, entry] of detected.entries()) {
    if (!text(entry?.technology) || !text(entry?.status) || !text(entry?.evidence)) addIssue(issues, "error", "MANUAL_STACK_UNSUPPORTED", "Una tecnología detectada manualmente necesita technology, status y evidence.", `${prefix}.stack.detectedOnPublicSite[${index}]`, entry);
    if (claimed.has(normalized(entry?.technology))) addIssue(issues, "warning", "MANUAL_STACK_DETECTED_AND_CLAIMED", "La misma tecnología figura como detectada y como afirmada; hay que aclarar la naturaleza de la evidencia.", `${prefix}.stack`, entry?.technology);
  }

  if (containsPrivateReference(manual)) addIssue(issues, "blocker", "MANUAL_PRIVATE_REFERENCE", "La evidencia manual contiene una referencia privada o interna.", prefix);
}

async function loadManualEvidence() {
  const entries = [];
  const rootEntries = await readdir(MANUAL_ROOT, { withFileTypes: true });
  const directories = rootEntries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("manual-"))
    .map((entry) => join(MANUAL_ROOT, entry.name))
    .sort();
  for (const directory of directories) {
    let names;
    try {
      names = await readdir(directory);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const name of names.filter((candidate) => candidate.endsWith(".json")).sort()) {
      const file = join(directory, name);
      const result = await readJsonIfPresent(file);
      if (result.value && !text(result.value.name) && !text(result.value.recordId) && !text(result.value.manualEvidenceId)) continue;
      entries.push({ file, manual: result.value, error: result.error });
    }
  }
  return entries;
}

function manualMatches(item, entry) {
  const manual = entry.manual;
  if (!manual) return false;
  const ids = [manual.recordId, manual.id].map(text).filter(Boolean);
  if (ids.includes(item.id)) return true;
  return normalizedName(manual.name) === normalizedName(item.name);
}

function provenanceFor(record, review, manuals) {
  if (manuals.length) {
    return {
      level: manuals.some((entry) => manualIsVerified(entry.manual)) ? "manual_verified" : "manual_draft",
      automaticRecord: Boolean(record),
      automaticReview: Boolean(review),
      manualFiles: manuals.map((entry) => entry.file),
      verifiedManualFiles: manuals.filter((entry) => manualIsVerified(entry.manual)).map((entry) => entry.file),
    };
  }
  return {
    level: record || review ? "automatic_draft" : "missing",
    automaticRecord: Boolean(record),
    automaticReview: Boolean(review),
    manualFiles: [],
    verifiedManualFiles: [],
  };
}

function summarizeIssues(results) {
  const bySeverity = {};
  const byCode = {};
  for (const issue of results.flatMap((result) => result.issues)) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    byCode[issue.code] = (byCode[issue.code] || 0) + 1;
  }
  return {
    bySeverity: Object.fromEntries(Object.entries(bySeverity).sort()),
    byCode: Object.fromEntries(Object.entries(byCode).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))),
  };
}

function verdictFor(issues) {
  if (issues.some((issue) => issue.severity === "blocker")) return "blocked";
  if (issues.some((issue) => issue.severity === "error")) return "fail";
  if (issues.some((issue) => issue.severity === "warning")) return "warning";
  return "pass";
}

function promotionFor(result) {
  const blockingIssues = result.issues.filter((issue) => ["blocker", "error"].includes(issue.severity));
  if (blockingIssues.length === 0) {
    const label = result.provenance.level === "manual_verified"
      ? "Verificada manual"
      : result.collectionStatus === "limited" || /^limitada$/i.test(text(result.reviewStatus))
        ? "Limitada"
        : "Verificada estructural";
    return {
      eligible: true,
      label,
      reason: null,
    };
  }
  const manual = result.provenance.level.startsWith("manual_");
  return {
    eligible: false,
    label: manual ? "Limitada" : "Borrador automático",
    reason: blockingIssues.slice(0, 8).map((issue) => issue.code).join(", "),
  };
}

async function applyResults(queueFile, queue, results, expectedDigest) {
  const currentQueueText = await readFile(queueFile, "utf8");
  if (digest(currentQueueText) !== expectedDigest) {
    throw new Error("La cola cambió durante el QA. No se aplicó nada; ejecuta de nuevo --apply sobre una cola estable.");
  }
  const byId = new Map(results.map((result) => [result.id, result]));
  const appliedAt = new Date().toISOString();
  for (const item of queue.items) {
    const result = byId.get(item.id);
    if (!result) continue;
    const promotion = promotionFor(result);
    item.qa = {
      ...(item.qa || {}),
      status: promotion.eligible ? "complete" : "limited",
      attempts: Number(item.qa?.attempts || 0) + 1,
      updatedAt: appliedAt,
      error: promotion.reason,
      verificationLevel: promotion.label,
      structuralLevel: promotion.label,
      evidenceLevel: result.provenance.level,
    };
  }
  queue.updatedAt = appliedAt;
  await writeJsonAtomic(queueFile, queue);
  return appliedAt;
}

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const queueText = await readFile(options.queueFile, "utf8");
const queue = JSON.parse(queueText);
const manualEvidence = await loadManualEvidence();
const classificationReviewResult = await readJsonIfPresent("research/deep/classification-review-excluded.json");
const retainedExclusions = new Set(
  classificationReviewResult.value?.qa?.passed
    ? array(classificationReviewResult.value.records)
      .filter((record) => /^excluir\b/i.test(text(record?.recommendedScope)) && text(record?.reason))
      .map((record) => text(record.id))
    : [],
);
const results = [];

for (const item of array(queue.items)) {
  const recordPath = item.recordFile ? join("research/deep", item.recordFile) : null;
  const reviewPath = join("research/deep/reviews", `${item.id}.json`);
  const recordResult = recordPath ? await readJsonIfPresent(recordPath) : { value: null, error: "missing" };
  const reviewResult = await readJsonIfPresent(reviewPath);
  const record = recordResult.value;
  const review = reviewResult.value;
  const manuals = manualEvidence.filter((entry) => manualMatches(item, entry));
  const issues = [];

  if (!record) addIssue(issues, "error", "RECORD_MISSING_OR_INVALID", "No se puede leer el registro automático.", recordPath, recordResult.error);
  if (!review) addIssue(issues, "error", "REVIEW_MISSING_OR_INVALID", "No se puede leer la revisión sintetizada.", reviewPath, reviewResult.error);
  if (record && record.id !== item.id) addIssue(issues, "blocker", "RECORD_ID_MISMATCH", "El id del registro no coincide con la cola.", `${recordPath}.id`, record.id);
  if (review && review.id !== item.id) addIssue(issues, "blocker", "REVIEW_ID_MISMATCH", "El id de la revisión no coincide con la cola.", `${reviewPath}.id`, review.id);
  if (record && containsPrivateReference(record)) addIssue(issues, "blocker", "RECORD_PRIVATE_REFERENCE", "El registro contiene una referencia privada o interna.", recordPath);
  if (review && containsPrivateReference(review)) addIssue(issues, "blocker", "REVIEW_PRIVATE_REFERENCE", "La revisión contiene una referencia privada o interna.", reviewPath);

  if (record) {
    validatePages(record, review, issues);
    validateHeroes(record, review, issues);
    validateCtas(record, review, issues);
    validateFormsAndCapture(record, review, issues);
    validateAmounts(record, review, issues);
    validateGuarantees(record, review, issues);
    validateStack(record, review, issues);
    validateScope(item, record, review, issues, retainedExclusions);
  }
  for (const entry of manuals) {
    if (!entry.manual) addIssue(issues, "error", "MANUAL_FILE_INVALID", "No se puede leer la evidencia manual.", entry.file, entry.error);
    else validateManual(entry.manual, relative(".", entry.file), issues);
  }

  const provenance = provenanceFor(record, review, manuals);
  const result = {
    id: item.id,
    name: item.name,
    scope: item.scope,
    collectionStatus: item.collect?.status || null,
    reviewStatus: review?.status || null,
    recordFile: recordPath,
    reviewFile: reviewPath,
    provenance,
    verdict: verdictFor(issues),
    issueCounts: issues.reduce((counts, issue) => {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
      return counts;
    }, {}),
    issues,
  };
  result.promotion = promotionFor(result);
  result.evidenceVerification = provenance.level === "manual_verified"
    ? "Verificada manual"
    : provenance.level === "manual_draft" ? "Borrador manual" : "Borrador automático";
  results.push(result);
}

for (const entry of manualEvidence.filter((candidate) => !array(queue.items).some((item) => manualMatches(item, candidate)))) {
  results.push({
    id: null,
    name: entry.manual?.name || entry.file,
    scope: null,
    recordFile: null,
    reviewFile: null,
    provenance: {
      level: entry.manual && manualIsVerified(entry.manual) ? "manual_verified_orphan" : "manual_draft_orphan",
      automaticRecord: false,
      automaticReview: false,
      manualFiles: [entry.file],
      verifiedManualFiles: entry.manual && manualIsVerified(entry.manual) ? [entry.file] : [],
    },
    verdict: "blocked",
    issueCounts: { blocker: 1 },
    issues: [{ severity: "blocker", code: "MANUAL_EVIDENCE_ORPHAN", message: "La evidencia manual no se pudo unir a una ficha canónica.", path: entry.file }],
    promotion: { eligible: false, label: "Limitada", reason: "MANUAL_EVIDENCE_ORPHAN" },
  });
}

const issueSummary = summarizeIssues(results);
const report = {
  schemaVersion: "rv-funnel-qa-v1",
  generatedAt: new Date().toISOString(),
  mode: options.apply ? "apply" : "read-only",
  queueFile: options.queueFile,
  outputFile: options.outputFile,
  rules: {
    heroObservedRequiresPublicUrl: true,
    primaryCtaRequiresStructuredCommercialEvidence: true,
    captureMustMatchFormsBookingAndCheckout: true,
    everyAutomaticFormRequiresKind: true,
    bookingAndCheckoutRequireEvidence: true,
    monetaryClaimsRequireAmountType: true,
    guaranteesRequirePolarityAndType: true,
    stackMustBeObservedNotInflated: true,
    retainedPagesMustBeUsable: true,
    excludedScopeCommercialActivityIsBlockerUnlessHumanClassificationReviewRetainsIt: true,
    manualVerifiedSeparatedFromAutomaticDraft: true,
  },
  applicationPolicy: {
    warningsAndDocumentedLimitationsBlock: false,
    blockersAndErrorsBlock: true,
    cleanAutomaticLabel: "Verificada estructural",
    verifiedManualEvidenceLabel: "Verificada manual",
    failedManualStructuralLabel: "Limitada",
    failedAutomaticLabel: "Borrador automático",
    optimisticQueueLock: true,
  },
  summary: {
    canonicalRecords: array(queue.items).length,
    results: results.length,
    verdicts: results.reduce((counts, result) => {
      counts[result.verdict] = (counts[result.verdict] || 0) + 1;
      return counts;
    }, {}),
    provenance: results.reduce((counts, result) => {
      counts[result.provenance.level] = (counts[result.provenance.level] || 0) + 1;
      return counts;
    }, {}),
    issues: issueSummary,
    manualFilesRead: manualEvidence.length,
    manualFilesInvalid: manualEvidence.filter((entry) => !entry.manual).length,
    promotionPreview: results.reduce((counts, result) => {
      counts[result.promotion.label] = (counts[result.promotion.label] || 0) + 1;
      return counts;
    }, {}),
    queueModified: false,
  },
  results,
};

await writeJsonAtomic(options.outputFile, report);
if (options.apply) {
  report.summary.queueAppliedAt = await applyResults(options.queueFile, queue, results.filter((result) => result.id), digest(queueText));
  report.summary.queueModified = true;
  await writeJsonAtomic(options.outputFile, report);
}

console.log(JSON.stringify({
  report: options.outputFile,
  mode: report.mode,
  summary: report.summary,
}, null, 2));

if (options.strict && ((issueSummary.bySeverity.blocker || 0) > 0 || (issueSummary.bySeverity.error || 0) > 0)) process.exitCode = 1;
