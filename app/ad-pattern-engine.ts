import type { AnuncioReal } from "./data-types";

export type SemanticCopySource =
  | "original_es"
  | "traduccion_revisada"
  | "traduccion_automatica"
  | "original_extranjero";

export type SemanticAdCopy = {
  headline: string;
  body: string;
  cta: string;
  price: string;
  all: string;
  source: SemanticCopySource;
  trusted: boolean;
  label: string;
};

export type PatternObservation<T = unknown> = {
  key: string;
  identityKey: string;
  companyId: string;
  companyName: string;
  country: string;
  platform: string;
  quality: number;
  semanticTrusted: boolean;
  /** Omitido significa que todas las dimensiones son observables. */
  evaluableDimensions?: string[];
  dimensions: Record<string, string[]>;
  phraseText: string;
  payload: T;
};

export type PatternStrength = "robusta" | "recurrente" | "distintiva" | "exploratoria" | "indicio";

export type PatternSignal<T = unknown> = {
  id: string;
  label: string;
  dimension: string;
  observations: PatternObservation<T>[];
  examples: PatternObservation<T>[];
  pieces: number;
  identities: number;
  companies: number;
  countries: number;
  platforms: number;
  companyAdoption: number;
  identityPresence: number;
  universeCompanies: number;
  referenceCompanyAdoption: number;
  referenceUniverseCompanies: number;
  comparisonSufficient: boolean;
  deltaPoints: number;
  relativeIndex: number | null;
  dominance: number;
  semanticTrust: number;
  evidenceScore: number;
  strength: PatternStrength;
};

export type AssociationSignal<T = unknown> = PatternSignal<T> & {
  leftDimension: string;
  leftLabel: string;
  rightDimension: string;
  rightLabel: string;
  /** Coaparición en una misma pieza / producto de adopciones empresariales. */
  coOccurrenceIndex: number;
  pairRateAmongLeftCompanies: number;
  adoptionProductCompanies: number;
};

export type PhraseSignal<T = unknown> = PatternSignal<T> & {
  phrase: string;
};

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/https?:\/\/\S+|www\.\S+/g, " ")
    .replace(/[^a-z0-9ñáéíóúü€%+]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const joinCopy = (headline: string, body: string, cta: string, price: string) =>
  [headline, body, cta, price].filter(Boolean).join("\n").trim();

export const semanticCopyForAd = (ad: AnuncioReal): SemanticAdCopy => {
  const original = {
    headline: ad.titular || "",
    body: ad.texto || "",
    cta: ad.cta || "",
    price: ad.precioVisible || "",
  };
  const translated = {
    headline: ad.traduccionEs?.titular || "",
    body: ad.traduccionEs?.texto || "",
    cta: ad.traduccionEs?.cta || "",
    price: ad.traduccionEs?.precioVisible || "",
  };
  if (ad.idioma === "es" || ad.estadoTraduccion === "no_necesaria") {
    return {
      ...original,
      all: joinCopy(original.headline, original.body, original.cta, original.price),
      source: "original_es",
      trusted: true,
      label: "Original en español",
    };
  }
  if (ad.estadoTraduccion === "revisada" && ad.traduccionEs) {
    return {
      ...translated,
      all: joinCopy(translated.headline, translated.body, translated.cta, translated.price),
      source: "traduccion_revisada",
      trusted: true,
      label: "Traducción española revisada",
    };
  }
  if (ad.estadoTraduccion === "automatica" && ad.traduccionEs) {
    return {
      ...translated,
      all: joinCopy(translated.headline, translated.body, translated.cta, translated.price),
      source: "traduccion_automatica",
      trusted: false,
      label: "Traducción automática · señal exploratoria",
    };
  }
  return {
    ...original,
    all: joinCopy(original.headline, original.body, original.cta, original.price),
    source: "original_extranjero",
    trusted: false,
    label: "Original extranjero sin traducción revisada",
  };
};

export const patternIdentityForAd = (ad: AnuncioReal, fallback: string) => {
  if (ad.copyAvailable === false) {
    return ad.corpusKey || ad.externalId || ad.archivoSha256 || ad.file || fallback;
  }
  return ad.sourceCopySha256 || ad.corpusKey || ad.externalId || ad.archivoSha256 || ad.file || fallback;
};

const HOOK_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "Pregunta directa", pattern: /(?:^|\s)(?:como|quieres|necesitas|buscas|cansad[oa]|sabias|te gustaria|por que)\b|\?/i },
  { label: "Número en apertura", pattern: /(?:^|\s)(?:\d+[\d.,]*|top\s*\d+|\d+\s*%|\d+\s*€)/i },
  { label: "Resultado primero", pattern: /mas (?:clientes|ventas|citas|leads|pacientes)|llena tu agenda|crece|escala|multiplica|aumenta|consigue|genera/i },
  { label: "Dolor / problema", pattern: /sin clientes|agenda vacia|pierdes|perdiendo|problema|frustrad|cansad|deja de|no consigues|te cuesta|desaprovech/i },
  { label: "Prueba / autoridad", pattern: /caso de exito|testimoni|mas de \d|top\s*\d|lider|expert[oa]s?|resenas?|reviews?|hemos generado/i },
  { label: "Oferta / precio", pattern: /gratis|gratuit|desde\s+\d|\d+[\d.,]*\s*€|descuento|oferta|promocion|sin coste/i },
  { label: "Urgencia / escasez", pattern: /ultimas? plazas?|solo\s+\d|hoy|ahora|limitad|lista de espera|no te quedes|antes de|fecha limite/i },
  { label: "Contraste / anti-competencia", pattern: /frente a|a diferencia|sin portales|sin intermediarios|deja de pagar|no compres|alternativa|competidor/i },
  { label: "Educación / descubrimiento", pattern: /descubre|guia|webinar|masterclass|aprende|como\s+|metodo|paso a paso|auditoria/i },
];

