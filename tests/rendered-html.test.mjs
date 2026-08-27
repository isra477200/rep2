import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../", import.meta.url);
const json = async (path) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));

test("modal layers close through browser history without reopening stale records", async () => {
  const [portal, record] = await Promise.all([
    readFile(new URL("../app/Portal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/RecordDetail.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(portal, /rvModal: "company"/);
  assert.match(portal, /rvModal: "media"/);
  assert.match(portal, /window\.history\.state\?\.rvModal === "company"[\s\S]*?window\.history\.back\(\)/);
  assert.match(portal, /window\.history\.state\?\.rvModal === "media"[\s\S]*?window\.history\.back\(\)/);
  assert.match(record, /event\.preventDefault\(\)[\s\S]*?window\.history\.replaceState/);
});

test("the base snapshot stays coherent while live records and study archives own gallery coverage", async () => {
  const [companies, liveCompanies, countries, summary, audit, study, serpApiMedia, media] = await Promise.all([
    json("public/data/companies.json"),
    json("public/data/companies-index.json"),
    json("public/data/countries.json"),
    json("public/data/summary.json"),
    json("public/data/audit.json"),
    json("public/data/lead-market-snapshot.json"),
    json("public/data/serpapi-media-index.json"),
    readdir(new URL("public/media/", root)),
  ]);

  const declaredMedia = [
    ...liveCompanies.flatMap((company) =>
      company.media.map((item) => item.file.replace(/^\/media\//, "")),
    ),
    ...study.creativeIndex.map((item) => item.image.replace(/^\/media\//, "")),
    ...new Set(Object.values(serpApiMedia.items || {})
      .map((item) => String(item.file || "").replace(/^\/media\//, "").split("/")[0])
      .filter(Boolean)),
  ];
  assert.equal(companies.length, 712);
  assert.equal(countries.length, 195);
  assert.equal(media.length, new Set(declaredMedia).size);
  assert.deepEqual(
    new Set(media),
    new Set(declaredMedia),
  );
  assert.equal(summary.companies, 712);
  assert.equal(summary.countries, 195);
  assert.equal(summary.media, 3957);
  assert.equal(summary.mediaFailed, 5);
  assert.equal(summary.mediaFileTypeCorrections, 1796);
  assert.equal(summary.technicalArtifactsExcluded, 17);
  assert.equal(
    summary.sources,
    new Set(companies.flatMap((company) => company.sources)).size,
  );
  assert.equal(audit.failedCount, 5);
  assert.equal(
    summary.categories.reduce((sum, item) => sum + item.count, 0),
    712,
  );
  assert.equal(summary.completion.recordsInProgress, 0);
  assert.equal(summary.completion.motherlessRecords, 0);
  assert.equal(summary.completion.criticalEmptyUnexplained, 0);
  assert.equal(summary.completion.orphanMedia, 0);
  assert.equal(summary.completion.recordsWithoutPublicSource, 0);
  if (summary.completion.status === "TERMINADO") {
    assert.equal(summary.completion.residualPending, 0);
  } else {
    assert.equal(summary.completion.status, "AMPLIACIÓN FORENSE EN CURSO");
    assert.ok(summary.completion.residualPending > 0);
  }
});

test("every published media file has a truthful extension and readable payload", async () => {
  const companies = await json("public/data/companies-index.json");
  const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
  const referenced = companies.flatMap((company) => company.media);
  assert.equal(referenced.length, new Set(referenced.map((item) => item.file)).size);

  const detect = (buffer) => {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    )
      return "jpg";
    if (
      buffer.length >= 8 &&
      buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    )
      return "png";
    if (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    )
      return "webp";
    if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF")
      return "pdf";
    if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "GIF8")
      return "gif";
    if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
      const brand = buffer.toString("ascii", 8, 12).toLowerCase();
      return /^(?:heic|heix|hevc|hevx|mif1|msf1)$/u.test(brand) ? "heic" : "mp4";
    }
    const text = buffer.toString("utf8").trimStart();
    if (
      text.startsWith("<svg") ||
      (text.startsWith("<?xml") && text.includes("<svg"))
    )
      return "svg";
    return "unknown";
  };

  for (const item of referenced) {
    const diskPath = path.join(publicDir, item.file.replace(/^\//, ""));
    const buffer = await readFile(diskPath);
    const extension = path.extname(diskPath).slice(1).toLowerCase();
    assert.equal(detect(buffer), extension, item.file);
    assert.doesNotMatch(
      buffer.toString("utf8", 0, Math.min(buffer.length, 512)),
      /Identifier 'sh' has already been declared/,
      item.file,
    );
  }
});

test("every company is usable and contains no private Notion reference", async () => {
  const [companies, editorial] = await Promise.all([
    json("public/data/companies.json"),
    json("public/data/editorial.json"),
  ]);
  const forbidden =
    /app\.notion\.com|notion\.so|notion\.site|Puente IA|archivo técnico privado/i;

  assert.doesNotMatch(JSON.stringify({ companies, editorial }), forbidden);
  for (const company of companies) {
    assert.ok(company.id);
    assert.ok(company.name);
    assert.ok(company.primaryCountry);
    assert.ok(Array.isArray(company.countries));
    assert.ok(company.price?.label);
    assert.ok(company.media.every((item) => item.file.startsWith("/media/")));
    assert.ok(
      company.sources.every(
        (source) => /^https?:\/\//.test(source) && !forbidden.test(source),
      ),
    );
  }
});

test("country counts use the same company classification", async () => {
  const [companies, countries] = await Promise.all([
    json("public/data/companies.json"),
    json("public/data/countries.json"),
  ]);
  for (const country of countries) {
    assert.equal(
      country.count,
      companies.filter((company) => company.countries.includes(country.name))
        .length,
    );
  }
});

test("all 712 mother records expose the complete structured schema", async () => {
  const companies = await json("public/data/companies.json");
  const required = [
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
  for (const company of companies) {
    assert.deepEqual(
      required.filter((key) => !Object.hasOwn(company, key)),
      [],
      company.name,
    );
    assert.deepEqual(
      ["currency", "amount", "eur", "label"].filter(
        (key) => !Object.hasOwn(company.price, key),
      ),
      [],
      `${company.name} · price`,
    );
    assert.match(company.website, /^https?:\/\//, company.name);
  }
  assert.equal(
    companies.filter((company) => company.body.includes("<table")).length,
    345,
  );
  assert.equal(
    companies.filter((company) => /\[[^\]]+]\(https?:\/\//.test(company.body))
      .length,
    667,
  );
  assert.equal(
    companies.reduce((sum, company) => sum + company.mediaDeclared, 0),
    3979,
  );
  assert.equal(
    companies.reduce((sum, company) => sum + company.media.length, 0),
    3957,
  );
});

test("the geographic layer covers all canonical countries without inventing global points", async () => {
  const [companies, countries, geo] = await Promise.all([
    json("public/data/companies.json"),
    json("public/data/countries.json"),
    json("public/data/country-geo.json"),
  ]);
  assert.equal(geo.length, 195);
  assert.deepEqual(
    new Set(geo.map((country) => country.name)),
    new Set(countries.map((country) => country.name)),
  );
  assert.equal(new Set(geo.map((country) => country.code)).size, 195);
  for (const country of geo) {
    assert.ok(
      Number.isFinite(country.latitude) &&
        country.latitude >= -90 &&
        country.latitude <= 90,
      country.name,
    );
    assert.ok(
      Number.isFinite(country.longitude) &&
        country.longitude >= -180 &&
        country.longitude <= 180,
      country.name,
    );
    assert.equal(country.precision, "country_centroid");
    assert.match(country.locationLabel, /no indica la sede exacta/i);
  }
  assert.equal(
    companies.filter((company) => company.primaryCountry !== "Global").length,
    708,
  );
  assert.equal(
    companies.filter((company) => company.primaryCountry === "Global").length,
    4,
  );
});

test("brand assets are local, traceable and byte-verified", async () => {
  const [companies, logos, summary] = await Promise.all([
    json("public/data/companies-index.json"),
    json("public/data/logos.json"),
    json("public/data/summary.json"),
  ]);
  const values = Object.values(logos);
  const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
  assert.equal(Object.keys(logos).length, companies.length);
  assert.deepEqual(
    new Set(Object.keys(logos)),
    new Set(companies.map((company) => company.id)),
  );
  const authentic = values.filter((record) => record.file && record.status !== "fallback").length;
  assert.ok(authentic >= 615, "la ampliación no puede perder marcas verificadas del snapshot base");
  assert.equal(summary.logos.authentic, authentic);
  assert.equal(summary.logos.total, companies.length);
  assert.equal(summary.logos.hotlinked, 0);
  for (const record of values) {
    assert.doesNotMatch(
      JSON.stringify(record),
      /notion\.(?:so|site)|app\.notion\.com|Puente IA/i,
    );
    if (!record.file) {
      assert.equal(record.status, "fallback");
      assert.ok(record.reason);
      continue;
    }
    assert.match(
      record.file,
      /^\/logos\/[a-z0-9][a-z0-9-]{1,95}\/logo\.webp$/,
    );
    assert.match(record.source, /^https?:\/\//);
    const buffer = await readFile(
      path.join(publicDir, record.file.replace(/^\//, "")),
    );
    assert.equal(buffer.toString("ascii", 0, 4), "RIFF", record.file);
    assert.equal(buffer.toString("ascii", 8, 12), "WEBP", record.file);
    assert.equal(
      crypto.createHash("sha256").update(buffer).digest("hex"),
      record.sha256,
      record.file,
    );
    assert.equal(buffer.length, record.bytes, record.file);
  }
});

test("the shareable interface contains the full renderer, permanent links and social preview", async () => {
  const [portal, record, mapSource, og] = await Promise.all([
    readFile(new URL("../app/Portal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/RecordDetail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/WorldMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/og.png", import.meta.url)),
  ]);
  assert.match(portal, /searchParams\.set\("empresa"/);
  assert.match(portal, /source === "funnel" \? "evidence" : "media"/);
  assert.match(portal, /searchParams\.set\("vista"/);
  assert.match(portal, /aria-current=/);
  assert.match(portal, /<table aria-label="Comparación de empresas">/);
  assert.match(record, /ReactMarkdown/);
  assert.match(record, /remarkGfm/);
  assert.match(record, /Todo en una página|Por secciones/);
  assert.match(record, /42 campos|Todos los campos/);
  assert.match(mapSource, /setProjection\(\{ type: "mercator" \}\)/);
  assert.doesNotMatch(mapSource, /setProjection\(\{ type: "globe" \}\)/);
  assert.match(mapSource, /market-summary/);
  assert.match(mapSource, /hasPrecisePoint/);
  assert.match(mapSource, /easeTo/);
  assert.doesNotMatch(mapSource, /\.flyTo\(/);
  assert.match(mapSource, /scrollZoom: false/);
  assert.match(mapSource, /setWheelZoomRate\(1 \/ 600\)/);
  assert.match(mapSource, /setZoomRate\(1 \/ 120\)/);
  assert.match(mapSource, /\.panBy\(/);
  assert.doesNotMatch(mapSource, /center\.lng \+ longitudeDelta/);
  assert.match(mapSource, /companyZoom\(company\)/);
  assert.match(mapSource, /getClusterLeaves/);
  assert.match(mapSource, /distinct\.size <= 1/);
  assert.match(mapSource, /Abrir directorio/);
  assert.equal(og[0], 0x89);
  assert.equal(og.toString("ascii", 1, 4), "PNG");
});
