// Snapshot único para la ampliación. La actualización solo debe hacerse desde la
// fuente canónica; ninguna ficha de sistema conserva otra copia editable.
export const PRICING_SOURCE = {
  name: "Tarifas oficiales Red Vitalia",
  url: "https://app.notion.com/p/360f1447360c80ec93cae6183e599a37",
  sourceLastEditedAt: "2026-05-14T09:49:41.888Z",
  verifiedAt: "2026-09-03",
  evidence: "Dato real" as const,
};

export const PRICING = [
  { id: "google", name: "Google Ads", net: 400, vat: 84, total: 484 },
  { id: "meta", name: "Meta Ads", net: 450, vat: 94.5, total: 544.5 },
  { id: "combo", name: "Google + Meta Ads", net: 750, vat: 157.5, total: 907.5 },
  { id: "combo-seo", name: "Google + Meta Ads + SEO básico", net: 1000, vat: 210, total: 1210 },
  { id: "setter", name: "Setter", net: 250, vat: 52.5, total: 302.5 },
] as const;
