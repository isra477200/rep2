import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve, sep } from "node:path";
import { buildPublicIdentityMap } from "./public-identity.mjs";

const dataDir = "public/data";
const sourceDir = "../portal-source-snapshot";
const sourceFileNames = await readdir(sourceDir);
const readMany = async (pattern) => {
  const files = sourceFileNames.filter(x => pattern.test(x)).sort();
  const chunks = await Promise.all(files.map(f => readFile(`${sourceDir}/${f}`, "utf8").then(JSON.parse)));
  return chunks.flat();
};

const companiesRaw = await readMany(/^companies-\d+\.json$/);
const detailsRaw = await readMany(/^details-\d+\.json$/);
const mediaRaw = await readMany(/^media-map-\d+\.json$/);
const fx = JSON.parse(await readFile(`${dataDir}/fx.json`, "utf8"));
let publicLocationById = new Map();
try {
  const publicLocations = JSON.parse(await readFile(`${dataDir}/company-locations.json`, "utf8"));
  publicLocationById = new Map((publicLocations.locations || []).map((location) => [location.companyId, location]));
} catch {
  publicLocationById = new Map();
}
const normalizedInternalId = (value) => String(value || "").replaceAll("-", "");
const nameFromRow = (row) => {
  const internalId = normalizedInternalId(row.id);
  return internalId === "3c0f1447360c81d4ac71c1f0c1ab9ca1"
    ? "Dalil Iraq"
    : row["Empresa / marca"] || row.Registro || "Sin nombre";
};
const publicIds = await buildPublicIdentityMap(
  companiesRaw.map((row) => ({
    internalId: normalizedInternalId(row.id),
    name: nameFromRow(row),
    domain: row.Dominio || row["URL principal"] || "",
    country: row["País / mercado exacto"] || "",
  })),
);
const dashedUuid = (value) => `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
const internalIdPattern = new RegExp(
  [...publicIds.keys()].flatMap((id) => [id, dashedUuid(id)]).sort((a, b) => b.length - a.length).join("|"),
  "gi",
);
const replaceInternalIds = (value) =>
  String(value || "").replace(internalIdPattern, (match) =>
    publicIds.get(match.toLowerCase().replaceAll("-", "")) || "",
  );

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const publicMediaDir = resolve("public/media");
const publicMediaFiles = await readdir(publicMediaDir);
const publicMediaByStem = new Map(
  publicMediaFiles.map((file) => [file.replace(/\.[^.]+$/, ""), file]),
);
let classificationOverrides = new Map();
try {
  const classificationReview = JSON.parse(
    await readFile("research/deep/classification-review-excluded.json", "utf8"),
  );
  if (classificationReview.qa?.passed) {
    classificationOverrides = new Map(
      (classificationReview.records || []).map((record) => [record.id, record]),
    );
  }
} catch {
  classificationOverrides = new Map();
}

const detailById = new Map(detailsRaw.map(x => [x.id.replaceAll("-", ""), x]));
const mediaById = new Map();
for (const item of mediaRaw.filter(x => x.ok && x.file)) {
  const internalId = normalizedInternalId(item.companyId);
  const publicId = publicIds.get(internalId);
  if (!publicId) throw new Error(`Activo sin identidad pública: ${internalId}`);
  const internalStem = `${internalId}-${String(item.order).padStart(3, "0")}`;
  const publicStem = `${publicId}-${String(item.order).padStart(3, "0")}`;
  let verifiedFile = publicMediaByStem.get(publicStem);
  const legacyFile = publicMediaByStem.get(internalStem);
  if (!verifiedFile && legacyFile) {
    const extension = legacyFile.slice(legacyFile.lastIndexOf("."));
    const publicFile = `${publicStem}${extension}`;
    const source = resolve(publicMediaDir, legacyFile);
    const target = resolve(publicMediaDir, publicFile);
    if (!source.startsWith(`${publicMediaDir}${sep}`) || !target.startsWith(`${publicMediaDir}${sep}`)) {
      throw new Error("Ruta de medio fuera del directorio público previsto.");
    }
    if (!(await exists(target))) await rename(source, target);
    else await rm(source, { force: true });
    publicMediaByStem.delete(internalStem);
    publicMediaByStem.set(publicStem, publicFile);
    verifiedFile = publicFile;
  }
  if (!verifiedFile) continue;
  const list = mediaById.get(internalId) || [];
  list.push({
    file: `/media/${verifiedFile}`,
    type: item.contentType || "",
    bytes: item.bytes || 0,
    order: item.order,
  });
  mediaById.set(internalId, list);
}
for (const list of mediaById.values()) list.sort((a,b)=>a.order-b.order);

const lingeringMedia = (await readdir(publicMediaDir)).filter((name) => {
  const prefix = name.match(/^([0-9a-f]{32})-/i)?.[1]?.toLowerCase();
  return prefix && publicIds.has(prefix);
});
if (lingeringMedia.length) {
  const quarantine = resolve("audit/private-public-assets/media");
  await mkdir(quarantine, { recursive: true });
  for (const name of lingeringMedia) {
    const source = resolve(publicMediaDir, name);
    const target = resolve(quarantine, name);
    if (!(await exists(target))) await rename(source, target);
    else await rm(source, { force: true });
  }
}

const currencyTokens = [
  ["EUR", /(?:€|\bEUR\b)/i],["USD", /(?:US\$|\bUSD\b|\$)/i],["JPY", /(?:¥|\bJPY\b)/i],
  ["AED", /\bAED\b/i],["GBP", /(?:£|\bGBP\b)/i],["PLN", /\bPLN\b/i],["INR", /(?:₹|\bINR\b)/i],
  ["CAD", /\bCAD\b/i],["AUD", /\bAUD\b/i],["CHF", /\bCHF\b/i],["ZAR", /\bZAR\b/i],
  ["BRL", /(?:R\$|\bBRL\b)/i],["MXN", /\bMXN\b/i],["PHP", /(?:₱|\bPHP\b)/i],["SGD", /\bSGD\b/i],
  ["KRW", /(?:₩|\bKRW\b)/i],["SEK", /\bSEK\b/i],["NOK", /\bNOK\b/i],["DKK", /\bDKK\b/i],
  ["CZK", /\bCZK\b/i],["RON", /\bRON\b/i],["HUF", /\bHUF\b/i],["TRY", /(?:₺|\bTRY\b)/],
  ["CNY", /(?:\bCNY\b|\bRMB\b)/i],["HKD", /\bHKD\b/i],["NZD", /\bNZD\b/i],["ILS", /(?:₪|\bILS\b)/i],
  ["IDR", /\bIDR\b/i],["MYR", /\bMYR\b/i],["THB", /(?:฿|\bTHB\b)/i],["NGN", /(?:₦|\bNGN\b)/i],
  ["GHS", /(?:GH₵|\bGHS\b)/i],["KES", /\bKES\b/i],["TZS", /\bTZS\b/i],["UGX", /\bUGX\b/i],
  ["BWP", /\bBWP\b/i],["MAD", /\bMAD\b/i],["DZD", /\bDZD\b/i],["AOA", /\bAOA\b/i],
  ["XOF", /\bXOF\b/i],["XAF", /\bXAF\b/i],["ETB", /\bETB\b/i],["RWF", /\bRWF\b/i],
  ["MUR", /\bMUR\b/i],["MZN", /\bMZN\b/i],["ZMW", /\bZMW\b/i],["NAD", /\bNAD\b/i],
  ["BHD", /\bBHD\b/i],["SAR", /\bSAR\b/i],["QAR", /\bQAR\b/i],["OMR", /\bOMR\b/i],
  ["KWD", /\bKWD\b/i],["JOD", /\bJOD\b/i],["EGP", /\bEGP\b/i],["PKR", /\bPKR\b/i],
  ["BDT", /\bBDT\b/i],["LKR", /\bLKR\b/i],["NPR", /\bNPR\b/i],["VND", /\bVND\b/i],
  ["AMD", /\bAMD\b/i],["ARS", /\bARS\b/i],["CLP", /\bCLP\b/i],["COP", /\bCOP\b/i],
  ["PEN", /\bPEN\b/i],["UYU", /\bUYU\b/i],["BOB", /\bBOB\b/i],["PYG", /\bPYG\b/i],
  ["ZAR", /\bR(?=\s?\d)/i],["PKR", /(?:₨|\bRs(?=\s?\d))/i],["TND", /\bDT\b/i],["MAD", /\bDH\b/i],
  ["GEL", /\bGEL\b/i],["IQD", /\bIQD\b/i],["KES", /\bKSh\b/i],["WST", /\btala\b/i],
  ["MGA", /\bAr\b/i],["MVR", /\bMVR\b/i],["TJS", /\bTJS\b/i],["BYN", /\bBYN\b/i]
];

function numeric(value) {
  const raw=value.replace(/\s/g,"");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) return Number(raw.replaceAll(".","").replace(",","."));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return Number(raw.replaceAll(",",""));
  if (/^\d+[,.]\d{1,2}$/.test(raw)) return Number(raw.replace(",","."));
  return Number(raw.replace(/[.,]/g,""));
}
function priceInfo(text,status) {
  const value=(text||"").trim();
  if (!value) {
    return { currency:null, amount:null, eur:null, label:"No publicado o no convertible" };
  }
  if (/Oculto/i.test(status||"")) return { currency:null, amount:null, eur:null, label:"Tarifa principal oculta; otras cifras del texto no son un fee confirmado" };
  if (/\b(?:gratis|gratuito|sin coste|sin cargo|sin comisión|sin comision)\b/i.test(value) && !/\bdesde\b|\bextra\b|\bopcional\b/i.test(value)) return { currency:"EUR", amount:0, eur:0, label:"0 €" };
  if (/no (?:es|son) (?:el )?(?:fee|honorarios)|no el fee|solo (?:muestra|indica).*valor/i.test(value)) return { currency:null, amount:null, eur:null, label:"La cifra visible no es el precio del servicio" };
  const matches=currencyTokens.map(([code,rx])=>{const m=value.match(rx);return m?{code,index:m.index||0,length:m[0].length}:null}).filter(Boolean).sort((a,b)=>a.index-b.index);
  const match=matches[0];
  if (!match) {
    if (/%/.test(value)) return { currency:null, amount:null, eur:null, label:"No aplica: tarifa porcentual" };
    if (/ninguno|no hay dato|no publicado|oculto|personalizad|presupuesto|consultar|sin cifra|no se localiz|no capturad/i.test(value)) return { currency:null, amount:null, eur:null, label:"No publicado o no convertible" };
    return { currency:null, amount:null, eur:null, label:"Moneda no identificada con certeza" };
  }
  const currency=match.code;
  const after=value.slice(match.index+match.length,match.index+match.length+28).match(/\s*(\d[\d\s.,]*)(\s*[kKmM])?/);
  const before=value.slice(Math.max(0,match.index-28),match.index).match(/(\d[\d\s.,]*)(\s*[kKmM])?\s*$/);
  const amountMatch=after||before;
  if (!amountMatch) return { currency, amount:null, eur:null, label:"Importe no identificable" };
  let amount=numeric(amountMatch[1]);
  const suffix=(amountMatch[2]||"").trim().toLowerCase();
  if(suffix==="k") amount*=1000;
  if(suffix==="m") amount*=1000000;
  const rate=fx.rates[currency];
  if (!Number.isFinite(amount) || !rate) return { currency, amount:null, eur:null, label:"Sin tasa compatible" };
  const eur=amount/rate;
  return { currency, amount, eur, label:new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:eur<10?2:0}).format(eur) };
}
function list(value) { try { const x=JSON.parse(value||"[]"); return Array.isArray(x)?x:[]; } catch { return value?[value]:[]; } }
function country(value) {
  const x=(value||"Sin país documentado").split(/ — |;|\(|\/ GCC|\/|, cobertura/i)[0].trim();
  if (/^(?:papua new guinea|papua nueva guinea|nueva guinea pap[uú]a)(?:$|[,;.])/i.test(x)) return "Papúa Nueva Guinea";
  if (/marca personal portuguesa/i.test(x)) return "Portugal";
  return x || "Sin país documentado";
}
function isShareablePublicUrl(input) {
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (
      /(?:^|\.)(?:notion\.(?:com|so|site)|notion-static\.com|notionusercontent\.com)$/i.test(hostname) ||
      /(?:^|\.)perfdrive\.com$/i.test(hostname) ||
      /^(?:localhost|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(hostname)
    ) return false;
    for (const key of url.searchParams.keys()) {
      if (/^(?:x-amz-|spaceid$|token$|access_token$|refresh_token$|api_?key$|signature$|credential$|authorization$)/i.test(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
function cleanPublicUrl(input) {
  if (!isShareablePublicUrl(input)) return "";
  const url = new URL(input);
  if (/^(?:l|lm)\.facebook\.com$/i.test(url.hostname) && url.pathname === "/l.php") {
    const destination = url.searchParams.get("u");
    return destination ? cleanPublicUrl(destination) : "";
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|fbclid|gclid|msclkid|mc_)/i.test(key)) url.searchParams.delete(key);
  }
  return url.href;
}
function publicSources(value) {
  return [...new Set(((value||"").match(/https?:\/\/(?:(?!\s|<|>|"|'|\[|\]|\(|\)|·).)+/g)||[])
    .map(x=>x.replace(/[.,;:]+$/,""))
    .map(cleanPublicUrl)
    .filter(Boolean))];
}
function cleanLegacyProjectNaming(value) {
  return String(value || "")
    .split(/(https?:\/\/[^\s<>"')\]]+)/gi)
    .map((part, index) => index % 2
      ? part
      : part
          .replace(/\bRadar\s+B2B\b/gi, "módulo de prospección B2B")
          .replace(/\bRadar\b/gi, "estudio")
          .replace(/\bUniverso\s+activo\b/gi, "cobertura activa"))
    .join("");
}
function cleanText(value) {
  return cleanLegacyProjectNaming(replaceInternalIds(String(value||"")))
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label, href) => {
      const cleaned = cleanPublicUrl(href);
      return cleaned ? `[${label}](${cleaned})` : label;
    })
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, (url) => cleanPublicUrl(url.replace(/[.,;:]+$/, "")))
    .replace(/file:\/\/[^\s<>"')\]]+/gi, "")
    .replace(/<mention-(?:page|database|user)\b[^>\n]*(?:>|(?=\n)|$)/gi, "")
    .replace(/<\/mention-(?:page|database|user)>/gi, "")
    .replace(/\bPuente\s+(?:de\s+)?IA\b/gi,"evidencia histórica")
    .replace(/\bNotion\b/gi,"base canónica")
    .replace(/archivo técnico privado[^\n]*/gi,"")
    .replace(/\bRVC-\d+\b/gi, "")
    .replace(/\bRV-PUB-V1\b/gi, "Resumen publicitario verificado")
    .replace(/\b(?:META-|GOOGLE-)?AGREGADO-\d+\b/gi, "Resultados agregados sin ID individual")
    .replace(/\*\*Origen de (?:la información|la migración):\*\*[^\n]*/gi, "**Contexto de evidencia:** fuente pública consolidada.")
    .replace(/fuente de trabajo (?:previa )?consolidada(?: — Bandeja de registro)?/gi, "evidencia pública consolidada")
    .replace(/\bBandeja de registro\b/gi, "")
    .replace(/\[(?:referencia privada|ruta local) omitida]/gi, "")
    .replace(/(?:portal-source-snapshot|research\/deep|\.codex)/gi, "")
    .trim();
}

async function migrateLogoAssets() {
  const manifestPath = `${dataDir}/logos.json`;
  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return;
  }
  const logosRoot = resolve("public/logos");
  await mkdir(logosRoot, { recursive: true });
  const next = {};
  for (const [key, record] of Object.entries(manifest)) {
    const normalizedKey = normalizedInternalId(key);
    const publicId = publicIds.get(normalizedKey) || key;
    if (publicId !== key) {
      const sourceDir = resolve(logosRoot, key);
      const targetDir = resolve(logosRoot, publicId);
      if (!sourceDir.startsWith(`${logosRoot}${sep}`) || !targetDir.startsWith(`${logosRoot}${sep}`)) {
        throw new Error("Ruta de logo fuera del directorio público previsto.");
      }
      if (await exists(sourceDir)) {
        if (await exists(targetDir)) await rm(sourceDir, { recursive: true, force: true });
        else await rename(sourceDir, targetDir);
      }
    }
    const source = cleanPublicUrl(record.source || "") || null;
    next[publicId] = {
      ...record,
      file: record.file ? replaceInternalIds(record.file) : null,
      source,
      sourceHost: source ? new URL(source).hostname : null,
      reason:
        record.file && !source
          ? record.reason || "Activo local conservado; no existe una URL pública permanente."
          : record.reason || null,
    };
  }
  const legacyDirectories = (await readdir(logosRoot)).filter((name) =>
    publicIds.has(normalizedInternalId(name)),
  );
  if (legacyDirectories.length) {
    const quarantine = resolve("audit/private-public-assets/logos");
    await mkdir(quarantine, { recursive: true });
    for (const name of legacyDirectories) {
      const source = resolve(logosRoot, name);
      const target = resolve(quarantine, name);
      if (!(await exists(target))) await rename(source, target);
      else await rm(source, { recursive: true, force: true });
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(next)}\n`, "utf8");
}

