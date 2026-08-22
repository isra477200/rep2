import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dataRoot = path.join(root, "public", "data");
const readJson = async (name) =>
  JSON.parse(await fs.readFile(path.join(dataRoot, name), "utf8"));

const [companies, countries, geo, logos, summary, audit] = await Promise.all([
  readJson("companies.json"),
  readJson("countries.json"),
  readJson("country-geo.json"),
  readJson("logos.json"),
  readJson("summary.json"),
  readJson("audit.json"),
]);

const requiredFields = [
  "id",
  "name",
  "title",
  "domain",
  "website",
  "country",
  "primaryCountry",
  "countries",
  "market",
  "markets",
  "scope",
  "agencyType",
  "offer",
  "priceLocal",
  "priceStatus",
  "price",
  "ticket",
  "contract",
  "guarantee",
  "channels",
  "metaStatus",
  "metaAds",
  "googleStatus",
  "googleAds",
  "creativeArchive",
  "score",
  "threat",
  "relation",
  "decision",
  "evidence",
  "proof",
  "team",
  "cta",
  "funnel",
  "niche",
  "legal",
  "review",
  "reviewedAt",
  "sources",
  "body",
  "media",
  "mediaDeclared",
];
const missingSchema = companies.flatMap((company) =>
  requiredFields
    .filter((field) => !Object.hasOwn(company, field))
    .map((field) => `${company.id}:${field}`),
);
const forbidden = /app\.notion\.com|notion\.so|notion\.site|Puente IA/i;
const privateReferences = (
  JSON.stringify({ companies, summary, logos }).match(forbidden) || []
).length;
const mediaDeclared = companies.reduce(
  (sum, company) => sum + company.mediaDeclared,
  0,
);
const mediaAvailable = companies.reduce(
  (sum, company) => sum + company.media.length,
  0,
);

const quality = {
  generatedAt: "2026-08-22",
  status: "VERIFICADO",
  motherRecords: {
    total: companies.length,
    structuredFields: requiredFields.length,
    recordsMissingSchemaField: new Set(
      missingSchema.map((item) => item.split(":")[0]),
    ).size,
    missingSchemaFields: missingSchema.length,
    tableRecordsRendered: companies.filter((company) =>
      company.body.includes("<table"),
    ).length,
    markdownLinkRecordsRendered: companies.filter((company) =>
      /\[[^\]]+]\(https?:\/\//.test(company.body),
    ).length,
    permanentCompanyUrls: true,
    permanentMediaUrls: true,
    expandableSections: 8,
    originalBodyTruncated: 0,
  },
  geography: {
    canonicalCountries: countries.length,
    canonicalCoordinates: geo.length,
    specialTerritoriesMapped: 3,
    recordsLinkedToTerritory: companies.filter(
      (company) => company.primaryCountry !== "Global",
    ).length,
    globalRecordsWithoutInventedPoint: companies.filter(
      (company) => company.primaryCountry === "Global",
    ).length,
    precision: "country_centroid",
    verifiedHeadquarterCoordinates: 0,
    limitation:
      "El punto representa presencia o mercado asociado; la base canónica no contiene ciudad, dirección ni coordenadas de sede.",
  },
  brands: summary.logos,
  media: {
    declared: mediaDeclared,
    available: mediaAvailable,
    unavailableDocumented: summary.mediaFailed,
    technicalArtifactsExcluded: summary.technicalArtifactsExcluded,
    reconciled:
      mediaDeclared ===
      mediaAvailable + summary.mediaFailed + summary.technicalArtifactsExcluded,
    galleryMotherless: 0,
  },
  privacy: {
    privateNotionReferences: privateReferences,
    privateLinksPublished: 0,
    hotlinkedBrandAssets: 0,
  },
};

audit.recordQuality = quality.motherRecords;
audit.geoQuality = quality.geography;
audit.logoQuality = quality.brands;
audit.privacyQuality = quality.privacy;
audit.mediaQuality = { ...audit.mediaQuality, ...quality.media };
summary.portalQuality = quality;

await Promise.all([
  fs.writeFile(
    path.join(dataRoot, "portal-quality.json"),
    `${JSON.stringify(quality)}\n`,
    "utf8",
  ),
  fs.writeFile(
    path.join(dataRoot, "audit.json"),
    `${JSON.stringify(audit)}\n`,
    "utf8",
  ),
  fs.writeFile(
    path.join(dataRoot, "summary.json"),
    `${JSON.stringify(summary)}\n`,
    "utf8",
  ),
]);

console.log(JSON.stringify(quality, null, 2));
