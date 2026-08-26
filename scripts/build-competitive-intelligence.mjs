import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "public", "data");
const capturesDir = path.join(dataDir, "site-captures");
const outputPath = path.join(dataDir, "competitive-intelligence.json");

const INPUTS = {
  corpus: path.join(dataDir, "ad-corpus.json"),
  companies: path.join(dataDir, "companies-index.json"),
  landingIntelligence: path.join(dataDir, "landing-intelligence.json"),
  scrapeLandingAnalysis: path.join(dataDir, "scrapecreators-landing-analysis.json"),
  scrapeAds: path.join(root, "db", "scrapecreators-spain-leadgen.json"),
};

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const clean = (value) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim()
    : "";
const normalize = (value) =>
  clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/https?:\/\/\S+|www\.\S+/g, " ")
    .replace(/[^a-z0-9ñ€%+]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
const unique = (values) => [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 1) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const pct = (part, total) => (total ? round((part / total) * 100, 1) : 0);
const median = (values) => {
  const ordered = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const excerpt = (value, limit = 220) => {
  const text = clean(value);
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`;
};
const bySpanishLabel = (left, right) => clean(left.label || left.name).localeCompare(clean(right.label || right.name), "es");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const CATEGORY_LABELS = {
  audience: "Audiencia",
  pain: "Dolor",
  promise: "Promesa",
  mechanism: "Mecanismo",
  guarantee: "Garantía y reducción de riesgo",
  cta: "Llamada a la acción",
  format: "Formato creativo",
};

const SIGNAL_RULES = {
  audience: [
    ["clinics-health", "Clínicas y salud", /clinica|paciente|dental|dentista|medic[oa]|fisioter|psicolog|sanitari|salud/],
    ["reforms-home", "Reformas, obra y hogar", /reforma|obra|construccion|fontaner|tejado|cocina|ventana|contratista/],
    ["real-estate", "Inmobiliario", /inmobili|real estate|agente inmobiliario|propietari|vender (?:tu |una )?(?:casa|piso|vivienda)/],
    ["legal-finance", "Legal, finanzas y seguros", /abogad|despacho|juridic|concursal|asesor(?:ia)?|financier|seguro|broker|hipoteca/],
    ["solar-energy", "Solar y energía", /solar|fotovolta|energia|renovable|aeroterm|placas/],
    ["automotive", "Automoción", /concesionario|taller|automocion|vehiculo|coches?|motor/],
    ["b2b-sales", "Ventas B2B", /\bb2b\b|sdr|equipo comercial|director comercial|pipeline|prospeccion|appointment setting/],
    ["local-business", "Negocio local", /negocio local|pymes?|comercio local|tu ciudad|tu zona/],
    ["agencies", "Agencias y consultores", /agencia|consultor|freelance|infoproduct|marketing/],
    ["hospitality", "Hostelería y turismo", /hotel|hosteler|restaurante|turismo|alquiler vacacional/],
    ["fitness", "Gimnasios y fitness", /gimnasio|fitness|entrenador|centro deportivo/],
  ],
  pain: [
    ["inconsistent-demand", "Demanda inestable", /meses? (?:buenos?|malos?)|demanda (?:no es )?constante|sin (?:flujo|clientes|leads|pacientes)|agenda vacia|pocos? clientes|estancad/],
    ["low-quality", "Baja calidad del contacto", /leads? (?:basura|frio|sin cualificar|de baja calidad)|contactos? (?:malos|no validos)|no contestan|no responden/],
    ["dependency", "Dependencia de portales o referidos", /depend(?:er|es|encia)|portales?|intermediari|boca a boca|referid|terceros/],
    ["slow-follow-up", "Seguimiento lento o perdido", /seguimiento|no (?:llamas|contactas)|tardas|oportunidades? perdid|sin responder|respuesta lenta/],
    ["wasted-spend", "Inversión publicitaria desperdiciada", /dinero (?:tirado|perdido)|gasto publicitario|campanas? (?:no funciona|sin resultado)|quemar presupuesto|rentabilidad/],
    ["empty-calendar", "Agenda sin suficientes citas", /agenda vacia|huecos? en (?:tu |la )?agenda|sin citas|pocas? citas|llenar (?:tu |la )?agenda/],
    ["slow-sales", "Proceso comercial lento", /ciclo de venta|ventas? lent|no cierr|conversion baja|no conviert|cuesta vender/],
    ["no-system", "Falta de sistema", /sin (?:un )?sistema|no tienes (?:un )?sistema|improvis|sin proceso|sin estructura|caos/],
    ["low-visibility", "Falta de visibilidad", /sin visibilidad|no te encuentran|posicionamiento|invisible|poca presencia/],
  ],
  promise: [
    ["leads", "Más leads o contactos", /mas (?:leads|contactos|clientes potenciales)|genera(?:r|mos)? (?:leads|contactos)|captar (?:leads|contactos)|solicitudes? cualificad/],
    ["qualified-meetings", "Citas o reuniones cualificadas", /citas? cualificad|reuniones? cualificad|agenda(?:r|mos)? (?:citas|reuniones)|reuniones? (?:en|a) tu calendario|appointment/],
    ["sales-growth", "Ventas, facturación o crecimiento", /mas ventas|aumenta(?:r)? (?:tus )?ventas|factur|ingresos|crece|crecimiento|escala|multiplica|rentable/],
    ["predictability", "Captación predecible y recurrente", /predecible|recurrente|constante|cada mes|todos los dias|flujo continuo|sin depender de la suerte/],
    ["speed", "Resultado en un plazo", /en \d+ (?:minutos?|horas?|dias?|semanas?|meses?)|desde el primer mes|en tiempo real|inmediat/],
    ["savings", "Ahorro o precio ventajoso", /ahorra|hasta \d+ ?%|descuento|menos coste|reduce (?:el )?coste|desde \d+[\d.,]* ?€/],
    ["territorial-exclusivity", "Exclusividad territorial", /exclusiv.{0,20}(?:zona|ciudad|territori)|bloquea a tu competencia|una empresa por zona/],
  ],
  mechanism: [
    ["system-crm-funnel", "Sistema, funnel o CRM", /sistema|funnel|embudo|\bcrm\b|motor de adquisicion|infraestructura/],
    ["paid-ads", "Publicidad de pago", /meta ads|facebook ads|instagram ads|google ads|publicidad (?:digital|online|de pago)|campanas? publicitari/],
    ["automation-ai", "Automatización o IA", /automatiz|inteligencia artificial|\bia\b|chatbot|agente (?:de )?ia|24 ?\/ ?7/],
    ["outbound", "Prospección outbound", /outbound|cold (?:email|calling)|prospeccion|linkedin|telemarketing|llamada fria/],
    ["qualification", "Filtrado o cualificación", /cualific|calific|filtr|validamos|lead valido|perfil ideal|\bsqls?\b/],
    ["appointment-setting", "Agenda y appointment setting", /appointment setting|agendamos|agenda automatica|reserva(?:mos)? (?:la )?cita|calendar/],
    ["marketplace", "Marketplace o comparación", /marketplace|comparador|hasta \d+ presupuestos|profesionales? (?:de tu|cerca)|solicita presupuestos/],
    ["seo-content", "SEO o contenido", /\bseo\b|posicionamiento organico|contenido|inbound/],
    ["whatsapp", "WhatsApp conversacional", /whatsapp|wa\.me/],
  ],
  guarantee: [
    ["explicit-guarantee", "Garantía explícita", /garanti[az]|devolv|reembols|si no (?:lo )?conseguimos|si no funciona|no cobramos|no pagas/],
    ["pay-for-results", "Pago por resultado", /pago por (?:resultado|lead|cita)|solo pagas|a exito|sin cuota fija|pay per/],
    ["no-lock-in", "Sin permanencia", /sin permanencia|sin compromiso|cancela cuando|sin contrato/],
    ["free-entry", "Entrada gratuita", /gratis|gratuit|sin coste|coste cero|prueba gratuita|auditoria gratuita|consulta gratuita/],
    ["replacement", "Reposición o lead válido", /repon|sustitu|reemplaz|lead valido|telefono inexistente|no valido/],
  ],
  cta: [
    ["learn-more", "Saber más", /learn more|mas informacion|saber mas|descubre|ver como/],
    ["book-call", "Reservar llamada o reunión", /agenda|reserv|llamada|reunion|book|schedule/],
    ["audit-demo", "Auditoría, demo o diagnóstico", /auditoria|diagnostico|analisis|demo|consulta|valoracion|evaluacion/],
    ["contact-whatsapp", "Contacto o WhatsApp", /contact|habla|escribe|whatsapp|mensaje/],
    ["quote", "Presupuesto o propuesta", /presupuesto|cotiza|propuesta|quote|devis/],
    ["start-signup", "Empezar o registrarse", /empieza|comienza|registr|solicita|sign up|get started|probar/],
    ["download", "Descargar recurso", /descarga|guia|ebook|informe|plantilla/],
  ],
};

const VERTICALS = [
  ["clinics-health", "Clínicas y salud", [["clinica", 5], ["paciente", 5], ["dental", 5], ["dentista", 5], ["medico", 4], ["fisioter", 5], ["psicolog", 5], ["sanitari", 4]]],
  ["reforms-home", "Reformas, obra y hogar", [["reforma", 5], ["obra", 4], ["construccion", 4], ["fontaner", 5], ["tejado", 5], ["contratista", 5], ["cocina", 2]]],
  ["real-estate", "Inmobiliario", [["inmobili", 5], ["real estate", 5], ["realtor", 5], ["propietario", 3], ["captacion de propiedades", 5]]],
  ["legal-finance-insurance", "Legal, finanzas y seguros", [["abogad", 5], ["juridic", 5], ["despacho", 3], ["concursal", 5], ["financier", 4], ["seguro", 5], ["broker", 3]]],
  ["solar-energy", "Solar y energía", [["solar", 5], ["fotovolta", 5], ["energia", 3], ["renovable", 4], ["aeroterm", 5]]],
  ["b2b-sdr", "Ventas B2B y SDR", [[" b2b ", 5], ["sdr", 5], ["appointment setting", 5], ["prospeccion", 4], ["outbound", 5], ["pipeline comercial", 4], ["telemarketing", 4]]],
  ["automotive", "Automoción", [["concesionario", 5], ["taller", 4], ["automocion", 5], ["vehiculo", 3], ["coche", 3]]],
  ["fitness", "Gimnasios y fitness", [["gimnasio", 5], ["fitness", 5], ["centro deportivo", 5], ["entrenador", 4]]],
  ["beauty-wellness", "Belleza y bienestar", [["estetica", 4], ["belleza", 5], ["peluquer", 5], ["salon", 3], ["spa ", 4]]],
  ["hospitality-tourism", "Hostelería y turismo", [["hotel", 5], ["hosteler", 5], ["restaurante", 5], ["turismo", 5], ["alquiler vacacional", 5]]],
  ["ecommerce-retail", "Ecommerce y retail", [["ecommerce", 5], ["tienda online", 5], ["retail", 5], ["shopify", 5], ["comercio electronico", 5]]],
];
const GENERAL_VERTICAL = { id: "generalist", label: "Generalista" };

const FORMAT_RULES = [
  ["carousel", "Carrusel"],
  ["video", "Vídeo"],
  ["dynamic", "Creatividad dinámica"],
  ["image", "Imagen"],
  ["search-text", "Texto / búsqueda"],
  ["unknown", "Formato no determinado"],
];
const formatLabel = (id) => FORMAT_RULES.find(([key]) => key === id)?.[1] || id;

const formatForAd = (ad, rawAd) => {
  const formats = [...(Array.isArray(ad.displayFormats) ? ad.displayFormats : []), ...(Array.isArray(rawAd?.displayFormats) ? rawAd.displayFormats : [])]
    .map(normalize);
  const platform = normalize(`${ad.plataforma || ""} ${ad.platformFamily || ""}`);
  const file = normalize(`${ad.file || ""} ${ad.videoFile || ""}`);
  if (formats.some((value) => /carousel|carrusel/.test(value)) || /carousel|carrusel/.test(platform)) return "carousel";
  if (formats.some((value) => /video|reel/.test(value)) || ad.videoFile || /video|reel|\.mp4/.test(`${platform} ${file}`)) return "video";
  if (formats.some((value) => /dco|dynamic/.test(value))) return "dynamic";
  if (formats.some((value) => /image|photo|static/.test(value)) || /imagen|image|foto|\.png|\.jpg|\.webp/.test(`${platform} ${file}`)) return "image";
  if (/google|search|texto|text/.test(platform)) return "search-text";
  return "unknown";
};

const semanticCopy = (ad) => {
  const original = [ad.titular, ad.texto, ad.cta, ad.precioVisible, ad.descripcion, ...(Array.isArray(ad.extraTexts) ? ad.extraTexts : [])]
    .map(clean)
    .filter(Boolean)
    .join("\n");
  const translated = [ad.traduccionEs?.titular, ad.traduccionEs?.texto, ad.traduccionEs?.cta, ad.traduccionEs?.precioVisible]
    .map(clean)
    .filter(Boolean)
    .join("\n");
  if (ad.idioma === "es" || ad.estadoTraduccion === "no_necesaria") return { text: original, trusted: true, source: "original_es" };
  if (ad.estadoTraduccion === "revisada" && translated) return { text: translated, trusted: true, source: "reviewed_translation_es" };
  if (ad.estadoTraduccion === "automatica" && translated) return { text: translated, trusted: false, source: "automatic_translation_es" };
  return { text: original, trusted: false, source: "foreign_original_unreviewed" };
};

const identityForAd = (ad, index) => {
  if (ad.copyAvailable === false) return ad.corpusKey || ad.externalId || ad.archivoSha256 || ad.file || `visual:${index}`;
  return ad.sourceCopySha256 || ad.corpusKey || ad.externalId || ad.archivoSha256 || ad.file || `row:${index}`;
};

const detectSignals = (category, value) => {
  const text = normalize(value);
  if (!text) return [];
  return (SIGNAL_RULES[category] || [])
    .filter(([, , pattern]) => pattern.test(text))
    .map(([id, label]) => ({ id, label }));
};

const positiveCommercialField = (field, value) => {
  const text = normalize(Array.isArray(value) ? value.join(" ") : value);
  if (!text) return false;
  const absent = /no (?:se )?(?:observo|observado|publica|publicado|muestra|mostrado|localizo|localizado|menciona|mencionado|consta|disponible)/;
  if (field === "price" && (absent.test(text) || /sin (?:precio|tarifa)|precio (?:no|oculto)|tarifa (?:no|oculta)/.test(text))) return false;
  if (field === "guarantee" && (absent.test(text) || /sin garantia|no hay garantia|garantia (?:no|inexistente)|ninguna garantia/.test(text))) return false;
  return true;
};

const classifyVertical = (company, capture, curatedVerticalById) => {
  const curated = curatedVerticalById.get(company.id);
  if (curated) return { ...curated, status: "observed", source: "landing-intelligence curated example" };
  const read = capture?.commercialRead || {};
  const focused = normalize([
    company.niche,
    company.offer,
    company.agencyType,
    read.audience,
    read.offer,
    read.headline,
  ].flatMap((value) => (Array.isArray(value) ? value : [value])).join(" "));
  const scored = VERTICALS.map(([id, label, terms]) => ({
    id,
    label,
    score: terms.reduce((sum, [term, weight]) => sum + (focused.includes(normalize(term)) ? weight : 0), 0),
  })).sort((left, right) => right.score - left.score || bySpanishLabel(left, right));
  if (scored[0]?.score > 0) return { id: scored[0].id, label: scored[0].label, status: "inferred", score: scored[0].score, source: "rules over company and captured landing text" };
  return { ...GENERAL_VERTICAL, status: "inferred", score: 0, source: "no specific vertical signal observed" };
};

const durationDays = (ad, rawAd, snapshotMs) => {
  if (Number.isFinite(rawAd?.totalActiveTime) && rawAd.totalActiveTime > 0) return rawAd.totalActiveTime / 86400;
  const start = Date.parse(ad.startedAt || ad.startDate || rawAd?.startedAt || "");
  if (!Number.isFinite(start)) return null;
  const explicitEnd = Date.parse(ad.endedAt || ad.endDate || rawAd?.endedAt || "");
  const end = Number.isFinite(explicitEnd) ? explicitEnd : ad.isActive === true || rawAd?.isActive === true ? snapshotMs : null;
  return Number.isFinite(end) && end >= start ? (end - start) / 86400000 : null;
};

const evidenceForAd = (ad) => ({
  companyId: ad.companyId,
  companyName: ad.companyName,
  adId: ad.externalId || ad.corpusKey,
  identityKey: ad.identityKey,
  sourceType: "ad_copy",
  sourceUrl: ad.sourceUrl || null,
  active: ad.isActive === true,
  excerpt: excerpt(ad.semanticText),
});

const diverseEvidence = (ads, limit = 3) => {
  const ordered = [...ads].sort((left, right) =>
    Number(right.isActive === true) - Number(left.isActive === true)
    || (right.durationDays || 0) - (left.durationDays || 0)
    || left.companyName.localeCompare(right.companyName, "es")
    || clean(left.externalId).localeCompare(clean(right.externalId), "es"));
  const seen = new Set();
  const result = [];
  for (const ad of ordered) {
    if (seen.has(ad.companyId)) continue;
    seen.add(ad.companyId);
    result.push(evidenceForAd(ad));
    if (result.length === limit) break;
  }
  return result;
};

const weightedDistribution = (rows, valueGetter) => {
  const companyValues = new Map();
  for (const row of rows) {
    const values = unique(valueGetter(row));
    if (!values.length) continue;
    const current = companyValues.get(row.companyId) || new Set();
    values.forEach((value) => current.add(value));
    companyValues.set(row.companyId, current);
  }
  const totals = new Map();
  for (const values of companyValues.values()) {
    const weight = 1 / values.size;
    for (const value of values) totals.set(value, (totals.get(value) || 0) + weight);
  }
  const denominator = companyValues.size;
  return [...totals.entries()]
    .map(([id, weightedCompanies]) => ({ id, label: formatLabel(id), weightedCompanies: round(weightedCompanies, 2), sharePct: pct(weightedCompanies, denominator) }))
    .sort((left, right) => right.sharePct - left.sharePct || bySpanishLabel(left, right));
};

const signalAdvice = (category, label) => {
  const use = {
    audience: `Úsalo cuando el producto y la prueba estén realmente adaptados a ${label.toLocaleLowerCase("es")}.`,
    pain: `Úsalo cuando la investigación del cliente confirme que “${label}” es un problema prioritario y reconocible.`,
    promise: `Úsalo cuando puedas definir y medir “${label}” sin convertir una aspiración en garantía.`,
    mechanism: `Úsalo cuando “${label}” pueda explicarse con pasos concretos y sea relevante para el comprador.`,
    guarantee: `Úsalo únicamente si “${label}” tiene condiciones operativas y jurídicas explícitas.`,
    cta: `Úsalo cuando “${label}” sea el siguiente paso natural para el nivel de intención del tráfico.`,
    format: `Úsalo como formato de prueba cuando el mensaje pueda entenderse y producirse bien en ${label.toLocaleLowerCase("es")}.`,
  }[category];
  const risk = {
    audience: "La especialización superficial reduce credibilidad si casos, lenguaje y proceso siguen siendo genéricos.",
    pain: "Intensificar el dolor sin evidencia puede sonar manipulador o atraer contactos poco adecuados.",
    promise: "Una promesa amplia o no medible puede elevar expectativas y riesgo regulatorio.",
    mechanism: "Nombrar una tecnología o método no demuestra que produzca el resultado prometido.",
    guarantee: "La letra pequeña, la atribución y las obligaciones del cliente deben quedar visibles.",
    cta: "Un salto de compromiso excesivo puede aumentar la fricción del funnel.",
    format: "La frecuencia observada del formato no prueba mejor rendimiento; hay que probarlo con métricas propias.",
  }[category];
  return { whenToUse: use, risk };
};

const [rawCorpus, companies, landingIntelligence, scrapeLandingAnalysis, scrapeAds] = await Promise.all([
  readJson(INPUTS.corpus),
  readJson(INPUTS.companies),
  readJson(INPUTS.landingIntelligence),
  readJson(INPUTS.scrapeLandingAnalysis),
  readJson(INPUTS.scrapeAds),
]);

const captureFiles = (await readdir(capturesDir)).filter((file) => file.endsWith(".json") && file !== "index.json").sort();
const captureRecords = await Promise.all(captureFiles.map((file) => readJson(path.join(capturesDir, file))));
const captureById = new Map(captureRecords.map((record) => [record.id, record]));
const scrapeLandingById = new Map((scrapeLandingAnalysis.items || []).map((record) => [record.id, record]));
const rawAdByExternalId = new Map((scrapeAds.items || []).map((record) => [clean(record.externalId), record]));

const canonicalVerticalForLandingId = {
  "clinicas-salud": { id: "clinics-health", label: "Clínicas y salud" },
  "reformas-hogar": { id: "reforms-home", label: "Reformas, obra y hogar" },
  "solar-energia": { id: "solar-energy", label: "Solar y energía" },
  inmobiliario: { id: "real-estate", label: "Inmobiliario" },
  legal: { id: "legal-finance-insurance", label: "Legal, finanzas y seguros" },
  "coches-motor": { id: "automotive", label: "Automoción" },
  "b2b-sdr": { id: "b2b-sdr", label: "Ventas B2B y SDR" },
  "belleza-bienestar": { id: "beauty-wellness", label: "Belleza y bienestar" },
  "hosteleria-turismo": { id: "hospitality-tourism", label: "Hostelería y turismo" },
  generalista: GENERAL_VERTICAL,
};
const curatedVerticalById = new Map();
for (const [verticalId, vertical] of Object.entries(landingIntelligence.verticals || {})) {
  for (const example of vertical.examples || []) {
    if (!curatedVerticalById.has(example.companyId)) {
      curatedVerticalById.set(example.companyId, canonicalVerticalForLandingId[verticalId] || { id: verticalId, label: vertical.label });
    }
  }
}

const sourceGeneratedDates = [
  rawCorpus.generatedAt,
  landingIntelligence.generatedAt,
  scrapeLandingAnalysis.generatedAt,
  scrapeAds.generatedAt,
  ...captureRecords.map((record) => record.updatedAt),
].filter((value) => Number.isFinite(Date.parse(value)));
const generatedAt = sourceGeneratedDates.sort((left, right) => Date.parse(right) - Date.parse(left))[0] || "1970-01-01T00:00:00.000Z";
const snapshotMs = Date.parse(generatedAt);

const eligibleCompanies = companies
  .filter((company) => (company.primaryCountry || company.country) === "España")
  .filter((company) => /^(Núcleo|Vertical)\b/.test(clean(company.scope)))
  .sort((left, right) => left.name.localeCompare(right.name, "es"));
const eligibleById = new Map(eligibleCompanies.map((company) => [company.id, company]));

const enrichedAds = (rawCorpus.items || [])
  .map((ad, index) => {
    const company = eligibleById.get(ad.id);
    if (!company) return null;
    const semantic = semanticCopy(ad);
    const rawAd = rawAdByExternalId.get(clean(ad.externalId));
    return {
      ...ad,
      companyId: company.id,
      companyName: company.name,
      identityKey: identityForAd(ad, index),
      semanticText: semantic.text,
      semanticTrusted: semantic.trusted,
      semanticSource: semantic.source,
      formatId: formatForAd(ad, rawAd),
      durationDays: durationDays(ad, rawAd, snapshotMs),
      sourceUrl: ad.fuenteUrl || ad.sourceUrl || rawAd?.sourceUrl || null,
      rawIndex: index,
    };
  })
  .filter(Boolean);

const dedupedByKey = new Map();
for (const ad of enrichedAds) {
  const key = `${ad.companyId}:${ad.identityKey}`;
  const current = dedupedByKey.get(key);
  if (!current) {
    dedupedByKey.set(key, { ...ad, duplicateRows: 1 });
    continue;
  }
  const score = (row) => Number(row.aptaPatrones === true) * 8 + Number(row.semanticTrusted) * 4 + Number(row.isActive === true) * 2 + Number(row.origen === "api_scrapecreators");
  const preferred = score(ad) > score(current) ? ad : current;
  dedupedByKey.set(key, {
    ...preferred,
    duplicateRows: current.duplicateRows + 1,
    isActive: current.isActive === true || ad.isActive === true,
    durationDays: Math.max(current.durationDays || 0, ad.durationDays || 0) || null,
    variantCount: Math.max(Number(current.variantCount) || 1, Number(ad.variantCount) || 1),
  });
}
const dedupedAds = [...dedupedByKey.values()];
const trustedAds = dedupedAds.filter((ad) => ad.aptaPatrones === true && ad.semanticTrusted && clean(ad.semanticText));

for (const ad of trustedAds) {
  ad.detectedSignals = Object.fromEntries(Object.keys(SIGNAL_RULES).map((category) => [category, detectSignals(category, ad.semanticText)]));
  ad.detectedSignals.format = [{ id: ad.formatId, label: formatLabel(ad.formatId) }];
}

const adsByCompany = new Map();
const trustedAdsByCompany = new Map();
for (const ad of dedupedAds) adsByCompany.set(ad.companyId, [...(adsByCompany.get(ad.companyId) || []), ad]);
for (const ad of trustedAds) trustedAdsByCompany.set(ad.companyId, [...(trustedAdsByCompany.get(ad.companyId) || []), ad]);

const landingTextFor = (capture, fallback) => {
  const read = capture?.translation?.spanish || capture?.commercialRead || fallback || {};
  return {
    read,
    text: [read.headline, read.promise, read.audience, read.offer, ...(Array.isArray(read.mechanism) ? read.mechanism : [read.mechanism]), read.primaryCta, read.proof, read.price, read.guarantee, ...(Array.isArray(read.funnel) ? read.funnel : [read.funnel])]
      .map(clean)
      .filter(Boolean)
      .join("\n"),
  };
};

const companyDna = [];
const companySignalSets = new Map();
const companyLandingSignalSets = new Map();
for (const company of eligibleCompanies) {
  const ads = adsByCompany.get(company.id) || [];
  const signalAds = trustedAdsByCompany.get(company.id) || [];
  const capture = captureById.get(company.id);
  const fallbackLanding = scrapeLandingById.get(company.id);
  const { read: landingRead, text: landingText } = landingTextFor(capture, fallbackLanding);
  const vertical = classifyVertical(company, capture, curatedVerticalById);
  const capturedPages = (capture?.pages || []).filter((page) => page.status === "captured");
  const landingSignalSets = {};
  const adSignalSets = {};
  const signals = {};

  for (const category of Object.keys(SIGNAL_RULES)) {
    const grouped = new Map();
    for (const ad of signalAds) {
      for (const signal of ad.detectedSignals[category] || []) {
        grouped.set(signal.id, { ...signal, ads: [...(grouped.get(signal.id)?.ads || []), ad] });
      }
    }
    const landingSignals = detectSignals(category, landingText)
      .filter(() => category !== "guarantee" || positiveCommercialField("guarantee", landingRead.guarantee));
    landingSignalSets[category] = new Set(landingSignals.map((signal) => signal.id));
    adSignalSets[category] = new Set(grouped.keys());
    const values = [...grouped.values()]
      .map((signal) => ({
        id: signal.id,
        label: signal.label,
        uniqueCopies: new Set(signal.ads.map((ad) => ad.identityKey)).size,
        sharePct: pct(new Set(signal.ads.map((ad) => ad.identityKey)).size, signalAds.length),
        evidence: diverseEvidence(signal.ads, 3),
      }))
      .sort((left, right) => right.uniqueCopies - left.uniqueCopies || bySpanishLabel(left, right));
    for (const landingSignal of landingSignals) {
      if (values.some((value) => value.id === landingSignal.id)) continue;
      const page = capturedPages[0];
      values.push({
        id: landingSignal.id,
        label: landingSignal.label,
        uniqueCopies: 0,
        sharePct: 0,
        evidence: [{
          companyId: company.id,
          companyName: company.name,
          pageId: page?.id || null,
          sourceType: "captured_landing",
          sourceUrl: page?.finalUrl || page?.requestedUrl || capture?.website || null,
          excerpt: excerpt(landingText),
        }],
      });
    }
    if (category === "audience" && values.length === 0) {
      values.push({
        id: vertical.id,
        label: vertical.label,
        uniqueCopies: 0,
        sharePct: 0,
        evidence: [{ companyId: company.id, companyName: company.name, sourceType: "inference", sourcePath: "companies-index + captured landing", excerpt: excerpt(company.niche || landingRead.audience || company.offer) }],
      });
    }
    signals[category] = {
      status: values.some((value) => value.evidence.some((item) => item.sourceType !== "inference")) ? "observed" : "inferred",
      values: values.slice(0, 8),
    };
  }

  const formatGroups = new Map();
  for (const ad of ads) formatGroups.set(ad.formatId, [...(formatGroups.get(ad.formatId) || []), ad]);
  signals.format = {
    status: ads.length ? "observed" : "not_observed",
    values: [...formatGroups.entries()]
      .map(([id, rows]) => ({ id, label: formatLabel(id), uniqueCopies: rows.length, sharePct: pct(rows.length, ads.length), evidence: diverseEvidence(rows, 3) }))
      .sort((left, right) => right.uniqueCopies - left.uniqueCopies || bySpanishLabel(left, right)),
  };

  const coherenceCategories = ["audience", "promise", "mechanism", "guarantee", "cta"];
  const adComparable = unique(coherenceCategories.flatMap((category) => [...adSignalSets[category]].map((id) => `${category}:${id}`)));
  const landingComparable = new Set(coherenceCategories.flatMap((category) => [...landingSignalSets[category]].map((id) => `${category}:${id}`)));
  const matchedSignals = adComparable.filter((id) => landingComparable.has(id));
  const coherenceScore = capturedPages.length && adComparable.length ? pct(matchedSignals.length, adComparable.length) : null;
  const durations = ads.map((ad) => ad.durationDays).filter(Number.isFinite);
  const activeAds = ads.filter((ad) => ad.isActive === true);
  const firstStartedAt = ads.map((ad) => ad.startedAt || ad.startDate).filter(Boolean).sort()[0] || null;
  const lastStartedAt = ads.map((ad) => ad.startedAt || ad.startDate).filter(Boolean).sort().at(-1) || null;
  const priceText = clean(company.priceLocal || landingRead.price || company.ticket);
  const guaranteeText = clean(company.guarantee || landingRead.guarantee);

  const companySets = Object.fromEntries(Object.keys(SIGNAL_RULES).map((category) => [category, new Set([
    ...adSignalSets[category],
    ...landingSignalSets[category],
  ])]));
  companySignalSets.set(company.id, companySets);
  companyLandingSignalSets.set(company.id, Object.fromEntries(Object.entries(landingSignalSets).map(([category, values]) => [category, new Set(values)])));

  companyDna.push({
    companyId: company.id,
    name: company.name,
    country: company.primaryCountry || company.country,
    scope: company.scope,
    vertical,
    eligibility: { included: true, reason: "España + alcance Núcleo/Vertical", adjacentOrQuarantined: false },
    evidenceCoverage: {
      ads: ads.length > 0,
      trustedSemanticAds: signalAds.length > 0,
      capturedLanding: capturedPages.length > 0,
      publicPriceObserved: positiveCommercialField("price", priceText),
      guaranteeObserved: positiveCommercialField("guarantee", guaranteeText),
    },
    signals,
    landing: {
      status: capture?.status || fallbackLanding?.status || "not_available",
      capturedPages: capturedPages.length,
      plannedPages: Number(capture?.coverage?.planned) || 0,
      headline: excerpt(landingRead.headline),
      audience: excerpt(landingRead.audience),
      offer: excerpt(landingRead.offer || company.offer),
      mechanism: (Array.isArray(landingRead.mechanism) ? landingRead.mechanism : [landingRead.mechanism]).map((value) => excerpt(value, 160)).filter(Boolean).slice(0, 5),
      guarantee: positiveCommercialField("guarantee", landingRead.guarantee) ? excerpt(landingRead.guarantee) : null,
      price: positiveCommercialField("price", landingRead.price) ? excerpt(landingRead.price) : null,
      primaryCta: excerpt(landingRead.primaryCta),
      coherence: {
        status: coherenceScore === null ? "not_available" : "inferred_heuristic",
        score: coherenceScore,
        matchedSignals,
        comparableAdSignals: adComparable.length,
        limitation: "Coincidencia semántica por reglas entre copy y texto capturado; no mide conversión ni causalidad.",
      },
      evidence: capturedPages.slice(0, 3).map((page) => ({ pageId: page.id, role: page.role, sourceUrl: page.finalUrl || page.requestedUrl, image: page.image?.file || null })),
    },
    metrics: {
      rawCorpusRows: enrichedAds.filter((ad) => ad.companyId === company.id).length,
      uniqueIdentities: ads.length,
      trustedSemanticIdentities: signalAds.length,
      activeIdentities: activeAds.length,
      activeSharePct: pct(activeAds.length, ads.length),
      medianLongevityDays: round(median(durations), 1),
      variantUnits: ads.reduce((sum, ad) => sum + Math.max(1, Number(ad.variantCount) || 1), 0),
      firstStartedAt,
      lastStartedAt,
      formats: signals.format.values.map(({ id, label, uniqueCopies, sharePct }) => ({ id, label, uniqueCopies, sharePct })),
    },
    evidence: {
      adExamples: diverseEvidence(signalAds, 3),
      companySource: { sourceType: "companies_index", sourcePath: `companies-index.json#${company.id}`, evidenceLevel: company.evidence || null },
    },
  });
}