await migrateLogoAssets();

const companies = companiesRaw.map((row)=>{
  const internalId=row.id.replaceAll("-","");
  const publicId=publicIds.get(internalId);
  if (!publicId) throw new Error(`Ficha sin identidad pública: ${internalId}`);
  const detail=detailById.get(internalId)||{};
  const classification=classificationOverrides.get(internalId);
  const effectiveScope=classification?.recommendedScope||row["Alcance megaestudio"]||"Sin clasificar";
  const priceText=row["Precio visible"]||row["Precio conseguido"]||row["Ticket estimado"]||"";
  const excluded=effectiveScope.startsWith("Excluir");
  const contract=cleanText(row["Permanencia / contrato"])||(excluded
    ?"No aplica: la ficha documenta una fuente o entidad sin oferta comercial comparable."
    :"No publicado: no se localizó una condición contractual verificable en las fuentes disponibles.");
  const guarantee=cleanText(row["Garantía / riesgo invertido"])||(excluded
    ?"No aplica: la ficha documenta una fuente o entidad sin oferta comercial comparable."
    :"No publicada: no se localizó una garantía verificable en las fuentes disponibles.");
  const canonicalName = internalId === "3c0f1447360c81d4ac71c1f0c1ab9ca1"
    ? "Dalil Iraq"
    : row["Empresa / marca"]||row.Registro||"Sin nombre";
  const canonicalTitle = internalId === "3c0f1447360c81d4ac71c1f0c1ab9ca1"
    ? "Dalil Iraq"
    : row.Registro||canonicalName;
  return {
    id:publicId,
    name:cleanText(canonicalName),
    title:cleanText(canonicalTitle),
    domain:cleanText(row.Dominio||""),
    website:cleanPublicUrl(row["URL principal"]||""),
    country:country(row["País / mercado exacto"]),
    market:cleanText(row["País / mercado exacto"]),
    markets:list(row.Mercado).map(cleanText),
    scope:effectiveScope,
    agencyType:cleanText(row["Tipo de agencia"]||"No documentado"),
    offer:cleanText(row["Oferta / promesa"]),
    priceLocal:cleanText(priceText),
    priceStatus:cleanText(row["Estado del precio"]||"No documentado"),
    price:priceInfo(priceText,row["Estado del precio"]),
    ticket:cleanText(row["Ticket estimado"]),
    contract,
    guarantee,
    channels:list(row["Canales detectados"]).map(cleanText),
    metaStatus:cleanText(row["Estado Meta Ads"]||"No revisado"),
    metaAds:Number(row["Meta anuncios activos"]||0),
    googleStatus:cleanText(row["Estado Google Ads"]||"No revisado"),
    googleAds:Number(row["Google anuncios activos"]||0),
    creativeArchive:Number(row["Creatividades archivadas"]||0),
    score:Number(row["Puntuación estratégica"]||0),
    threat:cleanText(row["Amenaza competitiva"]||"No aplica"),
    relation:cleanText(classification?.recommendedRelation||row["Relación con RedVitalia"]),
    decision:cleanText(classification?.recommendedDecision||row["Decisión RedVitalia"]||"Sin decidir"),
    evidence:cleanText(row["Nivel de evidencia"]||"No documentado"),
    proof:cleanText(row["Prueba social"]),
    team:cleanText(row["Tamaño y equipo"]),
    cta:cleanText(row["CTA / conversión"]),
    funnel:cleanText(row["Etapas del funnel"]),
    niche:cleanText(row["Nicho / público"]),
    legal:cleanText(row["Estado legal"]||"No documentado"),
    review:cleanText(row["Estado revisión integral"]||"No documentado"),
    reviewedAt:row["date:Última revisión:start"]||null,
    sources:publicSources([row["Fuentes / evidencia"],detail.body,row["URL principal"]].filter(Boolean).join("\n")),
    body:cleanText(detail.body||""),
    media:mediaById.get(internalId)||[],
    mediaDeclared:Number(detail.mediaCount||0),
    location:publicLocationById.get(publicId)||null
  };
});

