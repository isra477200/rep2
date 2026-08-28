import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildLandingHtml,
  buildOperationLandingBrief,
  buildOperationMarkdown,
  defaultOperationContext,
} from "../app/operations-model.ts";

const source = (name) =>
  readFile(new URL(`../app/${name}`, import.meta.url), "utf8");

const completeContext = {
  ...defaultOperationContext,
  name: "Clínicas Madrid · validación",
  market: "España",
  vertical: "clínicas dentales",
  landingVerticalId: "clinicas-salud",
  zone: "Madrid",
  service: "captación, cualificación y agenda",
  audience: "clínicas dentales con capacidad para nuevas primeras visitas",
  pain: "solicitudes sin contexto que se enfrían antes del primer contacto",
  result: "más conversaciones con pacientes que encajan y seguimiento visible",
  offer: "Campaña, landing, cualificación, entrega trazable y revisión semanal.",
  proof: "Caso Clínica Norte: 42 solicitudes observadas entre enero y marzo de 2026.",
  formFields: "5",
  price: "1200",
  appointments: "20",
  slaMinutes: "5",
  guarantee: "remedy",
  exclusivity: "territory",
  strategicAxis: "exclusivity",
  sourcePlaybook: "Clínicas y salud",
  sourcePattern: "Diagnóstico o auditoría",
  sourceHypothesis: "Comparar diagnóstico con contacto genérico.",
  contactUrl: "https://cal.com/redvitalia/diagnostico",
  legalName: "RedVitalia",
  privacyUrl: "https://example.com/privacidad",
  cookiesUrl: "https://example.com/cookies",
  leadEndpoint: "https://example.com/api/leads",
  leadEndpointVerified: true,
  gtmId: "GTM-ABC1234",
  trackingVerified: true,
};

test("la Fábrica 360 usa el motor V3 y conserva un único brief de campaña", () => {
  const brief = buildOperationLandingBrief(completeContext);
  assert.equal(brief.verticalId, "clinicas-salud");
  assert.equal(brief.audience, completeContext.audience);
  assert.equal(brief.formFieldsTarget, 5);
  assert.equal(brief.leadEndpointVerified, true);
  assert.equal(brief.trackingVerified, true);

  const html = buildLandingHtml(completeContext);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /class="lead-form"/);
  assert.match(html, /intent_cluster/);
  assert.doesNotMatch(html, /font-family:Arial/);
});

test("el paquete contiene Meta, Google, funnel, tracking y regla de experimento", () => {
  const markdown = buildOperationMarkdown(completeContext, null, []);
  for (const heading of [
    "## Meta Ads",
    "## Google Ads",
    "## Funnel y formulario",
    "## Lista de validación antes de publicar",
    "## Regla de verdad",
  ]) {
    assert.match(markdown, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(markdown, /view_landing → form_start → lead_submit/);
  assert.match(markdown, /La palabra ganador exige test cerrado/i);
});

test("Growth Lab reúne oportunidades, patrones, recorridos, benchmark y constructor", async () => {
  const decision = await source("DecisionCenter.tsx");
  for (const area of ["Oportunidades", "Patrones", "Recorridos", "Benchmark", "Playbooks", "Constructor"])
    assert.match(decision, new RegExp(`label: "${area}"`));
  assert.match(decision, /CompetitiveBenchmark/);
  assert.match(decision, /CampaignLaunchpad/);
});

test("el recorrido termina en entrega privada no observada y no la marca como fuga", async () => {
  const audit = await source("AdLandingAuditPanel.tsx");
  assert.match(audit, /Entrega y nurture/);
  assert.match(audit, /Etapa privada no observada/);
  assert.match(audit, /posterior al envío nunca se califica como fuga/);
});

test("las referencias de la Fábrica se deduplican por empresa y mercado", async () => {
  const factory = await source("OperationFactoryPanel.tsx");
  assert.match(factory, /new Map<string, AnuncioReal>/);
  assert.match(factory, /normalize\(item\.country \|\| ""\) !== normalize\(market\)/);
  assert.match(factory, /uniqueCompanies\.has\(item\.id\)/);
  assert.match(factory, /EMPRESAS DISTINTAS CON REFERENCIA APTA/);
});

test("los generadores legados ya no presentan el score editorial como rendimiento", async () => {
  const patterns = await readFile(
    new URL("../scripts/build-patterns.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(patterns, /Detector de patrones ganadores/i);
  assert.doesNotMatch(patterns, /Precio público, señal de ganador/i);
  assert.match(patterns, /no una prueba de conversión o rentabilidad/i);
});
