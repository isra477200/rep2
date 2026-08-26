import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssociationSignals,
  buildPatternSignals,
  buildPhraseSignals,
  creativeFormatForAd,
  detectHookFamilies,
  parseAdDate,
  patternIdentityForAd,
  semanticCopyForAd,
} from "../app/ad-pattern-engine.ts";

const observation = ({
  key,
  identityKey = key,
  companyId,
  dimensions = {},
  phraseText = "",
  quality = 90,
  semanticTrusted = true,
}) => ({
  key,
  identityKey,
  companyId,
  companyName: companyId,
  country: "España",
  platform: "Meta",
  quality,
  semanticTrusted,
  dimensions,
  phraseText,
  payload: key,
});

test("elige la fuente semántica sin ocultar la procedencia de la traducción", () => {
  const original = semanticCopyForAd({
    idioma: "es",
    estadoTraduccion: "no_necesaria",
    titular: "Más citas",
    texto: "Texto original",
  });
  assert.equal(original.source, "original_es");
  assert.equal(original.trusted, true);
  assert.equal(original.headline, "Más citas");

  const reviewed = semanticCopyForAd({
    idioma: "en",
    estadoTraduccion: "revisada",
    titular: "More leads",
    traduccionEs: { titular: "Más contactos", texto: "Versión revisada" },
  });
  assert.equal(reviewed.source, "traduccion_revisada");
  assert.equal(reviewed.trusted, true);
  assert.equal(reviewed.headline, "Más contactos");

  const automatic = semanticCopyForAd({
    idioma: "fr",
    estadoTraduccion: "automatica",
    titular: "Plus de clients",
    traduccionEs: { titular: "Más clientes" },
  });
  assert.equal(automatic.source, "traduccion_automatica");
  assert.equal(automatic.trusted, false);
});

test("las creatividades sin copy conservan identidades visuales separadas", () => {
  const shared = { copyAvailable: false, sourceCopySha256: "hash-copy-vacio" };
  const left = patternIdentityForAd({ ...shared, corpusKey: "visual-a" }, "fallback-a");
  const right = patternIdentityForAd({ ...shared, corpusKey: "visual-b" }, "fallback-b");
  assert.equal(left, "visual-a");
  assert.equal(right, "visual-b");
  assert.notEqual(left, right);
});

test("una empresa prolífica no se convierte en patrón replicado", () => {
  const repeated = Array.from({ length: 10 }, (_, index) => observation({
    key: `a-${index}`,
    identityKey: "copy-a",
    companyId: "empresa-a",
    dimensions: { angle: ["Riesgo"] },
  }));
  const records = [
    ...repeated,
    observation({ key: "b-1", companyId: "empresa-b", dimensions: { angle: ["Precio"] } }),
  ];
  const risk = buildPatternSignals(records, "angle").find((signal) => signal.label === "Riesgo");
  assert.ok(risk);
  assert.equal(risk.pieces, 10);
  assert.equal(risk.identities, 1);
  assert.equal(risk.companies, 1);
  assert.equal(risk.strength, "indicio");
  assert.equal(risk.dominance, 1);
});

test("la muestra de evidencia prioriza empresas distintas", () => {
  const records = [
    observation({ key: "a-1", companyId: "a", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "a-2", companyId: "a", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "b-1", companyId: "b", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "c-1", companyId: "c", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "d-1", companyId: "d", dimensions: { hook: ["Pregunta"] } }),
  ];
  const signal = buildPatternSignals(records, "hook")[0];
  assert.equal(signal.examples.length, 3);
  assert.equal(new Set(signal.examples.map((item) => item.companyId)).size, 3);
});