const MECHANIC_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "Entrada gratuita", pattern: /gratis|gratuit|sin coste|coste cero|prueba gratuita/i },
  { label: "Importe monetario visible", pattern: /(?:desde\s*)?\d+[\d.,]*\s*(?:€|euros?|\$|usd)|por solo\s+\d/i },
  { label: "Garantía explícita", pattern: /garantia|devolv|reembols|sin riesgo|riesgo cero|si no funciona|no cobramos/i },
  { label: "Pago por resultado", pattern: /pago por (?:resultado|lead|cita)|solo pagas|a exito|pay per|sin cuota fija/i },
  { label: "Sin permanencia", pattern: /sin permanencia|sin compromiso|cancela cuando|sin contrato/i },
  { label: "Auditoría / demo / diagnóstico", pattern: /auditoria|diagnostico|demo|consulta|valoracion|evaluacion|presupuesto|cotizacion/i },
  { label: "Escasez / selección", pattern: /plazas? limitad|solo\s+\d|lista de espera|seleccion|casting|exclusiv/i },
  { label: "Rapidez / SLA", pattern: /\d+\s*(?:minutos?|horas?|dias?|semanas?)|24\s*\/\s*7|inmediat|tiempo real|respuesta rapida/i },
  { label: "Territorio exclusivo", pattern: /territori|tu zona|tu ciudad|exclusiv|una sola empresa/i },
  { label: "Prueba social", pattern: /caso de exito|testimoni|resenas?|reviews?|mas de \d|clientes satisfechos/i },
];

export const detectHookFamilies = (headline: string, body = "") => {
  const opening = headline.trim() || body.trim().split(/\s+/).slice(0, 12).join(" ");
  const source = normalize(opening);
  const matches = HOOK_RULES.filter((rule) => rule.pattern.test(source)).map((rule) => rule.label);
  return matches.length ? matches : ["Apertura descriptiva"];
};

export const detectOfferMechanics = (copy: string) => {
  const source = normalize(copy);
  const matches = MECHANIC_RULES.filter((rule) => rule.pattern.test(source)).map((rule) => rule.label);
  return matches.length ? matches : ["Sin mecánica explícita"];
};

