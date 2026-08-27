import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const companiesUrl = new URL("../public/data/companies-index.json", import.meta.url);
const sourceUrl = new URL("../app/WorldMap.tsx", import.meta.url);

test("el mapa separa agregados de mercado y ubicaciones con precisión", async () => {
  const [companies, source] = await Promise.all([
    readFile(companiesUrl, "utf8").then(JSON.parse),
    readFile(sourceUrl, "utf8"),
  ]);
  const precise = companies.filter((company) =>
    company.location?.precision === "exacta_publicada" || company.location?.precision === "centro_ciudad",
  );
  const marketOnly = companies.filter((company) => !precise.includes(company));

  assert.ok(marketOnly.length > precise.length, "el catálogo exige una capa de mercado separada");
  assert.match(source, /buildMarketSummaries/);
  assert.match(source, /companies\.filter\(hasPrecisePoint\)/);
  assert.match(source, /id: "market-summary"|"market-summary"/);
  assert.doesNotMatch(source, /\bMarker\b/);
});

test("las coordenadas coincidentes abren un listado en vez de atascar el zoom", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /getClusterLeaves/);
  assert.match(source, /distinct\.size <= 1/);
  assert.match(source, /setClusterCompanyIds\(ids\)/);
  assert.match(source, /map\.getMaxZoom\(\) - 0\.2/);
  assert.doesNotMatch(source, /Math\.min\(expansionZoom, 7\.8\)/);
  assert.match(source, /Mostrar 120 más/);
});

test("la cámara usa distancias de pantalla y conserva una salida en el fallback", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /\.panBy\(\[x, y\]/);
  assert.match(source, /\.fitBounds\(/);
  assert.match(source, /scrollZoom\.enable\(\)/);
  assert.match(source, /doubleClickZoom: true/);
  assert.match(source, /maxZoom: 14/);
  assert.match(source, /location\?\.zoom/);
  assert.match(source, /Abrir directorio/);
});
