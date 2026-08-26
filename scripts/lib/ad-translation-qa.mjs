import { francAll } from "franc-min";

const BARE_DOMAIN_TLDS = [
  "ai", "app", "at", "au", "be", "bg", "biz", "br", "ca", "ch", "cl",
  "cn", "co", "com", "cz", "de", "dev", "digital", "dk", "ee", "es", "eu", "fi",
  "fr", "gr", "hr", "hu", "id", "ie", "il", "in", "info", "io", "it",
  "jp", "kr", "lt", "lv", "me", "mx", "my", "net", "nl", "no", "nz", "online",
  "org", "pe", "pl", "pro", "pt", "ro", "rs", "ru", "sa", "se", "shop",
  "si", "site", "sk", "store", "tech", "th", "tr", "tv", "uk", "us",
  "vn", "website", "xyz", "za",
];

const tldSource = `(?:${[...BARE_DOMAIN_TLDS].sort((a, b) => b.length - a.length).join("|")})`;
const bareDomainSource = `(?:[a-z0-9-]+[.])+(?:${tldSource})(?:[/][^\\s]*)?`;
// Un TLD cerrado evita falsos dominios como `c.mon`, pero no debe romper un
// dominio real nuevo. `www.*` y los hosts con subdominio son inequívocos y se
// protegen aunque el TLD no figure todavía en la lista conservadora.
const prefixedDomainSource = `(?:www[.](?:[a-z][a-z0-9-]*[.])+[a-z]{2,63}|(?:[a-z][a-z0-9-]*[.]){2,}[a-z]{2,63})(?:[/][^\\s]*)?`;
// Algunos OCR pierden el punto anterior al TLD (`www.yourmystarjp/`). El
// prefijo www. y la barra final siguen haciendo inequívoca la intención URL.
const ocrWwwDomainSource = `www[.][a-z][a-z0-9-]{4,}(?:[/][^\\s]*)`;
const domainSource = `(?:${bareDomainSource}|${prefixedDomainSource}|${ocrWwwDomainSource})`;
const currencyUnitSource =
  "(?:€|EUR(?:OS?)?|USD|US[$]|[$]|GBP|£|AED|د[.]?إ|KRW|원|JPY|¥|円|万|CNY|RMB|元|TRY|TL|₺|PLN|ZŁ|IDR|RP|ILS|₪|THB|฿)";

export const PROTECTED_PATTERN_SOURCE = [
  "https?:[/][/]\\S+",
  "[\\w.+-]+@[\\w.-]+[.]\\w+",
  "(?:CR)?\\d{8,}",
  `[+-]?\\s*(?:(?:${currencyUnitSource})\\s?\\d[\\d.,]*|\\d[\\d.,]*\\s?(?:${currencyUnitSource}|%))`,
  "(?:[+]?\\d[\\d ()-]{7,}\\d)",
  domainSource,
  "[+-]?\\d[\\d.,]*",
].join("|");

export const protectedPattern = (flags = "giu") =>
  new RegExp(PROTECTED_PATTERN_SOURCE, flags);

export const protectedLiterals = (value) =>
  String(value || "").match(protectedPattern()) || [];

export const literalKey = (value) => {
  const literal = String(value || "").trim().toLocaleLowerCase("es");
  if (/^https?:|@/i.test(literal) || new RegExp(`^${domainSource}$`, "iu").test(literal)) {
    return literal.replace(/[),.;:]+$/, "");
  }
  const sign = /^-/.test(literal) ? "-" : /^\+/.test(literal) ? "+" : "";
  const digits = literal.replace(/\D/g, "");
  const unit = literal.includes("%")
    ? "%"
    : literal.match(new RegExp(currencyUnitSource, "iu"))?.[0]?.toLocaleLowerCase("es") || "";
  return `${sign}:${digits}:${unit}`;
};

