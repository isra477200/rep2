export type GrowthRouteKind = "client" | "intent" | "demand" | "expansion";

export type GrowthRoute = {
  id: string;
  systemId: string;
  code: "A" | "B" | "C" | "D";
  kind: GrowthRouteKind;
  title: string;
  premise: string;
  audience: string;
  trigger: string;
  offer: string;
  channels: string[];
  funnel: string[];
  qualification: string[];
  assets: string[];
  evidence: string[];
  guardrails: string[];
  northStar: string;
  decision: string;
  sprint: Array<{ phase: string; objective: string; actions: string[] }>;
};

type RouteProfile = {
  account: string;
  signal: string;
  service: string;
  diagnostic: string;
  intentTitle: string;
  intent: string;
  qualifier: string;
  demandTitle: string;
  demandAngle: string;
  demandAsset: string;
  expansionTitle: string;
  expansion: string;
  result: string;
  proof: string;
  constraint: string;
  campaignChannels: string[];
};

export const ROUTE_KIND_META: Record<GrowthRouteKind, { label: string; scope: string; dimensions: string[] }> = {
  client: {
    label: "Conseguir la cuenta",
    scope: "RedVitalia → empresa",
    dimensions: ["experience", "demonstrability", "standardisation", "competition"],
  },
  intent: {
    label: "Capturar intención",
    scope: "Empresa → oportunidad",
    dimensions: ["demand", "qualification", "speed", "demonstrability"],
  },
  demand: {
    label: "Crear demanda",
    scope: "Mercado → interés",
    dimensions: ["value", "defensibility", "volume", "legalRisk"],
  },
  expansion: {
    label: "Expandir la cuenta",
    scope: "Resultado → crecimiento",
    dimensions: ["margin", "scalability", "standardisation", "experience"],
  },
};

