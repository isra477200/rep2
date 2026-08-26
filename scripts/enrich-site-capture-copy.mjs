#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_DIR = resolve(ROOT, "public", "data", "site-captures");
const PROVENANCE_SCHEMA = "rv-site-capture-copy-provenance-v1";

const INVALID_SURFACE_TEXT = /(?:cookie|politique de confidentialit[eé]|pol[ií]tica de privacidad|privacy policy|mentions l[eé]gales|aviso legal|conditions? g[eé]n[eé]rales|terms (?:and conditions|of use)|access denied|just a moment|verify you are human|captcha|page (?:not found|introuvable)|p[aá]gina no encontrada|erreur 404|error 404)/i;
const INVALID_H1 = /^(?:home|homepage|accueil|inicio|bienvenue|welcome|nous utilisons des cookies.*|utilizamos cookies.*|we use cookies.*)$/i;
const NAVIGATION_CTA = /^(?:skip to (?:content|primary navigation)|aller au contenu|saltar al contenido|ir al contenido|back to homepage.*|page d'accueil|accueil|inicio|home|menu|services?|nos services|prestations|expertise|[aà] propos|about(?: us)?|entreprise|ressources?|recursos|blog|articles?|actualit[eé]s|news|faq|fr|en|es|pt|linkedin|facebook|instagram|youtube|google play|app store|contact|contacto|×|___|suivant|pr[eé]c[eé]dent|go to slide \d+)$/i;
const COOKIE_CTA = /^(?:tout accepter|tout refuser|accepter tout|rejeter tout|rechazar todas|aceptar todas|g[eé]rer mes pr[eé]f[eé]rences|personnaliser|configurar|only necessary|accept all|reject all|visit cookieyes website)$/i;
const CTA_INTENT = /(?:s['’]?inscrire|cr[eé]er un compte|commencer|prendre (?:un )?rendez-vous|prendre rdv|rendez-vous|\brdv\b|r[eé]server|r[eé]servation|demander|demandez|demande|devis|diagnostic|audit|contactez-nous|nous contacter|travaillons ensemble|parler [aà] un expert|discuter de mon projet|obtenir|recevoir|d[eé]couvrir|en savoir plus|voir (?:nos |les )?(?:r[eé]sultats|tarifs)|je propose mes services|je m['’]inscris|publier? (?:un |votre )?projet|solicita|solicitar|agenda|agendar|reservar|reserva|\bconsulta(?:r)?\b|presupuesto|contacta(?:r| con nosotros)?|hablemos|hablar con|descubre|empieza|comenzar|prueba|m[aá]s informaci[oó]n|comprueba|cotizaci[oó]n|registr(?:ar|arse)|\bbook(?: a| your)?\b|schedule|request|free (?:call|audit|consultation|demo)|get started|start now|contact us|learn more|\btry\b|quote|\bdemo\b)/i;
const MECHANISM_HEADING = /(?:comment|m[eé]thod|process|fonction|[eé]tapes?|phases?|approche|syst[eè]me|install|op[eé]r|g[eé]n[eé]r|acquisition|qualification|qualifi[eé]|ciblage|d[eé]ploiement|analyse|livraison|workflow|publiez|r[eé]pondent|consultez|choisissez|engagez|how (?:it|we) work|method|process|system|steps?|install|operat|generat|acquisition|qualification|targeting|delivery|c[oó]mo (?:funciona|trabaj|crea|gener|capt|consegu|hacemos|ayud|se |usar)|m[eé]tod|proceso|sistema|fases?|estrategia|captaci[oó]n|generaci[oó]n|cualificaci[oó]n|segmentaci[oó]n|entrega|funciona)/i;

function parseArgs(argv) {
  const args = { ids: [], dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--ids") args.ids = String(argv[++index] || "").split(",").filter(Boolean);
    if (argv[index] === "--dry-run") args.dryRun = true;
  }
  return args;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isEmpty(value) {
  return Array.isArray(value) ? value.length === 0 : !clean(value);
}

function isValidH1(value) {
  const text = clean(value);
  return text.length >= 5
    && text.length <= 240
    && !INVALID_SURFACE_TEXT.test(text)
    && !INVALID_H1.test(text);
}

function isCommercialCta(value) {
  const text = clean(value);
  if (text.length < 3 || text.length > 160) return false;
  if (INVALID_SURFACE_TEXT.test(text) || NAVIGATION_CTA.test(text) || COOKIE_CTA.test(text)) return false;
  if (/[a-zà-ÿ][A-ZÀ-Ý]/.test(text) || /[?!][A-ZÀ-Ý]/.test(text) || (text.match(/contact/gi) || []).length > 1) return false;
  if (/^(?:mailto:|tel:)|^[^\s@]+@[^\s@]+\.[^\s@]+$|^\+?[\d\s().-]{7,}$/.test(text)) return false;
  return CTA_INTENT.test(text);
}

function isMechanismHeading(value, headline) {
  const text = clean(value);
  if (text.length < 8 || text.length > 240 || text === clean(headline)) return false;
  if (INVALID_SURFACE_TEXT.test(text) || INVALID_H1.test(text)) return false;
  if (/^[\d\s%+.,€$£-]+$/.test(text)) return false;
  return MECHANISM_HEADING.test(text);
}

function capturedPages(record) {
  return (record.pages || []).filter((page) => page.status === "captured" && page.text);
}

function evidence(page, sourcePath, value) {
  return {
    pageId: page.id,
    pageRole: page.role,
    sourcePath,
    value,
    capturedAt: page.capturedAt || null,
  };
}

function firstHeadline(pages) {
  for (const page of pages) {
    const value = clean(page.text?.h1);
    if (isValidH1(value)) return { value, evidence: [evidence(page, "pages[].text.h1", value)] };
  }
  return null;
}

function firstPrimaryCta(pages) {
  for (const page of pages) {
    for (const raw of page.text?.ctas || []) {
      const value = clean(raw);
      if (isCommercialCta(value)) return { value, evidence: [evidence(page, "pages[].text.ctas[]", value)] };
    }
  }
  return null;
}

function mechanismHeadings(pages, headline) {
  const seen = new Set();
  const matches = [];
  for (const page of pages) {
    for (const raw of page.text?.headings || []) {
      const value = clean(raw);
      const key = value.toLocaleLowerCase("es");
      if (seen.has(key) || !isMechanismHeading(value, headline)) continue;
      seen.add(key);
      matches.push({ value, page });
      if (matches.length === 5) break;
    }
    if (matches.length === 5) break;
  }
  if (matches.length < 2) return null;
  return {
    value: matches.map((item) => item.value),
    evidence: matches.map((item) => evidence(item.page, "pages[].text.headings[]", item.value)),
  };
}

function funnelFromPages(pages) {
  const seen = new Set();
  const rows = [];
  for (const page of pages) {
    const value = `${clean(page.label) || clean(page.role)} · ${clean(page.role)}`;
    if (seen.has(value)) continue;
    seen.add(value);
    rows.push({ value, page });
  }
  if (!rows.length) return null;
  return {
    value: rows.map((item) => item.value),
    evidence: rows.map((item) => evidence(item.page, "pages[].label + pages[].role", item.value)),
  };
}

function fieldProvenance(method, result, enrichedAt) {
  return {
    source: "captured_site_text",
    method,
    enrichedAt,
    evidence: result.evidence,
  };
}

export function enrichRecord(input, enrichedAt = new Date().toISOString()) {
  const record = structuredClone(input);
  if (!record.commercialRead || typeof record.commercialRead !== "object") {
    return { record, changed: false, fields: [] };
  }
  const pages = capturedPages(record);
  if (!pages.length) return { record, changed: false, fields: [] };

  const candidates = {
    headline: isEmpty(record.commercialRead.headline) ? firstHeadline(pages) : null,
    primaryCta: isEmpty(record.commercialRead.primaryCta) ? firstPrimaryCta(pages) : null,
    mechanism: isEmpty(record.commercialRead.mechanism)
      ? mechanismHeadings(pages, record.commercialRead.headline || firstHeadline(pages)?.value)
      : null,
    funnel: isEmpty(record.commercialRead.funnel) ? funnelFromPages(pages) : null,
  };
  const methods = {
    headline: "first_valid_h1_exact",
    primaryCta: "first_filtered_commercial_cta_exact",
    mechanism: "commercial_headings_exact",
    funnel: "captured_page_labels_and_roles",
  };
  const fields = Object.entries(candidates).filter(([, result]) => result);
  if (!fields.length) return { record, changed: false, fields: [] };

  const previous = record.commercialReadProvenance || {};
  const previousFields = previous.fields && typeof previous.fields === "object" ? previous.fields : {};
  record.commercialReadProvenance = {
    ...previous,
    schemaVersion: PROVENANCE_SCHEMA,
    updatedAt: enrichedAt,
    fields: { ...previousFields },
  };
  for (const [field, result] of fields) {
    record.commercialRead[field] = result.value;
    record.commercialReadProvenance.fields[field] = fieldProvenance(methods[field], result, enrichedAt);
  }
  record.commercialReadEnrichedAt = enrichedAt;
  return { record, changed: true, fields: fields.map(([field]) => field) };
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export async function enrichSiteCaptureCopy({ ids = [], dryRun = false, enrichedAt = new Date().toISOString() } = {}) {
  const selected = new Set(ids);
  const names = (await readdir(MANIFEST_DIR))
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .sort();
  const stats = {
    scanned: 0,
    withCapturedPages: 0,
    updated: 0,
    dryRun,
    fields: { headline: 0, primaryCta: 0, mechanism: 0, funnel: 0 },
  };

  for (const name of names) {
    const path = resolve(MANIFEST_DIR, name);
    const originalRaw = await readFile(path, "utf8");
    const original = JSON.parse(originalRaw);
    if (selected.size && !selected.has(original.id)) continue;
    stats.scanned += 1;
    if (capturedPages(original).length) stats.withCapturedPages += 1;
    let result = enrichRecord(original, enrichedAt);
    if (!result.changed) continue;

    if (!dryRun) {
      const latestRaw = await readFile(path, "utf8");
      if (latestRaw !== originalRaw) result = enrichRecord(JSON.parse(latestRaw), enrichedAt);
      if (!result.changed) continue;
      await writeJsonAtomic(path, result.record);
    }
    stats.updated += 1;
    for (const field of result.fields) stats.fields[field] += 1;
  }
  return stats;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  console.log(JSON.stringify(await enrichSiteCaptureCopy(args), null, 2));
}
