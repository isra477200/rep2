export type Media = {
  file: string;
  type: string;
  bytes: number;
  order: number;
};
export type Price = {
  currency: string | null;
  amount: number | null;
  eur: number | null;
  label: string;
};

export type Company = {
  id: string;
  name: string;
  title: string;
  domain: string;
  website: string;
  country: string;
  primaryCountry: string;
  countries: string[];
  market: string;
  markets: string[];
  scope: string;
  agencyType: string;
  offer: string;
  priceLocal: string;
  priceStatus: string;
  price: Price;
  ticket: string;
  contract: string;
  guarantee: string;
  channels: string[];
  metaStatus: string;
  metaAds: number;
  googleStatus: string;
  googleAds: number;
  creativeArchive: number;
  score: number;
  threat: string;
  relation: string;
  decision: string;
  evidence: string;
  proof: string;
  team: string;
  cta: string;
  funnel: string;
  niche: string;
  legal: string;
  review: string;
  reviewedAt: string | null;
  sources: string[];
  body: string;
  media: Media[];
  mediaDeclared: number;
};

export type Country = {
  name: string;
  count: number;
  topScore: number;
  withPublicPrice: number;
  withMedia: number;
};
export type CountryGeo = {
  name: string;
  code: string;
  code3: string;
  latitude: number;
  longitude: number;
  region: string;
  subregion: string;
  flag: string;
  precision: "country_centroid";
  locationLabel: string;
  source: string;
};
export type LogoRecord = {
  file: string | null;
  status: "official" | "favicon" | "platform" | "fallback";
  source: string | null;
  sourceHost?: string | null;
  checkedAt: string;
  contentType?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  sha256?: string | null;
  confidence?: "high" | "medium" | "fallback";
  reason?: string | null;
};
export type LogoManifest = Record<string, LogoRecord>;

export type Summary = {
  companies: number;
  countries: number;
  media: number;
  mediaFailed: number;
  withMedia: number;
  technicalArtifactsExcluded: number;
  mediaFileTypeCorrections: number;
  publicPrices: number;
  priceCoveragePercent: number;
  sources: number;
  logos: {
    total: number;
    official: number;
    favicon: number;
    platform: number;
    authentic: number;
    fallback: number;
    coveragePercent: number;
    locallyStored: boolean;
    hotlinked: number;
    policy: string;
    checkedAt: string;
  };
  categories: { name: string; count: number }[];
  completion: {
    status: string;
    recordsInProgress: number;
    residualPending: number;
    motherlessRecords: number;
    criticalEmptyUnexplained: number;
    orphanMedia: number;
    availableEvidencePlaced: number;
    unavailableEvidenceDocumented: number;
    technicalArtifactsExcluded: number;
    recordsWithoutPublicSource: number;
    specialMarketRecords: number;
  };
  fx: { date: string; source: string; disclaimer: string };
};

export type Editorial = {
  blueprint: { title: string; body: string };
  report: { title: string; body: string };
  execution: { title: string; body: string };
};
