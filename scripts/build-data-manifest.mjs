#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  companies: "public/data/companies-index.json",
  countries: "public/data/countries.json",
  summary: "public/data/summary.json",
  logos: "public/data/logos.json",
  corpus: "public/data/ad-corpus.json",
  coverage: "public/data/ad-coverage.json",
};
const raw = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [
    key,
    readFileSync(resolve(root, path), "utf8"),
  ]),
);
const data = Object.fromEntries(
  Object.entries(raw).map(([key, value]) => [key, JSON.parse(value)]),
);
const companies = data.companies;
const summary = data.summary;
const coverage = data.coverage;
const corpus = data.corpus;
const media = companies.reduce(
  (total, company) => total + (company.media?.length || 0),
  0,
);
const revision = createHash("sha256")
  .update(Object.keys(paths).sort().map((key) => raw[key]).join("\n"))
  .digest("hex")
  .slice(0, 16);

const output = {
  schema: "redvitalia-data-manifest-v1",
  generatedAt: new Date().toISOString().slice(0, 10),
  revision,
  universe: {
    companies: companies.length,
    representedPrimaryMarkets: new Set(
      companies.map((company) => company.primaryCountry),
    ).size,
    territorialAtlasStates: data.countries.length,
    media,
  },
  deepSnapshot: {
    companies: summary.companies,
    publicPrices: summary.publicPrices,
    sources: summary.sources,
    media: summary.media,
    status: summary.completion.status,
  },
  visualIdentitySnapshot: {
    entries: Object.keys(data.logos).length,
    authentic: summary.logos.authentic,
  },
  advertising: {
    companiesWithEvidence: coverage.summary.companiesWithEvidence,
    companiesPendingDiscovery:
      coverage.summary.statusCounts["pendiente/no atribuible"],
    exactCreativeIds:
      coverage.summary.exactMetaIds + coverage.summary.exactGoogleIds,
    attributableEvidenceSample: coverage.summary.sampledEvidence,
    searchableTranscriptions: coverage.summary.transcribedCanonical,
    verifiedTranscriptions: coverage.summary.verifiedTranscribed,
    patternReady: corpus.patternReady,
    textAvailabilityGap: coverage.summary.textAvailabilityGap,
    verifiedTranscriptionGap: coverage.summary.verifiedTranscriptionGap,
  },
  scopeNotes: [
    `El universo actual tiene ${companies.length} fichas; el snapshot profundo conserva ${summary.companies}.`,
    `Los ${data.countries.length} elementos territoriales son Estados del atlas, no mercados primarios con empresa.`,
    "Una transcripción OCR es buscable, pero no verificada ni apta para patrones hasta revisión humana.",
    "Frecuencia publicitaria y score editorial no demuestran rendimiento de campaña.",
  ],
};

writeFileSync(
  resolve(root, "public/data/data-manifest.json"),
  `${JSON.stringify(output, null, 1)}\n`,
  "utf8",
);
console.log(
  `data-manifest.json: revisión ${revision} · ${output.universe.companies} fichas · ${output.advertising.verifiedTranscriptions} transcripciones verificadas`,
);
