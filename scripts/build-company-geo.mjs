import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validCoordinates } from "./geo-location-utils.mjs";

const SOURCE = "research/deep/geo-audit/company-location-ready.json";
const COMPANIES = "public/data/companies.json";
const COUNTRY_GEO = "public/data/country-geo.json";
const OUTPUT = "public/data/company-locations.json";

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(url.hostname) || /\.notion\.site$/i.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

const forcedCountry = new Set([
  "wirsindhandwerk-wirsindhandwerk-gmbh",
  "motmizon",
  "www-daleli-sa",
  "www-homematch-sg-start-renovators",
  "png-online-com-ficha-de-cobertura-mundial-nueva-guinea-papua",
  "yellowpages-com-pg-ficha-de-cobertura-mundial-nueva-guinea-papua",
]);

const locationContexts = new Map([
  ["td-ai-y-marketing", { country: "Hungría", locality: "Debrecen, Hajdú-Bihar, Hungría" }],
  ["filipe-vilaca", { country: "Portugal", locality: "Penafiel, Portugal" }],
  ["clientium", { country: "Albania", locality: "Tirana, Albania" }],
  ["el-cielo-digital", { country: "Argentina", locality: "Buenos Aires, Argentina" }],
  ["zoreli", { country: "Armenia", locality: "Ereván, Armenia" }],
]);

const cityCorrections = new Map([
  ["namoa-marketing-namoa-marketing-s-l", {
    latitude: 43.3533452, longitude: -5.8795096, locality: "Oviedo, Asturias, España",
    evidenceUrl: "https://namoamarketing.com/aviso-legal/",
    coordinateSourceUrl: "https://www.openstreetmap.org/relation/346397",
  }],
  ["leads-for-plumbers", {
    latitude: 53.5227681, longitude: -1.1335312, locality: "Doncaster, Reino Unido",
    evidenceUrl: "https://leadsforplumbers.co.uk/contact-us/",
    coordinateSourceUrl: "https://www.openstreetmap.org/relation/106961",
  }],
]);

const exactCorrections = new Map([
  ["servicemarket", [25.073987, 55.143331]],
  ["fertilidad-marketing", [40.4858003, -3.6717518]],
  ["c-onnect", [41.3849598, 2.1634823]],
  ["mpdentales-marketing-medico-y-sanitario-s-l", [40.4864561, -3.6716313]],
  ["doctoralia-grupo-docplanner", [41.407985, 2.2184923]],
  ["ringover", [41.3992644, 2.2023029]],
  ["casy", [35.6338689, 139.7196472]],
]);

const safeCityLabels = new Map([
  ["ponteclick-mohamed-tissir-aghouchi", "Pontevedra, Galicia, España"],
  ["agencia-de-marketing-en-cantabria-tomas-gutierrez-colio", "Unquera, Cantabria, España"],
]);

const [source, companies, countryGeo] = await Promise.all([
  readFile(SOURCE, "utf8").then(JSON.parse),
  readFile(COMPANIES, "utf8").then(JSON.parse),
  readFile(COUNTRY_GEO, "utf8").then(JSON.parse),
]);
const countryByName = new Map(countryGeo.map((row) => [row.name, row]));
const sourceByPortalId = new Map(source.companies.map((row) => [row.portalId, row]));
if (sourceByPortalId.size !== 712 || companies.length !== 712) throw new Error(`Bijección incompleta: geo=${sourceByPortalId.size}, empresas=${companies.length}.`);
for (const company of companies) if (!sourceByPortalId.has(company.id)) throw new Error(`Empresa sin ubicación auditada: ${company.id}`);
for (const id of sourceByPortalId.keys()) if (!companies.some((company) => company.id === id)) throw new Error(`Ubicación sin ficha pública: ${id}`);

