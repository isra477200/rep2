import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyEvidenceRecipe,
  applyAutomotiveIntent,
  applyStrategyRecommendation,
  buildEvidenceRecipes,
  buildLandingHtml,
  buildStrategyRecommendation,
  defaultBrief,
  destinationCompatible,
  landingReadiness,
} from "../app/landings/model.ts";
import { applyMarketAmmo, buildMarketAmmo } from "../app/landings/market-ammo.ts";

const intelligencePromise = readFile(
  new URL("../public/data/landing-intelligence.json", import.meta.url),
  "utf8",
).then(JSON.parse);

const captureIndexPromise = readFile(
  new URL("../public/data/site-captures/index.json", import.meta.url),
  "utf8",
).then(JSON.parse);

const verticalesPromise = readFile(
  new URL("../public/data/verticales.json", import.meta.url),
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
  for (const value of ["https://cal.com/equipo/30", "https://example.com/reserva?zona=Madrid"]) {
    assert.equal(destinationCompatible(value, "calendar"), true, value);
  }
  for (const value of ["cal.com/equipo", "http://example.com/reserva", "+34600111222", "javascript:alert(1)", ""]) {
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

test("las recetas v3 separan fuentes, secuencia y coocurrencia, y no inventan saturación", async () => {
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
    assert.equal(recipe.heroSampleBase, recipe.heroFamily.sampleBase, recipe.id);
    assert.equal(recipe.ctaSampleBase, recipe.ctaFamily.sampleBase, recipe.id);
    assert.ok(recipe.sectionSequence.length >= 6, `${recipe.id}: sin blueprint de secciones`);
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

test("los tres sistemas visuales producen tratamientos realmente distintos", () => {
  const consultative = buildLandingHtml({ ...defaultBrief(), tone: "consultative" });
  const direct = buildLandingHtml({ ...defaultBrief(), tone: "direct" });
  const premium = buildLandingHtml({ ...defaultBrief(), tone: "premium" });

  assert.match(consultative, /<body class="theme-consultative architecture-/);
  assert.match(direct, /<body class="theme-direct architecture-/);
  assert.match(premium, /<body class="theme-premium architecture-/);
  assert.match(direct, /\.theme-direct \.hero\{background:#0d1b2d/);
  assert.match(premium, /font-family:Georgia/);
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
    cookiesUrl: "https://example.com/cookies",
    legalName: "Empresa Ejemplo, S.L.",
    leadEndpoint: "https://example.com/api/leads",
    leadEndpointVerified: true,
    gtmId: "GTM-ABCDE12",
    trackingVerified: true,
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
    result: "30 reuniones en 7 días",
    proof: "Caso Empresa Norte: 30 reuniones obtenidas en 7 días de marzo de 2026, documentadas en https://example.com/caso.",
  });
  assert.equal(checkById(supported, "claim").ok, true);
  assert.ok(!blockerIds(supported).includes("claim"));
});

test("la munición competitiva nunca sobrescribe prueba, precio ni garantía propios", async () => {
  const verticales = await verticalesPromise;
  for (const vertical of verticales.verticales) {
    const brief = {
      ...defaultBrief(vertical.id),
      proof: "Caso propio documentado: 12 oportunidades entre enero y marzo de 2026.",
      price: "Oferta aprobada: 900 € más impuestos",
      guarantee: "Durante 30 días se repone cada dato inválido probado; excluye duplicados y aplica según el anexo firmado.",
    };
    const ammo = buildMarketAmmo(vertical.id, verticales, null, null, brief.unit);
    assert.ok(ammo, vertical.id);
    const applied = applyMarketAmmo(brief, ammo);
    assert.equal(applied.proof, brief.proof, `${vertical.id}: prueba`);
    assert.equal(applied.price, brief.price, `${vertical.id}: precio`);
    assert.equal(applied.guarantee, brief.guarantee, `${vertical.id}: garantía`);
    assert.ok(applied.marketStats.every((item) => !/precio|€\s*\/\s*mes|por contacto/i.test(`${item.value} ${item.label}`)), vertical.id);
    assert.equal(ammo.priceSuggestion, null, vertical.id);
    assert.equal(ammo.guaranteeSuggestion, "", vertical.id);
  }
});

test("los defaults no publican compromisos operativos que nadie haya configurado", async () => {
  const verticales = await verticalesPromise;
  const forbidden = /seguimos trabajando gratis|sin permanencia|tuyo en exclusiva|revisi[oó]n humana|tus datos no se revenden|sin letra pequeña/i;
  for (const vertical of verticales.verticales) {
    assert.doesNotMatch(buildLandingHtml(defaultBrief(vertical.id)), forbidden, vertical.id);
  }
});

test("los claims copiados se detectan en todas las superficies editables", () => {
  const base = {
    ...defaultBrief("legal"),
    proof: "Benchmark editorial de 153 empresas del mercado; no contiene resultados propios.",
  };
  const claim = "30-60 casos cada mes";
  const candidates = [
    { headlineOverride: claim },
    { subheadlineOverride: claim },
    { offer: `Servicio con ${claim}` },
    { problemOverride: `Ahora consigues ${claim}` },
    { stepsOverride: [{ title: "Resultado", text: claim }] },
    { faqsOverride: [{ question: "¿Qué recibo?", answer: claim }] },
  ];
  for (const patch of candidates) {
    const readiness = landingReadiness({ ...base, ...patch });
    assert.equal(checkById(readiness, "claim").ok, false, JSON.stringify(patch));
    assert.ok(blockerIds(readiness).includes("claim"), JSON.stringify(patch));
  }
});

test("una garantía exige periodo, métrica, condiciones y remedio", () => {
  const base = defaultBrief("generalista");
  const vague = landingReadiness({ ...base, guarantee: "Te garantizamos resultados por contrato." });
  assert.equal(checkById(vague, "guarantee").ok, false);
  const complete = landingReadiness({
    ...base,
    guarantee: "Durante 30 días se repone cada contacto inválido acreditado; excluye duplicados y aplica según el anexo firmado.",
  });
  assert.equal(checkById(complete, "guarantee").ok, true);
});

test("las cuatro intenciones de coches generan páginas, campos y eventos distintos", () => {
  const intents = {
    "reserva-dominio": ["debt", "finance_company", "lead_form_submit_reserva"],
    "embargo-precinto": ["embargo_type", "ownership", "lead_form_submit_embargo"],
    "financiado-pendiente": ["finance_company", "debt", "lead_form_submit_financiado"],
    "con-cargas": ["charge_type", "amount", "lead_form_submit_con_cargas"],
  };
  const signatures = new Set();
  for (const [intent, [fieldA, fieldB, eventName]] of Object.entries(intents)) {
    const brief = applyAutomotiveIntent(defaultBrief("coches-motor"), intent);
    const ready = {
      ...brief,
      destination: "+34600111222",
      privacyUrl: "https://example.com/privacidad",
      cookiesUrl: "https://example.com/cookies",
      legalName: "Compraventa Ejemplo, S.L.",
      leadEndpoint: "https://example.com/api/leads",
      leadEndpointVerified: true,
      gtmId: "GTM-ABCDE12",
      trackingVerified: true,
    };
    const html = buildLandingHtml(ready);
    const compactRequest = buildLandingHtml({ ...ready, formFieldsTarget: 3 });
    assert.match(html, new RegExp(`id="${fieldA}"`), intent);
    assert.match(html, new RegExp(`id="${fieldB}"`), intent);
    assert.match(formActionScript(html), new RegExp(eventName), intent);
    assert.match(compactRequest, /id="phone"/, `${intent}: el contacto no puede desaparecer al reducir el formulario`);
    assert.doesNotMatch(html, /La landing no debe|No publiques un plazo|antes de lanzar/i, intent);
    assert.ok(brief.evidencePlan.sourceCompanies.length >= 4, intent);
    assert.match(brief.evidencePlan.sourceCompanies[0].url, /^https:\/\//, intent);
    assert.equal(landingReadiness(ready).publishable, true, intent);
    signatures.add(`${brief.service}|${brief.ctaLabel}|${eventName}`);
  }
  assert.equal(signatures.size, 4);
});

test("una intención B2C de coches no puede ser sustituida por recetas genéricas", async () => {
  const intelligence = await intelligencePromise;
  const automotive = applyAutomotiveIntent(defaultBrief("coches-motor"), "reserva-dominio");
  const recipe = buildEvidenceRecipes(
    intelligence.verticals["coches-motor"],
    intelligence.universal,
    automotive,
  )[0];
  const recommendation = buildStrategyRecommendation(automotive, intelligence.verticals["coches-motor"]);

  assert.strictEqual(applyEvidenceRecipe(automotive, recipe), automotive);
  assert.strictEqual(applyStrategyRecommendation(automotive, recommendation), automotive);
  assert.match(automotive.evidencePlan.recipeId, /^automotive-/);
  const withoutBlueprint = landingReadiness({ ...automotive, evidencePlan: null });
  assert.equal(checkById(withoutBlueprint, "blueprint").ok, false);
  assert.ok(blockerIds(withoutBlueprint).includes("blueprint"));
});

test("readiness rechaza endpoints locales y exige medición con consentimiento", () => {
  const base = {
    ...defaultBrief("generalista"),
    destination: "+34600111222",
    privacyUrl: "https://example.com/privacidad",
    cookiesUrl: "https://example.com/cookies",
    legalName: "Empresa Ejemplo, S.L.",
    gtmId: "GTM-ABCDE12",
  };
  const local = landingReadiness({ ...base, leadEndpoint: "http://localhost:8787/leads" });
  assert.equal(checkById(local, "endpoint").ok, false);
  assert.equal(local.publishable, false);

  const withoutTracking = landingReadiness({ ...base, leadEndpoint: "https://example.com/leads", gtmId: "" });
  assert.equal(checkById(withoutTracking, "tracking").ok, false);
  assert.ok(blockerIds(withoutTracking).includes("tracking"));
});

test("la entrega persiste atribución y solo registra conversión después de un 2xx", () => {
  const html = buildLandingHtml({
    ...defaultBrief("generalista"),
    destination: "+34600111222",
    privacyUrl: "https://example.com/privacidad",
    cookiesUrl: "https://example.com/cookies",
    legalName: "Empresa Ejemplo, S.L.",
    leadEndpoint: "https://example.com/api/leads?source=landing&version=3",
    leadEndpointVerified: true,
    gtmId: "GTM-ABCDE12",
    trackingVerified: true,
  });
  const script = formActionScript(html);
  const scriptSource = script.replace(/^<script>/, "").replace(/<\/script>$/, "");
  assert.doesNotThrow(() => new Function(scriptSource));
  for (const key of ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "utm_content", "utm_term"]) {
    assert.match(script, new RegExp(key), key);
  }
  assert.match(script, /analyticsAllowed=state==='granted'&&Boolean\(gtmId\)/);
  assert.ok(script.indexOf("localStorage.setItem(storageKey") > script.indexOf("if(analyticsAllowed)"));
  assert.match(script, /localStorage\.removeItem\(storageKey\)/);
  assert.match(script, /expiresAt:Date\.now\(\)\+consentDuration/);
  assert.match(script, /if\(raw==='granted'\|\|raw==='denied'\)\{clearStoredConsent\(\);return ''\}/);
  assert.match(script, /Date\.now\(\)>stored\.expiresAt\)\{clearStoredConsent\(\);return ''\}/);
  assert.match(html, /data-analytics-manage>Gestionar analítica/);
  assert.match(script, /ad_storage:'denied',analytics_storage:'granted',ad_user_data:'denied',ad_personalization:'denied'/);
  assert.match(script, /googletagmanager\.com\/gtm\.js/);
  assert.match(script, /X-Idempotency-Key/);
  assert.match(script, /data\.vehicle\?'Vehículo:/);
  assert.ok(script.indexOf("form.reset()") > script.indexOf("var message="));
  const conversionPush = script.indexOf('window.dataLayer.push({event:"lead_form_submit_generalista"');
  assert.ok(conversionPush > script.indexOf("if(!response.ok)"));
  const dataLayerPayload = script.slice(conversionPush, script.indexOf("submitted_at:data.submitted_at", conversionPush) + 31);
  assert.doesNotMatch(dataLayerPayload, /phone|email|name|vehicle|debt|embargo|charge_type|zone/);
  assert.match(script, /https:\/\/example\.com\/api\/leads\?source=landing&version=3/);
});

test("el calendario navega tras el 2xx sin depender de un popup", () => {
  const html = buildLandingHtml({
    ...defaultBrief("generalista"),
    ctaMode: "calendar",
    destination: "https://cal.example.com/revision",
    leadEndpoint: "https://example.com/leads",
  });
  const script = formActionScript(html);
  assert.match(script, /window\.location\.assign\("https:\/\/cal\.example\.com\/revision"\)/);
  assert.doesNotMatch(script, /window\.open\(/);
  assert.ok(script.indexOf("window.location.assign") > script.indexOf("if(!response.ok)"));
});

test("la inteligencia v3 conserva denominadores, secuencias y referencias coherentes", async () => {
  const [intelligence, captureIndex] = await Promise.all([
    intelligencePromise,
    captureIndexPromise,
  ]);
  assert.equal(intelligence.schemaVersion, "rv-landing-intelligence-v3");
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
    { price: 28, guarantee: 35, proof: 57 },
  );
  assert.ok(intelligence.universal.sectionPatterns.length >= 6);
  for (const pattern of intelligence.universal.sectionPatterns) {
    assert.ok(pattern.count > 0, pattern.id);
    assert.equal(pattern.share, Math.round((pattern.count / intelligence.source.salesPageCompanies) * 100), pattern.id);
    assert.ok(pattern.medianPosition >= 1, pattern.id);
  }
  const pricingHeadings = intelligence.universal.sectionPatterns.find((pattern) => pattern.id === "pricing")?.examples.map((item) => item.text).join(" | ") || "";
  const proofHeadings = intelligence.universal.sectionPatterns.find((pattern) => pattern.id === "proof")?.examples.map((item) => item.text).join(" | ") || "";
  assert.doesNotMatch(pricingHeadings, /plan de acci[oó]n|plan marketing|implantamos el sistema|sin bajar precios|mejor precio|precios asumibles|gu[ií]as? de precios/i);
  assert.doesNotMatch(proofHeadings, /pierde clientes|nuevos clientes|fidelizaci[oó]n de clientes/i);

  const scopedSectionPatterns = [
    ...intelligence.universal.sectionPatterns,
    ...Object.values(intelligence.verticals).flatMap((vertical) => vertical.sectionPatterns),
  ];
  for (const pattern of scopedSectionPatterns) {
    const headings = pattern.examples.map((item) => item.text).join(" | ");
    assert.doesNotMatch(headings, /m[aá]s sobre sin categor[ií]a|google business profile|[uú]ltimas entradas/i, pattern.id);
    if (pattern.id === "problem") assert.doesNotMatch(headings, /retorno|definimos|definici[oó]n|talento diverso para retos/i, pattern.id);
    if (pattern.id === "qualification") assert.doesNotMatch(headings, /casos reales/i, pattern.id);
    if (pattern.id === "pricing") assert.doesNotMatch(headings, /sin bajar precios|bajar el precio|mejor precio|precios asumibles|gu[ií]as? de precios|plan para .*semana/i, pattern.id);
  }
  const automotiveProof = intelligence.verticals["coches-motor"].sectionPatterns
    .find((pattern) => pattern.id === "proof")?.examples.map((item) => item.text).join(" | ") || "";
  assert.match(automotiveProof, /casos reales/i);
  const sectionCompanies = (verticalId, patternId) =>
    intelligence.verticals[verticalId].sectionPatterns.find((pattern) => pattern.id === patternId)?.companyIds || [];
  assert.ok(!sectionCompanies("reformas-hogar", "problem").includes("reform-ads"));
  assert.ok(!sectionCompanies("solar-energia", "pricing").includes("pepperli"));
  assert.ok(!sectionCompanies("legal", "pricing").includes("lexiuris-marketing"));
  assert.ok(!sectionCompanies("solar-energia", "offer").includes("solar-leads-estudio"));
  assert.ok(!sectionCompanies("solar-energia", "qualification").includes("solar-leads-estudio"));
  assert.ok(!scopedSectionPatterns.some((pattern) => pattern.companyIds.includes("habitatpresto")));

  const invalidSalesUrl = /privacy|privacidad|politica(?:-de)?-privacidad|legal|condiciones|cookies?|\/blog\/|\/mag\/|\/tag\/|\/404/;
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

test("las familias de CTA v3 excluyen navegación, cookies, login y boilerplate", async () => {
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
