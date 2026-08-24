export const AD_ALIAS_ENTRIES = [
  ["compra-leads", "compra-leads-ou", "Mismo ID Meta 1567766664997071 ya documentado en la ficha canónica."],
  ["cronoshare-maxory", "cronoshare", "La observación identifica expresamente Cronoshare; Maxory se conserva como nota de rebranding."],
  ["docmedia-marketing-dental", "amp-docmedia-es", "Misma marca DOCMEDIA/Docmedia."],
  ["doctoralia", "doctoralia-grupo-docplanner", "Misma marca y dominio doctoralia.es."],
  ["idealleader-io", "idealleader", "Misma marca y dominio idealleader.io."],
  ["inmomax-es", "inmomax", "Misma marca y dominio inmomax.es."],
  ["ivandebenito", "ivan-de-benito", "Misma identidad; solo cambia la normalización del slug."],
  ["kaizex-especialistas-en-seo-local", "kaizex", "Misma marca KAIZEX."],
  ["level-up-agency-vera", "level-up-agency", "Misma marca LEVEL UP AGENCY (VERA)."],
  ["presupuestos-com", "amp-presupuestos-com", "Misma marca y dominio presupuestos.com."],
];

export const AD_ALIASES = new Map(
  AD_ALIAS_ENTRIES.map(([alias, canonical]) => [alias, canonical]),
);

if (AD_ALIASES.size !== AD_ALIAS_ENTRIES.length)
  throw new Error("ad-aliases: hay alias duplicados");
for (const [alias, canonical] of AD_ALIASES) {
  if (!alias || !canonical || alias === canonical)
    throw new Error(`ad-aliases: relación inválida ${alias} -> ${canonical}`);
  if (AD_ALIASES.has(canonical))
    throw new Error(`ad-aliases: no se permiten cadenas ${alias} -> ${canonical}`);
}

export const canonicalAdCompanyId = (id) => {
  let current = id;
  const visited = new Set();
  while (AD_ALIASES.has(current)) {
    if (visited.has(current))
      throw new Error(`ad-aliases: ciclo detectado desde ${id}`);
    visited.add(current);
    current = AD_ALIASES.get(current);
  }
  return current;
};
