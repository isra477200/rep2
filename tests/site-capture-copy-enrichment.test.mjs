import assert from "node:assert/strict";
import test from "node:test";
import { enrichRecord } from "../scripts/enrich-site-capture-copy.mjs";

const ENRICHED_AT = "2026-08-25T17:00:00.000Z";

function baseRecord(overrides = {}) {
  return {
    id: "example-fr",
    commercialRead: {
      headline: null,
      promise: "Promesa experta existente",
      audience: null,
      offer: null,
      mechanism: [],
      primaryCta: null,
      proof: null,
      price: null,
      guarantee: null,
      funnel: [],
    },
    translation: {
      sourceLanguage: "fr",
      status: "existing_spanish_summary",
      spanish: { offer: "Resumen español existente" },
    },
    pages: [
      {
        id: "example-fr-homepage",
        role: "homepage",
        label: "Página principal",
        status: "captured",
        capturedAt: "2026-08-25T16:00:00.000Z",
        text: {
          h1: "Agence de prospection B2B",
          headings: [
            "Agence de prospection B2B",
            "Notre méthode en trois phases",
            "Qualification et ciblage des prospects",
            "Déploiement de votre acquisition multicanale",
          ],
          ctas: [
            "Aller au contenu",
            "Accueil",
            "Tout accepter",
            "Politique de confidentialité",
            "Demander un diagnostic gratuit",
            "Découvrir notre méthode",
          ],
        },
      },
      {
        id: "example-fr-conversion",
        role: "conversion",
        label: "Conversión o contacto",
        status: "captured",
        capturedAt: "2026-08-25T16:05:00.000Z",
        text: {
          h1: "Parlons de votre acquisition",
          headings: ["Comment fonctionne notre diagnostic"],
          ctas: ["Prendre rendez-vous"],
        },
      },
    ],
    ...overrides,
  };
}

test("rellena solo huecos con texto exacto y procedencia por campo", () => {
  const source = baseRecord();
  const originalTranslation = structuredClone(source.translation);
  const result = enrichRecord(source, ENRICHED_AT);

  assert.equal(result.changed, true);
  assert.deepEqual(result.fields, ["headline", "primaryCta", "mechanism", "funnel"]);
  assert.equal(result.record.commercialRead.headline, "Agence de prospection B2B");
  assert.equal(result.record.commercialRead.primaryCta, "Demander un diagnostic gratuit");
  assert.deepEqual(result.record.commercialRead.mechanism, [
    "Notre méthode en trois phases",
    "Qualification et ciblage des prospects",
    "Déploiement de votre acquisition multicanale",
    "Comment fonctionne notre diagnostic",
  ]);
  assert.deepEqual(result.record.commercialRead.funnel, [
    "Página principal · homepage",
    "Conversión o contacto · conversion",
  ]);
  assert.equal(result.record.commercialRead.promise, "Promesa experta existente");
  assert.deepEqual(result.record.translation, originalTranslation, "la traducción debe quedar intacta");
  assert.equal(result.record.commercialReadEnrichedAt, ENRICHED_AT);
  assert.equal(result.record.commercialReadProvenance.schemaVersion, "rv-site-capture-copy-provenance-v1");
  assert.equal(result.record.commercialReadProvenance.fields.headline.method, "first_valid_h1_exact");
  assert.equal(result.record.commercialReadProvenance.fields.primaryCta.evidence[0].pageId, "example-fr-homepage");
  assert.equal(source.commercialRead.headline, null, "no debe mutar la entrada");
});

test("conserva el análisis experto y descarta h1, navegación y cookies", () => {
  const source = baseRecord({
    commercialRead: {
      ...baseRecord().commercialRead,
      headline: "Titular experto que no debe tocarse",
      primaryCta: "CTA experto",
      mechanism: ["Mecanismo experto"],
      funnel: ["Funnel experto"],
    },
  });
  const result = enrichRecord(source, ENRICHED_AT);
  assert.equal(result.changed, false);
  assert.deepEqual(result.record, source);
});

test("salta un h1 de cookies y usa el siguiente h1 capturado válido", () => {
  const source = baseRecord();
  source.pages[0].text.h1 = "Nous utilisons des cookies pour vous offrir la meilleure expérience.";
  const result = enrichRecord(source, ENRICHED_AT);
  assert.equal(result.record.commercialRead.headline, "Parlons de votre acquisition");
  assert.equal(result.record.commercialReadProvenance.fields.headline.evidence[0].pageId, "example-fr-conversion");
});

test("es idempotente después del primer enriquecimiento", () => {
  const first = enrichRecord(baseRecord(), ENRICHED_AT);
  const second = enrichRecord(first.record, "2026-08-25T18:00:00.000Z");
  assert.equal(second.changed, false);
  assert.deepEqual(second.record, first.record);
});

test("no rellena mecanismo con menos de dos encabezados de proceso", () => {
  const source = baseRecord();
  source.pages[0].text.headings = ["Notre méthode"];
  source.pages[1].text.headings = ["Témoignages clients"];
  const result = enrichRecord(source, ENRICHED_AT);
  assert.deepEqual(result.record.commercialRead.mechanism, []);
  assert.equal(result.record.commercialReadProvenance.fields.mechanism, undefined);
});

