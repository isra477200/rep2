import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyEvidenceRecipe,
  applyStrategyRecommendation,
  buildEvidenceRecipes,
  buildLandingHtml,
  buildStrategyRecommendation,
  defaultBrief,
  destinationCompatible,
  landingReadiness,
} from "../app/landings/model.ts";

const intelligencePromise = readFile(
  new URL("../public/data/landing-intelligence.json", import.meta.url),
  "utf8",
).then(JSON.parse);

const captureIndexPromise = readFile(
  new URL("../public/data/site-captures/index.json", import.meta.url),
  "utf8",
).then(JSON.parse);

const checkById = (readiness, id) => readiness.checks.find((check) => check.id === id);
const blockerIds = (readiness) => readiness.blockers.map((check) => check.id);
const formActionScript = (html) => {
  const match = html.match(/<script>\(function\(\).*?<\/script>/s);
  assert.ok(match, "no se encontró el script de envío del formulario");
  return match[0];
};

test("los destinos se validan según el modo de CTA, no solo por longitud", () => {
  for (const value of ["+34 600 111 222", "600111222", "0033 1 84 80 20 20"]) {
    assert.equal(destinationCompatible(value, "whatsapp"), true, value);
    assert.equal(destinationCompatible(value, "phone"), true, value);
  }
  for (const value of ["abcdef", "12345", "1234567890123456", "https://cal.com/equipo/30"]) {
    assert.equal(destinationCompatible(value, "whatsapp"), false, value);
    assert.equal(destinationCompatible(value, "phone"), false, value);
  }
  for (const value of ["https://cal.com/equipo/30", "http://example.com/reserva?zona=Madrid"]) {
    assert.equal(destinationCompatible(value, "calendar"), true, value);
  }
  for (const value of ["cal.com/equipo", "+34600111222", "javascript:alert(1)", ""]) {
    assert.equal(destinationCompatible(value, "calendar"), false, value);
  }
});

test("aplicar una receta conserva claims y deja visible un destino incompatible para corregirlo", async () => {
  const intelligence = await intelligencePromise;
  const brief = {
    ...defaultBrief("clinicas-salud"),
    objective: "booking",
    trafficSource: "google",
    proof: "Caso Clínica Norte: 42 solicitudes entre enero y marzo de 2026.",
    price: "Desde 1.200 €/mes",
    guarantee: "Durante 30 días se repone cada dato inválido según contrato.",
    destination: "https://cal.com/clinica/diagnostico?utm_source=portal&utm_medium=recipe",
  };
  const recipe = buildEvidenceRecipes(
    intelligence.verticals[brief.verticalId],
    intelligence.universal,
    brief,
  ).find((candidate) => candidate.ctaMode === "calendar");
  assert.ok(recipe, "el estudio debería proponer al menos una receta de agenda");

  const compatible = applyEvidenceRecipe(brief, recipe);
  assert.equal(compatible.destination, brief.destination);
  assert.equal(compatible.proof, brief.proof);
  assert.equal(compatible.price, brief.price);
  assert.equal(compatible.guarantee, brief.guarantee);
  assert.equal(compatible.activeRecipeId, recipe.id);

  const incompatible = applyEvidenceRecipe(
    { ...brief, destination: "+34 600 111 222" },
    recipe,
  );
  assert.equal(incompatible.destination, "+34 600 111 222");
  assert.equal(incompatible.ctaMode, "calendar");
  const readiness = landingReadiness(incompatible);
  assert.equal(checkById(readiness, "destination").ok, false);
  assert.ok(blockerIds(readiness).includes("destination"));
  assert.equal(readiness.publishable, false);
});

test("las recetas v2 separan fuentes de hero, CTA y coocurrencia, y no inventan saturación", async () => {
  const intelligence = await intelligencePromise;
  const vertical = intelligence.verticals["clinicas-salud"];
  const brief = {
    ...defaultBrief("clinicas-salud"),
    objective: "qualified",
    trafficSource: "google",
  };
  const recipes = buildEvidenceRecipes(vertical, intelligence.universal, brief);

  assert.equal(recipes.length, 3);
  assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, recipes.length);
  assert.equal(recipes[0].observedTogether, vertical.cooccurrences[0].count);
  assert.equal(recipes[0].confidence, "high");

  for (const recipe of recipes) {
    assert.equal(Object.hasOwn(recipe, "saturation"), false, recipe.id);
    assert.match(recipe.summary, /no es una tasa de conversión/i);
    assert.ok(["high", "medium", "low"].includes(recipe.confidence), recipe.id);
    assert.ok(recipe.sampleBase > 0, recipe.id);
    assert.ok(recipe.sourceGroups.hero.length > 0, `${recipe.id}: sin fuentes de hero`);
    assert.ok(recipe.sourceGroups.cta.length > 0, `${recipe.id}: sin fuentes de CTA`);
    assert.ok(recipe.sources.some((source) =>
      recipe.sourceGroups.hero.some((heroSource) => heroSource.companyId === source.companyId)
    ), `${recipe.id}: el resumen no conserva una fuente de hero`);
    assert.ok(recipe.sources.some((source) =>
      recipe.sourceGroups.cta.some((ctaSource) => ctaSource.companyId === source.companyId)
    ), `${recipe.id}: el resumen no conserva una fuente de CTA`);

    const pair = vertical.cooccurrences.find(
      (candidate) => candidate.heroId === recipe.heroFamily.id && candidate.ctaId === recipe.ctaFamily.id,
    );
    assert.equal(recipe.observedTogether, pair?.count || 0, recipe.id);
    if (recipe.observedTogether > 0) {
      assert.ok(recipe.sourceGroups.together.length > 0, `${recipe.id}: sin ejemplo conjunto`);
      assert.equal(recipe.warnings.length, 0, recipe.id);
      for (const source of recipe.sourceGroups.together) {
        assert.ok(pair.companyIds.includes(source.companyId), `${recipe.id}/${source.companyId}`);
      }
    } else {
      assert.ok(recipe.warnings.some((warning) => /por separado/i.test(warning)), recipe.id);
    }
  }
});

