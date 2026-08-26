import type { AnuncioReal } from "./data-types";

export type AdSearchScope = "both" | "original" | "translation";
export type AdLanguageMode = "original" | "es" | "parallel";
export type AdSort = "relevance" | "company" | "confidence" | "newest";
export type AdEvidenceFacet = "file" | "source" | "external_id" | "pattern_eligible" | "pattern_excluded";

export type AdFilterState = {
  query: string;
  companies: string[];
  countries: string[];
  platforms: string[];
  languages: string[];
  translationStatuses: string[];
  ocrStatuses: string[];
  mediaTypes: string[];
  attributions: string[];
  evidence: AdEvidenceFacet[];
  searchScope: AdSearchScope;
  sort: AdSort;
};

export const EMPTY_AD_FILTERS: AdFilterState = {
  query: "",
  companies: [],
  countries: [],
  platforms: [],
  languages: [],
  translationStatuses: [],
  ocrStatuses: [],
  mediaTypes: [],
  attributions: [],
  evidence: [],
  searchScope: "both",
  sort: "relevance",
};

export const normalizeAdText = (value: unknown) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();

export const parseAdQuery = (query: string) => {
  const tokens = [];
  const pattern = /"([^"]+)"|(\S+)/g;
  for (const match of query.matchAll(pattern)) {
    const token = normalizeAdText(match[1] || match[2]);
    if (token) tokens.push(token);
  }
  return tokens;
};

const originalText = (ad: AnuncioReal) =>
  normalizeAdText([
    ad.name,
    ad.id,
    ad.country,
    ad.titular,
    ad.texto,
    ad.cta,
    ad.precioVisible,
    ad.angulo,
    ad.vertical,
    ad.plataforma,
    ad.platformFamily,
    ad.externalId,
    ad.origen,
    ad.estadoEvidencia,
    ad.atribucion,
  ].filter(Boolean).join(" "));

const translatedText = (ad: AnuncioReal) =>
  normalizeAdText([
    ad.traduccionEs?.titular,
    ad.traduccionEs?.texto,
    ad.traduccionEs?.cta,
    ad.traduccionEs?.precioVisible,
  ].filter(Boolean).join(" "));

export const adMatchesQuery = (
  ad: AnuncioReal,
  query: string,
  scope: AdSearchScope = "both",
) => {
  const terms = parseAdQuery(query);
  if (!terms.length) return true;
  const haystack = scope === "original"
    ? originalText(ad)
    : scope === "translation"
      ? translatedText(ad)
      : `${originalText(ad)} ${translatedText(ad)}`;
  return terms.every((term) => haystack.includes(term));
};

const selectedMatches = (selected: string[], value: string | null | undefined) =>
  !selected.length || selected.includes(String(value || "unknown"));

const evidenceMatches = (ad: AnuncioReal, selected: AdEvidenceFacet[]) => {
  if (!selected.length) return true;
  return selected.some((facet) => {
    if (facet === "file") return Boolean(ad.file);
    if (facet === "source") return Boolean(ad.fuenteUrl);
    if (facet === "external_id") return Boolean(ad.externalId);
    if (facet === "pattern_eligible") return ad.aptaPatrones !== false;
    return ad.aptaPatrones === false;
  });
};

export const adMatchesFilters = (ad: AnuncioReal, state: AdFilterState) =>
  adMatchesQuery(ad, state.query, state.searchScope) &&
  selectedMatches(state.companies, ad.id) &&
  selectedMatches(state.countries, ad.country) &&
  selectedMatches(state.platforms, ad.platformFamily) &&
  selectedMatches(state.languages, ad.idioma) &&
  selectedMatches(state.translationStatuses, ad.estadoTraduccion) &&
  selectedMatches(state.ocrStatuses, ad.estadoOcr) &&
  selectedMatches(state.mediaTypes, ad.mediaType) &&
  selectedMatches(state.attributions, ad.atribucion) &&
  evidenceMatches(ad, state.evidence);

export const filterAdRecords = (ads: AnuncioReal[], state: AdFilterState) =>
  ads.filter((ad) => adMatchesFilters(ad, state));

export const countActiveAdFilters = (state: AdFilterState) =>
  [
    state.companies,
    state.countries,
    state.platforms,
    state.languages,
    state.translationStatuses,
    state.ocrStatuses,
    state.mediaTypes,
    state.attributions,
    state.evidence,
  ].reduce((sum, values) => sum + values.length, state.query.trim() ? 1 : 0);
