import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ROOT = resolve(ROOT, "public");
const MANIFEST_DIR = resolve(PUBLIC_ROOT, "data", "site-captures");
const EVIDENCE_ROOT = `${resolve(PUBLIC_ROOT, "evidence")}${sep}`;
const EXPECTED_NO_URL = new Set([
  "build-scale",
  "conecta-y-vende",
  "confymagency",
  "destaca-local",
  "emprorent",
  "gea-agency",
  "grovia",
  "hablemos-de-negocios",
  "igrowth",
  "indigo-marketing-ads",
  "inkspire-ads",
  "ivelor",
  "javi-alba-bano",
  "localboost-criterian",
  "lur-digital-media",
  "manel-agency",
  "mapridigital",
  "metrian",
  "ryt-school",
]);
const COMMERCIAL_FIELDS = [
  "headline",
  "promise",
  "audience",
  "offer",
  "mechanism",
  "primaryCta",
  "proof",
  "price",
  "guarantee",
  "funnel",
];
const PAGE_ROLES = new Set([
  "homepage",
  "landing",
  "conversion",
  "pricing",
  "proof",
]);
const PAGE_STATUSES = new Set(["pending", "captured", "blocked", "failed"]);

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assertSafeUrl(value, label) {
  assert.equal(typeof value, "string", `${label}: falta URL`);
  const parsed = new URL(value);
  assert.ok(
    ["http:", "https:"].includes(parsed.protocol),
    `${label}: protocolo no permitido`,
  );
  assert.equal(parsed.username, "", `${label}: la URL incluye usuario`);
  assert.equal(parsed.password, "", `${label}: la URL incluye contraseña`);
}

function publicAssetPath(value, label) {
  assert.match(
    value,
    /^\/evidence\//,
    `${label}: el archivo debe ser público y estar bajo /evidence/`,
  );
  const absolute = resolve(PUBLIC_ROOT, value.slice(1).replaceAll("/", sep));
  assert.ok(
    absolute.startsWith(EVIDENCE_ROOT),
    `${label}: ruta fuera del directorio público de evidencia`,
  );
  return absolute;
}

async function assertAsset(asset, label) {
  assert.ok(asset && typeof asset === "object", `${label}: metadatos ausentes`);
  assert.equal(typeof asset.file, "string", `${label}: file inválido`);
  assert.ok(
    ["image/webp", "image/png", "image/jpeg"].includes(asset.type),
    `${label}: tipo inválido`,
  );
  assert.ok(
    Number.isInteger(asset.width) && asset.width > 0,
    `${label}: anchura inválida`,
  );
  assert.ok(
    Number.isInteger(asset.height) && asset.height > 0,
    `${label}: altura inválida`,
  );
  assert.ok(
    Number.isInteger(asset.bytes) && asset.bytes > 0,
    `${label}: bytes inválidos`,
  );
  assert.match(asset.sha256, /^[a-f0-9]{64}$/, `${label}: SHA-256 inválido`);

  const absolute = publicAssetPath(asset.file, label);
  const info = await stat(absolute);
  assert.ok(info.isFile(), `${label}: el archivo público no existe`);
  assert.equal(
    asset.bytes,
    info.size,
    `${label}: bytes no coincide con el archivo`,
  );
  const digest = createHash("sha256")
    .update(await readFile(absolute))
    .digest("hex");
  assert.equal(
    asset.sha256,
    digest,
    `${label}: SHA-256 no coincide con el archivo`,
  );

  const metadata = await sharp(absolute, {
    limitInputPixels: false,
  }).metadata();
  assert.equal(
    asset.width,
    metadata.width,
    `${label}: anchura no coincide con la imagen`,
  );
  assert.equal(
    asset.height,
    metadata.height,
    `${label}: altura no coincide con la imagen`,
  );
  const expectedExtensions = {
    "image/webp": new Set([".webp"]),
    "image/png": new Set([".png"]),
    "image/jpeg": new Set([".jpg", ".jpeg"]),
  };
  assert.ok(
    expectedExtensions[asset.type].has(extname(absolute).toLowerCase()),
    `${label}: extensión y tipo no coinciden`,
  );
  return asset;
}

function assertCommercialRead(value, label, partial = false) {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    `${label}: lectura comercial inválida`,
  );
  if (!partial)
    assert.deepEqual(
      Object.keys(value),
      COMMERCIAL_FIELDS,
      `${label}: campos inesperados`,
    );
  for (const [key, field] of Object.entries(value)) {
    assert.ok(
      COMMERCIAL_FIELDS.includes(key),
      `${label}: campo desconocido ${key}`,
    );
    if (["mechanism", "funnel"].includes(key)) {
      assert.ok(Array.isArray(field), `${label}.${key}: debe ser una lista`);
      assert.ok(
        field.every((item) => typeof item === "string" && item.trim()),
        `${label}.${key}: valor inválido`,
      );
    } else {
      assert.ok(
        field === null || typeof field === "string",
        `${label}.${key}: debe ser texto o null`,
      );
    }
  }
}