export const creativeFormatForAd = (ad: AnuncioReal) => {
  const platform = normalize(ad.plataforma);
  const file = String(ad.file || "").toLocaleLowerCase("es");
  if (/carrusel|carousel/.test(platform)) return "Carrusel";
  if (/reels?/.test(platform)) return "Vídeo / Reel";
  if (/\b(?:video|vídeo)\b/.test(platform)) return "Vídeo";
  if (/\b(?:imagen|image|bild|foto)\b/.test(platform)) return "Imagen / estático";
  if (/\b(?:text|texto)\b/.test(platform)) return "Anuncio de texto";
  if (ad.mediaType === "video") return "Vídeo (archivo)";
  if (ad.mediaType === "document") return "Documento";
  if (/\.(?:mp4|mov|webm|m4v)(?:\?|$)/.test(file)) return "Vídeo (archivo)";
  if (/meme/.test(file)) return "Meme (archivo identificado)";
  if (platform === "google") return "Anuncio de búsqueda";
  if (platform.includes("google")) return "Google · formato no determinado";
  if (platform.includes("display")) return "Display · formato no determinado";
  if (platform.includes("meta") || platform.includes("instagram")) return "Social · formato no determinado";
  return "Formato no determinado";
};

export const parseAdDate = (value: string | null | undefined): number => {
  const raw = String(value || "").trim();
  if (!raw) return Number.NEGATIVE_INFINITY;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const european = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (european) return Date.UTC(Number(european[3]), Number(european[2]) - 1, Number(european[1]));
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const unique = <T,>(values: T[]) => [...new Set(values)];

const diverseExamples = <T,>(observations: PatternObservation<T>[], limit = 3) => {
  const sorted = [...observations].sort((left, right) =>
    Number(right.semanticTrusted) - Number(left.semanticTrusted) ||
    right.quality - left.quality ||
    left.companyName.localeCompare(right.companyName, "es"),
  );
  const companies = new Set<string>();
  const result: PatternObservation<T>[] = [];
  for (const item of sorted) {
    if (companies.has(item.companyId)) continue;
    companies.add(item.companyId);
    result.push(item);
    if (result.length === limit) return result;
  }
  for (const item of sorted) {
    if (result.includes(item)) continue;
    result.push(item);
    if (result.length === limit) break;
  }
  return result;
};

const labelValues = <T,>(records: PatternObservation<T>[], dimension: string) => {
  const groups = new Map<string, PatternObservation<T>[]>();
  for (const record of records) {
    for (const label of unique(record.dimensions[dimension] || []).filter(Boolean)) {
      const current = groups.get(label) || [];
      current.push(record);
      groups.set(label, current);
    }
  }
  return groups;
};

const isDimensionEvaluable = <T,>(record: PatternObservation<T>, dimension: string) =>
  !record.evaluableDimensions || record.evaluableDimensions.includes(dimension);

const metricForGroup = <T,>(
  id: string,
  label: string,
  dimension: string,
  observations: PatternObservation<T>[],
  universe: PatternObservation<T>[],
  reference: PatternObservation<T>[],
): PatternSignal<T> => {
  const identityKeys = unique(observations.map((item) => item.identityKey));
  const companyIds = unique(observations.map((item) => item.companyId));
  const evaluableUniverse = universe.filter((item) => isDimensionEvaluable(item, dimension));
  const evaluableReference = reference.filter((item) => isDimensionEvaluable(item, dimension));
  const universeCompanies = unique(evaluableUniverse.map((item) => item.companyId));
  const universeIdentities = unique(evaluableUniverse.map((item) => item.identityKey));
  const referenceGroup = labelValues(evaluableReference, dimension).get(label) || [];
  const referenceCompanies = unique(referenceGroup.map((item) => item.companyId));
  const referenceUniverseCompanies = unique(evaluableReference.map((item) => item.companyId));
  const companyAdoption = universeCompanies.length ? companyIds.length / universeCompanies.length : 0;
  const identityPresence = universeIdentities.length ? identityKeys.length / universeIdentities.length : 0;
  const referenceCompanyAdoption = referenceUniverseCompanies.length
    ? referenceCompanies.length / referenceUniverseCompanies.length
    : 0;
  const comparisonSufficient = universeCompanies.length >= 8 && referenceUniverseCompanies.length >= 8;
  const deltaPoints = (companyAdoption - referenceCompanyAdoption) * 100;
  const uniqueIdentityObservations = [...new Map(
    observations.map((item) => [item.identityKey, item]),
  ).values()];
  const companyCounts = uniqueIdentityObservations.reduce((map, item) => {
    map.set(item.companyId, (map.get(item.companyId) || 0) + 1);
    return map;
  }, new Map<string, number>());
  const dominance = uniqueIdentityObservations.length
    ? Math.max(0, ...companyCounts.values()) / uniqueIdentityObservations.length
    : 0;
  const semanticTrust = uniqueIdentityObservations.length
    ? uniqueIdentityObservations.filter((item) => item.semanticTrusted).length / uniqueIdentityObservations.length
    : 0;
  const quality = uniqueIdentityObservations.length
    ? uniqueIdentityObservations.reduce((sum, item) => sum + item.quality, 0) / uniqueIdentityObservations.length
    : 0;
  const breadthScore = Math.min(100, companyIds.length * 9);
  const identityScore = Math.min(100, identityKeys.length * 5);
  const evidenceScore = Math.round(
    breadthScore * 0.35 + identityScore * 0.2 + quality * 0.25 + (1 - dominance) * 100 * 0.2,
  );
  const semanticallyDerived = ["hook", "promise", "mechanic", "cta", "phrase"].includes(dimension);
  const trustedObservations = uniqueIdentityObservations.filter((item) => item.semanticTrusted);
  const strengthCompanies = semanticallyDerived
    ? unique(trustedObservations.map((item) => item.companyId)).length
    : companyIds.length;
  const strengthIdentities = semanticallyDerived ? trustedObservations.length : identityKeys.length;
  let strength: PatternStrength = strengthCompanies >= 8 && strengthIdentities >= 10 && dominance <= 0.35
    ? "robusta"
    : strengthCompanies >= 4 && strengthIdentities >= 5
      ? "recurrente"
      : "indicio";
  if (Math.abs(deltaPoints) >= 10 && strengthCompanies >= 8 && comparisonSufficient) strength = "distintiva";
  if (Math.abs(deltaPoints) >= 1 && !comparisonSufficient) strength = "exploratoria";
  if (semanticallyDerived && semanticTrust < 0.8) strength = "exploratoria";
  return {
    id,
    label,
    dimension,
    observations,
    examples: diverseExamples(observations),
    pieces: observations.length,
    identities: identityKeys.length,
    companies: companyIds.length,
    countries: unique(observations.map((item) => item.country).filter((country) => country && country !== "Sin país")).length,
    platforms: unique(observations.map((item) => item.platform)).length,
    companyAdoption,
    identityPresence,
    universeCompanies: universeCompanies.length,
    referenceCompanyAdoption,
    referenceUniverseCompanies: referenceUniverseCompanies.length,
    comparisonSufficient,
    deltaPoints,
    relativeIndex: referenceCompanyAdoption > 0 ? companyAdoption / referenceCompanyAdoption : null,
    dominance,
    semanticTrust,
    evidenceScore,
    strength,
  };
};

export const buildPatternSignals = <T,>(
  records: PatternObservation<T>[],
  dimension: string,
  reference: PatternObservation<T>[] = records,
) => [...labelValues(records, dimension).entries()]
  .map(([label, observations]) => metricForGroup(
    `${dimension}:${normalize(label)}`,
    label,
    dimension,
    observations,
    records,
    reference,
  ))
  .sort((left, right) =>
    right.companies - left.companies ||
    right.identities - left.identities ||
    right.evidenceScore - left.evidenceScore ||
    left.label.localeCompare(right.label, "es"),
  );

const pairKey = (leftDimension: string, leftLabel: string, rightDimension: string, rightLabel: string) =>
  `${leftDimension}:${leftLabel}\u0000${rightDimension}:${rightLabel}`;

const associationTheme = (label: string) => {
  const value = normalize(label);
  if (/precio|ahorro|oferta|gratuit|gratis|entrada gratuita/.test(value)) return "price";
  if (/garantia|riesgo|devol|reembols/.test(value)) return "risk";
  if (/autoridad|prueba social|testimoni|resena/.test(value)) return "proof";
  if (/rapidez|velocidad|urgencia|plazo|sla/.test(value)) return "speed";
  if (/resultado|crecimiento|escala/.test(value)) return "growth";
  if (/educacion|contenido|descubrimiento/.test(value)) return "education";
  if (/escasez|seleccion/.test(value)) return "scarcity";
  if (/territorio|exclusividad/.test(value)) return "territory";
  return "";
};

const isGenericAssociationFeature = (label: string) =>
  /sin clasificar|sin promesa|sin mecanica|sin cta|no determinad|apertura descriptiva|otro \/ sin/.test(normalize(label));

const isRedundantAssociation = (leftLabel: string, rightLabel: string) => {
  if (normalize(leftLabel) === normalize(rightLabel)) return true;
  const leftTheme = associationTheme(leftLabel);
  return Boolean(leftTheme && leftTheme === associationTheme(rightLabel));
};

export const buildAssociationSignals = <T,>(
  records: PatternObservation<T>[],
  reference: PatternObservation<T>[] = records,
  dimensions = ["hook", "angle", "promise", "mechanic", "format", "cta"],
) => {
  const pairGroups = new Map<string, {
    leftDimension: string;
    leftLabel: string;
    rightDimension: string;
    rightLabel: string;
    observations: PatternObservation<T>[];
  }>();
  for (const record of records) {
    const features = dimensions.flatMap((dimension) =>
      unique(record.dimensions[dimension] || [])
        .filter((label) => label && !isGenericAssociationFeature(label))
        .map((label) => ({ dimension, label })),
    );
    for (let leftIndex = 0; leftIndex < features.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < features.length; rightIndex += 1) {
        const left = features[leftIndex];
        const right = features[rightIndex];
        if (left.dimension === right.dimension) continue;
        if (isRedundantAssociation(left.label, right.label)) continue;
        const ordered = left.dimension.localeCompare(right.dimension) <= 0 ? [left, right] : [right, left];
        const key = pairKey(ordered[0].dimension, ordered[0].label, ordered[1].dimension, ordered[1].label);
        const current = pairGroups.get(key) || {
          leftDimension: ordered[0].dimension,
          leftLabel: ordered[0].label,
          rightDimension: ordered[1].dimension,
          rightLabel: ordered[1].label,
          observations: [],
        };
        current.observations.push(record);
        pairGroups.set(key, current);
      }
    }
  }
  const candidates = [...pairGroups.entries()].map(([id, pair]) => {
    const observableRecords = records.filter((item) =>
      isDimensionEvaluable(item, pair.leftDimension) && isDimensionEvaluable(item, pair.rightDimension));
    const observableCompanyIds = new Set(observableRecords.map((item) => item.companyId));
    const uniqueObservations = [...new Map(pair.observations
      .filter((item) => observableCompanyIds.has(item.companyId))
      .map((item) => [item.key, item])).values()];
    const pairCompanyCount = unique(uniqueObservations.map((item) => item.companyId)).length;
    const leftCompanies = unique(observableRecords
      .filter((item) => (item.dimensions[pair.leftDimension] || []).includes(pair.leftLabel))
      .map((item) => item.companyId));
    const rightCompanies = unique(observableRecords
      .filter((item) => (item.dimensions[pair.rightDimension] || []).includes(pair.rightLabel))
      .map((item) => item.companyId));
    const leftCount = leftCompanies.length;
    const rightCount = rightCompanies.length;
    const total = unique(observableRecords.map((item) => item.companyId)).length || 1;
    const coOccurrenceIndex = leftCount && rightCount
      ? (pairCompanyCount / total) / ((leftCount / total) * (rightCount / total))
      : 0;
    const pairRateAmongLeftCompanies = leftCount ? pairCompanyCount / leftCount : 0;
    const adoptionProductCompanies = leftCount && rightCount ? (leftCount * rightCount) / total : 0;
    const syntheticDimension = `pair:${id}`;
    const displayLabel = `${pair.leftLabel} + ${pair.rightLabel}`;
    const syntheticRecords = uniqueObservations.map((item) => ({
      ...item,
      dimensions: { ...item.dimensions, [syntheticDimension]: [displayLabel] },
    }));
    const syntheticUniverse = observableRecords.map((item) => ({
      ...item,
      evaluableDimensions: [...new Set([...(item.evaluableDimensions || dimensions), syntheticDimension])],
      dimensions: {
        ...item.dimensions,
        [syntheticDimension]: (item.dimensions[pair.leftDimension] || []).includes(pair.leftLabel) &&
          (item.dimensions[pair.rightDimension] || []).includes(pair.rightLabel) ? [displayLabel] : [],
      },
    }));
    const syntheticReference = reference
      .filter((item) => isDimensionEvaluable(item, pair.leftDimension) && isDimensionEvaluable(item, pair.rightDimension))
      .map((item) => ({
      ...item,
      evaluableDimensions: [...new Set([...(item.evaluableDimensions || dimensions), syntheticDimension])],
      dimensions: {
        ...item.dimensions,
        [syntheticDimension]: (item.dimensions[pair.leftDimension] || []).includes(pair.leftLabel) &&
          (item.dimensions[pair.rightDimension] || []).includes(pair.rightLabel) ? [displayLabel] : [],
      },
    }));
    const base = metricForGroup(
      id,
      displayLabel,
      syntheticDimension,
      syntheticRecords,
      syntheticUniverse,
      syntheticReference,
    );
    const semanticPair = [pair.leftDimension, pair.rightDimension]
      .some((dimension) => ["hook", "promise", "mechanic", "cta"].includes(dimension));
    const trustedPairObservations = [...new Map(uniqueObservations
      .filter((item) => item.semanticTrusted)
      .map((item) => [item.identityKey, item])).values()];
    const trustedPairCompanies = unique(trustedPairObservations.map((item) => item.companyId));
    const trustedCompanyCounts = trustedPairObservations.reduce((map, item) => {
      map.set(item.companyId, (map.get(item.companyId) || 0) + 1);
      return map;
    }, new Map<string, number>());
    const trustedDominance = trustedPairObservations.length
      ? Math.max(0, ...trustedCompanyCounts.values()) / trustedPairObservations.length
      : 1;
    let associationStrength = base.strength;
    if (semanticPair) {
      associationStrength = trustedPairCompanies.length >= 8 && trustedPairObservations.length >= 10 && trustedDominance <= 0.35
        ? "robusta"
        : trustedPairCompanies.length >= 4 && trustedPairObservations.length >= 5
          ? "recurrente"
          : "indicio";
      if (Math.abs(base.deltaPoints) >= 10 && trustedPairCompanies.length >= 8 && base.comparisonSufficient) associationStrength = "distintiva";
      if (Math.abs(base.deltaPoints) >= 1 && !base.comparisonSufficient) associationStrength = "exploratoria";
      if (base.semanticTrust < 0.8) associationStrength = "exploratoria";
    }
    return {
      ...base,
      strength: associationStrength,
      dimension: "pair",
      leftDimension: pair.leftDimension,
      leftLabel: pair.leftLabel,
      rightDimension: pair.rightDimension,
      rightLabel: pair.rightLabel,
      coOccurrenceIndex,
      pairRateAmongLeftCompanies,
      adoptionProductCompanies,
    } satisfies AssociationSignal<T>;
  }).filter((signal) => signal.companies >= 5 && signal.identities >= 6 && signal.coOccurrenceIndex >= 1.15 && signal.adoptionProductCompanies >= 3)
    .sort((left, right) =>
      right.companies - left.companies ||
      right.coOccurrenceIndex - left.coOccurrenceIndex ||
      right.identities - left.identities,
    );
  const seenLabelPairs = new Set<string>();
  return candidates.filter((signal) => {
    const key = [normalize(signal.leftLabel), normalize(signal.rightLabel)].sort().join("\u0000");
    if (seenLabelPairs.has(key)) return false;
    seenLabelPairs.add(key);
    return true;
  });
};

