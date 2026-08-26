import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

const INPUTS = {
  corpus: "public/data/ad-corpus.json",
  companies: "public/data/companies-index.json",
  landingIntelligence: "public/data/landing-intelligence.json",
  landingAnalysis: "public/data/scrapecreators-landing-analysis.json",
  captureIndex: "public/data/site-captures/index.json",
};

const OUTPUT = "public/data/ad-landing-audit.json";

const QUALITY_DIMENSIONS = [
  { id: "promise", label: "Continuidad de promesa", weight: 22 },
  { id: "audience", label: "Continuidad de audiencia", weight: 12 },
  { id: "offerMechanism", label: "Oferta y mecanismo", weight: 18 },
  { id: "cta", label: "Continuidad de CTA", weight: 14 },
  { id: "proof", label: "Respaldo de la promesa", weight: 10 },
  { id: "commercialTerms", label: "Garantía y precio", weight: 8 },
  { id: "destinationFriction", label: "Destino y fricción", weight: 10 },
];

const CAPTURE_DIMENSION = {
  id: "captureCoverage",
  label: "Cobertura de captura",
  weight: 0,
};

const QUALITY_WEIGHT = QUALITY_DIMENSIONS.reduce(
  (total, dimension) => total + dimension.weight,
  0,
);

const STOP_WORDS = new Set(
  [
    "a",
    "al",
    "algo",
    "ante",
    "con",
    "contra",
    "como",
    "de",
    "del",
    "desde",
    "donde",
    "el",
    "ella",
    "en",
    "entre",
    "es",
    "esta",
    "este",
    "estos",
    "ha",
    "hasta",
    "la",
    "las",
    "lo",
    "los",
    "mas",
    "mi",
    "no",
    "nos",
    "o",
    "para",
    "pero",
    "por",
    "que",
    "se",
    "sin",
    "su",
    "sus",
    "te",
    "tu",
    "tus",
    "un",
    "una",
    "y",
    "ya",
    "your",
    "the",
    "and",
    "for",
    "from",
    "with",
    "you",
  ].map(normalizeText),
);

const CONCEPT_GROUPS = {
  outcomes: {
    leads: /\b(?:lead|leads|prospect\w*|contactos? cualificad\w*|oportunidad(?:es)? comercial\w*)\b/i,
    appointments: /\b(?:citas?|reuniones?|agenda(?:r|mos|da)?|appointment\w*|demo(?:stracion)?)\b/i,
    clients: /\b(?:clientes?|pacientes?|compradores?|alumnos?|matricul\w*)\b/i,
    sales: /\b(?:ventas?|factur\w*|ingresos?|cerrar|conversion(?:es)?|rentabilidad|roi)\b/i,
    growth: /\b(?:crecer|crecimiento|escalar|multiplic\w*|resultados?|pipeline)\b/i,
    savings: /\b(?:ahorr\w*|reduc\w* costes?|menos coste|cpl|coste por lead)\b/i,
    visibility: /\b(?:visibilidad|posicionamiento|trafico|alcance|reputacion)\b/i,
  },
  audiences: {
    b2b: /\b(?:b2b|empresas?|negocios?|pymes?|equipos? comercial\w*|directivos?|ceos?)\b/i,
    health: /\b(?:clinicas?|dentales?|dentistas?|medicos?|sanitari\w*|pacientes?|fisioterap\w*|salud)\b/i,
    realEstate: /\b(?:inmobiliari\w*|agentes? inmobiliari\w*|promotor\w*|propietarios?|viviendas?)\b/i,
    legal: /\b(?:abogados?|despachos?|juridic\w*|legal|concursal\w*)\b/i,
    homeServices: /\b(?:reformas?|construct\w*|fontaner\w*|cerrajer\w*|hogar|obras?)\b/i,
    solar: /\b(?:solar(?:es)?|fotovoltaic\w*|energia|placas?)\b/i,
    automotive: /\b(?:coches?|vehiculos?|automocion|talleres?|concesionari\w*)\b/i,
    hospitality: /\b(?:hoteles?|restaurantes?|hosteleri\w*|turismo)\b/i,
    ecommerce: /\b(?:ecommerce|e-commerce|tiendas? online|shopify)\b/i,
    education: /\b(?:coaches?|formadores?|academias?|escuelas?|cursos?|alumnos?)\b/i,
    local: /\b(?:negocios? locales?|comercios?|profesionales? locales?)\b/i,
  },
  mechanisms: {
    paidMedia: /\b(?:meta ads|facebook ads|instagram ads|google ads|publicidad|campanas? de pago|paid media)\b/i,
    outbound: /\b(?:outbound|prospeccion|cold email|email frio|linkedin|llamadas? en frio|sdr)\b/i,
    automation: /\b(?:automatiz\w*|inteligencia artificial|\bia\b|crm|workflow|agentes? de voz)\b/i,
    seo: /\b(?:seo|posicionamiento organico|buscadores?|google maps)\b/i,
    funnel: /\b(?:embudo|funnel|landing|vsl|webinar|lead magnet)\b/i,
    qualification: /\b(?:cualific\w*|filtr\w*|valid\w*|perfil ideal|scoring)\b/i,
    nurturing: /\b(?:nutricion|nurtur\w*|seguimiento|remarketing)\b/i,
    marketplace: /\b(?:marketplace|directorio|presupuestos?|comparador)\b/i,
    consulting: /\b(?:consultoria|auditoria|diagnostico|estrategia|mentoria)\b/i,
    training: /\b(?:formacion|curso|programa|masterclass|taller|comunidad)\b/i,
  },
};