test("el script conserva ampersands reales en URLs y mensajes sin romper el escape HTML", () => {
  const calendarUrl = "https://cal.com/equipo/demo?utm_source=portal&utm_medium=landing";
  const calendarHtml = buildLandingHtml({
    ...defaultBrief(),
    ctaMode: "calendar",
    destination: calendarUrl,
  });
  const calendarScript = formActionScript(calendarHtml);
  assert.ok(calendarScript.includes(JSON.stringify(calendarUrl)));
  assert.doesNotMatch(calendarScript, /utm_source=portal&amp;utm_medium=landing/);

  const whatsappHtml = buildLandingHtml({
    ...defaultBrief(),
    ctaMode: "whatsapp",
    destination: "+34600111222",
    service: "SEO & Ads",
  });
  const whatsappScript = formActionScript(whatsappHtml);
  assert.match(whatsappScript, /var service=.*"SEO & Ads"/);
  assert.doesNotMatch(whatsappScript, /var service="SEO &amp; Ads"/);
  assert.match(whatsappHtml, /SEO &amp; Ads/);
});

test("un destino de otro modo nunca se degrada silenciosamente a teléfono o WhatsApp", () => {
  const whatsappWithUrl = buildLandingHtml({
    ...defaultBrief(),
    ctaMode: "whatsapp",
    destination: "https://cal.com/equipo/2026",
  });
  assert.doesNotMatch(whatsappWithUrl, /wa\.me\/2026/);
  assert.doesNotMatch(whatsappWithUrl, /tel:\+2026/);
  assert.match(formActionScript(whatsappWithUrl), /Configura el destino/);

  const calendarWithPhone = buildLandingHtml({
    ...defaultBrief(),
    ctaMode: "calendar",
    destination: "+34600111222",
  });
  assert.doesNotMatch(calendarWithPhone, /wa\.me|tel:\+34600111222/);
  assert.match(formActionScript(calendarWithPhone), /Configura el destino/);
});

test("cada arquitectura renderiza un bloque distintivo", () => {
  const architectures = ["local", "diagnostic", "booking", "saas", "marketplace", "pricing"];
  const signatures = new Set();
  for (const architecture of architectures) {
    const html = buildLandingHtml({ ...defaultBrief(), architecture });
    assert.ok(
      html.includes(`class="section architecture-block ${architecture}-block"`),
      `${architecture}: falta su bloque propio`,
    );
    const block = html.match(new RegExp(`<section class="section architecture-block ${architecture}-block">.*?</section>`, "s"));
    assert.ok(block, architecture);
    signatures.add(block[0]);
  }
  assert.equal(signatures.size, architectures.length);
});

