export type EvidenceLevel = "Dato real" | "Dato del mercado" | "Hipótesis" | "Pendiente de validar";
export type CampaignMode = "B2B" | "B2C";

export { PRICING, PRICING_SOURCE } from "./pricing.ts";

export type CaptureUnit = {
  id: string;
  systemId: string;
  system: string;
  name: string;
  phase: "Ahora" | "Siguiente" | "Validar" | "Después";
  channel: string;
  image: string;
  problem: string;
  result: string;
  decisionMaker: string;
  endUser: string;
  offer: string;
  landing: string;
  primaryConversion: string;
  qualification: string[];
  rejection: string[];
  subniches: string[];
  compliance: string;
  creativeRoutes: Array<{ name: string; direction: string }>;
};

export const CAPTURE_UNITS: CaptureUnit[] = [
  {
    id: "segunda-oportunidad", systemId: "legal", system: "Sistema jurídico", name: "Ley de Segunda Oportunidad", phase: "Ahora", channel: "Google Search",
    image: "/assets/ejecucion/base/legal-segunda-oportunidad.webp",
    problem: "Personas con deuda que necesitan saber si su caso merece revisión jurídica sin prometer exoneración.", result: "Consulta efectiva y asunto aceptado por el despacho.",
    decisionMaker: "Socio director o responsable de desarrollo de negocio del despacho.", endUser: "Persona adulta con deuda, varios acreedores o procedimientos abiertos.",
    offer: "Sistema de captación y seguimiento por especialidad, con cualificación previa y devolución de resultado al CRM.", landing: "/landings/segunda-oportunidad", primaryConversion: "asunto_aceptado_segunda_oportunidad",
    qualification: ["Deuda total aproximada", "Número y tipo de acreedores", "Ingresos y situación laboral", "Bienes y vivienda", "Embargos o procedimientos abiertos", "Provincia, urgencia y modalidad de atención", "Capacidad para una consulta profesional"],
    rejection: ["Promesa de cancelación garantizada", "Consulta académica", "Datos falsos o teléfono inválido", "Fuera de territorio o especialidad", "Sin legitimidad para consultar"],
    subniches: ["Deuda financiera", "Deuda pública", "Autónomos", "Embargos activos", "Procedimientos concursales"],
    compliance: "Información general y precalificación; nunca afirmar que cumple requisitos ni garantizar resultado judicial.",
    creativeRoutes: [{ name: "Claridad financiera", direction: "Documentos ordenados, jerarquía numérica y siguiente paso." }, { name: "Proceso jurídico", direction: "Mapa visual sobrio de revisión, consulta y decisión." }, { name: "Humana sin miedo", direction: "Conversación calmada, sin dramatizar ni explotar vulnerabilidad." }],
  },
  {
    id: "herencias", systemId: "legal", system: "Sistema jurídico", name: "Herencias", phase: "Siguiente", channel: "Google Search",
    image: "/assets/ejecucion/base/legal-herencias.webp",
    problem: "Herencias bloqueadas, conflictivas o con inmuebles y deudas que requieren una ruta jurídica concreta.", result: "Consulta efectiva y asunto de herencia aceptado.",
    decisionMaker: "Socio director o abogado responsable de sucesiones.", endUser: "Heredero, legitimario o persona con interés acreditable en la sucesión.",
    offer: "Funnel separado por conflicto, inmueble, deuda e internacional, con agenda y seguimiento de ciclos largos.", landing: "/landings/herencias", primaryConversion: "asunto_aceptado_herencias",
    qualification: ["Relación con la herencia", "Número de herederos", "Testamento o ausencia", "Inmuebles y deudas", "Tipo de conflicto", "Provincia o elemento internacional", "Urgencia y procedimiento abierto"],
    rejection: ["Sin legitimidad", "Búsqueda de modelo gratuito", "Fuera de jurisdicción", "Datos incompletos tras contacto", "Conflicto no atendido por el despacho"],
    subniches: ["Herencia bloqueada", "Conflicto entre herederos", "División o venta de inmueble", "Impugnación y legítima", "Renuncia o herencia con deudas", "Herencia internacional", "Sin testamento"],
    compliance: "No anticipar adjudicación, plazos ni resultado; separar información inicial del asesoramiento jurídico.",
    creativeRoutes: [{ name: "Mapa patrimonial", direction: "Inmueble, partes y decisiones representadas con orden visual." }, { name: "Mediación práctica", direction: "Tensión contenida y proceso para desbloquear información." }, { name: "Autoridad documental", direction: "Expediente, hitos y preguntas que preparan la consulta." }],
  },
  {
    id: "divorcios", systemId: "legal", system: "Sistema jurídico", name: "Divorcios", phase: "Siguiente", channel: "Google Search",
    image: "/assets/ejecucion/base/legal-divorcios.webp",
    problem: "Separaciones de mutuo acuerdo o contenciosas con hijos, vivienda, patrimonio o medidas.", result: "Consulta efectiva y asunto de familia aceptado.",
    decisionMaker: "Socio director o responsable del área de familia.", endUser: "Cónyuge que busca una revisión profesional de su situación.",
    offer: "Captación separada para mutuo acuerdo, contencioso y modificación de medidas, con mensajes y economía propios.", landing: "/landings/divorcios", primaryConversion: "asunto_aceptado_divorcios",
    qualification: ["Mutuo acuerdo o contencioso", "Hijos y custodia", "Pensiones", "Vivienda y patrimonio", "Empresa familiar", "Medidas provisionales o modificación", "Provincia y urgencia"],
    rejection: ["Amenazas o uso del formulario para hostigar", "Sin legitimidad", "Fuera de territorio", "Consulta informativa sin intención", "Especialidad no cubierta"],
    subniches: ["Mutuo acuerdo", "Contencioso", "Custodia y pensiones", "Patrimonio y vivienda", "Empresa familiar", "Medidas provisionales", "Modificación de medidas"],
    compliance: "No prometer custodia, pensión, plazo ni sentencia; no usar a menores ni miedo como recurso creativo.",
    creativeRoutes: [{ name: "Decidir con orden", direction: "Dos caminos claros y una consulta para elegir el adecuado." }, { name: "Protección práctica", direction: "Hitos patrimoniales y familiares sin dramatización." }, { name: "Nuevo marco", direction: "Tono sereno centrado en acuerdos y próximos pasos." }],
  },
  {
    id: "toldos", systemId: "toldos", system: "Toldos, pérgolas y cerramientos", name: "Pérgolas, cerramientos y toldos premium", phase: "Siguiente", channel: "Google Search + Meta",
    image: "/assets/ejecucion/base/toldos.webp", problem: "Empresas con buen producto pero agenda irregular y demasiada consulta de bajo valor.", result: "Visita técnica efectiva para proyecto dentro de ticket y zona.", decisionMaker: "Gerencia o dirección comercial del instalador.", endUser: "Propietario o decisor con espacio, presupuesto y plazo de instalación.", offer: "Sistema local por producto de alto valor, con fotos, medidas y visita cualificada.", landing: "/landings/pergolas", primaryConversion: "visita_efectiva_pergolas",
    qualification: ["Propiedad y tipo de espacio", "Producto", "Medidas aproximadas", "Zona", "Rango de inversión", "Plazo", "Disponibilidad para visita"], rejection: ["Repuesto o bricolaje", "Fuera de zona", "Presupuesto incompatible", "Solo catálogo", "Sin capacidad semanal"], subniches: ["Pérgolas bioclimáticas", "Cerramientos", "Techos móviles", "Toldos motorizados"], compliance: "No inventar precio cerrado ni plazo; usar solo obras autorizadas como prueba.", creativeRoutes: [{ name: "Transformación arquitectónica", direction: "Espacio y sombra como cambio tangible, sin falso antes/después." }, { name: "Ingeniería visible", direction: "Detalle de lamas, instalación y proceso técnico." }, { name: "Vida exterior", direction: "Uso real del espacio con aspiración contenida." }],
  },
  {
    id: "coches", systemId: "coches", system: "Compra de vehículos problemáticos", name: "Coches con cargas, avería o siniestro", phase: "Siguiente", channel: "Google Search",
    image: "/assets/ejecucion/base/coches.webp", problem: "Propietarios que necesitan saber si una venta es viable pese a la carga, deuda o estado del vehículo.", result: "Vehículo valorable con oferta emitida y margen registrado.", decisionMaker: "Dirección de compras o gerente con liquidez y logística.", endUser: "Propietario o representante acreditado que quiere vender.", offer: "Silos por reserva, embargo, financiado, avería y siniestro; valoración y eventos offline por margen.", landing: "/landings/vender-coche-con-cargas", primaryConversion: "oferta_emitida_vehiculo",
    qualification: ["Marca, modelo, año y kilómetros", "Provincia", "Titularidad", "Tipo de carga o avería", "Deuda aproximada", "Fotos", "Expectativa y urgencia"], rejection: ["Quiere comprar en subasta", "No es titular", "Busca asesoría sin vender", "Fuera de cobertura", "Sin documentación", "Expectativa inviable"], subniches: ["Reserva de dominio", "Embargo o precinto", "Financiado pendiente", "Averiado", "Siniestro", "Exportación"], compliance: "Diferenciar tasación, oferta y compra. No garantizar valoración ni compra inmediata.", creativeRoutes: [{ name: "Diagnóstico de carga", direction: "Documentación, vehículo y viabilidad antes de ofertar." }, { name: "Oferta transparente", direction: "Explicar qué se descuenta y qué falta por comprobar." }, { name: "Proceso de recogida", direction: "Pasos operativos, propiedad y documentación sin promesas." }],
  },
  {
    id: "estetica", systemId: "estetica", system: "Clínicas estéticas y capilares", name: "Tratamientos estéticos y capilares de alto valor", phase: "Siguiente", channel: "Meta + Google Search",
    image: "/assets/ejecucion/base/estetica.webp", problem: "Clínicas con leads baratos pero poca asistencia, seguimiento o venta registrada.", result: "Valoración clínica asistida y tratamiento vendido.", decisionMaker: "Gerencia o dirección de clínica con coordinador comercial.", endUser: "Adulto interesado en un tratamiento concreto y una valoración profesional.", offer: "Sistema monoproducto con compliance, confirmación humana y retorno de venta.", landing: "/landings/valoracion-estetica", primaryConversion: "tratamiento_vendido",
    qualification: ["Tratamiento de interés", "Zona", "Plazo", "Disponibilidad", "Rango de inversión o financiación", "Primera valoración"], rejection: ["Busca diagnóstico online", "Fuera de zona", "Sin capacidad económica mínima", "Tratamiento no ofrecido", "Clínica sin seguimiento"], subniches: ["Injerto capilar", "Medicina estética facial", "Tratamientos corporales premium", "Reactivación"], compliance: "No diagnosticar, avergonzar ni garantizar resultados; revisar claims y uso de antes/después.", creativeRoutes: [{ name: "Consulta informada", direction: "Profesional y paciente comparan opciones sin señalar defectos." }, { name: "Tecnología clínica", direction: "Proceso y equipamiento con claims prudentes." }, { name: "Confianza humana", direction: "Escucha, privacidad y decisión sin presión." }],
  },
  {
    id: "climatizacion", systemId: "climatizacion", system: "Climatización y aerotermia", name: "Instalación, sustitución y aerotermia", phase: "Validar", channel: "Google Search",
    image: "/assets/ejecucion/base/climatizacion.webp", problem: "Demanda estacional que se desperdicia por llamadas perdidas, mezcla de servicios y falta de capacidad visible.", result: "Visita técnica o trabajo válido con valor registrado.", decisionMaker: "Gerencia o responsable de operaciones.", endUser: "Propietario o decisor con una instalación, sustitución o avería concreta.", offer: "Campañas por servicio, zona y franja, sincronizadas con capacidad diaria.", landing: "/landings/aerotermia", primaryConversion: "trabajo_valido_climatizacion",
    qualification: ["Tipo de inmueble", "Servicio", "Metros cuadrados", "Equipo actual", "Zona", "Plazo", "Disponibilidad"], rejection: ["Pieza, mando o bricolaje", "Fuera de horario o zona", "Bajo ticket sin ruta", "Sin acceso o legitimidad"], subniches: ["Instalación de aire", "Sustitución", "Aerotermia", "Reparación urgente", "Mantenimiento B2B"], compliance: "No prometer ahorro ni plazo sin cálculo y capacidad; diferenciar reparación e instalación.", creativeRoutes: [{ name: "Confort medible", direction: "Problema térmico y consulta técnica con datos." }, { name: "Instalación profesional", direction: "Proceso, orden y equipo real." }, { name: "Eficiencia sin humo", direction: "Explicación prudente de consumo y adecuación." }],
  },
  {
    id: "reformas", systemId: "reformas", system: "Reformas de alto valor", name: "Reforma integral, cocina y rehabilitación", phase: "Validar", channel: "Google Search + Meta",
    image: "/assets/ejecucion/base/reformas.webp", problem: "Empresas que pierden visitas en proyectos pequeños, presupuestos lentos y seguimientos largos.", result: "Visita cualificada, presupuesto emitido y obra ganada con margen.", decisionMaker: "Gerencia o dirección comercial de la reformista.", endUser: "Propietario o decisor con alcance, presupuesto y plazo compatibles.", offer: "Funnel de proyecto con umbral económico, portfolio real y seguimiento de 90 días.", landing: "/landings/reforma-integral", primaryConversion: "obra_ganada",
    qualification: ["Propiedad", "Zona", "Metros", "Alcance", "Presupuesto", "Plazo", "Disponibilidad para visita"], rejection: ["Pequeño arreglo", "Bricolaje", "Sin presupuesto", "Fuera de zona", "Empresa sin capacidad de presupuestar"], subniches: ["Reforma integral", "Cocinas premium", "Baños completos", "Rehabilitación", "Comunidades"], compliance: "No usar trabajos ajenos ni prometer fecha o precio sin visita.", creativeRoutes: [{ name: "Proyecto transparente", direction: "Planos, hitos y decisiones antes de obra." }, { name: "Detalle constructivo", direction: "Material y oficio como prueba visual." }, { name: "Espacio bien pensado", direction: "Aspiración apoyada en proceso, no en render ficticio." }],
  },
  {
    id: "dental", systemId: "dental", system: "Clínicas dentales", name: "Implantes, rehabilitación y ortodoncia", phase: "Validar", channel: "Google Search + Meta",
    image: "/assets/ejecucion/base/dental.webp", problem: "Clínicas con valoraciones no asistidas y ventas que no regresan a la campaña.", result: "Primera visita asistida y tratamiento aceptado.", decisionMaker: "Gerencia, propietario o responsable de tratamientos.", endUser: "Adulto interesado en un tratamiento concreto y financiación compatible.", offer: "Sistema por tratamiento con coordinación, no-show y conversiones offline.", landing: "/landings/implantes", primaryConversion: "tratamiento_aceptado_dental",
    qualification: ["Tratamiento", "Zona", "Necesidad y plazo", "Financiación", "Disponibilidad", "Primera visita"], rejection: ["Urgencia no atendida", "Diagnóstico por formulario", "Fuera de zona", "Servicio no ofrecido", "Clínica sin coordinador"], subniches: ["Implantes", "Rehabilitación completa", "Ortodoncia invisible", "Reactivación"], compliance: "No diagnosticar, no garantizar resultado y no explotar atributos personales o dolor.", creativeRoutes: [{ name: "Plan de tratamiento", direction: "Consulta y visualización clínica sin prometer desenlace." }, { name: "Financiación clara", direction: "Accesibilidad económica sin descuentos inventados." }, { name: "Primera visita humana", direction: "Escucha y siguiente paso, sin primeros planos invasivos." }],
  },
  {
    id: "inmobiliario", systemId: "inmobiliario", system: "Captación de propietarios", name: "Propietarios para inmobiliarias", phase: "Validar", channel: "Google Search + Meta",
    image: "/assets/ejecucion/base/inmobiliario.webp", problem: "Agencias con formularios de tasación llenos de curiosos y seguimiento sin exclusividad ni motivo de pérdida.", result: "Visita de captación efectiva y encargo firmado.", decisionMaker: "Gerencia o director de oficina inmobiliaria.", endUser: "Propietario con intención, autoridad y horizonte de venta.", offer: "Captación hiperlocal con valoración documentada, nurturing y retorno de encargo.", landing: "/landings/vender-vivienda", primaryConversion: "encargo_firmado",
    qualification: ["Propiedad y legitimidad", "Dirección aproximada", "Tipología", "Motivo y plazo", "Situación de ocupación", "Expectativa", "Disponibilidad para visita"], rejection: ["No propietario", "Busca alquiler o compra", "Tasación oficial no disponible", "Fuera de zona", "Sin intención temporal"], subniches: ["Venta inmediata", "Herencia", "Cambio de vivienda", "Inversor", "Divorcio", "Vivienda vacía"], compliance: "No discriminar, fingir compradores ni garantizar precio o plazo de venta.", creativeRoutes: [{ name: "Valoración transparente", direction: "Datos y visita sin llamarla tasación oficial." }, { name: "Plan de venta local", direction: "Ruta por barrio y tipo de vivienda." }, { name: "Decisión del propietario", direction: "Control, calendario y expectativas realistas." }],
  },
  {
    id: "auditivos", systemId: "auditivos", system: "Centros auditivos y ortopedias", name: "Audición, movilidad y adaptación", phase: "Después", channel: "Google Search + Meta",
    image: "/assets/ejecucion/base/auditivos.webp", problem: "Centros locales con leads sensibles, baja asistencia y mezcla de necesidades clínicas distintas.", result: "Valoración asistida y solución propuesta con seguimiento.", decisionMaker: "Gerencia o dirección del centro.", endUser: "Adulto o familiar que solicita una valoración profesional.", offer: "Funnel accesible, local y prudente con recordatorios y privacidad.", landing: "/landings/valoracion-auditiva", primaryConversion: "solucion_propuesta_auditiva",
    qualification: ["Motivo de consulta", "Zona", "Disponibilidad", "Valoración previa", "Quién decide", "Movilidad o accesibilidad", "Consentimiento"], rejection: ["Diagnóstico online", "Urgencia médica", "Fuera de zona", "Producto no ofrecido", "Datos del tercero sin consentimiento"], subniches: ["Valoración auditiva", "Audífonos", "Ortopedia técnica", "Movilidad", "Reactivación"], compliance: "No diagnosticar ni prometer mejora; cuidar consentimiento y representación digna.", creativeRoutes: [{ name: "Conversación recuperada", direction: "Vida cotidiana sin dramatizar discapacidad." }, { name: "Evaluación profesional", direction: "Proceso clínico y explicación comprensible." }, { name: "Acompañamiento familiar", direction: "Decisión compartida con consentimiento y respeto." }],
  },
  {
    id: "logistica", systemId: "logistica", system: "Contenedores, mudanzas y guardamuebles", name: "Mudanza, almacenaje y contenedor", phase: "Después", channel: "Google Search",
    image: "/assets/ejecucion/base/logistica.webp", problem: "Operadores con demanda urgente mal clasificada, rutas poco rentables y presupuestos que llegan tarde.", result: "Servicio viable presupuestado y reservado.", decisionMaker: "Gerencia o responsable de operaciones.", endUser: "Particular o empresa con origen, destino, volumen y fecha definidos.", offer: "Captación por intención, volumen y ruta, conectada con capacidad y presupuesto rápido.", landing: "/landings/mudanzas", primaryConversion: "servicio_reservado_logistica",
    qualification: ["Origen y destino", "Fecha", "Tipo de servicio", "Volumen", "Plantas y ascensor", "Necesidad de almacenaje", "Accesos"], rejection: ["Ruta no cubierta", "Fecha sin capacidad", "Consulta de empleo", "Volumen no rentable", "Mercancía no admitida"], subniches: ["Mudanza local", "Mudanza nacional", "Guardamuebles", "Contenedor", "Vaciado", "B2B"], compliance: "No prometer fecha ni precio sin inventario, accesos y capacidad real.", creativeRoutes: [{ name: "Inventario claro", direction: "Volumen, ruta y fecha como ejes de decisión." }, { name: "Operación segura", direction: "Equipo, protección y trazabilidad visual." }, { name: "Menos fricción", direction: "Orden y almacenamiento para reducir estrés real." }],
  },
];

