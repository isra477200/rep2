"use client";

import { useEffect, useMemo, useState } from "react";
import type { Vertical, VerticalesData } from "./data-types";
import { defaultBrief, type LandingBrief } from "./landings/model";
import { defaultOperationContext, type OperationContext } from "./operations-model";
import { calculateEconomics, commercialModels, formatEuro, parseNumber, type CommercialModelId } from "./sector-launch-model";
import styles from "./SectorOperatingSystem.module.css";

type SectorProfile = {
  buyer: string;
  trigger: string;
  outcome: string;
  lead: string;
  opening: string;
  discovery: string[];
  proof: string;
  objections: Array<[string, string]>;
  angles: string[];
  landing: string;
  formFields: string[];
  assets: string[];
};

type SectorOperatingSystemProps = {
  data: VerticalesData;
  onOpenFactory?: (context: OperationContext) => void;
  onOpenAdLab?: (query: string) => void;
  onOpenLandings?: (brief: LandingBrief) => void;
  onOpenCompany?: (id: string) => void;
};

type ClientBrief = {
  id: string;
  company: string;
  contact: string;
  zone: string;
  offer: string;
  price: string;
  calendar: string;
  url: string;
  commercialModel: CommercialModelId;
  averageTicket: string;
  grossMarginPct: string;
  closeRatePct: string;
  monthlyCapacity: string;
  pilotBudget: string;
  serviceFee: string;
  pilotDurationDays: string;
  duplicateWindowDays: string;
  rejectionHours: string;
  slaMinutes: string;
  exclusivityRule: "none" | "lead" | "territory";
  claimsApproved: boolean;
  privacyReady: boolean;
  deliveryReady: boolean;
};

type TextBriefKey =
  | "company"
  | "contact"
  | "zone"
  | "offer"
  | "price"
  | "calendar"
  | "url"
  | "averageTicket"
  | "grossMarginPct"
  | "closeRatePct"
  | "monthlyCapacity"
  | "pilotBudget"
  | "serviceFee"
  | "pilotDurationDays"
  | "duplicateWindowDays"
  | "rejectionHours"
  | "slaMinutes";