export const literalCounts = (value) => {
  const counts = new Map();
  for (const literal of protectedLiterals(value)) {
    const key = literalKey(literal);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
};

export const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeWords = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripProtectedTerms = (value, protectedTerms = []) => {
  let output = String(value || "").replace(protectedPattern(), " ");
  for (const term of [...protectedTerms].sort((a, b) => b.length - a.length)) {
    if (String(term || "").trim().length < 2) continue;
    output = output.replace(new RegExp(escapeRegExp(term), "giu"), " ");
  }
  return output;
};

const SPANISH_TARGET_WORDS = new Set([
  "agenda", "ahora", "alicante", "analisis", "ayuda", "bano", "buscamos", "centros", "clientes", "clinica", "clinicas",
  "como", "con", "consigue", "consultas", "contacto", "contactos", "cuesta", "de", "del", "dental",
  "desde", "descubre", "el", "empresa", "en", "entre", "equipo", "es", "esta",
  "empresas", "entra", "fisioterapia", "gratis", "hablamos", "hasta", "implantes", "la", "las", "llena", "lo", "los",
  "mas", "medible", "medico", "mejor", "negocio", "obtiene", "operario", "ortodoncia", "paciente",
  "pacientes", "pagas", "para", "por", "primer", "puede", "que", "real", "reformas", "resultados", "salud", "sanitario",
  "servicios", "sin", "sobreimpreso", "solicita", "somos", "su", "sus", "te", "texto", "titular", "todo", "trabajando", "tu", "tus",
  "una", "unico", "uno", "usted", "ventas", "vertical", "video", "y", "zona",
]);

const SOURCE_RESIDUE_WORDS = {
  en: [
    "and", "bid", "boards", "boost", "break", "business", "bypass", "calling", "careers", "cleaning",
    "all", "browse", "car", "company", "contact", "credit", "customers", "details", "download",
    "exclusive", "expert", "follow", "free", "generation", "get", "guaranteed", "install", "janitorial",
    "house", "learn", "leads", "live", "local", "low", "make", "market", "meetings", "more", "normal",
    "now", "our", "permanent", "pipeline", "pros", "quality", "quote", "range", "rate", "sales", "see",
    "services", "star", "started", "the", "today", "up", "us", "wash", "watch", "we", "with", "world",
    "your", "youtube",
  ],
  it: [
    "aziende", "clienti", "commercialista", "confronta", "della", "delle", "ditta",
    "edile", "fuoriclasse", "gratuiti", "imprese", "miglior", "ottieni",
    "preventivi", "professionisti", "richiedi", "scopri", "senza", "sito",
    "sponsorizzato", "trova", "tua", "tuo",
  ],
  fr: [
    "antoine", "avec", "beautile", "besoin", "clients", "decouvrez", "des", "devis",
    "economise", "entreprise", "essayez", "faites", "gratuit", "maintenant", "meilleur",
    "nous", "obtenez", "postule", "pour", "presse", "recrute", "sans", "services", "vivez",
    "votre", "vos", "vous",
  ],
  de: [
    "angebot", "das", "der", "die", "fur", "ihre", "ihr", "jetzt", "kostenlos",
    "kunden", "mehr", "mit", "sie", "unternehmen", "unverbindlich", "und", "wir",
  ],
  pt: [
    "agora", "encontre", "mais", "melhores", "negocio", "nao", "obtenha", "orcamento",
    "seu", "sem", "servicos", "sua", "uma", "voce",
  ],
  nl: [
    "aanvragen", "bedrijf", "beste", "jouw", "klanten", "meer", "met",
    "controle", "eenvoudig", "fouten", "gebruik", "horecazaak", "kassasysteem", "klaar",
    "minder", "offerte", "onder", "overzicht", "tijdens", "voor", "werkt", "wilt", "zoals",
  ],
  tr: [
    "icin", "isletme", "musteri", "simdi", "ucretsiz", "ve", "yeni", "ile",
  ],
  da: ["bedste", "din", "flere", "kunder", "med", "til", "virksomhed"],
  pl: ["bezplatnie", "dla", "firmy", "klientow", "oferty", "teraz", "wiecej"],
  id: ["anda", "bisnis", "dengan", "lebih", "pelanggan", "untuk"],
  vi: ["ban", "doanh", "hang", "khach", "mien", "nghiep", "nhieu", "phi"],
};

const STRONG_RESIDUE_WORDS = new Set([
  "antoine", "architecte", "beautile", "business", "bypass", "calling", "chantier", "cieco",
  "company", "confronta", "decouvrez", "della", "devis", "edile", "electrien", "essayez",
  "expert", "meileur", "obtenez", "obtenha", "ottieni", "pipeline", "planning", "presse",
  "preventivi", "pros", "sponsorizzato", "watch",
]);

const STRONG_RESIDUE_PHRASES = {
  en: [
    /\bget\s+(?:quote|rate)\b/iu,
    /\bfree\s+credit\b/iu,
    /\bcar\s+wash\s+service\b/iu,
    /\bsales\s+meetings\b/iu,
    /\bsee\s+details\b/iu,
    /\bdownload\s+now\b/iu,
    /\bbrowse\s+all\b/iu,
  ],
  fr: [/\bessayez(?:\s+gratuitement)?\b/iu],
};

const UNIVERSAL_RESIDUE_PATTERNS = [
  /\bappels?\s+(?:d|de)\s+offres?\b/iu,
  /\barchitecte\b/iu,
  /\bchantiers?\b/iu,
  /\bdein\s+permanent\s+make\s+up\b/iu,
  /\bden(?:tista|ista)\s+cieco\b/iu,
  /\bdescubierta?\s+el\s+libro\b/iu,
  /\belectrien\b/iu,
  /\beconomise\s+en\s+vos\b/iu,
  /\bempresa\s+edile\b/iu,
  /\bexclusive\s+local\b/iu,
  /\bfollow\s+us\s+now\b/iu,
  /\bmeileur\b/iu,
  /\bmentale?\s+da\b/iu,
  /\bhouse\s+cleaning\s+normal\s+range\b/iu,
  /\bpreventivos?\s+della\b/iu,
  /\bprofessional\b/iu,
  /\b(?:recrute|reprute)\b/iu,
  /\bsiga\s+a\s+us\s+now\b/iu,
];

export const sourceResidueTerms = (
  value,
  sourceLanguage,
  protectedTerms = [],
  original = "",
) => {
  const translatedTokens = new Set(
    normalizeWords(stripProtectedTerms(value, protectedTerms)).split(" ").filter(Boolean),
  );
  const dictionaries = [];
  if (SOURCE_RESIDUE_WORDS[sourceLanguage])
    dictionaries.push(SOURCE_RESIDUE_WORDS[sourceLanguage]);
  if (sourceLanguage !== "en" && original) {
    const originalTokens = new Set(normalizeWords(original).split(" ").filter(Boolean));
    dictionaries.push(SOURCE_RESIDUE_WORDS.en.filter((word) => originalTokens.has(word)));
  }
  return [...new Set(dictionaries.flat().filter((word) => translatedTokens.has(word)))];
};

export const sourceResidueProblem = (
  value,
  sourceLanguage,
  protectedTerms = [],
  original = "",
) => {
  const terms = sourceResidueTerms(value, sourceLanguage, protectedTerms, original);
  const comparable = normalizeWords(stripProtectedTerms(value, protectedTerms));
  const strongPhrase = (STRONG_RESIDUE_PHRASES[sourceLanguage] || [])
    .some((pattern) => pattern.test(comparable));
  const universalResidue = UNIVERSAL_RESIDUE_PATTERNS
    .some((pattern) => pattern.test(comparable));
  return universalResidue || strongPhrase || terms.length >= 2 || terms.some((term) => STRONG_RESIDUE_WORDS.has(term));
};

const SOURCE_LANGUAGE_SIGNALS = {
  es: [
    "ahora", "alicante", "analisis", "bano", "buscamos", "centros", "clientes",
    "clinicas", "consultas", "cuesta", "desde", "empresas", "entra", "hablamos",
    "hasta", "hemos", "llena", "medible", "negocio", "operario", "ortodoncia",
    "pacientes", "pagas", "para", "primer", "puede", "reformas", "salud", "sanitario",
    "sin", "sobreimpreso", "solicita", "trabajando", "tus", "unico", "usted", "zona",
  ],
  ...SOURCE_RESIDUE_WORDS,
  pt: [
    ...SOURCE_RESIDUE_WORDS.pt,
    "chame", "compromisso", "custos", "encontre", "faca", "grafico", "pedido",
    "pouco", "profissionais", "propostas", "receba", "tempo",
  ],
  it: [
    ...SOURCE_RESIDUE_WORDS.it,
    "attivita", "automatico", "autonomi", "carburante", "carta", "centesimi", "completa",
    "costi", "distributore", "fare", "fino", "gestione", "gratuita", "idonee", "inclusa",
    "installando", "installazione", "italiane", "lavoratori", "liberi", "litro", "molte",
    "nostra", "ottimizzare", "pochi", "professionale", "professionisti", "rifornimento",
    "riservata", "risparmiare", "semplificare", "servizio", "soluzione", "spese", "stanno",
    "tutti", "utilizzate", "vantaggi", "veicoli", "verifica", "vostri",
  ],
  nl: [
    ...SOURCE_RESIDUE_WORDS.nl,
    "controle", "eenvoudig", "fouten", "gebruik", "horecazaak", "kassasysteem", "klaar",
    "minder", "onder", "overzicht", "tijdens", "werkt", "wilt", "zoals",
  ],
};

export const sourceLanguageMismatch = (
  value,
  declaredLanguage,
  protectedTerms = [],
) => {
  const comparable = normalizeWords(stripProtectedTerms(value, protectedTerms));
  const words = comparable.split(" ").filter((word) => word.length >= 2);
  if (words.length < 6 || comparable.length < 35) return null;
  const tokens = new Set(words);
  const scores = Object.entries(SOURCE_LANGUAGE_SIGNALS)
    .map(([language, signals]) => [
      language,
      new Set(signals.filter((word) => tokens.has(word))).size,
    ])
    .sort((left, right) => right[1] - left[1]);
  const [bestLanguage, bestScore = 0] = scores[0] || [];
  const declaredScore = scores.find(([language]) => language === declaredLanguage)?.[1] || 0;
  if (
    bestLanguage &&
    bestLanguage !== declaredLanguage &&
    bestScore >= 4 &&
    bestScore - declaredScore >= 3
  ) return bestLanguage;
  return null;
};

export const unexpectedSourceScriptProblem = (value, protectedTerms = []) => {
  const text = stripProtectedTerms(value, protectedTerms);
  const unexpected = text.match(
    /[\u0400-\u052f\u0590-\u08ff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g,
  ) || [];
  return unexpected.length >= 2;
};

export const targetLanguageProblem = (value, protectedTerms = []) => {
  if (unexpectedSourceScriptProblem(value, protectedTerms)) return true;
  const text = stripProtectedTerms(value, protectedTerms)
    .normalize("NFKC")
    .replace(/[^\p{L}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const comparable = normalizeWords(text);
  const words = comparable.split(" ").filter((word) => word.length >= 2);
  if (words.length < 4 || comparable.length < 20) return false;
  const spanishSignals = new Set(words.filter((word) => SPANISH_TARGET_WORDS.has(word))).size;
  const ranked = francAll(words.join(" "), { minLength: 18 });
  const [topLanguage, topScore = 0] = ranked[0] || [];
  if (topLanguage === "spa" && spanishSignals >= 1) return false;
  const spanishScore = ranked.find(([language]) => language === "spa")?.[1] || 0;
  return spanishSignals < 2 || !spanishScore || topScore - spanishScore >= 0.1;
};

const GENERIC_BRAND_WORDS = new Set([
  "agency", "azienda", "business", "calling", "careers", "cleaning", "company",
  "contact", "digital", "expert", "free", "generation", "global", "group", "lead",
  "leads", "learn", "marketing", "market", "media", "more", "network", "online",
  "quality", "sales", "service", "services", "solutions", "srl", "spa", "studio", "the",
  "therapist", "watch", "world",
]);

const KNOWN_ENTITY_TERMS = [
  "Abstrakt MG",
  "B&G Store",
  "Max Calore",
  "Ego Rocco",
  "Prime Advenir",
  "Il Dentista Cieco",
  "YouTube",
  "TikTok Shop",
  "Turkcell",
  "Koçtaş",
  "Esnafım",
  "IKEA",
  "Gree",
  "Airy",
  "Alfred",
  "Jess",
  "EDF",
  "HVAC",
  "SDR",
  "SEO",
  "LLM",
  "GEO",
  "RPA",
  "POS",
  "5G",
  "くらしのマーケット",
  "エッジコネクション",
  "アイランド・ブレイン",
  "ユアマイスター",
  "숨고",
  "미소",
];

const companyBase = (item) =>
  String(item.observedName || item.name || "")
    .split(/\s+[—·|]\s+/)[0]
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();

const domainRoots = (value) => {
  const roots = [];
  for (const literal of protectedLiterals(value)) {
    const host = literal
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .replace(/[),.;:]+$/, "");
    const labels = host.split(".").filter(Boolean);
    if (labels.length < 2) continue;
    const root = labels.at(-2);
    if (root && root.length >= 4 && !GENERIC_BRAND_WORDS.has(normalizeWords(root))) roots.push(root);
  }
  return roots;
};

export const brandTermsFor = (item) => {
  const original = [item?.titular, item?.texto, item?.cta].filter(Boolean).join("\n");
  const base = companyBase(item);
  const candidates = [];
  if (base) candidates.push(base);
  for (const token of base.match(/[\p{L}\p{N}][\p{L}\p{N}.-]{2,}/gu) || []) {
    const comparable = normalizeWords(token.replace(/[.].*$/, ""));
    const isAcronym = /^[\p{Lu}\p{N}]{2,5}$/u.test(token.replace(/[.]$/, ""));
    if (
      (comparable.length >= 4 && !GENERIC_BRAND_WORDS.has(comparable)) ||
      isAcronym
    ) candidates.push(token.replace(/[.]$/, ""));
  }
  const baseAcronyms = (base.match(/[\p{L}\p{N}]{2,5}/gu) || [])
    .filter((token) => /^[\p{Lu}\p{N}]{2,5}$/u.test(token));
  const acronymKey = (value) =>
    normalizeWords(value)
      .replace(/1|l|!/g, "i")
      .replace(/@|€/g, "e")
      .replace(/[^a-z0-9]/g, "");
  const oneEditApart = (left, right) => {
    if (left === right) return true;
    if (Math.abs(left.length - right.length) > 1) return false;
    let leftIndex = 0;
    let rightIndex = 0;
    let edits = 0;
    while (leftIndex < left.length && rightIndex < right.length) {
      if (left[leftIndex] === right[rightIndex]) {
        leftIndex += 1;
        rightIndex += 1;
        continue;
      }
      edits += 1;
      if (edits > 1) return false;
      if (left.length > right.length) leftIndex += 1;
      else if (right.length > left.length) rightIndex += 1;
      else {
        leftIndex += 1;
        rightIndex += 1;
      }
    }
    return edits + Number(leftIndex < left.length || rightIndex < right.length) <= 1;
  };
  if (baseAcronyms.length) {
    const sourceTokens = original.match(/[\p{L}\p{N}@€!|\]]{2,9}/gu) || [];
    for (const sourceToken of sourceTokens) {
      const sourceKey = acronymKey(sourceToken);
      if (
        baseAcronyms.some((baseAcronym) => {
          const baseKey = acronymKey(baseAcronym);
          return (
            oneEditApart(sourceKey, baseKey) ||
            oneEditApart(sourceKey, `by${baseKey}`) ||
            oneEditApart(sourceKey, `${baseKey}by`)
          );
        })
      ) candidates.push(sourceToken);
    }
  }
  candidates.push(...domainRoots(original));
  const collapsedOriginal = original
    .normalize("NFKC")
    .replace(/[\s・･]+/gu, "")
    .toLocaleLowerCase("es");
  for (const term of KNOWN_ENTITY_TERMS) {
    const collapsedTerm = term
      .normalize("NFKC")
      .replace(/[\s・･]+/gu, "")
      .toLocaleLowerCase("es");
    if (
      new RegExp(escapeRegExp(term), "iu").test(original) ||
      (collapsedTerm.length >= 3 && collapsedOriginal.includes(collapsedTerm))
    ) candidates.push(term);
  }
  candidates.push("ROI", "B2B", "B2C");
  const unique = new Map();
  for (const candidate of candidates) {
    const term = String(candidate || "").trim();
    if (term.length < 2) continue;
    const key = normalizeWords(term);
    if (!key || unique.has(key)) continue;
    const collapsedTerm = term
      .normalize("NFKC")
      .replace(/[\s・･]+/gu, "")
      .toLocaleLowerCase("es");
    if (
      new RegExp(escapeRegExp(term), "iu").test(original) ||
      (collapsedTerm.length >= 3 && collapsedOriginal.includes(collapsedTerm)) ||
      /^(?:ROI|B2B|B2C)$/.test(term)
    ) unique.set(key, term);
  }
  return [...unique.values()].sort((a, b) => b.length - a.length);
};

export const missingBrandTerms = (original, translated, protectedTerms = []) => {
  const originalComparable = normalizeWords(original);
  const translatedComparable = normalizeWords(translated);
  return protectedTerms.filter((term) => {
    const nonLatin = /[^\p{Script=Latin}\p{N}&.+\-\s]/u.test(term);
    if (nonLatin) {
      const exactPattern = new RegExp(escapeRegExp(term), "gu");
      const originalExactCount = [...String(original).matchAll(exactPattern)].length;
      exactPattern.lastIndex = 0;
      const translatedExactCount = [...String(translated).matchAll(exactPattern)].length;
      return originalExactCount > 0 && translatedExactCount !== originalExactCount;
    }
    const exactCase = /^[\p{Lu}\p{N}&.+-]{2,8}$/u.test(term);
    if (exactCase) {
      const exactPattern = new RegExp(escapeRegExp(term), "gu");
      const originalExactCount = [...String(original).matchAll(exactPattern)].length;
      exactPattern.lastIndex = 0;
      const translatedExactCount = [...String(translated).matchAll(exactPattern)].length;
      if (originalExactCount > 0 && translatedExactCount !== originalExactCount)
        return true;
    }
    const comparable = normalizeWords(term);
    if (!comparable) return false;
    const phrasePattern = escapeRegExp(comparable).replace(/\\ /g, "\\s+");
    const pattern = new RegExp(`(?:^|\\s)${phrasePattern}(?=\\s|$)`, "g");
    const originalCount = [...originalComparable.matchAll(pattern)].length;
    pattern.lastIndex = 0;
    const translatedCount = [...translatedComparable.matchAll(pattern)].length;
    return originalCount > 0 && translatedCount !== originalCount;
  });
};