const dnaById = new Map(companyDna.map((company) => [company.companyId, company]));

const detectOfferModels = (value) => {
  const text = normalize(value);
  const models = [];
  if (/pago por (?:lead|cita|resultado)|por lead|por cita|a exito|solo pagas/.test(text)) models.push({ id: "performance", label: "Pago por resultado/lead/cita", status: "inferred_from_observed_text" });
  if (/revenue share|porcentaje|comision|% de (?:venta|facturacion|ingresos)/.test(text)) models.push({ id: "revenue-share", label: "Revenue share o comisión", status: "inferred_from_observed_text" });
  if (/\/mes|al mes|mensual|mensualidad|cuota/.test(text)) models.push({ id: "monthly-fee", label: "Cuota mensual", status: "inferred_from_observed_text" });
  if (/setup|alta|implantacion|proyecto|pago unico/.test(text)) models.push({ id: "setup-project", label: "Setup o proyecto", status: "inferred_from_observed_text" });
  if (/pack|bono|creditos|por contacto/.test(text)) models.push({ id: "pack", label: "Pack o bolsa", status: "inferred_from_observed_text" });
  if (/gratis|gratuit|prueba gratuita|sin coste/.test(text)) models.push({ id: "free-entry", label: "Entrada gratuita o prueba", status: "inferred_from_observed_text" });
  return models.length ? models : [{ id: "not-classified", label: "Modelo no clasificado", status: "not_observed" }];
};

