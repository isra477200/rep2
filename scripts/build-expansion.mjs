#!/usr/bin/env node
/**
 * Genera public/data/expansion.json — dossiers por país para la expansión de RedVitalia:
 * datos calculados del catálogo + regulación de llamadas en frío (db/regulacion-llamadas.json)
 * + lectura estratégica editorial (marcada como recomendación, no como dato).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));
const reg = existsSync(resolve(root, "db/regulacion-llamadas.json"))
  ? JSON.parse(readFileSync(resolve(root, "db/regulacion-llamadas.json"), "utf8")).countries || []
  : [];

const TARGETS = [
  { country: "Portugal", priority: 1, why: "Mercado pegado, 30+ fichas ya estudiadas, competencia observada floja en captación gestionada, regulación opt-out clara. El primer paso natural." },
  { country: "México", priority: 2, why: "El LATAM más maduro y el más fácil legalmente (sin lista de exclusión B2B). Ya existen garantías estilo RedVitalia en nichos, pero la captación local gestionada con exclusividad territorial apenas está explotada." },
  { country: "Colombia", priority: 3, why: "Setters ya contratados allí, coste de talento bajo, mercado intermedio en madurez. Base de operaciones natural para servir a toda la región." },
  { country: "Perú", priority: 4, why: "El mercado menos maduro detectado: agencias generalistas educando al cliente. Ventana de entrada más abierta, ticket más bajo." },
  { country: "Chile", priority: 5, why: "Mercado ordenado con appointment setting real (Reuniones LATAM como incumbente). Entrar con garantía de cita válida diferencia desde el día uno." },
  { country: "Argentina", priority: 6, why: "Domina el marketplace de presupuestos; inestabilidad monetaria complica pricing. Solo con cobro en USD." },
  { country: "Dinamarca", priority: 7, why: "B2B en frío expresamente permitido y cultura de pago por reunión ya educada. Mercado pequeño pero de ticket alto; requiere idioma local." },
  { country: "Francia", priority: 8, why: "Mercado enorme y marketplace fuerte (Yoojo), pero regulación endurecida recientemente y competencia densa. Solo con socio local." },
  { country: "Alemania", priority: 9, why: "NO entrar con setters: la llamada en frío B2B exige consentimiento presunto (UWG §7) y la cultura de demandas (Abmahnung) hace el modelo inviable tal cual." },
  { country: "Italia", priority: 10, why: "Registro de oposiciones cubre también empresas y el bloqueo anti-spoofing 2025 penaliza llamar desde fuera. Riesgo alto para el modelo setter." },
];

const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null; };

const dossiers = TARGETS.map((t) => {
  const list = companies.filter((c) => c.primaryCountry === t.country);
  const priced = list.filter((c) => c.price && c.price.eur > 0).map((c) => c.price.eur);
  const threats = list.filter((c) => c.threat === "Alta").length;
  const referents = list
    .filter((c) => c.decision === "Copiar" || c.decision === "Adaptar" || c.decision === "Probar")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, decision: c.decision, score: c.score }));
  const verification = list.filter((c) => c.id.startsWith("amp-")).length;
  const regEntry = reg.find((r) => r.country === t.country) || null;
  return {
    country: t.country,
    priority: t.priority,
    fichas: list.length,
    inVerification: verification,
    medianEur: med(priced),
    pricedN: priced.length,
    highThreats: threats,
    referents,
    regulation: regEntry
      ? {
          b2b: regEntry.b2b_cold_calling,
          requirements: regEntry.requirements,
          recentChanges: regEntry.recent_changes,
          risk: regEntry.risk_level_for_redvitalia,
          sources: regEntry.sources || [],
        }
      : null,
    strategy: t.why,
  };
});

const regulationAll = reg.map((r) => ({
  country: r.country,
  b2b: r.b2b_cold_calling,
  requirements: r.requirements,
  b2cNote: r.b2c_note,
  recentChanges: r.recent_changes,
  risk: r.risk_level_for_redvitalia,
  sources: r.sources || [],
}));

const expansion = {
  generatedAt: "23/08/2026",
  note: "Los números salen del catálogo y la regulación de fuentes públicas verificadas (con nivel confirmado/probable). La columna de estrategia es recomendación editorial de RedVitalia, no un dato.",
  playbook: [
    "1 país + 1 nicho + 1 setter + 90 días. Presupuesto cerrado y criterios de éxito escritos ANTES de empezar.",
    "Entrar con la oferta que aquí nadie da: cita válida garantizada + exclusividad territorial visible.",
    "Precio de entrada: 10% bajo la mediana local con garantía; nunca competir a precio sin garantía.",
    "Cobro en moneda fuerte donde haya inestabilidad (Argentina: USD).",
    "Revisar la ficha de regulación del país ANTES de la primera llamada.",
  ],
  dossiers,
  regulationAll,
};
writeFileSync(resolve(root, "public/data/expansion.json"), JSON.stringify(expansion, null, 1));
console.log(`expansion.json: ${dossiers.length} dossiers · ${regulationAll.length} países con regulación`);
