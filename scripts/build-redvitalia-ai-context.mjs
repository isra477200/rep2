import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPAIGNS, CAPTURE_UNITS, CREATIVES, CREATIVE_FORMATS, PRICING, PRICING_SOURCE, SYSTEMS } from "../app/ejecucion/catalog.ts";
import { CADENCE, CALL_DISPOSITIONS, CLOSER_SCORE, COMMERCIAL_VERTICALS, PIPELINE_STAGES, QA_CALL } from "../app/ejecucion/commercial.ts";
import { LANDING_BLUEPRINTS } from "../app/ejecucion/landing-blueprints.ts";
import { GROWTH_ROUTES } from "../app/sistemas/growth-routes.ts";
import { STRATEGY } from "../app/sistemas/strategy.ts";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(repository, "worker/redvitalia-maestro-context.generated.json");

const navigation = [
  ["/", "Mercado mundial, empresas, expedientes, países, funnels, anuncios y evidencias"],
  ["/entregables", "Documentos comerciales, paquetes de campaña y descargas"],
  ["/operacion-comercial", "Caller, closer, pipeline, cadencia, QA y scorecards B2B"],
  ["/sistemas", "Cartera, estrategia, playbooks A–S, economía, competencia y ejecución"],
  ["/sistemas#/routes", "40 rutas: captar cuenta, intención, demanda y expansión"],
  ["/campanas", "24 campañas B2B/B2C con arquitectura, presupuesto, medición y gate"],
  ["/creativos", "Fábrica de conceptos y adaptaciones"],
  ["/biblioteca-creativa", "Biblioteca filtrable de 144 conceptos y 1.008 adaptaciones"],
  ["/laboratorio", "Economía, sensibilidad, equilibrio y contribución"],
  ["/experimentos", "Hipótesis, criterios de éxito/fallo y resultados"],
  ["/decisiones", "Registro de decisiones con evidencia"],
  ["/aprendizajes", "Memoria operativa y patrones reutilizables"],
  ["/maestro", "Centro de mando conversacional de MiniMax M3"],
];

const systems = SYSTEMS.map((system) => {
  const strategy = STRATEGY[system.id];
  return {
    id: system.id,
    name: system.name,
    rank: system.rank,
    phase: strategy.phase,
    channel: strategy.channel,
    salesCycle: strategy.salesCycle,
    dimensions: strategy.dimensions,
    decisionRule: strategy.decisionRule,
    killCriteria: strategy.killCriteria,
    launchGate: strategy.launchGate,
    routes: (GROWTH_ROUTES[system.id] || []).map((route) => ({
      code: route.code,
      kind: route.kind,
      title: route.title,
      premise: route.premise,
      audience: route.audience,
      offer: route.offer,
      northStar: route.northStar,
      decision: route.decision,
    })),
  };
});

const units = CAPTURE_UNITS.map((unit) => ({
  id: unit.id,
  systemId: unit.systemId,
  name: unit.name,
  problem: unit.problem,
  result: unit.result,
  decisionMaker: unit.decisionMaker,
  offer: unit.offer,
  primaryConversion: unit.primaryConversion,
  qualification: unit.qualification.slice(0, 4),
  rejection: unit.rejection.slice(0, 2),
  subniches: unit.subniches,
  compliance: unit.compliance.slice(0, 2),
}));

const campaigns = CAMPAIGNS.map((campaign) => ({
  id: campaign.id,
  unitId: campaign.unitId,
  mode: campaign.mode,
  objective: campaign.objective,
  channel: campaign.channel,
  budget: campaign.budget,
  landing: campaign.landing,
  primaryConversion: campaign.primaryConversion,
  scaleSignal: campaign.scaleCriteria[0],
  stopSignal: campaign.stopCriteria[0],
}));

const landings = LANDING_BLUEPRINTS.map((landing) => ({
  slug: landing.slug,
  unitId: landing.unitId,
  mode: landing.mode,
  title: landing.title,
  event: landing.event,
  fieldCount: landing.fields.length,
}));

const context = {
  version: 1,
  generatedAt: "2026-09-03",
  identity: {
    owner: "RedVitalia",
    purpose: "Captar empresas que contratan a RedVitalia y operar su publicidad/captación con medición hasta el resultado económico.",
    nonGoal: "No es un sistema para fingir resultados, publicar sin aprobación ni vender directamente al consumidor como si RedVitalia prestara el servicio final.",
  },
  truthModel: {
    canonical: "Tarifas y hechos propios confirmados.",
    evidence: "Señales y expedientes trazables del mercado.",
    synthesis: "Lectura estratégica derivada de la evidencia.",
    hypothesis: "CPL, tasas, presupuestos y previsiones pendientes de validación real.",
    pending: "Marca, permisos, prueba, capacidad, legal, CRM o aprobación que aún debe aportar una persona.",
  },
  safety: [
    "Ninguna campaña, mensaje o publicación sale automáticamente.",
    "La inversión publicitaria se paga aparte de los honorarios.",
    "No usar testimonios, marcas, resultados ni casos sin autorización verificable.",
    "El resultado offline y la contribución deciden; el formulario o el CPL aislado no deciden.",
  ],
  navigation,
  totals: {
    marketRecords: 712,
    systems: SYSTEMS.length,
    captureUnits: CAPTURE_UNITS.length,
    campaigns: CAMPAIGNS.length,
    growthRoutes: Object.values(GROWTH_ROUTES).flat().length,
    landingBlueprints: LANDING_BLUEPRINTS.length,
    creativeConcepts: CREATIVES.length,
    creativeFormats: CREATIVE_FORMATS.length,
    creativeAdaptations: CREATIVES.length * CREATIVE_FORMATS.length,
  },
  pricing: { source: PRICING_SOURCE, plans: PRICING },
  systems,
  units,
  campaigns,
  landings,
  commercialOperation: {
    pipelineStages: PIPELINE_STAGES,
    cadence: CADENCE,
    dispositions: CALL_DISPOSITIONS,
    closerScore: CLOSER_SCORE,
    callQuality: QA_CALL,
    verticals: COMMERCIAL_VERTICALS.map((item) => ({
      id: item.id,
      signal: item.signal,
      opener: item.opener,
      tension: item.tension,
      questions: item.questions.slice(0, 3),
      proof: item.proof.slice(0, 2),
      noGo: item.noGo.slice(0, 2),
    })),
  },
};

const compact = JSON.stringify(context);
if (Buffer.byteLength(compact, "utf8") > 70_000) throw new Error(`AI context exceeds 70 KB: ${Buffer.byteLength(compact, "utf8")}`);
const payload = JSON.stringify({ ...context, sha256: createHash("sha256").update(compact).digest("hex") });
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${payload}\n`, "utf8");
console.log(`RedVitalia Maestro context: ${Buffer.byteLength(payload, "utf8")} bytes.`);