const STOPWORDS = new Set([
  "a", "al", "de", "del", "e", "el", "en", "es", "la", "las", "lo", "los", "o", "y",
  "para", "desde", "hasta", "como", "este", "esta", "estos", "estas", "con", "sin", "una", "uno", "unos", "unas", "por", "que", "tus", "sus", "nuestro", "nuestra",
  "at", "by", "from", "in", "of", "on", "the", "to", "with", "and", "for", "you", "your", "our", "are", "more",
  "au", "aux", "du", "le", "la", "les", "des", "et", "pour", "une", "dans", "vos",
]);

const GENERIC_DOMAIN_PHRASES = new Set([
  "agencia de marketing",
  "marketing digital",
  "google ads",
  "facebook ads",
  "meta ads",
]);

const phrasesForText = (value: string) => {
  const tokens = normalize(value).split(" ").filter((token) => token.length >= 2 && !/^\d+$/.test(token));
  const phrases: string[] = [];
  for (const size of [2, 3]) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const slice = tokens.slice(index, index + size);
      if (STOPWORDS.has(slice[0]) || STOPWORDS.has(slice.at(-1)!)) continue;
      if (slice.every((token) => STOPWORDS.has(token))) continue;
      const phrase = slice.join(" ");
      if (phrase.length < 7 || phrase.length > 54) continue;
      if (GENERIC_DOMAIN_PHRASES.has(phrase)) continue;
      phrases.push(phrase);
    }
  }
  return unique(phrases);
};