const WORLD_COUNTRIES = `Afganistán
Albania
Alemania
Andorra
Angola
Antigua y Barbuda
Arabia Saudita
Argelia
Argentina
Armenia
Australia
Austria
Azerbaiyán
Bahamas
Bangladés
Barbados
Baréin
Bélgica
Belice
Benín
Bielorrusia
Bolivia
Bosnia y Herzegovina
Botsuana
Brasil
Brunéi
Bulgaria
Burkina Faso
Burundi
Bután
Cabo Verde
Camboya
Camerún
Canadá
Catar
Chad
Chile
China
Chipre
Colombia
Comoras
Corea del Norte
Corea del Sur
Costa de Marfil
Costa Rica
Croacia
Cuba
Dinamarca
Dominica
Ecuador
Egipto
El Salvador
Emiratos Árabes Unidos
Eritrea
Eslovaquia
Eslovenia
España
Estados Unidos
Estonia
Esuatini
Etiopía
Filipinas
Finlandia
Fiyi
Francia
Gabón
Gambia
Georgia
Ghana
Granada
Grecia
Guatemala
Guinea
Guinea-Bisáu
Guinea Ecuatorial
Guyana
Haití
Honduras
Hungría
India
Indonesia
Irak
Irán
Irlanda
Islandia
Islas Marshall
Islas Salomón
Israel
Italia
Jamaica
Japón
Jordania
Kazajistán
Kenia
Kirguistán
Kiribati
Kuwait
Laos
Lesoto
Letonia
Líbano
Liberia
Libia
Liechtenstein
Lituania
Luxemburgo
Macedonia del Norte
Madagascar
Malasia
Malaui
Maldivas
Malí
Malta
Marruecos
Mauricio
Mauritania
México
Micronesia
Moldavia
Mónaco
Mongolia
Montenegro
Mozambique
Myanmar
Namibia
Nauru
Nepal
Nicaragua
Níger
Nigeria
Noruega
Nueva Zelanda
Omán
Países Bajos
Pakistán
Palaos
Panamá
Papúa Nueva Guinea
Paraguay
Perú
Polonia
Portugal
Reino Unido
República Centroafricana
República Checa
República del Congo
República Democrática del Congo
República Dominicana
Ruanda
Rumanía
Rusia
Samoa
San Cristóbal y Nieves
San Marino
San Vicente y las Granadinas
Santa Lucía
Santo Tomé y Príncipe
Senegal
Serbia
Seychelles
Sierra Leona
Singapur
Siria
Somalia
Sri Lanka
Sudáfrica
Sudán
Sudán del Sur
Suecia
Suiza
Surinam
Tailandia
Tanzania
Tayikistán
Timor Oriental
Togo
Tonga
Trinidad y Tobago
Túnez
Turkmenistán
Turquía
Tuvalu
Ucrania
Uganda
Uruguay
Uzbekistán
Vanuatu
Venezuela
Vietnam
Yemen
Yibuti
Zambia
Zimbabue
Ciudad del Vaticano
Estado de Palestina`.split("\n");
const aliases = {
  "Arabia Saudita":["arabia saudí","arabia saudi"],
  "Bangladés":["bangladesh"],"Baréin":["bahrain"],"Bielorrusia":["belarus"],"Botsuana":["botswana"],
  "Brunéi":["brunei"],"Catar":["qatar"],"Corea del Norte":["north korea"],"Corea del Sur":["south korea","corea"],
  "Costa de Marfil":["côte d’ivoire","cote d'ivoire"],"Emiratos Árabes Unidos":["eau","uae","dubai"],
  "Estados Unidos":["ee. uu.","eeuu","usa","united states"],"Esuatini":["swaziland"],"Fiyi":["fiji"],
  "Guinea-Bisáu":["guinea bissau"],"Irán":["iran"],"Kazajistán":["kazakhstan"],"Kenia":["kenya"],
  "Irak":["iraq"],"Islas Salomón":["solomon islands"],"Kirguistán":["kyrgyzstan"],"Laos":["lao"],"Malaui":["malawi"],"Moldavia":["moldova"],
  "Myanmar":["birmania"],"Países Bajos":["netherlands","holanda"],"Reino Unido":["uk","united kingdom"],
  "República Checa":["chequia","czechia"],"República del Congo":["congo-brazzaville"],
  "República Democrática del Congo":["rd congo","drc"],"Rusia":["russian federation"],"Siria":["syrian","mercado sirio"],
  "Santo Tomé y Príncipe":["são tomé","sao tome"],"Sri Lanka":["sri lanka"],"Sudáfrica":["south africa"],
  "Tanzania":["united republic of tanzania"],"Timor Oriental":["timor-leste"],"Turquía":["türkiye","turkey"],
  "Vietnam":["viet nam"],"Ciudad del Vaticano":["santa sede","holy see","vaticano"],
  "Papúa Nueva Guinea":["papua new guinea","papua nueva guinea","nueva guinea papua"],
  "Portugal":["portuguesa","portuguese"],
  "Estado de Palestina":["palestina","palestine"]
};
const fold=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const escapeRx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
function canonicalCountries(company) {
  const haystack=fold(`${company.country} ${company.market} ${company.markets.join(" ")}`);
  const candidates=[];
  for (const name of WORLD_COUNTRIES) {
    const variants=[name,...(aliases[name]||[])].map(fold).sort((a,b)=>b.length-a.length);
    for (const value of variants) {
      const expression=new RegExp(`(?<![a-z0-9])${escapeRx(value)}(?![a-z0-9])`,"g");
      for (const match of haystack.matchAll(expression)) candidates.push({name,start:match.index,end:match.index+value.length,length:value.length});
    }
  }
  const selected=[];
  const usedNames=new Set();
  const eligible=candidates.filter((candidate)=>!candidates.some((other)=>
    other.name!==candidate.name&&other.length>candidate.length&&candidate.start>=other.start&&candidate.end<=other.end
  ));
  for (const candidate of eligible.sort((a,b)=>a.start-b.start||b.length-a.length||a.name.localeCompare(b.name,"es"))) {
    if (usedNames.has(candidate.name)) continue;
    if (selected.some((row)=>candidate.start<row.end&&candidate.end>row.start)) continue;
    selected.push(candidate);
    usedNames.add(candidate.name);
  }
  return selected.sort((a,b)=>a.start-b.start||b.length-a.length).map((row)=>row.name);
}

