export type DimensionKey = "demand" | "value" | "defensibility" | "speed" | "evidence";

export type NicheStrategy = {
  phase: "Ahora" | "Siguiente" | "Validar" | "Después";
  channel: string;
  salesCycle: string;
  dimensions: Record<DimensionKey, number>;
  economics: {
    media: number;
    cpl: number;
    valuePerSale: number;
    grossMarginPct: number;
    qualificationPct: number;
    showPct: number;
    closePct: number;
  };
  subsegments: Array<{ name: string; priority: "P1" | "P2" | "P3"; why: string; entry: string }>;
  validLead: string[];
  invalidLead: string[];
  tracking: string[];
  sla: Array<{ stage: string; target: string }>;
  risks: Array<{ risk: string; response: string }>;
  experiments: Array<{ title: string; hypothesis: string; pass: string; fail: string }>;
  launchGate: string[];
  decisionRule: string;
  killCriteria: string[];
};

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  demand: "Demanda",
  value: "Valor económico",
  defensibility: "Defendibilidad",
  speed: "Velocidad de aprendizaje",
  evidence: "Evidencia disponible",
};

export const STRATEGY: Record<string, NicheStrategy> = {
  legal: {
    phase: "Ahora",
    channel: "Google Search",
    salesCycle: "7–45 días",
    dimensions: { demand: 94, value: 91, defensibility: 82, speed: 78, evidence: 88 },
    economics: { media: 1400, cpl: 48, valuePerSale: 2200, grossMarginPct: 65, qualificationPct: 45, showPct: 70, closePct: 24 },
    subsegments: [
      { name: "Ley de Segunda Oportunidad", priority: "P1", why: "Dolor urgente, intención explícita y asunto fácil de clasificar antes de consulta.", entry: "Deuda, acreedores, ingresos, bienes y provincia." },
      { name: "Herencias bloqueadas o conflictivas", priority: "P2", why: "Ticket alto y problema concreto, aunque con ciclo más largo y mayor casuística.", entry: "Herederos, inmueble, testamento, conflicto y urgencia." },
      { name: "Divorcio contencioso", priority: "P2", why: "Mayor valor que mutuo acuerdo cuando existen hijos, patrimonio o medidas complejas.", entry: "Tipo de divorcio, hijos, bienes, medidas y provincia." },
      { name: "Divorcio de mutuo acuerdo", priority: "P3", why: "Volumen alto pero presión de precio y menor margen; sirve como producto secundario.", entry: "Acuerdo, hijos, bienes y disponibilidad de ambas partes." },
    ],
    validLead: ["Teléfono real y consentimiento.", "Especialidad y provincia dentro del alcance.", "Situación descrita con los mínimos de cualificación.", "Disponibilidad para consulta y voluntad de resolver."],
    invalidLead: ["Consulta académica o búsqueda de plantilla gratuita.", "Fuera de especialidad o territorio.", "Datos falsos, duplicado o no localizable tras protocolo.", "Exigencia de asesoramiento gratuito completo sin intención de contratar."],
    tracking: ["lead_created", "lead_validated", "contacted_under_5m", "appointment_booked", "appointment_attended", "matter_accepted", "matter_value"],
    sla: [
      { stage: "Primer intento", target: "< 5 min" },
      { stage: "Cadencia inicial", target: "6 intentos / 72 h" },
      { stage: "Confirmación", target: "24 h + 2 h antes" },
      { stage: "Resultado de consulta", target: "Mismo día" },
    ],
    risks: [
      { risk: "Mezclar tres ramas en una campaña", response: "Presupuesto, landing, negativas y conversión final separados por rama." },
      { risk: "Optimizar a formulario barato", response: "Importar consulta asistida y asunto aceptado como conversiones de valor." },
      { risk: "Promesa jurídica impropia", response: "Garantizar proceso, respuesta o reposición; nunca sentencia ni cancelación de deuda." },
    ],
    experiments: [
      { title: "Consulta directa vs precalificación", hypothesis: "Un filtro de 5–7 preguntas reduce citas inútiles sin hundir volumen.", pass: ">= 60% de citas válidas y caída de conversión < 25%.", fail: "Menos de 35% de formularios contactables o abandono excesivo." },
      { title: "Landing por problema", hypothesis: "Una landing específica por rama mejora calidad frente a una web genérica de despacho.", pass: "+20% en lead válido o -15% en coste por consulta asistida.", fail: "Sin mejora tras 150 clics cualificados." },
      { title: "Optimización a asunto aceptado", hypothesis: "La importación offline cambia la mezcla de búsquedas hacia asuntos rentables.", pass: "Mejora del CAC aceptado durante dos ciclos de conversión.", fail: "Volumen insuficiente para señal o datos sin disciplina." },
    ],
    launchGate: ["Una landing por rama.", "Definición firmada de asunto válido.", "Agenda y cobertura territorial confirmadas.", "CRM con resultado económico obligatorio.", "Consentimiento, aviso legal y política de privacidad revisados."],
    decisionRule: "Escalar Segunda Oportunidad cuando el CAC por asunto aceptado quede por debajo del margen objetivo durante cuatro semanas y el despacho mantenga el SLA.",
    killCriteria: ["Show rate < 45% tras corregir confirmación.", "Menos del 25% de contactos cumplen criterio jurídico.", "El despacho tarda > 30 minutos de forma recurrente.", "No se registra asunto aceptado y valor económico."],
  },
  toldos: {
    phase: "Siguiente",
    channel: "Google Search + Meta visual",
    salesCycle: "14–75 días",
    dimensions: { demand: 85, value: 88, defensibility: 84, speed: 81, evidence: 82 },
    economics: { media: 1000, cpl: 35, valuePerSale: 6500, grossMarginPct: 30, qualificationPct: 48, showPct: 76, closePct: 20 },
    subsegments: [
      { name: "Pérgolas bioclimáticas", priority: "P1", why: "Ticket alto, producto visual y margen suficiente para financiar captación.", entry: "Zona, medidas, tipo de espacio, propiedad, presupuesto y plazo." },
      { name: "Cerramientos y techos móviles", priority: "P1", why: "Proyecto técnico con alta intención y menor comparación por precio que un toldo simple.", entry: "Uso del espacio, medidas, material, permisos y visita." },
      { name: "Toldos motorizados premium", priority: "P2", why: "Volumen local y venta rápida cuando se evita el tramo low-cost.", entry: "Medidas, instalación, motorización y presupuesto." },
      { name: "Reparación y recambio", priority: "P3", why: "Puede llenar agenda pero diluye margen; campaña y horario separados.", entry: "Tipo de avería, marca, antigüedad y radio." },
    ],
    validLead: ["Propietario o decisor.", "Dentro del radio operativo.", "Proyecto identificable y presupuesto compatible.", "Acepta visita técnica en plazo razonable."],
    invalidLead: ["Bricolaje, recambio suelto o consulta de montaje.", "Fuera de zona.", "Presupuesto incompatible con el producto.", "Solo pide catálogo sin proyecto ni medidas."],
    tracking: ["lead_created", "project_validated", "visit_booked", "visit_attended", "quote_sent", "sale_won", "gross_margin"],
    sla: [
      { stage: "Primer contacto", target: "< 10 min" },
      { stage: "Visita", target: "< 72 h" },
      { stage: "Presupuesto", target: "< 48 h tras visita" },
      { stage: "Seguimiento", target: "Días 1, 3, 7 y 14" },
    ],
    risks: [
      { risk: "Competir por toldo barato", response: "Priorizar producto premium y usar ticket mínimo como filtro." },
      { risk: "Estacionalidad", response: "Crear demanda visual antes del pico y remarketing de proyectos largos." },
      { risk: "Galería genérica", response: "Casos reales por producto, zona y rango de inversión." },
    ],
    experiments: [
      { title: "Pérgola vs catálogo completo", hypothesis: "Una propuesta monoproducto mejora tasa de visita.", pass: "+20% en proyecto válido o visita.", fail: "Volumen insuficiente tras 200 clics de intención." },
      { title: "Presupuesto orientativo visible", hypothesis: "Mostrar rangos reduce curiosos sin destruir ventas.", pass: "+15% en visita→presupuesto y menos descartes económicos.", fail: "Caída > 40% de leads sin mejora de calidad." },
      { title: "Formulario con fotos", hypothesis: "Las fotos reducen desplazamientos inútiles.", pass: "Menos visitas descartadas y mayor velocidad de presupuesto.", fail: "Abandono móvil excesivo." },
    ],
    launchGate: ["20 obras reales bien clasificadas.", "Ticket mínimo por producto.", "Radio y capacidad semanal.", "Proceso de visita y presupuesto medido.", "Consentimiento para usar imágenes de instalaciones."],
    decisionRule: "Escalar por producto y municipio, no por provincia completa, cuando visita→presupuesto y presupuesto→venta sostengan el CAC objetivo.",
    killCriteria: ["Más del 50% de contactos son low-ticket.", "Visita→presupuesto < 60%.", "Presupuestos tardan más de 72 horas.", "No existe material visual real suficiente."],
  },
  coches: {
    phase: "Siguiente",
    channel: "Google Search",
    salesCycle: "1–14 días",
    dimensions: { demand: 83, value: 86, defensibility: 91, speed: 91, evidence: 92 },
    economics: { media: 1500, cpl: 38, valuePerSale: 1600, grossMarginPct: 100, qualificationPct: 42, showPct: 92, closePct: 24 },
    subsegments: [
      { name: "Vehículos averiados", priority: "P1", why: "Intención directa, urgencia y tasación relativamente estandarizable.", entry: "Marca, modelo, año, km, avería, ubicación y fotos." },
      { name: "Siniestros", priority: "P1", why: "Problema claro y decisión rápida cuando hay logística y valoración ágil.", entry: "Daños, aseguradora, documentación, ubicación y expectativa." },
      { name: "Cargas, embargo y reserva de dominio", priority: "P1", why: "Ventaja semántica y operativa propia de RedVitalia/WebSEO.", entry: "Tipo de carga, titularidad, deuda, documentación y provincia." },
      { name: "Exportación y stock profesional", priority: "P2", why: "Puede elevar volumen, pero requiere criterios de compra y logística distintos.", entry: "Lote, estado, documentación, ubicación y precio." },
    ],
    validLead: ["Propietario o representante acreditado.", "Vehículo localizable y documentado.", "Cumple criterios de compra definidos.", "Expectativa de precio abordable."],
    invalidLead: ["Consulta sobre reparación, multa o seguro.", "No es titular ni puede vender.", "Vehículo fuera de cobertura logística.", "Datos o fotos insuficientes tras requerimiento."],
    tracking: ["vehicle_submitted", "vehicle_qualified", "valuation_sent", "offer_made", "offer_accepted", "vehicle_collected", "gross_margin"],
    sla: [
      { stage: "Prevaloración", target: "< 15 min" },
      { stage: "Oferta", target: "< 2 h con documentación" },
      { stage: "Seguimiento", target: "Mismo día + 24 h" },
      { stage: "Recogida", target: "Según zona, confirmada por escrito" },
    ],
    risks: [
      { risk: "Criterios de compra cambiantes", response: "Matriz semanal de aceptación y exclusiones antes de tocar campañas." },
      { risk: "Optimizar a formulario", response: "Subir compra y margen por vehículo como valor offline." },
      { risk: "Expectativa de precio irreal", response: "Rango orientativo y preguntas de urgencia antes de llamada." },
    ],
    experiments: [
      { title: "Landing por problema", hypothesis: "Avería, siniestro y carga convierten mejor por separado.", pass: "+15% en vehículo valorable.", fail: "Sin diferencia tras 100 leads por categoría." },
      { title: "Fotos obligatorias", hypothesis: "Tres fotos mejoran precisión y cierre de oferta.", pass: "Menos rechazo tras tasación y menor tiempo de decisión.", fail: "Caída de volumen no compensada por calidad." },
      { title: "Puja por margen", hypothesis: "Importar margen desplaza inversión a vehículos más rentables.", pass: "Margen total sube con CAC estable.", fail: "Datos incompletos o señal demasiado escasa." },
    ],
    launchGate: ["Criterios de compra escritos.", "Liquidez y logística disponibles.", "Tasación en menos de dos horas.", "Eventos offline conectados.", "Proceso jurídico para cargas documentado."],
    decisionRule: "Escalar el problema y la provincia que produzcan margen neto incremental, aunque su CPL sea mayor.",
    killCriteria: ["Menos del 30% son valorables.", "Oferta tarda más de 4 horas.", "No se conoce margen por compra.", "Logística o caja impiden aceptar demanda."],
  },
  estetica: {
    phase: "Siguiente",
    channel: "Meta Ads + Google Search",
    salesCycle: "7–60 días",
    dimensions: { demand: 88, value: 86, defensibility: 76, speed: 84, evidence: 87 },
    economics: { media: 1800, cpl: 30, valuePerSale: 1400, grossMarginPct: 65, qualificationPct: 43, showPct: 66, closePct: 27 },
    subsegments: [
      { name: "Injerto capilar", priority: "P1", why: "Ticket alto, decisión investigada y fuerte capacidad de atribución.", entry: "Edad, situación, zona, disponibilidad y financiación." },
      { name: "Medicina estética facial", priority: "P1", why: "Alta demanda visual y recurrencia si se selecciona un tratamiento concreto.", entry: "Tratamiento, motivación, plazo y presupuesto." },
      { name: "Tratamientos corporales premium", priority: "P2", why: "Buen ticket, pero mayor riesgo de lead curioso y estacionalidad.", entry: "Objetivo, plazo, sesiones y capacidad económica." },
      { name: "Servicios low-ticket", priority: "P3", why: "Sirven para reactivación, no como punta de lanza de adquisición.", entry: "Cliente existente o campaña de base de datos." },
    ],
    validLead: ["Interés en tratamiento concreto.", "Zona, plazo y presupuesto compatibles.", "Acepta valoración clínica.", "Teléfono real y consentimiento."],
    invalidLead: ["Petición de diagnóstico por formulario.", "Tratamiento contraindicado determinado por clínica.", "Sin disponibilidad o fuera de radio.", "Busca empleo, formación o producto doméstico."],
    tracking: ["lead_created", "lead_qualified", "valuation_booked", "valuation_attended", "treatment_proposed", "treatment_sold", "revenue"],
    sla: [
      { stage: "WhatsApp/llamada", target: "< 5 min" },
      { stage: "Confirmación humana", target: "Mismo día" },
      { stage: "Recordatorios", target: "24 h + 3 h" },
      { stage: "Recuperación no-show", target: "< 30 min" },
    ],
    risks: [
      { risk: "Creatividad que incumple políticas", response: "Revisión médica y publicitaria; no atribuir defectos ni garantizar resultados." },
      { risk: "Clínica sin coordinador comercial", response: "No escalar hasta tener guion, seguimiento y registro de presupuestos." },
      { risk: "Lead barato de baja intención", response: "Optimizar a valoración asistida y tratamiento vendido." },
    ],
    experiments: [
      { title: "Tratamiento único", hypothesis: "Una campaña monoproducto mejora show y cierre.", pass: "+20% en valoración asistida.", fail: "Volumen insuficiente o agenda sin capacidad." },
      { title: "Precio/rango vs sin precio", hypothesis: "Un rango financiero filtra sin dañar la confianza.", pass: "Menor descarte económico con CPL asistido estable.", fail: "Caída > 35% sin mejora de venta." },
      { title: "Confirmación conversacional", hypothesis: "WhatsApp humano + automatización reduce no-show.", pass: "+10 puntos de show rate.", fail: "No mejora tras 50 citas." },
    ],
    launchGate: ["Tratamiento y capacidad semanal.", "Casos, reseñas y permisos de uso.", "Revisión de compliance.", "Coordinador y guion de valoración.", "Registro de venta e ingresos."],
    decisionRule: "Escalar solo el tratamiento que deja contribución positiva después de medios, fee y coste comercial, con show rate superior al 60%.",
    killCriteria: ["Show rate < 50% tras dos iteraciones.", "Valoración→venta < 12% sin causa corregible.", "Clínica no registra ventas.", "Creatividades dependen de promesas no aprobables."],
  },
  climatizacion: {
    phase: "Validar",
    channel: "Google Search + llamadas",
    salesCycle: "0–30 días",
    dimensions: { demand: 89, value: 82, defensibility: 78, speed: 92, evidence: 83 },
    economics: { media: 1200, cpl: 36, valuePerSale: 2800, grossMarginPct: 35, qualificationPct: 52, showPct: 78, closePct: 30 },
    subsegments: [
      { name: "Instalación y sustitución de aire", priority: "P1", why: "Intención alta y ticket defendible con disponibilidad técnica.", entry: "Tipo de inmueble, m², equipo actual, zona y plazo." },
      { name: "Aerotermia", priority: "P1", why: "Ticket alto y decisión consultiva; requiere landing y ciclo propios.", entry: "Vivienda, sistema actual, consumo, obra y financiación." },
      { name: "Reparación urgente", priority: "P2", why: "Aprendizaje rápido, pero margen y capacidad cambian por avería.", entry: "Marca, error, antigüedad, zona y disponibilidad." },
      { name: "Mantenimiento B2B", priority: "P2", why: "Recurrencia y LTV alto, aunque prospección y proceso comercial distintos.", entry: "Instalaciones, sedes, equipos y contrato actual." },
    ],
    validLead: ["Servicio y zona cubiertos.", "Decisor o propietario.", "Disponibilidad técnica real.", "Ticket mínimo o potencial de instalación."],
    invalidLead: ["Manual, pieza, mando o bricolaje.", "Fuera de horario/cobertura.", "Aviso inferior al ticket mínimo si no existe ruta.", "No permite visita o no es responsable del inmueble."],
    tracking: ["call_connected", "call_qualified", "visit_booked", "visit_attended", "quote_sent", "job_won", "job_value"],
    sla: [
      { stage: "Llamada", target: "Atención inmediata" },
      { stage: "Devolución perdida", target: "< 3 min" },
      { stage: "Visita urgente", target: "Según promesa geográfica" },
      { stage: "Presupuesto instalación", target: "< 24 h" },
    ],
    risks: [
      { risk: "Mezclar reparación e instalación", response: "Campañas, horarios, pujas y conversiones separadas." },
      { risk: "Demanda sin capacidad", response: "Control diario de zonas, franjas y servicios disponibles." },
      { risk: "Estacionalidad extrema", response: "Plan pretemporada y diversificación con aerotermia/mantenimiento." },
    ],
    experiments: [
      { title: "Call-only vs landing", hypothesis: "Urgencias convierten mejor por llamada; instalaciones necesitan formulario.", pass: "Cada flujo mejora su coste por trabajo válido.", fail: "Llamadas perdidas o baja calidad." },
      { title: "Horarios dinámicos", hypothesis: "Pausar cuando no atienden protege presupuesto y calidad.", pass: "Menos llamadas perdidas y mismo volumen cerrado.", fail: "Pérdida de demanda sin recuperación." },
      { title: "Importar ticket", hypothesis: "La puja por valor favorece instalaciones frente a avisos pequeños.", pass: "Ticket medio y margen suben.", fail: "Volumen de conversiones insuficiente." },
    ],
    launchGate: ["Servicios y ticket mínimo.", "Zonas y horarios reales.", "Grabación y clasificación de llamadas.", "Agenda de técnicos visible.", "Valor de trabajos importable."],
    decisionRule: "Escalar por servicio y franja cuando el coste por trabajo y la capacidad técnica estén equilibrados; no por CPL agregado.",
    killCriteria: ["Llamadas perdidas > 15%.", "Más del 45% bajo ticket mínimo.", "Visita→presupuesto < 60%.", "No hay control de capacidad diaria."],
  },
  reformas: {
    phase: "Validar",
    channel: "Google Search + Meta casos",
    salesCycle: "30–180 días",
    dimensions: { demand: 87, value: 94, defensibility: 80, speed: 64, evidence: 90 },
    economics: { media: 1800, cpl: 58, valuePerSale: 18000, grossMarginPct: 25, qualificationPct: 36, showPct: 78, closePct: 16 },
    subsegments: [
      { name: "Reforma integral", priority: "P1", why: "Ticket alto y suficientes búsquedas, con necesidad de filtro económico duro.", entry: "Zona, m², presupuesto, propiedad, alcance y fecha." },
      { name: "Cocinas premium", priority: "P1", why: "Producto visual y acotable con visita y rango de inversión.", entry: "Medidas, estilo, obra, electrodomésticos y presupuesto." },
      { name: "Baños completos", priority: "P2", why: "Ciclo más corto, pero hay que evitar reparaciones y trabajos mínimos.", entry: "Número de baños, alcance, materiales, zona y presupuesto." },
      { name: "Rehabilitación y comunidades", priority: "P2", why: "Ticket muy alto, venta B2B y ciclo largo; requiere funnel propio.", entry: "Tipo de edificio, decisores, urgencia, documentación y presupuesto." },
    ],
    validLead: ["Propietario o decisor.", "Presupuesto dentro del mínimo.", "Zona y tipo de obra aceptados.", "Plazo y visita posibles."],
    invalidLead: ["Pequeño arreglo o mano de obra suelta.", "Ideas, materiales o bricolaje.", "Sin presupuesto ni propiedad.", "Fuera de zona o capacidad."],
    tracking: ["project_submitted", "project_qualified", "site_visit", "quote_sent", "follow_up", "project_won", "gross_margin"],
    sla: [
      { stage: "Primer contacto", target: "< 10 min" },
      { stage: "Precalificación", target: "Mismo día" },
      { stage: "Visita", target: "< 5 días" },
      { stage: "Presupuesto", target: "Fecha comprometida y medible" },
    ],
    risks: [
      { risk: "Lead compartido disfrazado de oportunidad", response: "Activo propio, exclusividad y trazabilidad de origen." },
      { risk: "Presupuesto lento", response: "No escalar si la empresa no cumple fecha de entrega." },
      { risk: "Ciclo largo sin seguimiento", response: "Cadencia CRM de 30–90 días y causa de pérdida obligatoria." },
    ],
    experiments: [
      { title: "Presupuesto mínimo visible", hypothesis: "Un umbral reduce proyectos imposibles y protege visitas.", pass: "+20% en visita cualificada.", fail: "Volumen insuficiente sin mejora de venta." },
      { title: "Caso local por tipología", hypothesis: "Obra real con coste/plazo orientativo mejora confianza.", pass: "+15% en visita o presupuesto.", fail: "Sin diferencia después de muestra suficiente." },
      { title: "Seguimiento estructurado", hypothesis: "La mayoría del valor está después del presupuesto.", pass: "+10 puntos en presupuesto→obra.", fail: "Causas de pérdida dominadas por precio no defendible." },
    ],
    launchGate: ["Microvertical y ticket mínimo.", "Portfolio real y reseñas.", "Capacidad de visita.", "Plantilla de presupuesto y seguimiento.", "Márgenes y causas de pérdida registrados."],
    decisionRule: "Escalar cuando el coste por visita y la conversión a presupuesto produzcan un CAC de obra compatible con margen, no cuando baje el CPL.",
    killCriteria: ["Menos del 25% supera ticket mínimo.", "Visita→presupuesto < 65%.", "Presupuesto tarda más de lo prometido.", "No se conoce margen de obra."],
  },
  dental: {
    phase: "Validar",
    channel: "Google Search + Meta educación",
    salesCycle: "14–90 días",
    dimensions: { demand: 88, value: 91, defensibility: 72, speed: 76, evidence: 89 },
    economics: { media: 1600, cpl: 38, valuePerSale: 3200, grossMarginPct: 55, qualificationPct: 46, showPct: 66, closePct: 25 },
    subsegments: [
      { name: "Implantes", priority: "P1", why: "Intención clara, ticket alto y financiación como palanca comercial.", entry: "Necesidad, zona, urgencia, financiación y disponibilidad." },
      { name: "Rehabilitación completa", priority: "P1", why: "Mayor valor por caso, menor volumen y ciclo consultivo.", entry: "Situación, piezas, pruebas previas, presupuesto y plazo." },
      { name: "Ortodoncia invisible", priority: "P2", why: "Demanda alta y visual, pero fuerte comparación y sensibilidad al precio.", entry: "Edad, objetivo, tratamiento previo y financiación." },
      { name: "Higiene y revisión", priority: "P3", why: "No justifica adquisición fría salvo estrategia de LTV probada.", entry: "Reactivación de base, referidos o cross-sell." },
    ],
    validLead: ["Tratamiento concreto.", "Zona y financiación compatibles.", "Acepta primera visita.", "Consentimiento y teléfono válidos."],
    invalidLead: ["Consulta clínica urgente que requiere derivación.", "Busca formación, empleo o material.", "Solo precio sin disponibilidad ni situación.", "Fuera de zona o tratamiento."],
    tracking: ["lead_created", "lead_qualified", "first_visit_booked", "first_visit_attended", "treatment_plan", "treatment_accepted", "revenue"],
    sla: [
      { stage: "Contacto", target: "< 5 min" },
      { stage: "Confirmación", target: "Conversación real el mismo día" },
      { stage: "No-show", target: "Recuperación < 30 min" },
      { stage: "Plan no aceptado", target: "Seguimiento 1, 3, 7 y 21 días" },
    ],
    risks: [
      { risk: "Medir solo primera visita", response: "Cerrar el bucle hasta plan aceptado e ingreso." },
      { risk: "Recepción sin guion", response: "Mystery calls, grabaciones y entrenamiento antes de escalar." },
      { risk: "Oferta basada solo en descuento", response: "Financiación, autoridad, prueba y proceso clínico." },
    ],
    experiments: [
      { title: "Implantes por intención", hypothesis: "Separar urgencia, precio y solución completa mejora calidad.", pass: "Mejor coste por visita asistida y plan.", fail: "Consultas dominadas por precio sin cierre." },
      { title: "WhatsApp de coordinador", hypothesis: "Contacto personal reduce no-show.", pass: "+10 puntos de show.", fail: "Sin mejora tras 50 citas." },
      { title: "Optimización a plan aceptado", hypothesis: "El valor offline corrige el sesgo de lead barato.", pass: "CAC de tratamiento baja o ticket sube.", fail: "Datos incompletos." },
    ],
    launchGate: ["Tratamiento y huecos disponibles.", "Coordinador responsable.", "Financiación y argumentario.", "Eventos hasta plan aceptado.", "Compliance y consentimiento."],
    decisionRule: "Escalar el tratamiento que produce margen neto y show superior al 60%; no abrir un segundo hasta estabilizar el primero.",
    killCriteria: ["Show < 50%.", "Visita→plan < 60%.", "Plan→aceptación < 12% sin causa corregible.", "No se registra ingreso por tratamiento."],
  },
  inmobiliario: {
    phase: "Después",
    channel: "Meta Ads + Google Search",
    salesCycle: "30–270 días",
    dimensions: { demand: 84, value: 93, defensibility: 66, speed: 58, evidence: 93 },
    economics: { media: 2000, cpl: 48, valuePerSale: 6000, grossMarginPct: 70, qualificationPct: 36, showPct: 65, closePct: 11 },
    subsegments: [
      { name: "Propietario con venta < 90 días", priority: "P1", why: "Intención y plazo permiten medir valoración y exclusiva.", entry: "Titularidad, zona, inmueble, motivo, plazo y precio." },
      { name: "Herencia inmobiliaria", priority: "P1", why: "Dolor específico y posible cruce con legal, aunque requiere maduración.", entry: "Herederos, estado, cargas, zona y decisión." },
      { name: "Divorcio y disolución", priority: "P2", why: "Problema concreto, sensibilidad alta y varios decisores.", entry: "Titularidad, acuerdo, ocupación, cargas y plazo." },
      { name: "Valoración exploratoria", priority: "P3", why: "Nutrición de largo plazo; no debe contaminar el KPI de oportunidad inmediata.", entry: "Motivo, horizonte, inmueble y canal de seguimiento." },
    ],
    validLead: ["Titular o representante.", "Inmueble dentro de zona.", "Motivo y plazo conocidos.", "Acepta conversación o valoración."],
    invalidLead: ["Comprador o alquiler.", "No es titular ni tiene autorización.", "Tasación oficial gratuita sin intención.", "Fuera de zona o tipo de inmueble."],
    tracking: ["owner_lead", "owner_validated", "valuation_booked", "valuation_attended", "mandate_proposed", "exclusive_signed", "commission"],
    sla: [
      { stage: "Primer contacto", target: "< 5 min" },
      { stage: "Valoración", target: "< 72 h" },
      { stage: "Nutrición", target: "Cadencia según plazo 30/90/180 días" },
      { stage: "Resultado", target: "Motivo obligatorio" },
    ],
    risks: [
      { risk: "Mercado saturado de promesas", response: "Diferenciar por zona, cita asistida y dato económico real." },
      { risk: "Maduración larga", response: "Pipeline por horizonte y automatización de seguimiento." },
      { risk: "Confundir propietario con exclusiva", response: "No garantizar firma; medir hitos separados." },
    ],
    experiments: [
      { title: "Venta urgente vs valoración", hypothesis: "El problema específico genera menos volumen y más intención.", pass: "Mayor tasa de cita y valoración.", fail: "Volumen insuficiente o CPL prohibitivo." },
      { title: "Zona hiperlocal", hypothesis: "Prueba y autoridad de barrio mejoran confianza.", pass: "+20% en valoración asistida.", fail: "Mercado demasiado pequeño." },
      { title: "Nutrición por plazo", hypothesis: "Separar 0–90, 90–180 y 180+ días recupera valor.", pass: "Aumentan citas de leads antiguos.", fail: "Base sin consentimiento o seguimiento inconsistente." },
    ],
    launchGate: ["Zona pequeña y defendible.", "Propuesta de valoración.", "CRM por horizonte.", "Proceso de cita y seguimiento.", "Valor de exclusiva/comisión registrado."],
    decisionRule: "Escalar cuando el CAC por valoración y la conversión a exclusiva sostengan la economía; ignorar el CPL como métrica principal.",
    killCriteria: ["Menos del 25% son titulares válidos.", "Show < 50%.", "Valoración→propuesta < 60%.", "La agencia no trabaja nutrición."],
  },
  auditivos: {
    phase: "Después",
    channel: "Google Search + llamada",
    salesCycle: "7–60 días",
    dimensions: { demand: 67, value: 78, defensibility: 88, speed: 72, evidence: 58 },
    economics: { media: 900, cpl: 36, valuePerSale: 1900, grossMarginPct: 50, qualificationPct: 46, showPct: 72, closePct: 25 },
    subsegments: [
      { name: "Prueba auditiva y audífonos", priority: "P1", why: "Producto de ticket alto, decisión familiar y demanda local medible.", entry: "Necesidad, edad, zona, acompañante, financiación y disponibilidad." },
      { name: "Movilidad y sillas", priority: "P2", why: "Problema urgente, catálogo amplio y posibilidad de visita.", entry: "Usuario, movilidad, entorno, medidas, zona y presupuesto." },
      { name: "Camas articuladas", priority: "P2", why: "Ticket defendible y decisión del cuidador, con búsquedas muy específicas.", entry: "Necesidad, medidas, entrega, instalación y financiación." },
      { name: "Productos pequeños", priority: "P3", why: "Bajo margen para adquisición fría; solo cross-sell o SEO." },
    ],
    validLead: ["Necesidad y usuario identificados.", "Zona y producto cubiertos.", "Acepta prueba, visita o valoración.", "Decisor o familiar participa."],
    invalidLead: ["Manual, reparación o segunda mano.", "Busca subvención sin intención de compra.", "Producto low-ticket fuera de estrategia.", "Fuera de zona."],
    tracking: ["lead_created", "need_validated", "appointment_booked", "appointment_attended", "trial_or_quote", "sale_won", "sale_value"],
    sla: [
      { stage: "Contacto", target: "< 10 min" },
      { stage: "Cita", target: "< 72 h" },
      { stage: "Recordatorio", target: "24 h + 3 h" },
      { stage: "Seguimiento familiar", target: "1, 3, 7 y 21 días" },
    ],
    risks: [
      { risk: "Volumen local insuficiente", response: "Validar por ciudad antes de construir activos completos." },
      { risk: "Dos negocios distintos", response: "Audición y ortopedia jamás comparten funnel ni mensajes." },
      { risk: "Usuario y decisor no coinciden", response: "Incluir familiar/cuidador en cualificación y seguimiento." },
    ],
    experiments: [
      { title: "Ciudad única", hypothesis: "Una ciudad con demanda suficiente permite producto especializado.", pass: ">= 25 leads/mes con calidad viable.", fail: "Menos de 10 oportunidades mensuales a CPC razonable." },
      { title: "Llamada vs formulario", hypothesis: "Personas mayores convierten mejor con llamada visible.", pass: "Más citas válidas con mismo coste.", fail: "Llamadas no atendidas o no clasificadas." },
      { title: "Mensaje al cuidador", hypothesis: "El decisor familiar responde mejor a seguridad y acompañamiento.", pass: "+15% en cita asistida.", fail: "Sin mejora tras muestra suficiente." },
    ],
    launchGate: ["Keyword Planner por ciudad.", "Producto y ticket prioritarios.", "Atención telefónica adaptada.", "Agenda y financiación.", "Familia/cuidador en el proceso."],
    decisionRule: "Solo convertirlo en vertical estable cuando una ciudad demuestre volumen, margen y cita asistida; antes es experimento.",
    killCriteria: ["Menos de 15 leads válidos/mes.", "Cita asistida < 55%.", "Ticket medio insuficiente.", "El centro no involucra al decisor real."],
  },
  logistica: {
    phase: "Después",
    channel: "Google Search",
    salesCycle: "0–21 días",
    dimensions: { demand: 79, value: 68, defensibility: 81, speed: 95, evidence: 74 },
    economics: { media: 800, cpl: 28, valuePerSale: 650, grossMarginPct: 35, qualificationPct: 56, showPct: 88, closePct: 34 },
    subsegments: [
      { name: "Contenedores de obra", priority: "P1", why: "Necesidad inmediata, zona clara y presupuesto rápido.", entry: "Tipo, volumen, dirección, fecha, permisos y duración." },
      { name: "Mudanzas completas", priority: "P1", why: "Volumen local, urgencia y cierre rápido cuando se filtran accesos.", entry: "Origen, destino, fecha, volumen, plantas y ascensor." },
      { name: "Guardamuebles", priority: "P2", why: "Recurrencia potencial y cruce con mudanzas, pero economía distinta.", entry: "Volumen, duración, acceso y seguro." },
      { name: "Pequeños portes", priority: "P3", why: "Alta demanda y bajo margen; campaña separada o descartada." },
    ],
    validLead: ["Servicio, fecha y ubicaciones definidos.", "Dentro de zona y capacidad.", "Volumen y accesos conocidos.", "Teléfono válido y decisor."],
    invalidLead: ["Empleo, alquiler de vehículo o punto limpio.", "Fuera de zona.", "Servicio por debajo del mínimo.", "Sin fecha ni información mínima."],
    tracking: ["quote_request", "request_validated", "quote_sent", "quote_accepted", "booking_paid", "job_completed", "job_value"],
    sla: [
      { stage: "Contacto", target: "< 3 min" },
      { stage: "Presupuesto simple", target: "< 15 min" },
      { stage: "Presupuesto complejo", target: "Mismo día" },
      { stage: "Seguimiento", target: "Antes de 2 h y 24 h" },
    ],
    risks: [
      { risk: "Techo de fee", response: "Producto muy estandarizado y operación eficiente." },
      { risk: "Capacidad cambiante", response: "Disponibilidad diaria conectada con campañas." },
      { risk: "Competencia por precio", response: "Velocidad, cobertura, seguro y claridad del presupuesto." },
    ],
    experiments: [
      { title: "Presupuesto instantáneo", hypothesis: "Campos estructurados reducen tiempo y mejoran cierre.", pass: "Tiempo < 15 min y +10 puntos de cierre.", fail: "Errores de alcance o precio." },
      { title: "Campaña por fecha", hypothesis: "Priorizar urgencias dentro de capacidad mejora ocupación.", pass: "Más reservas rentables sin sobreventa.", fail: "Operación no actualiza disponibilidad." },
      { title: "Llamada inmediata", hypothesis: "La primera empresa en presupuestar gana.", pass: "Mejora quote→booking.", fail: "Sin diferencia por presión de precio." },
    ],
    launchGate: ["Servicios y mínimos.", "Zonas y capacidad.", "Plantilla de presupuesto.", "Respuesta en minutos.", "Reserva y valor registrados."],
    decisionRule: "Escalar solo si la automatización mantiene bajo el coste operativo y la reserva deja margen después de medios y fee.",
    killCriteria: ["Tiempo a presupuesto > 30 min.", "Más del 40% bajo mínimo.", "Presupuesto→reserva < 20%.", "Capacidad no se actualiza."],
  },
};