test("las combinaciones se deduplican, exigen soporte y conservan la referencia", () => {
  const paired = [
    observation({ key: "a-1", companyId: "a", dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } }),
    observation({ key: "b-1", companyId: "b", dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } }),
    observation({ key: "c-1", companyId: "c", dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } }),
    observation({ key: "d-1", companyId: "d", dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } }),
    observation({ key: "e-1", companyId: "e", dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } }),
    observation({ key: "f-1", companyId: "f", dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } }),
  ];
  const records = [
    ...paired,
    observation({ key: "g-1", companyId: "g", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "h-1", companyId: "h", dimensions: { angle: ["Riesgo"] } }),
    ...["i", "j", "k", "l"].map((companyId) => observation({ key: `${companyId}-1`, companyId })),
  ];
  const signals = buildAssociationSignals(records, records, ["hook", "angle"]);
  const pair = signals.find((signal) => signal.label === "Riesgo + Pregunta" || signal.label === "Pregunta + Riesgo");
  assert.ok(pair);
  assert.equal(pair.companies, 6);
  assert.equal(pair.identities, 6);
  assert.equal(pair.deltaPoints, 0);
  assert.ok(pair.coOccurrenceIndex > 1.4);
  assert.equal(pair.pairRateAmongLeftCompanies, 6 / 7);
  assert.equal(signals.filter((signal) => signal.label.includes("Pregunta") && signal.label.includes("Riesgo")).length, 1);
});

test("descarta asociaciones tautológicas entre etiquetas del mismo tema", () => {
  const records = [
    ...["a", "b", "c", "d", "e", "f"].map((companyId) => observation({ key: `${companyId}-1`, companyId, dimensions: { hook: ["Oferta / precio"], promise: ["Precio / ahorro"] } })),
    observation({ key: "g-1", companyId: "g", dimensions: { hook: ["Oferta / precio"] } }),
    observation({ key: "h-1", companyId: "h", dimensions: { promise: ["Precio / ahorro"] } }),
    ...["i", "j", "k", "l"].map((companyId) => observation({ key: `${companyId}-1`, companyId })),
  ];
  assert.deepEqual(buildAssociationSignals(records, records, ["hook", "promise"]), []);
});

test("el índice de asociación no cambia al duplicar copies de una empresa", () => {
  const base = [
    ...["a", "b", "c", "d", "e", "f"].map((companyId) => observation({ key: `${companyId}-1`, companyId, dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } })),
    observation({ key: "g-1", companyId: "g", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "h-1", companyId: "h", dimensions: { angle: ["Riesgo"] } }),
    ...["i", "j", "k", "l"].map((companyId) => observation({ key: `${companyId}-1`, companyId })),
  ];
  const duplicated = [
    ...base,
    ...Array.from({ length: 80 }, (_, index) => observation({ key: `a-extra-${index}`, companyId: "a", dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } })),
  ];
  const findPair = (records) => buildAssociationSignals(records, records, ["hook", "angle"])
    .find((signal) => signal.label.includes("Pregunta") && signal.label.includes("Riesgo"));
  const before = findPair(base);
  const after = findPair(duplicated);
  assert.ok(before && after);
  assert.equal(after.coOccurrenceIndex, before.coOccurrenceIndex);
  assert.equal(after.pairRateAmongLeftCompanies, before.pairRateAmongLeftCompanies);
});

test("una combinación semántica no revisada queda como exploratoria", () => {
  const records = [
    ...["a", "b", "c", "d", "e", "f"].map((companyId) => observation({ key: `${companyId}-1`, companyId, semanticTrusted: false, dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] } })),
    observation({ key: "g-1", companyId: "g", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "h-1", companyId: "h", dimensions: { angle: ["Riesgo"] } }),
    ...["i", "j", "k", "l"].map((companyId) => observation({ key: `${companyId}-1`, companyId })),
  ];
  const pair = buildAssociationSignals(records, records, ["hook", "angle"])
    .find((signal) => signal.label.includes("Pregunta") && signal.label.includes("Riesgo"));
  assert.ok(pair);
  assert.equal(pair.strength, "exploratoria");
});