export const buildPhraseSignals = <T,>(
  records: PatternObservation<T>[],
  reference: PatternObservation<T>[] = records,
) => {
  const trusted = records.filter((item) => item.semanticTrusted && item.phraseText.trim());
  const referenceTrusted = reference.filter((item) => item.semanticTrusted && item.phraseText.trim());
  const trustedPhrases = new Map(trusted.map((item) => [item.key, phrasesForText(item.phraseText)]));
  const referencePhrases = new Map(referenceTrusted.map((item) => [item.key, phrasesForText(item.phraseText)]));
  const groups = new Map<string, PatternObservation<T>[]>();
  for (const record of trusted) {
    for (const phrase of trustedPhrases.get(record.key) || []) {
      const current = groups.get(phrase) || [];
      current.push(record);
      groups.set(phrase, current);
    }
  }
  const candidates = [...groups.entries()].filter(([, observations]) =>
    unique(observations.map((item) => item.companyId)).length >= 3 &&
    unique(observations.map((item) => item.identityKey)).length >= 4,
  );
  return candidates.map(([phrase, observations]) => {
    const dimension = `phrase:${phrase}`;
    const displayLabel = `“${phrase}”`;
    const scoped = trusted.map((item) => ({
      ...item,
      evaluableDimensions: [...new Set([...(item.evaluableDimensions || []), dimension])],
      dimensions: { ...item.dimensions, [dimension]: (trustedPhrases.get(item.key) || []).includes(phrase) ? [displayLabel] : [] },
    }));
    const scopedReference = referenceTrusted.map((item) => ({
      ...item,
      evaluableDimensions: [...new Set([...(item.evaluableDimensions || []), dimension])],
      dimensions: { ...item.dimensions, [dimension]: (referencePhrases.get(item.key) || []).includes(phrase) ? [displayLabel] : [] },
    }));
    const scopedGroup = observations.map((item) => ({
      ...item,
      evaluableDimensions: [...new Set([...(item.evaluableDimensions || []), dimension])],
      dimensions: { ...item.dimensions, [dimension]: [displayLabel] },
    }));
    const signal = metricForGroup(
      `phrase:${phrase}`,
      displayLabel,
      dimension,
      scopedGroup,
      scoped,
      scopedReference,
    );
    return { ...signal, dimension: "phrase", phrase } satisfies PhraseSignal<T>;
  }).sort((left, right) =>
      right.companies - left.companies ||
      right.identities - left.identities ||
      right.evidenceScore - left.evidenceScore,
    );
};
