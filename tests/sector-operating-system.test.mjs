import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [source, portal, operationsHub, verticales] = await Promise.all([
  readFile(new URL("../app/SectorOperatingSystem.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/Portal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/OperationsHub.tsx", import.meta.url), "utf8"),
  readFile(new URL("../public/data/verticales.json", import.meta.url), "utf8").then(JSON.parse),
]);

test("cada nicho publicado tiene un perfil operativo", () => {
  for (const vertical of verticales.verticales) {
    assert.match(source, new RegExp(`(?:"${vertical.id}"|${vertical.id.replaceAll("-", "\\-")}):\\s*\\{`));
  }
});

test("el sistema cubre la venta, la entrega y la medición", () => {
  for (const phrase of [
    "Guion de primera llamada",
    "Reunión de diagnóstico",
    "Presentación de 10 diapositivas",
    "Propuesta piloto",
    "Secuencia de seguimiento",
    "Campaña inicial",
    "Landing y formulario",
    "Solicitud de materiales",
    "Entrega y seguimiento de oportunidades",
    "Cuadro de mando y decisión",
  ]) assert.ok(source.includes(phrase), `Falta el entregable: ${phrase}`);
});

test("separa la base preparada del trabajo realmente ejecutado", () => {
  assert.ok(source.includes("BASE ESTRATÉGICA LISTA"));
  assert.ok(source.includes("Pendiente real"));
  assert.ok(source.includes("Hecho por el equipo"));
  assert.ok(source.includes("Los datos competitivos orientan hipótesis"));
});

test("el kit se puede activar con datos de cliente y exportar como entregable", () => {
  for (const phrase of [
    "Empresa cliente",
    "Zona prioritaria",
    "Oferta a vender",
    "Honorarios RedVitalia",
    "rv-sector-client-briefs-v2",
    "Descargar dossier HTML",
    "Anuncios iniciales",
    "/8",
  ]) assert.ok(source.includes(phrase), `Falta la capacidad de activación: ${phrase}`);
});

test("el control de salida bloquea exportaciones incompletas y separa borrador de listo", () => {
  assert.ok(source.includes("disabled={!canExport}"));
  assert.ok(source.includes("BORRADOR INTERNO · NO ENVIAR AL CLIENTE"));
  assert.ok(source.includes("Claims y pruebas aprobados"));
  assert.ok(source.includes("Privacidad preparada"));
  assert.ok(source.includes("SLA, CRM y entrega validados"));
  assert.ok(source.includes("pack.unresolvedTokens.length === 0"));
});

test("el progreso y los espacios de trabajo se aíslan por activación", () => {
  assert.ok(source.includes("`${vertical.id}:${brief.id}:${index}`"));
  assert.ok(source.includes("+ Nueva activación"));
  assert.ok(operationsHub.includes("`launch:${workspaceId}`"));
  assert.ok(operationsHub.includes("saveOperationsWorkspace(seededWorkspace, workspaceKey)"));
});

test("Portal conserva los briefs al abrir Fábrica, Anuncios y Landings", () => {
  assert.ok(portal.includes("setOperationsSeed(context)"));
  assert.ok(portal.includes("workspaceId={operationsWorkspaceId || undefined}"));
  assert.ok(portal.includes("onOpenLandings={openLandingBrief}"));
  assert.ok(portal.includes("onOpenAdLab={(adQuery) => go(\"adlab\", { adQuery })}"));
});
