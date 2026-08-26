import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const capturesDir = path.join(root, "public", "data", "site-captures");
const outputPath = path.join(root, "public", "data", "landing-intelligence.json");

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const clean = (value) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim()
    : "";
const list = (value) =>
  Array.isArray(value) ? [...new Set(value.map(clean).filter(Boolean))] : clean(value) ? [clean(value)] : [];
const median = (values) => {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
};
const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

const normalizeSearch = (value) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const VERTICAL_TERMS = {
  "clinicas-salud": [["clinica", 5], ["paciente", 5], ["dental", 5], ["dentista", 5], ["medico", 4], ["fisioterapia", 5], ["psicologia", 5], ["healthcare", 5], ["medical", 4], ["audiologo", 5], ["audifono", 5]],
  "reformas-hogar": [["reforma", 5], ["obras", 4], ["contratista", 5], ["contractor", 5], ["roofing", 5], ["tejado", 5], ["fontaneria", 5], ["plumbing", 5], ["home improvement", 5], ["cocinas", 3], ["ventanas", 4]],
  "solar-energia": [["solar", 5], ["fotovolta", 5], ["energias renovables", 5], ["renewable", 4], ["bomba de calor", 5], ["heat pump", 5], ["aislamiento", 4]],
  inmobiliario: [["inmobili", 5], ["real estate", 5], ["realtor", 5], ["propietarios vendedores", 5], ["valoracion", 3], ["captacion de propietarios", 5], ["agente inmobiliario", 5]],
  legal: [["abogado", 5], ["despacho", 4], ["bufete", 5], ["law firm", 5], ["attorney", 5], ["lawyer", 5], ["servicios juridicos", 5]],
  "coches-motor": [["concesionario", 5], ["taller mecanico", 5], ["automocion", 5], ["compraventa de coches", 5], ["vehiculo", 3], ["car dealer", 5], ["dealership", 5], ["auto repair", 5]],
  "b2b-sdr": [[" sdr ", 5], ["appointment setting", 5], ["prospeccion b2b", 5], ["cold calling", 5], ["telemarketing", 4], ["reuniones b2b", 5], ["pipeline comercial", 4], ["ventas b2b", 5]],
  "belleza-bienestar": [["centro de estetica", 5], ["peluqueria", 5], ["salon de belleza", 5], ["beauty salon", 5], ["wellness", 4], ["depilacion", 5], ["spa ", 4]],
  "hosteleria-turismo": [["hotel", 5], ["hosteleria", 5], ["turismo", 5], ["restaurante", 5], ["hospitality", 5], ["reservas directas", 4], ["travel", 3]],
  "directorios-marketplaces": [["marketplace", 5], ["directorio", 5], ["comparador", 5], ["plataforma de profesionales", 5], ["solicitar presupuestos", 4], ["proveedores verificados", 4]],
};

const CURATED_VERTICAL_REFERENCES = {
  "clinicas-salud": ["360-clinic-consulting", "auge-salud", "veterclick", "amp-agenciamarketingmedico-es", "medical-marketing-digital-marketing-specialist-worldwide-llc"],
  "reformas-hogar": ["reforleads", "reform-ads", "reformas-leads", "reformedia", "amp-planreforma-com", "amp-reformapresupuesto-com", "amp-tuproreformas-es"],
  "solar-energia": ["leads-energy", "solarix-marketing", "amp-leadbolt-online", "placassolares-es-nettbureau", "solar-leads-estudio"],
  inmobiliario: ["horizzon-media", "inmoads", "agency-mdi", "markulia", "dinnia", "desorbitante"],
  legal: ["expiey", "agemia", "iqlex-solutions-sl", "lexiuris-marketing"],
  "coches-motor": ["marketing-taller"],
  "b2b-sdr": ["amp-getalead-co", "dotramo", "captain-prospect", "ubtcall", "back-in-town-sdr-externalizado", "amp-wanaleads-fr", "wanaleads", "compra-leads-ou"],
  "belleza-bienestar": ["amp-booksy-com", "uebea-salon-solutions"],
  "hosteleria-turismo": ["gastroagencia", "cabana-rentals", "bookline"],
  "directorios-marketplaces": ["certicalia", "habitissimo", "amp-yoojo-fr", "amp-allovoisins-com", "zaask"],
  generalista: ["clientify", "bigpubli"],
};
const curatedVerticalById = new Map();
for (const [verticalId, ids] of Object.entries(CURATED_VERTICAL_REFERENCES)) {
  ids.forEach((id, index) => curatedVerticalById.set(id, { id: verticalId, relevance: 30 - index, curatedRank: index + 1 }));
}