export const SYSTEMS = [
  { id: "legal", name: "Sistema jurídico", rank: 1, phase: "Ahora", units: ["segunda-oportunidad", "herencias", "divorcios"], score: 88 },
  { id: "toldos", name: "Toldos, pérgolas y cerramientos", rank: 2, phase: "Siguiente", units: ["toldos"], score: 84 },
  { id: "coches", name: "Compra de vehículos problemáticos", rank: 3, phase: "Siguiente", units: ["coches"], score: 86 },
  { id: "estetica", name: "Clínicas estéticas y capilares", rank: 4, phase: "Siguiente", units: ["estetica"], score: 82 },
  { id: "climatizacion", name: "Climatización y aerotermia", rank: 5, phase: "Validar", units: ["climatizacion"], score: 80 },
  { id: "reformas", name: "Reformas de alto valor", rank: 6, phase: "Validar", units: ["reformas"], score: 79 },
  { id: "dental", name: "Clínicas dentales", rank: 7, phase: "Validar", units: ["dental"], score: 78 },
  { id: "inmobiliario", name: "Captación de propietarios", rank: 8, phase: "Validar", units: ["inmobiliario"], score: 76 },
  { id: "auditivos", name: "Centros auditivos y ortopedias", rank: 9, phase: "Después", units: ["auditivos"], score: 72 },
  { id: "logistica", name: "Contenedores, mudanzas y guardamuebles", rank: 10, phase: "Después", units: ["logistica"], score: 70 },
] as const;

