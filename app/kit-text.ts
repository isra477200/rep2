/**
 * Tipos y serializador de texto del Kit de salida al mercado (dossier.json).
 * Compartido entre el Dossier de negocio (UI) y el Landing Studio (pack ZIP).
 */

export type KitPaso = { fase: string; texto: string };
export type KitObjecion = { objecion: string; respuesta: string };
export type KitGuion = { titulo: string; para: string; pasos: KitPaso[]; objeciones: KitObjecion[] };
export type KitEmail = { id: string; cuando: string; asunto: string; cuerpo: string };
export type KitAdGroup = { nombre: string; keywords: string[]; nota: string };
export type KitGoogle = {
  campana: string;
  estructura: string;
  keywords: Array<{ kw: string; concordancia: string }>;
  adGroups?: KitAdGroup[];
  negativas: string[];
  titulares: string[];
  descripciones: string[];
  callouts: string[];
  sitelinks: Array<{ texto: string; descripcion: string }>;
  nota: string;
};
export type KitMetaAd = {
  nombre: string;
  angulo: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  imagenPrompt: string;
  imagenPromptAlt?: string;
  notaChatGPT: string;
};
export type KitMeta = { campana: string; nota: string; anuncios: KitMetaAd[] };
export type KitWhatsapp = { cuando: string; texto: string };
export type KitPropuesta = { titulo: string; nota: string; texto: string };
export type Kit = {
  etiqueta: string;
  senales?: string;
  llamadaFria: KitGuion;
  closer: KitGuion;
  emails: KitEmail[];
  whatsapp?: KitWhatsapp[];
  propuesta?: KitPropuesta;
  googleAds: KitGoogle;
  metaAds: KitMeta;
};

export const guionToText = (guion: KitGuion) =>
  [
    guion.titulo,
    guion.para,
    "",
    ...guion.pasos.map((paso) => `${paso.fase}\n${paso.texto}\n`),
    "OBJECIONES",
    ...guion.objeciones.map((o) => `${o.objecion}\n→ ${o.respuesta}\n`),
  ].join("\n");

export const kitToText = (label: string, kit: Kit) =>
  [
    `KIT DE SALIDA AL MERCADO · RedVitalia · ${label}`,
    kit.etiqueta,
    "",
    "══════ 1 · GUION DE LLAMADA EN FRÍO ══════",
    guionToText(kit.llamadaFria),
    "",
    "══════ 2 · GUION DEL CLOSER ══════",
    guionToText(kit.closer),
    "",
    "══════ 3 · SECUENCIA DE EMAILS ══════",
    ...kit.emails.map((e) => `[${e.cuando}]\nAsunto: ${e.asunto}\n\n${e.cuerpo}\n`),
    "",
    ...(kit.whatsapp?.length
      ? ["", "══════ 3B · SEGUIMIENTO POR WHATSAPP ══════", ...kit.whatsapp.map((w) => `[${w.cuando}]\n${w.texto}\n`)]
      : []),
    ...(kit.propuesta
      ? ["", "══════ 3C · PLANTILLA DE PROPUESTA COMERCIAL ══════", kit.propuesta.nota, "", kit.propuesta.texto]
      : []),
    "",
    "══════ 4 · CAMPAÑA GOOGLE ADS ══════",
    `Campaña: ${kit.googleAds.campana}`,
    kit.googleAds.estructura,
    ...(kit.googleAds.adGroups?.length
      ? kit.googleAds.adGroups.map((g) => `\n${g.nombre}\nKeywords: ${g.keywords.map((k) => `"${k}"`).join(" · ")}\n${g.nota}`)
      : [`\nKeywords (${kit.googleAds.keywords[0]?.concordancia}):\n${kit.googleAds.keywords.map((k) => `"${k.kw}"`).join("\n")}`]),
    `\nNegativas:\n${kit.googleAds.negativas.join(", ")}`,
    `\nTitulares RSA (≤30):\n${kit.googleAds.titulares.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
    `\nDescripciones (≤90):\n${kit.googleAds.descripciones.map((d, i) => `${i + 1}. ${d}`).join("\n")}`,
    `\nCallouts: ${kit.googleAds.callouts.join(" · ")}`,
    `\nSitelinks:\n${kit.googleAds.sitelinks.map((s) => `- ${s.texto}: ${s.descripcion}`).join("\n")}`,
    kit.googleAds.nota,
    "",
    "══════ 5 · CAMPAÑA META ADS ══════",
    `Campaña: ${kit.metaAds.campana}`,
    kit.metaAds.nota,
    ...kit.metaAds.anuncios.map((ad) =>
      [
        `\n—— ${ad.nombre} (${ad.angulo}) ——`,
        `TEXTO PRINCIPAL:\n${ad.primaryText}`,
        `TITULAR: ${ad.headline}`,
        `DESCRIPCIÓN: ${ad.description}`,
        `CTA: ${ad.cta}`,
        `PROMPT DE IMAGEN (opción foto):\n${ad.imagenPrompt}`,
        ...(ad.imagenPromptAlt ? [`PROMPT DE IMAGEN (opción cartel tipográfico):\n${ad.imagenPromptAlt}`] : []),
        ad.notaChatGPT,
      ].join("\n\n"),
    ),
  ].join("\n");
