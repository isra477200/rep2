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

  const proofLine = `Sistema construido sobre el análisis de ${vertical.n} empresas de captación del sector (${vertical.spainN} en España)${vertical.medianEur ? `, con una mediana de mercado de ${vertical.medianEur} €/mes` : ""}. Cada táctica de esta página sale de ese estudio, no de una plantilla.`;

  const cleanUnit = (unit || "clientes").trim() || "clientes";
  const femenina = ["obras", "instalaciones", "consultas", "reuniones", "solicitudes", "reservas", "citas", "ventas", "visitas", "llamadas", "oportunidades"].includes(
    cleanUnit.split(/\s+/)[0].toLocaleLowerCase("es"),
  );
  const guaranteeSuggestion = femenina
    ? `Si el primer mes no recibes las ${cleanUnit} pactadas en tu propuesta, seguimos trabajando gratis hasta conseguirlas. Por contrato, no en un anuncio.`
    : `Si el primer mes no recibes los ${cleanUnit} pactados en tu propuesta, seguimos trabajando gratis hasta conseguirlos. Por contrato, no en un anuncio.`;

  const stats: Array<{ value: string; label: string }> = [
    { value: String(vertical.n), label: "empresas del sector analizadas" },
    vertical.spainN ? { value: String(vertical.spainN), label: "operando en España" } : null,
    vertical.medianEur ? { value: `${vertical.medianEur} €/mes`, label: "mediana de precio del mercado" } : null,
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
    stats,
  };
};

export const applyMarketAmmo = (brief: LandingBrief, ammo: MarketAmmo): LandingBrief => ({
  ...brief,
  proof: ammo.proofLine,
  guarantee: brief.guarantee.trim() ? brief.guarantee : ammo.guaranteeSuggestion,
  marketStats: ammo.stats,
  activeRecipeId: brief.activeRecipeId,
});