const asFragment = (value: string) => value.trim().replace(/[.!?]+$/, "").toLocaleLowerCase("es");

const modeCopy = (unit: CaptureUnit, mode: CampaignMode) => mode === "B2B"
  ? {
      objective: `Conseguir que empresas de ${unit.system.toLocaleLowerCase("es")} soliciten una reunión de diagnóstico con RedVitalia.`,
      audience: unit.decisionMaker,
      message: `No faltan formularios: falta convertir ${asFragment(unit.result)} en una métrica operativa.`,
      offer: `Auditoría del recorrido actual + piloto de ${unit.offer.toLocaleLowerCase("es")}`,
      landing: `/landings/${unit.id}-b2b`,
      conversion: `reunion_b2b_${unit.id.replaceAll("-", "_")}`,
    }
  : {
      objective: `Generar ${asFragment(unit.result)} para la empresa contratada.`,
      audience: unit.endUser,
      message: unit.problem,
      offer: unit.offer,
      landing: unit.landing,
      conversion: unit.primaryConversion,
    };

const messagePack = (unit: CaptureUnit, mode: CampaignMode) => mode === "B2B"
  ? {
      emailSubject: `${unit.result.replace(/[.!?]+$/, "")}: propuesta de piloto medible`,
      emailBody: `Hemos revisado el recorrido de captación de ${unit.system.toLocaleLowerCase("es")}. La propuesta es empezar por ${unit.subniches[0].toLocaleLowerCase("es")}, acordar qué se considera una oportunidad válida y devolver al sistema el resultado ${asFragment(unit.result)}. Si hay capacidad y margen, preparamos un piloto para revisión.`,
      whatsapp: `Hola. Te escribo por la solicitud sobre captación para ${unit.name}. Antes de proponer campañas necesitamos confirmar zona, capacidad, ticket, seguimiento y resultado medible. ¿Te viene bien revisar esos cinco puntos?`,
      openingScript: `Confirmar cargo y contexto. Preguntar oferta prioritaria, zona, capacidad semanal, tiempo de respuesta, ticket, margen y cómo registran hoy ${asFragment(unit.result)}.`,
      noShow: "No damos la reunión por perdida: confirmar si cambió la prioridad, ofrecer una única alternativa y registrar el motivo si no continúa.",
      reactivation: `Retomar solo con base legítima y contexto: preguntar si sigue activa la necesidad de mejorar ${asFragment(unit.result)} y si han cambiado capacidad o presupuesto.`,
      remarketing: `Mensaje de proceso: definir oportunidad válida, medir el recorrido completo y decidir con contribución; sin prometer volumen ni ventas.`,
    }
  : {
      emailSubject: `Siguiente paso para revisar ${unit.name.toLocaleLowerCase("es")}`,
      emailBody: `Hemos recibido tu solicitud. Para comprobar si encaja necesitamos revisar ${unit.qualification.slice(0, 3).join(", ").toLocaleLowerCase("es")}. Enviar datos no garantiza aceptación, cita, precio ni resultado.`,
      whatsapp: `Hola. Te contactamos por tu solicitud sobre ${unit.name}. Antes de avanzar necesitamos confirmar ${unit.qualification.slice(0, 3).join(", ").toLocaleLowerCase("es")}. No envíes documentación sensible por este chat.`,
      openingScript: `Confirmar identidad, consentimiento y teléfono. Revisar ${unit.qualification.slice(0, 5).join(", ").toLocaleLowerCase("es")}. Explicar el siguiente paso sin anticipar resultado.`,
      noShow: "Confirmar que la persona está bien, ofrecer una nueva franja y registrar el motivo. No usar presión, urgencia falsa ni mensajes repetidos.",
      reactivation: `Con consentimiento vigente, preguntar si sigue necesitando ${asFragment(unit.result)} y si cambiaron zona, urgencia o disponibilidad.`,
      remarketing: `${unit.problem} Explicar proceso, encaje y siguiente paso; no convertir una señal intermedia en promesa de resultado.`,
    };