test("los manifiestos de capturas conservan el universo y soportan progreso", async () => {
  const names = (await readdir(MANIFEST_DIR))
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .sort();
  const [captureIndex, companies] = await Promise.all([
    json(resolve(MANIFEST_DIR, "index.json")),
    json(resolve(PUBLIC_ROOT, "data", "companies-index.json")),
  ]);
  assert.equal(
    names.length,
    captureIndex.stats.records,
    "el índice de capturas debe contar todos sus manifiestos",
  );

  const manifests = await Promise.all(
    names.map((name) => json(resolve(MANIFEST_DIR, name))),
  );
  assert.equal(
    new Set(manifests.map((record) => record.id)).size,
    names.length,
    "los IDs deben ser únicos",
  );
  const manifestIds = new Set(manifests.map((record) => record.id));
  for (const company of companies.filter((row) => ["España", "Francia"].includes(row.primaryCountry))) {
    assert.ok(manifestIds.has(company.id), `falta manifiesto España/Francia: ${company.id}`);
  }
  const noUrl = new Set(
    manifests
      .filter((record) => record.status === "no_url")
      .map((record) => record.id),
  );
  assert.deepEqual(noUrl, EXPECTED_NO_URL, "el conjunto no_url ha cambiado");

  let pageCount = 0;
  for (const record of manifests) {
    const label = record.id || "manifiesto sin id";
    assert.equal(
      record.schemaVersion,
      "rv-site-captures-v1",
      `${label}: schemaVersion inválido`,
    );
    assert.equal(
      `${record.id}.json`,
      names.find((name) => name === `${record.id}.json`),
      `${label}: nombre de archivo incoherente`,
    );
    assert.ok(
      typeof record.name === "string" && record.name.trim(),
      `${label}: nombre ausente`,
    );
    assert.ok(
      typeof record.primaryCountry === "string" && record.primaryCountry.trim(),
      `${label}: país ausente`,
    );
    assert.ok(
      Array.isArray(record.markets) && record.markets.length,
      `${label}: mercados ausentes`,
    );
    assert.ok(
      record.language && typeof record.language === "object",
      `${label}: idioma ausente`,
    );
    assert.ok(
      record.language.original === null ||
        typeof record.language.original === "string",
      `${label}: idioma original inválido`,
    );
    assertCommercialRead(record.commercialRead, `${label}.commercialRead`);
    assert.ok(
      Array.isArray(record.pages),
      `${label}: pages debe ser una lista`,
    );
    pageCount += record.pages.length;

    const pageIds = new Set();
    const pageUrls = new Set();
    for (const page of record.pages) {
      const pageLabel = `${label}/${page.id || "sin-id"}`;
      assert.ok(
        typeof page.id === "string" && page.id.trim(),
        `${pageLabel}: id ausente`,
      );
      assert.ok(!pageIds.has(page.id), `${pageLabel}: id duplicado`);
      pageIds.add(page.id);
      assert.ok(PAGE_ROLES.has(page.role), `${pageLabel}: rol inválido`);
      assertSafeUrl(page.requestedUrl, `${pageLabel}.requestedUrl`);
      assert.ok(
        !pageUrls.has(page.requestedUrl),
        `${pageLabel}: URL duplicada en la ficha`,
      );
      pageUrls.add(page.requestedUrl);
      assert.ok(
        PAGE_STATUSES.has(page.status),
        `${pageLabel}: estado inválido`,
      );

      if (page.status === "captured") {
        assert.equal(
          page.fullPage,
          true,
          `${pageLabel}: la captura debe ser de página completa`,
        );
        assertSafeUrl(page.finalUrl, `${pageLabel}.finalUrl`);
        assert.ok(
          Number.isFinite(Date.parse(page.capturedAt)),
          `${pageLabel}: capturedAt inválido`,
        );
        const image = await assertAsset(page.image, `${pageLabel}.image`);
        const thumbnail = await assertAsset(
          page.thumbnail,
          `${pageLabel}.thumbnail`,
        );
        assert.notEqual(
          image.file,
          thumbnail.file,
          `${pageLabel}: imagen y miniatura deben ser distintas`,
        );
        assert.ok(
          thumbnail.width <= image.width,
          `${pageLabel}: miniatura más ancha que la captura`,
        );
        assert.ok(
          thumbnail.height <= image.height,
          `${pageLabel}: miniatura más alta que la captura`,
        );
      }
      if (["blocked", "failed"].includes(page.status)) {
        assert.ok(
          typeof page.issue === "string" && page.issue.trim(),
          `${pageLabel}: falta motivo del bloqueo/fallo`,
        );
      }
    }

    const captured = record.pages.filter(
      (page) => page.status === "captured",
    ).length;
    const blocked = record.pages.filter(
      (page) => page.status === "blocked",
    ).length;
    const failed = record.pages.filter(
      (page) => page.status === "failed",
    ).length;
    assert.equal(
      record.coverage?.planned,
      record.pages.length,
      `${label}: coverage.planned incoherente`,
    );
    assert.equal(
      record.coverage?.captured,
      captured,
      `${label}: coverage.captured incoherente`,
    );
    assert.equal(
      record.coverage?.failed,
      failed,
      `${label}: coverage.failed incoherente`,
    );
    if ("blocked" in record.coverage)
      assert.equal(
        record.coverage.blocked,
        blocked,
        `${label}: coverage.blocked incoherente`,
      );

    if (EXPECTED_NO_URL.has(record.id)) {
      assert.equal(
        record.website,
        null,
        `${label}: no_url debe conservar website=null`,
      );
      assert.equal(
        record.pages.length,
        0,
        `${label}: no_url no debe planificar páginas`,
      );
      assert.equal(record.status, "no_url", `${label}: estado no_url perdido`);
    } else {
      assertSafeUrl(record.website, `${label}.website`);
      const expectedStatus =
        captured === record.pages.length && record.pages.length
          ? "complete"
          : captured || blocked
            ? "partial"
            : failed === record.pages.length && record.pages.length
              ? "failed"
              : "pending";
      assert.equal(
        record.status,
        expectedStatus,
        `${label}: estado agregado incoherente`,
      );
    }
  }
  assert.equal(
    pageCount,
    captureIndex.stats.pages,
    "el plan y el índice deben contar las mismas páginas deduplicadas",
  );
});

