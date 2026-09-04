import assert from "node:assert/strict";
import test from "node:test";
import {
  ACQUISITION_SAFETY_SHARE,
  calculateEconomics,
  parseNumber,
} from "../app/sector-launch-model.ts";

const validInput = {
  averageTicket: "2.500 €",
  grossMarginPct: "40",
  closeRatePct: "20",
  monthlyCapacity: "20",
  pilotBudget: "1.500",
  serviceFee: "750",
};

test("normaliza importes españoles sin mezclar miles y decimales", () => {
  assert.equal(parseNumber("2.500 €"), 2500);
  assert.equal(parseNumber("1.250,50"), 1250.5);
  assert.equal(parseNumber("35%"), 35);
});

test("separa medios, honorarios y coste total del piloto", () => {
  const result = calculateEconomics(validInput);
  assert.equal(result.valid, true);
  assert.equal(result.viable, true);
  assert.equal(result.contributionPerSale, 1000);
  assert.equal(result.valuePerOpportunity, 200);
  assert.equal(result.maxAcquisitionCost, 200 * ACQUISITION_SAFETY_SHARE);
  assert.equal(result.totalPilotCost, 2250);
  assert.equal(result.targetOpportunities, 20);
  assert.equal(result.expectedSales, 4);
  assert.equal(result.expectedContribution, 4000);
  assert.equal(result.expectedNetContribution, 1750);
});

test("un presupuesto inferior a una oportunidad no inventa capacidad", () => {
  const result = calculateEconomics({ ...validInput, pilotBudget: "50" });
  assert.equal(result.valid, true);
  assert.equal(result.viable, false);
  assert.equal(result.targetOpportunities, 0);
  assert.equal(result.expectedSales, 0);
  assert.match(result.capacityWarning, /no alcanza ni una oportunidad/i);
});

test("no declara válida la economía si faltan los honorarios de RedVitalia", () => {
  const result = calculateEconomics({ ...validInput, serviceFee: "" });
  assert.equal(result.valid, false);
});

test("rechaza porcentajes imposibles y avisa cuando el piloto pierde dinero", () => {
  assert.equal(calculateEconomics({ ...validInput, grossMarginPct: "120" }).valid, false);
  const loss = calculateEconomics({ ...validInput, averageTicket: "500", serviceFee: "3000" });
  assert.equal(loss.valid, true);
  assert.equal(loss.viable, false);
  assert.ok(loss.expectedNetContribution < 0);
  assert.match(loss.capacityWarning, /no cubre el coste total/i);
});
