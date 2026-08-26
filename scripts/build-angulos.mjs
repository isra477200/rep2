#!/usr/bin/env node
/**
 * Analiza los anuncios reales transcritos y saca conclusiones agregadas:
 * qué ángulos dominan, qué CTAs se usan, cuánta cifra y garantía lleva el copy.
 * Escribe public/data/angulos-anuncios.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { items } = JSON.parse(readFileSync(resolve(root, "public/data/anuncios-reales.json"), "utf8"));

const norm = (p) => {
  const s = (p || "").toLowerCase();
  if (s.includes("instagram")) return "Instagram (patrocinado)";
  if (s.includes("meta")) return "Meta Ads Library";
  if (s.includes("google") || s.includes("transparencia")) return "Google";
  if (s.includes("display")) return "Display";
  return "Otra";
};

const plataformas = {};
for (const a of items) plataformas[norm(a.plataforma)] = (plataformas[norm(a.plataforma)] || 0) + 1;

// ángulos: separa por comas/; y cuenta términos normalizados
const angulos = {};
for (const a of items) {
  for (let raw of (a.angulo || "").split(/[,;+·]| \+ /)) {
    raw = raw.trim().toLowerCase().replace(/^(ángulo|angulo):?\s*/, "");
    if (raw.length < 4) continue;
    angulos[raw] = (angulos[raw] || 0) + 1;
  }
}
const topAngulos = Object.entries(angulos).sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= 2).slice(0, 20)
  .map(([label, n]) => ({ label, n }));

const ctas = {};
for (const a of items) {
  let c = (a.cta || "").trim().toLowerCase();
  if (!c || c === "—") continue;
  if (c.includes("más información") || c.includes("more info") || c.includes("learn more")) c = "más información / learn more";
  else if (c.includes("registr") || c.includes("sign")) c = "registrarse";
  else if (c.includes("solicitud") || c.includes("solicita")) c = "enviar solicitud";
  else if (c.includes("whatsapp")) c = "whatsapp directo";
  else if (c.includes("comprar") || c.includes("shop") || c.includes("oferta")) c = "comprar / oferta";
  else if (c.includes("llama") || c.includes("call")) c = "llamar";
  else if (c.includes("descarga") || c.includes("download")) c = "descargar";
  else if (c.includes("ver ") || c.includes("watch")) c = "ver más / watch";
  else if (c.includes("http") || c.includes(".com") || c.includes(".es") || c.includes(".net")) c = "enlace a web";
  ctas[c] = (ctas[c] || 0) + 1;
}
const topCtas = Object.entries(ctas).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, n]) => ({ label, n }));

const conCifra = items.filter((a) => /\d/.test(a.titular + " " + a.texto)).length;
const conEuro = items.filter((a) => /(€|\beuros?\b)/i.test(a.titular + " " + a.texto)).length;
const conGarantia = items.filter((a) => /(garant|devolv|devoluc|no pagas|gratis hasta|trabajamos gratis|o no cobramos)/i.test(a.titular + " " + a.texto)).length;
const conPregunta = items.filter((a) => /¿/.test(a.titular + " " + a.texto)).length;
const conUrgencia = items.filter((a) => /(plazas limitadas|últim|solo \d|antes del|hasta el \d|por tiempo limitado|vuelan)/i.test(a.titular + " " + a.texto)).length;
const conExclusividad = items.filter((a) => /(exclusiv|una sola|un[ao]? únic|por zona|por ciudad|por localidad)/i.test(a.titular + " " + a.texto)).length;
const enVivo = items.filter((a) => a.capturaEnVivo).length;
const pct = (n) => Math.round((n / items.length) * 100);

const data = {
  generatedAt: "23/08/2026",
  nota: "Análisis calculado sobre los " + items.length + " anuncios reales transcritos (galerías + capturas en vivo). Los porcentajes salen del texto literal de cada pieza.",
  total: items.length,
  enVivo,
  plataformas: Object.entries(plataformas).sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n })),
  topAngulos,
  topCtas,
  senales: [
    { label: "Llevan al menos una cifra en el copy", n: conCifra, pct: pct(conCifra) },
    { label: "Mencionan precio o euros explícitos", n: conEuro, pct: pct(conEuro) },
    { label: "Prometen garantía o devolución", n: conGarantia, pct: pct(conGarantia) },
    { label: "Abren con pregunta directa", n: conPregunta, pct: pct(conPregunta) },
    { label: "Usan urgencia o escasez", n: conUrgencia, pct: pct(conUrgencia) },
    { label: "Venden exclusividad territorial", n: conExclusividad, pct: pct(conExclusividad) },
  ],
  findings: [
    `El ${pct(conCifra)}% de los anuncios reales lleva cifras en el copy: el mercado compite con números, no con adjetivos. Un anuncio de RedVitalia sin cifra concreta sale en desventaja.`,
    `Solo el ${pct(conGarantia)}% promete garantía o devolución en el propio anuncio: prometer garantía por escrito YA en el anuncio sigue siendo terreno poco disputado.`,
    `La exclusividad territorial aparece en el ${pct(conExclusividad)}% de las piezas: es el ángulo diferencial más barato de copiar y el que más usan los nuevos entrantes (Veltavia, Reforleads, Mas que Reformas).`,
  ],
};

writeFileSync(resolve(root, "public/data/angulos-anuncios.json"), JSON.stringify(data, null, 1) + "\n");
console.log(`angulos-anuncios.json: ${items.length} piezas · ${topAngulos.length} ángulos · ${topCtas.length} CTAs`);