const offerRows = companyDna.map((dna) => {
  const company = eligibleById.get(dna.companyId);
  const capture = captureById.get(dna.companyId);
  const landingRead = capture?.translation?.spanish || capture?.commercialRead || scrapeLandingById.get(dna.companyId) || {};
  const offer = clean(company.offer || landingRead.offer);
  const price = clean(company.priceLocal || landingRead.price || company.ticket);
  const guarantee = clean(company.guarantee || landingRead.guarantee);
  const contract = clean(company.contract);
  const combined = [offer, price, guarantee, contract].join(" ");
  return {
    companyId: dna.companyId,
    name: dna.name,
    verticalId: dna.vertical.id,
    offer: { status: offer ? "observed_attributed" : "not_observed", excerpt: excerpt(offer, 260), sourcePath: offer ? (company.offer ? "companies-index.offer" : "site-captures.commercialRead.offer") : null },
    pricing: {
      status: positiveCommercialField("price", price) ? "observed_attributed" : "not_observed",
      visibility: clean(company.priceStatus) || (positiveCommercialField("price", price) ? "Precio observado" : "No observado"),
      excerpt: positiveCommercialField("price", price) ? excerpt(price, 260) : null,
      normalized: company.price?.amount ? { currency: company.price.currency || null, amount: company.price.amount, eur: company.price.eur || null, label: company.price.label || null } : null,
    },
    models: detectOfferModels(combined),
    guarantee: {
      status: positiveCommercialField("guarantee", guarantee) ? "observed_attributed" : "not_observed",
      excerpt: positiveCommercialField("guarantee", guarantee) ? excerpt(guarantee, 260) : null,
      families: positiveCommercialField("guarantee", guarantee) ? detectSignals("guarantee", guarantee) : [],
    },
    contract: { status: contract ? "observed_attributed" : "not_observed", excerpt: excerpt(contract, 220) || null },
    evidence: [{ companyId: dna.companyId, sourceType: "company_or_captured_landing", sourcePath: "companies-index + site-captures", sourceUrl: company.website || company.domain || capture?.website || null }],
  };
});