const PROFILES: Record<string, RouteProfile> = {
  legal: {
    account: "Despachos con área concursal, sucesoria o de familia, decisor accesible y capacidad semanal para consultas nuevas.",
    signal: "La especialidad existe, pero la web, la compra de tráfico y el intake mezclan asuntos con economías distintas.",
    service: "un sistema separado para Segunda Oportunidad, Herencias o Divorcios",
    diagnostic: "Auditoría de demanda, filtro jurídico, tiempo de respuesta y devolución de asunto aceptado al origen.",
    intentTitle: "Tres intenciones jurídicas sin mezclarlas",
    intent: "Búsquedas explícitas sobre deuda, herencia bloqueada o divorcio complejo, cada una con landing, negativas y conversión propia.",
    qualifier: "Rama, provincia, complejidad, urgencia, capacidad de consulta y criterio de asunto aceptable.",
    demandTitle: "Autoridad antes de la urgencia",
    demandAngle: "Explicar proceso, documentación y errores evitables para construir confianza antes de que la persona elija despacho.",
    demandAsset: "Guías por problema, mapas de proceso, preguntas frecuentes revisadas y piezas de autoridad del profesional.",
    expansionTitle: "Abrir una segunda rama solo con señal",
    expansion: "Replicar infraestructura y aprendizaje sin compartir campañas, economía ni promesas entre especialidades.",
    result: "consulta asistida, asunto aceptado y valor económico registrado",
    proof: "Registro verificable desde búsqueda hasta consulta y asunto aceptado; no basta con contar formularios.",
    constraint: "No prometer sentencias, plazos judiciales ni cancelación de deuda; revisión jurídica y humana obligatoria.",
    campaignChannels: ["Google Search", "remarketing educativo"],
  },
  toldos: {
    account: "Instaladores de pérgolas, cerramientos o toldos premium con obras reales, radio definido y capacidad de visita.",
    signal: "Buen producto visual y ticket defendible, pero catálogo genérico, respuesta lenta o mezcla con reparaciones de bajo valor.",
    service: "un piloto monoproducto orientado a visita técnica y venta",
    diagnostic: "Revisión de producto prioritario, ticket mínimo, radio, material visual, velocidad de visita y presupuesto.",
    intentTitle: "Proyecto premium por producto y municipio",
    intent: "Búsquedas de pérgola bioclimática, cerramiento o motorización con intención de instalación, no de bricolaje.",
    qualifier: "Propiedad, zona, medidas, uso del espacio, rango de inversión, plazo y disponibilidad de visita.",
    demandTitle: "Inspiración que termina en proyecto",
    demandAngle: "Convertir obras reales en deseo, explicar decisiones técnicas y conducir a una valoración, no a un catálogo vacío.",
    demandAsset: "Casos autorizados por producto y zona, secuencia antes/después, materiales y explicación de la visita técnica.",
    expansionTitle: "Escalar producto × municipio",
    expansion: "Abrir nuevas combinaciones únicamente cuando visita, presupuesto, venta y margen estén conectados.",
    result: "visita asistida, presupuesto emitido, venta y margen",
    proof: "Obras propias autorizadas, fechas de presupuesto y ventas devueltas al sistema.",
    constraint: "No usar obras ajenas, rangos inventados ni disponibilidad ficticia; separar reparación y producto premium.",
    campaignChannels: ["Google Search", "Meta visual"],
  },
  coches: {
    account: "Compradores profesionales con caja, logística, tasación rápida y criterios escritos para vehículos complejos.",
    signal: "Aceptan averías, siniestros o cargas, pero comunican una compra genérica y no devuelven margen por operación.",
    service: "un sistema por problema del vehículo con tasación y señal económica offline",
    diagnostic: "Mapa de aceptación, documentación, tiempo de oferta, cobertura logística, caja y margen por compra.",
    intentTitle: "Una landing por problema del vehículo",
    intent: "Separar avería, siniestro, reserva de dominio, embargo y financiación pendiente para no perder intención específica.",
    qualifier: "Titularidad, vehículo, estado, carga, ubicación, documentación, fotos, urgencia y expectativa.",
    demandTitle: "Resolver incertidumbre antes de tasar",
    demandAngle: "Explicar opciones reales, documentación y proceso para captar a quien todavía no sabe si puede vender.",
    demandAsset: "Árbol de situaciones, checklist documental, contenido de proceso y ejemplos solo cuando sean verificables.",
    expansionTitle: "Escalar problema × provincia × margen",
    expansion: "Mover presupuesto hacia combinaciones que producen compra y margen neto, aunque el CPL sea más alto.",
    result: "vehículo valorable, oferta aceptada, recogida y margen",
    proof: "Compra y margen importados por origen, junto con tiempos reales de tasación y recogida.",
    constraint: "No garantizar valoración, cancelación de cargas ni recogida sin revisar documentación, zona y capacidad.",
    campaignChannels: ["Google Search", "remarketing de decisión"],
  },
  estetica: {
    account: "Clínicas con tratamiento de alto valor, coordinador comercial, agenda disponible y casos autorizados.",
    signal: "Invierten en visibilidad, pero mezclan tratamientos, optimizan a lead barato o pierden la cita en recepción.",
    service: "un piloto por tratamiento que mida valoración asistida y venta",
    diagnostic: "Revisión de tratamiento, huecos, coordinador, seguimiento, financiación, prueba y registro de ingresos.",
    intentTitle: "Tratamiento único con intención alta",
    intent: "Búsquedas de injerto, tratamiento facial o corporal concreto conectadas a valoración y venta, no a formulario genérico.",
    qualifier: "Tratamiento, motivación, zona, plazo, disponibilidad, rango económico y aceptación de valoración clínica.",
    demandTitle: "Educación visual sin explotar inseguridad",
    demandAngle: "Resolver dudas de proceso, profesional, recuperación y financiación con comunicación clínica aprobada.",
    demandAsset: "Profesional real, instalaciones, explicación del proceso y casos con permiso expreso y contexto suficiente.",
    expansionTitle: "Expandir por tratamiento rentable",
    expansion: "Abrir un segundo tratamiento o zona solo después de estabilizar show, cierre y contribución del primero.",
    result: "valoración asistida, tratamiento vendido e ingreso",
    proof: "Agenda, asistencia, presupuesto y tratamiento vendido devueltos por campaña y creatividad.",
    constraint: "No diagnosticar, señalar defectos personales ni garantizar resultados; revisión clínica y publicitaria obligatoria.",
    campaignChannels: ["Google Search", "Meta Ads"],
  },
  climatizacion: {
    account: "Instaladores con servicios y tickets definidos, agenda técnica visible y atención inmediata de llamadas.",
    signal: "Existe demanda, pero urgencias, reparación, instalación y aerotermia compiten por el mismo presupuesto y teléfono.",
    service: "un sistema por servicio y franja conectado a capacidad técnica",
    diagnostic: "Revisión de llamadas perdidas, zonas, horario, ticket mínimo, disponibilidad, visita y valor del trabajo.",
    intentTitle: "Urgencia y proyecto en funnels distintos",
    intent: "Llamada directa para urgencia; landing cualificada para instalación, sustitución o aerotermia.",
    qualifier: "Servicio, inmueble, metros, equipo, avería, zona, plazo, propietario y disponibilidad de visita.",
    demandTitle: "Pretemporada y decisión energética",
    demandAngle: "Crear demanda antes del pico con sustitución, eficiencia y planificación, sin depender solo de averías.",
    demandAsset: "Comparativas técnicas revisadas, proceso de visita, explicación de consumo y trabajos reales autorizados.",
    expansionTitle: "Escalar servicio × franja × capacidad",
    expansion: "Activar o pausar combinaciones según técnicos, llamadas atendidas, trabajo ganado y margen.",
    result: "llamada válida, visita, presupuesto, trabajo ganado y valor",
    proof: "Grabación y clasificación de llamadas, agenda técnica y valor final del trabajo.",
    constraint: "No anunciar atención, ahorro, subvención o instalación inmediata si la operación no puede sostenerlo.",
    campaignChannels: ["Google Search", "campañas de llamada"],
  },
  reformas: {
    account: "Empresas de reforma integral o cocina premium con portfolio propio, ticket mínimo y disciplina de presupuesto.",
    signal: "Tienen buenos trabajos, pero captan proyectos pequeños, tardan en presupuestar o no siguen decisiones largas.",
    service: "un piloto por tipología de obra con filtro económico y seguimiento",
    diagnostic: "Revisión de zona, tipología, ticket, portfolio, capacidad de visita, plazo de presupuesto y margen de obra.",
    intentTitle: "Microvertical con presupuesto mínimo",
    intent: "Reforma integral, cocina o rehabilitación separadas para filtrar alcance, propiedad y capacidad económica.",
    qualifier: "Propiedad, zona, metros, alcance, presupuesto, fecha, decisores y disponibilidad de visita.",
    demandTitle: "Caso real, proceso y confianza",
    demandAngle: "Mostrar cómo se planifica y ejecuta una obra para madurar al propietario antes de pedir visita.",
    demandAsset: "Obras propias autorizadas, diario de proyecto, materiales, equipo, plazo contextualizado y reseñas verificables.",
    expansionTitle: "Escalar tipología × zona con seguimiento",
    expansion: "Crecer donde visita, presupuesto, seguimiento, obra y margen sean medibles durante un ciclo largo.",
    result: "proyecto cualificado, visita, presupuesto, obra ganada y margen",
    proof: "Portfolio propio, fecha real de presupuesto, causa de pérdida y margen por obra.",
    constraint: "No usar obras ajenas ni prometer precio o plazo sin alcance; el presupuesto mínimo debe ser real.",
    campaignChannels: ["Google Search", "Meta casos reales"],
  },
  dental: {
    account: "Clínicas con implantes, rehabilitación u ortodoncia, coordinador, financiación y capacidad de primeras visitas.",
    signal: "Consiguen formularios, pero recepción, no-show y seguimiento del plan rompen la economía del tratamiento.",
    service: "un piloto por tratamiento optimizado a plan aceptado",
    diagnostic: "Revisión de huecos, coordinador, llamada, financiación, show, presentación del plan y registro de ingreso.",
    intentTitle: "Intención clínica por tratamiento",
    intent: "Implantes, rehabilitación u ortodoncia con campañas, landings y expectativas separadas.",
    qualifier: "Tratamiento, situación, zona, plazo, financiación, disponibilidad y aceptación de primera visita.",
    demandTitle: "Educación clínica que reduce fricción",
    demandAngle: "Explicar valoración, opciones y proceso con autoridad profesional antes de pedir una cita.",
    demandAsset: "Profesional, clínica, proceso, financiación y casos autorizados sin promesas ni diagnósticos publicitarios.",
    expansionTitle: "Tratamiento rentable y reactivación",
    expansion: "Estabilizar un tratamiento, recuperar planes abiertos y después abrir una segunda línea.",
    result: "primera visita asistida, plan presentado, plan aceptado e ingreso",
    proof: "Resultado desde lead hasta tratamiento aceptado, con causa de no-show y de no aceptación.",
    constraint: "No prometer resultados clínicos, diagnosticar ni explotar atributos personales; revisión sanitaria obligatoria.",
    campaignChannels: ["Google Search", "Meta educación"],
  },
  inmobiliario: {
    account: "Agencias con zona defendible, propuesta para propietarios y proceso de valoración, nutrición y exclusiva.",
    signal: "Compran leads o hacen marca general, pero mezclan propietario, comprador y curiosidad de valoración.",
    service: "un sistema de captación de propietarios por motivo y horizonte",
    diagnostic: "Revisión de zona, titularidad, valoración, seguimiento, horizonte, exclusiva y comisión registrada.",
    intentTitle: "Propietario por motivo y plazo",
    intent: "Venta urgente, herencia o divorcio separadas de la valoración exploratoria y del comprador.",
    qualifier: "Titularidad, inmueble, zona, motivo, plazo, ocupación, cargas, expectativa y decisores.",
    demandTitle: "Autoridad hiperlocal y maduración",
    demandAngle: "Construir preferencia antes de vender con información real de zona, proceso y preparación del inmueble.",
    demandAsset: "Guías locales, proceso de valoración, preguntas de propietario y prueba verificable de la agencia.",
    expansionTitle: "Nutrición 30/90/180 y expansión local",
    expansion: "Convertir plazos largos en pipeline y abrir otra zona solo con citas, valoraciones y exclusivas medibles.",
    result: "propietario válido, valoración asistida, propuesta y exclusiva",
    proof: "Titularidad validada, horizonte, valoración, exclusiva y comisión devueltas por origen.",
    constraint: "No garantizar valoración, precio de venta, plazo ni exclusiva; separar propietario, comprador y alquiler.",
    campaignChannels: ["Google Search", "Meta hiperlocal"],
  },
  auditivos: {
    account: "Centros auditivos con agenda, profesional, financiación y proceso que incorpora al familiar decisor.",
    signal: "La demanda local es incierta o se mezcla audición con ortopedia y productos de economía muy distinta.",
    service: "un piloto de ciudad y producto con cita asistida como señal",
    diagnostic: "Revisión de volumen local, producto, ticket, teléfono, agenda, cuidador y venta registrada.",
    intentTitle: "Ciudad única y necesidad concreta",
    intent: "Prueba auditiva y audífonos separados de movilidad, camas y productos pequeños.",
    qualifier: "Necesidad, usuario, zona, producto, acompañante, financiación y disponibilidad de cita o visita.",
    demandTitle: "Mensaje al cuidador y a la familia",
    demandAngle: "Explicar acompañamiento, prueba y adaptación al decisor que ayuda al usuario a actuar.",
    demandAsset: "Profesional real, proceso de prueba, adaptación, financiación y piezas accesibles para usuario y cuidador.",
    expansionTitle: "Validar ciudad antes de replicar",
    expansion: "Abrir producto o ciudad solo cuando exista volumen suficiente, cita asistida y margen comprobado.",
    result: "necesidad validada, cita asistida, prueba o presupuesto y venta",
    proof: "Agenda, asistencia, decisión familiar, producto vendido y valor por ciudad.",
    constraint: "No diagnosticar ni prometer mejora médica; audición y ortopedia no comparten funnel.",
    campaignChannels: ["Google Search", "llamada visible"],
  },
  logistica: {
    account: "Empresas de mudanza, contenedor o guardamuebles con mínimos, zonas, capacidad y presupuesto rápido.",
    signal: "Tienen volumen potencial, pero pequeños portes, fechas imposibles y capacidad cambiante destruyen el margen.",
    service: "un sistema por servicio, fecha y zona conectado a disponibilidad",
    diagnostic: "Revisión de mínimos, radio, calendario, plantilla de presupuesto, tiempo de respuesta y valor de reserva.",
    intentTitle: "Fecha, ruta y servicio como intención",
    intent: "Mudanza completa, contenedor y guardamuebles separados de empleo, alquiler o pequeño porte.",
    qualifier: "Origen, destino, fecha, volumen, plantas, accesos, permisos, duración y mínimo económico.",
    demandTitle: "Confianza operativa antes del presupuesto",
    demandAngle: "Reducir incertidumbre mostrando preparación, cobertura, seguro, acceso y qué necesita la empresa para presupuestar.",
    demandAsset: "Checklist de mudanza, proceso de presupuesto, equipo propio verificable y explicación de incidencias comunes.",
    expansionTitle: "Escalar servicio × zona × capacidad",
    expansion: "Aumentar cobertura únicamente donde respuesta, presupuesto, reserva y margen siguen dentro del estándar.",
    result: "solicitud válida, presupuesto, reserva pagada y valor del servicio",
    proof: "Tiempo a presupuesto, reserva, trabajo completado y valor por ruta y servicio.",
    constraint: "No prometer fecha, cobertura, precio o disponibilidad si el calendario operativo no está actualizado.",
    campaignChannels: ["Google Search", "campañas por fecha"],
  },
};