const CTA_FAMILIES = [
  ["audit", "Auditoría o diagnóstico", /auditor|diagn[oó]stic|an[aá]lisis|assessment|audit|encaj|aplicaci[oó]n/i],
  ["booking", "Reserva o llamada", /agenda|reserv|llamada|reuni[oó]n|demo|consulta|cita|book|schedule|rendez-vous|appel/i],
  ["availability", "Disponibilidad territorial", /zona|plaza|disponib|territori|area/i],
  ["quote", "Presupuesto o propuesta", /presupuesto|cotiza|propuesta|devis|quote|budget/i],
  ["contact", "Contacto directo", /contact|habla|escr[ií]be|whatsapp|mensaje|solicitud|demande/i],
  ["start", "Empezar o comprar", /empieza|comienza|probar|prueba|comprar|contrata|start|get started|commencer/i],
];

const HERO_FAMILIES = [
  ["outcome", "Resultado primero", /consigue|genera|obt[eé]n|aumenta|multiplica|llena|atrae|convierte|vende|crece|generate|get more|grow|boost|rempl/i],
  ["pain", "Dolor o contraste", /sin |deja de|cansad|pierdes|problema|mientras|no m[aá]s|stop|without|tired/i],
  ["proof", "Prueba o autoridad declarada", /(?:\b(?:m[aá]s de)\s+\d+|\+\s?\d+|\b\d+\s*(?:%|clientes|empresas|proyectos|casos|a[nñ]os|rese[nñ]as|opiniones|millones?|mil)\b|\b(?:n[uú]mero|n[º°])\s*1\b|\b(?:l[ií]der|trusted by|premiad|certificad|acreditad)\b)/i],
  ["mechanism", "Mecanismo o sistema", /sistema|m[eé]todo|proceso|plataforma|framework|machine|motor/i],
  ["risk", "Reducción de riesgo", /garant|sin riesgo|exclusiv|paga solo|no pagas|guarantee|risk[- ]free/i],
  ["identity", "Categoría o identidad", /somos|agencia|especialistas|expertos|servicio de|we are|agency/i],
];

const familyFor = (value, families) => {
  const text = clean(value);
  const row = families.find(([, , pattern]) => pattern.test(text));
  return row ? { id: row[0], label: row[1] } : { id: "other", label: "Otros enfoques" };
};

const usefulHeadline = (value) => {
  const text = clean(value);
  return text.length >= 12 && text.length <= 180 && !/cookie|privacidad|pol[ií]tica|error|not found|bienvenido a wordpress/i.test(text);
};
const CTA_BOILERPLATE = /^(?:saltar|ir|skip|aller) (?:al |a la |to )?(?:contenido|contenido principal|primary navigation)|^(?:aceptar|accept|acepto|personalizar|personnaliser|consentimiento|denegar|rechazar|cerrar|mostrar detalles|gestionar los servicios|solo funcionales)(?: todas?)?$|^(?:inicio|home|accueil|servicios?|services|nosotros|qui[eé]nes somos|about|blog|faq|precios|productos|funcionalidades|portfolio|podcast|content|expertise|capabilities|integraciones)$/i;
const CTA_ACTION = /\b(?:agenda|agendar|reserv|solicita|solicitar|pedir|pide|calcula|calcular|cotiza|cotizar|presupuesto|propuesta|contact|habla|hablemos|escr[ií]be|whatsapp|mensaje|empieza|empezar|comienza|comenzar|comprar|contrata|probar|prueba|diagn[oó]stic|auditor|an[aá]lisis|consulta|cita|llamada|demo|encaj|aplica|aplicaci[oó]n|book|schedule|request|quote|buy|get started|start|prendre|r[eé]serv|demander|devis|commencer|acheter|rendez-vous|appel)\b/i;
const usefulCta = (value) => {
  const text = clean(value);
  return (
    text.length >= 4 &&
    text.length <= 72 &&
    !CTA_BOILERPLATE.test(text) &&
    !/@|cookie|privacidad|legal|pol[ií]tica|facebook|instagram|linkedin|youtube|men[uú]|t[eé]rminos|condiciones|iniciar sesi[oó]n|crear una cuenta|espacio pro|[a-z]+\.(?:com|es|fr)\/?$/i.test(text) &&
    CTA_ACTION.test(text) &&
    familyFor(text, CTA_FAMILIES).id !== "other"
  );
};

