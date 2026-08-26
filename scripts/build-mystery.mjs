#!/usr/bin/env node
/**
 * Genera public/data/mystery.json — kit operativo de mystery shopping para Nidia:
 * objetivos priorizados desde el catálogo, identidades de cobertura, guiones,
 * checklist de captura, plantilla de registro y flujo de subida/procesado.
 * El contenido operativo es editorial; los objetivos y sus datos salen del catálogo.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const companies = JSON.parse(readFileSync(resolve(root, "public/data/companies-index.json"), "utf8"));

const spain = companies.filter((c) => c.primaryCountry === "España");
const nicheOf = (c) => {
  const t = `${c.name} ${c.offer || ""} ${c.niche || ""} ${c.model || ""}`.toLowerCase();
  if (/dental|odont|implante/.test(t)) return "dental";
  if (/est[eé]tic|belleza/.test(t)) return "estetica";
  if (/solar|fotovolta|placas/.test(t)) return "solar";
  if (/reforma|construc|obra/.test(t)) return "reformas";
  if (/inmobiliari/.test(t)) return "inmobiliaria";
  return "general";
};

const identities = [
  {
    id: "dental",
    label: "Clínica dental en apertura",
    story: "Vas a abrir una clínica dental en Valencia dentro de 2 meses (traspaso ya firmado, reforma en marcha). Vienes de trabajar como gestora en otra clínica y ahora montas la tuya. Aún no tenéis web terminada — por eso buscáis a alguien que os traiga primeros pacientes desde el día uno.",
    dataToGive: "Nombre propio real o variante · 'Clínica en [barrio de Valencia], nombre por registrar' · presupuesto declarado: 600-900 €/mes en publicidad aparte del servicio · urgencia: abrir con agenda medio llena.",
    goodFor: "Fichas de dental, salud y clínicas.",
  },
  {
    id: "estetica",
    label: "Centro de estética recién traspasado",
    story: "Acabas de quedarte el traspaso de un centro de estética en Alicante que había bajado mucho. Tiene local, camillas y una empleada, pero la clientela se fue con la antigua dueña. Necesitas llenar la agenda en 90 días.",
    dataToGive: "Nombre propio · 'centro en Alicante centro, ahora mismo con el nombre antiguo' · presupuesto: hasta 500 €/mes de servicio + publicidad · pregunta clave que sueltas: '¿y si no me traéis clientas, qué pasa?'",
    goodFor: "Estética, belleza y generalistas de negocio local.",
  },
  {
    id: "reformas",
    label: "Empresa de reformas familiar",
    story: "Llevas la administración de la empresa de reformas de tu familia en Murcia (tu marido/hermano y dos oficiales). Trabajo no falta, pero todo viene del boca a boca y quieren dejar de depender de eso. Nunca habéis hecho publicidad.",
    dataToGive: "Nombre propio · 'Reformas [apellido], en Murcia, sin web (solo Instagram)' · presupuesto: 'depende de lo que nos traigáis' — fuerza a que te lo cualifiquen ellos · objeción preparada: 'ya nos llamó una de estas empresas y eran leads compartidos con 5 más'.",
    goodFor: "Reformas, construcción, oficios y vendedores de leads.",
  },
  {
    id: "solar",
    label: "Instaladora solar que quiere crecer",
    story: "Oficina técnica de instalaciones fotovoltaicas en Alicante provincia, 2 cuadrillas. Hasta ahora subcontratabais para una comercializadora y queréis cliente final propio. Sabéis lo que es un lead: ya comprasteis a un portal y salió regular.",
    dataToGive: "Nombre propio · 'instalaciones [nombre], SL real en trámite de cambio de actividad' · presupuesto: 1.000-1.500 €/mes · pregunta clave: 'los leads ¿son exclusivos o compartidos? ¿reponéis los falsos?'",
    goodFor: "Solar, energía y marketplaces de leads.",
  },
  {
    id: "general",
    label: "Negocio local genérico (comodín)",
    story: "Adapta el comodín al nicho de la ficha: gestora de un negocio local real del sector que corresponda, en apertura o en relanzamiento, sin web o con web antigua, que busca cliente nuevo YA.",
    dataToGive: "Nombre propio · ciudad mediana de Levante · presupuesto medio del sector (mira la mediana de precios del apartado Conclusiones) · siempre la misma pregunta final: garantía, exclusividad y permanencia.",
    goodFor: "Cualquier ficha sin nicho claro.",
  },
];

const baseQuestions = [
  "¿Cómo conseguís los clientes: publicidad propia, base de datos, llamadas?",
  "¿El lead o la cita es EXCLUSIVA para mí o la vendéis a más negocios?",
  "¿Qué pasa si el lead es falso, no contesta o está fuera de mi zona? ¿Lo reponéis?",
  "¿Hay permanencia? ¿Puedo salirme el mes que quiera?",
  "¿Qué me garantizáis por escrito? ¿Y si un mes no llega nada?",
  "Precio total: cuota, setup, ¿la publicidad va aparte? ¿De cuánto hablamos al mes TODO incluido?",
  "¿Trabajáis con más negocios de mi sector en mi zona?",
  "¿Cuándo empiezo a ver resultados según vuestra experiencia real?",
];

const captureChecklist = [
  "Minutos desde el formulario/llamada hasta su primera respuesta",
  "Canal de respuesta (llamada, WhatsApp, email) y a qué hora",
  "Guion de apertura: qué preguntan ellos primero (¿cualifican o venden?)",
  "Precio EXACTO ofrecido (cuota, setup, publicidad aparte, descuentos)",
  "Garantía ofrecida con sus palabras exactas",
  "Exclusividad: qué contestan y cómo lo justifican",
  "Permanencia y letra pequeña del contrato",
  "Presión de cierre: urgencia, descuento por firmar hoy, plazas limitadas",
  "Nº de toques de seguimiento y por qué canales durante 14 días",
  "Documentos recibidos: propuesta PDF, contrato, presentación (guardar TODO)",
];

const strongTargets = spain
  .filter((c) => c.threat === "Alta" || (c.relation === "Competidor directo" && c.score >= 70))
  .sort((a, b) => (b.threat === "Alta" ? 1 : 0) - (a.threat === "Alta" ? 1 : 0) || b.score - a.score)
  .slice(0, 25)
  .map((c, i) => ({
    order: i + 1,
    id: c.id,
    name: c.name,
    website: c.website,
    threat: c.threat,
    agencyType: c.agencyType,
    identity: nicheOf(c),
    focus: c.guarantee
      ? `Su garantía pública dice: «${(c.guarantee || "").slice(0, 160)}». Comprobar si la sostienen de palabra y por contrato.`
      : "No publica garantía: preguntar explícitamente qué garantizan y ver si improvisan.",
    priceRef: c.priceLocal ? `Precio público de referencia: ${(c.priceLocal || "").slice(0, 120)}` : "Sin precio público: objetivo nº1 es sacar la cifra real.",
  }));

const mystery = {
  generatedAt: "23/08/2026",
  intro: "Kit operativo para conocer al detalle cómo vende la competencia: qué prometen, qué cobran de verdad y cómo cierran. Responsable: Nidia. Todo lo capturado vuelve a la plataforma y enriquece la ficha de cada empresa.",
  legal: [
    "Grabar una conversación en la que TÚ participas es legal en España para uso interno y de análisis (no lo es difundirla públicamente ni grabar conversaciones ajenas). Guardar las grabaciones solo en la carpeta interna del equipo.",
    "No firmar ningún contrato ni realizar pagos. El ejercicio termina SIEMPRE antes de la firma: 'lo consulto con mi socio y os digo'.",
    "No usar datos de terceros reales (clientes, DNI ajenos). Nombre propio o variante, teléfono y email creados para esto.",
  ],
  setup: [
    "1 SIM/número nuevo (o número virtual de Zadarma) dedicado SOLO a esto.",
    "1 email nuevo (gmail vale) coherente con la identidad elegida.",
    "Grabadora activada en el móvil de trabajo ANTES de cada llamada.",
    "Carpeta en Drive: Mystery/<NombreEmpresa>/ — ahí va TODO (audios, PDFs, capturas de WhatsApp).",
  ],
  identities,
  baseQuestions,
  captureChecklist,
  flow: [
    "1. Elige el objetivo siguiente de la lista (en orden; los de amenaza alta primero).",
    "2. Lee su ficha en esta plataforma (2 min): su garantía y su precio públicos son tu referencia para pillar contradicciones.",
    "3. Rellena SU formulario web con la identidad indicada y arranca el cronómetro.",
    "4. Atiende la llamada con la grabadora puesta; usa las 8 preguntas base + el foco específico del objetivo.",
    "5. Pide SIEMPRE la propuesta por escrito y el contrato tipo.",
    "6. Deja el seguimiento vivo 14 días sin responder del todo: cuenta los toques.",
    "7. Sube todo a Drive (audio, PDFs, capturas) y rellena una línea de registro por contacto.",
    "8. Cuando un objetivo esté completo, avisa: se transcribe y se vuelca a su ficha aquí (campos de mystery: respuesta, precio real, garantía real, presión, toques).",
  ],
  registryTemplate: [
    "Fecha y hora del formulario",
    "Empresa objetivo",
    "Identidad usada",
    "Minutos hasta primera respuesta",
    "Canal de respuesta",
    "Precio ofrecido (desglosado)",
    "Garantía ofrecida (palabras exactas)",
    "¿Exclusividad? ¿Permanencia?",
    "Presión de cierre (1-5) y táctica usada",
    "Toques de seguimiento (nº y canales, 14 días)",
    "Enlace a carpeta Drive con audios y documentos",
  ],
  targets: strongTargets,
};

writeFileSync(resolve(root, "public/data/mystery.json"), JSON.stringify(mystery, null, 1));
console.log(`mystery.json: ${strongTargets.length} objetivos · ${identities.length} identidades`);
