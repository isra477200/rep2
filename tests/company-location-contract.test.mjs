import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseGoogleMapsCoordinates, validCoordinates } from "../scripts/geo-location-utils.mjs";

const companies = JSON.parse(await readFile("public/data/companies.json", "utf8"));
const data = JSON.parse(await readFile("public/data/company-locations.json", "utf8"));
const byId = new Map(data.locations.map((row) => [row.companyId, row]));

test("las 712 fichas tienen una ubicación pública inequívoca y biyectiva", () => {
  assert.equal(companies.length, 712);
  assert.equal(data.locations.length, 712);
  assert.equal(byId.size, 712);
  assert.deepEqual(new Set(companies.map((row) => row.id)), new Set(byId.keys()));
  for (const company of companies) assert.deepEqual(company.location, byId.get(company.id));
});

test("la precisión y los conteos conservadores son exactos", () => {
  const counts = data.locations.reduce((summary, row) => (summary[row.precision] = (summary[row.precision] || 0) + 1, summary), {});
  assert.deepEqual(counts, { centro_pais_mercado: 535, exacta_publicada: 67, centro_ciudad: 107, sin_punto: 3 });
  assert.equal(data.locations.filter((row) => row.latitude !== null).length, 709);
  assert.equal(data.locations.filter((row) => row.headquartersVerified).length, 0);
});

test("coordenadas, URLs y etiquetas no prometen una sede", () => {
  for (const row of data.locations) {
    if (row.precision === "sin_punto") assert.equal(row.latitude, null);
    else assert.ok(validCoordinates(row.latitude, row.longitude), row.companyId);
    assert.equal(typeof row.headquartersVerified, "boolean");
    assert.match(row.locationLabel, /no (?:confirma sede central|es (?:el edificio ni )?la sede|es sede|se inventa un punto)/i);
    for (const url of [row.sourceUrl, row.coordinateSourceUrl].filter(Boolean)) {
      const parsed = new URL(url);
      assert.match(parsed.protocol, /^https?:$/);
      assert.equal(parsed.username, "");
      assert.doesNotMatch(parsed.hostname, /notion|localhost/i);
    }
  }
});

test("los falsos puntos y los casos sensibles quedan degradados", () => {
  for (const id of ["wirsindhandwerk-wirsindhandwerk-gmbh", "motmizon", "www-daleli-sa", "www-homematch-sg-start-renovators"]) assert.equal(byId.get(id).precision, "centro_pais_mercado");
  assert.equal(byId.get("namoa-marketing-namoa-marketing-s-l").precision, "centro_ciudad");
  assert.equal(byId.get("leads-for-plumbers").precision, "centro_ciudad");
  for (const id of ["ponteclick-mohamed-tissir-aghouchi", "agencia-de-marketing-en-cantabria-tomas-gutierrez-colio"]) {
    assert.doesNotMatch(byId.get(id).locationLabel, /\b\d{1,5}\b|calle|avenida|av\.|portal|piso/i);
  }
});

test("Papúa Nueva Guinea no se confunde con Guinea", async () => {
  const countries = JSON.parse(await readFile("public/data/countries.json", "utf8"));
  const countryByName = new Map(countries.map((row) => [row.name, row]));
  for (const id of [
    "png-online-com-ficha-de-cobertura-mundial-nueva-guinea-papua",
    "yellowpages-com-pg-ficha-de-cobertura-mundial-nueva-guinea-papua",
  ]) {
    const company = companies.find((row) => row.id === id);
    const location = byId.get(id);
    assert.equal(company.country, "Papúa Nueva Guinea");
    assert.equal(company.primaryCountry, "Papúa Nueva Guinea");
    assert.deepEqual(company.countries, ["Papúa Nueva Guinea"]);
    assert.equal(location.latitude, -6);
    assert.equal(location.longitude, 147);
    assert.equal(location.precision, "centro_pais_mercado");
    assert.equal(location.canonicalMarket, "Papúa Nueva Guinea");
  }
  assert.equal(countryByName.get("Papúa Nueva Guinea").count, 2);
  assert.equal(countryByName.get("Papúa Nueva Guinea").withPublicPrice, 1);
  for (const id of ["empresasguinea-com", "guineaecuatorial360-com"]) {
    const company = companies.find((row) => row.id === id);
    assert.deepEqual(company.countries, ["Guinea Ecuatorial"]);
  }
  assert.equal(countryByName.get("Guinea").count, 1);
});

test("los puntos corporativos transfronterizos distinguen ubicación y mercado", () => {
  const expectations = new Map([
    ["td-ai-y-marketing", ["Hungría", "Mauricio"]],
    ["filipe-vilaca", ["Portugal", "Portugal"]],
    ["clientium", ["Albania", "Italia"]],
    ["el-cielo-digital", ["Argentina", "España"]],
    ["zoreli", ["Armenia", "Armenia"]],
  ]);
  for (const [id, [locationCountry, commercialMarket]] of expectations) {
    const location = byId.get(id);
    assert.equal(location.locationCountry, locationCountry);
    assert.equal(location.canonicalMarket, locationCountry);
    assert.equal(location.commercialMarket, commercialMarket);
    assert.match(location.locationLabel, new RegExp(locationCountry, "i"));
    assert.doesNotMatch(location.locationLabel, new RegExp(`en ${commercialMarket}\\b`, "i"));
  }
});

test("el parser prefiere el destino y rechaza rangos de portal", () => {
  assert.equal(parseGoogleMapsCoordinates("https://maps.google.com/?q=22-28%20Wood%20Street"), null);
  assert.deepEqual(parseGoogleMapsCoordinates("https://maps.google.com/@25.0,55.0,12z/data=!3d25.073987!4d55.143331"), { latitude: 25.073987, longitude: 55.143331, source: "destination_3d_4d" });
  assert.deepEqual(parseGoogleMapsCoordinates("https://maps.google.com/?q=40.4,-3.7"), { latitude: 40.4, longitude: -3.7, source: "query_q" });
});