const summarizeRows = (rows, extractor) => {
  const totals = new Map();
  for (const row of rows) for (const value of unique(extractor(row))) totals.set(value.id, { ...value, companies: (totals.get(value.id)?.companies || 0) + 1 });
  return [...totals.values()].map((value) => ({ ...value, sharePct: pct(value.companies, rows.length) })).sort((left, right) => right.companies - left.companies || bySpanishLabel(left, right));
};

const offerMatrix = {
  denominatorCompanies: offerRows.length,
  summary: {
    publicPriceObserved: offerRows.filter((row) => row.pricing.status === "observed_attributed").length,
    guaranteeObserved: offerRows.filter((row) => row.guarantee.status === "observed_attributed").length,
    offerModels: summarizeRows(offerRows, (row) => row.models),
    guaranteeFamilies: summarizeRows(offerRows, (row) => row.guarantee.families),
  },
  rows: offerRows,
};
offerMatrix.summary.publicPriceSharePct = pct(offerMatrix.summary.publicPriceObserved, offerRows.length);
offerMatrix.summary.guaranteeSharePct = pct(offerMatrix.summary.guaranteeObserved, offerRows.length);

const patternGroups = new Map();
for (const ad of trustedAds) {
  for (const [category, signals] of Object.entries(ad.detectedSignals)) {
    for (const signal of signals) {
      const key = `${category}:${signal.id}`;
      const current = patternGroups.get(key) || { id: key, category, signalId: signal.id, label: signal.label, ads: [] };
      current.ads.push(ad);
      patternGroups.set(key, current);
    }
  }
}