const makeRoutes = (systemId: string, profile: RouteProfile): GrowthRoute[] => [
  {
    id: `${systemId}-client`, systemId, code: "A", kind: "client",
    title: `Cuenta fundadora: ${profile.service}`,
    premise: "La primera venta es el sistema de RedVitalia a la empresa. Se entra con un diagnóstico específico, no con una presentación genérica de agencia.",
    audience: profile.account, trigger: profile.signal, offer: profile.diagnostic,
    channels: ["Teléfono", "Email", "LinkedIn", "Referencia"],
    funnel: ["Lista con señal verificable", "Apertura sectorial", "Diagnóstico con decisor", "Economía y capacidad", "Piloto condicionado"],
    qualification: ["Existe una prioridad concreta y no solo curiosidad.", "Hay capacidad operativa y responsable comercial.", `Acepta medir ${profile.result}.`],
    assets: ["Lista de cuentas con fuente", "Guion por señal", "Diagnóstico y scorecard", "Plan de piloto con dependencias"],
    evidence: [profile.proof, "Notas que separan dato, hipótesis y pendiente de confirmar."],
    guardrails: [profile.constraint, "No inventar clientes, resultados, precios ni personalización."],
    northStar: "Diagnósticos B2B celebrados con decisor, datos y siguiente decisión.",
    decision: "Avanzar solo cuando dolor, capacidad, economía, medición y decisor alcanzan el umbral del closer.",
    sprint: [
      { phase: "Días 1–3", objective: "Elegir cuentas", actions: ["Definir señal de entrada.", "Construir lista verificable.", "Preparar tres observaciones reales."] },
      { phase: "Días 4–10", objective: "Abrir conversaciones", actions: ["Ejecutar bloques de llamada.", "Usar cadencia multicanal.", "Revisar dos conversaciones al día."] },
      { phase: "Días 11–30", objective: "Convertir a piloto", actions: ["Celebrar diagnósticos.", "Condicionar propuesta a datos.", "Registrar win/loss y objeciones."] },
    ],
  },
  {
    id: `${systemId}-intent`, systemId, code: "B", kind: "intent",
    title: profile.intentTitle,
    premise: profile.intent,
    audience: "Personas o empresas que ya expresan el problema y buscan resolverlo ahora.",
    trigger: `Señal de entrada: ${profile.qualifier}`,
    offer: `Captación y cualificación hasta ${profile.result}.`, channels: profile.campaignChannels,
    funnel: ["Intención específica", "Anuncio por problema", "Landing y filtro", "Respuesta dentro del SLA", "Resultado offline"],
    qualification: [profile.qualifier, "Zona, capacidad y exclusiones aplicadas antes de optimizar.", "Consentimiento y dato de contacto válidos."],
    assets: ["Mapa de términos y negativas", "Landing específica", "Formulario de cualificación", "Importación del resultado final"],
    evidence: [profile.proof, "Consultas, llamadas y resultados trazados por campaña y término."],
    guardrails: [profile.constraint, "No escalar por CPL si cae la calidad o la contribución."],
    northStar: profile.result,
    decision: "Escalar únicamente cuando la conversión final y la capacidad sostienen la economía; el volumen de formularios no decide.",
    sprint: [
      { phase: "Días 1–3", objective: "Separar intención", actions: ["Elegir un problema.", "Definir válido/no válido.", "Aprobar zona y capacidad."] },
      { phase: "Días 4–10", objective: "Lanzar señal limpia", actions: ["Construir campaña y landing.", "Probar medición completa.", "Ensayar respuesta y seguimiento."] },
      { phase: "Días 11–30", objective: "Aprender con resultado", actions: ["Clasificar cada oportunidad.", "Importar resultado offline.", "Corregir términos, filtro y SLA."] },
    ],
  },
  {
    id: `${systemId}-demand`, systemId, code: "C", kind: "demand",
    title: profile.demandTitle,
    premise: profile.demandAngle,
    audience: "Mercado relevante que reconoce parte del problema, pero aún no ha decidido actuar o comparar proveedores.",
    trigger: "Interacción con contenido útil, prueba autorizada o explicación del proceso.",
    offer: `Educación y prueba que conducen a una conversación cualificada sobre ${profile.service}.`,
    channels: ["Meta Ads", "vídeo corto propuesto", "contenido", "remarketing"],
    funnel: ["Problema reconocible", "Contenido o caso", "Interacción de calidad", "Remarketing por objeción", "Conversación cualificada"],
    qualification: ["La pieza corresponde a un subsegmento prioritario.", "La acción final exige los mismos filtros que la ruta de intención.", "La frecuencia y la exclusión se revisan por audiencia."],
    assets: [profile.demandAsset, "Matriz de objeciones", "Secuencia de remarketing", "Prueba y permisos documentados"],
    evidence: ["Patrones creativos clasificados como copiar, adaptar, probar o descartar.", profile.proof],
    guardrails: [profile.constraint, "No convertir una hipótesis creativa en un caso o testimonio ficticio."],
    northStar: "Conversaciones cualificadas asistidas por contenido, no clics ni reproducciones aisladas.",
    decision: "Mantener si incrementa conversación válida o reduce fricción sin degradar la economía de la ruta de intención.",
    sprint: [
      { phase: "Días 1–3", objective: "Elegir tensión", actions: ["Extraer objeción recurrente.", "Seleccionar prueba autorizada.", "Escribir hipótesis creativa."] },
      { phase: "Días 4–10", objective: "Construir secuencia", actions: ["Producir tres ángulos.", "Conectar remarketing.", "Revisar compliance y permisos."] },
      { phase: "Días 11–30", objective: "Medir asistencia", actions: ["Etiquetar interacción útil.", "Comparar conversación por ángulo.", "Promover o descartar con criterio escrito."] },
    ],
  },
  {
    id: `${systemId}-expansion`, systemId, code: "D", kind: "expansion",
    title: profile.expansionTitle,
    premise: profile.expansion,
    audience: "Cuenta activa con capacidad, disciplina de datos y una primera combinación ya validada.",
    trigger: `Existe señal estable de ${profile.result} y la operación cumple el SLA.`,
    offer: "Revisión de crecimiento basada en contribución, saturación, capacidad y aprendizaje transferible.",
    channels: ["Revisión mensual", "experimentos", "nueva zona", "nuevo subsegmento"],
    funnel: ["Resultado offline", "Cohorte por origen", "Cuello de botella", "Experimento limitado", "Escala o rollback"],
    qualification: ["La primera ruta deja contribución defendible.", "La empresa mantiene capacidad y velocidad de respuesta.", "Existe una sola variable de expansión y un rollback claro."],
    assets: ["Dashboard de resultado final", "Informe win/loss", "Backlog de experimentos", "Plan mutuo de expansión"],
    evidence: [profile.proof, "Comparación antes/después con ventana, fuente y limitaciones visibles."],
    guardrails: [profile.constraint, "No abrir una segunda vía para ocultar fallos del primer funnel."],
    northStar: "Contribución incremental con SLA y calidad estables.",
    decision: "Escalar una combinación cada vez; pausar si empeoran margen, calidad, capacidad o trazabilidad.",
    sprint: [
      { phase: "Días 1–3", objective: "Encontrar el límite", actions: ["Revisar cohortes.", "Localizar cuello de botella.", "Confirmar capacidad adicional."] },
      { phase: "Días 4–10", objective: "Diseñar expansión", actions: ["Elegir una variable.", "Fijar inversión y rollback.", "Aprobar medición y responsables."] },
      { phase: "Días 11–30", objective: "Escalar con control", actions: ["Lanzar experimento.", "Comparar contribución y calidad.", "Escalar, mantener o revertir."] },
    ],
  },
];

export const GROWTH_ROUTES: Record<string, GrowthRoute[]> = Object.fromEntries(
  Object.entries(PROFILES).map(([systemId, profile]) => [systemId, makeRoutes(systemId, profile)]),
);

export const ALL_GROWTH_ROUTES = Object.values(GROWTH_ROUTES).flat();

export const routeFitScore = (route: GrowthRoute, dimensions: Record<string, number>) => {
  const keys = ROUTE_KIND_META[route.kind].dimensions;
  return keys.reduce((sum, key) => sum + (dimensions[key] || 0), 0) / keys.length;
};