const selectPrimaryCta = (selectedPage, scoredPages, fallback) => {
  const seen = new Set();
  const pages = [selectedPage, ...scoredPages.map((item) => item.page)].filter(Boolean);
  const candidates = [];
  for (const [pageIndex, page] of pages.entries()) {
    for (const [ctaIndex, value] of list(page.text?.ctas).entries()) {
      const text = clean(value);
      const key = normalizeSearch(text);
      if (!usefulCta(text) || seen.has(key)) continue;
      seen.add(key);
      const family = familyFor(text, CTA_FAMILIES);
      candidates.push({
        text,
        score:
          60 +
          (page === selectedPage ? 18 : 0) +
          ({ landing: 12, conversion: 10, homepage: 6 }[page.role] || 0) +
          (text.length >= 8 && text.length <= 44 ? 8 : 0) -
          pageIndex * 2 -
          Math.min(ctaIndex, 8),
        family,
      });
    }
  }
  const cleanFallback = clean(fallback);
  if (usefulCta(cleanFallback) && !seen.has(normalizeSearch(cleanFallback))) {
    candidates.push({ text: cleanFallback, score: 55, family: familyFor(cleanFallback, CTA_FAMILIES) });
  }
  candidates.sort((left, right) => right.score - left.score || left.text.localeCompare(right.text, "es"));
  return candidates[0] || null;
};

const INVALID_SALES_PAGE = /(?:\/|\b)(?:privacy|privacidad|politica(?:-de)?-privacidad|legal|aviso-legal|terms|terminos|condiciones|cookies?|blog|articulo|article|post|author|contacto?|contactar|about|nosotros|tag|category|categorias|medios|ebook|curso|resenas|proyectos|404|error)(?:\/|\b|[-_])/i;
const EDITORIAL_PATH = /\/(?:como|que-es|claves|mejores|evitar|boca-a-boca|noticias|precio-[^/]+-20\d\d)(?:-|\/)/i;
const salesPageScore = (page) => {
  if (!page || page.status !== "captured") return -100;
  const url = clean(page.finalUrl || page.requestedUrl);
  const title = clean(page.title);
  const headline = clean(page.text?.h1);
  const excerpt = clean(page.text?.excerpt);
  const headings = list(page.text?.headings);
  const ctas = list(page.text?.ctas).filter(usefulCta);
  if (INVALID_SALES_PAGE.test(url) || EDITORIAL_PATH.test(url) || /404|not found|error|privacidad|cookies?|condiciones de uso/i.test(`${title} ${headline}`)) return -100;
  if (/publicar el comentario|← anterior|siguiente →|leave a comment/i.test(list(page.text?.ctas).join(" "))) return -100;
  if (!usefulHeadline(headline) && excerpt.length < 350 && headings.length < 3) return -50;
  const roleWeight = { landing: 24, conversion: 20, homepage: 16, pricing: 10, proof: 8 }[page.role] || 0;
  return (
    roleWeight +
    (usefulHeadline(headline) ? 10 : 0) +
    Math.min(10, Math.floor(excerpt.length / 500)) +
    Math.min(8, headings.length) +
    Math.min(6, ctas.length * 2) +
    (/landing|servicio|solucion|demo|presupuesto|contact|consulta|lead|captacion/i.test(url) ? 4 : 0)
  );
};

const NEGATIVE_OBSERVATION = /\b(?:no\s+(?:se\s+)?(?:observa|observado|observ[oó]|publica|publicado|consta|menciona|mencionado|indica|indicado|detecta|detectado|verifica|verificado|comprueba|comprobado|visible|disponible|formaliza|formalizado|localiza|localizado|localiz[oó])|no\s+hay\s+(?:(?:un|una|precios?|tarifas?|garant[ií]as?)\s+)?(?:precio|tarifa|garant[ií]a)?|sin\s+(?:precio|tarifa|garant[ií]a|prueba|evidencia|datos?|promesa)|(?:precio|tarifa|garant[ií]a)\s+(?:p[uú]blic[oa]\s+)?(?:ocult[oa]|a consultar|no disponible)|rechaz[ao]n?\s+(?:expresamente\s+)?(?:las?\s+)?garant[ií]as?|no\s+promet(?:e|en)|not\s+(?:observed|published|available|verified|mentioned)|non\s+(?:publi[eé]|observ[eé]|mentionn[eé]))(?=\s|[.,;:!?)}\]"']|$)/i;
const positiveField = (key, value) => {
  const text = list(value).join(" ");
  if (!text) return false;
  if (key === "price") {
    const monetaryAmounts = text.match(/\d[\d.,]*(?:\s?[-–]\s?\d[\d.,]*)?\s?(?:€|eur(?:os?)?|\$)(?:\s*\/\s*(?:mes|month))?/gi) || [];
    if (monetaryAmounts.length >= 2 || /\b(?:starter|pro|plan|paquete)\b[^.]{0,80}\d[^.]{0,30}(?:€|eur|\$)/i.test(text)) return true;
  }
  if (["price", "guarantee", "proof"].includes(key) && NEGATIVE_OBSERVATION.test(text)) return false;
  if (key === "guarantee" && /\b(?:no garant|no formal|not available)\b/i.test(text)) return false;
  if (key === "proof" && /\b(?:no independent|sin referencias?)\b/i.test(text)) return false;
  return text.length >= 3;
};