const profiles: Record<string, SectorProfile> = {
  "clinicas-salud": {
    buyer: "propietario, director de clínica o responsable de admisiones con agenda y capacidad disponibles",
    trigger: "huecos de agenda, dependencia de referidos o inversión publicitaria sin trazabilidad hasta tratamiento",
    outcome: "valoraciones de pacientes con intención, zona y tratamiento compatibles con la clínica",
    lead: "persona localizada en la zona, interesada en un tratamiento acordado, contactable y que acepta una valoración",
    opening: "Estoy revisando cómo llenan agenda las clínicas de vuestra zona. ¿Ahora mismo os interesa crecer en algún tratamiento concreto o ya vais completos?",
    discovery: ["¿Qué tratamientos queréis priorizar y cuáles no?", "¿Cuántas primeras visitas nuevas podéis absorber por semana?", "¿Quién llama al contacto y en cuántos minutos?", "¿Qué porcentaje de valoraciones termina en tratamiento?", "¿Qué promesas, precios o financiación podéis comunicar de verdad?"],
    proof: "agenda disponible, casos autorizados, reseñas, credenciales clínicas y velocidad real de contacto",
    objections: [["Ya hacemos publicidad", "Perfecto: no proponemos sustituirla a ciegas, sino medir si podemos mejorar coste por valoración válida y asistencia."], ["Los leads no contestan", "Por eso acordamos definición, exclusividad, tiempo máximo de llamada y seguimiento antes de comprar tráfico."], ["No quiero promesas médicas", "No se hacen. La campaña comunica valoración profesional, proceso y prueba verificable, nunca resultados clínicos garantizados."]],
    angles: ["Agenda para un tratamiento prioritario", "Valoración y diagnóstico", "Financiación o facilidad de acceso verificable"],
    landing: "Consigue una valoración profesional para [TRATAMIENTO] en [ZONA], con un proceso claro y sin promesas clínicas inventadas.",
    formFields: ["Tratamiento", "Zona", "Situación o necesidad", "Disponibilidad", "Teléfono", "Consentimiento"],
    assets: ["Logo y guía visual", "Tratamientos y límites publicitarios", "Fotos autorizadas", "Reseñas y casos con permiso", "Agenda y zonas", "Protocolo de llamadas"],
  },
  "reformas-hogar": {
    buyer: "empresa de reformas o instalador con cuadrillas disponibles y radio de trabajo definido",
    trigger: "semanas con huecos, presupuestos poco cualificados o dependencia de portales compartidos",
    outcome: "solicitudes de presupuesto con tipo de obra, zona, plazo y rango de inversión",
    lead: "propietario o decisor, obra dentro de cobertura, necesidad concreta, plazo razonable y presupuesto orientativo compatible",
    opening: "Estoy seleccionando una empresa de reformas por zona para enviarle solicitudes filtradas. ¿Qué tipo de obra os interesa llenar durante las próximas semanas?",
    discovery: ["¿Qué obras dejan mejor margen?", "¿Qué municipios cubrís de verdad?", "¿Cuál es vuestro ticket mínimo?", "¿Cuándo puede empezar la siguiente cuadrilla?", "¿Quién visita y presupuesta cada solicitud?"],
    proof: "antes/después autorizados, obras reales, reseñas, seguro, garantías contractuales y tiempos de visita",
    objections: [["Solo quiero obras grandes", "El formulario filtra tipo de obra, superficie, plazo y rango de inversión antes de entregar la oportunidad."], ["Los portales venden el mismo lead", "La propuesta debe fijar exclusividad por contacto y territorio por escrito."], ["No puedo atender todo", "Se limita volumen semanal y se pausa cuando las cuadrillas estén completas."]],
    angles: ["Presupuesto de reforma integral", "Cuadrilla disponible en la zona", "Comparación clara de alcance y plazos"],
    landing: "Cuéntanos tu reforma en [ZONA] y recibe una valoración inicial de una empresa disponible para tu tipo de obra.",
    formFields: ["Tipo de reforma", "Código postal", "Propiedad", "Superficie", "Presupuesto", "Plazo", "Teléfono"],
    assets: ["Fotos antes/después", "Cobertura exacta", "Tickets mínimos", "Especialidades", "Garantías y seguros", "Calendario de capacidad"],
  },
  "solar-energia": {
    buyer: "instaladora homologada con capacidad de visita, ingeniería y montaje en una zona concreta",
    trigger: "dependencia de campañas genéricas, leads revendidos o comerciales sin priorización por consumo y cubierta",
    outcome: "estudios solares con propiedad, consumo, tipo de cubierta y ubicación validados",
    lead: "propietario o decisor, inmueble en cobertura, factura o consumo disponible e interés en estudiar viabilidad",
    opening: "Estamos organizando solicitudes de estudio solar por zona y buscando una instaladora con capacidad real. ¿Qué tipo de instalación queréis priorizar ahora?",
    discovery: ["¿Residencial, empresa o ambos?", "¿Qué consumo o ticket mínimo compensa una visita?", "¿Qué municipios cubrís?", "¿Incluís financiación, baterías y subvenciones?", "¿En cuánto tiempo contactáis y presentáis estudio?"],
    proof: "instalaciones reales, homologaciones, garantías de equipos, simulación prudente y condiciones de financiación",
    objections: [["El mercado está saturado", "Precisamente se segmenta por consumo, propiedad, cubierta y zona para no competir por curiosos genéricos."], ["Las subvenciones cambian", "Solo se comunica la ayuda vigente y comprobable; nunca se promete una concesión."], ["Quiero exclusividad", "Se define por contacto, zona y ventana temporal dentro del acuerdo."]],
    angles: ["Estudio de ahorro personalizado", "Batería y autoconsumo", "Instalación local con garantías verificables"],
    landing: "Calcula si una instalación solar encaja en tu vivienda o negocio de [ZONA] con un estudio basado en tu consumo.",
    formFields: ["Tipo de inmueble", "Propiedad", "Código postal", "Factura mensual", "Tipo de cubierta", "Teléfono"],
    assets: ["Instalaciones y marcas", "Cobertura", "Garantías", "Financiación", "Proceso de estudio", "Capacidad mensual"],
  },
  inmobiliario: {
    buyer: "agencia inmobiliaria, personal shopper o promotor con una zona y operación prioritarias",
    trigger: "captación de inmuebles irregular, exceso de compradores sin financiación o dependencia de portales",
    outcome: "propietarios que valoran vender o compradores filtrados por zona, plazo y financiación",
    lead: "decisor identificado, zona cubierta, intención y plazo declarados, datos válidos y criterio financiero mínimo cuando proceda",
    opening: "Estoy analizando qué agencias pueden absorber oportunidades exclusivas en [ZONA]. ¿Ahora os aporta más valor captar propietarios o compradores cualificados?",
    discovery: ["¿Queréis vendedores, compradores o una campaña separada para cada uno?", "¿Qué barrios y tickets domináis?", "¿Qué capacidad de valoración y seguimiento tenéis?", "¿Trabajáis exclusiva?", "¿Cómo verificáis financiación y plazo de compra?"],
    proof: "operaciones cerradas, conocimiento local, reseñas, tiempo medio de venta documentado y proceso de valoración",
    objections: [["Ya tengo Idealista", "El portal captura demanda existente; esta propuesta crea y filtra demanda propia con vuestra marca."], ["No quiero tasaciones curiosas", "El formulario separa motivo, plazo, propiedad y disposición a hablar con un asesor."], ["Los compradores no tienen financiación", "La cualificación incorpora ahorro, hipoteca preaprobada o necesidad de estudio financiero."]],
    angles: ["Valoración de vivienda", "Comprador cualificado por zona", "Venta con plan local y acompañamiento"],
    landing: "Descubre el rango de venta y el plan recomendado para tu vivienda en [ZONA], sin compromiso de exclusiva.",
    formFields: ["Comprar o vender", "Zona", "Tipo de inmueble", "Situación", "Plazo", "Financiación", "Teléfono"],
    assets: ["Operaciones y zonas", "Fotos del equipo", "Proceso de valoración", "Reseñas", "Condiciones de exclusiva", "CRM y tiempo de respuesta"],
  },
  legal: {
    buyer: "socio, director o responsable de desarrollo de un despacho especializado y con capacidad de primera consulta",
    trigger: "crecimiento por recomendación, consultas fuera de especialidad o campañas que no separan urgencia y viabilidad",
    outcome: "solicitudes de consulta clasificadas por materia, jurisdicción, urgencia y encaje básico",
    lead: "persona o empresa con asunto dentro de especialidad y cobertura, información mínima y voluntad de concertar consulta",
    opening: "Estamos estudiando cómo generan consultas los despachos especializados. ¿Qué tipo de asunto rentable os gustaría recibir con más regularidad?",
    discovery: ["¿Qué materias aceptáis y cuáles rechazáis?", "¿Ámbito geográfico o jurisdicción?", "¿La primera consulta es gratuita o de pago?", "¿Qué datos permiten valorar encaje sin asesorar aún?", "¿Quién devuelve la llamada y cuándo?"],
    proof: "colegiación, especialidad, experiencia documentable, reseñas y explicación clara del proceso; nunca promesa de resultado",
    objections: [["No se puede garantizar el caso", "Correcto: garantizamos proceso y filtrado, no resultado jurídico."], ["Llegan asuntos inviables", "Se acuerdan exclusiones y preguntas de encaje antes de activar tráfico."], ["No quiero consultas gratuitas", "La landing puede informar del precio o del criterio de primera valoración para filtrar mejor."]],
    angles: ["Evaluación inicial del asunto", "Especialista en una materia concreta", "Urgencia y próximos pasos claros"],
    landing: "Expón tu caso de [ESPECIALIDAD] y comprueba si encaja con un despacho especializado en [ZONA].",
    formFields: ["Materia", "Provincia", "Fecha o urgencia", "Parte contraria", "Resumen", "Preferencia de consulta", "Teléfono"],
    assets: ["Especialidades y exclusiones", "Colegiación", "Equipo", "Casos anonimizados", "Precio de consulta", "Política de conflictos"],
  },
  "coches-motor": {
    buyer: "compraventa, taller especializado, renting o servicio de compra de vehículos con criterios claros",
    trigger: "inventario insuficiente, consultas sin datos del vehículo o campañas demasiado genéricas",
    outcome: "solicitudes con vehículo, situación, documentación, ubicación y expectativa económica filtradas",
    lead: "titular o autorizado, vehículo y documentación identificables, zona cubierta e intención real de operación",
    opening: "Estamos montando una captación específica de vehículos en [ZONA]. ¿Qué operaciones os interesan de verdad y cuáles queréis excluir desde el formulario?",
    discovery: ["¿Qué vehículos, antigüedad y estados aceptáis?", "¿Compráis coches financiados, con reserva, avería o cargas?", "¿Qué zonas cubrís?", "¿Cómo calculáis y comunicáis una oferta?", "¿Quién revisa documentación y en qué plazo?"],
    proof: "proceso documental, valoración explicada, pago y transferencia seguros, reseñas y casos reales sin ocultar condiciones",
    objections: [["Quiero saber el precio ya", "Se solicita la información mínima para dar un rango responsable, no una cifra gancho falsa."], ["El coche tiene cargas", "La campaña separa cada situación y explica qué documentación hace falta."], ["No quiero perder tiempo", "Matrícula, modelo, estado, financiación y ubicación se capturan antes del contacto."]],
    angles: ["Compra de vehículo con situación especial", "Valoración rápida y documentada", "Recogida y cambio de titularidad"],
    landing: "Vende tu coche en [ZONA], incluso si está financiado, averiado o tiene una situación documental que revisar.",
    formFields: ["Marca y modelo", "Año", "Kilómetros", "Estado", "Financiación o cargas", "Código postal", "Teléfono"],
    assets: ["Criterios de compra", "Proceso documental", "Fotos reales", "Cobertura", "Plazos de pago", "Casos especiales aceptados"],
  },
  "b2b-sdr": {
    buyer: "fundador o director comercial B2B con ticket, mercado y capacidad de ventas definidos",
    trigger: "pipeline irregular, comerciales sin reuniones o prospección que depende del fundador",
    outcome: "reuniones con cuentas que cumplen ICP, cargo, necesidad y criterio de oportunidad acordados",
    lead: "cuenta dentro del ICP, interlocutor válido, interés o problema confirmado y reunión aceptada",
    opening: "Estoy revisando vuestro mercado porque parece que hay un grupo muy concreto de cuentas al que podríais llegar mejor. ¿Quién es hoy vuestro cliente más rentable?",
    discovery: ["¿Qué ICP convierte y cuál consume tiempo?", "¿Ticket y margen mínimos?", "¿Quién cierra las reuniones?", "¿Qué señales disparan una oportunidad?", "¿Qué capacidad semanal tiene ventas?"],
    proof: "lista de cuentas, mensajes aprobados, grabaciones o muestras, criterios de reunión y reporting hasta oportunidad",
    objections: [["Ya tenemos SDR", "Podemos operar como canal complementario sobre un segmento o hipótesis aislada."], ["No quiero reuniones vacías", "La reunión válida se define por cuenta, cargo, necesidad y asistencia antes del lanzamiento."], ["Mi mercado es pequeño", "Se calcula universo abordable y ritmo seguro antes de comprometer volumen."]],
    angles: ["Pipeline predecible", "Reuniones bajo criterios", "Prospección multicanal sobre cuentas concretas"],
    landing: "Construimos reuniones B2B con las cuentas y cargos que habéis definido, con trazabilidad desde contacto hasta oportunidad.",
    formFields: ["Empresa", "Cargo", "Mercado", "Ticket", "Objetivo", "Capacidad comercial", "Email y teléfono"],
    assets: ["ICP y exclusiones", "Casos y métricas propias", "Oferta", "Calendarios", "CRM", "Criterios de reunión válida"],
  },
  "directorios-marketplaces": {
    buyer: "plataforma, marketplace o directorio que necesita equilibrar demanda y proveedores por categoría y territorio",
    trigger: "zonas sin oferta, proveedores inactivos, baja respuesta o demanda que no encuentra cobertura",
    outcome: "solicitudes categorizadas y proveedores activados con reglas transparentes de distribución",
    lead: "solicitud con categoría, zona, plazo y datos válidos distribuida según cobertura y condiciones visibles",
    opening: "Estoy analizando dónde se os queda demanda sin cubrir. ¿El cuello de botella está ahora en conseguir solicitudes o en activar proveedores que respondan?",
    discovery: ["¿Qué categorías y zonas están desequilibradas?", "¿Cuántos proveedores reciben cada solicitud?", "¿Cómo medís respuesta y calidad?", "¿Modelo de cuota, comisión o lead?", "¿Qué ocurre con reclamaciones y duplicados?"],
    proof: "volumen por categoría, reglas de reparto, verificación de proveedores, política de devolución y tiempos de respuesta",
    objections: [["Ya tenemos mucho tráfico", "La propuesta puede centrarse en categorías o zonas con demanda insuficiente, no en inflar volumen global."], ["Los proveedores no responden", "Se liga distribución a disponibilidad y SLA observado."], ["No quiero canibalizar", "Separa adquisición de demanda, activación de oferta y reactivación de proveedores."]],
    angles: ["Encuentra proveedor local", "Recibe solicitudes en tu zona", "Comparación y respuesta controladas"],
    landing: "Describe lo que necesitas en [ZONA] y te conectamos con proveedores disponibles bajo reglas de reparto claras.",
    formFields: ["Categoría", "Código postal", "Necesidad", "Plazo", "Presupuesto", "Teléfono"],
    assets: ["Categorías y cobertura", "Reglas de reparto", "Datos de oferta/demanda", "Política de reclamación", "SLA", "Verificación de proveedores"],
  },
  "belleza-bienestar": {
    buyer: "centro de estética, bienestar o entrenamiento con capacidad y servicio prioritario",
    trigger: "agenda con huecos, bonos sin continuidad o campañas de descuentos que atraen poca recurrencia",
    outcome: "valoraciones o reservas para un servicio concreto con zona, disponibilidad y expectativa filtradas",
    lead: "persona dentro de cobertura, interesada en un servicio acordado, contactable y disponible para valoración o reserva",
    opening: "Estoy revisando qué tratamientos están llenando agenda en vuestra zona. ¿Cuál queréis vender más sin depender de descuentos permanentes?",
    discovery: ["¿Qué tratamiento tiene mejor margen y recurrencia?", "¿Qué huecos queréis cubrir?", "¿Hay contraindicaciones o exclusiones?", "¿Qué prueba visual puede usarse con permiso?", "¿Cómo convertís la primera sesión en plan?"],
    proof: "profesionales, aparatología, protocolos, reseñas y resultados autorizados sin garantías corporales engañosas",
    objections: [["Solo vienen por la oferta", "La campaña vende valoración, método y plan, no únicamente descuento."], ["Instagram ya me funciona", "Se conserva como canal y se añade medición hasta reserva y recurrencia."], ["No puedo prometer resultados", "Se comunica proceso, idoneidad y expectativas responsables."]],
    angles: ["Valoración personalizada", "Plan por objetivo", "Primera sesión o bono con condiciones claras"],
    landing: "Reserva una valoración para [TRATAMIENTO] en [ZONA] y descubre qué plan encaja contigo.",
    formFields: ["Objetivo", "Tratamiento", "Zona", "Disponibilidad", "Experiencia previa", "Teléfono"],
    assets: ["Servicios y precios", "Fotos autorizadas", "Profesionales", "Contraindicaciones", "Agenda", "Reseñas"],
  },
  "hosteleria-turismo": {
    buyer: "hotel, alojamiento o negocio turístico con inventario, fechas y margen para venta directa",
    trigger: "dependencia de OTA, baja ocupación en fechas concretas o base de clientes poco trabajada",
    outcome: "reservas o consultas directas para fechas, ocupación y experiencia compatibles",
    lead: "viajero con fechas, número de personas, interés y datos válidos; reserva confirmada solo tras pago o confirmación del establecimiento",
    opening: "Estoy revisando cómo reducir dependencia de intermediarios en fechas de baja ocupación. ¿Qué periodos o experiencias os interesa llenar directamente?",
    discovery: ["¿Qué fechas y habitaciones necesitan demanda?", "¿Qué margen deja cada canal?", "¿Qué ventaja real tiene reservar directo?", "¿Qué mercados e idiomas priorizáis?", "¿Cómo confirmáis disponibilidad y pago?"],
    proof: "fotografía real, disponibilidad, políticas, reseñas, ubicación y ventajas directas verificables",
    objections: [["Booking ya me llena", "Se trabaja únicamente en fechas, segmentos o experiencias donde la venta directa mejore margen."], ["La disponibilidad cambia", "La campaña debe conectarse a inventario o confirmar antes de cobrar."], ["No puedo bajar precio", "La ventaja directa puede ser flexibilidad, experiencia o añadido, no descuento."]],
    angles: ["Reserva directa con ventaja", "Escapada por fecha e interés", "Experiencia local empaquetada"],
    landing: "Consulta disponibilidad para una escapada en [DESTINO] con ventajas de reserva directa verificables.",
    formFields: ["Fechas", "Personas", "Origen", "Tipo de estancia", "Preferencias", "Email y teléfono"],
    assets: ["Fotos reales", "Inventario y temporadas", "Políticas", "Ventajas directas", "Experiencias", "Motor de reservas"],
  },
  generalista: {
    buyer: "pyme con una oferta prioritaria, margen suficiente, capacidad operativa y responsable comercial",
    trigger: "captación irregular, demasiados servicios comunicados o falta de medición entre anuncio y venta",
    outcome: "oportunidades de una oferta concreta con criterios de encaje y seguimiento definidos",
    lead: "contacto válido que cumple zona, necesidad y criterios mínimos pactados y acepta ser contactado",
    opening: "Antes de hablar de publicidad: si solo pudiéramos llenar una línea de negocio rentable durante los próximos 90 días, ¿cuál elegiríais?",
    discovery: ["¿Qué servicio tiene mejor margen?", "¿Quién es el cliente que más valor obtiene?", "¿Qué capacidad podéis absorber?", "¿Qué prueba real existe?", "¿Cómo atendéis y medís cada oportunidad?"],
    proof: "casos verificables, especialización de la campaña, condiciones claras, capacidad y seguimiento comercial",
    objections: [["Hacemos muchas cosas", "La primera campaña debe vender una oferta a un público; después se amplía con datos."], ["Quiero resultados garantizados", "Solo se garantizan tareas o condiciones controlables; el resultado se valida en un experimento."], ["No tengo casos", "Se empieza con proceso, credenciales y una oferta piloto sin fabricar testimonios."]],
    angles: ["Problema específico", "Resultado operativo", "Reducción de riesgo"],
    landing: "Un sistema concreto para resolver [PROBLEMA] en [ZONA], con alcance, proceso y siguiente paso claros.",
    formFields: ["Necesidad", "Zona", "Situación actual", "Plazo", "Presupuesto orientativo", "Teléfono"],
    assets: ["Oferta prioritaria", "ICP", "Casos", "Precios y límites", "Capacidad", "Proceso comercial"],
  },
};