const campaignOperations = (unit: CaptureUnit, mode: CampaignMode, copy: ReturnType<typeof modeCopy>) => {
  const b2b = mode === "B2B";
  const conversionPrefix = unit.id.replaceAll("-", "_");
  const adGroups = unit.subniches.slice(0, 6).map((subniche, index) => ({
    id: `${conversionPrefix}-${mode.toLocaleLowerCase("es")}-g${index + 1}`,
    name: subniche,
    intent: b2b ? `Empresa de ${unit.system.toLocaleLowerCase("es")} que necesita captar ${subniche.toLocaleLowerCase("es")}` : `Persona que busca resolver ${subniche.toLocaleLowerCase("es")}`,
    message: b2b ? `Convertir ${asFragment(unit.result)} en una métrica del sistema.` : unit.problem,
    landing: copy.landing,
    conversion: copy.conversion,
  }));
  return {
    strategicSummary: `${copy.objective} Se entra por ${unit.subniches[0].toLocaleLowerCase("es")}, con control de capacidad, cualificación y resultado offline antes de escalar.`,
    architecture: [
      `${b2b ? "Adquisición empresarial" : "Captación de usuario final"} por intención y subnicho`,
      `Landing nativa y conversión propias: ${copy.landing} → ${copy.conversion}`,
      "Remarketing separado por etapa; no cuenta como conversión primaria",
      `Devolución offline de ${asFragment(unit.result)} y valor económico`,
    ],
    adStructure: adGroups,
    audiences: b2b
      ? [unit.decisionMaker, `Empresas de ${unit.system.toLocaleLowerCase("es")} con capacidad comercial`, "Visitantes de la landing B2B sin reunión", "Lista propia con base legítima"]
      : [unit.endUser, `Intención: ${unit.subniches.join(" · ")}`, "Visitantes sin envío", "Lead sin siguiente paso confirmado"],
    locations: ["Zona incluida por el cliente", "Presencia o servicio real", "Excluir zonas sin capacidad", "Revisar informe geográfico por resultado, no por clic"],
    bidding: {
      start: "Control de términos y conversiones de primera capa durante la fase de aprendizaje",
      evolve: `Migrar a ${copy.conversion} o valor offline cuando el volumen y la calidad del dato sean suficientes`,
      never: "No optimizar a clic de teléfono, WhatsApp o apertura de formulario sin validación posterior",
    },
    valueSignals: [copy.conversion, "resultado aceptado", "valor bruto", "margen bruto", "motivo de pérdida", "tiempo de respuesta"],
    offlineImport: ["gclid / gbraid / wbraid", "campaign_id y landing_route", "estado CRM y fecha", "valor y moneda", "deduplicación por identificador", "consentimiento y minimización de PII"],
    remarketingStages: [
      { stage: "Visitante sin convertir", message: "Explicar proceso y encaje, sin urgencia artificial." },
      { stage: "Lead sin cita", message: "Confirmar datos mínimos y ofrecer el siguiente paso." },
      { stage: "Cita no asistida", message: "Ofrecer una alternativa y registrar el motivo." },
      { stage: "Presupuesto no aceptado", message: "Resolver la objeción registrada; no inventar descuento." },
      { stage: "Oportunidad perdida", message: "Reabrir solo si cambia la causa y existe consentimiento." },
      { stage: "Reactivación", message: "Comprobar que la necesidad sigue vigente y facilitar la baja." },
    ],
    creativeNeeds: unit.creativeRoutes.map((route) => ({
      route: route.name,
      direction: route.direction,
      concepts: ["Resultado verificable", "Proceso y filtro"],
      variants: ["Texto completo", "Texto reducido", "Arte sin texto", "Feed 1:1", "Feed 4:5", "Story/Reels 9:16", "Google 1,91:1", "Google 1:1", "Google 4:5", "Hero landing"],
    })),
    creativeBrief: {
      audience: b2b ? unit.decisionMaker : unit.endUser,
      problem: unit.problem,
      promise: b2b ? copy.offer : `Revisar encaje y siguiente paso para ${unit.name.toLocaleLowerCase("es")}`,
      proof: "Solo prueba documentada y autorizada; mientras falte, usar proceso verificable",
      mustAvoid: unit.compliance,
      qa: ["Ortografía", "Jerarquía", "Contraste", "Márgenes", "Recortes", "Marca", "Claims", "Derechos", "Políticas"],
    },
    landingPlan: {
      route: copy.landing,
      hero: copy.message,
      sections: ["Problema", "Proceso", "Casos que encajan", "Casos que no encajan", "Prueba real", "FAQ", "Formulario", "Privacidad"],
      mobile: "CTA antes de media, campos de al menos 44 px, sin scroll horizontal y carga optimizada",
      blockers: ["Marca y datos legales", "Prueba autorizada", "Cobertura y horario", "Destino real del formulario", "Consentimiento/CMP"],
    },
    formPlan: {
      firstStep: [...unit.qualification.slice(0, 4), "Teléfono", "Consentimiento"],
      later: unit.qualification.slice(4),
      reject: unit.rejection,
      hidden: ["gclid", "gbraid", "wbraid", "msclkid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing_route", "intent_cluster"],
    },
    trackingPlan: {
      primary: copy.conversion,
      secondary: ["landing_view", "form_start", "form_submit", "contact_valid", "appointment_booked"],
      quality: ["opportunity_valid", "appointment_attended", copy.conversion, "gross_value", "gross_margin"],
      qa: ["Un GTM por dominio", "Sin conversiones primarias duplicadas", "Consentimiento probado", "Identifiers persistidos", "Evento disparado tras envío válido", "Importación offline deduplicada"],
    },
    automationPlan: ["Capturar origen", "Asignar intención", "Avisar al responsable", "Contactar dentro del SLA", "Confirmar siguiente paso", "Recordar", "Recuperar no-show", "Registrar resultado", "Reactivar según causa y consentimiento"],
    kpis: ["Coste por oportunidad válida", "Tasa de contacto", "Tasa de cita", "Show rate", `Coste por ${asFragment(unit.result)}`, "CAC", "Contribución", "Capacidad consumida"],
    budgetAllocation: b2b
      ? [{ bucket: "Search de intención", share: 65 }, { bucket: "Meta de prueba", share: 20 }, { bucket: "Remarketing", share: 15 }]
      : [{ bucket: "Intención principal", share: 70 }, { bucket: "Exploración controlada", share: 20 }, { bucket: "Remarketing", share: 10 }],
    controls: ["Revisión de términos 2 veces por semana", "Control diario de capacidad", "Calidad semanal por subnicho", "Economía quincenal", "Decisión mensual con muestra mínima"],
    scaleCriteria: ["Contribución positiva", "Resultado offline estable", "SLA cumplido", "Capacidad disponible", "Sin deterioro de calidad >20%", "Aprobación humana de presupuesto"],
    stopCriteria: ["Datos o consentimiento incompletos", "Capacidad agotada", "Resultado offline ausente", "Claims no aprobables", "Contribución negativa tras dos iteraciones", ...unit.rejection.slice(0, 2)],
    risks: [unit.compliance, "Optimizar a una señal intermedia", "Escalar antes de completar el ciclo", "Mezclar subnichos con economía distinta"],
    launchChecklist: ["Cliente y decisor", "Oferta", "Zona", "Presupuesto", "Capacidad", "Brand kit", "Prueba autorizada", "Landing", "Formulario", "CRM", "Tracking", "Privacidad", "Creatividad revisada", "Aprobación humana"],
  };
};

