#!/usr/bin/env node
/**
 * Dossier de negocio: convierte la inteligencia acumulada (verticales, arsenal,
 * cruces, vigilancia, patterns, insights, anuncios reales) en un plan de negocio
 * por vertical + implicaciones globales del mercado.
 *
 * Honestidad: cada bloque lleva etiqueta. "Observado" = dato de las fichas.
 * "Estimado" = cálculo visible sobre datos observados. "Síntesis editorial" =
 * lectura razonada; no es un hecho medido. Nada se inventa.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(root, "public/data", name), "utf8"));

const verticalesData = read("verticales.json");
const cruces = read("cruces.json");
const vigilancia = read("vigilancia.json");
const patterns = read("patterns.json");
const insights = read("insights.json");
const arsenal = read("arsenal.json");
const angulos = read("angulos-anuncios.json");
const anuncios = read("anuncios-reales.json");

const map = verticalesData.map || {};
const vmapOf = (id) => map[id] || "generalista";

const UNITS = {
  "clinicas-salud": "pacientes",
  "reformas-hogar": "obras presupuestadas",
  "solar-energia": "instalaciones",
  inmobiliario: "encargos de venta",
  legal: "consultas cualificadas",
  "coches-motor": "vehículos",
  "b2b-sdr": "reuniones agendadas",
  "directorios-marketplaces": "solicitudes",
  "belleza-bienestar": "reservas",
  "hosteleria-turismo": "reservas",
  generalista: "clientes",
};

// Contexto comercial editorial por vertical: a quién se llama, qué keyword semilla
// se compra y qué escena visual venden las creatividades. Nada de esto son datos
// de las fichas: es configuración de la propia oferta RedVitalia (Síntesis editorial).
const SALES_CONTEXT = {
  "clinicas-salud": { decisor: "el gerente o el propietario de la clínica", negocio: "una clínica privada", keywords: ["captacion pacientes clinica", "marketing clinicas", "conseguir pacientes clinica privada", "publicidad clinica dental", "agencia marketing salud"], escena: "consulta médica privada moderna y luminosa, profesional sanitario atendiendo con calma a un paciente", dolor: "huecos de agenda y primeras visitas que no llegan", hookMeta: "¿Tu agenda tiene huecos esta semana mientras la clínica de al lado está llena?" },
  "reformas-hogar": { decisor: "el dueño de la empresa de reformas", negocio: "una empresa de reformas", keywords: ["conseguir clientes reformas", "leads reformas", "presupuestos reformas clientes", "marketing empresas reformas", "captacion obras"], escena: "reforma de vivienda en curso, operario profesional con casco revisando un plano en una cocina a medio instalar", dolor: "presupuestos que no se firman y meses valle sin obra", hookMeta: "¿Furgonetas paradas y presupuestos que no se firman?" },
  "solar-energia": { decisor: "el gerente de la instaladora", negocio: "una instaladora solar", keywords: ["leads placas solares", "clientes instalacion fotovoltaica", "captacion autoconsumo", "marketing empresas solares"], escena: "instalación de paneles solares sobre tejado residencial español al atardecer, instalador con arnés trabajando", dolor: "instalaciones caídas tras el frenazo del boom", hookMeta: "¿Del boom solar a pelear cada instalación?" },
  inmobiliario: { decisor: "el director de la agencia inmobiliaria", negocio: "una agencia inmobiliaria", keywords: ["captacion vendedores inmobiliaria", "conseguir encargos venta", "leads inmobiliaria", "marketing inmobiliario captacion"], escena: "agente inmobiliario entregando llaves frente a una vivienda española con cartel de VENDIDO", dolor: "captar al vendedor cuesta más que vender el piso", hookMeta: "¿Compradores de sobra pero sin pisos que vender?" },
  legal: { decisor: "el socio del despacho", negocio: "un despacho de abogados", keywords: ["captacion clientes abogados", "marketing juridico", "leads despacho abogados", "conseguir casos abogado"], escena: "despacho de abogados sobrio y elegante, mesa de reuniones con documentos y una balanza al fondo, luz cálida", dolor: "casos rentables que no llegan y dependencia del boca a boca", hookMeta: "¿Tu despacho sigue dependiendo del boca a boca?" },
  "coches-motor": { decisor: "el gerente del compraventa", negocio: "un compraventa de vehículos", keywords: ["leads compra coches", "captacion vehiculos compraventa", "conseguir coches para comprar"], escena: "campa de compraventa de coches ordenada, comercial con tablet valorando un vehículo", dolor: "campa vacía y compras que se escapan", hookMeta: "¿Te faltan coches que comprar, no compradores?" },
  "b2b-sdr": { decisor: "el CEO o el director comercial", negocio: "una empresa B2B", keywords: ["reuniones cualificadas b2b", "agendar reuniones ventas", "sdr externo", "prospeccion b2b agencia"], escena: "sala de reuniones B2B con dos personas cerrando un acuerdo, portátil con agenda llena visible", dolor: "pipeline vacío y comerciales sin agenda", hookMeta: "¿Agenda comercial vacía la semana que viene?" },
  "directorios-marketplaces": { decisor: "el responsable de growth", negocio: "una plataforma", keywords: ["generacion demanda marketplace", "captacion oferta demanda plataforma"], escena: "panel de control digital con solicitudes entrando en tiempo real, oficina de producto moderna", dolor: "demanda que no crece al ritmo de la oferta", hookMeta: "¿Más profesionales dados de alta que solicitudes que repartir?" },
  "belleza-bienestar": { decisor: "el propietario del centro", negocio: "un centro de estética", keywords: ["captacion clientes estetica", "marketing centros belleza", "reservas centro estetica"], escena: "centro de estética premium, recepción cuidada con agenda de reservas visible en pantalla", dolor: "cabinas vacías entre semana", hookMeta: "¿Cabinas vacías de lunes a jueves?" },
  "hosteleria-turismo": { decisor: "el director del establecimiento", negocio: "un negocio de hostelería", keywords: ["marketing restaurantes reservas", "captacion reservas directas hotel"], escena: "terraza de restaurante española llena, camarero profesional sirviendo con el local a pleno rendimiento", dolor: "mesas vacías entre semana y comisiones de plataformas", hookMeta: "¿Reservas solo cuando llega el fin de semana?" },
  generalista: { decisor: "el gerente", negocio: "un negocio local", keywords: ["agencia captacion clientes", "conseguir clientes negocio local", "agencia generacion leads espana"], escena: "calle comercial española con negocios locales activos, gente entrando en un comercio", dolor: "captación imprevisible mes a mes", hookMeta: "¿Un mes bien y dos meses mal?" },
};

const truncate = (text, max) => (text.length <= max ? text : text.slice(0, max).replace(/\s+\S*$/, ""));
const cap = (text) => (text ? text.charAt(0).toLocaleUpperCase("es") + text.slice(1) : text);
const lcFirst = (text) => {
  if (!text) return text;
  const firstWord = text.split(/\s+/)[0];
  if (firstWord.length > 1 && firstWord === firstWord.toLocaleUpperCase("es")) return text; // siglas o énfasis en mayúsculas
  return text.charAt(0).toLocaleLowerCase("es") + text.slice(1);
};
// Género gramatical de la unidad captada, para que garantías y guiones no chirríen.
const FEM_FIRST_WORDS = new Set(["obras", "instalaciones", "consultas", "reuniones", "solicitudes", "reservas", "citas", "ventas", "visitas", "llamadas", "oportunidades"]);
const unitGender = (unit) => (FEM_FIRST_WORDS.has((unit || "").trim().split(/\s+/)[0].toLocaleLowerCase("es")) ? "f" : "m");

const STOP_WORDS = new Set(["de", "del", "la", "el", "en", "para"]);
const singularWord = (w) => {
  if (/iones$/i.test(w)) return w.replace(/iones$/i, "ión");
  if (/udes$/i.test(w)) return w.replace(/udes$/i, "ud");
  return w.replace(/s$/i, "");
};
const singularUnit = (unit) => {
  const words = (unit || "").trim().split(/\s+/);
  let past = false;
  return words.map((w) => {
    if (STOP_WORDS.has(w.toLocaleLowerCase("es"))) { past = true; return w; }
    return past ? w : singularWord(w);
  }).join(" ");
};

const eur = (n) => (n == null ? null : Math.round(n));
const round10 = (n) => Math.round(n / 10) * 10;

// ── Elasticidad de garantía (global) ─────────────────────────────────────────
const elastic = cruces.elasticidadGarantia || [];
const noGuar = elastic.find((e) => /sin garantía/i.test(e.label));
const midGuar = elastic.find((e) => /media/i.test(e.label));
const strongGuar = elastic.find((e) => /fuerte/i.test(e.label));
const guaranteePremiumPct =
  noGuar?.medianEur && midGuar?.medianEur
    ? Math.round(((midGuar.medianEur - noGuar.medianEur) / noGuar.medianEur) * 100)
    : null;

// ── SLA frontera ─────────────────────────────────────────────────────────────
const slaTop = (cruces.slas?.top || []).slice(0, 3);
const slaTotal = (cruces.slas?.top || []).length;

// ── Señales de anuncios ──────────────────────────────────────────────────────
const senal = (label) => (angulos.senales || []).find((s) => s.label === label) || null;
const senalGarantia = senal("Prometen garantía o devolución");
const senalCifra = senal("Llevan al menos una cifra en el copy");

// ── Señales por vertical desde los anuncios reales transcritos ───────────────
const adsByVertical = {};
for (const item of anuncios.items || []) {
  if (!item.vertical) continue;
  (adsByVertical[item.vertical] ||= []).push(item);
}
const verticalAdSignals = (vid) => {
  const items = adsByVertical[vid] || [];
  if (items.length < 8) return null;
  const pct = (fn) => Math.round((items.filter(fn).length / items.length) * 100);
  return {
    n: items.length,
    cifraPct: pct((i) => /\d/.test(`${i.titular} ${i.texto}`)),
    garantiaPct: pct((i) => /(garant|devolv|devoluc|no pagas|gratis hasta|trabajamos gratis|o no cobramos)/i.test(`${i.titular} ${i.texto}`)),
  };
};

// ── Fragilidad y semáforo por vertical ───────────────────────────────────────
const fragilidadByVertical = {};
for (const f of cruces.fragilidad || []) {
  const v = vmapOf(f.id);
  (fragilidadByVertical[v] ||= []).push(f);
}
const rojoByVertical = {};
for (const s of vigilancia.semaforo || []) {
  if (s.nivel !== "rojo") continue;
  const v = vmapOf(s.id);
  (rojoByVertical[v] ||= []).push(s);
}

// ── Garantías fuertes del arsenal por vertical ───────────────────────────────
const strongGuaranteesByVertical = {};
for (const g of arsenal.garantias.items || []) {
  if (g.fuerza < 3) continue;
  const v = vmapOf(g.id);
  (strongGuaranteesByVertical[v] ||= []).push(g);
}

// ── Fórmulas de titular por vertical (cruces.titularPorVertical usa labels) ──
const formulaByLabel = {};
for (const t of cruces.titularPorVertical || []) formulaByLabel[t.vertical] = t;

// ── Movimientos en vivo (capturas con SEÑAL) ─────────────────────────────────
const movimientosVivos = (anuncios.items || [])
  .filter((i) => /SEÑAL/i.test(i.angulo || ""))
  .map((i) => ({
    quien: i.name,
    que: i.angulo.replace(/^SEÑAL:\s*/i, ""),
    donde: i.plataforma,
    fecha: i.fecha || "",
    etiqueta: "Observado",
  }));

