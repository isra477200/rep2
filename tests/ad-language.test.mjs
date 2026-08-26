import assert from "node:assert/strict";
/* eslint-disable no-control-regex */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  brandTermsFor,
  literalCounts,
  missingBrandTerms,
  sourceLanguageMismatch,
  sourceResidueProblem,
  sourceResidueTerms,
  targetLanguageProblem,
  unexpectedSourceScriptProblem,
} from "../scripts/lib/ad-translation-qa.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
const corpus = readJson("public/data/ad-corpus.json");
const translations = readJson("public/data/ad-translations-es.json");
const quarantine = readJson("scripts/data/ad-translation-quarantine-v22.json");
const TRANSLATION_RECIPE_VERSION = "rv-mt-es-v22";
const AUTOMATIC_REVIEW_LANGUAGES = new Set([
  "ar", "he", "id", "ja", "ko", "th", "zh",
]);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[\u2066-\u2069]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const sourceHash = (item) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        titular: normalizeText(item.titular),
        texto: normalizeText(item.texto),
        cta: normalizeText(item.cta),
        precioVisible: normalizeText(item.precioVisible),
      }),
    )
    .digest("hex");

test("el idioma y el hash describen siempre el copy original", () => {
  assert.equal(corpus.schema, "redvitalia-ad-corpus-v2");
  for (const item of corpus.items) {
    assert.equal(item.sourceCopySha256, sourceHash(item), item.corpusKey);
    assert(item.country && item.platformFamily && item.mediaType);
    if (!item.copyAvailable) {
      assert.equal(item.idioma, "und");
      assert.equal(item.estadoTraduccion, "no_aplica");
    } else {
      assert(item.idioma && item.idiomaNombre);
    }
  }
});

test("la detección resiste slogans cortos, OCR ruidoso y mercados internacionales", () => {
  const fixtures = new Map([
    ["027e6b0a0332", "en"],
    ["04107ad03249", "en"],
    ["12e9a6965651", "en"],
    ["45952174da0b", "es"],
    ["926c3601fa14", "tr"],
    ["302cc1cfc785", "nl"],
    ["3293cc22757e", "it"],
    ["47945f3a3316", "fr"],
    ["c10b9ac7dcbb", "es"],
    ["cf8767fe0ca8", "es"],
    ["1bed32d252c3", "en"],
    ["c71158f6446f", "mul"],
    ["028151513bfd", "es"],
    ["1b670a0e6305", "pt"],
    ["147cc7e0d6cc", "nl"],
    ["303999c0ab14", "it"],
    ["62b78dd3bbfc", "it"],
    ["51eacbae133c", "it"],
    ["16ae6a2486b", "ja"],
    ["95fc78e46ceb", "ja"],
    ["cc5f35cd44f", "ja"],
    ["6319d695cfbc", "es"],
    ["d481b8d949fe", "es"],
    ["12271941c4e2", "it"],
    ["20f09eccdb96", "it"],
    ["acd15f465966", "it"],
  ]);
  for (const [prefix, expected] of fixtures) {
    const item = corpus.items.find((row) => row.sourceCopySha256.startsWith(prefix));
    assert(item, `Falta fixture ${prefix}`);
    assert.equal(item.idioma, expected, `${prefix}: ${item.titular}`);
  }
  for (const prefix of ["16a0b3d6fdb2"]) {
    const item = corpus.items.find((row) => row.sourceCopySha256.startsWith(prefix));
    if (item) assert.equal(item.idioma, "und", `${prefix}: OCR ruidoso`);
  }
});