export const CAMPAIGNS = CAPTURE_UNITS.flatMap((unit) => (["B2B", "B2C"] as CampaignMode[]).map((mode) => {
  const copy = modeCopy(unit, mode);
  const operations = campaignOperations(unit, mode, copy);
  return {
    id: `${unit.id}-${mode.toLocaleLowerCase("es")}`,
    systemId: unit.systemId,
    unitId: unit.id,
    unit: unit.name,
    mode,
    status: unit.phase === "Ahora" ? "Lista para aprobar" : "Borrador",
    objective: copy.objective,
    channel: mode === "B2B" ? "Google Search + Meta remarketing" : unit.channel,
    zone: "España · ajustar por capacidad real",
    budget: mode === "B2B" ? 900 : unit.systemId === "legal" ? 1400 : 1200,
    audience: copy.audience,
    message: copy.message,
    offer: copy.offer,
    landing: copy.landing,
    primaryConversion: copy.conversion,
    secondaryConversions: mode === "B2B" ? ["formulario_b2b_valido", "reunion_b2b_asistida", "propuesta_emitida"] : ["lead_valido", "contacto_efectivo", "cita_asistida"],
    keywords: mode === "B2B" ? [`agencia marketing ${unit.system.toLocaleLowerCase("es")}`, `captación clientes ${unit.name.toLocaleLowerCase("es")}`, `leads cualificados ${unit.name.toLocaleLowerCase("es")}`] : unit.subniches.map((item) => `${item.toLocaleLowerCase("es")} cerca`).slice(0, 5),
    negatives: mode === "B2B" ? ["empleo", "curso", "gratis", "plantilla", "qué es"] : ["empleo", "curso", "formación", "pdf", "gratis", "foro"],
    exclusions: ["Fuera de zona", "Menores sin representante", "Tráfico informativo sin intención", ...unit.rejection.slice(0, 2)],
    schedule: "Solo franjas con respuesta humana y agenda disponible",
    devices: "Móvil prioritario; revisar llamadas y formularios por dispositivo",
    tracking: ["view_landing", "form_start", "lead_submit", copy.conversion],
    messages: messagePack(unit, mode),
    evidence: "Hipótesis" as EvidenceLevel,
    ...operations,
  };
}));