const fallbackProfile = profiles.generalista;
const emptyBrief: ClientBrief = {
  id: "draft", company: "", contact: "", zone: "", offer: "", price: "", calendar: "", url: "",
  commercialModel: "managed-pilot", averageTicket: "", grossMarginPct: "", closeRatePct: "", monthlyCapacity: "", pilotBudget: "", serviceFee: "",
  pilotDurationDays: "30", duplicateWindowDays: "90", rejectionHours: "48", slaMinutes: "15", exclusivityRule: "lead",
  claimsApproved: false, privacyReady: false, deliveryReady: false,
};

const stageNames = ["Preparar", "Prospectar", "Llamar", "Diagnosticar", "Proponer", "Lanzar", "Operar", "Medir"];

const operationalTasks = [
  "Validar ticket, margen y capacidad del cliente",
  "Aprobar definición de oportunidad válida y exclusiones",
  "Personalizar presentación y propuesta con datos reales",
  "Cargar lista inicial y asignar responsable de llamadas",
  "Aprobar claims, creatividades y landing",
  "Verificar formularios, privacidad, CRM y avisos",
  "Ensayar llamada de apertura y reunión de diagnóstico",
  "Lanzar un test con una sola variable principal",
  "Auditar velocidad de contacto y calidad de las oportunidades",
  "Cerrar aprendizaje y decidir escalar, iterar o detener",
];

