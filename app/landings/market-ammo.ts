/**
 * Munición del mercado para el generador de landings: destila del arsenal
 * (garantías y titulares reales), de los cruces (SLA, mediana) y del mapa de
 * verticales las piezas listas para inyectar en un brief. Cada pieza cita la
 * empresa de la que sale; nada se inventa.
 */
import type { ArsenalData, CrucesData, VerticalesData } from "../data-types";
import type { LandingBrief } from "./model";

export type AmmoQuote = { text: string; company: string; extra?: string };

export type MarketAmmo = {
  verticalId: string;
  label: string;
  n: number;
  spainN: number;
  medianEur: number | null;
  slaTop: { name: string; sla: string } | null;
  guarantees: AmmoQuote[];
  headlines: AmmoQuote[];
  proofLine: string;
  guaranteeSuggestion: string;
  priceSuggestion: string | null;
  stats: Array<{ value: string; label: string }>;
};

export const buildMarketAmmo = (
  verticalId: string,
  verticales: VerticalesData | null,
  arsenal: ArsenalData | null,
  cruces: CrucesData | null,
  unit: string,
): MarketAmmo | null => {
  if (!verticales) return null;
  const vertical = verticales.verticales.find((v) => v.id === verticalId);
  if (!vertical) return null;
  const map = verticales.map || {};
  const inVertical = (id: string) =>
    verticalId === "generalista" ? (map[id] || "generalista") === "generalista" : map[id] === verticalId;

  const guarantees: AmmoQuote[] = (arsenal?.garantias.items || [])
    .filter((g) => inVertical(g.id) && g.fuerza >= 3)
    .sort((a, b) => b.fuerza - a.fuerza || a.coste - b.coste || b.score - a.score)
    .slice(0, 4)
    .map((g) => ({ text: g.text, company: `${g.name} · ${g.country}`, extra: `fuerza ${g.fuerza}/5 · coste ${g.coste}/5` }));

  const headlines: AmmoQuote[] = (arsenal?.titulares.items || [])
    .filter((t) => inVertical(t.id) && t.score >= 80 && t.headline.length > 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((t) => ({ text: t.headline, company: `${t.name} · ${t.country}`, extra: t.formulas.join(" · ") || "sin fórmula clara" }));

  const slaEntry = (cruces?.slas.top || []).find((s) => inVertical(s.id)) || (cruces?.slas.top || [])[0] || null;

  // Una mediana muy baja delata que el vertical mezcla cuotas mensuales con precio
  // por lead: se etiqueta como tal para no vender una cuota irreal.
  const medianaFrase = vertical.medianEur
    ? vertical.medianEur >= 100
      ? `, con una mediana de mercado de ${vertical.medianEur} €/mes`
      : `, con un precio por contacto observado en torno a ${vertical.medianEur} €`
    : "";
  const proofLine = `Sistema construido sobre el análisis de ${vertical.n} empresas de captación del sector (${vertical.spainN} en España)${medianaFrase}. Cada táctica de esta página sale de ese estudio, no de una plantilla.`;

  // El corpus mezcla cuotas, precios por lead y otros modelos. Sirve como benchmark,
  // pero no autoriza a inventar el precio ni la garantía de RedVitalia.
  const priceSuggestion = null;
  const guaranteeSuggestion = "";
  void unit;

  const stats: Array<{ value: string; label: string }> = [
    { value: String(vertical.n), label: "empresas del sector analizadas" },
    vertical.spainN ? { value: String(vertical.spainN), label: "operando en España" } : null,
    vertical.medianEur
      ? vertical.medianEur >= 100
        ? { value: `${vertical.medianEur} €/mes`, label: "mediana de precio del mercado" }
        : { value: `${vertical.medianEur} €`, label: "precio por contacto observado (mediana)" }
      : null,
    slaEntry ? { value: slaEntry.sla, label: `SLA más agresivo (${slaEntry.name})` } : null,
  ].filter((s): s is { value: string; label: string } => Boolean(s)).slice(0, 4);

  return {
    verticalId,
    label: vertical.label,
    n: vertical.n,
    spainN: vertical.spainN,
    medianEur: vertical.medianEur,
    slaTop: slaEntry ? { name: slaEntry.name, sla: slaEntry.sla } : null,
    guarantees,
    headlines,
    proofLine,
    guaranteeSuggestion,
    priceSuggestion,
    stats,
  };
};

export const applyMarketAmmo = (brief: LandingBrief, ammo: MarketAmmo): LandingBrief => ({
  ...brief,
  // Los datos de competidores son contexto, no prueba de resultados propios.
  // Precio, prueba y garantía solo pueden venir del brief aprobado por el usuario.
  marketStats: ammo.stats.filter(
    (item) => !/precio|€\s*\/\s*mes|por contacto/i.test(`${item.value} ${item.label}`),
  ),
  activeRecipeId: brief.activeRecipeId,
});