const countryOverrides=new Map([
  ["td-ai-y-marketing",{countries:["Mauricio","Hungría"],primaryCountry:"Mauricio"}],
  ["filipe-vilaca",{country:"Portugal",countries:["Portugal","Estados Unidos"],primaryCountry:"Portugal"}],
  ["clientium",{countries:["Italia","Albania"],primaryCountry:"Italia"}],
  ["zoreli",{country:"Armenia",market:"Armenia — ubicación y operación pública observadas; cobertura adicional no verificada.",countries:["Armenia"],primaryCountry:"Armenia"}],
  ["png-online-com-ficha-de-cobertura-mundial-nueva-guinea-papua",{country:"Papúa Nueva Guinea",countries:["Papúa Nueva Guinea"],primaryCountry:"Papúa Nueva Guinea"}],
  ["yellowpages-com-pg-ficha-de-cobertura-mundial-nueva-guinea-papua",{country:"Papúa Nueva Guinea",countries:["Papúa Nueva Guinea"],primaryCountry:"Papúa Nueva Guinea"}],
]);
for (const company of companies) {
  const override=countryOverrides.get(company.id);
  if (override?.country) company.country=override.country;
  if (override?.market) company.market=override.market;
  company.countries=override?.countries||canonicalCountries(company);
  company.primaryCountry=override?.primaryCountry||company.countries[0]||company.country;
}
const countries=WORLD_COUNTRIES.map(name=>{
  const rows=companies.filter(x=>x.countries.includes(name));
  return {name,count:rows.length,topScore:rows.length?Math.max(...rows.map(x=>x.score)):0,withPublicPrice:rows.filter(x=>x.price.eur!=null).length,withMedia:rows.filter(x=>x.media.length).length};
});
const categories=[...new Set(companies.map(x=>x.scope))].map(name=>({name,count:companies.filter(x=>x.scope===name).length}));
const media=companies.reduce((n,x)=>n+x.media.length,0);
const publicPrices=companies.filter(x=>x.price.eur!=null).length;
const criticalFields=["name","country","scope","agencyType","offer","priceLocal","priceStatus","contract","guarantee","decision","evidence","review","body"];
const criticalEmptyUnexplained=companies.reduce((total,company)=>total+criticalFields.filter(field=>!String(company[field]??"").trim()).length,0);
const mediaAudit=JSON.parse(await readFile(`${dataDir}/audit.json`,"utf8"));
const knownInternalIds=new Set(companiesRaw.map((row)=>normalizedInternalId(row.id)));
const unavailable=mediaRaw.filter(x=>!x.ok);
let deepQueue=null;
try {
  deepQueue=JSON.parse(await readFile("research/deep/queue.json","utf8"));
} catch {
  deepQueue=null;
}
let forensicQueue=null;
try {
  forensicQueue=JSON.parse(await readFile("research/deep/v3/queue.json","utf8"));
} catch {
  forensicQueue=null;
}
const forensicResearchComplete=new Set(["render_complete","limited","classification_review"]);
const queueItems=forensicQueue?.items?.length ? forensicQueue.items : (deepQueue?.items||[]);
const deepOpen=forensicQueue?.items?.length
  ? queueItems.filter(item=>
      !forensicResearchComplete.has(item.research?.status)
      || item.synthesis?.status!=="complete"
      || item.notion?.status!=="complete"
      || item.portal?.status!=="complete"
      || item.qa?.status!=="complete"
    ).length
  : queueItems.filter(item=>
      !["complete","limited"].includes(item.collect?.status)
      || item.review?.status!=="complete"
      || item.notion?.status!=="complete"
      || item.portal?.status!=="complete"
      || item.qa?.status!=="complete"
    ).length;
