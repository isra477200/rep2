#!/usr/bin/env node
/**
 * Idea 8: emparejador mystery → hipótesis. Para cada objetivo del mystery
 * shopping, calcula qué datos le FALTAN a su ficha y las preguntas exactas
 * que la llamada debe responder. Añade `hipotesis` a cada target de mystery.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const mysteryPath = resolve(root, "public/data/mystery.json");
const mystery = JSON.parse(readFileSync(mysteryPath, "utf8"));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const byId = new Map(companies.map((c) => [c.id, c]));

for (const target of mystery.targets || []) {
  const c = byId.get(target.id);
  if (!c) continue;
  const hipotesis = [];
  if (c.price?.eur == null)
    hipotesis.push(`PRECIO REAL: su ficha no tiene precio convertible («${(c.priceLocal || "no publicado").slice(0, 90)}»). Sacar cifra exacta, qué incluye y si separa fee de inversión publicitaria.`);
  else
    hipotesis.push(`PRECIO: verificar si el publicado (${c.priceLocal.slice(0, 80)}) es el que dicen por teléfono o hay recargos/planes ocultos.`);
  if ((c.guarantee || "").length < 30)
    hipotesis.push("GARANTÍA: no consta ninguna en público. Preguntar literal: «¿y si no llegan los resultados, qué pasa?» y anotar la respuesta exacta.");
  else
    hipotesis.push(`GARANTÍA: dicen «${c.guarantee.slice(0, 90)}…». Confirmar si está en el contrato o es promesa verbal, y qué condiciones tiene.`);
  if ((c.contract || "").length < 20)
    hipotesis.push("PERMANENCIA: sin datos públicos. Preguntar duración mínima, renovación automática y ventana de baja.");
  else
    hipotesis.push(`PERMANENCIA: verificar «${c.contract.slice(0, 80)}» y buscar la renovación automática en su propuesta.`);
  hipotesis.push("VELOCIDAD Y EQUIPO: cronometrar cuánto tardan en responder y preguntar quién ejecuta (equipo propio vs subcontrata).");
  if ((c.metaAds || 0) === 0 && (c.googleAds || 0) === 0)
    hipotesis.push("CAPTACIÓN PROPIA: sin anuncios activos verificados — preguntar de dónde sacan los leads que prometen (señal de reventa de leads de terceros).");
  target.hipotesis = hipotesis;
}

writeFileSync(mysteryPath, JSON.stringify(mystery, null, 1) + "\n");
console.log(`mystery.json: hipótesis añadidas a ${(mystery.targets || []).length} objetivos`);