// ── Grupos corporativos ──────────────────────────────────────────────────────
const grupos = (vigilancia.grupos || []).slice(0, 4).map((g) => ({
  grupo: g.grupo,
  marcas: g.marcas.map((m) => m.name),
  evidencia: g.evidencia,
  etiqueta: g.etiqueta || "Observado",
}));

// ── Implicaciones globales ───────────────────────────────────────────────────
const wp = patterns.winnersProfile;
const rp = patterns.restProfile;
const implicaciones = [
  senalGarantia && guaranteePremiumPct != null
    ? {
        senal: "La garantía es terreno casi vacío y además paga",
        dato: `Solo el ${senalGarantia.pct}% de los ${angulos.total} anuncios reales promete garantía. Y quien publica garantía media cobra una mediana de ${eur(midGuar.medianEur)} €/mes frente a ${eur(noGuar.medianEur)} € sin garantía (+${guaranteePremiumPct}%).`,
        implicacion: "Entrar con garantía por escrito diferencia el anuncio Y sostiene un precio mayor. Es la palanca más barata del estudio: no exige más producto, exige atreverse a firmarla.",
        etiqueta: "Observado + Síntesis editorial",
        fuente: "angulos-anuncios.json · cruces.elasticidadGarantia",
      }
    : null,
  strongGuar && strongGuar.n <= 8
    ? {
        senal: "Cuidado con la garantía 'fuerte' barata",
        dato: `Las ${strongGuar.n} fichas con garantía fuerte (4-5) tienen mediana ${eur(strongGuar.medianEur)} €/mes: son modelos low-cost que la usan para compensar precio.`,
        implicacion: "La jugada no es la garantía más agresiva del mercado, sino garantía media-alta con precio medio-alto. La garantía extrema hoy la firman los baratos.",
        etiqueta: "Observado + Síntesis editorial",
        fuente: "cruces.elasticidadGarantia (muestra pequeña: interpretar con cautela)",
      }
    : null,
  senalCifra
    ? {
        senal: "El mercado compite con números",
        dato: `El ${senalCifra.pct}% de los anuncios lleva al menos una cifra en el copy.`,
        implicacion: "Un anuncio o landing sin cifra concreta sale en desventaja estructural. El generador de landings ya inyecta las cifras del estudio por defecto.",
        etiqueta: "Observado",
        fuente: "angulos-anuncios.json",
      }
    : null,
  cruces.curvaEspana?.hueco
    ? {
        senal: "Hueco de precio en España",
        dato: `El tramo ${cruces.curvaEspana.hueco.rango} es el menos poblado de la curva española (${cruces.curvaEspana.hueco.n} actores).`,
        implicacion: "Hay sitio para una oferta premium bien argumentada (garantía + SLA + transparencia) sin pelear en el pantano de 0–300 €.",
        etiqueta: "Observado + Síntesis editorial",
        fuente: "cruces.curvaEspana",
      }
    : null,
  slaTop.length
    ? {
        senal: "La velocidad de contacto ya es un campo de batalla",
        dato: `${slaTotal} fichas declaran SLA de contacto. La frontera: ${slaTop.map((s) => `${s.name} (${s.sla})`).join(", ")}.`,
        implicacion: "Cualquier oferta seria necesita un SLA publicado. Responder en <15 minutos ya te coloca por delante de la inmensa mayoría que ni lo declara.",
        etiqueta: "Observado + Síntesis editorial",
        fuente: "cruces.slas",
      }
    : null,
  {
    senal: "Qué hacen distinto los ganadores",
    dato: `Los ${wp.n} ganadores (score ≥80): ${wp.pricePublicPct}% publica precio (resto: ${rp.pricePublicPct}%), ${wp.guaranteePct}% ofrece garantía (resto: ${rp.guaranteePct}%), ${wp.adsActivePct}% mantiene ads activos (resto: ${rp.adsActivePct}%).`,
    implicacion: "La transparencia (precio + garantía visibles) distingue al segmento ganador. Es correlación, no causalidad — pero es la correlación más consistente del estudio.",
    etiqueta: "Observado + Síntesis editorial",
    fuente: "patterns.winnersProfile",
  },
  {
    senal: "Canales donde viven los ganadores",
    dato: (patterns.winnerChannels || []).slice(0, 5).map((c) => `${c.channel} (${c.pctWinners}%)`).join(" · "),
    implicacion: "Landing propia es obligatoria; SEO y Google Ads son los dos motores dominantes; Meta complementa. El stack mínimo viable ya está definido por el mercado.",
    etiqueta: "Observado",
    fuente: "patterns.winnerChannels",
  },
  {
    senal: "Mercado lleno de competidores frágiles",
    dato: `${(vigilancia.semaforo || []).filter((s) => s.nivel === "rojo").length} de ${(vigilancia.semaforo || []).length} competidores vigilados están en rojo; ${(cruces.fragilidad || []).length} fichas acumulan señales de fragilidad (sin ads, precio oculto, letra pequeña con fricción).`,
    implicacion: "Cada competidor frágil es una lista de clientes descontentos. El plan de 30 días de cada vertical incluye a quién atacar y con qué argumento.",
    etiqueta: "Observado + Síntesis editorial",
    fuente: "vigilancia.semaforo · cruces.fragilidad",
  },
  grupos.length
    ? {
        senal: "El mercado se consolida en grupos",
        dato: grupos.map((g) => `${g.grupo} (${g.marcas.length} marcas)`).join(" · "),
        implicacion: "Varias 'marcas rivales' comparten dueño y backend: mismos leads, distinta fachada. Vender contra una es vender contra todas — y su tamaño les impide personalizar por zona, que es justo donde entra un jugador local.",
        etiqueta: "Observado + Síntesis editorial",
        fuente: "vigilancia.grupos",
      }
    : null,
  movimientosVivos.length
    ? {
        senal: "Movimientos en vivo detectados",
        dato: movimientosVivos.map((m) => `${m.quien}: ${m.que}`).join(" || "),
        implicacion: "Un rebranding y un apagón publicitario son ventanas: clientes desorientados y subastas más baratas mientras dura. Ventanas así caducan en semanas.",
        etiqueta: "Observado + Síntesis editorial",
        fuente: "anuncios-reales.json (capturas en vivo)",
      }
    : null,
].filter(Boolean);

