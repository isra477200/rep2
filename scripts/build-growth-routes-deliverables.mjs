import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_GROWTH_ROUTES, ROUTE_KIND_META, routeFitScore } from "../app/sistemas/growth-routes.ts";
import { STRATEGY } from "../app/sistemas/strategy.ts";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(repository, "public/assets/ejecucion/enablement");

const SYSTEM_NAMES = {
  legal: "Servicios jurídicos",
  toldos: "Toldos y protección solar",
  coches: "Compra de coches con cargas",
  estetica: "Clínicas estéticas",
  climatizacion: "Climatización y aerotermia",
  reformas: "Reformas integrales",
  dental: "Clínicas dentales",
  inmobiliario: "Captación inmobiliaria",
  auditivos: "Centros auditivos y ortopedia",
  logistica: "Mudanzas, contenedores y guardamuebles",
};

const generatedAt = "2026-09-03";
const routes = ALL_GROWTH_ROUTES.map((route) => {
  const strategy = STRATEGY[route.systemId];
  return {
    ...route,
    system: SYSTEM_NAMES[route.systemId],
    phase: strategy.phase,
    routeLabel: ROUTE_KIND_META[route.kind].label,
    scope: ROUTE_KIND_META[route.kind].scope,
    fitScore: Math.round(routeFitScore(route, strategy.dimensions)),
    fitDimensions: ROUTE_KIND_META[route.kind].dimensions,
  };
});

const packageData = {
  title: "Mapa de 40 rutas de crecimiento de RedVitalia",
  generatedAt,
  status: "Síntesis estratégica e hipótesis operativas; validar con datos reales antes de invertir o prometer resultados.",
  model: {
    systems: Object.keys(SYSTEM_NAMES).length,
    routesPerSystem: 4,
    routes: routes.length,
    routeKinds: ROUTE_KIND_META,
  },
  routes,
};

const csvColumns = [
  ["sistema", (item) => item.system],
  ["fase", (item) => item.phase],
  ["codigo", (item) => item.code],
  ["ruta", (item) => item.routeLabel],
  ["ambito", (item) => item.scope],
  ["titulo", (item) => item.title],
  ["encaje_modelo", (item) => item.fitScore],
  ["premisa", (item) => item.premise],
  ["audiencia", (item) => item.audience],
  ["senal_entrada", (item) => item.trigger],
  ["oferta", (item) => item.offer],
  ["canales", (item) => item.channels.join(" | ")],
  ["embudo", (item) => item.funnel.join(" → ")],
  ["metrica_norte", (item) => item.northStar],
  ["regla_decision", (item) => item.decision],
  ["activos", (item) => item.assets.join(" | ")],
  ["cualificacion", (item) => item.qualification.join(" | ")],
  ["evidencia", (item) => item.evidence.join(" | ")],
  ["limites", (item) => item.guardrails.join(" | ")],
];

const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = [
  csvColumns.map(([header]) => escapeCell(header)).join(";"),
  ...routes.map((item) => csvColumns.map(([, select]) => escapeCell(select(item))).join(";")),
].join("\r\n");

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, "10-MAPA-40-RUTAS-REDVITALIA.json"), `${JSON.stringify(packageData, null, 2)}\n`, "utf8"),
  writeFile(resolve(outputDirectory, "10-MAPA-40-RUTAS-REDVITALIA.csv"), `\ufeff${csv}\r\n`, "utf8"),
]);

console.log(`Generated ${routes.length} routes in JSON and CSV.`);