const incrementFamily = (map, family, example) => {
  const current = map.get(family.id) || { id: family.id, label: family.label, count: 0, companyIds: [], examples: [] };
  current.count += 1;
  if (example?.companyId && !current.companyIds.includes(example.companyId)) current.companyIds.push(example.companyId);
  if (example && current.examples.length < 4 && !current.examples.some((item) => item.companyId === example.companyId)) {
    current.examples.push(example);
  }
  map.set(family.id, current);
};

const incrementCooccurrence = (map, hero, cta, row) => {
  if (!hero || hero.id === "other" || !cta || cta.id === "other") return;
  const id = `${hero.id}--${cta.id}`;
  const current = map.get(id) || {
    id,
    heroId: hero.id,
    heroLabel: hero.label,
    ctaId: cta.id,
    ctaLabel: cta.label,
    count: 0,
    companyIds: [],
    examples: [],
  };
  current.count += 1;
  if (!current.companyIds.includes(row.companyId)) current.companyIds.push(row.companyId);
  if (current.examples.length < 4) {
    current.examples.push({
      companyId: row.companyId,
      name: row.name,
      headline: row.headline,
      primaryCta: row.primaryCta,
    });
  }
  map.set(id, current);
};

const verticales = await readJson(path.join(root, "public", "data", "verticales.json"));
const companies = await readJson(path.join(root, "public", "data", "companies-index.json"));
const deepIndex = await readJson(path.join(root, "public", "data", "deep", "index.json"));
const landingAnalysis = await readJson(path.join(root, "public", "data", "scrapecreators-landing-analysis.json"));
const companyById = new Map(companies.map((company) => [company.id, company]));
const deepById = new Map(deepIndex.records.map((record) => [record.id, record]));
const landingAnalysisById = new Map((landingAnalysis.items || []).map((record) => [record.id, record]));
const seedVertical = new Map();
for (const vertical of verticales.verticales) {
  for (const reference of vertical.referentes || []) {
    if (!seedVertical.has(reference.id)) seedVertical.set(reference.id, vertical.id);
  }
}

const filenames = (await readdir(capturesDir)).filter((file) => file.endsWith(".json") && file !== "index.json");
const records = await Promise.all(filenames.map((file) => readJson(path.join(capturesDir, file))));

const hasContent = (value) => (Array.isArray(value) ? value.some((item) => clean(item)) : Boolean(clean(value)));
const mergeCommercialReads = (...sources) => {
  const result = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source || {})) {
      if (!hasContent(value)) continue;
      const absence = NEGATIVE_OBSERVATION.test(list(value).join(" "));
      if (absence && hasContent(result[key]) && !NEGATIVE_OBSERVATION.test(list(result[key]).join(" "))) continue;
      result[key] = value;
    }
  }
  return result;
};