test("las fichas francesas separan el original y el resumen español", async () => {
  const names = (await readdir(MANIFEST_DIR)).filter(
    (name) => name.endsWith(".json") && name !== "index.json",
  );
  const manifests = await Promise.all(
    names.map((name) => json(resolve(MANIFEST_DIR, name))),
  );
  const french = manifests.filter((record) =>
    record.markets.includes("Francia"),
  );
  assert.equal(
    french.length,
    26,
    "deben mantenerse las 26 fichas que tocan Francia",
  );

  const translated = french.filter(
    (record) =>
      record.language.translationStatus === "spanish_summary_available",
  );
  assert.equal(
    translated.length,
    25,
    "toda ficha con original no español debe conservar un resumen separado",
  );
  const frenchOriginalWithoutSummary = french
    .filter(
      (record) =>
        record.language.original === "fr" &&
        record.language.translationStatus !== "spanish_summary_available",
    )
    .map((record) => record.id)
    .sort();
  assert.deepEqual(
    frenchOriginalWithoutSummary,
    [],
    "queda una ficha francesa sin resumen español separado",
  );
  assert.deepEqual(
    french
      .filter((record) => record.language.translationStatus === "not_needed")
      .map((record) => record.id)
      .sort(),
    ["companeo"],
    "solo la lectura comercial ya estructurada en español debe marcarse como not_needed",
  );
  for (const record of french) {
    const label = record.id;
    assertCommercialRead(record.commercialRead, `${label}.commercialRead`);
    if (record.language.translationStatus === "spanish_summary_available") {
      assert.notEqual(
        record.language.original,
        "es",
        `${label}: una traducción separada requiere original no español`,
      );
      assert.ok(
        record.translation && typeof record.translation === "object",
        `${label}: falta el bloque translation`,
      );
      assert.equal(
        record.translation.sourceLanguage,
        record.language.original,
        `${label}: sourceLanguage incoherente`,
      );
      assert.equal(
        record.translation.status,
        "existing_spanish_summary",
        `${label}: estado de traducción inválido`,
      );
      assertCommercialRead(
        record.translation.spanish,
        `${label}.translation.spanish`,
        true,
      );
      const hasSpanishContent = Object.values(record.translation.spanish).some(
        (value) =>
          Array.isArray(value)
            ? value.length > 0
            : typeof value === "string" && value.trim(),
      );
      assert.ok(
        hasSpanishContent,
        `${label}: el resumen español separado está vacío`,
      );
    } else {
      assert.ok(
        ["not_available", "not_needed"].includes(
          record.language.translationStatus,
        ),
        `${label}: estado de traducción inválido`,
      );
      assert.equal(
        record.translation,
        undefined,
        `${label}: no debe inventarse traducción`,
      );
    }
  }
});