test("la traducción automática no eleva una combinación de recurrente a replicada", () => {
  const trusted = ["a", "b", "c", "d", "e", "f", "g", "h"].map((companyId) => observation({
    key: `${companyId}-1`, companyId, dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] },
  }));
  const automatic = ["i", "j"].map((companyId) => observation({
    key: `${companyId}-1`, companyId, semanticTrusted: false, dimensions: { hook: ["Pregunta"], angle: ["Riesgo"] },
  }));
  const records = [
    ...trusted,
    ...automatic,
    observation({ key: "k-1", companyId: "k", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "l-1", companyId: "l", dimensions: { angle: ["Riesgo"] } }),
    ...["m", "n", "o", "p"].map((companyId) => observation({ key: `${companyId}-1`, companyId })),
  ];
  const pair = buildAssociationSignals(records, records, ["hook", "angle"])
    .find((signal) => signal.label.includes("Pregunta") && signal.label.includes("Riesgo"));
  assert.ok(pair);
  assert.equal(pair.semanticTrust, 0.8);
  assert.equal(pair.strength, "recurrente");
});

test("las frases recurrentes solo usan semántica fiable y varias empresas", () => {
  const records = [
    observation({ key: "a-1", companyId: "a", phraseText: "Consigue más clientes ahora" }),
    observation({ key: "a-2", companyId: "a", phraseText: "Queremos más clientes para tu negocio" }),
    observation({ key: "b-1", companyId: "b", phraseText: "Atrae más clientes cada mes" }),
    observation({ key: "c-1", companyId: "c", phraseText: "Genera más clientes sin portales" }),
    observation({ key: "d-1", companyId: "d", phraseText: "Más clientes automáticos", semanticTrusted: false }),
  ];
  const phrase = buildPhraseSignals(records).find((signal) => signal.phrase === "mas clientes");
  assert.ok(phrase);
  assert.equal(phrase.companies, 3);
  assert.equal(phrase.identities, 4);
  assert.equal(phrase.deltaPoints, 0);
});

test("ordena fechas ISO y españolas con el mismo criterio", () => {
  assert.equal(parseAdDate("2026-08-24"), parseAdDate("24/08/2026"));
  assert.ok(parseAdDate("25-08-2026") > parseAdDate("2026-08-24"));
  assert.equal(parseAdDate(""), Number.NEGATIVE_INFINITY);
});

test("los hooks de apertura no se activan por una frase tardía del cuerpo", () => {
  assert.deepEqual(
    detectHookFamilies("Servicios para empresas", "Texto neutro. ¿Quieres más clientes?"),
    ["Apertura descriptiva"],
  );
});

test("una referencia empresarial pequeña no se etiqueta como diferencial sólido", () => {
  const segment = ["a", "b", "c", "d", "e", "f", "g", "h"].map((companyId) => observation({
    key: `${companyId}-1`,
    companyId,
    dimensions: { hook: ["Pregunta"] },
  }));
  const reference = [observation({ key: "z-1", companyId: "z", dimensions: { hook: ["Apertura descriptiva"] } })];
  const signal = buildPatternSignals(segment, "hook", reference).find((item) => item.label === "Pregunta");
  assert.ok(signal);
  assert.equal(signal.universeCompanies, 8);
  assert.equal(signal.referenceUniverseCompanies, 1);
  assert.equal(signal.comparisonSufficient, false);
  assert.equal(signal.strength, "exploratoria");
});

test("los denominadores semánticos excluyen empresas sin una observación evaluable", () => {
  const records = [
    observation({ key: "a-1", companyId: "a", dimensions: { hook: ["Pregunta"] } }),
    observation({ key: "b-1", companyId: "b", dimensions: { hook: ["Apertura descriptiva"] } }),
    { ...observation({ key: "foreign-1", companyId: "foreign" }), evaluableDimensions: ["angle", "format"] },
  ];
  const signal = buildPatternSignals(records, "hook").find((item) => item.label === "Pregunta");
  assert.ok(signal);
  assert.equal(signal.universeCompanies, 2);
  assert.equal(signal.companyAdoption, 0.5);
});

test("el formato nunca se decide por una mención de vídeo dentro del copy", () => {
  const ad = {
    plataforma: "Meta Ads Library · Imagen",
    mediaType: "image",
    file: "captura-clibel.jpg",
    titular: "Toca el botón",
    texto: "Mira un vídeo muy corto para saber más",
  };
  assert.equal(creativeFormatForAd(ad), "Imagen / estático");
});