const VERTICAL_RULES = [
  ["clinicas-salud", /clinica|salud|dental|dentist|medic|pacient|fisioterap|veterin|audifon/i],
  ["reformas-hogar", /reforma|hogar|obra|constru|fontaner|cerrajer|piscina|tejado/i],
  ["solar-energia", /solar|fotovolta|energia|placas/i],
  ["inmobiliario", /inmobil|real estate|vivienda|propiedad|hipoteca/i],
  ["legal", /abogad|jurid|legal|despacho|concursal/i],
  ["coches-motor", /coche|vehicul|automoc|motor|taller|concesion/i],
  ["b2b-sdr", /\bb2b\b|sdr|outbound|appointment|reunion|prospeccion/i],
  ["directorios-marketplaces", /marketplace|directorio|presupuesto|comparador|profesional/i],
  ["belleza-bienestar", /belleza|estetica|peluquer|salon|spa|bienestar/i],
  ["hosteleria-turismo", /hotel|hosteler|restaurante|turismo|alojamiento/i],
];

const IRRELEVANT_DESTINATION =
  /(?:politica|privacy|privacidad|legal|aviso|cookies?|terms?|empleo|login|signin)(?:\/|$|[?#-])/i;
const SOCIAL_DESTINATION =
  /(?:^|\.)(?:facebook\.com|fb\.me|instagram\.com|linkedin\.com|tiktok\.com|youtube\.com)$/i;
const PLACEHOLDER_TEXT =
  /^(?:no (?:se )?(?:observo|observó|localizo|localizó|dispone|consta|identificado|identificó|declarad\w*)|no declarad\w*|no disponible|sin (?:dato|evidencia|informacion|información)|n\/a|desconocido)/i;
const AD_VIEWER_BOILERPLATE =
  /(?:la informacion sobre este anuncio puede variar segun la ubicacion|inicio grupo .+ detalles del anuncio|detalles del anuncio preguntas frecuentes|anuncios mostrados en en cualquier ubicacion)/i;

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9€%+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function excerpt(value, maximum = 260) {
  const text = clean(value);
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 1).trimEnd()}…`;
}

function observed(value) {
  const text = clean(value);
  return Boolean(text && !PLACEHOLDER_TEXT.test(normalizeText(text)));
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function normalUrl(value) {
  try {
    const url = new URL(clean(value));
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    const removable = [];
    for (const key of url.searchParams.keys()) {
      if (/^(?:utm_.+|fbclid|gclid|campaign|campaign_id|ad_id|hsa_.+)$/i.test(key)) {
        removable.push(key);
      }
    }
    for (const key of removable) url.searchParams.delete(key);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function safeUrlParts(value) {
  try {
    const url = new URL(value);
    return {
      href: url.href,
      host: url.hostname.toLowerCase().replace(/^www\./, ""),
      path: url.pathname.replace(/\/+$/, "") || "/",
    };
  } catch {
    return null;
  }
}

function isPoorDestination(value) {
  const parts = safeUrlParts(value);
  if (!parts) return true;
  return SOCIAL_DESTINATION.test(parts.host) || IRRELEVANT_DESTINATION.test(parts.path);
}

function tokens(value) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  );
}

function tokenSimilarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function detectConcepts(value, group) {
  const text = normalizeText(value);
  return Object.entries(CONCEPT_GROUPS[group])
    .filter(([, pattern]) => pattern.test(text))
    .map(([id]) => id);
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function adCopy(ad) {
  return clean(
    [ad.titular, ad.texto, ad.descripcion, ad.cta, ad.transcripcion]
      .filter(Boolean)
      .join(" · "),
  );
}

function isAuditReadyAd(ad) {
  if (ad.aptaPatrones === false || ad.copyAvailable === false) return false;
  const copy = adCopy(ad);
  if (!copy) return false;
  const normalized = normalizeText(copy);
  if (!AD_VIEWER_BOILERPLATE.test(normalized)) return true;
  const commercialConcepts = [
    ...detectConcepts(copy, "outcomes"),
    ...detectConcepts(copy, "audiences"),
    ...detectConcepts(copy, "mechanisms"),
  ];
  const withoutViewer = normalized
    .replace(/la informacion sobre este anuncio puede variar segun la ubicacion/g, "")
    .replace(/anuncios mostrados en en cualquier ubicacion/g, "")
    .replace(/detalles del anuncio preguntas frecuentes/g, "")
    .replace(/inicio grupo\w*/g, "")
    .trim();
  return commercialConcepts.length >= 2 && withoutViewer.length >= 100;
}

function adReference(ad) {
  return {
    id: clean(ad.externalId || ad.observedId || ad.corpusKey),
    corpusKey: clean(ad.corpusKey),
    title: excerpt(ad.titular, 150),
    copy: excerpt(adCopy(ad), 330),
    cta: clean(ad.cta),
    sourceUrl: normalUrl(ad.sourceUrl || ad.fuenteUrl),
    landingUrl: normalUrl(ad.landingUrl),
  };
}

function deduplicateAds(ads) {
  const seen = new Set();
  const result = [];
  for (const ad of ads) {
    const copy = adCopy(ad);
    if (!copy) continue;
    const key = clean(ad.sourceCopySha256) || normalizeText(copy);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ad);
  }
  return result;
}

function rankEvidenceAds(ads) {
  return [...ads].sort((left, right) => {
    const leftScore =
      (left.mappingConfidence === "high" ? 80 : 0) +
      (left.externalId ? 30 : 0) +
      (left.sourceUrl || left.fuenteUrl ? 15 : 0) +
      Math.min(adCopy(left).length, 800) / 100;
    const rightScore =
      (right.mappingConfidence === "high" ? 80 : 0) +
      (right.externalId ? 30 : 0) +
      (right.sourceUrl || right.fuenteUrl ? 15 : 0) +
      Math.min(adCopy(right).length, 800) / 100;
    return rightScore - leftScore || clean(left.corpusKey).localeCompare(clean(right.corpusKey));
  });
}

function compactLandingRead(capture, analysis) {
  const read = capture?.commercialRead || {};
  const fallback = analysis || {};
  const first = (key) => {
    const preferred = read[key];
    if (Array.isArray(preferred)) return preferred.length ? preferred : fallback[key] || [];
    return observed(preferred) ? preferred : fallback[key] || null;
  };
  return {
    headline: first("headline"),
    promise: first("promise"),
    audience: first("audience"),
    offer: first("offer"),
    mechanism: unique(
      [read.mechanism, fallback.mechanism]
        .flat()
        .filter((value) => observed(value))
        .map(clean),
    ).slice(0, 8),
    primaryCta: first("primaryCta"),
    proof: first("proof"),
    price: first("price"),
    guarantee: first("guarantee"),
  };
}

function pageUrl(page) {
  return normalUrl(page?.finalUrl || page?.requestedUrl);
}

function choosePrimaryUrl({ ads, analysis, capture, company }) {
  const candidates = [
    normalUrl(analysis?.url),
    ...(capture?.pages || [])
      .filter((page) => page.status === "captured" && ["landing", "conversion"].includes(page.role))
      .map(pageUrl),
  ].filter(Boolean);
  if (candidates.length) return candidates[0];

  const frequency = new Map();
  for (const ad of ads) {
    const url = normalUrl(ad.landingUrl);
    if (!url || isPoorDestination(url)) continue;
    frequency.set(url, (frequency.get(url) || 0) + 1);
  }
  const frequent = [...frequency.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (frequent.length) return frequent[0][0];

  return (
    (capture?.pages || []).map(pageUrl).find(Boolean) ||
    normalUrl(capture?.website) ||
    normalUrl(company?.website || company?.domain)
  );
}

function chooseCapturedPage(capture, primaryUrl) {
  const pages = (capture?.pages || []).filter(
    (page) => page.status === "captured" && (page.image?.file || page.text?.h1 || page.text?.headings?.length),
  );
  if (!pages.length) return null;
  const target = safeUrlParts(primaryUrl);
  const ranked = pages
    .map((page) => {
      const current = safeUrlParts(pageUrl(page));
      let score = 0;
      if (target && current) {
        if (target.host === current.host && target.path === current.path) score += 100;
        else if (target.host === current.host) score += 65;
      }
      if (page.role === "landing") score += 30;
      if (page.role === "conversion") score += 24;
      if (page.fullPage) score += 8;
      if (page.image?.file) score += 6;
      return { page, score };
    })
    .sort((a, b) => b.score - a.score || clean(a.page.id).localeCompare(clean(b.page.id)));
  return ranked[0].page;
}

function landingEvidence(page, read, primaryUrl, capture) {
  return {
    url: pageUrl(page) || primaryUrl || null,
    requestedUrl: normalUrl(page?.requestedUrl),
    finalUrl: normalUrl(page?.finalUrl),
    captureFile: clean(page?.image?.file) || null,
    thumbnailFile: clean(page?.thumbnail?.file) || null,
    captureStatus: clean(page?.status || capture?.status) || "not_observed",
    capturedAt: clean(page?.capturedAt) || null,
    headline: excerpt(page?.text?.h1 || read.headline, 240) || null,
    excerpt: excerpt(page?.text?.excerpt || read.promise || read.offer, 420) || null,
  };
}

function dimensionBase(id, status, score, rationale, signals = {}) {
  const definition = [...QUALITY_DIMENSIONS, CAPTURE_DIMENSION].find((item) => item.id === id);
  return {
    id,
    label: definition.label,
    weight: definition.weight,
    status,
    score,
    rationale,
    signals,
  };
}

function semanticDimension({ id, adText, landingText, group, missingMessage }) {
  const adConcepts = detectConcepts(adText, group);
  const landingConcepts = detectConcepts(landingText, group);
  const shared = intersection(adConcepts, landingConcepts);
  const lexical = tokenSimilarity(adText, landingText);
  const signals = {
    adConcepts,
    landingConcepts,
    sharedConcepts: shared,
    lexicalOverlap: Number(lexical.toFixed(3)),
  };

  if (!adConcepts.length) {
    return dimensionBase(
      id,
      "not_observed",
      null,
      "El anuncio no explicita una señal suficientemente específica para comparar este eje.",
      signals,
    );
  }
  if (!observed(landingText)) {
    return dimensionBase(id, "not_observed", null, missingMessage, signals);
  }
  if (shared.length >= 2 || (shared.length === 1 && adConcepts.length === 1)) {
    return dimensionBase(
      id,
      "aligned",
      shared.length >= 2 ? 94 : 88,
      `El anuncio y la landing sostienen ${shared.length > 1 ? "las mismas ideas principales" : "la misma idea principal"}.`,
      signals,
    );
  }
  if (shared.length === 1 || lexical >= 0.12) {
    return dimensionBase(
      id,
      "partial",
      shared.length === 1 ? 70 : 62,
      "Existe continuidad parcial, pero la formulación o el foco cambia al llegar a la landing.",
      signals,
    );
  }
  if (adConcepts.length && landingConcepts.length) {
    return dimensionBase(
      id,
      "leak",
      28,
      "Las señales explícitas del anuncio no reaparecen en la lectura comercial de la landing.",
      signals,
    );
  }
  return dimensionBase(
    id,
    "partial",
    52,
    "La landing contiene contenido en este eje, pero no permite confirmar continuidad semántica suficiente.",
    signals,
  );
}

function classifyCta(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (/\b(?:whatsapp|mensaje|mensajes|escribe|escribenos)\b/.test(text)) return "message";
  if (/reserv|agenda|cita|reunion|llamad|diagnost|auditoria|demo/.test(text)) return "booking";
  if (/presupuesto|cotiza|valoracion|propuesta/.test(text)) return "quote";
  if (/registr|apunt|inscri|plaza|acced|ver video|webinar/.test(text)) return "register";
  if (/descarg|guia|ebook|informe/.test(text)) return "download";
  if (/compr|empieza|comenz|contrata|solicita|quiero/.test(text)) return "start";
  if (/contact|habla|consulta/.test(text)) return "contact";
  if (/mas informacion|learn more|ver detalles|descubre|saber mas|see details/.test(text)) return "learn";
  return "other";
}

function chooseLandingCta(read, capturedPage) {
  if (classifyCta(read.primaryCta) && classifyCta(read.primaryCta) !== "other") return read.primaryCta;
  return (
    (capturedPage?.text?.ctas || []).find((cta) => {
      const text = normalizeText(cta);
      return classifyCta(cta) !== "other" && !/(?:privacidad|privacy|cookie|legal|terms)/.test(text);
    }) ||
    read.primaryCta ||
    null
  );
}

function ctaDimension(adCtas, landingCta, captureAvailable) {
  const adFamilies = unique(adCtas.map(classifyCta));
  const landingFamily = classifyCta(landingCta);
  const signals = { adFamilies, landingFamily, adCtas: unique(adCtas).slice(0, 6), landingCta: clean(landingCta) || null };
  if (!adFamilies.length) {
    return dimensionBase("cta", "not_observed", null, "No se observó un CTA explícito en los anuncios recuperados.", signals);
  }
  if (!landingFamily) {
    return dimensionBase(
      "cta",
      captureAvailable ? "leak" : "not_observed",
      captureAvailable ? 24 : null,
      captureAvailable
        ? "El anuncio pide una acción, pero la captura no permite localizar una acción principal equivalente."
        : "No hay una captura utilizable para comprobar el siguiente paso.",
      signals,
    );
  }
  if (adFamilies.includes(landingFamily)) {
    return dimensionBase("cta", "aligned", 94, "La acción anunciada continúa con el mismo tipo de siguiente paso.", signals);
  }
  if (
    adFamilies.includes("learn") ||
    (adFamilies.includes("contact") && ["booking", "quote", "message"].includes(landingFamily)) ||
    (adFamilies.includes("start") && ["booking", "contact", "quote"].includes(landingFamily))
  ) {
    return dimensionBase(
      "cta",
      "partial",
      72,
      "La landing hace avanzar la intención, aunque cambia la acción exacta presentada en el anuncio.",
      signals,
    );
  }
  return dimensionBase(
    "cta",
    "leak",
    34,
    "La landing solicita una acción distinta de la que prepara el anuncio; conviene aclarar la transición.",
    signals,
  );
}

function hasProof(value) {
  const text = normalizeText(value);
  return /(?:casos? de exito|testimoni|resenas?|opiniones?|clientes? confian|\b\d+[+%]?\b|anos? de experiencia|proyectos? publicados?)/.test(text);
}

function proofDimension(adText, landingProof, landingText, captureAvailable) {
  const adHasProof = hasProof(adText);
  const landingHasProof = observed(landingProof) || hasProof(landingText);
  const signals = { adClaimsProof: adHasProof, landingShowsProof: landingHasProof };
  if (landingHasProof) {
    return dimensionBase(
      "proof",
      adHasProof ? "aligned" : "partial",
      adHasProof ? 90 : 78,
      adHasProof
        ? "La landing mantiene una capa de prueba para las afirmaciones utilizadas en los anuncios."
        : "La landing aporta prueba aunque el anuncio seleccionado no la anticipa.",
      signals,
    );
  }
  if (adHasProof && captureAvailable) {
    return dimensionBase(
      "proof",
      "leak",
      25,
      "El anuncio utiliza cifras, resultados o autoridad y no se observó respaldo equivalente en la captura.",
      signals,
    );
  }
  return dimensionBase(
    "proof",
    "not_observed",
    null,
    captureAvailable
      ? "No se observaron señales explícitas de prueba en ninguno de los dos lados."
      : "No hay captura suficiente para revisar la prueba.",
    signals,
  );
}

function commercialSignals(value) {
  const text = normalizeText(value);
  return unique([
    /gratis|gratuit|sin coste|coste cero/.test(text) ? "free" : null,
    /garantizamos|garantizado|garantizada|bajo garantia|garantia total|si no .* no paga|no pagas|devolu/.test(text)
      ? "guarantee"
      : null,
    /(?:\d+[.,]?\d*)\s*(?:€|eur|euros?|\/mes)/.test(text) ? "price" : null,
    /pago por (?:lead|cita|resultado)|a exito|por resultados/.test(text) ? "performancePricing" : null,
    /sin permanencia|cancela|contrato|minimo .* meses?/.test(text) ? "contract" : null,
  ]);
}

function commercialTermsDimension(adText, read, landingPageText, captureAvailable) {
  const adSignals = commercialSignals(adText);
  const landingText = [read.price, read.guarantee, landingPageText].filter(observed).join(" · ");
  const landingSignals = commercialSignals(landingText);
  const shared = intersection(adSignals, landingSignals);
  const signals = { adSignals, landingSignals, sharedSignals: shared };
  if (!adSignals.length && !landingSignals.length) {
    return dimensionBase(
      "commercialTerms",
      "not_observed",
      null,
      "No se observaron precio, garantía o condición contractual comparables.",
      signals,
    );
  }
  if (adSignals.length && !landingSignals.length) {
    return dimensionBase(
      "commercialTerms",
      captureAvailable ? "leak" : "not_observed",
      captureAvailable ? 20 : null,
      captureAvailable
        ? "El anuncio introduce una condición económica o garantía que no reaparece en la captura."
        : "La condición aparece en el anuncio, pero falta evidencia de landing para comprobarla.",
      signals,
    );
  }
  if (!adSignals.length && landingSignals.length) {
    return dimensionBase(
      "commercialTerms",
      "partial",
      72,
      "La landing añade condiciones comerciales que no estaban anticipadas en el anuncio.",
      signals,
    );
  }
  if (shared.length === adSignals.length) {
    return dimensionBase("commercialTerms", "aligned", 92, "Las condiciones comerciales observadas mantienen continuidad.", signals);
  }
  if (shared.length) {
    return dimensionBase("commercialTerms", "partial", 62, "Solo una parte de las condiciones comerciales se conserva.", signals);
  }
  return dimensionBase("commercialTerms", "leak", 30, "Las condiciones explícitas cambian entre anuncio y landing.", signals);
}

function destinationDimension(ads, primaryUrl, capturedPage, capture) {
  const destinations = ads.map((ad) => normalUrl(ad.landingUrl)).filter(Boolean);
  const uniqueDestinations = unique(destinations);
  const primary = safeUrlParts(primaryUrl);
  const captured = safeUrlParts(pageUrl(capturedPage));
  const poorCount = destinations.filter(isPoorDestination).length;
  const hostMatchCount = primary
    ? destinations.filter((url) => safeUrlParts(url)?.host === primary.host).length
    : 0;
  const signals = {
    observedDestinations: uniqueDestinations.length,
    poorDestinations: unique(destinations.filter(isPoorDestination)).slice(0, 8),
    primaryHostShare: destinations.length ? Number((hostMatchCount / destinations.length).toFixed(3)) : null,
    primaryUrl: primaryUrl || null,
    capturedUrl: pageUrl(capturedPage),
    redirectObserved: Boolean(primary && captured && primary.host !== captured.host),
  };
  if (!destinations.length) {
    return dimensionBase(
      "destinationFriction",
      "not_observed",
      null,
      "Los anuncios recuperados no incluyen un destino estructurado comparable.",
      signals,
    );
  }
  if (poorCount / destinations.length >= 0.5) {
    return dimensionBase(
      "destinationFriction",
      "leak",
      Math.max(15, Math.round(48 - (poorCount / destinations.length) * 35)),
      "Una parte relevante de los anuncios dirige a páginas legales, sociales o no comerciales.",
      signals,
    );
  }
  if (poorCount / destinations.length >= 0.15) {
    return dimensionBase(
      "destinationFriction",
      "partial",
      Math.max(52, Math.round(78 - (poorCount / destinations.length) * 50)),
      "El destino principal es comercial, pero una parte de las piezas conserva rutas secundarias poco útiles.",
      signals,
    );
  }
  if (!capturedPage) {
    return dimensionBase(
      "destinationFriction",
      "not_observed",
      null,
      `El destino existe, pero la captura quedó ${capture?.status === "failed" ? "fallida" : "sin cobertura utilizable"}; no se juzga su calidad.`,
      signals,
    );
  }
  if (primary && captured && primary.host === captured.host && primary.path === captured.path) {
    return dimensionBase("destinationFriction", "aligned", 96, "El destino anunciado coincide con la página capturada.", signals);
  }
  if (primary && captured && primary.host === captured.host) {
    return dimensionBase(
      "destinationFriction",
      "partial",
      76,
      "El dominio coincide, pero la captura disponible corresponde a otra ruta del mismo sitio.",
      signals,
    );
  }
  return dimensionBase(
    "destinationFriction",
    "partial",
    58,
    "Se observa un cambio de dominio o una redirección; requiere revisión manual del recorrido.",
    signals,
  );
}

function captureDimension(capture, capturedPage) {
  const planned = Number(capture?.coverage?.planned || 0);
  const captured = Number(capture?.coverage?.captured || 0);
  const blocked = Number(capture?.coverage?.blocked || 0);
  const failed = Number(capture?.coverage?.failed || 0);
  const score = planned ? Math.round((captured / planned) * 100) : capturedPage ? 100 : 0;
  const status = score === 100 ? "aligned" : score > 0 ? "partial" : "not_observed";
  return dimensionBase(
    "captureCoverage",
    status,
    score,
    score === 100
      ? "Se capturó todo el recorrido planificado."
      : score > 0
        ? "La lectura se apoya en una cobertura parcial del recorrido."
        : "No existe una captura utilizable; este dato reduce confianza, no la nota de calidad.",
    { planned, captured, blocked, failed, fullPage: Boolean(capturedPage?.fullPage) },
  );
}

function inferVertical(company, ads, landingIntelligence) {
  const knownIds = new Set(Object.keys(landingIntelligence.verticals || {}));
  const explicit = ads.map((ad) => clean(ad.vertical)).find((value) => knownIds.has(value));
  if (explicit) return explicit;
  const text = normalizeText(
    [company?.name, company?.niche, company?.offer, ...ads.map((ad) => `${ad.titular || ""} ${ad.texto || ""}`)]
      .join(" ")
      .slice(0, 40000),
  );
  return VERTICAL_RULES.find(([, pattern]) => pattern.test(text))?.[0] || "generalista";
}

function weightedScore(dimensions) {
  const evaluated = dimensions.filter((dimension) => dimension.weight > 0 && Number.isFinite(dimension.score));
  const evaluatedWeight = evaluated.reduce((total, dimension) => total + dimension.weight, 0);
  if (evaluated.length < 3 || evaluatedWeight < QUALITY_WEIGHT * 0.35) {
    return { score: null, evaluatedWeight, evaluatedDimensions: evaluated.length };
  }
  const score = Math.round(
    evaluated.reduce((total, dimension) => total + dimension.score * dimension.weight, 0) /
      evaluatedWeight,
  );
  return { score, evaluatedWeight, evaluatedDimensions: evaluated.length };
}

function evidenceConfidence({ dimensions, capture, capturedPage, adCount, uniqueCopyCount }) {
  const scoredWeight = dimensions
    .filter((dimension) => dimension.weight > 0 && Number.isFinite(dimension.score))
    .reduce((total, dimension) => total + dimension.weight, 0);
  const dimensionCoverage = scoredWeight / QUALITY_WEIGHT;
  const captureCoverage = Number(dimensions.find((dimension) => dimension.id === "captureCoverage")?.score || 0) / 100;
  const adDepth = Math.min(1, Math.max(adCount, uniqueCopyCount) / 5);
  const sourceQuality = capturedPage?.fullPage ? 1 : capturedPage ? 0.7 : 0;
  const score = Math.round(
    100 * (dimensionCoverage * 0.48 + captureCoverage * 0.22 + adDepth * 0.16 + sourceQuality * 0.14),
  );
  const label = score >= 75 && capture?.coverage?.captured > 0 ? "high" : score >= 45 ? "medium" : "low";
  return {
    score,
    label,
    evaluatedShare: Math.round(dimensionCoverage * 100),
    captureShare: Math.round(captureCoverage * 100),
    note:
      label === "high"
        ? "Comparación respaldada por varias piezas y captura suficiente."
        : label === "medium"
          ? "Lectura orientativa: faltan piezas o páginas del recorrido."
          : "Evidencia insuficiente para una conclusión firme.",
  };
}

const ACTIONS = {
  promise: "Repetir en el hero la promesa concreta del anuncio y explicar inmediatamente cómo se entrega.",
  audience: "Nombrar en el primer bloque al mismo público o caso de uso que activa el anuncio.",
  offerMechanism: "Conservar oferta y mecanismo entre anuncio y landing; mostrar el proceso en pasos verificables.",
  cta: "Alinear la acción prometida con el CTA principal y explicar cualquier paso intermedio.",
  proof: "Colocar junto a la promesa evidencia identificable y sus límites; evitar claims sin respaldo localizable.",
  commercialTerms: "Repetir y aclarar precio, gratuidad o garantía, incluyendo condiciones visibles antes del formulario.",
  destinationFriction: "Enviar el anuncio a una página comercial específica y eliminar saltos a rutas legales, sociales o genéricas.",
};

function buildLeaks(dimensions) {
  return dimensions
    .filter((dimension) => dimension.status === "leak")
    .sort((left, right) => right.weight - left.weight || left.score - right.score)
    .map((dimension, index) => ({
      dimension: dimension.id,
      label: dimension.label,
      severity: dimension.weight >= 18 || dimension.score <= 24 ? "high" : dimension.weight >= 10 ? "medium" : "low",
      finding: dimension.rationale,
      action: ACTIONS[dimension.id],
      priority: index + 1,
    }));
}

function buildActions(dimensions) {
  return dimensions
    .filter((dimension) => dimension.weight > 0 && ["leak", "partial"].includes(dimension.status))
    .sort((left, right) => {
      const leftLoss = left.weight * (100 - left.score) / 100;
      const rightLoss = right.weight * (100 - right.score) / 100;
      return rightLoss - leftLoss;
    })
    .slice(0, 4)
    .map((dimension, index) => ({
      priority: index + 1,
      dimension: dimension.id,
      label: dimension.label,
      action: ACTIONS[dimension.id],
      basis: dimension.rationale,
    }));
}

function auditState(score, confidence, leaks, dimensions) {
  if (score === null || confidence.score < 35) return "insufficient_evidence";
  if (leaks.some((leak) => leak.severity === "high") || score < 50) return "critical_leaks";
  const partials = dimensions.filter((dimension) => dimension.status === "partial" && dimension.weight > 0).length;
  if (leaks.length || score < 78 || partials >= 3) return "needs_review";
  return "coherent_sample";
}

function buildItem({ id, ads, company, analysis, capture, landingIntelligence }) {
  const auditReadyAds = ads.filter(isAuditReadyAd);
  const uniqueAds = deduplicateAds(auditReadyAds);
  const evidenceAds = rankEvidenceAds(uniqueAds).slice(0, 5);
  const adText = uniqueAds.map(adCopy).join(" \n ").slice(0, 80000);
  const read = compactLandingRead(capture, analysis);
  const primaryUrl = choosePrimaryUrl({ ads, analysis, capture, company });
  const capturedPage = chooseCapturedPage(capture, primaryUrl);
  const captureAvailable = Boolean(capturedPage);
  const landingReadable =
    captureAvailable ||
    (Number(analysis?.capturedPages || 0) > 0 && !["failed", "no_url"].includes(clean(analysis?.status)));
  const landingText = clean(
    [
      read.headline,
      read.promise,
      read.audience,
      read.offer,
      ...(read.mechanism || []),
      read.primaryCta,
      read.proof,
      read.price,
      read.guarantee,
      capturedPage?.text?.h1,
      ...(capturedPage?.text?.headings || []),
      capturedPage?.text?.excerpt,
    ]
      .filter(Boolean)
      .join(" · "),
  );

  const dimensions = [
    semanticDimension({
      id: "promise",
      adText,
      landingText: landingReadable ? [read.headline, read.promise].filter(observed).join(" · ") : "",
      group: "outcomes",
      missingMessage: captureAvailable
        ? "La captura no muestra una promesa suficientemente explícita para compararla."
        : "No hay captura suficiente para comprobar la promesa.",
    }),
    semanticDimension({
      id: "audience",
      adText,
      landingText: landingReadable ? read.audience : "",
      group: "audiences",
      missingMessage: captureAvailable
        ? "La captura no explicita a quién se dirige la propuesta."
        : "No hay captura suficiente para comprobar la audiencia.",
    }),
    semanticDimension({
      id: "offerMechanism",
      adText,
      landingText: landingReadable
        ? [read.offer, ...(read.mechanism || [])].filter(observed).join(" · ")
        : "",
      group: "mechanisms",
      missingMessage: captureAvailable
        ? "No se observó un mecanismo suficientemente concreto en la landing."
        : "No hay captura suficiente para comprobar oferta y mecanismo.",
    }),
    ctaDimension(
      uniqueAds.map((ad) => clean(ad.cta || ad.ctaType)).filter(Boolean),
      landingReadable ? chooseLandingCta(read, capturedPage) : null,
      landingReadable,
    ),
    proofDimension(adText, landingReadable ? read.proof : null, landingReadable ? landingText : "", landingReadable),
    commercialTermsDimension(adText, landingReadable ? read : {}, landingReadable ? landingText : "", landingReadable),
    destinationDimension(ads, primaryUrl, capturedPage, capture),
    captureDimension(capture, capturedPage),
  ];

  const quality = weightedScore(dimensions);
  const confidence = evidenceConfidence({
    dimensions,
    capture,
    capturedPage,
    adCount: ads.length,
    uniqueCopyCount: uniqueAds.length,
  });
  const leaks = buildLeaks(dimensions);
  const vertical = inferVertical(company, auditReadyAds, landingIntelligence);
  const destinationUrls = unique(ads.map((ad) => normalUrl(ad.landingUrl)).filter(Boolean));

  return {
    id: `${id}::${Buffer.from(primaryUrl || "without-landing").toString("base64url").slice(0, 16)}`,
    companyId: id,
    companyName: clean(company?.name || analysis?.name || capture?.name || ads[0]?.name || id),
    country: clean(company?.primaryCountry || company?.country || capture?.primaryCountry || ads[0]?.country) || "No identificado",
    vertical,
    verticalLabel: landingIntelligence.verticals?.[vertical]?.label || "Generalista / multisegmento",
    landing: {
      url: primaryUrl || null,
      destinationCount: destinationUrls.length,
      observedDestinations: destinationUrls.slice(0, 12),
      capture: landingEvidence(capturedPage, read, primaryUrl, capture),
      captureStatus: clean(capture?.status) || "not_observed",
      read,
    },
    ads: {
      total: ads.length,
      usableForAudit: auditReadyAds.length,
      excludedFromSemantics: ads.length - auditReadyAds.length,
      uniqueCopies: uniqueAds.length,
      active: auditReadyAds.filter((ad) => ad.isActive === true).length,
      evidence: evidenceAds.map(adReference),
    },
    qualityScore: quality.score,
    scoreMeaning:
      quality.score === null
        ? "No calculado: faltan dimensiones evaluables."
        : "Índice heurístico de continuidad anuncio→landing; no mide conversión ni rendimiento.",
    confidence,
    state: auditState(quality.score, confidence, leaks, dimensions),
    dimensions,
    leaks,
    actions: buildActions(dimensions),
    limitation:
      "Lectura heurística de piezas y capturas públicas. La presencia de prueba no valida sus afirmaciones y el índice no identifica campañas ganadoras.",
  };
}

function aggregate(items, dimensionDefinitions) {
  const scored = items.filter((item) => Number.isFinite(item.qualityScore));
  const stateCounts = {};
  const confidenceCounts = {};
  const verticalCounts = {};
  for (const item of items) {
    stateCounts[item.state] = (stateCounts[item.state] || 0) + 1;
    confidenceCounts[item.confidence.label] = (confidenceCounts[item.confidence.label] || 0) + 1;
    verticalCounts[item.vertical] = (verticalCounts[item.vertical] || 0) + 1;
  }
  const dimensions = Object.fromEntries(
    dimensionDefinitions.map((definition) => {
      const values = items.map((item) => item.dimensions.find((dimension) => dimension.id === definition.id));
      const evaluable = values.filter(
        (value) => value?.status !== "not_observed" && Number.isFinite(value?.score),
      );
      const statuses = {};
      for (const value of values) statuses[value.status] = (statuses[value.status] || 0) + 1;
      return [
        definition.id,
        {
          label: definition.label,
          weight: definition.weight,
          averageScore: evaluable.length
            ? Math.round(evaluable.reduce((sum, value) => sum + value.score, 0) / evaluable.length)
            : null,
          evaluable: evaluable.length,
          notObserved: values.filter((value) => value?.status === "not_observed").length,
          statuses,
        },
      ];
    }),
  );
  return {
    companies: items.length,
    evaluable: scored.length,
    insufficientEvidence: items.length - scored.length,
    averageQualityScore: scored.length
      ? Math.round(scored.reduce((sum, item) => sum + item.qualityScore, 0) / scored.length)
      : null,
    medianQualityScore: scored.length
      ? [...scored].map((item) => item.qualityScore).sort((a, b) => a - b)[Math.floor(scored.length / 2)]
      : null,
    averageConfidence: items.length
      ? Math.round(items.reduce((sum, item) => sum + item.confidence.score, 0) / items.length)
      : null,
    totalAds: items.reduce((sum, item) => sum + item.ads.total, 0),
    uniqueCopies: items.reduce((sum, item) => sum + item.ads.uniqueCopies, 0),
    withCapturedLanding: items.filter((item) => item.landing.capture.captureStatus === "captured").length,
    stateCounts,
    confidenceCounts,
    verticalCounts,
    dimensions,
  };
}

export function buildAdLandingAudit({ root = PROJECT_ROOT, write = true } = {}) {
  const corpus = readJson(root, INPUTS.corpus);
  const companies = readJson(root, INPUTS.companies);
  const landingIntelligence = readJson(root, INPUTS.landingIntelligence);
  const landingAnalysis = readJson(root, INPUTS.landingAnalysis);
  const captureIndex = readJson(root, INPUTS.captureIndex);

  const companyById = new Map(companies.map((company) => [company.id, company]));
  const analysisById = new Map(landingAnalysis.items.map((item) => [item.id, item]));
  const captureIndexById = new Map(captureIndex.records.map((item) => [item.id, item]));
  const adsById = new Map();
  for (const ad of corpus.items) {
    if (!ad.id || !adCopy(ad)) continue;
    if (!adsById.has(ad.id)) adsById.set(ad.id, []);
    adsById.get(ad.id).push(ad);
  }

  const ids = [...adsById.keys()]
    .filter((id) => captureIndexById.has(id) || analysisById.has(id))
    .sort((a, b) => a.localeCompare(b));
  const captures = new Map();
  for (const id of ids) {
    const capturePath = path.join(root, "public/data/site-captures", `${id}.json`);
    if (fs.existsSync(capturePath)) captures.set(id, JSON.parse(fs.readFileSync(capturePath, "utf8")));
  }

  const items = ids
    .map((id) =>
      buildItem({
        id,
        ads: adsById.get(id),
        company: companyById.get(id),
        analysis: analysisById.get(id),
        capture: captures.get(id),
        landingIntelligence,
      }),
    )
    .sort((left, right) => {
      if (left.qualityScore === null && right.qualityScore !== null) return 1;
      if (left.qualityScore !== null && right.qualityScore === null) return -1;
      return (right.qualityScore || 0) - (left.qualityScore || 0) || right.confidence.score - left.confidence.score;
    });

  const definitions = [...QUALITY_DIMENSIONS, CAPTURE_DIMENSION];
  const result = {
    schemaVersion: "rv-ad-landing-audit-v1",
    generatedAt: new Date().toISOString(),
    methodology: {
      name: "Auditoría heurística y explicable de continuidad anuncio→landing",
      qualityScore:
        "Media ponderada exclusiva de dimensiones evaluables. Los campos no observados se excluyen; no reciben cero ni equivalen a una contradicción.",
      coverage:
        "La confianza combina dimensiones evaluables, cobertura de captura, profundidad publicitaria y disponibilidad de captura completa.",
      statusSemantics: {
        aligned: "Continuidad explícita en la evidencia recuperada.",
        partial: "Continuidad incompleta o transición que merece explicación.",
        leak: "Pérdida o contradicción apoyada por señales explícitas.",
        not_observed: "No hay evidencia suficiente; no se interpreta como malo.",
      },
      warning:
        "No contiene métricas de conversión, inversión, ventas ni causalidad. No identifica ganadores; prioriza hipótesis de revisión.",
      dimensions: definitions,
    },
    sources: {
      adCorpus: { path: `/${INPUTS.corpus}`, generatedAt: corpus.generatedAt, items: corpus.items.length },
      companiesIndex: { path: `/${INPUTS.companies}`, items: companies.length },
      landingIntelligence: {
        path: `/${INPUTS.landingIntelligence}`,
        generatedAt: landingIntelligence.generatedAt,
        companies: landingIntelligence.source?.companies || null,
        pages: landingIntelligence.source?.pages || null,
      },
      scrapecreatorsLandingAnalysis: {
        path: `/${INPUTS.landingAnalysis}`,
        generatedAt: landingAnalysis.generatedAt,
        items: landingAnalysis.items.length,
      },
      siteCaptures: {
        path: "/public/data/site-captures/*.json",
        generatedAt: captureIndex.generatedAt,
        records: captureIndex.records.length,
      },
    },
    benchmarks: {
      universal: {
        medianFunnelSteps: landingIntelligence.universal?.medianFunnelSteps ?? null,
        medianFormFields: landingIntelligence.universal?.medianFormFields ?? null,
        fieldPresence: landingIntelligence.universal?.fieldPresence ?? {},
      },
      verticals: Object.fromEntries(
        Object.entries(landingIntelligence.verticals || {}).map(([id, vertical]) => [
          id,
          {
            label: vertical.label,
            sampleSize: vertical.sampleSize,
            capturedPages: vertical.capturedPages,
            medianFunnelSteps: vertical.medianFunnelSteps,
            medianFormFields: vertical.medianFormFields,
          },
        ]),
      ),
    },
    summary: aggregate(items, definitions),
    items,
  };

  if (write) {
    const outputPath = path.join(root, OUTPUT);
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildAdLandingAudit();
  console.log(
    JSON.stringify(
      {
        output: OUTPUT,
        companies: result.summary.companies,
        evaluable: result.summary.evaluable,
        captured: result.summary.withCapturedLanding,
        averageQualityScore: result.summary.averageQualityScore,
        averageConfidence: result.summary.averageConfidence,
        states: result.summary.stateCounts,
      },
      null,
      2,
    ),
  );
}
