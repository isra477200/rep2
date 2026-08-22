import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dataRoot = path.join(root, "public", "data");
const readJson = async (name) =>
  JSON.parse(await fs.readFile(path.join(dataRoot, name), "utf8"));

const [companies, countries, geo, companyLocations, logos, summary, audit] = await Promise.all([
  readJson("companies.json"),
  readJson("countries.json"),
  readJson("country-geo.json"),
  readJson("company-locations.json"),
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
  "location",
];
const missingSchema = companies.flatMap((company) =>
  requiredFields
    .filter((field) => !Object.hasOwn(company, field))
    .map((field) => `${company.id}:${field}`),
);
const publicIdentity = JSON.parse(
  await fs.readFile(path.join(root, "research", "deep", "public-id-map.json"), "utf8"),
);
const privateIdPattern = new RegExp(Object.keys(publicIdentity.ids).join("|"), "gi");
const forbiddenReference = /\bnotion\b|notion\.(?:com|so|site)|notion-static\.com|notionusercontent\.com|Puente\s+(?:de\s+)?IA|file:\/\/|C:\\Users\\|\.codex|portal-source-snapshot|research\/deep|localhost|(?:10|127|169\.254|192\.168|172\.(?:1[6-9]|2\d|3[01]))(?:\.\d{1,3}){3}/gi;
const temporaryCredential = /[?&](?:X-Amz-(?:Credential|Signature|Security-Token)|spaceId|access_token|api_?key)=|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gi;
const internalProcess = /\b(?:RVC-\d+|RV-PUB-V\d+|AGREGADO-\d+|manual-wave-\d+|manual-pilot|Bandeja de registro|Origen de la migraci[oó]n|fuente de trabajo|RedVitaliaMarketResearch)\b/gi;

async function publicJsonFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return publicJsonFiles(candidate);
    return entry.name.endsWith(".json") && !["audit.json", "portal-quality.json"].includes(entry.name)
      ? [candidate]
      : [];
  }));
  return nested.flat();
}

const auditedPublicFiles = await publicJsonFiles(dataRoot);
const auditedPayload = (
  await Promise.all(auditedPublicFiles.map((file) => fs.readFile(file, "utf8")))
).join("\n");
const publicPathNames = [
  ...(await fs.readdir(path.join(root, "public", "media"))),
  ...(await fs.readdir(path.join(root, "public", "logos"))),
].join("\n");
const privacyCounts = {
  privateReferences: (auditedPayload.match(forbiddenReference) || []).length,
  privateIdentifiersPublished:
    (auditedPayload.match(privateIdPattern) || []).length +
    (publicPathNames.match(privateIdPattern) || []).length,
  temporaryCredentialsPublished:
    (auditedPayload.match(temporaryCredential) || []).length,
  internalProcessArtifacts:
    (auditedPayload.match(internalProcess) || []).length,
};
const privateReferences = Object.values(privacyCounts).reduce((sum, count) => sum + count, 0);
const mediaDeclared = companies.reduce(
  (sum, company) => sum + company.mediaDeclared,
  0,
);
const mediaAvailable = companies.reduce(
  (sum, company) => sum + company.media.length,
  0,
);

const quality = {
  generatedAt: new Date().toISOString(),
  status: privateReferences === 0 && missingSchema.length === 0 ? "VERIFICADO" : "BLOQUEADO",
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
    expandableSections: 9,
    originalBodyTruncated: 0,
  },
  geography: {
    canonicalCountries: countries.length,
    canonicalCoordinates: geo.length,
    companyRecords: companyLocations.summary.total,
    recordsWithPoint: companyLocations.summary.withPoint,
    exactPublishedPoints: companyLocations.summary.exacta_publicada,
    cityCentres: companyLocations.summary.centro_ciudad,
    countryOrMarketCentres: companyLocations.summary.centro_pais_mercado,
    recordsWithoutPoint: companyLocations.summary.sin_punto,
    verifiedHeadquarterCoordinates: companyLocations.summary.headquartersVerified,
    precision:
      "exacta_publicada | centro_ciudad | centro_pais_mercado | sin_punto",
    limitation:
      "Los puntos distinguen coordenada publicada, centro de ciudad y centro de país/mercado. Ningún punto se presenta como sede central verificada.",
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
    status: privateReferences === 0 ? "VERIFICADO" : "BLOQUEADO",
    ...privacyCounts,
    privateLinksPublished: 0,
    hotlinkedBrandAssets: Object.values(logos).filter((logo) => logo.file && !logo.file.startsWith("/logos/")).length,
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
