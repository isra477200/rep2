#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(ROOT, "public", "data");
const OUTPUT_DIR = resolve(DATA_DIR, "site-captures");
const TARGET_MARKETS = new Set(["España", "Francia"]);
const ROLE_ORDER = ["homepage", "landing", "conversion", "pricing", "proof"];
const ROLE_LABELS = {
  homepage: "Página principal",
  landing: "Landing comercial",
  conversion: "Conversión o contacto",
  pricing: "Precios u oferta",
  proof: "Prueba y resultados",
};

const RISKY_PATH = /(?:^|\/)(?:admin|wp-admin|login|log-in|signin|sign-in|logout|log-out|delete|remove|unsubscribe|checkout|payment|cart|account)(?:\/|$)/i;
const UTILITY_PATH = /(?:^|\/)(?:privacy|privacidad|politica-de-privacidad|politica-de-cookies|politica-cookies|politique-de-confidentialite|politique-des-cookies|cookie-policy|cookies?|terms|terminos|conditions|mentions-legales|aviso-legal|legal|cgu|cgv)(?:\/|$)/i;
const EDITORIAL_PATH = /(?:^|\/)(?:blog|articles?|actualidad|news|questions?|faq|guides?|recursos|ressources)(?:\/|$)/i;
const ROLE_PATTERNS = {
  pricing: /(?:^|[/_\s-])(?:pricing|prices?|precios?|tarifas?|tarifs?|prix)(?:[/_\s-]|$)/i,
  proof: /(?:^|[/_\s-])(?:case-stud(?:y|ies)|casos?(?:-de-exito)?|success|succes|resultados?|results?|testimonials?|testimonios?|reviews?|avis|clientes?|nos-succes)(?:[/_\s-]|$)/i,
  conversion: /(?:^|[/_\s-])(?:contact|contacto|contactez|book|booking|demo|agenda|reserva|consulta|quote|devis|form|work-with-us|trabaja-con-nosotros|register|registro|inscri|partners?|partenaires?|professionnels-partenaires)(?:[/_\s-]|$)/i,
};

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanText(value, maxLength = 700) {
  if (value == null) return null;
  const text = String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_`#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const wordBoundary = cut.lastIndexOf(" ");
  return `${cut.slice(0, wordBoundary > maxLength * 0.72 ? wordBoundary : cut.length).trim()}…`;
}

function commercialText(value, maxLength = 700) {
  const text = cleanText(value, maxLength);
  if (!text) return null;
  if (/^(?:n\/?a|desconocid[oa]|ningun[oa] verificable|no (?:localizad[oa]|encontrad[oa]|publicad[oa]|disponible|verificable|observable|determinado|aplica|consta|publica|se (?:localiz[oó]|encontr[oó]|observ[oó]|public[oó]))|precio no publicado|tarifa principal oculta)(?:\b|\s|[.—:;(])/i.test(text)) return null;
  return text;
}

function evidencedText(value, maxLength = 700) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return cleanText(value, maxLength);
  if (typeof value !== "object") return null;
  if (/^(?:no observable|no aplica|desconocido)$/i.test(String(value.status || ""))) return null;
  return commercialText(
    value.statement ?? value.text ?? value.detail ?? value.value ?? value.label ?? null,
    maxLength,
  );
}

function collectTexts(values, { maxItems = 5, maxLength = 360, predicate = () => true } = {}) {
  const output = [];
  const visit = (value) => {
    if (output.length >= maxItems || value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const text = evidencedText(value, maxLength);
    if (text && predicate(text) && !output.includes(text)) output.push(text);
  };
  visit(values);
  return output;
}

function frenchScore(text) {
  const value = ` ${String(text || "").toLocaleLowerCase("fr")} `;
  const words = value.match(/\b(?:votre|vos|vous|nous|pour|avec|sans|chez|des|les|une|est|sont|rendez-vous|devis|travaux|artisans?|entreprises?|croissance|qualifi[eé]s?|prospection|agence|partenaire|offres?)\b/g)?.length || 0;
  return words + (/[àâçéèêëîïôùûüÿœ]/i.test(value) ? 1.5 : 0);
}

function spanishScore(text) {
  const value = ` ${String(text || "").toLocaleLowerCase("es")} `;
  const words = value.match(/\b(?:tu|tus|usted|para|con|sin|los|las|una|es|son|clientes?|empresas?|crecimiento|cualificados?|presupuesto|obras?|profesionales?|agencia|captaci[oó]n|citas?|contactos?|precio|garant[ií]a)\b/g)?.length || 0;
  return words + (/[ñ¿¡]/i.test(value) ? 1.5 : 0);
}

function likelyFrench(text) {
  const french = frenchScore(text);
  return french >= 2 && french > spanishScore(text) + 0.5;
}

function likelySpanish(text) {
  const spanish = spanishScore(text);
  return spanish >= 2 && spanish > frenchScore(text) + 0.5;
}

function normalizeLanguageTag(value) {
  const tag = cleanText(value, 24)?.toLowerCase();
  if (!tag) return null;
  if (tag.startsWith("es")) return "es";
  if (tag.startsWith("fr")) return "fr";
  if (tag.startsWith("en")) return "en";
  if (tag.startsWith("pt")) return "pt";
  return tag.split(/[-_]/)[0] || null;
}

function sourceLanguage(company, funnelV3, deep) {
  const hero = cleanText(deep?.message?.hero, 500);
  if (likelyFrench(hero)) return "fr";
  if (likelySpanish(hero)) return "es";
  const declared = normalizeLanguageTag(funnelV3?.primaryLanguage);
  if (declared) return declared;
  const website = String(company.website || company.domain || "");
  if (/\.fr(?:[/:?#]|$)|\/fr(?:[/?#]|$)/i.test(website)) return "fr";
  if (/\.es(?:[/:?#]|$)|\/es(?:[/?#]|$)/i.test(website)) return "es";
  if ((company.countries || []).includes("Francia")) return "fr";
  if ((company.countries || []).includes("España")) return "es";
  return null;
}

function safeUrl(value, { allowUtility = false } = {}) {
  if (!value) return null;
  const candidate = String(value)
    .trim()
    .replace(/^[<([]+/, "")
    .replace(/[>)\],.;]+$/, "");
  if (!candidate || candidate.length > 2048) return null;
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    if (url.port && !["80", "443"].includes(url.port)) return null;
    if (RISKY_PATH.test(url.pathname) || (!allowUtility && UTILITY_PATH.test(url.pathname))) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid|msclkid)/i.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function siteKey(value) {
  try {
    const labels = new URL(value).hostname.toLowerCase().replace(/^www\./, "").split(".");
    const compoundSuffix = /^(?:co|com|org|net|gov|ac)$/i.test(labels.at(-2) || "");
    return labels.slice(-(compoundSuffix ? 3 : 2)).join(".");
  } catch {
    return null;
  }
}

function isOfficialUrl(value, website) {
  return Boolean(value && website && siteKey(value) && siteKey(value) === siteKey(website));
}

function pathWithTitle(url, title) {
  try {
    return `${new URL(url).pathname} ${title || ""}`.toLocaleLowerCase("es");
  } catch {
    return "";
  }
}

function isHomepage(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    return path === "/" || /^\/(?:es|fr|en|pt)$/i.test(path);
  } catch {
    return false;
  }
}

function inferRole(url, title) {
  const haystack = pathWithTitle(url, title);
  if (ROLE_PATTERNS.pricing.test(haystack)) return "pricing";
  if (ROLE_PATTERNS.proof.test(haystack)) return "proof";
  if (ROLE_PATTERNS.conversion.test(haystack)) return "conversion";
  if (isHomepage(url)) return "homepage";
  return "landing";
}

function extractUrls(text) {
  if (!text) return [];
  return String(text).match(/https?:\/\/[^\s<>"']+/g) || [];
}

function candidatePages(company, detail, funnelV3, deep) {
  const sourceWebsite = safeUrl(company.website || company.domain, { allowUtility: true });
  if (!sourceWebsite) return { website: null, pages: [] };
  const canonicalHome = new URL(sourceWebsite);
  canonicalHome.pathname = "/";
  canonicalHome.search = "";
  canonicalHome.hash = "";
  const website = UTILITY_PATH.test(new URL(sourceWebsite).pathname)
    ? canonicalHome.toString()
    : sourceWebsite;
  const candidates = [];
  const add = (value, title = null, priority = 0, forcedRole = null) => {
    const url = safeUrl(value);
    if (!isOfficialUrl(url, website)) return;
    const role = forcedRole || inferRole(url, title);
    if (role === "landing" && EDITORIAL_PATH.test(new URL(url).pathname)) return;
    candidates.push({ url, title: cleanText(title, 240), priority, role });
  };

  const home = new URL(canonicalHome);
  add(home.toString(), company.name, 100, "homepage");
  add(website, company.name, 110);

  for (const entry of funnelV3?.acquisition?.entryPages || []) {
    add(entry?.url, entry?.title, 90);
  }
  const ctaGroups = [
    funnelV3?.ctaLadder?.primary,
    ...(funnelV3?.ctaLadder?.lowCommitment || []),
    ...(funnelV3?.ctaLadder?.mediumCommitment || []),
    ...(funnelV3?.ctaLadder?.highCommitment || []),
  ];
  for (const cta of ctaGroups) {
    add(cta?.href, cta?.text || cta?.destinationLabel, 95);
    add(cta?.pageUrl, cta?.text, 72);
  }
  for (const item of funnelV3?.evidence || []) add(item?.url, item?.title, 65);
  for (const item of deep?.evidence || []) add(item?.url, item?.label, 55);
  for (const source of detail?.sources || []) add(source, null, 50);
  for (const url of extractUrls(detail?.body)) add(url, null, 35);

  const selected = [];
  const usedUrls = new Set();
  for (const role of ROLE_ORDER) {
    const match = candidates
      .filter((candidate) => candidate.role === role && !usedUrls.has(candidate.url))
      .sort((left, right) => right.priority - left.priority || left.url.localeCompare(right.url))[0];
    if (!match) continue;
    usedUrls.add(match.url);
    selected.push({
      id: `${company.id}-${role}`,
      role,
      label: ROLE_LABELS[role],
      requestedUrl: match.url,
      finalUrl: null,
      title: match.title,
      status: "pending",
      capturedAt: null,
      fullPage: null,
      image: null,
      thumbnail: null,
      text: null,
      issue: null,
    });
  }
  return { website, pages: selected };
}

function mainProof(funnelV3, company) {
  return evidencedText(funnelV3?.messageArchitecture?.manualDimension?.proofDevices)
    || collectTexts(funnelV3?.proofAndTrust?.documentedAssessment, { maxItems: 1, maxLength: 700 })[0]
    || commercialText(company.proof, 700);
}

function funnelSteps(funnelV3, deep, company) {
  const manual = collectTexts(
    (funnelV3?.deliveryOperations?.manualFunnel || []).filter((item) =>
      /^(?:landing|promesa|prueba|cta|captura|cualificaci[oó]n|reserva|propuesta|onboarding|seguimiento)/i.test(item?.sourceStage || ""),
    ),
    { maxItems: 8, maxLength: 360 },
  );
  if (manual.length) return manual;
  const route = cleanText(funnelV3?.deliveryOperations?.publicProcess || deep?.route || company.funnel, 1800);
  return route ? unique(route.split(/\s*(?:→|➜|->)\s*/).map((part) => cleanText(part, 360))).slice(0, 8) : [];
}

function spanishCommercialRead(company, funnelV3, deep) {
  const architecture = funnelV3?.messageArchitecture;
  const manual = architecture?.manualDimension;
  const classification = funnelV3?.classification;
  const economics = funnelV3?.offerEconomics;
  const manualMechanism = collectTexts(manual?.mechanism, { maxItems: 3, maxLength: 360 });
  const mechanism = manualMechanism.length
    ? manualMechanism
    : collectTexts(architecture?.mechanism, { maxItems: 5, maxLength: 360 });
  return {
    headline: evidencedText(manual?.hero) || commercialText(architecture?.headline, 700) || commercialText(deep?.message?.hero, 700),
    promise: evidencedText(manual?.promise) || commercialText(architecture?.promise, 700),
    audience: evidencedText(classification?.manualDimension?.idealCustomer)
      || commercialText(architecture?.audience, 700)
      || commercialText(classification?.audience, 700)
      || commercialText(deep?.offer?.audience, 700)
      || commercialText(company.niche, 700),
    offer: commercialText(economics?.offer, 700)
      || commercialText(company.offer, 700)
      || commercialText(deep?.offer?.existingSummary, 700),
    mechanism,
    primaryCta: commercialText(funnelV3?.ctaLadder?.primary?.text, 500)
      || commercialText(deep?.conversion?.primaryCta, 500)
      || commercialText(company.cta, 500),
    proof: mainProof(funnelV3, company),
    price: commercialText(economics?.publicPriceLocal, 700)
      || commercialText(company.priceLocal, 700)
      || collectTexts(deep?.offer?.prices, { maxItems: 1, maxLength: 700 })[0]
      || null,
    guarantee: commercialText(economics?.guarantee, 700)
      || commercialText(company.guarantee, 700)
      || collectTexts(deep?.offer?.guarantee, { maxItems: 1, maxLength: 700 })[0]
      || null,
    funnel: funnelSteps(funnelV3, deep, company),
  };
}

function extractQuotedOriginal(value) {
  const text = cleanText(value, 900);
  if (!text) return null;
  const quoted = text.match(/[«“"]([^»”"]{3,700})[»”"]/u)?.[1];
  return quoted && likelyFrench(quoted) ? cleanText(quoted, 700) : null;
}

function originalCommercialRead(company, funnelV3, deep, language) {
  if (language === "es") return spanishCommercialRead(company, funnelV3, deep);
  const architecture = funnelV3?.messageArchitecture;
  const economics = funnelV3?.offerEconomics;
  const onlyOriginal = (text) => language !== "fr" || likelyFrench(text);
  const originalHeadline = cleanText(deep?.message?.hero, 700);
  const originalPromise = collectTexts(
    [
      extractQuotedOriginal(architecture?.manualDimension?.subhero),
      architecture?.outcomeLanguage,
      architecture?.promise,
    ],
    { maxItems: 1, maxLength: 700, predicate: onlyOriginal },
  )[0] || null;
  return {
    headline: originalHeadline && onlyOriginal(originalHeadline)
      ? originalHeadline
      : extractQuotedOriginal(architecture?.headline || architecture?.manualDimension?.hero),
    promise: originalPromise,
    audience: collectTexts([architecture?.audience, funnelV3?.classification?.audience], {
      maxItems: 1,
      maxLength: 700,
      predicate: onlyOriginal,
    })[0] || null,
    offer: collectTexts([economics?.offer, deep?.offer?.existingSummary], {
      maxItems: 1,
      maxLength: 700,
      predicate: onlyOriginal,
    })[0] || null,
    mechanism: collectTexts(architecture?.mechanism, {
      maxItems: 5,
      maxLength: 360,
      predicate: onlyOriginal,
    }),
    primaryCta: collectTexts(
      [deep?.conversion?.primaryCta, funnelV3?.ctaLadder?.primary?.text],
      { maxItems: 1, maxLength: 500, predicate: onlyOriginal },
    )[0] || null,
    proof: collectTexts([deep?.offer?.proof, funnelV3?.proofAndTrust?.publicSignals], {
      maxItems: 1,
      maxLength: 700,
      predicate: onlyOriginal,
    })[0] || null,
    price: collectTexts(deep?.offer?.prices, {
      maxItems: 1,
      maxLength: 700,
      predicate: onlyOriginal,
    })[0] || null,
    guarantee: collectTexts([deep?.offer?.guarantee, economics?.guaranteeSignals], {
      maxItems: 1,
      maxLength: 700,
      predicate: onlyOriginal,
    })[0] || null,
    funnel: [],
  };
}

function hasCommercialContent(read) {
  return Object.entries(read).some(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value));
}

function spanishTranslation(company, funnelV3, deep) {
  const read = spanishCommercialRead(company, funnelV3, deep);
  const headline = read.headline;
  if (headline && !likelySpanish(headline)) read.headline = null;
  for (const key of ["promise", "audience", "offer", "primaryCta", "proof", "price", "guarantee"]) {
    if (read[key] && !likelySpanish(read[key])) read[key] = null;
  }
  read.mechanism = read.mechanism.filter(likelySpanish);
  read.funnel = read.funnel.filter(likelySpanish);
  return hasCommercialContent(read) ? read : null;
}

function marketsFor(company) {
  return unique([
    ...(company.countries || []),
    ...(company.markets || []),
    company.primaryCountry,
  ]);
}

function selectedIdsFromArgs(argv = process.argv.slice(2)) {
  const index = argv.indexOf("--ids");
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--ids requiere una lista separada por comas.");
  const ids = new Set(value.split(",").map((id) => id.trim()).filter(Boolean));
  if (!ids.size) throw new Error("--ids no contiene IDs válidos.");
  return ids;
}

const companies = await readJson(resolve(DATA_DIR, "companies-index.json"));
const requestedIds = selectedIdsFromArgs();
const selected = companies
  .filter((company) => (company.countries || []).some((country) => TARGET_MARKETS.has(country)))
  .filter((company) => !requestedIds || requestedIds.has(company.id))
  .sort((left, right) => left.id.localeCompare(right.id, "es"));

if (requestedIds) {
  const selectedIds = new Set(selected.map((company) => company.id));
  const missing = [...requestedIds].filter((id) => !selectedIds.has(id));
  if (missing.length) throw new Error(`IDs fuera del catálogo España/Francia: ${missing.join(", ")}`);
}

await mkdir(OUTPUT_DIR, { recursive: true });

const stats = {
  total: selected.length,
  pending: 0,
  noUrl: 0,
  spain: 0,
  france: 0,
  bothMarkets: 0,
  withFunnelV3: 0,
  withDeep: 0,
  withSpanishTranslation: 0,
  plannedPages: 0,
  roles: Object.fromEntries(ROLE_ORDER.map((role) => [role, 0])),
};

for (const company of selected) {
  const [detail, funnelV3, deep] = await Promise.all([
    readOptionalJson(resolve(DATA_DIR, "company-details", `${company.id}.json`)),
    readOptionalJson(resolve(DATA_DIR, "funnel-v3", "records", `${company.id}.json`)),
    readOptionalJson(resolve(DATA_DIR, "deep", "records", `${company.id}.json`)),
  ]);
  const { website, pages } = candidatePages(company, detail, funnelV3, deep);
  const language = sourceLanguage(company, funnelV3, deep);
  const translationRead = language !== "es" && (company.countries || []).includes("Francia")
    ? spanishTranslation(company, funnelV3, deep)
    : null;
  const status = website ? "pending" : "no_url";
  const manifest = {
    schemaVersion: "rv-site-captures-v1",
    id: company.id,
    name: company.name,
    primaryCountry: company.primaryCountry,
    markets: marketsFor(company),
    website,
    status,
    coverage: {
      planned: pages.length,
      captured: 0,
      failed: 0,
    },
    language: {
      original: language,
      translationStatus: language === "es"
        ? "not_needed"
        : translationRead
          ? "spanish_summary_available"
          : "not_available",
    },
    commercialRead: originalCommercialRead(company, funnelV3, deep, language),
    ...(translationRead ? {
      translation: {
        sourceLanguage: language,
        status: "existing_spanish_summary",
        spanish: translationRead,
      },
    } : {}),
    pages,
  };

  await writeFile(
    resolve(OUTPUT_DIR, `${company.id}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  stats[status === "pending" ? "pending" : "noUrl"] += 1;
  if ((company.countries || []).includes("España")) stats.spain += 1;
  if ((company.countries || []).includes("Francia")) stats.france += 1;
  if ((company.countries || []).includes("España") && (company.countries || []).includes("Francia")) stats.bothMarkets += 1;
  if (funnelV3) stats.withFunnelV3 += 1;
  if (deep) stats.withDeep += 1;
  if (translationRead) stats.withSpanishTranslation += 1;
  stats.plannedPages += pages.length;
  for (const page of pages) stats.roles[page.role] += 1;
}

console.log(JSON.stringify(stats, null, 2));