test("cada traducción publicada enlaza hash e idioma activos", () => {
  assert.equal(translations.schema, "redvitalia-ad-translations-es-v1");
  assert.equal(translations.recipeVersion, TRANSLATION_RECIPE_VERSION);
  assert.equal(translations.total, translations.items.length);
  const active = new Map(
    corpus.items
      .filter((item) => item.copyAvailable)
      .map((item) => [item.sourceCopySha256, item.idioma]),
  );
  const hashes = new Set();
  for (const item of translations.items) {
    assert(!hashes.has(item.sourceCopySha256), item.sourceCopySha256);
    hashes.add(item.sourceCopySha256);
    assert.equal(active.get(item.sourceCopySha256), item.sourceLanguage);
    assert.equal(item.targetLanguage, "es");
    assert(["automatica", "revisada"].includes(item.status));
    assert.equal(item.recipeVersion, TRANSLATION_RECIPE_VERSION);
    assert(["detected", "reviewed"].includes(item.sourceDetection));
    assert(Number(item.sourceConfidence) >= 0.68);
    assert.deepEqual(item.warnings, []);
    assert(
      String(item.copy?.titular || item.copy?.texto || item.copy?.cta || "").trim(),
      `Traducción vacía: ${item.sourceCopySha256}`,
    );
    const source = corpus.items.find(
      (row) =>
        row.sourceCopySha256 === item.sourceCopySha256 &&
        row.idioma === item.sourceLanguage,
    );
    assert(source, item.sourceCopySha256);
    assert.notEqual(
      source.estadoOcr,
      "completo_baja",
      `OCR de baja calidad publicado como automático: ${item.sourceCopySha256}`,
    );
    const originalLiterals = literalCounts(
      `${source.titular || ""}\n${source.texto || ""}\n${source.cta || ""}`,
    );
    const translatedLiterals = literalCounts(
      `${item.copy.titular || ""}\n${item.copy.texto || ""}\n${item.copy.cta || ""}`,
    );
    assert.deepEqual(translatedLiterals, originalLiterals, item.sourceCopySha256);
    const originalText = `${source.titular || ""}\n${source.texto || ""}\n${source.cta || ""}`;
    const translatedText = `${item.copy.titular || ""}\n${item.copy.texto || ""}\n${item.copy.cta || ""}`;
    const protectedTerms = brandTermsFor(source);
    assert(
      !unexpectedSourceScriptProblem(translatedText, protectedTerms),
      `Escritura de origen residual: ${item.sourceCopySha256}`,
    );
    assert(
      !targetLanguageProblem(translatedText, protectedTerms),
      `Destino no español: ${item.sourceCopySha256}`,
    );
    const residue = sourceResidueTerms(
      translatedText,
      source.idioma,
      protectedTerms,
      originalText,
    );
    assert(
      !sourceResidueProblem(translatedText, source.idioma, protectedTerms, originalText),
      `Residuo ${source.idioma}: ${item.sourceCopySha256} · ${residue.join(", ")}`,
    );
    assert.deepEqual(
      missingBrandTerms(originalText, translatedText, protectedTerms),
      [],
      `Marca alterada: ${item.sourceCopySha256}`,
    );
  }
});

test("los idiomas de alto riesgo y la cuarentena nunca se publican como automáticos", () => {
  const quarantined = new Set(
    quarantine.items.map((item) => item.sourceCopySha256),
  );
  assert.equal(quarantined.size, quarantine.items.length);
  for (const item of translations.items) {
    if (item.status !== "automatica") continue;
    assert(
      !AUTOMATIC_REVIEW_LANGUAGES.has(item.sourceLanguage),
      `Idioma de revisión editorial publicado como automático: ${item.sourceCopySha256}`,
    );
    assert(
      !quarantined.has(item.sourceCopySha256),
      `Hash en cuarentena publicado como automático: ${item.sourceCopySha256}`,
    );
  }
});

test("las traducciones revisadas conservan trazabilidad editorial", () => {
  for (const item of translations.items.filter((row) => row.status === "revisada")) {
    assert(String(item.reviewedBy || "").trim(), item.sourceCopySha256);
    assert(String(item.reviewNote || "").trim(), item.sourceCopySha256);
    assert.match(String(item.provider || ""), /revisi[oó]n editorial/iu);
  }
});

test("las piezas italianas de Dentalead no dependen de traducción automática", () => {
  const dentalead = corpus.items.filter(
    (item) => item.name === "Dentalead" && item.idioma === "it" && item.copyAvailable,
  );
  assert(dentalead.length >= 28, `Cobertura Dentalead inesperada: ${dentalead.length}`);
  for (const item of dentalead) {
    assert.equal(item.estadoTraduccion, "revisada", item.sourceCopySha256);
    assert.match(item.proveedorTraduccion || "", /revisi[oó]n editorial/iu);
  }
});

test("las traducciones automáticas largas pasan siempre a revisión editorial", () => {
  const limits = new Map([
    ["en", 425],
    ["fr", 360],
    ["de", 290],
  ]);
  for (const item of corpus.items.filter((row) => row.estadoTraduccion === "automatica")) {
    const limit = limits.get(item.idioma);
    if (!limit) continue;
    const sourceChars = [item.titular, item.texto, item.cta]
      .filter(Boolean)
      .join("\n").length;
    assert(sourceChars < limit, `${item.sourceCopySha256}: ${sourceChars} >= ${limit}`);
  }
});