const classify = (record, company, selectedPage, read) => {
  const curated = curatedVerticalById.get(record.id);
  if (curated) return { ...curated, confidence: "high", margin: curated.relevance, evidence: "curated" };
  const landingText = normalizeSearch([
    selectedPage?.text?.h1,
    selectedPage?.text?.excerpt,
    ...(selectedPage?.text?.headings || []),
    read?.audience,
    read?.offer,
    read?.headline,
    read?.promise,
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map(clean)
    .join(" "));
  const profileText = normalizeSearch([
    record.name,
    company?.niche,
    company?.offer,
    company?.agencyType,
  ].map(clean).join(" "));
  const scores = Object.entries(VERTICAL_TERMS).map(([id, terms]) => {
    const landingRelevance = terms.reduce((sum, [term, weight]) => sum + (landingText.includes(term) ? weight : 0), 0);
    const profileRelevance = terms.reduce((sum, [term, weight]) => sum + (profileText.includes(term) ? weight : 0), 0);
    const seedTieBreak = seedVertical.get(record.id) === id && landingRelevance > 0 ? 1 : 0;
    return { id, landingRelevance, profileRelevance, score: landingRelevance * 10 + Math.min(profileRelevance, 4) + seedTieBreak };
  });
  scores.sort((a, b) => b.score - a.score || b.landingRelevance - a.landingRelevance || a.id.localeCompare(b.id));
  const first = scores[0];
  const second = scores[1];
  if (!first || first.landingRelevance < 4) {
    return { id: "generalista", relevance: 1, curatedRank: null, confidence: "low", margin: 0, evidence: "generic_landing" };
  }
  const margin = first.landingRelevance - (second?.landingRelevance || 0);
  return {
    id: first.id,
    relevance: first.landingRelevance,
    curatedRank: null,
    confidence: first.landingRelevance >= 9 && margin >= 3 ? "high" : "medium",
    margin,
    evidence: "landing_content",
  };
};

const fieldKeys = ["headline", "promise", "audience", "offer", "mechanism", "primaryCta", "proof", "price", "guarantee", "funnel"];
const universal = {
  companies: records.length,
  eligibleCompanies: 0,
  salesPageCompanies: 0,
  usableCtaCompanies: 0,
  classifiedHeroCompanies: 0,
  pages: 0,
  capturedPages: 0,
  blockedPages: 0,
  failedPages: 0,
  roles: {},
  fields: Object.fromEntries(fieldKeys.map((key) => [key, 0])),
  funnelSteps: [],
  formFields: [],
  ctaFamilies: new Map(),
  heroFamilies: new Map(),
};
const verticalRows = new Map(verticales.verticales.map((vertical) => [vertical.id, []]));
verticalRows.set("generalista", []);

for (const record of records) {
  const company = companyById.get(record.id);
  const translated = record.translation?.spanish || null;
  const read = mergeCommercialReads(
    record.commercialRead || {},
    landingAnalysisById.get(record.id) || {},
    translated || {},
  );
  const pages = Array.isArray(record.pages) ? record.pages : [];
  const capturedPages = pages.filter((page) => page.status === "captured");
  const deep = deepById.get(record.id);
  const fieldsPresent = fieldKeys.filter((key) => positiveField(key, read[key]));
  const funnel = list(read.funnel);
  const scoredPages = capturedPages
    .filter((page) => ["homepage", "landing", "conversion"].includes(page.role))
    .map((page) => ({ page, score: salesPageScore(page) }))
    .sort((a, b) => b.score - a.score);
  const selectedPage = scoredPages[0]?.score >= 20 ? scoredPages[0].page : null;
  const salesPageValid = Boolean(selectedPage);
  const classification = classify(record, company, selectedPage, read);
  const verticalId = classification.id;
  const trustedScope = /^(?:Núcleo|Vertical)/i.test(clean(company?.scope));
  const exactHeadline = usefulHeadline(selectedPage?.text?.h1)
    ? selectedPage.text.h1
    : list(selectedPage?.text?.headings).find(usefulHeadline);
  const selectedCta = selectPrimaryCta(
    selectedPage,
    scoredPages,
    usefulCta(deep?.primaryCta) ? deep.primaryCta : read.primaryCta,
  );
  const headline = clean(exactHeadline || read.headline);
  const primaryCta = clean(selectedCta?.text);
  const example = {
    companyId: record.id,
    name: record.name,
    country: record.primaryCountry,
    headline,
    primaryCta,
    offer: clean(read.offer),
    proof: clean(read.proof),
    price: clean(read.price),
    guarantee: clean(read.guarantee),
    funnelSteps: funnel.length,
    capturedPages: capturedPages.length,
    pageRoles: [...new Set(capturedPages.map((page) => page.role).filter(Boolean))],
    thumbnail: selectedPage?.thumbnail?.file || selectedPage?.image?.file || null,
    sourceUrl: selectedPage?.finalUrl || selectedPage?.requestedUrl || null,
    sourceRole: selectedPage?.role || null,
    salesPageValid,
    trustedScope,
    verticalRelevance: classification.relevance,
    verticalConfidence: classification.confidence,
    verticalEvidence: classification.evidence,
    verticalMargin: classification.margin,
    curatedRank: classification.curatedRank || null,
    completeness: fieldsPresent.length,
    fieldsPresent,
    score:
      (salesPageValid ? 40 : -100) +
      classification.relevance * 5 +
      fieldsPresent.length * 3 +
      Math.min(12, scoredPages[0]?.score || 0) +
      (classification.curatedRank ? 80 - classification.curatedRank * 4 : 0),
  };
  if (!verticalRows.has(verticalId)) verticalRows.set(verticalId, []);
  verticalRows.get(verticalId).push(example);

  universal.pages += pages.length;
  universal.capturedPages += capturedPages.length;
  universal.blockedPages += pages.filter((page) => page.status === "blocked").length;
  universal.failedPages += pages.filter((page) => page.status === "failed").length;
  for (const page of capturedPages) universal.roles[page.role || "other"] = (universal.roles[page.role || "other"] || 0) + 1;
  if (trustedScope) {
    universal.eligibleCompanies += 1;
    for (const key of fieldsPresent) universal.fields[key] += 1;
    if (funnel.length) universal.funnelSteps.push(funnel.length);
    if (Number.isFinite(deep?.minFormFields) && deep.minFormFields > 0) universal.formFields.push(deep.minFormFields);
    if (salesPageValid) universal.salesPageCompanies += 1;
    if (salesPageValid && usefulCta(primaryCta)) {
      universal.usableCtaCompanies += 1;
      incrementFamily(universal.ctaFamilies, familyFor(primaryCta, CTA_FAMILIES), { companyId: record.id, name: record.name, text: primaryCta });
    }
    if (salesPageValid && usefulHeadline(headline)) {
      const family = familyFor(headline, HERO_FAMILIES);
      if (family.id !== "other") universal.classifiedHeroCompanies += 1;
      incrementFamily(universal.heroFamilies, family, { companyId: record.id, name: record.name, text: headline });
    }
  }
}

const normalizeFamilies = (map, sampleSize) => {
  const classified = [...map.values()].reduce((sum, item) => sum + item.count, 0);
  return (
  [...map.values()]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      ...row,
      share: pct(row.count, sampleSize),
      classifiedShare: pct(row.count, classified),
      sampleBase: sampleSize,
    }))
  );
};

