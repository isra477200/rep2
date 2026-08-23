import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { safePublicUrl as safeUrl } from "./funnel-v3-url-utils.mjs";

const QUEUE_FILE = "research/deep/v3/queue.json";
const PUBLIC_COMPANIES = "public/data/companies.json";
const ID_MAP_FILE = "research/deep/public-id-map.json";
const FX_FILE = "public/data/fx.json";
const RENDERED_DIR = "research/deep/v3/rendered";
const OUTPUT_DIR = "research/deep/v3/reviews";

function parseArgs(argv) {
  const args = { limit: Infinity, only: [], force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--limit") args.limit = Number(argv[++index] || Infinity);
    if (token === "--only") args.only = String(argv[++index] || "").split(",").filter(Boolean);
    if (token === "--force") args.force = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

function clean(value) {
  return String(value || "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    // eslint-disable-next-line no-control-regex -- retira controles que rompen la serialización.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, length = 1_600) {
  const text = clean(value);
  const characters = [...text];
  return characters.length > length ? `${characters.slice(0, length - 1).join("").trim()}…` : text;
}

function unique(values, limit = Infinity) {
  return [...new Set((values || []).map(clean).filter(Boolean))].slice(0, limit);
}

function uniqueObjects(values, key = (value) => JSON.stringify(value), limit = Infinity) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const signature = key(value);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function evidenceIdForUrl(evidenceByUrl, value) {
  const normalized = safeUrl(value);
  return normalized ? evidenceByUrl.get(normalized) : null;
}

function sanitizePublicText(value) {
  let text = String(value || "");
  text = text.replace(/https?:\/\/[^\s<>"')\]}]+/gi, (candidate) => safeUrl(candidate) || "[enlace temporal o privado retirado]");
  text = text
    .replace(/file:\/\/[^\s<>"']+/gi, "[referencia local retirada]")
    .replace(/[A-Z]:\\Users\\[^\s<>"']+/gi, "[referencia local retirada]")
    .replace(/\/Users\/[^\s<>"']+/g, "[referencia local retirada]")
    .replace(/Puente IA/gi, "sistema previo")
    .replace(/\bRVC-[A-Z0-9_-]+\b/gi, "referencia retirada")
    .replace(/\bRV-PUB-[A-Z0-9_-]+\b/gi, "referencia retirada")
    .replace(/\bmanual-wave(?:-[A-Z0-9_-]+)?\b/gi, "revisión manual")
    .replace(/Origen migraci[oó]n/gi, "procedencia documentada");
  return text;
}

function sanitizePublicValue(value, key = "") {
  if (Array.isArray(value)) return value.map((child) => sanitizePublicValue(child, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).flatMap(([childKey, child]) => {
      if (/^cookie$/i.test(childKey)) {
        const label = clean(child);
        return /casilla|consent|opcional|aceptad|visible|obligat/i.test(label)
          ? [["cookieConsent", sanitizePublicValue(child, "cookieConsent")]]
          : [];
      }
      if (/^(?:password|passwd|pwd|secret|clientSecret|apiKey|api_key|accessToken|access_token|refreshToken|refresh_token|authorization|credentials?|session(?:Id|_id)?)$/i.test(childKey)) return [];
      return [[childKey, sanitizePublicValue(child, childKey)]];
    }));
  }
  if (typeof value !== "string") return value;
  if (/(?:^|_)(?:url|href)$|^(?:url|href|action|pageUrl|sourceUrl|sourceURL|website)$/i.test(key)) return safeUrl(value);
  return sanitizePublicText(value);
}

function collectReviewEvidenceIds(value, rows = []) {
  if (Array.isArray(value)) {
    value.forEach((child) => collectReviewEvidenceIds(child, rows));
    return rows;
  }
  if (!value || typeof value !== "object") return rows;
  if (Array.isArray(value.evidenceIds)) rows.push(...value.evidenceIds);
  for (const [key, child] of Object.entries(value)) if (key !== "evidence") collectReviewEvidenceIds(child, rows);
  return rows;
}

const PUBLIC_DIMENSIONS = [
  "classification", "messageArchitecture", "acquisition", "ctaLadder", "captureAndQualification", "funnel",
  "offerEconomics", "proofAndTrust", "objectionsAndSales", "technologyAndNurture", "deliveryOperations", "competitiveAssessment",
];
const EXTERNAL_COPY_PATH = /^\$\.(?:messageArchitecture|proofAndTrust|offerEconomics|objectionsAndSales|deliveryOperations|competitiveAssessment)(?:\.|\[|$)/;

function filterEvidenceReferences(value, allowedIds, externalIds, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => filterEvidenceReferences(child, allowedIds, externalIds, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value.evidenceIds)) {
    value.evidenceIds = unique(value.evidenceIds.filter((id) => allowedIds.has(id) && !(EXTERNAL_COPY_PATH.test(path) && externalIds.has(id))));
  }
  for (const [key, child] of Object.entries(value)) if (key !== "evidence") filterEvidenceReferences(child, allowedIds, externalIds, `${path}.${key}`);
}

function normalizeClaimStatuses(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => normalizeClaimStatuses(child, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object" || path === "$.evidence") return;
  if (["observado", "inferido"].includes(value.status) && Array.isArray(value.evidenceIds) && !value.evidenceIds.length) {
    value.status = "no observable";
    value.explanation ||= "La afirmación no conserva una fuente pública estable y trazable suficiente para presentarse como hecho.";
    value.limitation ||= value.explanation;
  }
  for (const [key, child] of Object.entries(value)) if (key !== "evidence") normalizeClaimStatuses(child, `${path}.${key}`);
}

function normalizeForms(review) {
  const forms = review.captureAndQualification?.forms;
  if (!Array.isArray(forms)) return;
  for (const form of forms) {
    const originalVisible = Number.isFinite(Number(form.visibleFieldCount)) ? Number(form.visibleFieldCount) : null;
    const notes = [];
    form.fields = (Array.isArray(form.fields) ? form.fields : []).filter((field) => {
      const label = clean(field?.label || field?.name || field?.placeholder);
      const noteOnly = /no se atribuyen como campos visibles|colector previo|verificaci[oó]n antibot|no verificable actualmente/i.test(label);
      if (noteOnly) notes.push(label);
      return !noteOnly;
    }).map((field) => ({
      ...field,
      type: clean(field?.type) || inferFieldType(field?.label || field?.name || field?.placeholder),
      required: typeof field?.required === "boolean" ? field.required : false,
    }));
    if (originalVisible !== null && originalVisible !== form.fields.length) {
      form.reportedVisibleFieldCount = originalVisible;
      form.fieldInventoryStatus = `Inventario normalizado: ${form.fields.length} control(es) enumerado(s); la fuente secundaria informaba ${originalVisible}.`;
    } else {
      form.fieldInventoryStatus = `Inventario normalizado: ${form.fields.length} control(es) enumerado(s).`;
    }
    if (notes.length) form.fieldInventoryLimitations = unique([...(form.fieldInventoryLimitations || []), ...notes]);
    form.visibleFieldCount = form.fields.length;
    form.requiredFieldCount = form.fields.filter((field) => field.required).length;
    form.qualificationDimensions = formQualification(form.fields);
    form.friction = { ...assessFormFriction(form.fields), reported: form.friction?.reported || null };
    form.submissionPerformed = false;
  }
}

function normalizeEvidenceCoherence(review) {
  const fallbackEvidenceId = review.evidence?.[0]?.id || null;
  if (["observado", "inferido"].includes(review.classification?.status) && !collectReviewEvidenceIds(review.classification).length && fallbackEvidenceId) {
    review.classification.evidenceIds = [fallbackEvidenceId];
  }
  for (const stage of review.funnel || []) {
    if (!["observado", "inferido"].includes(stage.status) || stage.evidenceIds?.length) continue;
    stage.status = "no observable";
    stage.detail = "No se conserva evidencia pública estable y trazable suficiente para sostener esta fase.";
    stage.limitation = stage.detail;
    stage.manualFindings = [];
  }
  for (const key of PUBLIC_DIMENSIONS.filter((name) => name !== "funnel")) {
    const dimension = review[key];
    if (!dimension || !["observado", "inferido"].includes(dimension.status)) continue;
    if (collectReviewEvidenceIds(dimension).length) continue;
    dimension.status = "no observable";
    dimension.explanation = "No se conserva evidencia pública estable y trazable suficiente para sostener esta dimensión.";
    dimension.limitation ||= dimension.explanation;
  }
  normalizeClaimStatuses(review);
}

function finalizePublicReview(input) {
  let review = sanitizePublicValue(input);
  review.evidence = uniqueObjects((review.evidence || []).flatMap((row) => {
    const url = safeUrl(row.url);
    return url ? [{ ...row, url }] : [];
  }), (row) => row.id, 160);
  const allowedIds = new Set(review.evidence.map((row) => row.id));
  const externalIds = new Set(review.evidence.filter((row) => row.relation === "external_funnel_destination").map((row) => row.id));
  for (const row of review.evidence) {
    row.supports = unique((row.supports || []).filter((path) => !(externalIds.has(row.id) && EXTERNAL_COPY_PATH.test(path))), 120);
  }
  filterEvidenceReferences(review, allowedIds, externalIds);
  normalizeForms(review);
  normalizeEvidenceCoherence(review);
  const requiredLimitation = "No se enviaron formularios, no se reservaron citas, no se crearon cuentas, no se contrató y no se contactó con la empresa.";
  review.limitations = unique([requiredLimitation, ...(review.limitations || [])], 24);
  review.qa = {
    ...(review.qa || {}),
    materialClaimsTraceable: review.evidence.length > 0,
    formsSubmitted: false,
    companyContacted: false,
    privateLinksIncluded: false,
    evidenceSources: review.evidence.length,
    publishReady: review.evidence.length > 0,
  };
  const supportedDimensions = PUBLIC_DIMENSIONS.filter((key) => key === "funnel"
    ? (review.funnel || []).some((stage) => ["observado", "inferido"].includes(stage.status) && stage.evidenceIds?.length)
    : ["observado", "inferido"].includes(review[key]?.status) && collectReviewEvidenceIds(review[key]).length).length;
  const supportedStages = (review.funnel || []).filter((stage) => ["observado", "inferido"].includes(stage.status) && stage.evidenceIds?.length).length;
  const evidenceCoverage = Math.round(((supportedDimensions + supportedStages) / 24) * 100);
  if (Number.isFinite(review.coveragePercent) && review.coveragePercent > evidenceCoverage) review.coveragePercent = evidenceCoverage;
  return attachEvidenceSupports(review);
}

function sourceType(url) {
  const value = String(url || "");
  if (/adstransparency\.google\.com/i.test(value)) return "biblioteca publicitaria oficial";
  if (/facebook\.com\/ads\/library/i.test(value)) return "biblioteca publicitaria oficial";
  if (/linkedin\.com|instagram\.com|facebook\.com|youtube\.com|tiktok\.com/i.test(value)) return "perfil o publicación social";
  if (/\.pdf(?:$|\?)/i.test(value)) return "documento público";
  return "sitio oficial";
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

function sentences(value) {
  return unique(String(value || "").split(/(?<=[.!?。！？])\s+|\n+/).map((row) => truncate(row, 420)).filter((row) => row.split(/\s+/).length >= 4), 500);
}

function pageEvidence(rendered, evidenceByUrl, regex, limit = 12) {
  const rows = [];
  for (const page of rendered?.pages || []) {
    const evidenceId = evidenceIdForUrl(evidenceByUrl, page.url);
    const candidates = unique([
      ...(page.headings || []).map((heading) => heading.text),
      ...sentences(page.visibleText),
    ], 600);
    for (const text of candidates) {
      if (!regex.test(text)) continue;
      rows.push({ text: truncate(text, 420), status: "observado", evidenceIds: evidenceId ? [evidenceId] : [] });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

function isUtilityPage(page) {
  let path = "";
  try { path = new URL(page?.url || "").pathname.toLowerCase(); } catch { path = String(page?.url || "").toLowerCase(); }
  const title = clean(page?.title).toLowerCase();
  return /(?:^|\/)(?:privacy|privacidad|privacy-policy|politica-de-privacidad|cookies?|politica-de-cookies|aviso-legal|legal-notice|terms(?:-and-conditions)?|terms-of-(?:use|service)|impressum|datenschutz|mentions-legales)(?:\/|$|\.)/i.test(path)
    || /^(?:privacy|privacidad|cookie policy|pol[ií]tica de cookies|aviso legal|legal notice|terms and conditions|impressum|datenschutz)/i.test(title);
}

function renderedWithPages(rendered, pages) {
  return { ...(rendered || {}), pages };
}

function analyzeVoice(rendered, evidenceByUrl) {
  const pages = rendered?.pages || [];
  const corpus = clean(pages.map((page) => page.visibleText).join(" "));
  if (!corpus) {
    return {
      status: "no observable",
      dominantTraits: [],
      addressStyle: "No se recuperó copy comercial legible.",
      recurringMoves: [],
      copyMetrics: { commercialPages: 0, wordsObserved: 0, numericExpressions: 0, questions: 0 },
      evidenceIds: [],
    };
  }
  const definitions = [
    ["directa y orientada al lector", /\b(?:tú|tu|te|usted|su empresa|you|your|vous|votre|du|dein)\b/i, "Interpela al posible cliente en segunda persona."],
    ["centrada en resultados", /\b(?:roi|retorno|ventas?|sales|revenue|factur|ingresos|leads?|citas?|appointments?|clientes?|patients?)\b/i, "Repite resultados económicos o comerciales."],
    ["consultiva o diagnóstica", /\b(?:diagn[oó]stico|audit|auditor[ií]a|analysis|analizamos|consultation|consulta|clarity|estrategia|strategy)\b/i, "Convierte mediante diagnóstico, auditoría o consulta."],
    ["de reducción de riesgo", /\b(?:garant[ií]a|guarantee|no pagas|money back|refund|sin permanencia|cancel anytime|risk[- ]free)\b/i, "Reduce el riesgo con garantía, salida o pago condicionado."],
    ["urgente o escasa", /\b(?:ahora|today|hoy|limited|limitad[oa]s?|plazas?|spots?|últim[oa]s?|before|deadline|solo este mes)\b/i, "Introduce urgencia, cupos o escasez."],
    ["educativa y procesual", /\b(?:cómo funciona|how it works|paso\s*\d|step\s*\d|m[eé]todo|method|sistema|system|proceso|process|framework)\b/i, "Explica método, sistema o secuencia de trabajo."],
    ["de autoridad", /\b(?:años? de experiencia|years? of experience|certified|certificad|award|premio|expert[oa]s?|especialistas?|trusted by|conf[ií]an)\b/i, "Construye autoridad mediante experiencia, especialización o credenciales."],
    ["de dolor o pérdida", /\b(?:problema|problem|pierdes?|pérdida|waste|struggl|dif[ií]cil|frustra|sin clientes|no funciona|coste alto)\b/i, "Activa el coste de seguir igual o el dolor operativo."],
  ];
  const dominantTraits = definitions.flatMap(([trait, regex, explanation]) => {
    const signals = pageEvidence(rendered, evidenceByUrl, regex, 3);
    return signals.length ? [{ trait, explanation, status: "observado", examples: signals, evidenceIds: unique(signals.flatMap((row) => row.evidenceIds)) }] : [];
  });
  const direct = /\b(?:tú|tu|te|usted|su empresa|you|your|vous|votre|du|dein)\b/i.test(corpus);
  const formal = /\b(?:usted|su empresa|your company|votre entreprise|ihr unternehmen)\b/i.test(corpus);
  const recurringMoves = [
    [/\b(?:sin|without)\b.{0,70}\b(?:sin|without)\b/i, "Acumulación de fricciones eliminadas (‘sin X, sin Y’)."],
    [/(?:o no pagas|or you don['’]?t pay|money back|garant[ií]a|guarantee)/i, "Promesa acompañada de reducción explícita de riesgo."],
    [/\b(?:cómo funciona|how it works|paso\s*\d|step\s*\d)\b/i, "Explicación en pasos para hacer tangible el mecanismo."],
    [/\b(?:solo para|exclusivamente|only for|speciali[sz](?:ed|amos)|especialistas?)\b/i, "Señal de especialización o exclusión para reforzar encaje."],
    [/\b\d+(?:[.,]\d+)?\s*(?:%|x|€|\$|£|leads?|citas?|clientes?|ventas?)\b/i, "Uso de cifras o métricas como ancla de credibilidad."],
  ].flatMap(([regex, pattern]) => {
    const examples = pageEvidence(rendered, evidenceByUrl, regex, 3);
    return examples.length ? [{ pattern, status: "observado", examples, evidenceIds: unique(examples.flatMap((row) => row.evidenceIds)) }] : [];
  });
  return {
    status: "observado",
    dominantTraits,
    addressStyle: formal ? "Interpelación directa con señales formales o empresariales." : direct ? "Interpelación directa en segunda persona." : "Voz principalmente descriptiva o corporativa.",
    recurringMoves,
    copyMetrics: {
      commercialPages: pages.length,
      wordsObserved: corpus.split(/\s+/).filter(Boolean).length,
      numericExpressions: (corpus.match(/\b\d+(?:[.,]\d+)?(?:\s*[%x€$£])?/g) || []).length,
      questions: (corpus.match(/[?¿]/g) || []).length,
    },
    evidenceIds: unique([...dominantTraits, ...recurringMoves].flatMap((row) => row.evidenceIds)),
  };
}

function attachEvidenceSupports(review) {
  const supports = new Map((review.evidence || []).map((row) => [row.id, new Set(row.supports || [])]));
  function walk(value, path = "$") {
    if (Array.isArray(value)) {
      value.forEach((child, index) => walk(child, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value.evidenceIds)) {
      for (const id of value.evidenceIds) supports.get(id)?.add(path);
    }
    for (const [key, child] of Object.entries(value)) if (key !== "evidence" && key !== "supports") walk(child, `${path}.${key}`);
  }
  walk(review);
  review.evidence = (review.evidence || []).map((row) => {
    const tracedSupports = unique([...(row.supports || []), ...(supports.get(row.id) || [])], 120);
    return {
      ...row,
      status: row.status === "observado" && !tracedSupports.length ? "referencia pública" : row.status,
      supports: tracedSupports,
    };
  });
  return review;
}

function likelyCta(row) {
  const text = clean(row.text || row.ariaLabel);
  const href = String(row.href || "");
  if (text.length < 2 || text.length > 160) return false;
  if (/^(?:home|inicio|blog|servicios?|services?|about|nosotros|privacy|privacidad|cookies?|legal|menu|search|buscar)$/i.test(text)) return false;
  return /(?:book|agenda|reserva|schedule|demo|consult|audit|contact|quote|presupuesto|cotiza|apply|start|empieza|whatsapp|call|llama|download|descarga|pricing|precio|plan|trial|prueba|free|gratis|case|casos|how it works|cómo funciona)/i.test(`${text} ${href}`);
}

function ctaCommitment(value) {
  const text = clean(`${value.text || ""} ${value.href || ""}`);
  if (/checkout|buy|purchase|pagar|comprar|contratar|apply|solicitud|request quote|presupuesto/i.test(text)) return "alto";
  if (/book|agenda|reserva|schedule|demo|consult|contact|whatsapp|call|llama/i.test(text)) return "medio";
  return "bajo";
}

function detectTechnologies(rendered, evidenceByUrl) {
  const signatures = [
    ["Google Tag Manager", /googletagmanager/i], ["Google Analytics", /google-analytics|analytics\.google/i],
    ["Google Ads", /googleadservices|doubleclick/i], ["Meta Pixel", /connect\.facebook\.net|facebook\.com\/tr/i],
    ["Microsoft Clarity", /clarity\.ms/i], ["Hotjar", /hotjar/i], ["HubSpot", /hubspot|hsforms/i],
    ["Calendly", /calendly/i], ["Typeform", /typeform/i], ["Jotform", /jotform/i],
    ["Contact Form 7", /contact-form-7|wpcf7/i], ["WordPress", /wp-content|wp-includes/i],
    ["Webflow", /webflow/i], ["Wix", /wixstatic|wix\.com/i], ["Squarespace", /squarespace/i],
    ["Intercom", /intercom/i], ["Crisp", /crisp\.chat/i], ["Tidio", /tidio/i], ["Drift", /drift/i],
    ["reCAPTCHA", /recaptcha/i], ["Stripe", /stripe/i], ["PayPal", /paypal/i], ["Razorpay", /razorpay/i],
    ["Mailchimp", /mailchimp|list-manage/i], ["ActiveCampaign", /activecampaign/i], ["Brevo", /sendinblue|brevo/i],
  ];
  return signatures.flatMap(([technology, regex]) => {
    const matchingPages = (rendered?.pages || []).filter((page) => regex.test([...(page.scripts || []), ...(page.iframes || []), ...(page.networkHosts || [])].join("\n")));
    if (!matchingPages.length) return [];
    return [{ technology, status: "observado", evidenceIds: unique(matchingPages.map((page) => evidenceIdForUrl(evidenceByUrl, page.url)).filter(Boolean)) }];
  });
}

function formQualification(fields) {
  const patterns = [
    ["identidad", /name|nombre|nom|이름|氏名|الاسم/i], ["contacto", /email|mail|phone|tel|mobile|whatsapp|correo/i],
    ["empresa", /company|empresa|business|organisation|organization|compañía/i], ["cargo", /role|job|position|puesto|cargo/i],
    ["sector", /industry|sector|vertical|niche|actividad/i], ["tamaño", /employees|team|equipo|size|headcount/i],
    ["facturación", /revenue|turnover|factur|ventas|ingresos/i], ["presupuesto", /budget|presupuesto|investment|inversión/i],
    ["necesidad", /service|servicio|help|need|project|proyecto/i], ["objetivo", /goal|objetivo|target|resultado/i],
    ["zona", /city|ciudad|area|zona|region|postal|zip|country|país|location/i], ["plazo", /timeline|when|fecha|date|plazo|urgency/i],
    ["sitio web", /website|sitio|web|domain|url/i], ["mensaje abierto", /message|mensaje|comments|comentarios|textarea/i],
  ];
  const corpus = fields.map((field) => `${field.name} ${field.label} ${field.placeholder}`).join("\n");
  return patterns.filter(([, regex]) => regex.test(corpus)).map(([name]) => name);
}

function assessFormFriction(fields) {
  const visible = fields.length;
  const required = fields.filter((field) => field.required).length;
  const corpus = fields.map((field) => `${field.name} ${field.label} ${field.placeholder}`).join(" ");
  const sensitive = unique([
    /budget|presupuesto|investment|inversión/i.test(corpus) ? "presupuesto" : null,
    /revenue|turnover|factur|ingresos/i.test(corpus) ? "facturación" : null,
    /phone|tel|mobile|whatsapp/i.test(corpus) ? "teléfono" : null,
    /employees|headcount|tamaño|size/i.test(corpus) ? "tamaño de empresa" : null,
  ]);
  const score = visible + required + sensitive.length * 2;
  return {
    level: score <= 6 ? "baja" : score <= 14 ? "media" : "alta",
    score,
    requiredRatio: visible ? Math.round((required / visible) * 100) : 0,
    sensitiveDimensions: sensitive,
    explanation: visible
      ? `${visible} campo(s), ${required} obligatorio(s) y ${sensitive.length} dimensión(es) de mayor fricción antes del envío.`
      : "No se identificaron controles de entrada visibles en el formulario renderizado.",
  };
}

function strengthRows(company, forms, proofSignals, priceSignals, technology, primaryCta) {
  return unique([
    company.offer ? `Oferta articulada: ${truncate(company.offer, 260)}` : null,
    primaryCta ? `Ruta de conversión visible hacia “${primaryCta.text}”.` : null,
    forms.length ? `${forms.length} formulario(s) renderizado(s) con campos inventariados.` : null,
    proofSignals.length ? `Usa prueba comercial visible; debe leerse como afirmación propia salvo validación externa.` : null,
    priceSignals.length || company.price?.amount !== null ? "Existe señal pública de precio o modelo económico." : null,
    technology.length ? `Instrumentación comercial observable: ${technology.slice(0, 5).map((row) => row.technology).join(", ")}.` : null,
  ], 8);
}

function buildEvidence(company, sourceRecord, rendered, manualValues, item) {
  let manualCounter = 1;
  const manualEvidenceRows = manualValues.flatMap((value) => [
    ...(value?.evidence || []),
    ...(value?.messageAndVoice?.evidence || []),
    ...(value?.sources || []).filter((row) => row && typeof row === "object"),
  ]);
  const manualEvidence = uniqueObjects(manualEvidenceRows.map((row) => ({
    id: clean(row.id) || `MAN-${String(manualCounter++).padStart(3, "0")}`,
    url: safeUrl(row.url),
    title: clean(row.title || row.type || row.observation || row.supports?.join(" · ") || "Evidencia manual"),
    accessedAt: row.accessedAt || "2026-08-22",
    sourceType: row.sourceType || sourceType(row.url),
    relation: row.relation || row.sourceRelation || null,
    status: row.status || "observado",
    supports: row.supports || [],
  })).filter((row) => row.id && row.url), (row) => row.id);
  const usedIds = new Set(manualEvidence.map((row) => row.id));
  const manualUrls = new Set(manualEvidence.map((row) => row.url));
  let counter = 1;
  const urls = unique([
    company?.website, company?.domain, item?.website,
    ...(company?.sources || []), ...(sourceRecord?.sourceAudit?.cleanPublicUrls || []),
    ...(sourceRecord?.pages || []).map((page) => page.url), ...(rendered?.pages || []).map((page) => page.url),
    ...(rendered?.pages || []).flatMap((page) => (page.embeddedFrames || []).map((frame) => frame.url)),
    ...manualValues.flatMap((value) => [
      ...(value?.officialUrls || []),
      ...(value?.sources || []).map((row) => typeof row === "string" ? row : row?.url),
      ...(value?.messageAndVoice?.evidence || []).map((row) => row.url),
    ]),
  ].map(safeUrl).filter(Boolean), 120);
  const autoEvidence = urls.filter((url) => !manualUrls.has(url)).map((url) => {
    let id;
    do { id = `WEB-${String(counter++).padStart(3, "0")}`; } while (usedIds.has(id));
    const page = (rendered?.pages || []).find((row) => row.url === url)
      || (rendered?.pages || []).flatMap((row) => row.embeddedFrames || []).find((row) => row.url === url)
      || (sourceRecord?.pages || []).find((row) => row.url === url);
    return {
      id,
      url,
      title: clean(page?.title || `Fuente pública ${counter - 1}`),
      accessedAt: "2026-08-22",
      sourceType: sourceType(url),
      relation: page?.sourceRelation || null,
      status: page ? "observado" : "referencia pública",
      supports: [],
    };
  });
  return uniqueObjects([...manualEvidence, ...autoEvidence], (row) => row.id, 160);
}

function normalizeStatus(value, fallback = "inferido") {
  const text = clean(value).toLowerCase();
  if (text === "observado" || /^observado\b/.test(text)) return "observado";
  if (text === "inferido" || /inferid/.test(text) || /mixto/.test(text)) return "inferido";
  if (/no observable|desconocid|unknown/.test(text)) return "no observable";
  if (/no aplica/.test(text)) return "no aplica";
  return fallback;
}

function manualStatement(value) {
  if (typeof value === "string" || typeof value === "number") return clean(value);
  if (!value || typeof value !== "object") return "";
  return clean(value.statement || value.detail || value.finding || value.summary || value.text || value.label || value.name);
}

function manualStatementRows(value, path = "", rows = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => manualStatementRows(child, `${path}[${index}]`, rows));
    return rows;
  }
  if (!value || typeof value !== "object") return rows;
  const statement = manualStatement(value);
  if (statement) {
    rows.push({
      ...value,
      text: statement,
      sourcePath: path || null,
      status: normalizeStatus(value.status, "observado"),
      evidenceIds: unique(value.evidenceIds || []),
    });
  }
  for (const [key, child] of Object.entries(value)) {
    if (["statement", "detail", "finding", "summary", "text", "label", "name", "evidenceIds", "status"].includes(key)) continue;
    manualStatementRows(child, path ? `${path}.${key}` : key, rows);
  }
  return rows;
}

function evidenceIdsForUrls(urls, evidenceByUrl, fallback = []) {
  const ids = (urls || []).map((url) => evidenceByUrl.get(safeUrl(url))).filter(Boolean);
  return unique(ids.length ? ids : fallback);
}

function inferFieldType(value) {
  const text = clean(value);
  if (/email|correo|mail/i.test(text)) return "email";
  if (/tel[eé]fono|phone|mobile|whatsapp|sms/i.test(text)) return "tel";
  if (/mensaje|message|coment|descrip|detalle|textarea/i.test(text)) return "textarea";
  if (/acepto|consent|privacy|privacidad|terms|sms opcional|promocional/i.test(text)) return "checkbox";
  if (/fecha|date|plazo|when/i.test(text)) return "date-or-select";
  if (/tipo|sector|servicio|presupuesto|budget|zona|ciudad|country|pa[ií]s|opci[oó]n/i.test(text)) return "select-or-text";
  return "text";
}

function normalizeManualForms(manual, evidenceByUrl, fallbackEvidenceIds) {
  const rawForms = manual?.ctaAndForms?.forms || manual?.conversion?.forms || manual?.captureAndQualification?.forms || manual?.captureAndQualification?.flows || [];
  return rawForms.map((form, formIndex) => {
    const rawFields = form.fields || [];
    const reportedRequired = Number.isFinite(Number(form.requiredFields ?? form.requiredFieldCount))
      ? Number(form.requiredFields ?? form.requiredFieldCount)
      : null;
    let allocatedRequired = rawFields.filter((field) => /obligator|required/i.test(typeof field === "string" ? field : `${field.label || ""} ${field.requiredBasis || ""}`)).length;
    const fields = rawFields.map((field, fieldIndex) => {
      if (field && typeof field === "object") {
        return {
          ...field,
          type: clean(field.type) || inferFieldType(field.label || field.name || field.placeholder),
          required: typeof field.required === "boolean" ? field.required : false,
        };
      }
      const label = clean(field);
      const explicitlyOptional = /opcional|optional/i.test(label);
      const explicitlyRequired = /obligator|required/i.test(label);
      let required = explicitlyRequired;
      if (!explicitlyOptional && !explicitlyRequired && reportedRequired !== null && allocatedRequired < reportedRequired) {
        required = true;
        allocatedRequired += 1;
      }
      return {
        tag: "manual-inventory",
        type: inferFieldType(label),
        name: "",
        label,
        placeholder: "",
        required,
        requiredBasis: explicitlyRequired ? "declarado en el inventario manual" : explicitlyOptional ? "declarado opcional" : required ? "inferido desde el total de obligatorios documentado" : "no marcado como obligatorio",
        options: [],
        manualOrder: fieldIndex + 1,
      };
    });
    const sourceUrl = safeUrl(form.url || form.sourceUrl || form.pageUrl);
    const requiredFieldCount = fields.filter((field) => field.required).length;
    return {
      pageUrl: sourceUrl,
      sourceUrl,
      embedded: false,
      evidenceIds: unique([
        ...(form.evidenceIds || []),
        ...evidenceIdsForUrls([sourceUrl], evidenceByUrl, fallbackEvidenceIds),
      ]),
      formIndex: formIndex + 1,
      purpose: form.purpose || form.name || form.note || null,
      steps: Number.isFinite(Number(form.steps)) ? Number(form.steps) : null,
      destinationLabel: clean(form.destination) || null,
      action: safeUrl(form.action) || form.action || null,
      method: form.method || null,
      visibleFieldCount: Number(form.visibleFields ?? form.fieldCount ?? form.visibleFieldCount ?? fields.length),
      requiredFieldCount,
      fields,
      submitLabels: form.submitLabels || [],
      consentText: form.consentText || fields.filter((field) => field.type === "checkbox").map((field) => field.label),
      qualificationDimensions: formQualification(fields),
      friction: { ...assessFormFriction(fields), reported: form.friction || null },
      submissionPerformed: false,
      manualStatus: normalizeStatus(form.status || form.submission, "observado"),
    };
  });
}

function normalizeManualCtas(manual, evidenceByUrl, fallbackEvidenceIds) {
  const primary = manual?.ctaAndForms?.primaryCta || manual?.conversion?.primaryCta || manual?.ctaLadder?.primary || null;
  const rawSecondary = manual?.ctaAndForms?.secondaryCtas || manual?.conversion?.secondaryCtas || manual?.ctaLadder?.secondary || [];
  const secondary = Array.isArray(rawSecondary) ? rawSecondary : [rawSecondary];
  const normalize = (row, role) => {
    const object = row && typeof row === "object" ? row : { label: clean(row) };
    const destination = safeUrl(object.destination || object.href || object.url);
    const text = manualStatement(object) || clean(row);
    return {
      text,
      href: destination,
      destinationLabel: destination ? null : clean(object.destination),
      element: "CTA documentado manualmente",
      role,
      commitment: ctaCommitment({ text, href: destination }),
      status: normalizeStatus(object.status, "observado"),
      evidenceIds: unique([
        ...(object.evidenceIds || []),
        ...evidenceIdsForUrls([destination], evidenceByUrl, fallbackEvidenceIds),
      ]),
    };
  };
  return {
    primary: primary ? normalize(primary, "primario") : null,
    secondary: secondary.map((row) => normalize(row, "secundario")).filter((row) => row.text),
  };
}

function normalizeManualFunnel(manual, evidenceByUrl, fallbackEvidenceIds) {
  const raw = Array.isArray(manual?.funnel)
    ? manual.funnel
    : manual?.funnel?.primaryPath || [];
  return raw.map((row) => ({
    sourceStage: clean(row.stage),
    detail: manualStatement(row),
    status: normalizeStatus(row.status, "inferido"),
    evidenceIds: unique([
      ...(row.evidenceIds || []),
      ...evidenceIdsForUrls(row.evidenceUrls || [], evidenceByUrl, fallbackEvidenceIds),
    ]),
  })).filter((row) => row.sourceStage || row.detail);
}

function mapManualV1(values, evidenceByUrl, fallbackEvidenceIds = []) {
  const manual = values.find((value) => String(value?.schemaVersion || "").includes("manual"))
    || values.find((value) => value?.schemaVersion === "rv-funnel-forensics-v3");
  if (!manual) return {};
  const message = manual.messageAndVoice || manual.voice || manual.messageArchitecture || null;
  const manualEvidenceIds = unique([
    ...(manual.evidence || []).map((row) => row.id),
    ...(manual.messageAndVoice?.evidence || []).map((row) => row.id),
    ...evidenceIdsForUrls((manual.sources || []).map((row) => typeof row === "string" ? row : row?.url), evidenceByUrl, fallbackEvidenceIds),
  ]);
  const messageEvidenceIds = unique([
    ...(manual.messageAndVoice?.evidence || []).map((row) => row.id),
    ...manualEvidenceIds.slice(0, 6),
  ]);
  const manualFunnel = normalizeManualFunnel(manual, evidenceByUrl, manualEvidenceIds);
  const acquisitionFindings = manualFunnel.filter((row) => /atracci|descubr|adquis|seo|contenido|traffic/i.test(`${row.sourceStage} ${row.detail}`));
  const proof = manual.proofAndObjections?.proof || (manual.proof ? [manual.proof] : manual.proofAndTrust ? [manual.proofAndTrust] : []);
  const objections = manual.proofAndObjections?.objections || manual.objections || manualStatementRows(manual.objectionsAndSales);
  const manualContradictions = manual.commercialTerms?.contradictionsOrAmbiguities
    || manual.messageArchitecture?.contradictions
    || manual.contradictions
    || [];
  return {
    source: manual,
    evidenceIds: manualEvidenceIds,
    messageArchitecture: message ? {
      status: normalizeStatus(message.status, "observado"),
      headline: manualStatement(message.headline || message.hero) || null,
      promise: manualStatement(message.promise || message.primaryPromise) || null,
      audience: manualStatement(message.audience) || manualStatement(manual.classification?.idealCustomer) || manual.offer?.audience || null,
      archetype: message.archetype || null,
      tone: message.tone || message.toneSignals || [manualStatement(message.voice)].filter(Boolean),
      languagePatterns: message.languagePatterns || message.recurringLanguage || [manualStatement(message.linguisticPatterns)].filter(Boolean),
      messageHierarchy: message.messageHierarchy || [],
      emotionalDrivers: message.emotionalDrivers || null,
      contradictions: manualContradictions.map(manualStatement).filter(Boolean),
      manualDimension: manual.messageArchitecture || null,
      evidenceIds: messageEvidenceIds,
    } : null,
    acquisition: acquisitionFindings.length ? {
      status: acquisitionFindings.some((row) => row.status === "observado") ? "observado" : "inferido",
      findings: acquisitionFindings,
      explanation: "Canales o activos descritos en la revisión manual; no equivalen a inversión, tráfico o atribución verificados.",
      evidenceIds: unique(acquisitionFindings.flatMap((row) => row.evidenceIds)),
    } : null,
    ctas: normalizeManualCtas(manual, evidenceByUrl, manualEvidenceIds),
    forms: normalizeManualForms(manual, evidenceByUrl, manualEvidenceIds),
    funnelFindings: manualFunnel,
    offerEconomics: manual.commercialTerms || manual.offer || manual.offerEconomics || null,
    proof,
    objections,
    technology: manual.stack || manual.technology || manual.technologyAndNurture || null,
    competitiveAssessment: manual.redVitaliaLessons || manual.redVitalia || manual.competitiveAssessment || null,
    limitations: (manual.limitations || []).map(manualStatement).filter(Boolean),
    manualClassification: manual.classification || null,
    manualAcquisition: manual.acquisition || null,
    manualCtaLadder: manual.ctaLadder || null,
    manualCapture: manual.captureAndQualification || null,
    manualProofAndTrust: manual.proofAndTrust || null,
    manualObjectionsAndSales: manual.objectionsAndSales || null,
    manualDeliveryOperations: manual.deliveryOperations || null,
  };
}

function manualFunnelIndex(row) {
  const value = `${row.sourceStage || ""} ${row.detail || ""}`.toLowerCase();
  if (/retenci|reversi|seguim|follow|nurtur|reactiv|report|renov/.test(value)) return 11;
  if (/onboard|implement|activaci|entrega|delivery|fulfil|servicio/.test(value)) return 10;
  if (/propuesta|cierre|checkout|pago|cobro|factur|venta/.test(value)) return 9;
  if (/conversaci|llamada comercial|sales call|diagn[oó]stico/.test(value)) return 8;
  if (/reserva|agenda|booking|contacto/.test(value)) return 7;
  if (/cualif|calif|filtro|scor|validaci/.test(value)) return 6;
  if (/captura|captaci[oó]n|formulario|cuestionario|consent/.test(value)) return 5;
  if (/\bcta\b|llamada a la acci[oó]n/.test(value)) return 4;
  if (/prueba|confianza|testimonial|review|caso/.test(value)) return 3;
  if (/promesa|encaje|mensaje|propuesta de valor/.test(value)) return 2;
  if (/landing|entrada|consideraci/.test(value)) return 1;
  if (/descubr|atracci|adquis|seo|anuncios?|ads|contenido/.test(value)) return 0;
  return null;
}

function mergeManualFunnel(base, findings) {
  const result = base.map((row) => ({ ...row, manualFindings: [] }));
  for (const finding of findings || []) {
    const index = manualFunnelIndex(finding);
    if (index === null) continue;
    const stage = result[index];
    stage.manualFindings.push(finding);
    stage.evidenceIds = unique([...(stage.evidenceIds || []), ...(finding.evidenceIds || [])]);
    // A public description, price, SLA or case study can support an inference
    // about the private path, but it does not make the actual post-booking
    // sales or delivery event observable.
    if (finding.status === "observado" && index >= 8) stage.status = "inferido";
    else if (finding.status === "observado") stage.status = "observado";
    else if (finding.status === "inferido" && stage.status !== "observado") stage.status = "inferido";
    stage.detail = truncate(`${stage.detail} Revisión manual: ${finding.detail}`, 1_100);
    if (index >= 8 && finding.status === "observado") {
      stage.detail = truncate(`${stage.detail} La señal pública es observable; la ejecución real de esta fase no se activó ni validó.`, 1_100);
    }
    stage.limitation = stage.status === "no observable" ? stage.detail : null;
  }
  return result;
}

function numericAmount(value) {
  const text = clean(value).replace(/\s/g, "");
  if (!text) return null;
  const normalized = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)
    ? text.replaceAll(".", "").replace(",", ".")
    : /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text)
      ? text.replaceAll(",", "")
      : text.includes(",") && text.includes(".")
        ? text.lastIndexOf(",") > text.lastIndexOf(".")
          ? text.replaceAll(".", "").replace(",", ".")
          : text.replaceAll(",", "")
        : /^\d+,\d{1,2}$/.test(text)
          ? text.replace(",", ".")
          : text.replaceAll(",", "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function collectManualPriceConversions(value, fx, evidenceIds = []) {
  const rows = [];
  const currencyPattern = /\b(EUR|USD|GBP|AED|JPY|CAD|AUD|CHF|INR|MXN|BRL|PLN|SAR|QAR|GEL|KRW|CNY|KZT|NGN|ZAR|SGD|MYR|IDR|VND|THB|PHP|EGP|MAD|TRY|NZD|DKK|NOK|SEK)\b/i;
  const symbolCurrency = (text) => text.includes("€") ? "EUR" : text.includes("£") ? "GBP" : text.includes("¥") ? "JPY" : text.includes("₹") ? "INR" : text.includes("$") ? "USD" : null;
  const add = (path, amount, currency, label) => {
    const rate = Number(fx?.rates?.[currency]);
    const eur = currency === "EUR" ? amount : rate > 0 ? Math.round((amount / rate) * 100) / 100 : null;
    rows.push({
      path,
      label: clean(label),
      local: { amount, currency },
      eur: eur === null ? null : { amount: eur, currency: "EUR" },
      conversion: currency === "EUR" ? "No requiere conversión." : rate > 0 ? { rateUnitsPerEur: rate, base: fx.base, rateDate: fx.timeLastUpdateUtc, source: fx.source, sourceUrl: fx.sourceUrl, disclaimer: fx.disclaimer } : null,
      caveat: amount === 0 && /revenue share|porcentaje|%|participaci/i.test(clean(label)) ? "El cero corresponde al fijo o al lead; no representa coste total cero." : null,
      status: "observado en revisión manual",
      evidenceIds,
    });
  };
  function walk(node, path = "$", inheritedCurrency = null) {
    if (Array.isArray(node)) return node.forEach((child, index) => walk(child, `${path}[${index}]`, inheritedCurrency));
    if (node && typeof node === "object") {
      const localCurrency = clean(node.currency).toUpperCase() || inheritedCurrency;
      for (const [key, child] of Object.entries(node)) {
        if (key === "currency") continue;
        if (typeof child === "number" && localCurrency && /(?:price|amount|setup|monthly|annual|fee|cost|tarif|precio|cuota|alta|desde|starting|minim)/i.test(key) && !/percent|porcentaje/i.test(key)) add(`${path}.${key}`, child, localCurrency, key);
        else walk(child, `${path}.${key}`, localCurrency);
      }
      return;
    }
    if (typeof node !== "string") return;
    const explicitCurrency = node.match(currencyPattern)?.[1]?.toUpperCase() || null;
    const currency = (explicitCurrency || symbolCurrency(node) || inheritedCurrency || "").toUpperCase();
    if (!currency) return;
    const regex = /(?:(EUR|USD|GBP|AED|JPY|CAD|AUD|CHF|INR|MXN|BRL|PLN|SAR|QAR|GEL|KRW|CNY|KZT|NGN|ZAR|SGD|MYR|IDR|VND|THB|PHP|EGP|MAD|TRY|NZD|DKK|NOK|SEK|[$€£¥₹])\s*)?(\d[\d.,\s]*)(?:\s*(EUR|USD|GBP|AED|JPY|CAD|AUD|CHF|INR|MXN|BRL|PLN|SAR|QAR|GEL|KRW|CNY|KZT|NGN|ZAR|SGD|MYR|IDR|VND|THB|PHP|EGP|MAD|TRY|NZD|DKK|NOK|SEK|[$€£¥₹]))?/gi;
    for (const match of node.matchAll(regex)) {
      const token = `${match[1] || ""}${match[3] || ""}`;
      if (!token && !(inheritedCurrency && /^\s*\d[\d.,\s]*\s*$/.test(node))) continue;
      const matchCurrency = (String(match[1] || match[3] || "").match(currencyPattern)?.[1] || explicitCurrency || symbolCurrency(token) || currency).toUpperCase();
      const amount = numericAmount(match[2]);
      if (amount !== null) add(path, amount, matchCurrency, node);
    }
  }
  walk(value);
  return uniqueObjects(rows, (row) => `${row.path}|${row.local.currency}|${row.local.amount}`, 60);
}

function noApplicable(value, reason) {
  return { status: "no aplica", value, explanation: reason, evidenceIds: [] };
}

function buildReview(item, company, sourceRecord, v2, rendered, manualValues, fx) {
  const evidence = buildEvidence(company, sourceRecord, rendered, manualValues, item);
  const evidenceByUrl = new Map(evidence.map((row) => [row.url, row.id]));
  const defaultEvidenceIds = evidence.slice(0, 3).map((row) => row.id);
  const manual = mapManualV1(manualValues, evidenceByUrl, defaultEvidenceIds);
  const pageIds = (rendered?.pages || []).map((page) => evidenceIdForUrl(evidenceByUrl, page.url)).filter(Boolean);
  const excluded = item.scope === "Excluir — fuente/no negocio";
  const pages = rendered?.pages || [];
  const commercialPages = pages.filter((page) => !isUtilityPage(page));
  const commercialCopyPages = commercialPages.filter((page) => page.sourceRelation !== "external_funnel_destination");
  const commercialRendered = renderedWithPages(rendered, commercialCopyPages);
  const commercialPageIds = commercialCopyPages.map((page) => evidenceIdForUrl(evidenceByUrl, page.url)).filter(Boolean);
  const rootPage = commercialCopyPages.find((page) => { try { return new URL(page.url).pathname.replace(/\/+$/, "") === ""; } catch { return false; } }) || commercialCopyPages[0] || pages[0];
  const headings = unique(commercialCopyPages.flatMap((page) => page.headings || []).map((row) => row.text), 160);
  const headline = manual.messageArchitecture?.headline || rootPage?.headings?.find((row) => row.level === "h1")?.text || v2?.message?.hero || headings[0] || null;
  const proofSignals = pageEvidence(commercialRendered, evidenceByUrl, /(?:case stud|casos? de [eé]xito|testimonial|reseña|reviews?|trusted by|conf[ií]an|han confiado|success stor|resultados?\s*(?:reales|obtenidos|de clientes)|\d+[.,]?\d*\s*%|\d+[.,]?\d*\+?\s*(?:clientes?|clients?|companies|empresas|leads?|appointments?|citas?|sales|ventas))/i, 16);
  const priceSignals = pageEvidence(commercialRendered, evidenceByUrl, /(?:[$€£¥₹₩₽₺₦₫₱฿₪₾]|\b(?:USD|EUR|GBP|AED|JPY|CAD|AUD|CHF|INR|MXN|BRL|PLN|SAR|QAR|GEL|KRW|CNY|KZT|NGN|ZAR|SGD|MYR|IDR|VND|THB|PHP|EGP|MAD|TRY)\b).{0,100}\d|(?:precio|price|coste|cost|fee|tarifa|desde|starting at).{0,70}\d/i, 18);
  const guaranteeSignals = pageEvidence(commercialRendered, evidenceByUrl, /(?:guarantee|garant[ií]a|refund|reembolso|money back|sin permanencia|cancel anytime|riesgo|risk[- ]free)/i, 14);
  const objectionSignals = pageEvidence(commercialRendered, evidenceByUrl, /(?:faq|frequently asked|preguntas frecuentes|¿|\?)/i, 18);
  const mechanismSignals = pageEvidence(commercialRendered, evidenceByUrl, /(?:m[eé]todo|method|sistema|system|proceso|process|how it works|cómo funciona|paso\s*\d|step\s*\d|framework|plataforma|platform)/i, 14);
  const painSignals = pageEvidence(commercialRendered, evidenceByUrl, /(?:problema|problem|sin clientes|falta de|struggl|waste|perder|pérdida|coste alto|no tienes|difícil|frustr)/i, 12);
  const outcomeSignals = pageEvidence(commercialRendered, evidenceByUrl, /(?:consigue|obt[eé]n|genera|generate|grow|crece|aumenta|increase|reduce|ahorra|save|citas?|appointments?|leads?|clientes?|sales|ventas)/i, 14);
  const renderedForms = commercialPages.flatMap((page) => [
    ...(page.forms || []).map((form) => ({ form, sourceUrl: page.url, parentPageUrl: page.url, embedded: false })),
    ...(page.embeddedFrames || []).flatMap((frame) => (frame.forms || []).map((form) => ({ form, sourceUrl: frame.url, parentPageUrl: page.url, embedded: true }))),
  ].map(({ form, sourceUrl, parentPageUrl, embedded }, index) => ({
    pageUrl: parentPageUrl,
    sourceUrl,
    embedded,
    evidenceIds: evidenceIdForUrl(evidenceByUrl, sourceUrl) ? [evidenceIdForUrl(evidenceByUrl, sourceUrl)] : evidenceIdForUrl(evidenceByUrl, parentPageUrl) ? [evidenceIdForUrl(evidenceByUrl, parentPageUrl)] : [],
    formIndex: index + 1,
    action: safeUrl(form.action) || form.action || null,
    method: form.method,
    visibleFieldCount: form.visibleFieldCount,
    requiredFieldCount: form.requiredFieldCount,
    fields: form.fields || [],
    submitLabels: form.submitLabels || [],
    consentText: form.consentText || [],
    qualificationDimensions: formQualification(form.fields || []),
    friction: assessFormFriction(form.fields || []),
    submissionPerformed: false,
  })));
  const forms = uniqueObjects(
    [...(manual.forms || []), ...renderedForms],
    (form) => `${form.sourceUrl || form.pageUrl}|${JSON.stringify((form.fields || []).map((field) => [field.type, field.name, field.label, field.required]))}`,
    40,
  );
  const renderedCtas = commercialPages.flatMap((page) => [
    ...(page.links || []).filter(likelyCta).map((row) => ({ ...row, element: "enlace", sourceUrl: page.url, parentPageUrl: page.url })),
    ...(page.buttons || []).filter(likelyCta).map((row) => ({ ...row, href: null, element: "botón", sourceUrl: page.url, parentPageUrl: page.url })),
    ...(page.embeddedFrames || []).flatMap((frame) => (frame.buttons || []).filter(likelyCta).map((row) => ({ ...row, href: null, element: "botón incrustado", sourceUrl: frame.url, parentPageUrl: page.url }))),
  ].map((row) => ({
    text: clean(row.text || row.ariaLabel), href: safeUrl(row.href) || null, element: row.element,
    commitment: ctaCommitment(row), pageUrl: row.sourceUrl || row.parentPageUrl, parentPageUrl: row.parentPageUrl, status: "observado",
    evidenceIds: evidenceIdForUrl(evidenceByUrl, row.sourceUrl || row.parentPageUrl) ? [evidenceIdForUrl(evidenceByUrl, row.sourceUrl || row.parentPageUrl)] : [],
  })));
  const manualCtas = [manual.ctas?.primary, ...(manual.ctas?.secondary || [])].filter(Boolean);
  const ctas = uniqueObjects([...manualCtas, ...renderedCtas], (row) => `${row.text.toLowerCase()}|${row.href || ""}`, 60);
  const commitmentWeight = { alto: 3, medio: 2, bajo: 1 };
  let officialHost = "";
  try { officialHost = new URL(company?.website || company?.domain || item.website).hostname.replace(/^www\./, ""); } catch { officialHost = ""; }
  const ctaPriority = (row) => {
    let score = (commitmentWeight[row.commitment] || 0) * 100;
    if (row.role === "primario") score += 250;
    try {
      const host = new URL(row.pageUrl).hostname.replace(/^www\./, "");
      if (host === officialHost) score += 80;
      else if (host.endsWith(`.${officialHost}`)) score += 15;
    } catch { /* ignore */ }
    if (/propuesta|proposal|consult|consulta|demo|contact|contacto|agenda|book/i.test(row.text)) score += 45;
    if (/presupuestos? gratis|compare|comparar|solicitar profesionales?/i.test(row.text)) score -= 50;
    return score;
  };
  const primaryCta = ctas.sort((a, b) => ctaPriority(b) - ctaPriority(a))[0] || null;
  const technology = detectTechnologies(rendered, evidenceByUrl);
  const contactCorpus = `${v2?.conversion?.contacts?.join(" ") || ""} ${ctas.map((row) => `${row.text} ${row.href}`).join(" ")}`;
  const contacts = unique([
    /wa\.me|whatsapp/i.test(contactCorpus) ? "WhatsApp" : null,
    /mailto:|email|correo/i.test(contactCorpus) ? "Email" : null,
    /tel:|phone|tel[eé]fono|llama/i.test(contactCorpus) ? "Teléfono" : null,
    /chat|intercom|crisp|tidio|drift/i.test(`${contactCorpus} ${technology.map((row) => row.technology).join(" ")}`) ? "Chat" : null,
  ]);
  const booking = ctas.filter((row) => /book|agenda|reserva|schedule|calendly|cita|appointment|demo/i.test(`${row.text} ${row.href || ""}`));
  const qualificationDimensions = unique(forms.flatMap((form) => form.qualificationDimensions));
  const manualEconomicText = JSON.stringify(manual.offerEconomics || {});
  const manualPriceKnown = /"pricing"|"price"|"precio"|"packages"|"coste por lead"|"revenue share"/i.test(manualEconomicText)
    && !/^\{\}$/.test(manualEconomicText);
  const manualContractKnown = /"contract"|"contrato"|"permanencia"|"cancel/i.test(manualEconomicText);
  const manualGuaranteeKnown = /"guarantee"|"garant[ií]a"|"cr[eé]dito"|"reposici/i.test(manualEconomicText);
  const priceKnown = Boolean(company?.price && (company.price.amount !== null || company.price.label && !/No publicado|oculta|no convertible|no identific/i.test(company.price.label))) || priceSignals.length > 0 || manualPriceKnown;
  const contractKnown = Boolean(company?.contract && !/No publicado|ausencia|no localiz|ocult|incomplet|no especific/i.test(company.contract)) || manualContractKnown;
  const guaranteeKnown = Boolean(company?.guarantee && !/No publicada|ausencia|no localiz/i.test(company.guarantee)) || guaranteeSignals.length > 0 || manualGuaranteeKnown;
  const contentSignals = pageEvidence(commercialRendered, evidenceByUrl, /(?:blog|guide|gu[ií]a|ebook|whitepaper|webinar|newsletter|casos?|resources?|recursos)/i, 12);
  const adEvidenceIds = evidence.filter((row) => /adstransparency\.google|facebook\.com\/ads\/library/i.test(row.url)).map((row) => row.id);
  const attributedAdSignal = Number(company?.googleAds || 0) > 0 || Number(company?.metaAds || 0) > 0
    || /activ|vigente|en circulaci[oó]n|running/i.test(`${company?.googleStatus || ""} ${company?.metaStatus || ""}`);
  const discoveryStatus = manual.acquisition?.status || (attributedAdSignal || contentSignals.length || (company?.channels || []).some((channel) => !/web|landing/i.test(channel))
    ? "inferido"
    : "no observable");
  const discoveryEvidenceIds = unique([
    ...adEvidenceIds,
    ...contentSignals.flatMap((row) => row.evidenceIds),
    ...(manual.acquisition?.evidenceIds || []),
  ]);
  const funnelEvidence = (stage, status, detail, ids = defaultEvidenceIds) => ({ stage, status, detail, evidenceIds: unique(ids), limitation: status === "no observable" ? detail : null });
  let funnel = [
    funnelEvidence("Descubrimiento / adquisición", discoveryStatus, discoveryStatus === "inferido" ? "Hay señales públicas de posibles canales de entrada, pero no se observó tráfico, inversión, atribución ni rendimiento real." : "La existencia de una web no demuestra cómo descubre la audiencia a la empresa; no se observó un canal atribuible.", discoveryEvidenceIds),
    funnelEvidence("Landing / entrada", commercialCopyPages.length ? "observado" : "no observable", commercialCopyPages.length ? `${commercialCopyPages.length} página(s) comercial(es) oficiales renderizada(s) y revisada(s); las páginas legales y las plataformas externas se separaron del análisis persuasivo.` : "Sin landing comercial oficial renderizada.", commercialPageIds),
    funnelEvidence("Promesa y encaje", headline ? "observado" : "no observable", headline || "No se recuperó un mensaje principal legible.", pageIds.slice(0, 3)),
    funnelEvidence("Prueba / confianza", proofSignals.length || company?.proof ? "observado" : "no observable", proofSignals.length ? `${proofSignals.length} señal(es) pública(s) de prueba; son claims propios salvo indicación contraria.` : company?.proof || "No se localizó prueba pública legible.", unique(proofSignals.flatMap((row) => row.evidenceIds))),
    funnelEvidence("CTA", ctas.length ? "observado" : "no observable", ctas.length ? `${ctas.length} CTA o variantes visibles; principal reconstruido: ${primaryCta?.text}.` : "No se observó un CTA legible.", unique(ctas.flatMap((row) => row.evidenceIds))),
    funnelEvidence("Captura", forms.length || contacts.length ? "observado" : "no observable", forms.length ? `${forms.length} diseño(s) de formulario renderizado(s).` : contacts.length ? `Contacto directo mediante ${contacts.join(", ")}.` : "No se observó captura pública.", unique(forms.flatMap((row) => row.evidenceIds))),
    funnelEvidence("Cualificación", qualificationDimensions.length ? "observado" : "no observable", qualificationDimensions.length ? `Dimensiones visibles: ${qualificationDimensions.join(", ")}.` : "No se observaron filtros explícitos antes del contacto.", unique(forms.flatMap((row) => row.evidenceIds))),
    funnelEvidence("Reserva o contacto", booking.length || contacts.length ? "observado" : "no observable", booking.length ? `Ruta de agenda o cita visible: ${booking.slice(0, 5).map((row) => row.text).join(" · ")}.` : contacts.length ? `Canales visibles: ${contacts.join(", ")}.` : "No se observó reserva o contacto inequívoco.", unique([...booking, ...ctas].flatMap((row) => row.evidenceIds))),
    funnelEvidence("Conversación comercial", company?.funnel ? "inferido" : "no observable", company?.funnel ? "La secuencia pública previa sugiere conversación comercial; no se contactó con la empresa." : "No se contactó con la empresa y esta fase privada no es observable.", defaultEvidenceIds),
    funnelEvidence("Propuesta / cierre", priceKnown ? "inferido" : "no observable", priceKnown ? "La economía pública permite anticipar una propuesta o compra, pero no se ejecutó ninguna." : "No se solicitó propuesta, negoció ni compró.", unique(priceSignals.flatMap((row) => row.evidenceIds))),
    funnelEvidence("Onboarding / entrega", company?.funnel || manual.funnelFindings?.length ? "inferido" : "no observable", company?.funnel || (manual.funnelFindings?.length ? "La revisión manual documenta señales públicas de entrega; la ejecución privada no se validó como cliente." : "No se contrató; onboarding y entrega no observables."), unique([...defaultEvidenceIds, ...(manual.funnelFindings || []).flatMap((row) => row.evidenceIds)])),
    funnelEvidence("Seguimiento / retención", /report|seguimiento|follow[- ]?up|nurtur|newsletter|retenci|retention|optimiza|review/i.test(`${company?.funnel || ""} ${commercialCopyPages.map((page) => page.visibleText).join(" ")}`) ? "inferido" : "no observable", "No se activaron secuencias; solo se documentan señales públicas o inferencias explícitas.", commercialPageIds),
  ];
  funnel = mergeManualFunnel(funnel, manual.funnelFindings);
  const observedStages = funnel.filter((row) => row.status === "observado").length;
  const coveragePercent = Math.round((observedStages / funnel.length) * 100);
  const formFieldCount = forms.reduce((sum, form) => sum + form.visibleFieldCount, 0);
  const voiceAnalysis = analyzeVoice(commercialRendered, evidenceByUrl);
  const automaticMessageArchitecture = {
    status: headline ? "observado" : "no observable",
    explanation: headline ? "Copy comercial recuperado en páginas públicas renderizadas." : "No se recuperó copy comercial suficiente para reconstruir la arquitectura del mensaje.",
    headline,
    subheads: headings.filter((value) => value !== headline).slice(0, 24),
    promise: company?.offer || v2?.offer?.existingSummary || null,
    mechanism: mechanismSignals,
    audience: company?.niche || null,
    differentiators: unique([...mechanismSignals, ...outcomeSignals].map((row) => row.text), 12),
    painLanguage: painSignals,
    outcomeLanguage: outcomeSignals,
    tone: voiceAnalysis.dominantTraits.map((row) => row.trait),
    languagePatterns: voiceAnalysis.recurringMoves,
    voiceAnalysis,
    contradictions: unique((manual.offerEconomics?.contradictionsOrAmbiguities || []).map((row) => row.detail), 12),
    evidenceIds: unique([...commercialPageIds.slice(0, 6), ...voiceAnalysis.evidenceIds, ...(mechanismSignals.flatMap((row) => row.evidenceIds))]),
  };
  const messageArchitecture = manual.messageArchitecture ? {
    ...automaticMessageArchitecture,
    ...manual.messageArchitecture,
    headline: manual.messageArchitecture.headline || automaticMessageArchitecture.headline,
    promise: manual.messageArchitecture.promise || automaticMessageArchitecture.promise,
    audience: manual.messageArchitecture.audience || automaticMessageArchitecture.audience,
    mechanism: automaticMessageArchitecture.mechanism,
    painLanguage: automaticMessageArchitecture.painLanguage,
    outcomeLanguage: automaticMessageArchitecture.outcomeLanguage,
    voiceAnalysis,
    contradictions: unique([...(automaticMessageArchitecture.contradictions || []), ...(manual.messageArchitecture.contradictions || [])], 20),
    evidenceIds: unique([...(automaticMessageArchitecture.evidenceIds || []), ...(manual.messageArchitecture.evidenceIds || [])]),
  } : automaticMessageArchitecture;
  const acquisition = {
    status: discoveryStatus,
    explanation: discoveryStatus === "inferido"
      ? "Se observan activos o señales de canal, no su contribución real a tráfico, pipeline o ventas."
      : "No se pudo atribuir públicamente un canal de descubrimiento; la web solo demuestra destino, no adquisición.",
    entryPages: commercialPages.map((page) => ({ url: safeUrl(page.url), title: page.title, relation: page.sourceRelation || "official_site", evidenceIds: evidenceIdForUrl(evidenceByUrl, page.url) ? [evidenceIdForUrl(evidenceByUrl, page.url)] : [] })),
    utilityPagesExcludedFromCopyAnalysis: pages.filter(isUtilityPage).map((page) => ({ url: safeUrl(page.url), title: page.title, evidenceIds: evidenceIdForUrl(evidenceByUrl, page.url) ? [evidenceIdForUrl(evidenceByUrl, page.url)] : [] })),
    channels: (company?.channels || []).map((channel) => ({
      channel,
      status: /Web|landing/i.test(channel) && commercialCopyPages.length ? "observado" : "inferido",
      interpretation: /Web|landing/i.test(channel)
        ? "Destino comercial observable; no prueba su fuente de tráfico."
        : "Señal atribuida en la investigación previa; volumen y rendimiento no observables.",
      evidenceIds: /Web|landing/i.test(channel) ? commercialPageIds.slice(0, 3) : discoveryEvidenceIds.length ? discoveryEvidenceIds : defaultEvidenceIds,
    })),
    advertising: {
      google: { status: company?.googleStatus || "No revisado", count: company?.googleAds ?? null, evidenceIds: evidence.filter((row) => /adstransparency\.google/i.test(row.url)).map((row) => row.id) },
      meta: { status: company?.metaStatus || "No revisado", count: company?.metaAds ?? null, evidenceIds: evidence.filter((row) => /facebook\.com\/ads\/library/i.test(row.url)).map((row) => row.id) },
      interpretation: "Un cero sin anunciante oficial inequívoco significa no atribuible, no ausencia demostrada de publicidad.",
    },
    leadMagnets: v2?.conversion?.leadMagnets || [],
    contentSignals,
    manualFindings: [
      ...(manual.acquisition?.findings || []),
      ...manualStatementRows(manual.manualAcquisition),
    ],
    evidenceIds: unique([...commercialPageIds, ...discoveryEvidenceIds]),
  };
  const ctaLadder = {
    status: ctas.length ? "observado" : "no observable",
    explanation: ctas.length ? `${ctas.length} variante(s) de llamada a la acción documentada(s).` : "No se observó una llamada a la acción comercial inequívoca.",
    primary: primaryCta,
    lowCommitment: ctas.filter((row) => row.commitment === "bajo"),
    mediumCommitment: ctas.filter((row) => row.commitment === "medio"),
    highCommitment: ctas.filter((row) => row.commitment === "alto"),
    consistency: unique(ctas.map((row) => row.text)).length <= 4 ? "concentrada" : "dispersa",
    unknownAfterClick: "No se pulsaron CTA que implicaran datos, cuenta, reserva o contacto.",
    manualLadder: manual.manualCtaLadder || null,
    evidenceIds: unique(ctas.flatMap((row) => row.evidenceIds)),
  };
  const captureAndQualification = {
    status: forms.length || contacts.length ? "observado" : "no observable",
    explanation: forms.length || contacts.length ? "Se inventariaron controles o vías de contacto visibles sin enviar datos." : "No se observó un mecanismo público de captura o contacto utilizable.",
    forms,
    totalDistinctForms: forms.length,
    visibleFieldsInventoried: formFieldCount,
    qualificationDimensions,
    contactChannels: contacts,
    bookingRoutes: booking,
    shortestFormFields: forms.length ? Math.min(...forms.map((form) => form.visibleFieldCount)) : null,
    longestFormFields: forms.length ? Math.max(...forms.map((form) => form.visibleFieldCount)) : null,
    consentObserved: forms.some((form) => form.consentText.length),
    postSubmit: { status: "no observable", detail: "No se enviaron formularios, reservaron citas ni activaron automatizaciones." },
    manualCapture: manual.manualCapture || null,
    evidenceIds: unique([
      ...[...forms, ...booking].flatMap((row) => row.evidenceIds || []),
      ...(contacts.length ? defaultEvidenceIds : []),
    ]),
  };
  const variableZeroPrice = Number(company?.price?.amount) === 0 && /(?:0\s*€?.{0,80}(?:porcentaje|%|revenue share)|CPL\s+(?:pactado|oculto)|precio.{0,25}(?:acordado|oculto))/i.test(`${company?.priceLocal || ""} ${company?.ticket || ""}`);
  const normalizedPrice = variableZeroPrice
    ? { currency: null, amount: null, eur: null, label: "Modelo variable: el cero corresponde a una modalidad con participación o a ausencia de fijo; no es tarifa total cero." }
    : company?.price || null;
  const manualPriceConversions = collectManualPriceConversions(manual.offerEconomics, fx, manual.evidenceIds || []);
  const offerEconomics = {
    status: priceKnown || company?.offer ? "observado" : "no observable",
    offer: company?.offer || null,
    productsOrPlans: unique([...priceSignals.map((row) => row.text), ...(v2?.offer?.prices || [])], 24),
    publicPriceLocal: company?.priceLocal || null,
    normalizedPrice,
    eurConversion: normalizedPrice?.eur !== null && normalizedPrice?.eur !== undefined ? {
      amount: normalizedPrice.eur,
      currency: "EUR",
      label: normalizedPrice.label,
      localAmount: normalizedPrice.amount,
      localCurrency: normalizedPrice.currency,
      rateUnitsPerEur: normalizedPrice.currency === "EUR" ? 1 : Number(fx?.rates?.[normalizedPrice.currency]) || null,
      base: fx?.base,
      rateDate: fx?.timeLastUpdateUtc,
      source: fx?.source,
      sourceUrl: fx?.sourceUrl,
      disclaimer: fx?.disclaimer,
    } : null,
    billingModel: /per lead|por lead|por cita|per appointment|pay per|éxito|success fee/i.test(`${company?.priceLocal} ${company?.offer}`) ? "por resultado o unidad" : /month|mensual|retainer|suscrip/i.test(`${company?.priceLocal} ${company?.offer}`) ? "recurrente" : /hour|hora/i.test(`${company?.priceLocal} ${company?.offer}`) ? "por hora" : "no determinado",
    ticketAndMedia: company?.ticket || null,
    contract: company?.contract || null,
    contractObserved: contractKnown,
    guarantee: company?.guarantee || null,
    guaranteeObserved: guaranteeKnown,
    priceSignals,
    guaranteeSignals,
    manualTerms: manual.offerEconomics || null,
    manualPriceConversions,
    unknowns: unique([
      !priceKnown ? "Importe o tarifa principal no observable." : null,
      !contractKnown ? "Permanencia, renovación, cancelación o propiedad de activos no publicadas por completo." : null,
      !guaranteeKnown ? "Garantía, reposición y definición de resultado no observables." : null,
      "No se solicitó propuesta ni contrato privado.",
    ]),
    evidenceIds: unique([...defaultEvidenceIds, ...(manual.evidenceIds || []), ...priceSignals.flatMap((row) => row.evidenceIds), ...guaranteeSignals.flatMap((row) => row.evidenceIds)]),
  };
  const proofAndTrust = {
    status: proofSignals.length || company?.proof || manual.proof?.length ? "observado" : "no observable",
    explanation: proofSignals.length || company?.proof || manual.proof?.length ? "Se localizaron señales públicas de prueba; se mantienen como claims propios salvo validación independiente." : "No se localizó prueba comercial pública suficientemente legible.",
    documentedAssessment: company?.proof ? [{ text: company.proof, status: "síntesis previa sustentada en fuentes públicas", evidenceIds: defaultEvidenceIds }] : [],
    publicSignals: proofSignals,
    manualProof: manual.proof || [],
    team: company?.team || null,
    legal: company?.legal || null,
    independentValidation: { status: "no observable", detail: "No se presupone auditoría independiente por mostrar logos, testimonios o cifras propias." },
    evidenceStrength: proofSignals.length >= 6 && /periodo|period|from|to|antes|después|before|after/i.test(proofSignals.map((row) => row.text).join(" ")) ? "media" : proofSignals.length || company?.proof ? "baja a media" : "baja",
    evidenceIds: unique([...proofSignals.flatMap((row) => row.evidenceIds), ...defaultEvidenceIds, ...(manual.proof?.length ? manual.evidenceIds || [] : [])]),
  };
  const objectionsAndSales = {
    status: objectionSignals.length || v2?.offer?.objections?.length || manual.objections?.length ? "observado" : "no observable",
    visibleQuestionsAndAnswers: uniqueObjects([
      ...(manual.objections || []).map((row) => ({
        ...row,
        text: clean(row.text || row.objection || row.question || row.detail),
        status: normalizeStatus(row.status || row.answerStatus, "observado"),
        evidenceIds: unique([...(row.evidenceIds || []), ...(manual.evidenceIds || [])]),
      })),
      ...(v2?.offer?.objections || []).map((text) => ({ text, status: "observado", evidenceIds: defaultEvidenceIds })),
      ...objectionSignals,
    ], (row) => row.text, 36),
    urgencyOrScarcity: v2?.offer?.urgency || [],
    riskReversal: guaranteeSignals,
    unanswered: unique([
      !priceKnown ? "¿Cuánto cuesta exactamente y qué queda fuera?" : null,
      !contractKnown ? "¿Qué permanencia, renovación y preaviso se aplican?" : null,
      !guaranteeKnown ? "¿Qué ocurre con leads inválidos, no-shows o resultados insuficientes?" : null,
      "¿Cómo se define y disputa una unidad facturable?",
      "¿Quién conserva datos, cuentas, creatividades y automatizaciones al terminar?",
    ]),
    evidenceIds: unique([
      ...[...objectionSignals, ...guaranteeSignals].flatMap((row) => row.evidenceIds),
      ...(v2?.offer?.objections?.length ? defaultEvidenceIds : []),
      ...(manual.objections?.length ? manual.evidenceIds || [] : []),
    ]),
  };
  const technologyAndNurture = {
    status: technology.length || manual.technology ? "observado" : "no observable",
    explanation: technology.length || manual.technology ? "Tecnologías o capacidades observadas/declaradas en superficies públicas; no revelan la arquitectura privada completa." : "No se detectó una firma tecnológica pública concluyente.",
    detected: technology,
    networkHostsObserved: unique(pages.flatMap((page) => page.networkHosts || []), 120),
    trackingInterpretation: "Firmas observadas en red, scripts e iframes; la ausencia de firma no demuestra ausencia de herramienta.",
    nurtureSignals: pageEvidence(rendered, evidenceByUrl, /(?:newsletter|suscr[ií]b|subscribe|email updates|descarga|download|webinar|remarketing|retarget)/i, 16),
    manualStack: manual.technology || null,
    postCaptureAutomation: { status: "no observable", detail: "No se enviaron datos; email, SMS, WhatsApp, scoring y secuencias posteriores no se activaron." },
    evidenceIds: unique([...technology.flatMap((row) => row.evidenceIds), ...pageIds, ...(manual.technology ? manual.evidenceIds || [] : [])]),
  };
  const deliveryOperations = {
    status: company?.funnel || manual.funnelFindings?.length ? "inferido" : "no observable",
    publicProcess: company?.funnel || null,
    manualFunnel: manual.funnelFindings || [],
    manualOperations: manual.manualDeliveryOperations || null,
    serviceLevelSignals: pageEvidence(commercialRendered, evidenceByUrl, /(?:SLA|\d+\s*(?:hours?|horas?|days?|d[ií]as?|weeks?|semanas?)|response time|tiempo de respuesta|reemplaz|replacement|no-show|report|dashboard|weekly|mensual)/i, 18),
    outcomeDefinitionSignals: pageEvidence(commercialRendered, evidenceByUrl, /(?:qualified lead|lead cualificado|valid lead|cita válida|appointment held|show rate|no-show|exclusive|exclusiv|accepted lead|rejected lead)/i, 18),
    unknowns: ["Capacidad real, tiempos internos, calidad operativa y retención no se validaron como cliente.", "No se observó la propuesta, onboarding privado, reporting autenticado ni conciliación de resultados."],
    evidenceIds: unique([...commercialPageIds, ...(manual.funnelFindings || []).flatMap((row) => row.evidenceIds)]),
  };
  const strengths = strengthRows(company || {}, forms, proofSignals, priceSignals, technology, primaryCta);
  const competitiveAssessment = {
    status: "inferido",
    derivation: "Lectura estratégica derivada de la evidencia pública; no es una afirmación del competidor.",
    strengths,
    weaknesses: unique([
      !priceKnown ? "Precio principal oculto o no verificable públicamente." : null,
      !contractKnown ? "Condiciones contractuales incompletas en abierto." : null,
      !guaranteeKnown ? "Riesgo, reposición o garantía no definidos públicamente." : null,
      !forms.length && !contacts.length ? "Ruta de captura no observable en la revisión pública." : null,
      proofAndTrust.evidenceStrength === "baja" ? "Prueba comercial débil o sin denominadores auditables." : null,
      "La validación independiente de resultados no es observable en la revisión pública.",
      funnel.find((row) => row.stage === "Seguimiento / retención")?.status !== "observado" ? "El seguimiento real posterior a la captura no es observable sin activar el funnel." : null,
    ]),
    attackAngles: unique([
      !priceKnown ? "Competir con unidad facturable, rango y costes excluidos publicados." : null,
      !contractKnown ? "Ofrecer piloto corto, salida clara y propiedad de activos explícita." : null,
      !guaranteeKnown ? "Definir aceptación, reposición, no-show y disputa con SLA medible." : null,
      proofAndTrust.evidenceStrength !== "media" ? "Publicar casos con cliente, periodo, volumen, coste, tasa y resultado final." : null,
      forms.length && Math.min(...forms.map((form) => form.visibleFieldCount)) > 7 ? "Reducir fricción inicial y cualificar progresivamente." : null,
    ]),
    copy: unique([primaryCta ? `Una acción principal clara como “${primaryCta.text}”.` : null, proofSignals.length ? "Prueba visible cerca de la conversión, reforzada con metodología verificable." : null]),
    adapt: unique([company?.offer ? "La claridad de la promesa y el mecanismo, ajustados a una unidad de resultado RedVitalia." : null, forms.length ? "Campos de cualificación útiles sin pedir datos innecesarios al inicio." : null]),
    avoid: unique([!contractKnown ? "Promesas comerciales sin condiciones de salida y propiedad de datos." : null, !guaranteeKnown ? "Usar ‘garantía’ sin KPI, plazo, exclusiones y remedio." : null]),
    tests: unique(["CTA de diagnóstico frente a precio/rango visible.", "Formulario corto frente a cualificación progresiva.", "Pago por lead aceptado frente a cita asistida con reposición."], 6),
    manualLessons: manual.competitiveAssessment || null,
    evidenceIds: unique([...commercialPageIds.slice(0, 8), ...proofSignals.flatMap((row) => row.evidenceIds), ...forms.flatMap((row) => row.evidenceIds), ...(manual.competitiveAssessment ? manual.evidenceIds || [] : [])]),
  };
  const priorLimitations = [...(manual.limitations || []), ...(v2?.limitations || [])].filter((limitation) => {
    const text = clean(limitation);
    if (/no se (?:enviaron|contact[oó]|contrat[oó])|no se contact[oó]|no se reservaron|no se crearon cuentas/i.test(text)) return false;
    if (commercialCopyPages.length && /no se recuper[oó].*(?:p[aá]gina|contenido comercial)|sin landing|titular principal|respuesta supera \d+ bytes/i.test(text)) return false;
    if (ctas.length && /no se localiz[oó].*CTA|CTA inequ[ií]voco/i.test(text)) return false;
    if (forms.length && /no se observ[oó].*formulario|formulario HTML recuperable/i.test(text)) return false;
    if ((booking.length || contacts.length) && /no se observ[oó].*(?:reserva|contacto)|no se localiz[oó].*(?:reserva|contacto)|v[ií]a p[uú]blica inequ[ií]voca/i.test(text)) return false;
    if (objectionSignals.length && /no se localiz[oó].*(?:objeciones|preguntas frecuentes)/i.test(text)) return false;
    if ((contentSignals.length || v2?.conversion?.leadMagnets?.length) && /no se localiz[oó].*(?:recurso descargable|incentivo de captaci[oó]n|lead magnet)/i.test(text)) return false;
    if (pages.some(isUtilityPage) && /no se localiz[oó].*evidencia legal|evidencia legal.*no/i.test(text)) return false;
    if (technology.length && /no se detect[oó].*tecnolog|firma t[eé]cnica/i.test(text)) return false;
    return true;
  });
  const renderedLimitations = (rendered?.limitations || []).filter((limitation) => {
    const text = clean(limitation);
    if (commercialCopyPages.length && /sin landing|no se recuper[oó].*(?:p[aá]gina|contenido comercial)|respuesta supera \d+ bytes/i.test(text)) return false;
    if (/no se (?:enviaron|contact[oó]|contrat[oó])|no se contact[oó]|no se reservaron|no se crearon cuentas/i.test(text)) return false;
    return true;
  });
  const limitations = unique([
    ...priorLimitations, ...renderedLimitations,
    "No se enviaron formularios, no se reservaron citas, no se crearon cuentas, no se contrató y no se contactó con la empresa.",
    "Las fases privadas se marcan como inferidas o no observables; no se presentan como hechos.",
  ], 24);
  if (excluded) {
    const reason = `Clasificación documental verificada como “${item.scope}”: la fuente se conserva para trazabilidad, pero no se presenta como competidor comercial activo.`;
    return {
      schemaVersion: "rv-funnel-forensics-v3", recordId: item.id, portalId: company?.id || null, name: item.name, reviewedAt: "2026-08-22", primaryLanguage: null,
      status: "No aplica verificado", coveragePercent: 0,
      classification: { status: "inferido", scope: item.scope, relation: item.relation, decision: item.decision, reason, evidenceIds: defaultEvidenceIds },
      messageArchitecture: noApplicable(null, reason), acquisition: noApplicable(null, reason), ctaLadder: noApplicable(null, reason), captureAndQualification: noApplicable(null, reason),
      funnel: funnel.map((row) => ({ ...row, status: "no aplica", detail: reason, limitation: reason })), offerEconomics: noApplicable(null, reason), proofAndTrust: noApplicable(null, reason),
      objectionsAndSales: noApplicable(null, reason), technologyAndNurture: noApplicable(null, reason), deliveryOperations: noApplicable(null, reason), competitiveAssessment: noApplicable(null, reason),
      evidence, limitations: [reason, ...limitations], qa: { classificationConfirmed: true, allDimensionsPresent: true, materialClaimsTraceable: true, formsSubmitted: false, companyContacted: false, publishReady: true },
    };
  }
  const review = {
    schemaVersion: "rv-funnel-forensics-v3", recordId: item.id, portalId: company?.id || null, name: item.name,
    reviewedAt: "2026-08-22", primaryLanguage: rootPage?.language || null,
    status: manualValues.length ? "Ampliada con evidencia manual y renderizada" : pages.length ? "Ampliada con evidencia renderizada" : "Limitada",
    coveragePercent,
    classification: { status: commercialCopyPages.length || manual.manualClassification ? "observado" : "inferido", scope: item.scope, relation: item.relation, decision: item.decision, model: company?.agencyType || null, audience: company?.niche || null, manualDimension: manual.manualClassification || null, evidenceIds: unique([...(commercialPageIds.length ? commercialPageIds.slice(0, 4) : defaultEvidenceIds), ...(manual.manualClassification ? manual.evidenceIds || [] : [])]) },
    messageArchitecture, acquisition, ctaLadder, captureAndQualification, funnel, offerEconomics, proofAndTrust, objectionsAndSales, technologyAndNurture, deliveryOperations, competitiveAssessment,
    evidence, limitations,
    qa: {
      allDimensionsPresent: true, materialClaimsTraceable: evidence.length > 0, observedInferredUnknownSeparated: true,
      allVisibleFormFieldsInventoried: true, formsSubmitted: false, accountsCreated: false, companyContacted: false,
      privateLinksIncluded: false, funnelStages: funnel.length, renderedPages: pages.length, evidenceSources: evidence.length,
      publishReady: pages.length > 0 || manualValues.length > 0,
    },
  };
  const digest = createHash("sha256").update(JSON.stringify(review)).digest("hex").slice(0, 16);
  review.marker = `RV-FUNNEL-V3:${item.id}:${digest}`;
  return review;
}

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
const companies = JSON.parse(await readFile(PUBLIC_COMPANIES, "utf8"));
const companyById = new Map(companies.map((company) => [company.id, company]));
const idMap = JSON.parse(await readFile(ID_MAP_FILE, "utf8")).ids || {};
const fx = JSON.parse(await readFile(FX_FILE, "utf8"));
let writeLock = Promise.resolve();
const synthesisById = new Map(queue.items.map((item) => [item.id, { synthesis: item.synthesis, qa: item.qa }]));
function persistQueue(changedItem = null) {
  if (changedItem) synthesisById.set(changedItem.id, { synthesis: changedItem.synthesis, qa: changedItem.qa });
  writeLock = writeLock.then(async () => {
    const latest = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
    queue.items = latest.items.map((item) => {
      const stages = synthesisById.get(item.id);
      return stages ? { ...item, synthesis: stages.synthesis, qa: stages.qa } : item;
    });
    refreshQueue(queue);
    await writeJsonAtomic(QUEUE_FILE, queue);
  });
  return writeLock;
}

const selected = queue.items
  .filter((item) => !args.only.length || args.only.includes(item.id) || args.only.includes(item.name))
  .filter((item) => args.force || item.synthesis?.status !== "complete")
  .filter((item) => item.scope === "Excluir — fuente/no negocio" || ["render_complete", "limited"].includes(item.research?.status) || item.manualSources?.length)
  .slice(0, Number.isFinite(args.limit) ? args.limit : undefined);

let completed = 0;
for (const item of selected) {
  item.synthesis = { status: "in_progress", attempts: (item.synthesis?.attempts || 0) + 1, updatedAt: new Date().toISOString(), error: null };
  await persistQueue(item);
  try {
    const [sourceRecord, v2, rendered, ...manualValues] = await Promise.all([
      readOptional(item.sourceRecord), readOptional(item.sourceReview), readOptional(`${RENDERED_DIR}/${item.id}.json`),
      ...(item.manualSources || []).map(readOptional),
    ]);
    const company = companyById.get(idMap[item.id]);
    const review = finalizePublicReview(buildReview(item, company, sourceRecord, v2, rendered, manualValues.filter(Boolean), fx || {}));
    delete review.marker;
    const digest = createHash("sha256").update(JSON.stringify(review)).digest("hex").slice(0, 16);
    review.marker = `RV-FUNNEL-V3:${item.id}:${digest}`;
    await writeJsonAtomic(`${OUTPUT_DIR}/${item.id}.json`, review);
    item.synthesis = { status: "complete", attempts: item.synthesis.attempts, updatedAt: new Date().toISOString(), error: null };
    item.qa = { status: "pending", attempts: item.qa?.attempts || 0, updatedAt: null, error: null };
    completed += 1;
    await persistQueue(item);
    console.log(`[${completed}/${selected.length}] ${item.name}: ${review.status}`);
  } catch (error) {
    item.synthesis = { status: "failed", attempts: item.synthesis.attempts, updatedAt: new Date().toISOString(), error: clean(error?.stack || error) };
    await persistQueue(item);
    console.error(`${item.name}: ${item.synthesis.error}`);
  }
}
await persistQueue();
console.log(JSON.stringify({ selected: selected.length, completed, stats: queue.stats.synthesis }, null, 2));