test("el QA v12 no confunde frases con dominios ni acepta residuos cortos", () => {
  assert.equal(literalCounts("c.mon en.odontocracia que.gira libro.el es.boh").size, 0);
  assert.equal(literalCounts("Visita https://example.com o ejemplo.es").size, 2);
  assert.equal(literalCounts("www.medicalmarketing.digital/ go.recommend.my").size, 2);
  assert.equal(literalCounts("www.yourmystarjp/").size, 1);
  assert.deepEqual(
    [...literalCounts("499AED/month · £29 · 79,000원 · 1.5 万").keys()],
    [":499:aed", ":29:£", ":79000:원", ":15:万"],
  );
  assert(targetLanguageProblem("Obtenha mais clientes para sua empresa sem compromisso"));
  assert(sourceResidueProblem("Get more customers for your local business today", "en"));
  assert.equal(
    sourceLanguageMismatch(
      "Marketing sanitario medible para clínicas y centros de salud. Análisis gratis.",
      "en",
    ),
    "es",
  );
  assert.equal(
    sourceLanguageMismatch(
      "Designer gráfico? Encontre profissionais. Sem compromisso. Sem custos. Faça o pedido.",
      "en",
    ),
    "pt",
  );
  assert.equal(
    sourceLanguageMismatch(
      "IL TUO COMMERCIALISTA NON TI DIRÀ MAI QUESTI NUMERI. Scopri dove il tuo studio perde soldi.",
      "it",
    ),
    null,
  );
  assert(sourceResidueProblem("Siga a Us Now", "de"));
  assert(sourceResidueProblem("Portal de Appel de Offres y próximo Chantier", "fr"));
  const iziFixture = {
    name: "IZI by EDF",
    titular: "1ZI by EDF installe votre borne",
    texto: "IZI by EDF · EDF recrute · by €DF",
    cta: "",
  };
  const iziTerms = brandTermsFor(iziFixture);
  assert(iziTerms.includes("EDF"));
  assert(iziTerms.includes("1ZI"));
  assert(
    missingBrandTerms(
      `${iziFixture.titular}\n${iziFixture.texto}`,
      "1ZI by Scheme instala tu punto. IZI by PC.",
      iziTerms,
    ).length > 0,
  );
  const genericServiceTerms = brandTermsFor({
    name: "Service Direct",
    titular: "Local Service Ads",
    texto: "Grow your local service business",
    cta: "",
  });
  assert(!genericServiceTerms.includes("Service"));
  assert(
    brandTermsFor({
      name: "Service Direct",
      titular: "Service Direct for contractors",
      texto: "",
      cta: "",
    }).includes("Service Direct"),
  );
  assert(
    brandTermsFor({
      name: "Dentalead",
      titular: "Il Dentista Cieco",
      texto: "Scopri il libro Il Dentista Cieco",
      cta: "",
    }).includes("Il Dentista Cieco"),
  );
  assert(unexpectedSourceScriptProblem("今すぐ無料で始めましょう"));
  assert(unexpectedSourceScriptProblem("ابدأ الآن مجانًا"));
});

test("sidecar y corpus aplican traducciones de forma bidireccional", () => {
  const byHash = new Map(
    translations.items.map((item) => [item.sourceCopySha256, item]),
  );
  for (const item of corpus.items) {
    const translation = byHash.get(item.sourceCopySha256);
    if (translation && translation.sourceLanguage === item.idioma) {
      assert.equal(item.estadoTraduccion, translation.status, item.corpusKey);
      assert.deepEqual(item.traduccionEs, translation.copy, item.corpusKey);
      assert.equal(item.proveedorTraduccion, translation.provider, item.corpusKey);
      if (translation.status === "revisada") {
        assert.equal(item.revisadoPorTraduccion, translation.reviewedBy, item.corpusKey);
        assert.equal(item.notaRevisionTraduccion, translation.reviewNote, item.corpusKey);
      }
    }
    if (["automatica", "revisada"].includes(item.estadoTraduccion)) {
      assert(translation, item.corpusKey);
      assert.equal(translation.sourceLanguage, item.idioma);
    }
  }
  for (const rejection of translations.rejections || []) {
    for (const item of corpus.items.filter(
      (row) => row.sourceCopySha256 === rejection.sourceCopySha256,
    )) {
      assert(!["automatica", "revisada"].includes(item.estadoTraduccion), item.corpusKey);
    }
  }
});

test("una traducción automática nunca promociona una pieza a patrones", () => {
  const translationHashes = new Set(
    translations.items.map((item) => item.sourceCopySha256),
  );
  for (const item of corpus.items.filter(
    (row) => row.origen === "ocr_captura" && translationHashes.has(row.sourceCopySha256),
  )) {
    assert.equal(item.aptaPatrones, false, item.corpusKey);
  }
});

test("el OCR de baja calidad siempre requiere revisión humana", () => {
  for (const item of corpus.items.filter(
    (row) =>
      row.copyAvailable &&
      row.origen === "ocr_captura" &&
      row.estadoOcr === "completo_baja" &&
      row.idioma !== "es",
  )) {
    assert.equal(item.estadoTraduccion, "requiere_revision", item.corpusKey);
    assert.equal(item.traduccionEs, undefined, item.corpusKey);
  }
});

test("todos los archivos enlazados por el corpus siguen publicados", () => {
  for (const item of corpus.items.filter((row) => row.file)) {
    assert.match(item.file, /^\/media\//);
    assert(existsSync(resolve(root, "public", item.file.replace(/^\/+/, ""))), item.file);
  }
});