const patternUniverseCompanies = new Set(trustedAds.map((ad) => ad.companyId));
const allFormatCompanyRates = new Map();
for (const [formatId] of FORMAT_RULES) {
  const rows = trustedAds.filter((ad) => ad.formatId === formatId);
  const companiesWithFormat = new Set(rows.map((ad) => ad.companyId));
  const activeCompanies = new Set(rows.filter((ad) => ad.isActive === true).map((ad) => ad.companyId));
  allFormatCompanyRates.set(formatId, companiesWithFormat.size ? activeCompanies.size / companiesWithFormat.size : 0);
}
const maximumFormatActiveRate = Math.max(...allFormatCompanyRates.values(), 0.01);

const patternLibrary = [...patternGroups.values()]
  .map((pattern) => {
    const companyIds = new Set(pattern.ads.map((ad) => ad.companyId));
    const activeCompanyIds = new Set(pattern.ads.filter((ad) => ad.isActive === true).map((ad) => ad.companyId));
    const companyDurations = [...companyIds].map((companyId) => median(pattern.ads.filter((ad) => ad.companyId === companyId).map((ad) => ad.durationDays).filter(Number.isFinite))).filter(Number.isFinite);
    const companyVariants = [...companyIds].map((companyId) => new Set(pattern.ads.filter((ad) => ad.companyId === companyId).map((ad) => ad.identityKey)).size);
    const landingEligible = [...companyIds].filter((companyId) => dnaById.get(companyId)?.landing.capturedPages > 0);
    const landingMatched = landingEligible.filter((companyId) => companyLandingSignalSets.get(companyId)?.[pattern.category]?.has(pattern.signalId));
    const formats = weightedDistribution(pattern.ads, (ad) => [ad.formatId]);
    const adoptionPct = pct(companyIds.size, patternUniverseCompanies.size);
    const advice = signalAdvice(pattern.category, pattern.label);
    return {
      id: pattern.id,
      category: pattern.category,
      categoryLabel: CATEGORY_LABELS[pattern.category],
      label: pattern.label,
      observationStatus: "observed_frequency",
      denominator: { companies: patternUniverseCompanies.size, uniqueIdentities: trustedAds.length },
      metrics: {
        companies: companyIds.size,
        adoptionPct,
        uniqueIdentities: new Set(pattern.ads.map((ad) => `${ad.companyId}:${ad.identityKey}`)).size,
        activeCompanySharePct: pct(activeCompanyIds.size, companyIds.size),
        medianLongevityDays: round(median(companyDurations), 1),
        medianVariantsPerCompany: round(median(companyVariants), 1),
        landingCoherencePct: landingEligible.length ? pct(landingMatched.length, landingEligible.length) : null,
        landingCoherenceDenominator: landingEligible.length,
        formats: formats.slice(0, 5),
      },
      saturation: adoptionPct >= 55 ? "alta" : adoptionPct >= 25 ? "media" : "baja",
      saturationMeaning: "Frecuencia empresarial observada en la cohorte; no equivale a fatiga ni rendimiento.",
      whenToUse: { status: "inferred_recommendation", text: advice.whenToUse },
      risks: [{ status: "inferred_risk", text: advice.risk }],
      evidence: diverseEvidence(pattern.ads, 4),
    };
  })
  .filter((pattern) => pattern.metrics.companies >= 3)
  .sort((left, right) => right.metrics.companies - left.metrics.companies || bySpanishLabel(left, right))
  .slice(0, 42);

