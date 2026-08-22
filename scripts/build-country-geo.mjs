import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import worldCountries from "world-countries";

const root = process.cwd();
const inputPath = path.join(root, "public", "data", "countries.json");
const outputPath = path.join(root, "public", "data", "country-geo.json");

const aliases = new Map([
  ["Arabia Saudita", "SA"],
  ["Bangladés", "BD"],
  ["Baréin", "BH"],
  ["Botsuana", "BW"],
  ["Esuatini", "SZ"],
  ["Kirguistán", "KG"],
  ["Lesoto", "LS"],
  ["Malaui", "MW"],
  ["Palaos", "PW"],
  ["Sierra Leona", "SL"],
  ["Yibuti", "DJ"],
]);

const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const byName = new Map();
const byCode = new Map(
  worldCountries.map((country) => [country.cca2, country]),
);

for (const country of worldCountries) {
  const names = [
    country.name.common,
    country.name.official,
    country.translations?.spa?.common,
    country.translations?.spa?.official,
    ...country.altSpellings,
  ];
  for (const name of names) {
    if (name) byName.set(normalize(name), country);
  }
}

const canonical = JSON.parse(await fs.readFile(inputPath, "utf8"));
const missing = [];
const result = canonical
  .map(({ name }) => {
    const country = aliases.has(name)
      ? byCode.get(aliases.get(name))
      : byName.get(normalize(name));

    if (
      !country ||
      !Array.isArray(country.latlng) ||
      country.latlng.length !== 2
    ) {
      missing.push(name);
      return null;
    }

    return {
      name,
      code: country.cca2,
      code3: country.cca3,
      latitude: country.latlng[0],
      longitude: country.latlng[1],
      region: country.region,
      subregion: country.subregion,
      flag: country.flag,
      precision: "country_centroid",
      locationLabel:
        "Punto representativo del país; no indica la sede exacta de la empresa",
      source: "world-countries 5.1.0 (datos derivados de REST Countries)",
    };
  })
  .filter(Boolean);

if (missing.length || result.length !== canonical.length) {
  throw new Error(`Cobertura geográfica incompleta: ${missing.join(", ")}`);
}

await fs.writeFile(outputPath, `${JSON.stringify(result)}\n`, "utf8");
console.log(
  JSON.stringify(
    { countries: result.length, missing: missing.length, outputPath },
    null,
    2,
  ),
);
