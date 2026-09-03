import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  CAMPAIGNS,
  CAPTURE_UNITS,
  CREATIVES,
  CREATIVE_FORMATS,
  PRICING,
  PRICING_SOURCE,
  SYSTEMS,
} from "../app/ejecucion/catalog.ts";
import { calculateEconomics } from "../app/ejecucion/economics.ts";

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
});

test("creative inventory reaches the requested depth and every adaptation exists", async () => {
  assert.equal(CREATIVE_FORMATS.length, 7);
  assert.equal(CREATIVES.length, 144);
  assert.equal(new Set(CREATIVES.map((creative) => creative.id)).size, 144);
  for (const unit of CAPTURE_UNITS) {
    const unitCreatives = CREATIVES.filter((creative) => creative.unitId === unit.id);
    assert.equal(unitCreatives.length, 12);
    assert.equal(unitCreatives.filter((creative) => creative.mode === "B2B").length, 6);
    assert.equal(unitCreatives.filter((creative) => creative.mode === "B2C").length, 6);
  }
  for (const creative of CREATIVES) {
    assert.equal(creative.adaptations.length, 7);
    for (const adaptation of creative.adaptations) {
      const info = await stat(path.join(root, "public", adaptation.file.replace(/^\//, "")));
      assert.ok(info.size > 5_000, `${adaptation.file} is unexpectedly small`);
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
  assert.ok(Math.abs(result.leads - 29.1666666667) < 0.001);
  assert.equal(result.totalCost, 2640);
  assert.ok(Number.isFinite(result.cac));
  assert.ok(Number.isFinite(result.maxCpl));
  assert.equal(calculateEconomics({
    plan: "google", activation: 0, media: 0, cpl: 0, valid: 0, contact: 0,
    appointment: 0, show: 0, close: 0, ticket: 0, margin: 0, duration: 0,
    followup: 0, creative: 0, commercial: 0, technology: 0,
  }).leads, 0);
});

test("all eight native execution routes are present without embedded page frames", async () => {
  const routes = ["sistemas", "campanas", "creativos", "biblioteca-creativa", "laboratorio", "experimentos", "decisiones", "aprendizajes"];
  for (const route of routes) await stat(path.join(root, "app", route, "page.tsx"));
  const sources = await Promise.all([
    readFile(path.join(root, "app", "ejecucion", "ExecutionShell.tsx"), "utf8"),
    readFile(path.join(root, "app", "ejecucion", "ExecutionWorkspace.tsx"), "utf8"),
    readFile(path.join(root, "app", "nichos", "page.tsx"), "utf8"),
  ]);
  assert.doesNotMatch(sources.join("\n"), /<iframe\b/i);
  assert.doesNotMatch(sources.join("\n"), /MiniMax|Claude|Quién hace qué/i);
});
