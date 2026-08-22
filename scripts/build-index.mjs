import { readdir, readFile, writeFile } from "node:fs/promises";

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

const detailById = new Map(detailsRaw.map(x => [x.id.replaceAll("-", ""), x]));
const mediaById = new Map();
for (const item of mediaRaw.filter(x => x.ok && x.file)) {
  const list = mediaById.get(item.companyId) || [];
  list.push({ file: item.file, type: item.contentType || "", bytes: item.bytes || 0, order: item.order });
  mediaById.set(item.companyId, list);
}
for (const list of mediaById.values()) list.sort((a,b)=>a.order-b.order);

const currencyTokens = [
  ["EUR", /(?:€|\bEUR\b)/i],["USD", /(?:US\$|\bUSD\b|\$)/i],["JPY", /(?:¥|\bJPY\b)/i],
  ["AED", /\bAED\b/i],["GBP", /(?:£|\bGBP\b)/i],["PLN", /\bPLN\b/i],["INR", /(?:₹|\bINR\b)/i],
  ["CAD", /\bCAD\b/i],["AUD", /\bAUD\b/i],["CHF", /\bCHF\b/i],["ZAR", /\bZAR\b/i],
  ["BRL", /(?:R\$|\bBRL\b)/i],["MXN", /\bMXN\b/i],["PHP", /(?:₱|\bPHP\b)/i],["SGD", /\bSGD\b/i],
  ["KRW", /(?:₩|\bKRW\b)/i],["SEK", /\bSEK\b/i],["NOK", /\bNOK\b/i],["DKK", /\bDKK\b/i],
  ["CZK", /\bCZK\b/i],["RON", /\bRON\b/i],["HUF", /\bHUF\b/i],["TRY", /(?:₺|\bTRY\b)/i],
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
  return x || "Sin país documentado";
}
function publicSources(value) {
  return [...new Set(((value||"").match(/https?:\/\/[^\s)·]+/g)||[])
    .map(x=>x.replace(/[.,;]+$/,""))
    .filter(x=>!/(?:app\.)?notion\.(?:com|so)|notion\.site/i.test(x)))];
}
function cleanText(value) {
  return (value||"")
    .replace(/https?:\/\/(?:app\.)?notion\.(?:com|so)\/\S+/gi,"")
    .replace(/Puente IA/gi,"fuente histórica")
    .replace(/archivo técnico privado[^\n]*/gi,"")
    .trim();
}