test("la profundidad corta, estándar y extendida cambia de forma controlada secciones y FAQ", () => {
  const countCoreSections = (html) =>
    (html.match(/class="section (?:problem|mechanism|qualification|offer)"/g) || []).length;
  const countFaqItems = (html) => (html.match(/<details>/g) || []).length;
  const short = buildLandingHtml({ ...defaultBrief(), depth: "short" });
  const standard = buildLandingHtml({ ...defaultBrief(), depth: "standard" });
  const extended = buildLandingHtml({ ...defaultBrief(), depth: "extended" });

  assert.deepEqual(
    [countCoreSections(short), countCoreSections(standard), countCoreSections(extended)],
    [2, 3, 4],
  );
  assert.deepEqual(
    [countFaqItems(short), countFaqItems(standard), countFaqItems(extended)],
    [2, 3, 4],
  );
  assert.ok(short.length < standard.length);
  assert.ok(standard.length < extended.length);
});

test("el estudio ajusta la longitud del formulario y el HTML respeta el objetivo", async () => {
  const intelligence = await intelligencePromise;
  const initial = {
    ...defaultBrief("legal"),
    objective: "qualified",
    formFieldsTarget: 3,
  };
  const recommendation = buildStrategyRecommendation(initial, intelligence.verticals.legal);
  assert.ok(recommendation.suggestedFormFields >= 3 && recommendation.suggestedFormFields <= 8);
  const applied = applyStrategyRecommendation(initial, recommendation);
  assert.equal(applied.formFieldsTarget, recommendation.suggestedFormFields);

  const countVisibleFields = (html) => (html.match(/<(?:input|textarea) id="/g) || []).length;
  const contact = buildLandingHtml({ ...defaultBrief(), objective: "contact", formFieldsTarget: 3 });
  const qualified = buildLandingHtml({ ...defaultBrief(), objective: "qualified", formFieldsTarget: 7 });
  assert.equal(countVisibleFields(contact), 3);
  assert.equal(countVisibleFields(qualified), 7);
  assert.match(contact, /Formulario de 3 campos adaptado al objetivo «contacto»/);
  assert.match(qualified, /Formulario de 7 campos adaptado al objetivo «solicitud cualificada»/);
});

test("el HTML público omite módulos no respaldados y conserva un único formulario", () => {
  const html = buildLandingHtml(defaultBrief("inmobiliario"));
  assert.doesNotMatch(html, /PRUEBA IDENTIFICABLE|INVERSIÓN|COMPROMISO PUBLICABLE/);
  assert.doesNotMatch(html, /por configurar|hipótesis|borrador editorial/i);
  assert.match(html, /Un recorrido visible de principio a fin/);
  assert.match(html, /preguntas clave/i);
  assert.equal((html.match(/class="lead-form"/g) || []).length, 1);
});

test("prueba, precio y garantía aparecen únicamente cuando el usuario los aporta", () => {
  const brief = {
    ...defaultBrief("legal"),
    proof: "Caso Acme: 18 consultas cualificadas entre enero y marzo de 2026.",
    price: "Desde 1.200 €/mes + inversión publicitaria",
    guarantee: "Si faltan entregables en 30 días, el servicio continúa sin fee hasta completarlos; excluye datos falsos del cliente.",
  };
  const html = buildLandingHtml(brief);
  assert.match(html, /PRUEBA IDENTIFICABLE/);
  assert.match(html, /Desde 1.200 €\/mes/);
  assert.match(html, /COMPROMISO PUBLICABLE/);
});

test("el generador escapa contenido introducido sin contaminar el script", () => {
  const brief = {
    ...defaultBrief(),
    service: '<script>alert("x")</script> & Ads',
    brand: '<img src=x onerror="alert(1)">',
    ctaMode: "whatsapp",
    destination: "+34600111222",
  };
  const html = buildLandingHtml(brief);
  assert.doesNotMatch(html, /<script>alert\("x"\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.doesNotMatch(formActionScript(html), /<script>alert/);
  assert.match(formActionScript(html), /\\u003cscript>alert/);
});

test("readiness bloquea pricing sin precio y lo libera con condiciones visibles", () => {
  const base = {
    ...defaultBrief("generalista"),
    architecture: "pricing",
    objective: "quote",
    ctaMode: "whatsapp",
    destination: "+34600111222",
    privacyUrl: "https://example.com/privacidad",
  };
  const missingPrice = landingReadiness(base);
  assert.equal(checkById(missingPrice, "price").ok, false);
  assert.ok(blockerIds(missingPrice).includes("price"));
  assert.equal(missingPrice.publishable, false);

  const complete = landingReadiness({ ...base, price: "1.200 €/mes + inversión publicitaria" });
  assert.equal(checkById(complete, "price").ok, true);
  assert.ok(!blockerIds(complete).includes("price"));
  assert.equal(complete.publishable, true);
});

test("readiness exige prueba concreta para autoridad", () => {
  const base = {
    ...defaultBrief("legal"),
    angle: "authority",
    ctaMode: "phone",
    destination: "+34910111222",
    privacyUrl: "https://example.com/privacidad",
  };
  const missing = landingReadiness(base);
  assert.equal(checkById(missing, "proof").ok, false);
  assert.ok(blockerIds(missing).includes("proof"));

  const vague = landingReadiness({ ...base, proof: "Tenemos mucha experiencia y somos muy buenos." });
  assert.equal(checkById(vague, "proof").ok, false);

  const supported = landingReadiness({
    ...base,
    proof: "Caso Clínica Norte: 42 solicitudes entre enero y marzo de 2026. Fuente https://example.com/caso.",
  });
  assert.equal(checkById(supported, "proof").ok, true);
  assert.ok(!blockerIds(supported).includes("proof"));
});

test("readiness detecta claims numéricos, temporales y garantías sin respaldo", () => {
  const base = {
    ...defaultBrief("b2b-sdr"),
    angle: "outcome",
    result: "30 reuniones garantizadas en 7 días",
    ctaMode: "calendar",
    destination: "https://cal.com/equipo/demo",
    privacyUrl: "https://example.com/privacidad",
  };
  const unsupported = landingReadiness(base);
  assert.equal(checkById(unsupported, "claim").ok, false);
  assert.ok(blockerIds(unsupported).includes("claim"));
  assert.equal(unsupported.publishable, false);

  const supported = landingReadiness({
    ...base,
    proof: "Caso Empresa Norte: 30 reuniones entre enero y marzo de 2026, documentadas en https://example.com/caso.",
  });
  assert.equal(checkById(supported, "claim").ok, true);
  assert.ok(!blockerIds(supported).includes("claim"));
});

test("la inteligencia v2 conserva denominadores, cobertura y referencias coherentes", async () => {
  const [intelligence, captureIndex] = await Promise.all([
    intelligencePromise,
    captureIndexPromise,
  ]);
  assert.equal(intelligence.schemaVersion, "rv-landing-intelligence-v2");
  assert.equal(intelligence.source.companies, captureIndex.stats.records);
  assert.equal(intelligence.source.pages, captureIndex.stats.pages);
  assert.equal(intelligence.source.capturedPages, captureIndex.stats.captured);
  assert.ok(intelligence.source.eligibleCompanies <= intelligence.source.companies);
  assert.ok(intelligence.source.salesPageCompanies <= intelligence.source.eligibleCompanies);
  assert.match(intelligence.source.methodology, /no (?:contienen|es).*conversión|no.*causalidad/i);
  assert.match(intelligence.source.qualityPolicy, /boilerplate/i);

  const quality = intelligence.universal.dataQuality;
  assert.equal(quality.eligibleCompanies, intelligence.source.eligibleCompanies);
  assert.equal(quality.salesPageCompanies, intelligence.source.salesPageCompanies);
  assert.equal(
    quality.ctaCoveragePct,
    Math.round((quality.usableCtaCompanies / quality.salesPageCompanies) * 100),
  );
  assert.equal(
    quality.heroCoveragePct,
    Math.round((quality.classifiedHeroCompanies / quality.salesPageCompanies) * 100),
  );
  assert.deepEqual(quality.auditedAbsenceOverrides, { price: 29, guarantee: 17, proof: 15 });
  assert.deepEqual(
    {
      price: intelligence.universal.fieldPresence.price,
      guarantee: intelligence.universal.fieldPresence.guarantee,
      proof: intelligence.universal.fieldPresence.proof,
    },
    { price: 24, guarantee: 32, proof: 52 },
  );

  const invalidSalesUrl = /privacy|privacidad|politica(?:-de)?-privacidad|legal|condiciones|cookies?|\/blog\/|\/tag\/|\/404/;
  for (const [verticalId, vertical] of Object.entries(intelligence.verticals)) {
    assert.equal(vertical.sampleSize, vertical.study.coverage.eligibleCompanies, verticalId);
    assert.equal(
      vertical.study.coverage.heroCoveragePct,
      Math.round((vertical.study.coverage.heroClassifiedCompanies / vertical.sampleSize) * 100),
      verticalId,
    );
    assert.equal(
      vertical.study.coverage.ctaCoveragePct,
      Math.round((vertical.study.coverage.ctaClassifiedCompanies / vertical.sampleSize) * 100),
      verticalId,
    );
    assert.ok(["high", "medium", "low"].includes(vertical.study.confidence), verticalId);

    for (const family of [...vertical.heroFamilies, ...vertical.ctaFamilies]) {
      assert.equal(family.count, family.companyIds.length, `${verticalId}/${family.id}`);
      assert.equal(new Set(family.companyIds).size, family.companyIds.length, `${verticalId}/${family.id}`);
      assert.equal(family.sampleBase, vertical.sampleSize, `${verticalId}/${family.id}`);
      assert.equal(family.share, Math.round((family.count / family.sampleBase) * 100), `${verticalId}/${family.id}`);
    }

    for (const pair of vertical.cooccurrences) {
      assert.equal(pair.count, pair.companyIds.length, `${verticalId}/${pair.id}`);
      assert.equal(pair.sampleBase, vertical.sampleSize, `${verticalId}/${pair.id}`);
      assert.equal(pair.share, Math.round((pair.count / pair.sampleBase) * 100), `${verticalId}/${pair.id}`);
      assert.ok(vertical.heroFamilies.some((family) => family.id === pair.heroId), `${verticalId}/${pair.id}/hero`);
      assert.ok(vertical.ctaFamilies.some((family) => family.id === pair.ctaId), `${verticalId}/${pair.id}/cta`);
      for (const example of pair.examples) {
        assert.ok(pair.companyIds.includes(example.companyId), `${verticalId}/${pair.id}/${example.companyId}`);
      }
    }

    for (const example of vertical.examples) {
      assert.equal(example.salesPageValid, true, `${verticalId}/${example.companyId}: página no válida`);
      assert.equal(example.trustedScope, true, `${verticalId}/${example.companyId}: alcance no confiable`);
      assert.ok(["high", "medium", "low"].includes(example.verticalConfidence), `${verticalId}/${example.companyId}`);
      assert.ok(example.thumbnail, `${verticalId}/${example.companyId}: sin captura`);
      assert.ok(example.sourceUrl, `${verticalId}/${example.companyId}: sin URL`);
      assert.doesNotMatch(example.sourceUrl, invalidSalesUrl, `${verticalId}/${example.companyId}: URL descartable`);
      assert.ok(example.headline.length >= 12, `${verticalId}/${example.companyId}: titular insuficiente`);
    }
  }
});

test("las familias de CTA v2 excluyen navegación, cookies, login y boilerplate", async () => {
  const intelligence = await intelligencePromise;
  const ctaFamilies = [
    ...intelligence.universal.ctaFamilies,
    ...Object.values(intelligence.verticals).flatMap((vertical) => vertical.ctaFamilies),
  ];
  const boilerplate = /^(?:saltar|ir|skip|aller) (?:al |a la |to )?(?:contenido|contenido principal|primary navigation)|^(?:aceptar|accept|acepto|personalizar|personnaliser|consentimiento|denegar|rechazar|cerrar|mostrar detalles|gestionar los servicios|solo funcionales)(?: todas?)?$|^(?:inicio|home|accueil|servicios?|services|nosotros|qui[eé]nes somos|about|blog|faq|precios|productos|funcionalidades|portfolio|podcast|content|expertise|capabilities|integraciones)$/i;
  const forbiddenContext = /@|cookie|privacidad|legal|pol[ií]tica|facebook|instagram|linkedin|youtube|men[uú]|t[eé]rminos|iniciar sesi[oó]n|crear una cuenta|espacio pro/i;
  const commercialAction = /\b(?:agenda|agendar|reserv|solicita|solicitar|pedir|pide|calcula|calcular|cotiza|cotizar|presupuesto|propuesta|contact|habla|hablemos|escr[ií]be|whatsapp|mensaje|empieza|empezar|comienza|comenzar|comprar|contrata|probar|prueba|diagn[oó]stic|auditor|an[aá]lisis|consulta|cita|llamada|demo|encaj|aplica|aplicaci[oó]n|rellena|book|schedule|request|quote|buy|get started|start|prendre|r[eé]serv|demander|devis|commencer|acheter|rendez-vous|appel)\b/i;

  for (const family of ctaFamilies) {
    assert.notEqual(family.id, "other");
    for (const example of family.examples) {
      assert.doesNotMatch(example.text, boilerplate, `${family.id}/${example.companyId}`);
      assert.doesNotMatch(example.text, forbiddenContext, `${family.id}/${example.companyId}`);
      assert.match(example.text, commercialAction, `${family.id}/${example.companyId}: CTA sin acción comercial`);
    }
  }
});
