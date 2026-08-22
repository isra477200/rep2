import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const publicRoot = fileURLToPath(new URL("public/", root));
const imageExtension = /\.(?:jpe?g|png|webp|gif|svg)$/i;

async function inspectGalleryImages() {
  const companies = JSON.parse(
    await readFile(new URL("public/data/companies.json", root), "utf8"),
  );
  const queue = companies.flatMap((company) =>
    company.media
      .filter(
        (media) => media.type.includes("image") || imageExtension.test(media.file),
      )
      .map((media) => ({ companyId: company.id, company: company.name, ...media })),
  );
  const inspected = [];
  let cursor = 0;

  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (cursor < queue.length) {
        const row = queue[cursor++];
        const diskPath = path.join(
          publicRoot,
          row.file.replace(/^\//, ""),
        );
        const metadata = await sharp(diskPath).metadata();
        inspected.push({ ...row, width: metadata.width, height: metadata.height });
      }
    }),
  );

  return { companies, inspected };
}

test("las 151 imágenes menores de 200×200 px se conservan e identifican por dimensiones reales", async () => {
  const { companies, inspected } = await inspectGalleryImages();
  const lowResolution = inspected.filter(
    (row) =>
      Number.isFinite(row.width) &&
      Number.isFinite(row.height) &&
      row.width < 200 &&
      row.height < 200,
  );
  const thumbnailOrIcon = lowResolution.filter(
    (row) => Math.max(row.width, row.height) <= 96,
  );

  assert.equal(
    companies.reduce((total, company) => total + company.media.length, 0),
    3_957,
    "La solución no debe retirar ninguna evidencia disponible",
  );
  assert.equal(lowResolution.length, 151);
  assert.equal(new Set(lowResolution.map((row) => row.companyId)).size, 35);
  assert.equal(thumbnailOrIcon.length, 149);
  assert.equal(lowResolution.length - thumbnailOrIcon.length, 2);
});

test("galerías y visor aplican aviso, tamaño natural y enlace al original", async () => {
  const [resolution, portal, detail, types] = await Promise.all([
    readFile(new URL("app/MediaResolution.tsx", root), "utf8"),
    readFile(new URL("app/Portal.tsx", root), "utf8"),
    readFile(new URL("app/RecordDetail.tsx", root), "utf8"),
    readFile(new URL("app/data-types.ts", root), "utf8"),
  ]);

  assert.match(resolution, /LOW_RESOLUTION_BOUNDARY_PX = 200/);
  assert.match(
    resolution,
    /dimensions\.width < LOW_RESOLUTION_BOUNDARY_PX\s*&&\s*dimensions\.height < LOW_RESOLUTION_BOUNDARY_PX/,
  );
  assert.match(resolution, /Miniatura \/ icono/);
  assert.match(resolution, /Material de baja resolución/);
  assert.match(resolution, /Se muestra a tamaño original/);
  assert.match(resolution, /no\s+se fuerza una ampliación/);
  assert.match(resolution, /Abrir archivo original/);
  assert.match(resolution, /href=\{file\}/);
  assert.match(resolution, /width: resolution\.dimensions\.width/);
  assert.match(resolution, /height: resolution\.dimensions\.height/);

  for (const gallerySource of [portal, detail]) {
    assert.match(gallerySource, /measureImage\(event\.currentTarget\)/);
    assert.match(gallerySource, /MediaResolutionBadge/);
    assert.match(gallerySource, /imagePresentationStyle\(resolution, "tile"\)/);
    assert.match(gallerySource, /data-media-resolution=\{resolution\.kind\}/);
  }

  assert.match(portal, /MediaResolutionNotice/);
  assert.match(portal, /data-upscaled=/);
  assert.match(
    portal,
    /imagePresentationStyle\(lightboxResolution, "viewer"\)/,
  );
  assert.match(types, /width\?: number \| null/);
  assert.match(types, /height\?: number \| null/);
});