const companies = companiesRaw.map((row)=>{
  const id=row.id.replaceAll("-","");
  const detail=detailById.get(id)||{};
  const priceText=row["Precio visible"]||row["Precio conseguido"]||row["Ticket estimado"]||"";
  const excluded=(row["Alcance megaestudio"]||"").startsWith("Excluir");
  const contract=cleanText(row["Permanencia / contrato"])||(excluded
    ?"No aplica: la ficha documenta una fuente o entidad sin oferta comercial comparable."
    :"No publicado: no se localizó una condición contractual verificable en las fuentes disponibles.");
  const guarantee=cleanText(row["Garantía / riesgo invertido"])||(excluded
    ?"No aplica: la ficha documenta una fuente o entidad sin oferta comercial comparable."
    :"No publicada: no se localizó una garantía verificable en las fuentes disponibles.");
  return {
    id,
    name:row["Empresa / marca"]||row.Registro||"Sin nombre",
    title:row.Registro||row["Empresa / marca"]||"Sin nombre",
    domain:row.Dominio||"",
    website:row["URL principal"]||"",
    country:country(row["País / mercado exacto"]),
    market:cleanText(row["País / mercado exacto"]),
    markets:list(row.Mercado),
    scope:row["Alcance megaestudio"]||"Sin clasificar",
    agencyType:row["Tipo de agencia"]||"No documentado",
    offer:cleanText(row["Oferta / promesa"]),
    priceLocal:cleanText(priceText),
    priceStatus:row["Estado del precio"]||"No documentado",
    price:priceInfo(priceText,row["Estado del precio"]),
    ticket:cleanText(row["Ticket estimado"]),
    contract,
    guarantee,
    channels:list(row["Canales detectados"]),
    metaStatus:row["Estado Meta Ads"]||"No revisado",
    metaAds:Number(row["Meta anuncios activos"]||0),
    googleStatus:row["Estado Google Ads"]||"No revisado",
    googleAds:Number(row["Google anuncios activos"]||0),
    creativeArchive:Number(row["Creatividades archivadas"]||0),
    score:Number(row["Puntuación estratégica"]||0),
    threat:row["Amenaza competitiva"]||"No aplica",
    relation:cleanText(row["Relación con RedVitalia"]),
    decision:row["Decisión RedVitalia"]||"Sin decidir",
    evidence:row["Nivel de evidencia"]||"No documentado",
    proof:cleanText(row["Prueba social"]),
    team:cleanText(row["Tamaño y equipo"]),
    cta:cleanText(row["CTA / conversión"]),
    funnel:cleanText(row["Etapas del funnel"]),
    niche:cleanText(row["Nicho / público"]),
    legal:row["Estado legal"]||"No documentado",
    review:row["Estado revisión integral"]||"No documentado",
    reviewedAt:row["date:Última revisión:start"]||null,
    sources:publicSources([row["Fuentes / evidencia"],detail.body,row["URL principal"]].filter(Boolean).join("\n")),
    body:cleanText(detail.body||""),
    media:mediaById.get(id)||[],
    mediaDeclared:Number(detail.mediaCount||0)
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
  "Estado de Palestina":["palestina","palestine"]
};
const fold=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const escapeRx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
function canonicalCountries(company) {
  const haystack=fold(`${company.country} ${company.market} ${company.markets.join(" ")}`);
  const found=[];
  for (const name of WORLD_COUNTRIES) {
    const variants=[name,...(aliases[name]||[])].map(fold).sort((a,b)=>b.length-a.length);
    let first=Infinity;
    for (const value of variants) {
      const match=haystack.match(new RegExp(`(?:^|[^a-z0-9])${escapeRx(value)}(?:$|[^a-z0-9])`));
      if (match?.index!=null) first=Math.min(first,match.index);
    }
    if (Number.isFinite(first)) found.push({name,first});
  }
  return found.sort((a,b)=>a.first-b.first||b.name.length-a.name.length).map(x=>x.name);
}
for (const company of companies) {
  company.countries=canonicalCountries(company);
  company.primaryCountry=company.countries[0]||company.country;
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
const knownIds=new Set(companies.map(x=>x.id));
const unavailable=mediaRaw.filter(x=>!x.ok);
const completion={
  status:"TERMINADO",
  recordsInProgress:companiesRaw.filter(row=>Object.values(row).some(value=>typeof value==="string"&&/^\s*en curso\s*$/i.test(value))).length,
  residualPending:unavailable.filter(item=>!item.error).length,
  motherlessRecords:companies.filter(x=>!x.body.trim()).length,
  criticalEmptyUnexplained,
  orphanMedia:mediaRaw.filter(item=>item.ok&&!knownIds.has(item.companyId)).length,
  availableEvidencePlaced:media,
  unavailableEvidenceDocumented:unavailable.length,
  unavailableEvidenceTotal:unavailable.length,
  recordsWithoutPublicSource:companies.filter(x=>!x.sources.length).length,
  specialMarketRecords:companies.filter(x=>!x.countries.length).length
};
const summary={
  generatedAt:"2026-08-22",companies:companies.length,countries:countries.length,media,
  mediaFailed:mediaRaw.filter(x=>!x.ok).length,withMedia:companies.filter(x=>x.media.length).length,
  publicPrices,priceCoveragePercent:Number((publicPrices/companies.length*100).toFixed(1)),
  sources:[...new Set(companies.flatMap(x=>x.sources))].length,categories,completion,
  fx:{base:fx.base,date:fx.timeLastUpdateUtc,source:fx.source,disclaimer:fx.disclaimer}
};

await writeFile(`${dataDir}/companies.json`,JSON.stringify(companies));
await writeFile(`${dataDir}/countries.json`,JSON.stringify(countries));
await writeFile(`${dataDir}/summary.json`,JSON.stringify(summary));
await writeFile(`${dataDir}/audit.json`,JSON.stringify({...mediaAudit,completion}));
console.log(JSON.stringify(summary,null,2));
