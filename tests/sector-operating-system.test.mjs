import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [source, verticales] = await Promise.all([
  readFile(new URL("../app/SectorOperatingSystem.tsx", import.meta.url), "utf8"),
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
    "Seguimiento al cliente",
    "Matriz de campaña inicial",
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
    "datos mínimos para lanzar",
    "rv-sector-client-briefs-v1",
    "Descargar dossier HTML",
    "Anuncios iniciales",
  ]) assert.ok(source.includes(phrase), `Falta la capacidad de activación: ${phrase}`);
});