const locations = companies.map((company) => {
  const row = sourceByPortalId.get(company.id);
  let latitude = row.latitude;
  let longitude = row.longitude;
  let precision = row.coordinatePrecision === "exact_point_official" ? "exacta_publicada"
    : row.coordinatePrecision === "city_centroid" ? "centro_ciudad"
      : row.coordinatePrecision === "country_centroid" ? "centro_pais_mercado"
        : "sin_punto";
  let locality = safeCityLabels.get(company.id) || null;
  let evidenceUrl = safeUrl(row.evidenceUrl || company.website);
  let coordinateSourceUrl = safeUrl(row.coordinateSourceUrl);

  if (forcedCountry.has(company.id)) {
    const country = countryByName.get(company.primaryCountry) || countryByName.get(company.country) || countryByName.get(row.canonicalMarket);
    if (!country) throw new Error(`No se puede degradar ${company.id}: país sin centroide.`);
    latitude = country.latitude;
    longitude = country.longitude;
    precision = "centro_pais_mercado";
    locality = null;
    coordinateSourceUrl = null;
  }
  if (cityCorrections.has(company.id)) {
    const correction = cityCorrections.get(company.id);
    latitude = correction.latitude;
    longitude = correction.longitude;
    precision = "centro_ciudad";
    locality = correction.locality;
    evidenceUrl = correction.evidenceUrl;
    coordinateSourceUrl = correction.coordinateSourceUrl;
  }
  if (exactCorrections.has(company.id) && precision === "exacta_publicada") {
    [latitude, longitude] = exactCorrections.get(company.id);
  }
  const locationContext = locationContexts.get(company.id);
  if (locationContext?.locality) locality = locationContext.locality;
  if (precision === "sin_punto") {
    latitude = null;
    longitude = null;
  }
  if (precision !== "sin_punto" && !validCoordinates(latitude, longitude)) throw new Error(`Coordenada inválida en ${company.id}: ${latitude},${longitude}`);

  const commercialMarket = company.primaryCountry || company.country || row.canonicalMarket || "mercado no determinado";
  const locationCountry = locationContext?.country || commercialMarket;
  const marketDistinction = locationCountry !== commercialMarket ? ` Mercado comercial principal documentado: ${commercialMarket}.` : "";
  const locationLabel = precision === "exacta_publicada"
    ? `${locality || locationCountry}. Punto publicado por la empresa; no confirma sede central.${marketDistinction}`
    : precision === "centro_ciudad"
      ? `${locality || `Ubicación a nivel de ciudad en ${locationCountry}`}. Centro de ciudad derivado; no es el edificio ni la sede.${marketDistinction}`
      : precision === "centro_pais_mercado"
        ? `${locationCountry}: centro de país o mercado; no es sede.`
        : "Operación global o ubicación no verificable; no se inventa un punto.";
  return {
    companyId: company.id,
    latitude,
    longitude,
    precision,
    locationLabel,
    locality,
    canonicalMarket: locationCountry,
    commercialMarket,
    locationCountry,
    pointRepresents: precision === "centro_pais_mercado" ? "mercado o país canónico" : precision === "sin_punto" ? "sin punto asignado" : "ubicación corporativa publicada",
    headquartersVerified: false,
    sourceUrl: evidenceUrl,
    coordinateSourceUrl,
    limitation: precision === "exacta_publicada"
      ? `La coordenada aparece en una fuente oficial, pero no demuestra sede central, propiedad ni uso operativo del lugar.${marketDistinction}`
      : precision === "centro_ciudad"
        ? `El punto representa el centro de una ciudad derivada de evidencia oficial, no una dirección exacta ni una sede.${marketDistinction}`
        : precision === "centro_pais_mercado"
          ? "El punto representa el país o mercado asociado a la ficha, no la ubicación de la empresa."
          : "No existe un punto único verificable y no se asigna uno artificialmente.",
    zoom: precision === "exacta_publicada" ? 13.5 : precision === "centro_ciudad" ? 10.2 : precision === "centro_pais_mercado" ? 4.2 : null,
    reviewedAt: "2026-08-22",
  };
});

const counts = locations.reduce((summary, row) => {
  summary[row.precision] = (summary[row.precision] || 0) + 1;
  return summary;
}, {});
const expected = { exacta_publicada: 67, centro_ciudad: 107, centro_pais_mercado: 535, sin_punto: 3 };
for (const [key, count] of Object.entries(expected)) if (counts[key] !== count) throw new Error(`Conteo ${key}: ${counts[key]} en vez de ${count}.`);
if (locations.some((row) => row.headquartersVerified)) throw new Error("No se permite afirmar sede central con la evidencia actual.");

const output = {
  format: "rv-public-company-locations-v1",
  generatedAt: new Date().toISOString(),
  summary: { total: locations.length, withPoint: locations.filter((row) => row.latitude !== null).length, ...counts, headquartersVerified: 0 },
  policy: "Distingue punto publicado, centro de ciudad, centro de país/mercado y ausencia de punto. Ninguno se presenta como sede central.",
  locations,
};
const locationById = new Map(locations.map((row) => [row.companyId, row]));
const enrichedCompanies = companies.map((company) => ({ ...company, location: locationById.get(company.id) }));
await Promise.all([writeJsonAtomic(OUTPUT, output), writeJsonAtomic(COMPANIES, enrichedCompanies)]);
console.log(JSON.stringify(output.summary, null, 2));
