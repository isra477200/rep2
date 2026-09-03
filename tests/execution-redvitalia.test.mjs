import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  CAMPAIGNS,
  CAPTURE_UNITS,
  CREATIVES,
  CREATIVE_FORMATS,
  CREATIVE_REQUIREMENTS,
  PRICING,
  PRICING_SOURCE,
  SYSTEMS,
} from "../app/ejecucion/catalog.ts";
import { calculateEconomics } from "../app/ejecucion/economics.ts";
import { buildOperationalPlaybooks, validatePlaybook } from "../app/ejecucion/playbooks.ts";
import { DIMENSION_LABELS, sanitizeWeights, STRATEGY, weightedStrategyScore } from "../app/sistemas/strategy.ts";
import { getLandingBlueprint, LANDING_BLUEPRINTS } from "../app/ejecucion/landing-blueprints.ts";
import {
  createExecutionSnapshot,
  decodeStoredValue,
  encodeStoredValue,
  importExecutionSnapshot,
  storageKey,
  validateExecutionSnapshot,
} from "../app/ejecucion/storage.ts";

const root = process.cwd();

test("the operating layer keeps ten systems and splits Legal into three acquisition units", () => {
  assert.equal(SYSTEMS.length, 10);
  assert.equal(new Set(SYSTEMS.map((system) => system.id)).size, 10);
  assert.equal(CAPTURE_UNITS.length, 12);
  assert.deepEqual(
    CAPTURE_UNITS.filter((unit) => unit.systemId === "legal").map((unit) => unit.id),
    ["segunda-oportunidad", "herencias", "divorcios"],
  );
  assert.ok(CAPTURE_UNITS.every((unit) => unit.qualification.length >= 6));
  assert.ok(CAPTURE_UNITS.every((unit) => unit.rejection.length >= 4));
});

test("every acquisition unit has separate B2B and B2C campaign records", () => {
  assert.equal(CAMPAIGNS.length, 24);
  for (const unit of CAPTURE_UNITS) {
    const campaigns = CAMPAIGNS.filter((campaign) => campaign.unitId === unit.id);
    assert.deepEqual(new Set(campaigns.map((campaign) => campaign.mode)), new Set(["B2B", "B2C"]));
  }
  assert.ok(CAMPAIGNS.every((campaign) => campaign.adStructure.length >= 4));
  assert.ok(CAMPAIGNS.every((campaign) => campaign.remarketingStages.length === 6));
  assert.ok(CAMPAIGNS.every((campaign) => campaign.launchChecklist.length >= 12));
  assert.ok(CAMPAIGNS.every((campaign) => campaign.trackingPlan.primary === campaign.primaryConversion));
  assert.ok(CAMPAIGNS.every((campaign) => campaign.scaleCriteria.length >= 5 && campaign.stopCriteria.length >= 5));
});

test("the portfolio score exposes all fourteen requested decision dimensions", () => {
  assert.equal(Object.keys(DIMENSION_LABELS).length, 14);
  assert.ok(SYSTEMS.every((system) => Object.keys(STRATEGY[system.id].dimensions).length === 14));
});

test("legacy or corrupt saved weights cannot poison the portfolio score", () => {
  const defaults = Object.fromEntries(Object.keys(DIMENSION_LABELS).map((key) => [key, 1]));
  const weights = sanitizeWeights({ demand: 8, obsoleteDimension: 99, margin: "broken" }, defaults);
  assert.deepEqual(Object.keys(weights), Object.keys(DIMENSION_LABELS));
  assert.equal(weights.demand, 8);
  assert.equal(weights.margin, 1);
  assert.ok(Number.isFinite(weightedStrategyScore(STRATEGY.legal, weights)));
});

test("every acquisition unit has a complete A-S operational playbook with traceability", () => {
  const playbooks = SYSTEMS.flatMap((system) => buildOperationalPlaybooks(system.id, {
    id: system.id,
    rank: system.rank,
    name: system.name,
    recommendation: `Validar ${system.name}`,
    reason: "Razón de prueba",
    result: "Resultado verificable",
    fee: "Fuente canónica",
    media: "Hipótesis",
    offer: "Sistema de captación",
    target: "Cliente con capacidad",
    reject: "Cliente sin datos",
    qualification: ["Zona", "Servicio"],
    funnel: ["Fuente", "Anuncio", "Landing", "Formulario"],
    campaigns: ["B2B", "B2C"],
    copy: { b2b: "Propuesta B2B", b2c: "Propuesta B2C" },
    opener: "Apertura",
    objections: ["Objeción"],
    kpis: ["Resultado"],
    plan: ["Días 1-15", "Días 16-30", "Días 31-60", "Días 61-90"],
    competitors: [],
  }));
  assert.equal(playbooks.length, CAPTURE_UNITS.length);
  assert.ok(playbooks.every(validatePlaybook));
  assert.ok(playbooks.every((playbook) => playbook.sections.map((item) => item.code).join("") === "ABCDEFGHIJKLMNOPQRS"));
  assert.ok(playbooks.every((playbook) => playbook.sections.flatMap((item) => item.items).length >= 160));
});