const ARCHITECTURE_BY_VERTICAL = {
  "clinicas-salud": "local",
  "reformas-hogar": "local",
  "solar-energia": "local",
  inmobiliario: "local",
  legal: "diagnostic",
  "coches-motor": "local",
  "b2b-sdr": "diagnostic",
  "belleza-bienestar": "booking",
  "hosteleria-turismo": "booking",
  "directorios-marketplaces": "marketplace",
  generalista: "diagnostic",
};
const CTA_DEFAULTS = {
  audit: { mode: "calendar", label: "Solicitar diagnóstico de encaje" },
  booking: { mode: "calendar", label: "Reservar una primera conversación" },
  availability: { mode: "whatsapp", label: "Comprobar disponibilidad" },
  quote: { mode: "whatsapp", label: "Solicitar propuesta y condiciones" },
  contact: { mode: "whatsapp", label: "Hablar con un especialista" },
  start: { mode: "calendar", label: "Comprobar si encaja" },
};
const HERO_ANGLE = { outcome: "outcome", pain: "outcome", proof: "authority", mechanism: "outcome", risk: "risk", identity: "authority" };
const confidenceFor = (sampleSize, ctaCoverage, heroCoverage) => {
  if (sampleSize >= 24 && ctaCoverage >= 55 && heroCoverage >= 45) return "high";
  if (sampleSize >= 8 && ctaCoverage >= 35 && heroCoverage >= 25) return "medium";
  return "low";
};
const universalFieldPresence = Object.fromEntries(
  Object.entries(universal.fields).map(([key, value]) => [key, pct(value, universal.eligibleCompanies)]),
);
const universalCtaFamilies = normalizeFamilies(universal.ctaFamilies, universal.salesPageCompanies);
const universalHeroFamilies = normalizeFamilies(universal.heroFamilies, universal.salesPageCompanies);