const deepInProgress=forensicQueue?.items?.length
  ? queueItems.filter(item=>
      [item.research?.status,item.synthesis?.status,item.notion?.status,item.portal?.status,item.qa?.status].includes("in_progress")
    ).length
  : queueItems.filter(item=>
      [item.collect?.status,item.review?.status,item.notion?.status,item.portal?.status,item.qa?.status].includes("in_progress")
    ).length;
const baseInProgress=companiesRaw.filter(row=>Object.values(row).some(value=>typeof value==="string"&&/^\s*en curso\s*$/i.test(value))).length;
const baseResidual=unavailable.filter(item=>!item.error).length;
const completion={
  status:baseInProgress+baseResidual+deepOpen===0?"TERMINADO":"AMPLIACIÓN FORENSE EN CURSO",
  recordsInProgress:baseInProgress+deepInProgress,
  residualPending:baseResidual+deepOpen,
  motherlessRecords:companies.filter(x=>!x.body.trim()).length,
  criticalEmptyUnexplained,
  orphanMedia:mediaRaw.filter(item=>item.ok&&!knownInternalIds.has(normalizedInternalId(item.companyId))).length,
  availableEvidencePlaced:media,
  unavailableEvidenceDocumented:unavailable.length,
  unavailableEvidenceTotal:unavailable.length,
  recordsWithoutPublicSource:companies.filter(x=>!x.sources.length).length,
  specialMarketRecords:companies.filter(x=>!x.countries.length).length
};
const summary={
  generatedAt:new Date().toISOString(),companies:companies.length,countries:countries.length,media,
  mediaFailed:mediaRaw.filter(x=>!x.ok).length,withMedia:companies.filter(x=>x.media.length).length,
  mediaFileTypeCorrections:mediaAudit.mediaQuality?.correctedFileTypes||0,
  technicalArtifactsExcluded:mediaAudit.mediaQuality?.technicalArtifactsExcluded||0,
  logos:mediaAudit.logoQuality?{
    total:mediaAudit.logoQuality.total,
    official:mediaAudit.logoQuality.official,
    favicon:mediaAudit.logoQuality.favicon,
    platform:mediaAudit.logoQuality.platform,
    authentic:mediaAudit.logoQuality.authentic,
    fallback:mediaAudit.logoQuality.fallback,
    coveragePercent:mediaAudit.logoQuality.coveragePercent,
    locallyStored:mediaAudit.logoQuality.locallyStored,
    hotlinked:mediaAudit.logoQuality.hotlinked,
  }:undefined,
  publicPrices,priceCoveragePercent:Number((publicPrices/companies.length*100).toFixed(1)),
  sources:[...new Set(companies.flatMap(x=>x.sources))].length,categories,completion,
  fx:{base:fx.base,date:fx.timeLastUpdateUtc,source:fx.source,disclaimer:fx.disclaimer}
};