const routeConcepts = (unit: CaptureUnit, mode: CampaignMode, route: string) => {
  const b2b = [
    `${unit.result.replace(/[.!?]+$/, "")}: la métrica que importa`,
    `Tu agenda no necesita más ruido`,
  ];
  const b2c = [
    `${unit.name}: revisamos tu caso antes de avanzar`,
    `Un siguiente paso claro, sin promesas vacías`,
  ];
  return (mode === "B2B" ? b2b : b2c).map((headline, index) => ({
    headline,
    concept: index === 0 ? `${route}: resultado verificable` : `${route}: proceso y filtro`,
    copy: mode === "B2B" ? `${unit.offer} Medimos calidad, asistencia y resultado económico; la aprobación de campaña sigue siendo humana.` : `${unit.problem} Te pediremos solo los datos necesarios para comprobar encaje y explicarte el siguiente paso.`,
    cta: mode === "B2B" ? "Solicitar diagnóstico" : "Revisar mi caso",
  }));
};

export const CREATIVE_FORMATS = [
  { id: "meta-square", name: "Meta feed cuadrado", width: 1080, height: 1080 },
  { id: "meta-portrait", name: "Meta feed vertical", width: 1080, height: 1350 },
  { id: "story", name: "Stories / Reels", width: 1080, height: 1920 },
  { id: "google-landscape", name: "Google horizontal", width: 1200, height: 628 },
  { id: "google-square", name: "Google cuadrado", width: 1200, height: 1200 },
  { id: "google-portrait", name: "Google Demand Gen vertical", width: 960, height: 1200 },
  { id: "landing-hero", name: "Landing hero", width: 1600, height: 900 },
] as const;