const verticalOutput = {};
for (const vertical of [...verticales.verticales, { id: "generalista", label: "Generalista" }]) {
  const rows = (verticalRows.get(vertical.id) || []).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"));
  const qualifiedRows = rows.filter(
    (row) =>
      row.salesPageValid &&
      row.trustedScope &&
      (vertical.id === "generalista"
        ? row.verticalEvidence === "generic_landing"
        : row.verticalConfidence !== "low" && row.verticalRelevance >= 4),
  );
  const ctaMap = new Map();
  const heroMap = new Map();
  const cooccurrenceMap = new Map();
  for (const row of qualifiedRows) {
    const ctaFamily = usefulCta(row.primaryCta) ? familyFor(row.primaryCta, CTA_FAMILIES) : null;
    const heroFamily = usefulHeadline(row.headline) ? familyFor(row.headline, HERO_FAMILIES) : null;
    if (ctaFamily) incrementFamily(ctaMap, ctaFamily, { companyId: row.companyId, name: row.name, text: row.primaryCta });
    if (heroFamily) incrementFamily(heroMap, heroFamily, { companyId: row.companyId, name: row.name, text: row.headline });
    incrementCooccurrence(cooccurrenceMap, heroFamily, ctaFamily, row);
  }
  const fieldPresence = {};
  for (const key of fieldKeys) fieldPresence[key] = pct(qualifiedRows.filter((row) => row.fieldsPresent.includes(key)).length, qualifiedRows.length);
  const ctaFamilies = normalizeFamilies(ctaMap, qualifiedRows.length).slice(0, 6);
  const heroFamilies = normalizeFamilies(heroMap, qualifiedRows.length).slice(0, 6);
  const dominantHero = heroFamilies.find((family) => family.id !== "other" && family.count >= 3) || null;
  const dominantCta = ctaFamilies[0] || null;
  const ctaCoveragePct = pct(qualifiedRows.filter((row) => usefulCta(row.primaryCta)).length, qualifiedRows.length);
  const heroCoveragePct = pct(qualifiedRows.filter((row) => familyFor(row.headline, HERO_FAMILIES).id !== "other").length, qualifiedRows.length);
  const sampleConfidence = confidenceFor(qualifiedRows.length, ctaCoveragePct, heroCoveragePct);
  const fieldDeltas = fieldKeys
    .map((field) => ({ field, presence: fieldPresence[field], universal: universalFieldPresence[field], delta: fieldPresence[field] - universalFieldPresence[field] }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
  const strengths = fieldDeltas.filter((item) => item.delta >= 8).slice(0, 3);
  const opportunities = fieldDeltas
    .filter((item) => ["mechanism", "proof", "price", "guarantee", "primaryCta"].includes(item.field) && (item.presence <= 45 || item.delta <= -5))
    .sort((left, right) => left.presence - right.presence)
    .slice(0, 3);
  const recommendedCta = CTA_DEFAULTS[dominantCta?.id] || CTA_DEFAULTS.audit;
  const recommendations = [
    dominantHero
      ? `El enfoque más visible es «${dominantHero.label}» (${dominantHero.count} de ${qualifiedRows.length}); úsalo como control, no como ganador.`
      : "No hay una apertura dominante con soporte suficiente; prioriza claridad de público, problema y oferta.",
    dominantCta
      ? `El ${ctaCoveragePct}% de la muestra ofrece un CTA comercial recuperable; «${dominantCta.label}» es la familia más observada.`
      : "La evidencia de CTA es insuficiente: define una acción única y comprueba su continuidad hasta el destino.",
    median(qualifiedRows.map((row) => deepById.get(row.companyId)?.minFormFields).filter((value) => Number.isFinite(value) && value > 0))
      ? `El formulario mediano tiene ${median(qualifiedRows.map((row) => deepById.get(row.companyId)?.minFormFields).filter((value) => Number.isFinite(value) && value > 0))} campos; ajusta longitud a intención y fricción, no por imitación.`
      : "No hay muestra suficiente de formularios para fijar una longitud; decide los campos según intención y fricción.",
    `La prueba aparece en ${fieldPresence.proof}% y el mecanismo en ${fieldPresence.mechanism}% de la muestra; cualquier cifra propia debe conservar fuente y periodo.`,
  ];
  const validExamples = qualifiedRows.filter((row) => row.thumbnail && usefulHeadline(row.headline));
  const curatedExamples = validExamples.filter((row) => row.curatedRank).sort((a, b) => a.curatedRank - b.curatedRank);
  const topExamples = (curatedExamples.length ? curatedExamples : validExamples).slice(0, 8);
  verticalOutput[vertical.id] = {
    id: vertical.id,
    label: vertical.label,
    sampleSize: qualifiedRows.length,
    capturedPages: qualifiedRows.reduce((sum, row) => sum + row.capturedPages, 0),
    companiesWithLanding: qualifiedRows.filter((row) => row.pageRoles.includes("landing")).length,
    medianFunnelSteps: median(qualifiedRows.map((row) => row.funnelSteps).filter(Boolean)),
    medianFormFields: median(qualifiedRows.map((row) => deepById.get(row.companyId)?.minFormFields).filter((value) => Number.isFinite(value) && value > 0)),
    fieldPresence,
    ctaFamilies,
    heroFamilies,
    cooccurrences: [...cooccurrenceMap.values()]
      .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))
      .map((row) => ({ ...row, share: pct(row.count, qualifiedRows.length), sampleBase: qualifiedRows.length }))
      .slice(0, 12),
    examples: topExamples,
    recommendations,
    study: {
      confidence: sampleConfidence,
      coverage: {
        eligibleCompanies: qualifiedRows.length,
        heroClassifiedCompanies: qualifiedRows.filter((row) => familyFor(row.headline, HERO_FAMILIES).id !== "other").length,
        heroCoveragePct,
        ctaClassifiedCompanies: qualifiedRows.filter((row) => usefulCta(row.primaryCta)).length,
        ctaCoveragePct,
      },
      dominantHero,
      dominantCta,
      strengths,
      opportunities,
      recommendedDefaults: {
        architecture: ARCHITECTURE_BY_VERTICAL[vertical.id] || "diagnostic",
        angle: HERO_ANGLE[dominantHero?.id] || "outcome",
        ctaMode: recommendedCta.mode,
        ctaLabel: recommendedCta.label,
        formFields: median(qualifiedRows.map((row) => deepById.get(row.companyId)?.minFormFields).filter((value) => Number.isFinite(value) && value > 0)),
      },
      warnings: [
        ...(qualifiedRows.length < 8 ? ["Muestra pequeña: usa el patrón como referencia exploratoria."] : []),
        ...(ctaCoveragePct < 35 ? ["Cobertura de CTA baja: no extrapolar el reparto a todo el vertical."] : []),
        ...(heroCoveragePct < 25 ? ["Cobertura de aperturas baja: muchas páginas no encajan en una familia interpretable."] : []),
      ],
    },
  };
}