function buildPack(vertical: Vertical, profile: SectorProfile, brief: ClientBrief) {
  const fill = (value: string) => value
    .replaceAll("[EMPRESA]", brief.company || "[EMPRESA]")
    .replaceAll("[NOMBRE]", brief.contact || "[NOMBRE]")
    .replaceAll("[ZONA]", brief.zone || "[ZONA]")
    .replaceAll("[OFERTA]", brief.offer || "[OFERTA]")
    .replaceAll("[PRECIO]", brief.price || "[PRECIO]")
    .replaceAll("[CALENDARIO]", brief.calendar || "[CALENDARIO]")
    .replaceAll("[URL]", brief.url || "[URL]")
    .replaceAll("[TRATAMIENTO]", brief.offer || "[OFERTA]")
    .replaceAll("[ESPECIALIDAD]", brief.offer || "[OFERTA]")
    .replaceAll("[DESTINO]", brief.zone || "[ZONA]")
    .replaceAll("[PROBLEMA]", profile.trigger)
    .replaceAll("[CAPACIDAD]", brief.monthlyCapacity || "[CAPACIDAD]")
    .replaceAll("[FECHA]", brief.calendar || "[CALENDARIO]")
    .replaceAll("[DÍA/HORA]", brief.calendar || "[CALENDARIO]");
  const sector = vertical.label;
  const commercialModel = commercialModels.find((item) => item.id === brief.commercialModel) || commercialModels[0];
  const economics = calculateEconomics(brief);
  const economicsText = economics.valid
    ? `Ticket medio: ${brief.averageTicket} · margen bruto: ${brief.grossMarginPct}% · cierre: ${brief.closeRatePct}%\nContribución estimada por venta: ${formatEuro(economics.contributionPerSale)}\nValor estimado por oportunidad: ${formatEuro(economics.valuePerOpportunity)}\nCoste máximo prudente de captación: ${formatEuro(economics.maxAcquisitionCost)}\nInversión en medios: ${formatEuro(parseNumber(brief.pilotBudget))} · honorarios RedVitalia: ${formatEuro(parseNumber(brief.serviceFee))} · coste total del piloto: ${formatEuro(economics.totalPilotCost)}\nObjetivo inicial: ${economics.targetOpportunities} oportunidades y ${economics.expectedSales.toFixed(1)} ventas esperadas\nContribución esperada antes de costes fijos del cliente: ${formatEuro(economics.expectedContribution)}\nBalance esperado tras medios y honorarios: ${formatEuro(economics.expectedNetContribution)}\nHipótesis prudente: solo se asigna a adquisición el 35% del valor esperado por oportunidad. Debe sustituirse por datos propios cuando existan.\nAviso: ${economics.capacityWarning}`
    : "Pendiente: ticket medio, margen bruto, tasa de cierre, capacidad, inversión en medios y honorarios RedVitalia. No aprobar precio por oportunidad ni previsión hasta completar estos seis datos.";
  const stats = `${vertical.n} fichas analizadas · ${vertical.spainN} en España · ${vertical.adsActivePct}% con publicidad activa observada${vertical.medianEur ? ` · ${vertical.medianEur} € de mediana pública comparable` : ""}`;
  const exclusivityText = brief.exclusivityRule === "territory"
    ? `una sola empresa de ${sector} en ${brief.zone || "la zona acordada"}, durante el piloto y su vigencia contractual`
    : brief.exclusivityRule === "lead"
      ? "cada contacto aceptado se entrega a un único cliente durante la ventana contractual"
      : "sin exclusividad; cualquier reparto deberá quedar visible antes de lanzar";
  const opportunitySchedule = `ANEXO · OPORTUNIDAD VÁLIDA Y RECLAMACIÓN\n1. Debe cumplir: ${profile.lead}.\n2. Cobertura: ${brief.zone || "la zona acordada"}.\n3. Duplicado: no cuenta si el cliente demuestra que el mismo contacto ya estaba activo en su CRM durante los ${brief.duplicateWindowDays || "90"} días anteriores.\n4. Evidencia: la reclamación debe incluir registro CRM, fecha, teléfono/email coincidente y resultado de los intentos de contacto.\n5. Plazo: el cliente dispone de ${brief.rejectionHours || "48"} horas desde la entrega para aceptar o rechazar; después se considera aceptada salvo incidencia técnica demostrable.\n6. Exclusividad: ${exclusivityText}.\n7. Exclusiones: datos falsos o incontactables tras la secuencia acordada, fuera de zona, necesidad fuera de alcance o duplicado probado. No se rechaza por no cerrar una venta.\n8. Remedio: una reclamación válida genera reposición o abono según el modelo firmado; nunca una promesa automática de ventas.\n9. SLA del cliente: primer intento en ${brief.slaMinutes || "15"} minutos dentro del horario acordado y registro de todos los intentos.\n10. Auditoría: RedVitalia y el cliente revisan semanalmente entrega, contacto, cita, asistencia, propuesta y venta.`;
  const qualification = `APROBAR SOLO SI\n□ Oferta prioritaria: ${brief.offer || "[OFERTA]"}\n□ Zona: ${brief.zone || "[ZONA]"}\n□ Capacidad mensual: ${brief.monthlyCapacity || "[CAPACIDAD]"}\n□ Responsable y SLA de primer contacto: ${brief.slaMinutes || "[SLA]"} minutos\n□ Prueba utilizable: ${profile.proof}\n□ Economía compatible con adquisición\n\nDESCARTAR SI\n□ Pide garantías de ventas sin histórico\n□ No acepta medir hasta venta\n□ No puede atender contactos con rapidez\n□ No permite definir oportunidad válida\n□ Claims o prácticas incompatibles con la normativa`;
  const prospecting = `Buscar ${profile.buyer}. Priorizar señales de ${profile.trigger}. Excluir negocios sin capacidad, fuera de zona o sin una oferta prioritaria. Campos mínimos: empresa, decisor, cargo, teléfono, email, zona, señal observada, fuente y próximo paso.`;
  const diagnosisAgenda = `25 MINUTOS\n0–3 Contexto y objetivo\n3–10 Economía: ticket, margen y capacidad\n10–16 Cliente, zona y definición de oportunidad\n16–21 Proceso comercial, SLA y medición\n21–25 Encaje del piloto y siguiente paso\n\n${profile.discovery.map((item) => `• ${item}`).join("\n")}`;
  const objectionHandling = profile.objections.map(([objection, answer], index) => `${index + 1}. “${objection}”\n${answer}`).join("\n\n");
  const slides = [
    `1. Portada — Sistema de captación para ${brief.company || sector}`,
    `2. Situación — ${profile.trigger}`,
    `3. Objetivo — ${profile.outcome}`,
    `4. Cliente y oportunidad válida — ${profile.lead}`,
    "5. Sistema — tráfico/prospección → filtro → contacto → cita → venta → aprendizaje",
    `6. Campaña — ${profile.angles.join(" / ")}`,
    `7. Activos — landing, formulario, CRM, guiones y seguimiento`,
    `8. Modelo comercial — ${commercialModel.label}: ${commercialModel.charge}`,
    `9. Prueba necesaria — ${profile.proof}`,
    `10. Piloto y decisión — ${economics.valid ? `${economics.targetOpportunities} oportunidades objetivo; coste máximo prudente ${formatEuro(economics.maxAcquisitionCost)}` : "completar economía, lanzar una hipótesis y revisar con criterio de escala"}`,
  ];
  const landingPromise = fill(profile.landing);
  const landing = fill(`LANDING LISTA PARA MAQUETAR\n\nH1\n${landingPromise}\n\nSUBTÍTULO\nTe explicamos el proceso, filtramos lo que encaja y te contactamos en el horario que elijas. Sin promesas imposibles ni letra pequeña.\n\n3 BENEFICIOS\n• Respuesta de un especialista de ${brief.company || "la empresa"}.\n• Criterios claros antes de pedirte datos.\n• Próximo paso y condiciones visibles.\n\nPRUEBA\n${profile.proof}.\n\nCTA\n${brief.offer ? `Solicitar información sobre ${brief.offer}` : "Quiero que me contacten"}\n\nFORMULARIO\n${profile.formFields.map((field) => `• ${field}`).join("\n")}\n\nAVISO\nTe contactaremos para responder a tu solicitud. No se garantiza resultado, precio ni disponibilidad hasta validar tu caso.\n\nPÁGINA DE GRACIAS\nHemos recibido tus datos. ${brief.company || "El equipo"} revisará la solicitud y te contactará en ${brief.calendar || "el horario indicado"}.`);
  const campaign = profile.angles.map((angle, index) => `ANUNCIO ${String.fromCharCode(65 + index)} · ${angle}\n\nTITULAR\n${angle} en ${brief.zone || "tu zona"}\n\nTEXTO PRINCIPAL\n¿Buscas ${brief.offer || "una solución concreta"}? ${landingPromise} Te explicamos el proceso y te contactamos con el siguiente paso claro.\n\nCTA\nSolicitar información\n\nFILTRO\n${profile.lead}`).join("\n\n────────────────────────\n\n");
  const callScript = fill(`APERTURA\n“${profile.opening}”\n\nPUENTE\n“No quiero venderte publicidad sin saber si encaja. En dos minutos: ¿qué queréis vender más, dónde y cuánta capacidad tenéis?”\n\nPREGUNTAS\n${profile.discovery.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\nCIERRE\n“Si los números y la capacidad encajan, preparo un piloto con definición de oportunidad válida, volumen máximo y medición hasta venta. ¿Lo revisamos juntos en una reunión de 25 minutos?”`);
  const proposal = fill(`PROPUESTA COMERCIAL + ANEXO OPERATIVO · ${sector.toUpperCase()}\nBORRADOR REDVITALIA · revisión comercial, fiscal y jurídica antes de firma\n\nPARTES Y OBJETIVO\nProveedor: RedVitalia. Cliente: ${brief.company || "[EMPRESA]"}.\nObjetivo operativo: generar ${profile.outcome}. No constituye garantía de venta ni de facturación.\n\nALCANCE\nEstrategia, campaña, creatividades, landing, formulario, tracking, integración, guiones, seguimiento y revisión semanal para una oferta, una zona y una hipótesis principal. Quedan fuera ventas, atención final, herramientas de terceros, inversión publicitaria y trabajos no descritos salvo acuerdo escrito.\n\nOFERTA DEL CLIENTE\n${brief.offer || "[OFERTA]"}${brief.price ? `\nPrecio comunicado al público: ${brief.price}` : ""}\n\nMODELO COMERCIAL\n${commercialModel.label}: ${commercialModel.charge}\nCondición: ${commercialModel.condition}\n\nDURACIÓN Y COSTES\nPiloto inicial: ${brief.pilotDurationDays || "30"} días desde activación.\nHonorarios RedVitalia: ${brief.serviceFee || "[HONORARIOS]"} € más IVA.\nInversión publicitaria abonada por el cliente: ${brief.pilotBudget || "[INVERSIÓN]"} € más cargos de plataforma, si los hubiera.\nLa renovación, pausa, cancelación, forma de pago y cualquier mínimo se fijarán en el documento firmado; este borrador no los sustituye.\n\nECONOMÍA DEL PILOTO\n${economicsText}\n\n${opportunitySchedule}\n\nOBLIGACIONES DEL CLIENTE\nEntregar materiales y aprobaciones, mantener capacidad declarada, responder dentro del SLA, registrar estados en CRM, cumplir normativa sectorial y comunicar ventas sin ocultar atribución.\n\nCLAIMS, DATOS Y PRIVACIDAD\nSolo se publican afirmaciones y pruebas aprobadas. Antes de captar datos se documentarán responsable del tratamiento, base jurídica, textos de privacidad, encargos, conservación, permisos y canal de baja.\n\nPROPIEDAD Y ACCESOS\nEl cliente conserva sus marcas, datos y activos previos. La titularidad o licencia de landings, creatividades, cuentas, dominios y configuraciones creadas se concretará por escrito junto con la entrega de accesos.\n\nMEDICIÓN Y DECISIÓN\nSe revisan inversión, oportunidad válida, contacto, cita, asistencia, propuesta, venta, ingreso y margen. Escalar exige economía compatible, capacidad y datos suficientes; de lo contrario se itera una variable o se detiene.\n\nACEPTACIÓN\nFecha de revisión: ${brief.calendar || "[CALENDARIO]"}. La aceptación comercial definitiva requiere contrato o pedido firmado por representantes autorizados.`);
  const followUp = fill(`ASUNTO: Propuesta de captación para ${sector}\n\nHola, [NOMBRE].\n\nTe resumo lo acordado: queremos generar ${profile.outcome}, limitando el piloto a ${brief.zone || "la zona acordada"} y considerando válida únicamente una oportunidad que cumpla: ${profile.lead}.\n\nAntes de lanzar confirmaremos precio, exclusiones, responsable de contacto, SLA, privacidad y medición hasta venta. Te adjunto la presentación, la propuesta y la lista de materiales necesarios.\n\nSiguiente paso: reunión de validación de 25 minutos el ${brief.calendar || "[FECHA]"}.`);
  const whatsapp = fill(`Hola, [NOMBRE]. Te acabo de enviar el resumen del piloto para ${sector}. Lo importante: definición de oportunidad válida, capacidad máxima y medición hasta venta quedan por escrito antes de invertir. ¿Te encaja revisar esos tres puntos el ${brief.calendar || "[DÍA/HORA]"}?`);
  const leadHandlingSequence = fill(`SECUENCIA DEL CONTACTO CAPTADO · RESPONSABLE DEL CLIENTE\n0–${brief.slaMinutes || "15"} MIN · llamada + WhatsApp identificando empresa, solicitud y siguiente paso.\n+2 H · segundo intento y mensaje breve con opción de horario.\nDÍA 1 · llamada + email con la información solicitada, sin añadir presión ni claims nuevos.\nDÍA 3 · último intento útil y pregunta de descarte.\nDÍA 7 · cierre respetuoso; registrar no contactado, no encaja, cita o venta.\n\nRegla: consentimiento, horario, frecuencia y derecho de oposición prevalecen sobre esta cadencia.`);
  const measurementPlan = `CUADRO DE MANDO\nInversión · contactos · oportunidades válidas · coste por válida · tiempo de respuesta · tasa de contacto · tasa de cita · asistencia · propuesta · venta · ingreso y margen.\n\nFÓRMULAS\nCoste por válida = inversión / oportunidades aceptadas.\nContacto = contactos conversados / oportunidades aceptadas.\nCita = citas / contactos conversados.\nAsistencia = citas celebradas / citas reservadas.\nCierre = ventas / oportunidades aceptadas.\nCAC = inversión + honorarios / ventas.\nContribución = ventas × ticket × margen bruto − inversión − honorarios.\n\nREGLAS DE DECISIÓN\nEscalar: economía positiva y capacidad disponible durante dos revisiones consecutivas.\nIterar: volumen suficiente pero una etapa concreta falla; cambiar una sola variable.\nDetener: claims inseguros, operación sin SLA, ausencia de trazabilidad o coste por válida por encima del límite acordado.`;
  const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const htmlSections = [
    ["Activación", `Empresa: ${brief.company || "[EMPRESA]"}\nContacto: ${brief.contact || "[NOMBRE]"}\nZona: ${brief.zone || "[ZONA]"}\nOferta: ${brief.offer || "[OFERTA]"}\nPrecio comunicado de la oferta: ${brief.price || "[PRECIO]"}\nModelo: ${commercialModel.label}`],
    ["Economía y límites", economicsText],
    ["Prospección y cualificación", `${prospecting}\n\n${qualification}`], ["Guion de llamada", callScript], ["Diagnóstico", diagnosisAgenda], ["Objeciones", objectionHandling], ["Presentación", slides.join("\n")], ["Propuesta piloto", proposal],
    ["Landing", landing], ["Anuncios iniciales", campaign], ["Seguimiento comercial", `${followUp}\n\n${whatsapp}`], ["Seguimiento del contacto captado", leadHandlingSequence], ["Medición y decisión", measurementPlan],
  ].map(([title, body]) => `<section><h2>${escapeHtml(title)}</h2><pre>${escapeHtml(body)}</pre></section>`).join("\n");
  const dossierHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Kit RedVitalia · ${escapeHtml(brief.company || sector)}</title><style>body{font-family:Inter,Arial,sans-serif;max-width:960px;margin:0 auto;padding:48px 28px;color:#10231d;background:#f4f7f5}header{background:#10231d;color:#fff;border-radius:20px;padding:28px;margin-bottom:18px}h1{margin:0 0 8px;font-size:32px}h2{font-size:19px;margin:0 0 12px;color:#0d6b4f}section{background:#fff;border:1px solid #dce5e1;border-radius:15px;padding:22px;margin:12px 0}pre{font-family:inherit;white-space:pre-wrap;line-height:1.6;margin:0;font-size:15px}small{color:#66756f}</style></head><body><header><small>REDVITALIA · KIT DE ACTIVACIÓN</small><h1>${escapeHtml(brief.company || sector)}</h1><div>${escapeHtml(sector)} · ${escapeHtml(brief.zone || "zona por validar")}</div></header>${htmlSections}</body></html>`;
  const markdown = `# Kit RedVitalia · ${brief.company || sector}\n\n## Ficha de activación\nEmpresa: ${brief.company || "[EMPRESA]"}\nContacto: ${brief.contact || "[NOMBRE]"}\nZona: ${brief.zone || "[ZONA]"}\nOferta: ${brief.offer || "[OFERTA]"}\nPrecio comunicado de la oferta: ${brief.price || "[PRECIO]"}\nCalendario: ${brief.calendar || "[CALENDARIO]"}\nURL: ${brief.url || "[URL]"}\nModelo comercial: ${commercialModel.label}\n\n## Economía del piloto\n${economicsText}\n\n## Evidencia disponible\n${stats}\n\n## Cliente objetivo\n${profile.buyer}\n\n## Problema de entrada\n${profile.trigger}\n\n## Resultado propuesto\n${profile.outcome}\n\n## Prospección\n${prospecting}\n\n## Ficha de cualificación\n${qualification}\n\n## Definición de oportunidad válida\n${opportunitySchedule}\n\n## Guion de llamada\n${callScript}\n\n## Agenda de diagnóstico\n${diagnosisAgenda}\n\n## Manejo de objeciones\n${objectionHandling}\n\n## Presentación\n${slides.map((slide) => `- ${slide}`).join("\n")}\n\n## Propuesta\n${proposal}\n\n## Seguimiento RedVitalia → cliente\n${followUp}\n\n${whatsapp}\n\n## Seguimiento cliente → contacto captado\n${leadHandlingSequence}\n\n## Anuncios iniciales\n${campaign}\n\n## Landing completa\n${landing}\n\n## Materiales a solicitar\n${profile.assets.map((asset) => `- ${asset}`).join("\n")}\n\n## Cuadro de mando y reglas\n${measurementPlan}\n\n## Checklist operativo\n${operationalTasks.map((task) => `- [ ] ${task}`).join("\n")}\n\n## Límites\nLos datos competitivos orientan hipótesis. Precio, volumen, conversión y rentabilidad se validan con datos propios del cliente y un piloto medido.`;
  const unresolvedTokens = [...new Set(markdown.match(/\[[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ /_-]*\]/g) || [])];
  return { stats, slides, callScript, proposal, followUp, whatsapp, landing, campaign, economicsText, commercialModel, qualification, prospecting, diagnosisAgenda, objectionHandling, opportunitySchedule, leadHandlingSequence, measurementPlan, markdown, dossierHtml, unresolvedTokens };
}

export default function SectorOperatingSystem({ data, onOpenFactory, onOpenAdLab, onOpenLandings, onOpenCompany }: SectorOperatingSystemProps) {
  const [selectedId, setSelectedId] = useState(data.verticales[0]?.id || "generalista");
  const [activeStage, setActiveStage] = useState("Preparar");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState("");
  const [brief, setBrief] = useState<ClientBrief>(emptyBrief);
  const [savedBriefs, setSavedBriefs] = useState<ClientBrief[]>([]);
  const vertical = data.verticales.find((item) => item.id === selectedId) || data.verticales[0];
  const profile = profiles[vertical?.id] || fallbackProfile;
  const pack = useMemo(() => buildPack(vertical, profile, brief), [profile, vertical, brief]);
  const completeCount = operationalTasks.filter((_, index) => completed[`${vertical.id}:${brief.id}:${index}`]).length;

  useEffect(() => {
    let timer = 0;
    try {
      const saved = window.localStorage.getItem("rv-sector-operating-system-v1");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        timer = window.setTimeout(() => setCompleted(parsed), 0);
      }
    } catch {
      // El seguimiento sigue funcionando durante la sesión aunque el navegador bloquee el almacenamiento.
    }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem("rv-sector-client-briefs-v2") || "{}") as Record<string, ClientBrief[]>;
        let list = Array.isArray(saved[selectedId]) ? saved[selectedId] : [];
        if (!list.length) {
          const legacy = JSON.parse(window.localStorage.getItem("rv-sector-client-briefs-v1") || "{}") as Record<string, Partial<ClientBrief>>;
          if (legacy[selectedId]) list = [{ ...emptyBrief, ...legacy[selectedId], id: `legacy-${selectedId}` }];
        }
        const normalized = list.map((item) => ({ ...emptyBrief, ...item }));
        setSavedBriefs(normalized);
        setBrief(normalized[0] || { ...emptyBrief, id: `draft-${selectedId}` });
      } catch {
        setSavedBriefs([]);
        setBrief({ ...emptyBrief, id: `draft-${selectedId}` });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  const toggleTask = (key: string, done: boolean) => {
    setCompleted((current) => {
      const next = { ...current, [key]: !done };
      try { window.localStorage.setItem("rv-sector-operating-system-v1", JSON.stringify(next)); } catch { /* sesión sin persistencia */ }
      return next;
    });
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("No se pudo copiar");
    }
  };

  const exportName = `${(brief.company || vertical.label).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || vertical.id}-${brief.id}`;

  const download = () => {
    if (!canExport) return;
    const blob = new Blob([pack.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `redvitalia-${exportName}-sistema-operativo.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadText = (name: string, value: string) => {
    if (!canExport) return;
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `redvitalia-${exportName}-${name}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadHtml = () => {
    if (!canExport) return;
    const blob = new Blob([pack.dossierHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `redvitalia-${exportName}-kit.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const updateBrief = <K extends keyof ClientBrief>(key: K, value: ClientBrief[K]) => {
    setBrief((current) => {
      const next = { ...current, [key]: value };
      try {
        const saved = JSON.parse(window.localStorage.getItem("rv-sector-client-briefs-v2") || "{}") as Record<string, ClientBrief[]>;
        const currentList = Array.isArray(saved[selectedId]) ? saved[selectedId] : [];
        const nextList = [next, ...currentList.filter((item) => item.id !== next.id)];
        window.localStorage.setItem("rv-sector-client-briefs-v2", JSON.stringify({ ...saved, [selectedId]: nextList }));
        setSavedBriefs(nextList);
      } catch {
        // La activación sigue funcionando durante la sesión aunque el almacenamiento esté bloqueado.
      }
      return next;
    });
  };

  const newActivation = () => {
    const next = { ...emptyBrief, id: `client-${Date.now().toString(36)}` };
    setBrief(next);
    setSavedBriefs((current) => [next, ...current]);
    try {
      const saved = JSON.parse(window.localStorage.getItem("rv-sector-client-briefs-v2") || "{}") as Record<string, ClientBrief[]>;
      const currentList = Array.isArray(saved[selectedId]) ? saved[selectedId] : [];
      window.localStorage.setItem("rv-sector-client-briefs-v2", JSON.stringify({ ...saved, [selectedId]: [next, ...currentList] }));
    } catch {
      // La activación nueva sigue disponible en la sesión.
    }
    setActiveStage("Preparar");
  };

  const switchActivation = (id: string) => {
    const next = savedBriefs.find((item) => item.id === id);
    if (!next) return;
    setBrief(next);
    setActiveStage("Preparar");
  };

  const economics = calculateEconomics(brief);
  const activeCommercialModel = commercialModels.find((item) => item.id === brief.commercialModel) || commercialModels[0];
  const readyCount = [brief.company, brief.zone, brief.offer].filter(Boolean).length;
  const launchChecks = [
    { id: "brief", label: "Empresa, zona y oferta", ready: readyCount === 3 },
    { id: "economics", label: "Economía completa y viable", ready: economics.viable },
    { id: "contact", label: "Responsable comercial", ready: Boolean(brief.contact) },
    { id: "calendar", label: "Próximo paso fechado", ready: Boolean(brief.calendar) },
    { id: "claims", label: "Claims y pruebas aprobados", ready: brief.claimsApproved },
    { id: "privacy", label: "Privacidad y consentimiento", ready: brief.privacyReady },
    { id: "delivery", label: "SLA, CRM y entrega validados", ready: brief.deliveryReady },
    { id: "tokens", label: "Sin campos pendientes", ready: pack.unresolvedTokens.length === 0 },
  ];
  const launchReadyCount = launchChecks.filter((item) => item.ready).length;
  const canExport = launchChecks.every((item) => item.ready);
  const firstBlocker = launchChecks.find((item) => !item.ready);
  const draftPrefix = canExport ? "" : "BORRADOR INTERNO · NO ENVIAR AL CLIENTE\n\n";
  const activationOptions = savedBriefs.some((item) => item.id === brief.id) ? savedBriefs : [brief, ...savedBriefs];
  const launchStatus = canExport ? "LISTO PARA REVISIÓN FINAL" : "BORRADOR BLOQUEADO";
  const operationSeed: OperationContext = {
    ...defaultOperationContext,
    launchId: brief.id,
    name: `${brief.company || vertical.label} · ${brief.offer || "piloto RedVitalia"}`,
    vertical: vertical.label,
    landingVerticalId: vertical.id,
    zone: brief.zone,
    service: brief.offer || profile.outcome,
    audience: profile.buyer,
    pain: profile.trigger,
    result: profile.outcome,
    offer: brief.offer,
    proof: profile.proof,
    formFields: String(profile.formFields.length),
    price: brief.serviceFee ? String(parseNumber(brief.serviceFee)) : "",
    appointments: economics.valid ? String(economics.targetOpportunities) : "",
    clientAverageTicket: brief.averageTicket ? String(parseNumber(brief.averageTicket)) : "",
    grossMarginPct: brief.grossMarginPct ? String(parseNumber(brief.grossMarginPct)) : "",
    closeRatePct: brief.closeRatePct ? String(parseNumber(brief.closeRatePct)) : "",
    monthlyCapacity: brief.monthlyCapacity ? String(parseNumber(brief.monthlyCapacity)) : "",
    mediaBudget: brief.pilotBudget ? String(parseNumber(brief.pilotBudget)) : "",
    maxAcquisitionCost: economics.valid ? String(Math.round(economics.maxAcquisitionCost * 100) / 100) : "",
    commercialModel: activeCommercialModel.label,
    currentWebsiteUrl: brief.url,
    slaMinutes: brief.slaMinutes,
    exclusivity: brief.exclusivityRule,
    objective: `Validar ${brief.offer || "la oferta"} en ${brief.zone || "la zona"} con economía, calidad y capacidad controladas`,
    sourcePlaybook: vertical.label,
    contactUrl: "",
    legalName: brief.company || "RedVitalia",
  };
  const landingSeed: LandingBrief = {
    ...defaultBrief(vertical.id),
    brand: brief.company || "RedVitalia",
    zone: brief.zone || "tu zona",
    service: brief.offer || profile.outcome,
    audience: profile.buyer,
    pain: profile.trigger,
    result: profile.outcome,
    filter: profile.lead,
    offer: brief.offer || `Valoración inicial para ${vertical.label}`,
    proof: profile.proof,
    price: brief.price,
    legalName: brief.company,
    destination: "",
    formFieldsTarget: profile.formFields.length,
  };

  const cards = [
    { stage: "Preparar", label: "Brief del nicho", eyebrow: "BASE ESTRATÉGICA LISTA", body: `Cliente: ${profile.buyer}.\n\nDisparador: ${profile.trigger}.\n\nResultado: ${profile.outcome}.\n\nOportunidad válida: ${profile.lead}.`, action: "brief" },
    { stage: "Preparar", label: "Modelo y economía del piloto", eyebrow: economics.viable ? "ECONOMÍA VIABLE · VALIDAR CON EL CLIENTE" : economics.valid ? "ECONOMÍA CALCULADA · CONFIGURACIÓN INVIABLE" : "FALTAN DATOS ECONÓMICOS", body: `MODELO\n${activeCommercialModel.label}\n${activeCommercialModel.short}\n\nCOBRO\n${activeCommercialModel.charge}\n\nCUÁNDO ENCAJA\n${activeCommercialModel.bestFor}\n\nCONDICIÓN\n${activeCommercialModel.condition}\n\nECONOMÍA\n${pack.economicsText}`, action: "economia" },
    { stage: "Prospectar", label: "Lista y criterio de prospección", eyebrow: "CRITERIO LISTO · DATOS POR CARGAR", body: pack.prospecting, action: "lista" },
    { stage: "Prospectar", label: "Ficha de cualificación", eyebrow: "APROBACIÓN O DESCARTE EN 5 MINUTOS", body: pack.qualification, action: "cualificacion" },
    { stage: "Llamar", label: "Guion de primera llamada", eyebrow: "GUION LISTO PARA PERSONALIZAR", body: pack.callScript, action: "guion" },
    { stage: "Llamar", label: "Manejo de objeciones", eyebrow: "RESPUESTAS DEL NICHO LISTAS", body: pack.objectionHandling, action: "objeciones" },
    { stage: "Diagnosticar", label: "Reunión de diagnóstico", eyebrow: "AGENDA Y PREGUNTAS LISTAS", body: pack.diagnosisAgenda, action: "diagnostico" },
    { stage: "Proponer", label: "Presentación de 10 diapositivas", eyebrow: "NARRATIVA COMPLETA LISTA", body: pack.slides.join("\n"), action: "presentacion" },
    { stage: "Proponer", label: "Propuesta piloto", eyebrow: "DOCUMENTO BASE LISTO", body: pack.proposal, action: "propuesta" },
    { stage: "Proponer", label: "Secuencia de seguimiento", eyebrow: "EMAIL Y WHATSAPP · 5 CONTACTOS", body: `${pack.followUp}\n\nDÍA 0 · WHATSAPP\n${pack.whatsapp}\n\nDÍA 2 · VALOR\nHola, ${brief.contact || "[NOMBRE]"}. He aterrizado la definición de oportunidad y los límites del piloto. El punto que debemos confirmar es [DATO PENDIENTE]. ¿Te lo envío resuelto?\n\nDÍA 5 · DECISIÓN\n¿Tiene sentido reservar 25 minutos para validar números y capacidad, o prefieres que cierre esta propuesta por ahora?\n\nDÍA 10 · CIERRE LIMPIO\nCierro el seguimiento para no insistir. Si más adelante queréis activar ${brief.offer || "la oferta prioritaria"} en ${brief.zone || "la zona"}, conservaré el planteamiento.`, action: "seguimiento" },
    { stage: "Lanzar", label: "Campaña inicial", eyebrow: "3 ANUNCIOS COMPLETOS LISTOS PARA ADAPTAR", body: pack.campaign, action: "campana" },
    { stage: "Lanzar", label: "Landing y formulario", eyebrow: "COPY COMPLETO LISTO PARA MAQUETAR", body: pack.landing, action: "landing" },
    { stage: "Operar", label: "Solicitud de materiales", eyebrow: "CHECKLIST DE ONBOARDING LISTO", body: profile.assets.map((asset) => `□ ${asset}`).join("\n"), action: "materiales" },
    { stage: "Operar", label: "Entrega y seguimiento de oportunidades", eyebrow: "REGLAS, RECLAMACIONES Y CADENCIA LISTAS", body: `${pack.opportunitySchedule}\n\n${pack.leadHandlingSequence}`, action: "operacion" },
    { stage: "Medir", label: "Cuadro de mando y decisión", eyebrow: "FÓRMULAS, UMBRALES Y REGLAS LISTAS", body: pack.measurementPlan, action: "medicion" },
  ].filter((card) => card.stage === activeStage);

  if (!vertical) return null;
  return (
    <section className={styles.shell} aria-labelledby="sector-os-title">
      <header className={styles.topbar}>
        <div>
          <p>SISTEMA OPERATIVO POR NICHO</p>
          <h1 id="sector-os-title">Elige un sector y ejecuta el negocio de principio a fin.</h1>
          <span>Cada paquete separa la base ya preparada de los datos que deben confirmarse con el cliente.</span>
        </div>
        <div className={styles.topActions}>
          <button type="button" onClick={() => copy("paquete", `${draftPrefix}${pack.markdown}`)}>{copied === "paquete" ? "Copiado" : canExport ? "Copiar kit listo" : "Copiar borrador"}</button>
          <button type="button" disabled={!canExport} title={!canExport ? `Bloqueado: ${firstBlocker?.label}` : undefined} onClick={download}>Descargar Markdown</button>
          <button type="button" disabled={!canExport} title={!canExport ? `Bloqueado: ${firstBlocker?.label}` : undefined} onClick={downloadHtml}>Descargar dossier HTML</button>
          <button type="button" className={styles.primary} onClick={() => onOpenFactory?.(operationSeed)}>Continuar en Fábrica →</button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.sectorRail} aria-label="Sectores disponibles">
          <div className={styles.railTitle}><b>{data.verticales.length} sectores</b><span>Selecciona para abrir su sistema</span></div>
          {data.verticales.map((item) => (
            <button key={item.id} type="button" data-active={item.id === vertical.id} onClick={() => { setSelectedId(item.id); setActiveStage("Preparar"); }}>
              <span>{item.label}</span><small>{item.n} fichas · {item.spainN} España</small>
            </button>
          ))}
        </aside>

        <main className={styles.main}>
          <section className={styles.sectorHero}>
            <div><p>PLAYBOOK ACTIVO</p><h2>{vertical.label}</h2><span>{pack.stats}</span></div>
            <div className={styles.readiness}><strong>15</strong><span>entregables accionables</span><small>{completeCount}/10 tareas ejecutadas</small></div>
          </section>

          <section className={styles.clientBrief} data-compact={activeStage !== "Preparar"} aria-labelledby="client-brief-title">
            <header><div><p>ACTIVACIÓN REDVITALIA</p><h3 id="client-brief-title">{brief.company || "Aterriza el kit a un cliente real"}</h3></div><div className={styles.briefHeaderState}><span>{brief.offer ? `${brief.offer} · ${brief.zone || "zona pendiente"} · ` : ""}<strong>{launchReadyCount}/8</strong> controles · guardado en este navegador</span>{activeStage !== "Preparar" && <button type="button" onClick={() => setActiveStage("Preparar")}>Editar preparación</button>}</div></header>
            <div className={styles.activationToolbar}>
              <label><span>Activación actual</span><select value={brief.id} onChange={(event) => switchActivation(event.target.value)}>{activationOptions.map((item) => <option key={item.id} value={item.id}>{item.company || "Activación sin nombre"} · {item.offer || "oferta pendiente"}</option>)}</select></label>
              <div data-ready={canExport}><small>ESTADO</small><b>{launchStatus}</b></div>
              <button type="button" onClick={newActivation}>+ Nueva activación</button>
            </div>
            <div className={styles.briefGrid}>
              {([[
                "company", "Empresa cliente", "Ej. Inmobiliaria Norte"
              ], ["contact", "Persona de contacto", "Ej. Marta García"], ["zone", "Zona prioritaria", "Ej. Madrid norte"], ["offer", "Oferta a vender", "Ej. Valoración gratuita"], ["price", "Precio comunicado de la oferta", "Ej. 350.000 €"], ["calendar", "Próximo paso / fecha", "Ej. martes 10:00"], ["url", "Web actual del cliente", "Ej. https://…"]] as Array<[TextBriefKey, string, string]>).map(([key, label, placeholder]) => (
                <label key={key}><span>{label}{["company", "zone", "offer"].includes(key) ? " · mínimo" : ""}</span><input type={key === "url" ? "url" : "text"} value={brief[key]} placeholder={placeholder} onChange={(event) => updateBrief(key, event.target.value)} /></label>
              ))}
            </div>
            <div className={styles.modelChooser}>
              <div className={styles.subhead}><span>Modelo de entrada</span><small>Elige cómo se cobrará el primer piloto; la recomendación final depende de economía y operación.</small></div>
              <div>
                {commercialModels.map((model) => <button key={model.id} type="button" data-active={model.id === brief.commercialModel} onClick={() => updateBrief("commercialModel", model.id)}><b>{model.label}</b><span>{model.short}</span><small>{model.charge}</small></button>)}
              </div>
            </div>
            <div className={styles.economicsPanel}>
              <div className={styles.subhead}><span>Economía mínima del piloto</span><small>Estos números evitan vender una campaña que no puede ser rentable.</small></div>
              <div className={styles.economicsInputs}>
                {([[
                  "averageTicket", "Ticket medio (€)", "2500"
                ], ["grossMarginPct", "Margen bruto (%)", "45"], ["closeRatePct", "Cierre estimado (%)", "20"], ["monthlyCapacity", "Capacidad mensual", "20"], ["pilotBudget", "Inversión en medios (€)", "1500"], ["serviceFee", "Honorarios RedVitalia (€)", "750"]] as Array<[TextBriefKey, string, string]>).map(([key, label, placeholder]) => <label key={key}><span>{label}</span><input inputMode="decimal" value={brief[key]} placeholder={placeholder} onChange={(event) => updateBrief(key, event.target.value)} /></label>)}
              </div>
              <div className={styles.economicsOutput} data-valid={economics.viable}>
                {economics.valid ? <>
                  <div><span>Contribución/venta</span><b>{formatEuro(economics.contributionPerSale)}</b></div>
                  <div><span>Valor/oportunidad</span><b>{formatEuro(economics.valuePerOpportunity)}</b></div>
                  <div><span>Coste máximo prudente</span><b>{formatEuro(economics.maxAcquisitionCost)}</b></div>
                  <div><span>Objetivo de piloto</span><b>{economics.targetOpportunities} oportunidades</b></div>
                  <div><span>Coste total piloto</span><b>{formatEuro(economics.totalPilotCost)}</b></div>
                  <div><span>Ventas esperadas</span><b>{economics.expectedSales.toFixed(1)}</b></div>
                  <div><span>Contribución antes de costes</span><b>{formatEuro(economics.expectedContribution)}</b></div>
                  <div><span>Balance esperado del piloto</span><b>{formatEuro(economics.expectedNetContribution)}</b></div>
                </> : <p>Completa los seis datos económicos para calcular el límite de captación y evitar propuestas inviables.</p>}
              </div>
              <p className={styles.economicsWarning}>{economics.capacityWarning}</p>
            </div>
            <div className={styles.termsPanel}>
              <div className={styles.subhead}><span>Condiciones operativas del piloto</span><small>Valores recomendados, pero deben aprobarse con el cliente y quedar en el documento firmado.</small></div>
              <div className={styles.termsGrid}>
                {([[
                  "pilotDurationDays", "Duración (días)", "30"
                ], ["duplicateWindowDays", "Ventana de duplicado (días)", "90"], ["rejectionHours", "Reclamación (horas)", "48"], ["slaMinutes", "SLA primer intento (min)", "15"]] as Array<[TextBriefKey, string, string]>).map(([key, label, placeholder]) => <label key={key}><span>{label}</span><input inputMode="numeric" value={brief[key]} placeholder={placeholder} onChange={(event) => updateBrief(key, event.target.value)} /></label>)}
                <label><span>Exclusividad</span><select value={brief.exclusivityRule} onChange={(event) => updateBrief("exclusivityRule", event.target.value as ClientBrief["exclusivityRule"])}><option value="lead">Un cliente por contacto</option><option value="territory">Una empresa por zona</option><option value="none">Sin exclusividad</option></select></label>
              </div>
            </div>
            <div className={styles.approvalChecks}>
              <label data-checked={brief.claimsApproved}><input type="checkbox" checked={brief.claimsApproved} onChange={(event) => updateBrief("claimsApproved", event.target.checked)} /><span><b>Claims y pruebas aprobados</b><small>Ninguna cifra, reseña o resultado inventado.</small></span></label>
              <label data-checked={brief.privacyReady}><input type="checkbox" checked={brief.privacyReady} onChange={(event) => updateBrief("privacyReady", event.target.checked)} /><span><b>Privacidad preparada</b><small>Responsable, consentimiento, textos y conservación definidos.</small></span></label>
              <label data-checked={brief.deliveryReady}><input type="checkbox" checked={brief.deliveryReady} onChange={(event) => updateBrief("deliveryReady", event.target.checked)} /><span><b>Entrega operativa validada</b><small>SLA, CRM, rechazo, remedio y capacidad aceptados.</small></span></label>
            </div>
            <div className={styles.launchGate} data-ready={canExport} aria-live="polite">
              <div><b>{canExport ? "Kit listo para revisión final" : "Kit todavía no debe salir al cliente"}</b><span>{canExport ? "Los ocho controles están completos. Haz la última revisión humana y exporta." : `Siguiente bloqueo: ${firstBlocker?.label}.`}</span>{pack.unresolvedTokens.length > 0 && <small>Campos pendientes: {pack.unresolvedTokens.join(", ")}</small>}</div>
              <strong>{launchReadyCount}/8</strong>
            </div>
            <div className={styles.gateChecklist} aria-label="Controles de salida">
              {launchChecks.map((item) => <span key={item.id} data-ready={item.ready}>{item.ready ? "✓" : "○"} {item.label}</span>)}
            </div>
          </section>

          <nav className={styles.stages} aria-label="Fases de ejecución">
            {stageNames.map((stage, index) => <button key={stage} type="button" data-active={stage === activeStage} aria-pressed={stage === activeStage} onClick={() => setActiveStage(stage)}><i>{String(index + 1).padStart(2, "0")}</i><span>{stage}</span></button>)}
          </nav>

          <section className={styles.stageIntro}>
            <div><p>FASE ACTUAL</p><h3>{activeStage}</h3></div>
            <span>{activeStage === "Preparar" ? "Aterriza oferta, público, capacidad y definición de oportunidad antes de contactar." : `Usa los entregables de ${activeStage.toLocaleLowerCase("es")} y marca solo lo que se haya ejecutado de verdad.`}</span>
          </section>

          <div className={styles.deliverables}>
            {cards.map((card) => (
                <article key={card.action} className={styles.deliverable}>
                <header><div><p>{card.eyebrow}</p><h4>{card.label}</h4></div><div className={styles.cardActions}><button type="button" onClick={() => copy(card.action, `${draftPrefix}${card.body}`)}>{copied === card.action ? "Copiado" : canExport ? "Copiar" : "Copiar borrador"}</button><button type="button" disabled={!canExport} title={!canExport ? `Bloqueado: ${firstBlocker?.label}` : undefined} onClick={() => downloadText(card.action, card.body)}>TXT</button></div></header>
                <pre>{card.body}</pre>
              </article>
            ))}
          </div>

          <section className={styles.executionBoard}>
            <header><div><p>EJECUCIÓN REAL</p><h3>Qué queda por hacer con este cliente</h3></div><strong>{completeCount}/10</strong></header>
            <div>
              {operationalTasks.map((task, index) => {
                const key = `${vertical.id}:${brief.id}:${index}`;
                const done = Boolean(completed[key]);
                return <button key={task} type="button" data-done={done} onClick={() => toggleTask(key, done)}><i>{done ? "✓" : index + 1}</i><span>{task}</span><small>{done ? "Hecho por el equipo" : "Pendiente real"}</small></button>;
              })}
            </div>
          </section>

          <section className={styles.evidence}>
            <header><div><p>EVIDENCIA DEL NICHO</p><h3>Referentes que sostienen la lectura</h3></div><span>El score es editorial, no rendimiento.</span></header>
            <div>{vertical.referentes.map((reference) => <button type="button" key={reference.id} onClick={() => onOpenCompany?.(reference.id)}><b>{reference.name}</b><span>{reference.country}</span><strong>{reference.score}/100</strong></button>)}</div>
          </section>

          <footer className={styles.nextActions}>
            <button type="button" onClick={() => onOpenAdLab?.([vertical.label, brief.offer, brief.company].filter(Boolean).join(" "))}>Buscar anuncios del nicho</button>
            <button type="button" onClick={() => onOpenLandings?.(landingSeed)}>Construir la landing con este brief</button>
            <button type="button" className={styles.primary} onClick={() => onOpenFactory?.(operationSeed)}>Montar campaña completa →</button>
          </footer>
        </main>
      </div>
    </section>
  );
}