export const CREATIVE_REQUIREMENTS = [
  { id: "meta-feed-square", channel: "Meta", name: "Feed cuadrado con texto", status: "Archivo listo", formatId: "meta-square" },
  { id: "meta-feed-portrait", channel: "Meta", name: "Feed vertical con texto", status: "Archivo listo", formatId: "meta-portrait" },
  { id: "meta-stories", channel: "Meta", name: "Stories", status: "Archivo listo", formatId: "story" },
  { id: "meta-reels-cover", channel: "Meta", name: "Portada Reels", status: "Archivo listo", formatId: "story" },
  { id: "meta-carousel", channel: "Meta", name: "Carrusel", status: "Guion listo", formatId: "meta-square" },
  { id: "meta-less-text", channel: "Meta", name: "Versión con menos texto", status: "Archivo listo", formatId: "google-square" },
  { id: "meta-no-text", channel: "Meta", name: "Arte sin texto", status: "Archivo base listo", source: "base" },
  { id: "google-square", channel: "Google", name: "Imagen 1:1", status: "Archivo listo", formatId: "google-square" },
  { id: "google-landscape", channel: "Google", name: "Imagen 1,91:1", status: "Archivo listo", formatId: "google-landscape" },
  { id: "google-vertical", channel: "Google", name: "Imagen 4:5", status: "Archivo listo", formatId: "google-portrait" },
  { id: "google-logo-square", channel: "Google", name: "Logotipo 1:1", status: "Bloqueado por brand kit", source: "brand" },
  { id: "google-logo-landscape", channel: "Google", name: "Logotipo 4:1", status: "Bloqueado por brand kit", source: "brand" },
  { id: "google-search-images", channel: "Google", name: "Assets de imagen para Search", status: "Archivos listos", formatId: "google-square" },
  { id: "google-pmax", channel: "Google", name: "Paquete Performance Max", status: "Imágenes listas · logo pendiente", formatId: "google-landscape" },
  { id: "google-demand-gen", channel: "Google", name: "Paquete Demand Gen", status: "Imágenes listas · logo pendiente", formatId: "google-portrait" },
  { id: "google-display", channel: "Google", name: "Display responsive", status: "Assets base listos", formatId: "google-landscape" },
  { id: "landing-desktop", channel: "Landing", name: "Hero escritorio", status: "Archivo listo", formatId: "landing-hero" },
  { id: "landing-mobile", channel: "Landing", name: "Hero móvil", status: "Archivo listo", formatId: "story" },
  { id: "landing-section", channel: "Landing", name: "Imagen de sección", status: "Archivo listo", formatId: "google-landscape" },
  { id: "landing-process", channel: "Landing", name: "Imagen de proceso", status: "Pendiente de prueba real", source: "proof" },
  { id: "landing-trust", channel: "Landing", name: "Visual de confianza", status: "Pendiente de evidencia autorizada", source: "proof" },
  { id: "remarketing", channel: "Remarketing", name: "6 etapas de remarketing", status: "Mensajes y adaptación listos", formatId: "meta-square" },
  { id: "video-storyboard", channel: "Vídeo", name: "Guion y storyboard", status: "Paquete de producción listo", source: "storyboard" },
] as const;

export const CREATIVE_SPEC_SOURCES = [
  { platform: "Meta Reels", url: "https://www.facebook.com/business/ads/facebook-instagram-reels-ads", checkedAt: "2026-09-03", note: "Meta recomienda creatividad vertical 9:16, audio y mensajes dentro de la zona segura para Reels." },
  { platform: "Google Display", url: "https://support.google.com/google-ads/answer/17090561", checkedAt: "2026-09-03", note: "Imagen horizontal 1,91:1 a 1200×628, cuadrada 1:1 y logos 1:1/4:1; límites separados por tipo de asset." },
  { platform: "Google Demand Gen", url: "https://support.google.com/google-ads/answer/17091672", checkedAt: "2026-09-03", note: "1:1 a 1200×1200, 1,91:1 a 1200×628 y 4:5 a 960×1200; máximo 5 MB por imagen." },
  { platform: "Google Search", url: "https://support.google.com/google-ads/answer/9566341", checkedAt: "2026-09-03", note: "Asset cuadrado obligatorio y horizontal recomendado, con resolución recomendada de 1200 px." },
] as const;

export const CREATIVES = CAPTURE_UNITS.flatMap((unit) =>
  (["B2B", "B2C"] as CampaignMode[]).flatMap((mode) =>
    unit.creativeRoutes.flatMap((route, routeIndex) =>
      routeConcepts(unit, mode, route.name).map((concept, conceptIndex) => ({
  id: `cr-${unit.id}-${mode.toLocaleLowerCase("es")}-${routeIndex + 1}-${conceptIndex + 1}`,
  systemId: unit.systemId,
  unitId: unit.id,
  niche: unit.system,
  subniche: unit.name,
  mode,
  campaignId: `${unit.id}-${mode.toLocaleLowerCase("es")}`,
  client: "Sin cliente asignado",
  audience: mode === "B2B" ? unit.decisionMaker : unit.endUser,
  angle: concept.concept,
  route: route.name,
  routeDirection: route.direction,
  concept: concept.concept,
  format: "Meta feed cuadrado",
  channel: mode === "B2B" ? "Meta + Google" : unit.channel,
  aspectRatio: "1:1",
  prompt: `Fotografía realista para ${unit.name}; ruta ${route.name}; ${route.direction}; sin texto, marcas ni promesas no verificadas.`,
  restrictions: unit.compliance,
  copy: concept.copy,
  headline: concept.headline,
  cta: concept.cta,
  alt: `${unit.name}. ${concept.concept}.`,
  date: "2026-09-03",
  tool: "ChatGPT ImageGen + composición programática",
  version: 1,
  status: "Pendiente de revisión",
  review: "Revisión humana obligatoria antes de marcar lista para campaña.",
  approvalReason: "",
  rejectionReason: "",
  baseImage: unit.image,
  master: `/assets/ejecucion/adaptations/cr-${unit.id}-${mode.toLocaleLowerCase("es")}-${routeIndex + 1}-${conceptIndex + 1}-meta-square.jpg`,
  thumbnail: `/assets/ejecucion/thumbnails/cr-${unit.id}-${mode.toLocaleLowerCase("es")}-${routeIndex + 1}-${conceptIndex + 1}.webp`,
  adaptations: CREATIVE_FORMATS.map((format) => ({ ...format, file: `/assets/ejecucion/adaptations/cr-${unit.id}-${mode.toLocaleLowerCase("es")}-${routeIndex + 1}-${conceptIndex + 1}-${format.id}.jpg` })),
  deliverables: CREATIVE_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    file: "formatId" in requirement
      ? `/assets/ejecucion/adaptations/cr-${unit.id}-${mode.toLocaleLowerCase("es")}-${routeIndex + 1}-${conceptIndex + 1}-${requirement.formatId}.jpg`
      : "source" in requirement && requirement.source === "base" ? unit.image : null,
  })),
  remarketing: ["Visitante sin convertir", "Lead sin cita", "Cita no asistida", "Presupuesto no aceptado", "Oportunidad perdida", "Reactivación"],
  videoPackage: {
    duration: "20–30 s",
    format: "9:16 principal · 1:1 y 16:9 como adaptaciones",
    script: [`Problema: ${unit.problem}`, `Proceso: ${unit.offer}`, `Cierre: ${concept.cta}`],
    scenes: ["Contexto real sin marca ajena", route.direction, "Detalle del proceso", `CTA: ${concept.cta}`],
    keyframes: [unit.image, `/assets/ejecucion/adaptations/cr-${unit.id}-${mode.toLocaleLowerCase("es")}-${routeIndex + 1}-${conceptIndex + 1}-story.jpg`],
    status: "Storyboard, textos y fotogramas; no es un vídeo terminado",
  },
  landing: mode === "B2B" ? `/landings/${unit.id}-b2b` : unit.landing,
  performance: null,
  cost: "Generación nativa de la sesión · coste no expuesto",
        learning: "Pendiente de prueba",
      })),
    ),
  ),
);