const scorePattern = (pattern) => {
  const group = patternGroups.get(pattern.id);
  const companyIds = unique(group.ads.map((ad) => ad.companyId));
  const formatScores = companyIds.map((companyId) => {
    const formats = unique(group.ads.filter((ad) => ad.companyId === companyId).map((ad) => ad.formatId));
    const scores = formats.map((formatId) => ((allFormatCompanyRates.get(formatId) || 0) / maximumFormatActiveRate) * 100);
    return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  });
  const components = {
    adoption: round(pattern.metrics.adoptionPct, 1),
    activity: round(pattern.metrics.activeCompanySharePct, 1),
    longevity: pattern.metrics.medianLongevityDays === null ? null : round(clamp((pattern.metrics.medianLongevityDays / 90) * 100), 1),
    variants: pattern.metrics.medianVariantsPerCompany === null ? null : round(clamp((pattern.metrics.medianVariantsPerCompany / 8) * 100), 1),
    format: round(median(formatScores), 1),
    landingCoherence: pattern.metrics.landingCoherencePct,
  };
  const weights = { adoption: 25, activity: 20, longevity: 15, variants: 15, format: 10, landingCoherence: 15 };
  const available = Object.entries(components).filter(([, value]) => Number.isFinite(value));
  const appliedWeight = available.reduce((sum, [key]) => sum + weights[key], 0);
  const score = available.reduce((sum, [key, value]) => sum + value * weights[key], 0) / appliedWeight;
  return {
    patternId: pattern.id,
    label: pattern.label,
    category: pattern.category,
    score: round(score, 1),
    claimStatus: "hypothesis",
    claim: `Probar ${pattern.label.toLocaleLowerCase("es")} como hipótesis controlada en una campaña compatible.`,
    interpretation: "Prioridad descriptiva por presencia y señales operativas; necesita métricas propias de coste, calidad, citas y ventas.",
    components,
    weightsApplied: Object.fromEntries(available.map(([key]) => [key, weights[key]])),
    availableWeight: appliedWeight,
    missingComponents: Object.entries(components).filter(([, value]) => value === null).map(([key]) => key),
    denominator: pattern.denominator,
    evidence: pattern.evidence.slice(0, 3),
  };
};