function sanitizePublicValue(value) {
  if (typeof value === "string") return cleanText(value);
  if (Array.isArray(value)) return value.map(sanitizePublicValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "sourceFile")
        .map(([key, child]) => [replaceInternalIds(key), sanitizePublicValue(child)]),
    );
  }
  return value;
}

const sanitizedAudit = sanitizePublicValue({
  ...mediaAudit,
  generatedAt: new Date().toISOString(),
  completion,
  privacyQuality: {
    status: "PENDIENTE DE REVALIDACIÓN",
    privateReferences: null,
  },
});

let sanitizedEditorial = null;
try {
  const editorial = JSON.parse(await readFile(`${dataDir}/editorial.json`, "utf8"));
  sanitizedEditorial = sanitizePublicValue({
    ...editorial,
    generatedAt: new Date().toISOString(),
  });
} catch {
  sanitizedEditorial = null;
}
let sanitizedMediaQuality = null;
try {
  sanitizedMediaQuality = sanitizePublicValue(
    JSON.parse(await readFile(`${dataDir}/media-quality.json`, "utf8")),
  );
} catch {
  sanitizedMediaQuality = null;
}

const companyDetailsDir = `${dataDir}/company-details`;
await mkdir(companyDetailsDir, { recursive: true });
const expectedCompanyDetails = new Set();
await Promise.all(companies.map(async (company) => {
  const filename = `${company.id}.json`;
  expectedCompanyDetails.add(filename);
  await writeFile(
    `${companyDetailsDir}/${filename}`,
    JSON.stringify({ id: company.id, body: company.body, sources: company.sources }),
  );
}));
for (const filename of await readdir(companyDetailsDir)) {
  if (filename.endsWith(".json") && !expectedCompanyDetails.has(filename)) {
    await rm(`${companyDetailsDir}/${filename}`, { force: true });
  }
}
const companyIndex = companies.map((company) => ({
  ...company,
  body: "",
  sources: [],
}));

await writeFile(`${dataDir}/companies.json`,JSON.stringify(companies));
await writeFile(`${dataDir}/companies-index.json`,JSON.stringify(companyIndex));
await writeFile(`${dataDir}/countries.json`,JSON.stringify(countries));
await writeFile(`${dataDir}/summary.json`,JSON.stringify(summary));
await writeFile(`${dataDir}/audit.json`,JSON.stringify(sanitizedAudit));
if (sanitizedEditorial) await writeFile(`${dataDir}/editorial.json`,JSON.stringify(sanitizedEditorial));
if (sanitizedMediaQuality) await writeFile(`${dataDir}/media-quality.json`,JSON.stringify(sanitizedMediaQuality));
console.log(JSON.stringify(summary,null,2));
