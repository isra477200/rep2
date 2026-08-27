import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { galleryMediaPosition, resolveGalleryMediaIndex } from "../app/media-deep-link.ts";

const root = new URL("../", import.meta.url);
const readJson = async (file) => JSON.parse(await readFile(new URL(file, root), "utf8"));

test("el índice compacto representa todo el archivo y agrupa duplicados exactos", async () => {
  const [companies, index] = await Promise.all([
    readJson("public/data/companies-index.json"),
    readJson("public/data/gallery-index.json"),
  ]);
  const media = companies.flatMap((company) => company.media.map((item) => ({ companyId: company.id, ...item })));
  const withinCompany = new Set(media.map((item) => `${item.companyId}|${index.items[item.file]?.h}`));

  assert.equal(index.schema, "redvitalia-gallery-index-v1");
  assert.equal(index.stats.companies, 285);
  assert.equal(index.stats.files, 5_206);
  assert.equal(Object.keys(index.items).length, media.length);
  assert.equal(index.stats.unique, 3_658);
  assert.equal(index.stats.duplicates, 1_548);
  assert.equal(withinCompany.size, 3_666, "la atribución a empresas debe conservarse cuando un contenido aparece en varias fichas");
  assert.equal(index.stats.withAdData, 2_670);
  assert.equal(index.stats.foreign, 738);
  assert.equal(index.stats.translated, 436);
  assert.equal(index.stats.patternReady, 1_272);
  assert.equal(Object.values(index.items).filter((item) => item.x).length, 2_670);
  assert.ok(media.every((item) => index.items[item.file]?.h?.length === 64));
});

test("el explorador limita el DOM, pagina y conserva la navegación en la URL", async () => {
  const [explorer, portal] = await Promise.all([
    readFile(new URL("app/GalleryExplorer.tsx", root), "utf8"),
    readFile(new URL("app/Portal.tsx", root), "utf8"),
  ]);

  assert.match(explorer, /const collectionPageSizes = \[12, 24\]/);
  assert.match(explorer, /const assetPageSizes = \[24, 36, 48\]/);
  assert.doesNotMatch(explorer, /\b72\b/);
  assert.match(explorer, /collections\.slice\(start, start \+ pageSize\)/);
  assert.match(explorer, /\.slice\(start, start \+ pageSize\)/);
  assert.match(explorer, /fetch\("\/data\/gallery-index\.json"/);
  assert.match(explorer, /metadata\?\.h \|\| item\.file/);
  assert.match(explorer, /searchParams\.set\("galeria", company\.id\)/);
  assert.match(explorer, /window\.addEventListener\("popstate", applyUrl\)/);
  assert.match(explorer, /preload="none"/);
  assert.match(explorer, /Idioma y traducción/);
  assert.match(explorer, /Aptas para buscar patrones/);
  assert.doesNotMatch(portal, /galleryLimit/);
  assert.doesNotMatch(portal, /function MediaRail/);
  assert.match(portal, /<GalleryExplorer/);
});

test("un enlace del visor resuelve la misma pieza aunque la cuadrícula esté deduplicada", async () => {
  const [companies, index] = await Promise.all([
    readJson("public/data/companies-index.json"),
    readJson("public/data/gallery-index.json"),
  ]);
  const company = companies.find((candidate) => {
    const hashes = candidate.media.map((media) => index.items[media.file]?.h);
    return hashes.some((hash, position) => hash && hashes.indexOf(hash) < position);
  });
  assert.ok(company, "se necesita una empresa con variantes exactas para la prueba");

  const seen = new Set();
  const uniqueCollection = company.media.filter((media) => {
    const hash = index.items[media.file]?.h || media.file;
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
  const selected = uniqueCollection.find((media, visibleIndex) =>
    company.media.findIndex((candidate) => candidate.file === media.file) !== visibleIndex,
  );
  assert.ok(selected, "la muestra debe incluir una pieza desplazada por una variante previa");

  const position = galleryMediaPosition(company.media, selected.file);
  const restoredIndex = resolveGalleryMediaIndex(company.media, String(position), selected.file);
  assert.equal(company.media[restoredIndex].file, selected.file);
  assert.notEqual(position - 1, uniqueCollection.indexOf(selected));
});