const result = {
  schemaVersion: "rv-landing-intelligence-v2",
  generatedAt: new Date().toISOString(),
  source: {
    companies: universal.companies,
    eligibleCompanies: universal.eligibleCompanies,
    salesPageCompanies: universal.salesPageCompanies,
    pages: universal.pages,
    capturedPages: universal.capturedPages,
    blockedPages: universal.blockedPages,
    failedPages: universal.failedPages,
    countries: [...new Set(records.map((record) => record.primaryCountry).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    methodology: "Patrones descriptivos extraídos de capturas públicas y lectura comercial estructurada. No contienen métricas de conversión ni demuestran causalidad.",
    qualityPolicy: "Los patrones excluyen alcances adyacentes, excluidos o en cuarentena; los CTA eliminan navegación, cookies y boilerplate; una selección editorial fija las referencias prioritarias y el resto se clasifica por el contenido de la página capturada.",
  },
  universal: {
    roles: universal.roles,
    medianFunnelSteps: median(universal.funnelSteps),
    medianFormFields: median(universal.formFields),
    fieldPresence: universalFieldPresence,
    ctaFamilies: universalCtaFamilies,
    heroFamilies: universalHeroFamilies,
    dataQuality: {
      eligibleCompanies: universal.eligibleCompanies,
      salesPageCompanies: universal.salesPageCompanies,
      usableCtaCompanies: universal.usableCtaCompanies,
      ctaCoveragePct: pct(universal.usableCtaCompanies, universal.salesPageCompanies),
      classifiedHeroCompanies: universal.classifiedHeroCompanies,
      heroCoveragePct: pct(universal.classifiedHeroCompanies, universal.salesPageCompanies),
    },
    anatomy: [
      { id: "hero", label: "Resultado + público", purpose: "Dejar claro para quién es la página y qué cambio propone." },
      { id: "proof", label: "Prueba temprana", purpose: "Reducir incertidumbre con evidencia identificable, no con adjetivos." },
      { id: "problem", label: "Problema reconocible", purpose: "Nombrar el coste de seguir igual sin exagerar ni asustar." },
      { id: "mechanism", label: "Mecanismo", purpose: "Explicar filtro, entrega, seguimiento y responsabilidades." },
      { id: "qualification", label: "Criterios de encaje", purpose: "Autofiltrar antes del formulario y mejorar la conversación comercial." },
      { id: "offer", label: "Oferta y condiciones", purpose: "Aclarar qué incluye, qué no incluye y qué queda por configurar." },
      { id: "faq", label: "Objeciones", purpose: "Resolver precio, plazo, exclusividad, validez y medición." },
      { id: "conversion", label: "Una acción final", purpose: "Cerrar con un CTA coherente y los campos mínimos necesarios." },
    ],
  },
  verticals: verticalOutput,
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`landing-intelligence: ${result.source.companies} empresas · ${result.source.pages} páginas · ${Object.keys(result.verticals).length} verticales`);