// ── Dossier por vertical ─────────────────────────────────────────────────────
const verticales = verticalesData.verticales.map((v) => {
  const unit = UNITS[v.id] || "clientes";
  const median = v.medianEur || null;
  const formula = formulaByLabel[v.label] || null;
  const fragiles = (fragilidadByVertical[v.id] || [])
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 5)
    .map((f) => ({ id: f.id, name: f.name, puntos: f.puntos, razones: f.razones }));
  const rojos = (rojoByVertical[v.id] || [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => ({ id: s.id, name: s.name, score: s.score, threat: s.threat, adsActive: s.adsActive }));
  const strongGuarantees = (strongGuaranteesByVertical[v.id] || []).sort((a, b) => b.fuerza - a.fuerza);
  const bestGuarantee = strongGuarantees[0] || null;

  const priceLow = median ? round10(median) : null;
  const priceHigh = median && guaranteePremiumPct ? round10(median * (1 + guaranteePremiumPct / 100)) : null;

  const muestraPequena = v.n < 20;

  const historia = [
    `${v.n} empresas compiten por captar ${unit} en este vertical (${v.spainN} en España).`,
    median ? `La mediana de precio observada es ${median} €/mes sobre ${v.pricedN} fichas con precio conocido.` : `Solo ${v.pricedN} fichas publican precio: el vertical se vende a puerta cerrada.`,
    `El ${v.adsActivePct}% mantiene publicidad activa.`,
    strongGuarantees.length
      ? `${strongGuarantees.length} competidores firman garantía fuerte (3+/5); el resto compite sin comprometerse.`
      : `Ningún competidor del vertical firma una garantía fuerte registrada: el terreno del compromiso está vacío.`,
    formula ? `Entre los ganadores del vertical domina la fórmula de titular «${formula.top[0]?.formula}» (${formula.top[0]?.n} de ${formula.winners}).` : "",
    fragiles.length
      ? (fragilidadByVertical[v.id] || []).length === 1
        ? `1 competidor acumula señales de fragilidad.`
        : `${(fragilidadByVertical[v.id] || []).length} competidores acumulan señales de fragilidad.`
      : "",
  ].filter(Boolean).join(" ");

  const oferta = {
    etiqueta: "Síntesis editorial sobre datos observados",
    posicionamiento: strongGuarantees.length
      ? `Transparencia total (precio + condiciones visibles) y garantía igual o mejor que la mejor del vertical (${bestGuarantee.name}).`
      : `Primera marca del vertical con garantía media-alta por escrito: el estudio muestra que nadie la firma aquí.`,
    precio: median
      ? {
          rango: `${priceLow}–${priceHigh || round10(median * 1.35)} €/mes`,
          formula: `mediana observada ${median} € × 1,0–${guaranteePremiumPct ? (1 + guaranteePremiumPct / 100).toFixed(2).replace(".", ",") : "1,35"} (prima que sostiene una garantía media según la elasticidad global: ${eur(midGuar?.medianEur)} € con garantía vs ${eur(noGuar?.medianEur)} € sin ella)`,
          etiqueta: "Estimado (cálculo visible)",
          advertencia: [
            v.pricedN < 8 ? `Base pequeña: la mediana sale de solo ${v.pricedN} fichas con precio conocido.` : null,
            median < 100 ? "Ojo: una mediana tan baja indica que el vertical mezcla cuotas mensuales con precio por lead — usarla como referencia de coste por lead, no de cuota." : null,
          ].filter(Boolean).join(" ") || null,
        }
      : { rango: "no publicado", formula: "sin base de precios suficiente en el vertical; usar la mediana global de España como referencia inicial", etiqueta: "Estimado", advertencia: null },
    garantia: {
      texto: unitGender(unit) === "f"
        ? `Si el primer mes no recibes las ${unit} pactadas en la propuesta, seguimos trabajando gratis hasta conseguirlas. Por contrato.`
        : `Si el primer mes no recibes los ${unit} pactados en la propuesta, seguimos trabajando gratis hasta conseguirlos. Por contrato.`,
      respaldo: bestGuarantee
        ? `Referencia real del vertical: «${bestGuarantee.text.slice(0, 140)}${bestGuarantee.text.length > 140 ? "…" : ""}» (${bestGuarantee.name}, fuerza ${bestGuarantee.fuerza}/5)`
        : "Sin referencia en el vertical: la garantía se firma contra el estándar global del estudio.",
    },
    sla: slaTop.length
      ? { objetivo: "Contacto en <15 minutos en horario laboral, publicado en la landing", referencia: `La frontera del mercado es ${slaTop[0].name} (${slaTop[0].sla}); la mayoría ni declara SLA.` }
      : null,
    formulaTitular: formula
      ? { formula: formula.top[0]?.formula, uso: `${formula.top[0]?.n} de ${formula.winners} ganadores del vertical la usan`, alternativas: formula.top.slice(1).map((t) => t.formula) }
      : null,
    canales: (patterns.winnerChannels || []).slice(0, 3).map((c) => c.channel),
  };

  const escenarios = median
    ? [5, 10, 20].map((clientes) => ({
        clientes,
        mrr: clientes * median,
        formula: `${clientes} clientes × ${median} €/mes (mediana del vertical) = ${(clientes * median).toLocaleString("es-ES")} €/mes`,
      }))
    : [];

  const plan30 = [
    { semana: 1, accion: `Montar la landing con el Landing Studio (1 clic sobre este vertical): garantía por delante, banda de cifras del estudio y formulario según objetivo. Publicar precio en el rango ${oferta.precio.rango}.` },
    { semana: 2, accion: `Campaña en ${oferta.canales.filter((c) => /ads/i.test(c)).join(" y ") || "Google Ads"} con la fórmula «${oferta.formulaTitular?.formula || "Número concreto"}» y una cifra real en cada anuncio${senalGarantia ? ` (solo el ${senalGarantia.pct}% del mercado promete garantía en el anuncio: hacerlo)` : ""}. SLA operativo <15 min desde el primer lead.` },
    fragiles.length
      ? { semana: 3, accion: `Ataque directo a los clientes de los frágiles (${fragiles.slice(0, 3).map((f) => f.name).join(", ")}): su debilidad documentada (${[...new Set(fragiles.flatMap((f) => f.razones))].slice(0, 3).join(", ")}) es el argumento comercial.` }
      : { semana: 3, accion: "Prospección directa sobre el cliente ideal del vertical; sin frágiles documentados, el argumento es la garantía firmada que nadie más ofrece." },
    { semana: 4, accion: `Revisión con datos: coste por ${singularUnit(unit)}, cumplimiento del SLA y de la garantía. Ajustar precio dentro del rango antes de escalar inversión.` },
  ];

  // ── KIT DE SALIDA AL MERCADO (todo marca RedVitalia, copia y pega) ─────────
  const ctx = SALES_CONTEXT[v.id] || SALES_CONTEXT.generalista;
  const pctGar = senalGarantia ? senalGarantia.pct : null;
  const adSignals = verticalAdSignals(v.id);
  const datoGarantia = adSignals
    ? adSignals.garantiaPct === 0
      ? `NINGUNO de los ${adSignals.n} anuncios reales capturados en tu vertical promete una garantía`
      : `de los ${adSignals.n} anuncios reales capturados en tu vertical, solo el ${adSignals.garantiaPct}% promete una garantía`
    : pctGar != null
      ? `solo ${pctGar} de cada 100 anuncios del sector se comprometen a una garantía`
      : "casi nadie en el sector firma una garantía";
  const datoCifra = adSignals
    ? `el ${adSignals.cifraPct}% de los anuncios de tu vertical compite con cifras en el copy`
    : senalCifra
      ? `el ${senalCifra.pct}% de los anuncios del sector compite con cifras en el copy`
      : "";
  const senalesKit = adSignals
    ? `Señales medidas en los ${adSignals.n} anuncios reales de este vertical: ${adSignals.garantiaPct}% promete garantía · ${adSignals.cifraPct}% usa cifras.`
    : `Señales del corpus global (${angulos.total} anuncios; el vertical tiene pocos anuncios propios capturados): ${pctGar ?? "—"}% promete garantía.`;
  const garantiaRV = oferta.garantia.texto;
  const rangoPrecio = oferta.precio.rango;
  const medianaTxt = median ? `${median} €/mes` : "no publicada (el sector vende a puerta cerrada)";
  const fragilesArg = fragiles.length
    ? `Varios proveedores del vertical operan con debilidades documentadas (${[...new Set(fragiles.flatMap((f) => f.razones))].slice(0, 3).join(", ")}).`
    : "La mayoría del sector ni publica precio ni firma compromiso.";

  const llamadaFria = {
    titulo: `Guion de llamada en frío · RedVitalia · ${v.label}`,
    para: `Quien llama en frío a ${ctx.decisor}. Personalizar [NOMBRE], [ZONA] y [SDR] antes de marcar.`,
    pasos: [
      { fase: "1 · Apertura con permiso (10 seg)", texto: `Hola, ¿hablo con [NOMBRE]? Soy [SDR], de RedVitalia. Te llamo en frío y te lo digo de frente: ¿me das 30 segundos y decides tú si seguimos?` },
      { fase: "2 · Gancho con el dato (30 seg)", texto: `Trabajamos captación de ${unit} para ${ctx.negocio} en [ZONA]. Antes de salir al mercado analizamos ${v.n} empresas que venden esto mismo, y hay un dato que lo resume todo: ${datoGarantia}. Nosotros firmamos lo contrario: ${lcFirst(garantiaRV)}` },
      { fase: "3 · Calificar (3 preguntas, en este orden)", texto: `① Si el mes que viene te entran más ${unit}, ¿tienes capacidad real para atenderlos? ② ¿Cómo los estás consiguiendo ahora — recomendación, portales, alguna agencia? ③ Si esto encaja, ¿la decisión la tomas tú?` },
      { fase: "4 · Cierre a cita (nunca vender aquí)", texto: `No te voy a vender nada por teléfono. Te propongo 20 minutos con nuestro responsable: revisa tu zona contra el estudio y te dice si hay hueco de verdad, con condiciones por escrito. ¿Mejor mañana a primera hora o por la tarde?` },
    ],
    objeciones: [
      { objecion: "«Ya trabajo con alguien»", respuesta: `Perfecto, no te pido que lo dejes. Una sola pregunta: ¿te ha puesto la garantía por escrito? En el estudio, ${datoGarantia}. ${fragilesArg} Si la tienes firmada, quédate con él. Si no, 20 minutos para comparar no te cuestan nada.` },
      { objecion: "«¿Cuánto cuesta?»", respuesta: `Depende del hueco de tu zona. El rango publicado es ${rangoPrecio} y la mediana del mercado está en ${medianaTxt}. En la llamada de 20 minutos lo ves con tu zona delante y por escrito — sin sorpresas después de firmar, que es lo habitual en el sector.` },
      { objecion: "«Mándame información»", respuesta: `Te la mando ahora mismo al correo. Y para que no se quede en la bandeja: la vemos juntos en 20 minutos, ¿jueves o viernes?` },
      { objecion: "«No tengo tiempo»", respuesta: `Por eso el compromiso es mío: 20 minutos cronometrados y sales con tu zona revisada contra ${v.n} competidores. Si me paso del tiempo, cuelga.` },
    ],
  };

  const closer = {
    titulo: `Guion del closer · RedVitalia · ${v.label}`,
    para: `Llamada de cierre de 20 minutos con ${ctx.decisor}, después de la llamada fría o del formulario de la landing.`,
    pasos: [
      { fase: "1 · Agenda (1 min)", texto: `Veinte minutos: cinco para tu situación, diez para lo que dice el estudio de tu zona, cinco para decidir. Si veo que no encaja, te lo digo yo antes que tú.` },
      { fase: "2 · Diagnóstico (5 min)", texto: `Repasa lo que dijo en la llamada fría y cierra el número clave: ¿cuántos ${unit} al mes puedes absorber sin romper el servicio? Ese número limita la propuesta — se lo dices así, y quedas como el único que pregunta por su capacidad antes de vender.` },
      { fase: "3 · El estudio (5 min)", texto: `Esto no es una promesa comercial: hemos analizado ${v.n} empresas que venden captación en tu sector (${v.spainN} en España). La mediana cobra ${medianaTxt}. ${fragilesArg} Nuestra conclusión: el hueco no está en prometer más, está en comprometerse por escrito.` },
      { fase: "4 · La oferta (5 min, en este orden)", texto: `① Proceso visible: qué se revisa, qué se entrega, quién responde. ② Precio dentro del rango publicado ${rangoPrecio} — se explica el porqué con la mediana delante. ③ La garantía: ${lcFirst(garantiaRV)} ④ SLA: contacto en menos de 15 minutos, publicado. ⑤ Sin permanencia: la renovación se gana con resultados.` },
      { fase: "5 · Cierre (2 min)", texto: `¿Te mando la propuesta con la garantía y el SLA por escrito y empezamos el lunes? — Silencio. El primero que habla después de esta pregunta, pierde.` },
    ],
    objeciones: [
      { objecion: "«Es más caro que otros»", respuesta: `Cierto, estamos por encima de la mediana (${medianaTxt}). La diferencia exacta es la garantía: quien no la firma no la puede cobrar. Pregunta a cualquier otro si te pone por contrato qué pasa si el primer mes no cumple. ${pctGar != null ? `${100 - pctGar} de cada 100 no lo hacen.` : ""}` },
      { objecion: "«Me lo tengo que pensar»", respuesta: `Lógico. Te dejo la propuesta por escrito con precio, garantía, SLA y exclusiones — todo. Piénsalo con eso delante, no con mi palabra. Y recuerda quién asume el riesgo del primer mes: yo, no tú.` },
      { objecion: "«Tengo una oferta más barata»", respuesta: `Pídele tres cosas por escrito: garantía, SLA y si tus leads son en exclusiva o se revenden. Si te las da firmadas, cógela. En el estudio, la mayoría no supera la primera.` },
    ],
  };

  const emails = [
    {
      id: "email-1-frio",
      cuando: "Primer contacto en frío o justo después de la llamada",
      asunto: `El dato de [ZONA] que nadie te cuenta`,
      cuerpo: `Hola [NOMBRE]:\n\nAntes de vender captación de ${unit} en [ZONA], analizamos ${v.n} empresas que ya la venden (${v.spainN} en España).\n\nDos datos:\n— La mediana del sector cobra ${medianaTxt}.\n— ${cap(datoGarantia)}.\n\nNosotros salimos al mercado con lo contrario: ${garantiaRV}\n\n¿Veinte minutos esta semana para revisar tu zona contra el estudio? Sales con la respuesta por escrito, encaje o no.\n\n[SDR]\nRedVitalia · Captación de ${unit}\n\nPD: La garantía va en el contrato, no en este email.`,
    },
    {
      id: "email-2-garantia",
      cuando: "3 días después sin respuesta",
      asunto: `Por escrito, no en un anuncio`,
      cuerpo: `Hola [NOMBRE]:\n\nTe resumo en cuatro líneas lo que firmamos con cada ${ctx.negocio}:\n\n1. Zona y capacidad comprobadas ANTES de aceptar el caso.\n2. Precio dentro del rango publicado: ${rangoPrecio}.\n3. ${garantiaRV}\n4. Contacto en menos de 15 minutos y sin permanencia.\n\nSi tu proveedor actual te tiene esto firmado, quédate con él — lo digo en serio.\nSi no, son 20 minutos: [ENLACE AGENDA].\n\n[SDR] · RedVitalia`,
    },
    {
      id: "email-3-breakup",
      cuando: "7 días después sin respuesta (último)",
      asunto: `¿Lo cierro, [NOMBRE]?`,
      cuerpo: `Hola [NOMBRE]:\n\nNo quiero perseguirte. Cierro tu hueco de [ZONA] esta semana y se lo ofrezco al siguiente ${ctx.negocio} de la lista.\n\nSi en algún momento quieres los datos de tu zona (${v.n} competidores analizados, mediana ${medianaTxt}), respondes a este correo y te los mando sin compromiso.\n\nUn abrazo,\n[SDR] · RedVitalia`,
    },
  ];

  // Titulares construidos con las fórmulas que ganan en ESTE vertical.
  const FORMULA_HEADLINES = {
    "número concreto": [truncate(`Estudio de ${v.n} empresas`, 30), median && median >= 100 ? truncate(`Mediana real: ${median} €/mes`, 30) : null],
    "riesgo invertido": ["Si no llegan, seguimos gratis", "El riesgo lo asumimos nosotros"],
    "exclusividad / escasez": ["Tus leads, de nadie más", "Plazas limitadas por zona"],
    "cómo / método": ["Proceso visible paso a paso", "Método a la vista, sin humo"],
    "enemigo común": ["¿Harto de leads revendidos?"],
    "resultado directo": [truncate(`${cap(unit)} que sí encajan`, 30)],
    "pregunta directa": [truncate(cap(ctx.hookMeta || ""), 30)],
  };
  const formulaHeads = (formula?.top || [])
    .flatMap((t) => FORMULA_HEADLINES[(t.formula || "").toLocaleLowerCase("es").trim()] || [])
    .filter(Boolean);

  const googleTitulares = [
    ...formulaHeads,
    truncate(`Capta ${unit}`, 30),
    "Garantía por contrato",
    "Si no llegan, seguimos gratis",
    "RedVitalia · Captación",
    truncate(`${cap(unit)} en tu zona`, 30),
    "Sin permanencia",
    "Condiciones por escrito",
    "Respuesta en 15 minutos",
    truncate(`Estudio de ${v.n} empresas`, 30),
    pctGar != null ? truncate(`Solo ${pctGar} de 100 dan garantía`, 30) : "Casi nadie firma garantía",
    "Tu zona, comprobada antes",
    "Precio claro desde el día 1",
    median && median >= 100 ? truncate(`Mediana del sector: ${median} €`, 30) : "Precios que otros esconden",
    "Revisión inicial sin coste",
    "Te atiende una persona",
  ].filter((t, i, arr) => arr.indexOf(t) === i).slice(0, 15);

  const desc1 = `Captación de ${unit} con garantía por contrato: si el primer mes no llegan, seguimos gratis.`;
  const googleDescripciones = [
    desc1.length <= 90 ? desc1 : "Captación con garantía por contrato: si el primer mes no llegan, seguimos gratis.",
    "Zona comprobada antes de prometer. Condiciones por escrito, sin letra pequeña.",
    truncate(`Basado en el análisis de ${v.n} empresas del sector. Respuesta en menos de 15 minutos.`, 90),
    "Sin permanencia: la renovación se gana con resultados. Pide tu revisión inicial.",
  ];

  const googleAds = {
    campana: `RV · Search · ${v.label} · [ZONA]`,
    estructura: "Una campaña de Búsqueda por vertical, un grupo por intención. Presupuesto inicial según zona; concordancia de frase para arrancar y exacta para escalar lo que convierta.",
    keywords: ctx.keywords.map((kw) => ({ kw, concordancia: "frase" })),
    adGroups: [
      { nombre: "G1 · Intención directa", keywords: ctx.keywords, nota: "Concordancia de frase para arrancar; pasar a exacta lo que convierta. Anclar el titular de marca (RedVitalia · Captación) en posición 3." },
      { nombre: "G2 · Garantía y confianza", keywords: ["agencia captacion con garantia", "leads con garantia", "agencia marketing resultados garantizados"], nota: "Activar cuando G1 tenga conversiones: recoge al que ya busca compromiso. Usar los titulares de riesgo invertido en las posiciones 1-2." },
    ],
    negativas: ["gratis", "empleo", "trabajo", "curso", "cursos", "master", "que es", "definicion", "software", "crm", "plantilla", "ejemplos", "opiniones"],
    titulares: googleTitulares,
    descripciones: googleDescripciones,
    callouts: ["Garantía por contrato", "Sin permanencia", "Respuesta en 15 min", "Todo por escrito"],
    sitelinks: [
      { texto: "Cómo trabajamos", descripcion: "Proceso visible de principio a fin" },
      { texto: "Garantía RedVitalia", descripcion: "Por escrito en la propuesta" },
      { texto: "Precio publicado", descripcion: truncate(`Rango: ${rangoPrecio}`, 35) },
      { texto: "Pedir revisión", descripcion: "Respuesta en menos de 15 min" },
    ],
    nota: `Los titulares respetan el límite de 30 caracteres y las descripciones el de 90; los primeros salen de las fórmulas que más usan los ganadores de este vertical.${datoCifra ? ` ${cap(datoCifra)} — por eso cada titular lleva un dato.` : ""} La landing de destino se genera en el Landing Studio con este mismo vertical.`,
  };

  const brandingImagen = `Identidad de marca: banda o elementos en azul RedVitalia (#1769e0) con texto blanco en sans-serif bold; la palabra "RedVitalia" como logotipo tipográfico limpio en la esquina inferior derecha. Estilo: fotografía publicitaria realista y luminosa, composición limpia tipo anuncio premium con espacio negativo reservado para el texto, sin marcas de terceros, sin rostros reconocibles en primer plano, sin texto adicional al indicado. Formato 1:1 (1080×1080).`;
  const altPrompt = (claim) => `Cartel publicitario puramente tipográfico: fondo azul RedVitalia (#1769e0) liso con una textura muy sutil de puntos, texto principal en blanco, enorme y en sans-serif black, ocupando el centro: "${claim}". Debajo, pequeño y en blanco: "RedVitalia". Estilo suizo minimalista, altísimo contraste, sin fotografía, sin iconos, sin elementos decorativos adicionales. Formato 1:1 (1080×1080).`;
  const notaChatGPT = `NOTA PARA CHATGPT: genera esta imagen con tu generador. Comprueba letra a letra que el texto sobreimpreso salga EXACTO y sin erratas (es el fallo más común); si el texto sale mal dos veces, genera la escena SIN texto y lo añadimos en edición. Exporta también versión 4:5 (1080×1350) para feed. Mantén el azul #1769e0.`;

  const metaAds = {
    campana: `RV · Meta · ${v.label} · [ZONA]`,
    nota: "Tres ángulos, un anuncio por ángulo para arrancar (presupuesto repartido, optimización por contactos). El dato de cada texto sale del estudio; la garantía es oferta propia de RedVitalia. ChatGPT prepara el concepto y genera la imagen; una persona aprueba antes de publicar.",
    anuncios: [
      {
        nombre: "A · Garantía firmada",
        angulo: `El hueco del mercado: ${datoGarantia}`,
        primaryText: `${ctx.hookMeta}\n\nEl problema no eres tú: es que en este mercado ${lcFirst(datoGarantia)}. Analizamos ${v.n} empresas que venden captación en tu sector antes de salir a él.\n\nNosotros lo firmamos al revés: ${lcFirst(garantiaRV)}\n\nZona comprobada antes de aceptar tu caso. Sin permanencia. Todo por escrito.\n\n👉 Pide la revisión de tu zona — respuesta en menos de 15 minutos.`,
        headline: truncate(`${cap(unit)} con garantía firmada`, 40),
        description: "Por contrato, no en un anuncio. RedVitalia.",
        cta: "Más información",
        imagenPrompt: `${ctx.escena}. Sobreimpreso en grande el texto: "Si no llegan, seguimos gratis. Por contrato." ${brandingImagen}`,
        imagenPromptAlt: altPrompt("Si no llegan, seguimos gratis. Por contrato."),
        notaChatGPT,
      },
      {
        nombre: "B · Contra el proveedor típico",
        angulo: "Dolor: leads revendidos, precio oculto, permanencias",
        primaryText: `Señales de que tu proveedor de ${unit} te está tomando el pelo:\n\n❌ El precio aparece después de firmar.\n❌ El mismo lead se lo venden a tres competidores.\n❌ Permanencia escondida en la letra pequeña.\n❌ Garantía de palabra, nunca por escrito.\n\nEn RedVitalia trabajamos al revés: precio publicado (${rangoPrecio}), leads en exclusiva, sin permanencia y garantía por contrato.\n\n👉 Compara en 20 minutos. Si tu proveedor supera la comparación, quédate con él.`,
        headline: "Tus leads no se revenden",
        description: "Exclusiva, sin permanencia y por escrito.",
        cta: "Más información",
        imagenPrompt: `${ctx.escena}, en un momento de tensión resuelta: el profesional revisa un contrato claro sobre la mesa. Sobreimpreso en grande el texto: "Tus leads no se revenden." ${brandingImagen}`,
        imagenPromptAlt: altPrompt("Tus leads no se revenden."),
        notaChatGPT,
      },
      {
        nombre: "C · Las cifras del estudio",
        angulo: "Autoridad: el estudio de mercado como prueba",
        primaryText: `Antes de vender captación de ${unit}, hicimos los deberes:\n\n📊 ${v.n} empresas del sector analizadas (${v.spainN} en España).\n💶 Mediana de precio del mercado: ${medianaTxt}.\n${pctGar != null ? `📉 Solo ${pctGar} de cada 100 anuncios prometen garantía.\n` : ""}\nCada táctica que usamos sale de ese estudio, no de una plantilla. Y el compromiso va firmado: ${garantiaRV}\n\n👉 Pide la revisión de tu zona y te enseñamos los datos.`,
        headline: truncate(`${v.n} empresas analizadas`, 40),
        description: "El estudio detrás de cada campaña. RedVitalia.",
        cta: "Reservar",
        imagenPrompt: `Mesa de trabajo elegante con un dossier impreso titulado "Estudio del sector" abierto junto a un portátil con gráficas; al fondo, desenfocada, ${ctx.escena}. Sobreimpreso en grande el texto: "${v.n} empresas analizadas. Una conclusión." ${brandingImagen}`,
        imagenPromptAlt: altPrompt(`${v.n} empresas analizadas. Una conclusión.`),
        notaChatGPT,
      },
      {
        nombre: "D · Retargeting (vieron la landing)",
        angulo: "Recuperar al que ya mostró interés; mensaje corto y sin presión falsa",
        primaryText: `Estuviste mirando cómo captamos ${unit} con garantía firmada y lo dejaste a medias.\n\nLo esencial, en tres líneas:\n✔ ${garantiaRV}\n✔ Zona y capacidad comprobadas antes de aceptar tu caso.\n✔ Sin permanencia y con el precio publicado.\n\n👉 Retoma tu revisión — dos minutos y decides con datos.`,
        headline: "Tu revisión sigue abierta",
        description: "RedVitalia · Garantía por contrato.",
        cta: "Más información",
        imagenPrompt: `${ctx.escena}, tono más cercano e íntimo, luz de última hora de la tarde. Sobreimpreso en grande el texto: "Lo dejamos donde lo dejaste." ${brandingImagen}`,
        imagenPromptAlt: altPrompt("Lo dejamos donde lo dejaste."),
        notaChatGPT,
      },
    ],
  };

  // ── Propuesta comercial (la que el closer envía por escrito) ────────────────
  const unitSing = singularUnit(unit);
  const tuyoUnit = unitGender(unit) === "f" ? "tuya" : "tuyo";
  const propuesta = {
    titulo: `Plantilla de propuesta comercial · RedVitalia · ${v.label}`,
    nota: "Es la propuesta que el guion del closer promete enviar. Rellenar corchetes y adjuntar en PDF. Si algo no está escrito aquí, no está pactado — esa frase final es parte de la venta.",
    texto: [
      `PROPUESTA DE COLABORACIÓN · RedVitalia`,
      `Para: [NOMBRE] · [NEGOCIO] · [ZONA]`,
      `Fecha: [FECHA] · Validez: 14 días`,
      ``,
      `1 · QUÉ CONTRATAS`,
      `Captación de ${unit} para tu ${ctx.negocio.replace(/^una? /, "")} en [ZONA].`,
      `Capacidad declarada por tu parte: [N] ${unit} al mes. La propuesta se dimensiona a ese número, no por encima.`,
      ``,
      `2 · CÓMO TRABAJAMOS`,
      `— Semana 1: landing propia y campañas activas con el presupuesto acordado.`,
      `— Desde el primer lead: contacto en menos de 15 minutos en horario laboral (SLA publicado).`,
      `— Cada ${unitSing} es ${tuyoUnit} en exclusiva: no se revende ni se comparte con terceros.`,
      `— Informe [semanal/quincenal] con coste por ${unitSing} y detalle de campañas.`,
      ``,
      `3 · INVERSIÓN`,
      `— Cuota RedVitalia: [PRECIO] €/mes (rango de referencia del estudio de mercado: ${rangoPrecio}).`,
      `— Inversión publicitaria: aparte y pagada por ti directamente a Google/Meta ([RANGO ADS] €/mes recomendado de inicio).`,
      `— Sin permanencia: cancelas con 15 días de aviso, con efecto a fin de mes.`,
      ``,
      `4 · GARANTÍA (la parte que casi nadie firma)`,
      garantiaRV,
      `Exclusiones — para que la garantía signifique algo: datos de contacto falsos aportados por el lead; leads fuera de la zona pactada; incumplimiento del SLA de respuesta acordado por tu parte; impago de la cuota o de la inversión publicitaria; cambios de zona o de servicio no comunicados por escrito.`,
      ``,
      `5 · LO QUE NECESITAMOS DE TI`,
      `— Responder a los leads dentro de tu SLA acordado ([X] minutos).`,
      `— Feedback semanal de qué leads avanzaron (sin esto la garantía no se puede medir).`,
      `— Un canal de entrega: [teléfono / WhatsApp / CRM].`,
      ``,
      `6 · SIGUIENTE PASO`,
      `Firma de esta propuesta y alta. Primera campaña activa en [7] días desde el alta.`,
      ``,
      `RedVitalia · [RESPONSABLE LEGAL] · [CIF] · [CONTACTO]`,
      `Esta propuesta refleja todas las condiciones: si algo no está aquí escrito, no está pactado.`,
    ].join("\n"),
  };

  // ── Seguimiento por WhatsApp ────────────────────────────────────────────────
  const whatsapp = [
    { cuando: "Justo después de la llamada fría", texto: `Hola [NOMBRE], soy [SDR] de RedVitalia 👋 Te dejo por aquí lo que te comenté: analizamos ${v.n} empresas que venden captación de ${unit} antes de salir al mercado, y nuestra diferencia va firmada — si el primer mes no llegan, seguimos gratis. ¿Te va bien el [DÍA] a las [HORA] para verlo en 20 minutos?` },
    { cuando: "48 h después de enviar la propuesta", texto: `Hola [NOMBRE], ¿pudiste ver la propuesta? Lo importante está en el punto 4: el riesgo del primer mes es nuestro, no tuyo. Si hay cualquier duda, me la dices por aquí mismo y la resolvemos.` },
    { cuando: "Cierre de seguimiento (último mensaje)", texto: `[NOMBRE], cierro tu hueco de [ZONA] esta semana. Si quieres que lo aguante unos días, dímelo. Y si no encaja, también — te dejo igualmente los datos de tu zona por si te sirven. Un abrazo.` },
  ];

  const kit = {
    etiqueta: "Síntesis editorial de RedVitalia construida sobre los datos del estudio. Personalizar [NOMBRE], [ZONA], [SDR] y [ENLACE AGENDA] antes de usar. Los datos citados (nº de empresas, medianas, % de garantía) son observados; la garantía y el SLA son compromisos propios de RedVitalia y deben ir en el contrato antes de anunciarse.",
    senales: senalesKit,
    llamadaFria,
    closer,
    emails,
    whatsapp,
    propuesta,
    googleAds,
    metaAds,
  };

  return {
    id: v.id,
    label: v.label,
    n: v.n,
    spainN: v.spainN,
    medianEur: median,
    pricedN: v.pricedN,
    adsActivePct: v.adsActivePct,
    unit,
    clienteIdeal: v.clienteIdeal || "",
    estacionalidad: v.estacionalidad || "",
    muestraPequena,
    historia,
    oferta,
    economics: { escenarios, etiqueta: "Estimado (cálculo visible)", nota: "MRR bruto a mediana de mercado; no incluye coste de adquisición ni operación. Es tamaño de oportunidad, no una previsión." },
    debiles: { fragiles, rojos },
    referentes: (v.referentes || []).slice(0, 3),
    plan30,
    kit,
  };
});