export const EXPERIMENTS = CAPTURE_UNITS.map((unit, index) => ({
  id: `exp-${unit.id}`,
  unitId: unit.id,
  unit: unit.name,
  hypothesis: index % 3 === 0 ? "Una landing específica por problema aumenta la proporción de oportunidades válidas frente a una página genérica." : index % 3 === 1 ? "La cualificación previa reduce citas improductivas sin perder volumen económicamente útil." : "Optimizar a la conversión offline desplaza el gasto hacia resultados con más valor.",
  variable: index % 3 === 0 ? "Promesa y arquitectura de landing" : index % 3 === 1 ? "Número y orden de preguntas" : "Objetivo de puja",
  control: "Flujo actual o versión generalista",
  variant: "Flujo específico por subnicho",
  channel: unit.channel,
  budget: unit.systemId === "legal" ? 1400 : 1000,
  duration: "30 días o hasta volumen mínimo",
  minimumVolume: "100 conversiones de primera capa o 20 resultados offline",
  primaryMetric: `Coste por ${asFragment(unit.result)}`,
  secondaryMetrics: ["CPL", "% válido", "% contacto", "show rate", "cierre"],
  pass: "+20% en resultado válido o -15% en coste por resultado, con capacidad estable",
  fail: "Sin mejora tras alcanzar volumen mínimo o deterioro de calidad >20%",
  risk: "Declarar ganador antes de cerrar el ciclo de venta",
  next: "Mantener, iterar una variable o pausar según resultado",
  status: "Borrador",
  result: "Pendiente",
  learning: "Pendiente",
}));

export const DECISIONS = SYSTEMS.map((system) => ({
  id: `decision-${system.id}`,
  systemId: system.id,
  title: system.id === "legal" ? "Abrir aprendizaje con Segunda Oportunidad" : `Validar ${system.name}`,
  status: system.id === "legal" ? "Pendiente de aprobación" : "Pendiente de datos",
  recommendation: system.id === "legal" ? "Construir y aprobar el piloto jurídico primero; herencias y divorcios conservan campañas separadas." : "No abrir inversión hasta cerrar puerta mínima, capacidad y dato económico final.",
  evidence: system.id === "legal" ? "Dato del mercado" : "Hipótesis",
  risk: system.id === "legal" ? "Mezclar especialidades o prometer resultado jurídico." : "Abrir demasiados frentes antes de aprender del piloto prioritario.",
  next: system.id === "legal" ? "Aprobación humana del presupuesto, zona, despacho y conversión primaria." : "Completar datos pendientes y volver a puntuar.",
}));

export const LEARNINGS = [
  { id: "learn-1", type: "Adaptar", title: "La calidad no termina en el formulario", detail: "La conversión final debe regresar desde CRM: asunto aceptado, obra ganada, tratamiento vendido o servicio reservado.", source: "Síntesis competitiva + panel operativo", status: "Comprobada" },
  { id: "learn-2", type: "Copiar", title: "Especialidad y landing deben coincidir", detail: "Las propuestas específicas reducen ambigüedad; en Legal y coches cada intención conserva mensaje, preguntas y evento propios.", source: "Aplicación de mercado", status: "Comprobada" },
  { id: "learn-3", type: "Probar", title: "Mostrar rango puede filtrar mejor", detail: "No se presenta como precio cerrado: se prueba si el rango mejora visita o cita efectiva sin hundir demanda útil.", source: "Hipótesis de experimento", status: "Pendiente de resultado" },
  { id: "learn-4", type: "Vigilar", title: "Velocidad de respuesta condiciona el canal", detail: "No se escala demanda si la empresa no sostiene el SLA de contacto, presupuesto y seguimiento.", source: "Panel operativo RedVitalia", status: "Comprobada" },
  { id: "learn-5", type: "Descartar", title: "CPL barato como criterio de éxito", detail: "Un lead barato no demuestra asistencia, venta ni contribución. El laboratorio mantiene todas las capas separadas.", source: "Síntesis operativa", status: "Comprobada" },
];

export const CAMPAIGN_STATES = ["Borrador", "En preparación", "Pendiente de creatividad", "Pendiente de revisión", "Lista para aprobar", "Aprobada", "Rechazada", "En prueba", "Pausada", "Escalada", "Cerrada"];
export const DECISION_STATES = ["Borrador", "Pendiente de datos", "Comprobada", "Pendiente de aprobación", "Aprobada", "Rechazada", "Ejecutada", "Pendiente de resultado", "Cerrada"];
export const CREATIVE_STATES = ["Brief", "En generación", "Generada", "Pendiente de revisión", "Necesita corrección", "Aprobada", "Rechazada", "Lista para campaña", "En prueba", "Ganadora", "Perdedora", "Archivada"];