test("creative inventory reaches the requested depth and every optimized asset exists", async () => {
  assert.ok(CREATIVE_REQUIREMENTS.length >= 23);
  assert.equal(CREATIVE_FORMATS.length, 7);
  assert.equal(CREATIVES.length, 144);
  assert.equal(new Set(CREATIVES.map((creative) => creative.id)).size, 144);
  for (const unit of CAPTURE_UNITS) {
    const unitCreatives = CREATIVES.filter((creative) => creative.unitId === unit.id);
    assert.equal(unitCreatives.length, 12);
    assert.equal(unitCreatives.filter((creative) => creative.mode === "B2B").length, 6);
    assert.equal(unitCreatives.filter((creative) => creative.mode === "B2C").length, 6);
  }
  assert.ok(CREATIVES.every((creative) => creative.deliverables.length === CREATIVE_REQUIREMENTS.length));
  assert.ok(CREATIVES.every((creative) => creative.videoPackage.status.includes("no es un vídeo terminado")));
  let totalBytes = 0;
  for (const creative of CREATIVES) {
    assert.equal(creative.adaptations.length, 7);
    const thumbnail = await stat(path.join(root, "public", creative.thumbnail.replace(/^\//, "")));
    assert.ok(thumbnail.size > 1_000, `${creative.thumbnail} is unexpectedly small`);
    assert.ok(thumbnail.size < 100_000, `${creative.thumbnail} is too large for a library thumbnail`);
    for (const adaptation of creative.adaptations) {
      const info = await stat(path.join(root, "public", adaptation.file.replace(/^\//, "")));
      assert.ok(info.size > 5_000, `${adaptation.file} is unexpectedly small`);
      assert.ok(info.size < 5_000_000, `${adaptation.file} exceeds the platform-safe 5 MB limit`);
      totalBytes += info.size;
    }
  }
  assert.ok(totalBytes < 110_000_000, `creative output is unexpectedly heavy: ${totalBytes}`);

  for (const unit of CAPTURE_UNITS) {
    const sample = CREATIVES.find((creative) => creative.unitId === unit.id);
    assert.ok(sample);
    for (const format of CREATIVE_FORMATS) {
      const adaptation = sample.adaptations.find((item) => item.id === format.id);
      assert.ok(adaptation);
      const metadata = await sharp(path.join(root, "public", adaptation.file.replace(/^\//, ""))).metadata();
      assert.equal(metadata.width, format.width);
      assert.equal(metadata.height, format.height);
    }
  }
});

test("canonical pricing and economic formula remain explicit and finite", () => {
  assert.equal(PRICING_SOURCE.evidence, "Dato real");
  assert.equal(PRICING.find((plan) => plan.id === "combo-seo")?.net, 1000);
  const result = calculateEconomics({
    plan: "google", activation: 250, media: 1400, cpl: 48, valid: 45,
    contact: 80, appointment: 70, show: 70, close: 24, ticket: 2200,
    margin: 65, duration: 3, followup: 120, creative: 180, commercial: 200,
    technology: 90,
  });
  assert.ok(Math.abs(result.leads - 87.5) < 0.001);
  assert.equal(result.mediaTotal, 4200);
  assert.equal(result.feeTotal, 1200);
  assert.equal(result.totalCost, 6240);
  assert.ok(Number.isFinite(result.cac));
  assert.ok(Number.isFinite(result.maxCpl));
  assert.ok(Number.isFinite(result.costPerAttended));
  assert.equal(result.maxCostPerSale, 1430);
  assert.equal(calculateEconomics({
    plan: "google", activation: 0, media: 0, cpl: 0, valid: 0, contact: 0,
    appointment: 0, show: 0, close: 0, ticket: 0, margin: 0, duration: 0,
    followup: 0, creative: 0, commercial: 0, technology: 0,
  }).leads, 0);
});

test("economic inputs are bounded and duration changes the complete pilot", () => {
  const input = {
    plan: "google", activation: 0, media: 1000, cpl: 50, valid: 200,
    contact: 100, appointment: 100, show: 100, close: 100, ticket: 1000,
    margin: 50, duration: 2, followup: 0, creative: 0, commercial: 0,
    technology: 0,
  };
  const result = calculateEconomics(input);
  assert.equal(result.leads, 40);
  assert.equal(result.valid, 40);
  assert.equal(result.totalCost, 2800);
  assert.equal(result.maxCostPerAttended, 500);
  assert.equal(calculateEconomics({ ...input, valid: -20 }).valid, 0);
});

test("every campaign points to a native and differentiated landing blueprint", async () => {
  assert.equal(LANDING_BLUEPRINTS.length, 27);
  assert.equal(new Set(LANDING_BLUEPRINTS.map((item) => item.slug)).size, LANDING_BLUEPRINTS.length);
  for (const campaign of CAMPAIGNS) {
    const slug = campaign.landing.split("/").filter(Boolean).at(-1);
    const blueprint = getLandingBlueprint(slug);
    assert.ok(blueprint, `missing landing blueprint for ${campaign.landing}`);
    assert.equal(blueprint.unitId, campaign.unitId);
    assert.equal(blueprint.mode, campaign.mode);
    assert.ok(blueprint.fields.length >= 7);
    assert.ok(blueprint.faq.length >= 4);
    assert.ok(blueprint.sourceFields.includes("gclid"));
    assert.ok(blueprint.sourceFields.includes("landing_route"));
  }
  assert.equal(getLandingBlueprint("vender-coche-con-cargas")?.event, "lead_form_submit_con_cargas");
  assert.equal(getLandingBlueprint("vender-coche-reserva-dominio")?.event, "lead_form_submit_reserva");
  assert.equal(getLandingBlueprint("vender-coche-embargado")?.event, "lead_form_submit_embargo");
  assert.equal(getLandingBlueprint("vender-coche-financiado")?.event, "lead_form_submit_financiado");
  await stat(path.join(root, "app", "landings", "[slug]", "page.tsx"));
});

test("workspace snapshots are versioned, bounded and round-trip without unrelated browser data", () => {
  class MemoryStorage {
    constructor(entries = {}) { this.entries = new Map(Object.entries(entries)); }
    get length() { return this.entries.size; }
    key(index) { return [...this.entries.keys()][index] ?? null; }
    getItem(key) { return this.entries.get(key) ?? null; }
    setItem(key, value) { this.entries.set(key, value); }
  }
  const source = new MemoryStorage({
    [storageKey("campaign-states")]: encodeStoredValue({ "coches-b2c": "En prueba" }),
    "unrelated-setting": "keep-private",
  });
  const snapshot = createExecutionSnapshot(source);
  assert.equal(Object.keys(snapshot.entries).length, 1);
  assert.equal(validateExecutionSnapshot(snapshot), true);
  const target = new MemoryStorage();
  assert.equal(importExecutionSnapshot(target, snapshot), 1);
  assert.deepEqual(decodeStoredValue(target.getItem(storageKey("campaign-states")), {}), { "coches-b2c": "En prueba" });
  assert.equal(validateExecutionSnapshot({ ...snapshot, version: 999 }), false);
  assert.equal(validateExecutionSnapshot({ ...snapshot, entries: { "unrelated-setting": true } }), false);
  assert.equal(decodeStoredValue("not-json", "fallback"), "fallback");
});

test("all eight native execution routes are present without embedded page frames", async () => {
  const routes = ["sistemas", "campanas", "creativos", "biblioteca-creativa", "laboratorio", "experimentos", "decisiones", "aprendizajes"];
  for (const route of routes) await stat(path.join(root, "app", route, "page.tsx"));
  const sources = await Promise.all([
    readFile(path.join(root, "app", "ejecucion", "ExecutionShell.tsx"), "utf8"),
    readFile(path.join(root, "app", "ejecucion", "ExecutionWorkspace.tsx"), "utf8"),
    readFile(path.join(root, "app", "nichos", "page.tsx"), "utf8"),
    readFile(path.join(root, "app", "landings", "[slug]", "LandingBlueprintView.tsx"), "utf8"),
  ]);
  assert.doesNotMatch(sources.join("\n"), /<iframe\b/i);
  assert.doesNotMatch(sources.join("\n"), /MiniMax|Claude|Quién hace qué/i);
});

test("campaign and creative deep links are consumed instead of discarding context", async () => {
  const workspace = await readFile(path.join(root, "app", "ejecucion", "ExecutionWorkspace.tsx"), "utf8");
  assert.match(workspace, /query\.get\("unidad"\)/);
  assert.match(workspace, /query\.get\("modo"\)/);
  assert.match(workspace, /query\.get\("creatividad"\)/);
  assert.match(workspace, /usePersistentState\("campaign-filter-unit"/);
  assert.match(workspace, /usePersistentState\("library-filters"/);
});