const hypothesisItems = patternLibrary
  .filter((pattern) => pattern.category !== "format" && pattern.metrics.companies >= 4)
  .map(scorePattern)
  .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "es"))
  .slice(0, 25)
  .map((item, index) => ({ rank: index + 1, ...item }));

const GAP_SIGNALS = [
  ["qualified-meetings", "Citas o reuniones cualificadas", "promise", "qualified-meetings"],
  ["explicit-guarantee", "Garantía explícita", "guarantee", "explicit-guarantee"],
  ["qualification", "Cualificación o filtrado explicado", "mechanism", "qualification"],
  ["automation-ai", "Automatización o IA explicada", "mechanism", "automation-ai"],
  ["appointment-setting", "Agenda implantada", "mechanism", "appointment-setting"],
  ["territorial-exclusivity", "Exclusividad territorial", "promise", "territorial-exclusivity"],
  ["book-call", "CTA de reserva", "cta", "book-call"],
  ["no-lock-in", "Sin permanencia", "guarantee", "no-lock-in"],
  ["public-price", "Precio público observado", "offer", "public-price"],
];

const verticalMap = new Map();
for (const dna of companyDna) {
  const current = verticalMap.get(dna.vertical.id) || { id: dna.vertical.id, label: dna.vertical.label, companies: [] };
  current.companies.push(dna);
  verticalMap.set(dna.vertical.id, current);
}

const marketGapVerticals = [...verticalMap.values()]
  .filter((vertical) => vertical.companies.length >= 4)
  .map((vertical) => {
    const denominatorCompanies = vertical.companies.filter((dna) => dna.metrics.trustedSemanticIdentities > 0 || dna.landing.capturedPages > 0);
    const denominatorIds = new Set(denominatorCompanies.map((dna) => dna.companyId));
    const ads = trustedAds.filter((ad) => denominatorIds.has(ad.companyId));
    const gaps = GAP_SIGNALS.map(([id, label, category, signalId]) => {
      let observed;
      if (category === "offer") observed = denominatorCompanies.filter((dna) => dna.evidenceCoverage.publicPriceObserved);
      else observed = denominatorCompanies.filter((dna) => companySignalSets.get(dna.companyId)?.[category]?.has(signalId));
      const adoptionPct = pct(observed.length, denominatorCompanies.length);
      return {
        signalId: id,
        label,
        measurementStatus: "observed_frequency",
        opportunityStatus: "inferred_hypothesis",
        observedCompanies: observed.length,
        denominatorCompanies: denominatorCompanies.length,
        adoptionPct,
        gapPct: round(100 - adoptionPct, 1),
        evidence: observed.slice(0, 3).flatMap((dna) => {
          if (category === "offer") return [{ companyId: dna.companyId, companyName: dna.name, sourceType: "company_or_captured_landing", sourcePath: "price" }];
          const value = dna.signals[category]?.values.find((item) => item.id === signalId);
          return value?.evidence?.slice(0, 1) || [];
        }),
        limitation: "Ausencia en la evidencia recuperada no demuestra que la empresa nunca use esta señal; el hueco es una hipótesis para validar.",
      };
    })
      .filter((gap) => gap.denominatorCompanies >= 4 && gap.adoptionPct <= 55)
      .sort((left, right) => right.gapPct - left.gapPct || left.label.localeCompare(right.label, "es"))
      .slice(0, 5);
    return {
      verticalId: vertical.id,
      label: vertical.label,
      denominator: {
        companies: denominatorCompanies.length,
        uniqueIdentities: ads.length,
        landingCompanies: denominatorCompanies.filter((dna) => dna.landing.capturedPages > 0).length,
      },
      gaps,
    };
  })
  .filter((vertical) => vertical.denominator.companies >= 4)
  .sort((left, right) => right.denominator.companies - left.denominator.companies || bySpanishLabel(left, right));

const topSignalForVertical = (companiesInVertical, category) => {
  const counts = new Map();
  for (const dna of companiesInVertical) {
    const companySeen = new Set();
    for (const value of dna.signals[category]?.values || []) {
      if (companySeen.has(value.id)) continue;
      companySeen.add(value.id);
      const current = counts.get(value.id) || { id: value.id, label: value.label, companies: [], evidence: [] };
      current.companies.push(dna.companyId);
      current.evidence.push(...(value.evidence || []));
      counts.set(value.id, current);
    }
  }
  const best = [...counts.values()].sort((left, right) => right.companies.length - left.companies.length || bySpanishLabel(left, right))[0];
  if (!best) return { status: "not_observed", id: null, label: "Sin señal suficiente", companies: 0, adoptionPct: 0, evidence: [] };
  return {
    status: "observed_frequency",
    id: best.id,
    label: best.label,
    companies: best.companies.length,
    adoptionPct: pct(best.companies.length, companiesInVertical.length),
    evidence: diverseEvidence(best.evidence.filter((item) => item.adId).map((item) => ({
      companyId: item.companyId,
      companyName: item.companyName,
      externalId: item.adId,
      corpusKey: item.adId,
      identityKey: item.identityKey,
      sourceUrl: item.sourceUrl,
      semanticText: item.excerpt,
      isActive: item.active,
      durationDays: null,
    })), 3),
  };
};