// Orden editorial: oportunidad primero (España grande + mediana alta), generalista al final.
verticales.sort((a, b) => {
  if (a.id === "generalista") return 1;
  if (b.id === "generalista") return -1;
  return (b.spainN * (b.medianEur || 150)) - (a.spainN * (a.medianEur || 150));
});

const dossier = {
  schema: "rv-dossier-v1",
  generatedAt: new Date().toLocaleDateString("es-ES"),
  nota: "Dossier generado desde los datos del portal (fichas, arsenal, cruces, vigilancia, anuncios). Etiquetas: Observado = dato de las fichas · Estimado = cálculo visible sobre datos observados · Síntesis editorial = lectura razonada, no un hecho medido.",
  mercado: {
    universe: insights.universe,
    spainCount: insights.spainCount,
    worldMedianEur: insights.worldMedianEur,
    huecoPrecioEspana: cruces.curvaEspana?.hueco || null,
    slaFrontera: slaTop,
    elasticidadGarantia: elastic,
    ganadores: { winners: wp, resto: rp },
  },
  implicaciones,
  movimientos: movimientosVivos,
  grupos,
  verticales,
};

writeFileSync(resolve(root, "public/data/dossier.json"), JSON.stringify(dossier, null, 1) + "\n");
console.log(`dossier.json: ${verticales.length} verticales · ${implicaciones.length} implicaciones · ${movimientosVivos.length} movimientos vivos`);