const landingVerticalAliases = {
  "clinics-health": "clinicas-salud",
  "reforms-home": "reformas-hogar",
  "real-estate": "inmobiliario",
  "legal-finance-insurance": "legal",
  "solar-energy": "solar-energia",
  "b2b-sdr": "b2b-sdr",
  automotive: "coches-motor",
  "beauty-wellness": "belleza-bienestar",
  "hospitality-tourism": "hosteleria-turismo",
  generalist: "generalista",
};

const playbooks = marketGapVerticals
  .filter((vertical) => vertical.denominator.companies >= 5)
  .slice(0, 8)
  .map((vertical) => {
    const companiesInVertical = verticalMap.get(vertical.verticalId).companies.filter((dna) => dna.metrics.trustedSemanticIdentities > 0 || dna.landing.capturedPages > 0);
    const observedModules = Object.fromEntries(["audience", "pain", "promise", "mechanism", "guarantee", "cta", "format"].map((category) => [category, topSignalForVertical(companiesInVertical, category)]));
    const landingVertical = landingIntelligence.verticals?.[landingVerticalAliases[vertical.verticalId]];
    return {
      verticalId: vertical.verticalId,
      label: vertical.label,
      denominator: vertical.denominator,
      status: "evidence_based_playbook",
      observedModules,
      landingBlueprint: {
        status: landingVertical ? "observed_frequency_plus_inferred_structure" : "inferred_from_universal_structure",
        fieldPresence: landingVertical?.fieldPresence || landingIntelligence.universal?.fieldPresence || {},
        medianFunnelSteps: landingVertical?.medianFunnelSteps ?? landingIntelligence.universal?.medianFunnelSteps ?? null,
        modules: (landingIntelligence.universal?.anatomy || []).slice(0, 8),
        recommendations: (landingVertical?.recommendations || [
          "Mantener continuidad literal entre promesa del anuncio y titular de la landing.",
          "Explicar mecanismo, prueba y condiciones antes de pedir el siguiente compromiso.",
        ]).slice(0, 5).map((text) => ({ status: "inferred_recommendation", text })),
      },
      opportunityTests: vertical.gaps.slice(0, 4).map((gap) => ({
        status: "inferred_hypothesis",
        signalId: gap.signalId,
        test: `Probar una variante que haga explícito: ${gap.label}.`,
        rationale: `${gap.observedCompanies}/${gap.denominatorCompanies} empresas lo hacen visible en la evidencia recuperada.`,
        guardrail: "Comparar con control usando CPL válido, cita, asistencia, venta y margen; no asumir rendimiento por frecuencia.",
      })),
    };
  });

const sourceContents = await Promise.all(Object.entries(INPUTS).map(async ([key, file]) => [key, await readFile(file, "utf8")]));
const captureFingerprint = sha256(captureRecords
  .map((record) => `${record.id}:${record.updatedAt || ""}:${record.status || ""}:${record.coverage?.captured || 0}`)
  .sort()
  .join("\n"));

const output = {
  schemaVersion: "rv-competitive-intelligence-v1",
  generatedAt,
  scope: {
    market: "España",
    includedScopes: ["Núcleo — agencia/leadgen", "Vertical — broker/marketplace"],
    excludedScopePrefixes: ["Adyacente", "Excluir", "Cuarentena"],
    inclusionRule: "Empresa con país primario España y alcance que comienza por Núcleo o Vertical.",
  },
  methodology: {
    status: "descriptive_not_performance_validated",
    note: "Frecuencias, actividad y longevidad son señales observadas. Recomendaciones, huecos, playbooks y ranking son inferencias para diseñar pruebas; no demuestran conversión, causalidad ni rendimiento.",
    deduplication: "Una unidad por empresa + sourceCopySha256; fallback corpusKey, externalId, archivoSha256 o archivo. Las creatividades sin copy conservan su identidad visual.",
    weighting: "Adopción, actividad, formatos y huecos se calculan por empresa; una marca cuenta como máximo una vez por señal y denominador.",
    semanticPolicy: "Patrones de copy solo usan español original o traducción española revisada y aptaPatrones=true.",
    reproducibility: "generatedAt deriva del origen más reciente y las fuentes llevan huellas SHA-256; ejecutar el builder sin cambiar entradas produce el mismo archivo.",
    rankingFormula: {
      expression: "weightedMean(adoption×25, activity×20, longevity×15, variants×15, format×10, landingCoherence×15) over available components",
      componentDefinitions: {
        adoption: "Porcentaje de empresas del universo semántico que muestran la señal.",
        activity: "Porcentaje de empresas asociadas con al menos una identidad activa.",
        longevity: "Mediana por empresa de días activos, normalizada a 90 días y limitada a 100.",
        variants: "Mediana de identidades por empresa, normalizada a 8 y limitada a 100.",
        format: "Propensión activa relativa del formato usado, calculada por empresas y normalizada al mejor formato observado.",
        landingCoherence: "Porcentaje de empresas con landing capturada donde la misma señal continúa visible.",
      },
      missingData: "Los componentes no disponibles se omiten y los pesos restantes se renormalizan; nunca se imputan resultados.",
    },
    evidenceLimits: { perSignal: 3, perPattern: 4, perHypothesis: 3, patterns: 42, hypotheses: 25, playbooks: 8, gapsPerVertical: 5 },
    sourceFingerprints: {
      ...Object.fromEntries(sourceContents.map(([key, value]) => [key, sha256(value)])),
      siteCaptures: captureFingerprint,
    },
  },
  summary: {
    eligibleCompanies: eligibleCompanies.length,
    companiesWithAds: new Set(dedupedAds.map((ad) => ad.companyId)).size,
    companiesWithTrustedSemanticAds: patternUniverseCompanies.size,
    rawCorpusRows: enrichedAds.length,
    uniqueIdentities: dedupedAds.length,
    duplicateRowsCollapsed: enrichedAds.length - dedupedAds.length,
    trustedSemanticIdentities: trustedAds.length,
    capturedLandingCompanies: companyDna.filter((company) => company.landing.capturedPages > 0).length,
    verticals: verticalMap.size,
    patterns: patternLibrary.length,
    hypotheses: hypothesisItems.length,
    playbooks: playbooks.length,
  },
  companyDna,
  marketGaps: {
    note: "Un hueco significa baja visibilidad en la muestra, no ausencia absoluta ni oportunidad validada.",
    verticals: marketGapVerticals,
  },
  playbooks,
  offerMatrix,
  patternLibrary,
  hypothesisRanking: {
    label: "Hipótesis priorizadas",
    disclaimer: "No contiene métricas de rendimiento ni atribuye causalidad. El orden sirve para decidir qué probar; cada hipótesis requiere un experimento con métricas propias.",
    formula: "25% adopción + 20% actividad + 15% longevidad + 15% variantes + 10% formato + 15% coherencia de landing; se renormalizan solo componentes disponibles.",
    items: hypothesisItems,
  },
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: path.relative(root, outputPath), ...output.summary }, null, 2));
