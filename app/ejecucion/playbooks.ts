import { CAPTURE_UNITS, PRICING_SOURCE, type CaptureUnit, type EvidenceLevel } from "./catalog.ts";
import { STRATEGY, type NicheStrategy } from "../sistemas/strategy.ts";

export type PlaybookItem = {
  label: string;
  value: string;
  evidence: EvidenceLevel;
  source: string;
};

export type PlaybookSection = {
  code: string;
  title: string;
  purpose: string;
  items: PlaybookItem[];
};

export type OperationalPlaybook = {
  unitId: string;
  systemId: string;
  name: string;
  version: string;
  generatedAt: string;
  sections: PlaybookSection[];
};

export type NicheContext = {
  id: string;
  rank: number;
  name: string;
  recommendation: string;
  reason: string;
  result: string;
  fee: string;
  media: string;
  offer: string;
  target: string;
  reject: string;
  qualification: string[];
  funnel: string[];
  campaigns: string[];
  copy: { b2b: string; b2c: string };
  opener: string;
  objections: string[];
  kpis: string[];
  plan: string[];
  competitors: Array<{ id: string; name: string; score: number; decision: string }>;
};

type UnitProfile = {
  alternative: string;
  demandSignal: string;
  saturation: string;
  commercialModels: string;
  guarantees: string;
  channels: string;
  gap: string;
  barriers: string;
  maturity: string;
  idealCompany: string;
  minimumSize: string;
  capacity: string;
  assets: string;
  reputation: string;
  maximumVolume: string;
  entryOffer: string;
  premiumOffer: string;
  extras: string;
  formFirst: string;
  phoneLater: string;
  forbidden: string;
  bidding: string;
  targeting: string;
  landingProof: string;
  mobileRule: string;
  pending: string;
};

const PROFILES: Record<string, UnitProfile> = {
  "segunda-oportunidad": {
    alternative: "Si el despacho no puede devolver asunto aceptado y valor, priorizar herencias con agenda y casuística trazables.",
    demandSignal: "Intención de búsqueda ligada a deuda, acreedores, embargos y Segunda Oportunidad; cuantificación local pendiente de Keyword Planner.",
    saturation: "Alta presión de agregadores y promesas agresivas; la ventaja debe ser especialización, filtro y seguimiento.",
    commercialModels: "Consulta inicial, estudio de viabilidad, iguala o presupuesto por procedimiento; validar cada modelo con el despacho.",
    guarantees: "Solo garantías controlables de proceso, respuesta o reposición; nunca exoneración ni sentencia.",
    channels: "Search por intención exacta; remarketing educativo prudente; Meta solo con revisión de políticas y atributos personales.",
    gap: "Pocas propuestas separan formulario, consulta efectiva y asunto aceptado con valor económico.",
    barriers: "Revisión jurídica, datos sensibles, ciclo por procedimiento y disciplina del despacho para informar resultados.",
    maturity: "Media-alta en adquisición, baja en devolución de resultados offline y clasificación económica.",
    idealCompany: "Despacho especializado en concursal de persona física, con responsable de intake y cobertura definida.",
    minimumSize: "Capacidad de atender el piloto sin desbordar llamadas; plantilla exacta pendiente del despacho.",
    capacity: "Agenda semanal declarada para consultas y revisión de expedientes; bloquear inversión cuando se complete.",
    assets: "Identidad aprobada, abogados y colegiación verificables, proceso explicado, privacidad y casos autorizados sin prometer desenlace.",
    reputation: "Sin sanciones o patrones públicos incompatibles; reseñas solo si la fuente y el permiso están documentados.",
    maximumVolume: "Definir por consultas efectivas semanales, no por formularios.",
    entryOffer: "Auditoría de intake y piloto de Segunda Oportunidad con una provincia o cobertura online definida.",
    premiumOffer: "Sistema completo con CRM, agenda, no-show, importación de asunto aceptado y reporting de valor.",
    extras: "Reactivación consentida, mystery calls, mejora de scripts y contenidos informativos de apoyo.",
    formFirst: "Deuda total, acreedores, tipo de deuda, ingresos, bienes, vivienda, provincia, teléfono y consentimiento.",
    phoneLater: "Embargos, procedimientos abiertos, situación laboral, urgencia, modalidad y capacidad para consulta.",
    forbidden: "No pedir DNI, documentación bancaria completa ni prometer elegibilidad o cancelación desde publicidad.",
    bidding: "Empezar con control de consultas y pasar a valor solo cuando asunto aceptado sea consistente.",
    targeting: "Separar deuda financiera, pública y autónomos; excluir empleo, plantillas, estudios y consulta sin intención.",
    landingProof: "Equipo y proceso reales, revisión de documentación y condiciones de consulta; sin cifras de éxito no verificadas.",
    mobileRule: "CTA a precalificación antes de la imagen y formulario en pasos cortos, con privacidad visible.",
    pending: "Volumen y CPC por provincia, capacidad del despacho, honorarios del asunto, prueba autorizada y tasa histórica de aceptación.",
  },
  herencias: {
    alternative: "Empezar por herencia bloqueada con inmueble; posponer internacional hasta disponer de capacidad específica.",
    demandSignal: "Búsqueda fragmentada por conflicto, inmueble, testamento, legítima y deudas; volumen por subcaso pendiente.",
    saturation: "Competencia generalista alta; menor claridad en recorridos por problema patrimonial concreto.",
    commercialModels: "Consulta, estudio documental, mediación, partición, impugnación y procedimientos con presupuestos distintos.",
    guarantees: "Explicar alcance y siguiente paso; no garantizar acuerdo, adjudicación, venta ni plazo judicial.",
    channels: "Search por casuística; remarketing informativo para ciclos largos; contenidos SEO como apoyo, no conversión mezclada.",
    gap: "Triaje útil entre bloqueo, inmueble, deuda e impugnación antes de pedir documentación extensa.",
    barriers: "Múltiples herederos, legitimidad, documentación, jurisdicción e intervalos de decisión largos.",
    maturity: "Media; abundan webs generalistas y falta instrumentación hasta asunto aceptado.",
    idealCompany: "Despacho con área de sucesiones, experiencia documental y capacidad para casos con inmueble.",
    minimumSize: "Responsable de primera llamada y abogado con huecos de consulta medibles.",
    capacity: "Cupo semanal por tipo de asunto y SLA para revisar documentación inicial.",
    assets: "Equipo verificable, proceso de sucesión, cobertura territorial, privacidad y prueba autorizada.",
    reputation: "Reputación jurídica contrastable y comunicación prudente en situaciones familiares sensibles.",
    maximumVolume: "Definir por revisiones documentales y consultas efectivas disponibles.",
    entryOffer: "Piloto para herencias bloqueadas con inmueble y una única cobertura.",
    premiumOffer: "Captación por casuística, automatización de seguimiento largo y atribución de asunto aceptado.",
    extras: "Contenido de objeciones, reactivación, seguimiento multidecisor y cruce inmobiliario solo con consentimiento.",
    formFirst: "Relación con la herencia, testamento, herederos, inmueble, deuda, conflicto, provincia y contacto.",
    phoneLater: "Legitimidad, documentación disponible, procedimientos, elemento internacional, urgencia y decisión compartida.",
    forbidden: "No solicitar documentos sensibles en abierto ni anticipar derechos, reparto o resultado.",
    bidding: "Optimizar inicialmente a consulta asistida separada; importar asunto aceptado al alcanzar calidad de dato.",
    targeting: "Grupos por bloqueo, inmueble, legítima, renuncia, deudas e internacional; negativas de modelos y formación.",
    landingProof: "Proceso documental y profesionales reales; no usar familias ficticias como testimonios.",
    mobileRule: "Explicar el tipo de caso antes del formulario y permitir indicar que faltan datos.",
    pending: "Volumen por casuística, ticket y margen por asunto, cobertura, capacidad documental y activos autorizados.",
  },
  divorcios: {
    alternative: "Validar mutuo acuerdo y contencioso por separado; no abrir patrimonio complejo sin especialista y filtro económico.",
    demandSignal: "Demanda estable pero con intenciones muy distintas entre mutuo acuerdo, contencioso, custodia y medidas.",
    saturation: "Alta comparación por precio en mutuo acuerdo; mayor espacio para especialización prudente en casos complejos.",
    commercialModels: "Precio cerrado en supuestos acotados y presupuesto por complejidad en contencioso o patrimonio.",
    guarantees: "Claridad de proceso y alcance; nunca custodia, pensión, sentencia o plazo garantizados.",
    channels: "Search por modalidad; remarketing sobrio; Meta restringido por sensibilidad y atributos personales.",
    gap: "Separar complejidad, urgencia y viabilidad de una consulta sin explotar conflicto familiar.",
    barriers: "Datos sensibles, menores, múltiples partes, jurisdicción y riesgo reputacional en el mensaje.",
    maturity: "Alta en captación genérica; baja en separación de economía y resultado por tipo de asunto.",
    idealCompany: "Despacho con área de familia, protocolos de intake y capacidad diferenciada por mutuo acuerdo y contencioso.",
    minimumSize: "Atención humana estable y huecos de consulta por especialidad.",
    capacity: "Agenda diferenciada y capacidad para seguimiento de medidas o patrimonio.",
    assets: "Equipo, proceso, cobertura y acreditaciones verificables; imágenes neutras sin menores identificables.",
    reputation: "Trato prudente y reseñas autorizadas sin detalles personales.",
    maximumVolume: "Por consultas efectivas y carga de expedientes, no por leads.",
    entryOffer: "Piloto monomodal: mutuo acuerdo o contencioso, no ambos en la misma campaña.",
    premiumOffer: "Sistema por modalidad con CRM, agenda, no-show, reactivación y valor de asunto.",
    extras: "Contenido educativo, scripts de recepción y seguimiento de consultas no contratadas.",
    formFirst: "Modalidad, hijos, vivienda, patrimonio, provincia, urgencia, teléfono y consentimiento.",
    phoneLater: "Pensiones, empresa familiar, medidas provisionales, procedimientos y disponibilidad de ambas partes cuando aplique.",
    forbidden: "No pedir relatos íntimos extensos, datos de menores ni afirmar resultados previsibles.",
    bidding: "Mantener conversiones y presupuestos separados por modalidad; valor offline tras validar volumen.",
    targeting: "Separar mutuo acuerdo, contencioso, custodia y modificación; excluir modelos, empleo y consultas escolares.",
    landingProof: "Profesionales y proceso real; nada de dramatización, miedo o resultados judiciales.",
    mobileRule: "Selector de modalidad visible y formulario breve con salida clara para urgencias no comerciales.",
    pending: "Mix de asuntos, ticket por modalidad, tasa de aceptación, cobertura, agenda y prueba autorizada.",
  },
  toldos: {
    alternative: "Entrar por pérgolas bioclimáticas; dejar reparación y recambio fuera del piloto premium.",
    demandSignal: "Intención local por producto, motorización y cerramiento; estacionalidad y volumen municipal pendientes.",
    saturation: "Alta oferta local, con muchas páginas de catálogo y poca cualificación económica previa.",
    commercialModels: "Visita y presupuesto, financiación, instalación llave en mano y mantenimiento.",
    guarantees: "Plazo, garantía de producto e instalación solo cuando el cliente los documente.",
    channels: "Search por producto y zona; Meta con obra real autorizada; remarketing de proyecto largo.",
    gap: "Producto premium, rango orientativo validado y visita técnica ligada a capacidad real.",
    barriers: "Portfolio autorizado, radio, medición, permisos, estacionalidad y velocidad de presupuesto.",
    maturity: "Media; buena materia visual, atribución comercial irregular.",
    idealCompany: "Instalador especializado con equipo de visita, montaje propio o controlado y ticket premium.",
    minimumSize: "Capacidad mínima de varias visitas y presupuestos por semana; cifra exacta pendiente.",
    capacity: "Huecos de visita e instalación visibles antes de escalar.",
    assets: "Obras propias autorizadas, fichas técnicas, materiales, garantías y zonas reales.",
    reputation: "Reseñas y trabajos atribuibles, sin usar renders como obra terminada.",
    maximumVolume: "Limitado por visitas, presupuestos e instalación semanal.",
    entryOffer: "Piloto local de pérgolas o cerramientos con ticket mínimo.",
    premiumOffer: "Google + Meta, landing por producto, CRM de visita/presupuesto y remarketing.",
    extras: "Producción fotográfica, automatización de seguimiento y campañas estacionales.",
    formFirst: "Propiedad, espacio, producto, medidas, zona, rango de inversión y plazo.",
    phoneLater: "Materiales, permisos, acceso, motorización y disponibilidad de visita.",
    forbidden: "No presentar precio o plazo cerrado sin visita ni trabajos ajenos.",
    bidding: "Empezar por visita cualificada; importar venta y margen cuando el seguimiento sea fiable.",
    targeting: "Pérgolas, cerramientos, techos y toldo premium separados; excluir bricolaje, repuesto y manual.",
    landingProof: "Galería propia por producto, proceso de medición e instalación, garantías documentadas.",
    mobileRule: "Fotos dimensionadas, CTA a visita y campos grandes para medidas y zona.",
    pending: "Ticket mínimo, radio, capacidad, tiempos, márgenes y derechos de las obras mostradas.",
  },
  coches: {
    alternative: "Entrar por reserva, embargo o financiado solo si hay proceso documental; averiados puede ser el piloto alternativo de menor fricción.",
    demandSignal: "Búsquedas de venta con avería, siniestro, reserva, embargo y financiación; volumen y mezcla por provincia pendientes.",
    saturation: "Alta presencia de compraventas generalistas y captación confusa con tráfico de compradores de subasta.",
    commercialModels: "Compra directa, intermediación y exportación; el modelo real debe declararse por intención.",
    guarantees: "Solo tiempos y pasos controlables; no garantizar tasación, oferta, compra ni importe.",
    channels: "Search separado por carga o estado; remarketing de documentación; Meta solo como apoyo.",
    gap: "Triaje propietario-vendedor, intención exacta y devolución de oferta, compra y margen.",
    barriers: "Liquidez, logística, criterios de compra variables, titularidad y gestión de cargas.",
    maturity: "Alta en compra genérica; baja en páginas y eventos específicos por carga.",
    idealCompany: "Comprador con liquidez, tasación rápida, logística, documentación y responsable de compras.",
    minimumSize: "Capacidad diaria de valoración y caja suficiente para el mix aceptado.",
    capacity: "Cupo por provincia, estado del vehículo y tipo de carga actualizado.",
    assets: "Marca real, proceso de revisión, equipo o instalaciones, documentos y vehículos con derechos de imagen.",
    reputation: "Datos mercantiles y proceso de pago verificables; sin badges o compradores ficticios.",
    maximumVolume: "Por valoraciones y compras financiables, no por formularios.",
    entryOffer: "Landing y campaña de una intención: reserva, embargo, financiado, avería o siniestro.",
    premiumOffer: "Silos completos, CRM de tasación/oferta/compra, importación de margen y control de cobertura.",
    extras: "Call tracking, automatización documental, remarketing y reactivación de valoraciones caducadas.",
    formFirst: "Vehículo, año, km, provincia, titularidad, tipo de carga/daño, importe conocido, teléfono y consentimiento.",
    phoneLater: "Fotos, documentación disponible, financiera u organismo, expectativa, urgencia y logística.",
    forbidden: "No pedir documentación sensible por canal abierto ni presentar una revisión como oferta vinculante.",
    bidding: "Primero vehículo valorable; después oferta aceptada o compra con valor de margen.",
    targeting: "Separar reserva, embargo/precinto, financiado, averiado, siniestro y exportación; excluir subastas y reparación.",
    landingProof: "Proceso real de valoración, pago y recogida; identificación mercantil cuando esté disponible.",
    mobileRule: "CTA antes de media, selector de carga y subida documental solo después del encaje.",
    pending: "Criterios de compra, cobertura, liquidez, SLA, margen por operación, contacto real y datos legales.",
  },
  estetica: {
    alternative: "Empezar por un tratamiento de alto valor con agenda; usar reactivación si no hay activos aprobables para adquisición fría.",
    demandSignal: "Demanda visual y de búsqueda por tratamiento; coste y calidad varían mucho por ciudad y oferta.",
    saturation: "Muy alta en Meta y comparadores; abundan descuentos y claims de resultado.",
    commercialModels: "Valoración, financiación, bono o tratamiento; separar primera consulta de venta.",
    guarantees: "Nunca resultado clínico; solo proceso, disponibilidad y condiciones verificadas.",
    channels: "Meta y Search por tratamiento; remarketing prudente; reactivación consentida.",
    gap: "Creatividad sin vergüenza corporal y medición hasta valoración asistida y tratamiento vendido.",
    barriers: "Políticas de atributos personales, compliance médico, derechos de imagen y no-show.",
    maturity: "Alta en adquisición, desigual en coordinación comercial y atribución de venta.",
    idealCompany: "Clínica con dirección médica, tratamiento prioritario, coordinador y capacidad de valoración.",
    minimumSize: "Agenda y equipo capaces de confirmar y atender el piloto.",
    capacity: "Huecos por tratamiento y profesional, con bloqueo cuando se llenen.",
    assets: "Profesionales, instalaciones, tecnología y pruebas autorizadas; antes/después solo si es legal y aprobado.",
    reputation: "Titulaciones, centro y reseñas verificables; sin claims absolutos.",
    maximumVolume: "Por valoraciones asistidas y capacidad de tratamiento.",
    entryOffer: "Piloto monoproducto con confirmación humana y no-show.",
    premiumOffer: "Sistema completo por tratamiento, CRM, venta offline, creatividades y reactivación.",
    extras: "Mystery calls, guiones, recuperación de no-show y análisis de financiación.",
    formFirst: "Tratamiento, zona, plazo, disponibilidad, financiación orientativa, teléfono y consentimiento.",
    phoneLater: "Motivación, valoración previa y criterios clínicos definidos por el centro.",
    forbidden: "No diagnosticar, inferir atributos, prometer resultados ni pedir historias clínicas en publicidad.",
    bidding: "Optimizar a valoración asistida y después tratamiento vendido; no a clic de WhatsApp.",
    targeting: "Una campaña por tratamiento y ciudad; exclusiones de empleo, cursos y producto doméstico.",
    landingProof: "Profesionales, centro y proceso reales; claims revisados por responsable clínico.",
    mobileRule: "Lenguaje neutral, CTA de valoración y formulario corto con consentimiento claro.",
    pending: "Tratamiento, ticket, margen, financiación, agenda, política de imagen, claims y ventas históricas.",
  },
  climatizacion: {
    alternative: "Priorizar instalación/sustitución; mantener urgencias separadas si la atención inmediata no está garantizada.",
    demandSignal: "Demanda estacional por instalación, avería y aerotermia; volumen por zona y franja pendiente.",
    saturation: "Alta en picos de calor/frío; gran parte compite por llamada y disponibilidad.",
    commercialModels: "Visita, instalación, reparación, mantenimiento y financiación; economía distinta por servicio.",
    guarantees: "No prometer ahorro, diagnóstico, precio ni llegada sin cálculo y capacidad.",
    channels: "Search por servicio/zona/franja; llamadas solo cuando se atienden; remarketing para aerotermia.",
    gap: "Campaña sincronizada con capacidad diaria y valor de trabajo, no solo llamada.",
    barriers: "Estacionalidad, técnicos, llamadas perdidas, cobertura y mezcla de tickets.",
    maturity: "Media; mucha captación urgente y poco cierre de bucle por margen.",
    idealCompany: "Instalador con agenda y zonas controladas, atención telefónica y capacidad de presupuesto.",
    minimumSize: "Cobertura operativa suficiente para atender el horario anunciado.",
    capacity: "Técnicos y franjas por servicio actualizados diariamente.",
    assets: "Certificaciones y marcas autorizadas, equipo, vehículos e instalaciones propias.",
    reputation: "Reseñas verificables por servicio; no inventar ahorros ni homologaciones.",
    maximumVolume: "Por técnicos, franjas y trabajos aceptables al día.",
    entryOffer: "Piloto de instalación/sustitución en un radio y horario.",
    premiumOffer: "Campañas dinámicas por capacidad, call tracking, CRM de presupuesto y venta.",
    extras: "Mantenimiento B2B, reactivación estacional y automatización de llamadas perdidas.",
    formFirst: "Inmueble, servicio, m², equipo actual, zona, plazo y teléfono.",
    phoneLater: "Acceso, instalación eléctrica, marca, error, visita y disponibilidad.",
    forbidden: "No prometer ahorro, diagnóstico o tiempo de llegada no confirmado.",
    bidding: "Trabajo válido o visita para instalación; importar valor cuando exista suficiente señal.",
    targeting: "Separar instalación, sustitución, aerotermia, reparación y mantenimiento.",
    landingProof: "Técnicos, proceso y trabajos autorizados; franjas reales, no contadores de urgencia.",
    mobileRule: "Botón de llamada condicionado al horario y alternativa de formulario usable.",
    pending: "Zonas, horarios, técnicos, ticket mínimo, tasa de llamadas perdidas, margen y SLA.",
  },
  reformas: {
    alternative: "Entrar por reforma integral o cocina premium; descartar arreglos y obras sin presupuesto mínimo.",
    demandSignal: "Demanda local por reforma integral, cocina, baño y rehabilitación; ciclo y CPC por ciudad pendientes.",
    saturation: "Alta oferta y directorios; la confianza depende de portfolio, visita y presupuesto.",
    commercialModels: "Proyecto y obra, diseño + ejecución, gremios coordinados y presupuesto por alcance.",
    guarantees: "Solo hitos y garantías contractuales documentadas; no precio ni fecha cerrados antes de visita.",
    channels: "Search por tipología; Meta con casos propios; remarketing de 30–90 días.",
    gap: "Filtro económico temprano y seguimiento disciplinado después del presupuesto.",
    barriers: "Portfolio autorizado, ciclo largo, presupuestos lentos, capacidad de obra y variación de margen.",
    maturity: "Media en publicidad, baja en atribución de obra y margen.",
    idealCompany: "Reformista con jefe de obra, comercial, portfolio real y ticket mínimo defendible.",
    minimumSize: "Capacidad de visitar, presupuestar y ejecutar sin sobreventa.",
    capacity: "Visitas, presupuestos y arranques de obra mensuales declarados.",
    assets: "Obras propias, permisos de imagen, proceso, materiales y equipo verificables.",
    reputation: "Reseñas y proyectos atribuibles; renders etiquetados como propuesta.",
    maximumVolume: "Por visitas, presupuestos y capacidad de ejecución.",
    entryOffer: "Piloto local de una tipología y ticket mínimo.",
    premiumOffer: "Search + Meta de casos, landing, CRM largo y atribución de obra/margen.",
    extras: "Producción de casos, seguimiento 90 días y reactivación de presupuestos.",
    formFirst: "Propiedad, zona, m², alcance, presupuesto, plazo y disponibilidad.",
    phoneLater: "Calidades, permisos, ocupación, decisores y visita.",
    forbidden: "No usar obras ajenas ni afirmar precio/plazo imposible.",
    bidding: "Visita cualificada; importar obra ganada y margen cuando el ciclo cierre.",
    targeting: "Reforma integral, cocina, baño y rehabilitación separados; excluir reparación y bricolaje.",
    landingProof: "Casos reales por tipología, proceso y equipo; sin falsos antes/después.",
    mobileRule: "Portfolio ligero, umbral económico visible si está aprobado y formulario por pasos.",
    pending: "Ticket mínimo, zonas, capacidad, tiempos de presupuesto, margen y derechos de portfolio.",
  },
  dental: {
    alternative: "Empezar por implantes o rehabilitación; usar ortodoncia solo si oferta y financiación son defendibles.",
    demandSignal: "Demanda alta por implantes, rehabilitación y ortodoncia, con fuerte comparación local.",
    saturation: "Muy alta; descuentos y primera visita dominan el mensaje.",
    commercialModels: "Primera visita, diagnóstico clínico, plan, financiación y tratamiento.",
    guarantees: "No garantizar resultado, ausencia de dolor ni idoneidad; validar cualquier condición económica.",
    channels: "Search por tratamiento; Meta educativo; remarketing y recuperación de plan no aceptado.",
    gap: "Optimizar a visita asistida y tratamiento aceptado, con coordinador real.",
    barriers: "Compliance sanitario, no-show, recepción, financiación y cierre de plan.",
    maturity: "Alta en anuncios; desigual en seguimiento y conversión offline.",
    idealCompany: "Clínica con dirección sanitaria, coordinador, financiación y huecos por tratamiento.",
    minimumSize: "Recepción capaz de contactar y recuperar no-show.",
    capacity: "Primeras visitas y sillones disponibles por tratamiento.",
    assets: "Profesionales, instalaciones, tecnología y casos autorizados con revisión sanitaria.",
    reputation: "Centro y titulaciones contrastables; reseñas con fuente y permiso.",
    maximumVolume: "Por primeras visitas asistidas y capacidad de tratamiento.",
    entryOffer: "Piloto de un tratamiento con coordinador y financiación definida.",
    premiumOffer: "Campañas, landing, CRM, no-show, plan aceptado y atribución de ingresos.",
    extras: "Mystery calls, reactivación, guiones y contenidos de objeciones.",
    formFirst: "Tratamiento, zona, urgencia, financiación, disponibilidad, teléfono y consentimiento.",
    phoneLater: "Historia relevante solo por canal clínico, pruebas previas y decisión de tratamiento.",
    forbidden: "No diagnosticar ni recoger salud detallada en analytics o anuncios.",
    bidding: "Visita asistida y posteriormente tratamiento aceptado; clics como señales secundarias.",
    targeting: "Campañas separadas por implantes, rehabilitación y ortodoncia; negativas de empleo y formación.",
    landingProof: "Equipo, centro y proceso reales; claims y financiación validados.",
    mobileRule: "CTA a valoración, campos accesibles y ninguna imagen que avergüence o señale atributos.",
    pending: "Tratamiento, agenda, coordinador, financiación, ticket, margen, show y cierre históricos.",
  },
  inmobiliario: {
    alternative: "Entrar por propietario con venta en menos de 90 días; mantener valoración exploratoria en nutrición.",
    demandSignal: "Volumen amplio pero mucha curiosidad; intención, zona y horizonte separan valor real.",
    saturation: "Muy alta en portales, tasadores y agencias; abundan promesas de comprador y valoración.",
    commercialModels: "Intermediación, exclusiva, honorarios al vendedor/comprador y servicios premium.",
    guarantees: "No garantizar precio, plazo, comprador ni exclusiva.",
    channels: "Meta hiperlocal + Search de venta; remarketing y nurturing por horizonte.",
    gap: "Propietario válido y visita de captación medidos aparte de encargo firmado.",
    barriers: "Ciclo largo, legitimidad, datos del inmueble, saturación y seguimiento.",
    maturity: "Alta en formularios, baja en atribución hasta exclusiva y comisión.",
    idealCompany: "Agencia con zona pequeña, propuesta de valor, agente de captación y CRM por horizonte.",
    minimumSize: "Capacidad de valorar y nutrir sin abandonar leads a largo plazo.",
    capacity: "Citas de valoración y cartera asumible por oficina.",
    assets: "Equipo local, procesos, propiedades autorizadas y datos reales de zona.",
    reputation: "Reseñas y operaciones documentadas; no fingir compradores.",
    maximumVolume: "Por valoraciones y seguimiento de propietarios, no por leads.",
    entryOffer: "Piloto hiperlocal para propietarios con intención en 90 días.",
    premiumOffer: "Meta + Search, nurturing, CRM, exclusiva y comisión devueltas como valor.",
    extras: "Contenido local, reactivación, análisis de llamadas y segmentación por horizonte.",
    formFirst: "Titularidad, zona, tipología, motivo, horizonte, ocupación, teléfono y consentimiento.",
    phoneLater: "Expectativa, cargas, decisores, estado y disponibilidad de valoración.",
    forbidden: "No pedir datos discriminatorios ni presentar estimación como tasación oficial.",
    bidding: "Valoración asistida y luego encargo firmado con valor de comisión.",
    targeting: "Venta inmediata, herencia, cambio, divorcio y vivienda vacía; separar compra/alquiler.",
    landingProof: "Agentes, zona y proceso reales; estadísticas solo con fuente y periodo.",
    mobileRule: "Dirección aproximada, no completa, hasta explicar privacidad y propósito.",
    pending: "Zona, honorarios, capacidad, propuesta de valoración, exclusiva histórica y comisión media.",
  },
  auditivos: {
    alternative: "Validar audición en una ciudad; separar ortopedia y movilidad en un sistema distinto si alcanza volumen.",
    demandSignal: "Demanda local moderada con decisor familiar frecuente; volumen por ciudad pendiente.",
    saturation: "Cadenas y promociones compiten fuerte; la accesibilidad y confianza local pueden diferenciar.",
    commercialModels: "Prueba o valoración, adaptación, financiación, mantenimiento y venta de producto.",
    guarantees: "No garantizar mejora ni idoneidad; explicar valoración profesional.",
    channels: "Search y llamada accesible; Meta local prudente; reactivación consentida.",
    gap: "Incluir al familiar decisor y medir valoración asistida, prueba y venta.",
    barriers: "Volumen local, accesibilidad, consentimiento de terceros y mezcla audición/ortopedia.",
    maturity: "Media-baja fuera de cadenas; datos de venta offline irregulares.",
    idealCompany: "Centro con profesional, accesibilidad, financiación y seguimiento familiar.",
    minimumSize: "Agenda y atención telefónica capaces de acompañar al usuario.",
    capacity: "Valoraciones, pruebas y entregas por semana.",
    assets: "Centro, profesionales, equipos y proceso reales con permisos.",
    reputation: "Acreditaciones y reseñas verificables; representación digna.",
    maximumVolume: "Por valoraciones y adaptaciones, no por llamadas.",
    entryOffer: "Piloto de valoración auditiva en una ciudad.",
    premiumOffer: "Captación, recordatorios, familiar decisor, CRM y venta offline.",
    extras: "Accesibilidad, reactivación y seguimiento de prueba no cerrada.",
    formFirst: "Motivo, zona, disponibilidad, valoración previa, decisor, accesibilidad y consentimiento.",
    phoneLater: "Contexto clínico solo por personal autorizado y canal adecuado.",
    forbidden: "No diagnosticar, inferir discapacidad ni usar datos de terceros sin consentimiento.",
    bidding: "Valoración asistida y solución propuesta; venta cuando el dato sea estable.",
    targeting: "Audición separada de ortopedia, movilidad y producto pequeño.",
    landingProof: "Profesionales, proceso y accesibilidad reales; sin promesas de mejora.",
    mobileRule: "Tipografía grande, contraste, llamadas claras y campos simples.",
    pending: "Volumen por ciudad, producto, ticket, margen, agenda, financiación y decisor real.",
  },
  logistica: {
    alternative: "Entrar por mudanza completa o contenedor; descartar portes pequeños salvo ruta rentable.",
    demandSignal: "Intención urgente por fecha, origen, destino y volumen; cuantificación por zona pendiente.",
    saturation: "Alta comparación por precio; velocidad y claridad operativa diferencian.",
    commercialModels: "Presupuesto por inventario/ruta, tarifa por volumen, almacenaje recurrente y extras.",
    guarantees: "Fecha y precio solo tras comprobar inventario, accesos y capacidad.",
    channels: "Search por servicio y zona; llamada rápida; remarketing corto.",
    gap: "Presupuesto rápido conectado con capacidad y margen de ruta.",
    barriers: "Inventario, accesos, disponibilidad, rutas y techo económico del fee.",
    maturity: "Media; muchas webs simples y poca clasificación operativa.",
    idealCompany: "Operador con vehículos/equipo, agenda, plantilla de presupuesto y zonas rentables.",
    minimumSize: "Capacidad de responder y presupuestar en minutos.",
    capacity: "Rutas, fechas, volumen y almacenaje disponibles actualizados.",
    assets: "Equipo, vehículos, almacén, seguros y proceso verificables.",
    reputation: "Reseñas y coberturas reales; no prometer disponibilidad inexistente.",
    maximumVolume: "Por fechas, vehículos y metros cúbicos disponibles.",
    entryOffer: "Piloto de un servicio y radio con mínimo rentable.",
    premiumOffer: "Search, formulario estructurado, presupuesto, CRM y capacidad dinámica.",
    extras: "Call tracking, reactivación, guardamuebles y B2B.",
    formFirst: "Origen, destino, fecha, servicio, volumen, plantas, ascensor, almacenaje y contacto.",
    phoneLater: "Inventario, accesos, objetos especiales, permisos, seguro y franjas.",
    forbidden: "No dar precio o fecha cerrados sin inventario y disponibilidad.",
    bidding: "Solicitud válida y presupuesto aceptado; valor de reserva cuando exista.",
    targeting: "Mudanza local/nacional, guardamuebles, contenedor y vaciado separados.",
    landingProof: "Equipo, vehículos y proceso reales; cobertura y seguro documentados.",
    mobileRule: "Formulario por pasos y llamada visible solo en horario atendido.",
    pending: "Zonas, capacidad, mínimos, tiempos de presupuesto, margen por ruta y seguro.",
  },
};

const sourceMarket = "Aplicación de mercado RedVitalia · fichas vinculadas";
const sourceStrategy = "Síntesis estratégica RedVitalia · requiere validación humana";
const sourceClient = "Dato pendiente del cliente antes de lanzamiento";
const real = (label: string, value: string, source = sourceMarket): PlaybookItem => ({ label, value, evidence: "Dato real", source });
const market = (label: string, value: string): PlaybookItem => ({ label, value, evidence: "Dato del mercado", source: sourceMarket });
const hypothesis = (label: string, value: string): PlaybookItem => ({ label, value, evidence: "Hipótesis", source: sourceStrategy });
const pending = (label: string, value: string): PlaybookItem => ({ label, value, evidence: "Pendiente de validar", source: sourceClient });
const asFragment = (value: string) => value.trim().replace(/[.!?]+$/, "").toLocaleLowerCase("es");

const section = (code: string, title: string, purpose: string, items: PlaybookItem[]): PlaybookSection => ({ code, title, purpose, items });

const qualificationStages = (unit: CaptureUnit, profile: UnitProfile) => [
  hypothesis("Formulario", profile.formFirst),
  hypothesis("Primera llamada", profile.phoneLater),
  hypothesis("Antes de agendar", `Confirmar zona, legitimidad, disponibilidad, criterio económico y ${asFragment(unit.result)}.`),
  hypothesis("Respuestas aceptables", `Cumple los mínimos de ${unit.qualification.slice(0, 4).join(", ").toLocaleLowerCase("es")}.`),
  hypothesis("Respuestas de descarte", unit.rejection.join(" · ")),
  pending("Campos obligatorios", `${unit.qualification.slice(0, 4).join(" · ")} · Teléfono · Consentimiento.`),
  hypothesis("Campos opcionales", unit.qualification.slice(4).join(" · ")),
  hypothesis("No preguntar", profile.forbidden),
];

const resultDictionary = (unit: CaptureUnit) => [
  hypothesis("Lead", "Formulario validado técnicamente; todavía no demuestra encaje comercial."),
  hypothesis("Contacto válido", "Teléfono real, consentimiento y conversación con la persona legitimada."),
  hypothesis("Oportunidad cualificada", `Cumple zona, servicio y criterios mínimos de ${unit.name.toLocaleLowerCase("es")}.`),
  hypothesis("Cita", "Fecha y hora confirmadas; no equivale a asistencia."),
  hypothesis("Cita efectiva", "La persona asiste o completa la revisión profesional prevista."),
  hypothesis("Visita", "Inspección o reunión realizada y registrada cuando el sector la necesita."),
  hypothesis("Presupuesto", "Propuesta económica emitida y trazable; no equivale a aceptación."),
  hypothesis("Asunto aceptado", unit.systemId === "legal" ? "El despacho confirma que acepta el encargo jurídico." : "No aplica como etapa jurídica; usar el resultado sectorial equivalente."),
  hypothesis("Venta", unit.result),
  pending("Facturación", "Importe cobrado o reconocido según criterio contable del cliente, con fecha y fuente."),
];

const buildSections = (unit: CaptureUnit, niche: NicheContext, strategy: NicheStrategy, profile: UnitProfile): PlaybookSection[] => {
  const unitPosition = CAPTURE_UNITS.filter((item) => item.systemId === unit.systemId).findIndex((item) => item.id === unit.id) + 1;
  const competitors = niche.competitors.slice(0, 8);
  const primaryExperiment = strategy.experiments[0];
  return [
    section("A", "Decisión ejecutiva", "Qué se decide ahora y qué impide avanzar.", [
      hypothesis("Recomendación", `${niche.recommendation} Para esta unidad: ${unit.offer}`),
      hypothesis("Motivo", `${niche.reason} Problema operativo: ${unit.problem}`),
      hypothesis("Alternativa mejor", profile.alternative),
      hypothesis("Orden de ataque", `${niche.rank}.${unitPosition} · ${unit.name}`),
      hypothesis("Fase actual", unit.phase),
      market("Nivel de evidencia", `${strategy.dimensions.experience}/100 experiencia previa y ${competitors.length} fichas vinculadas visibles en este sistema.`),
      pending("Datos pendientes", profile.pending),
      hypothesis("Riesgo principal", unit.compliance),
      hypothesis("Próxima decisión", `Aprobar o bloquear un piloto de ${unit.name} después de cerrar la puerta mínima.`),
    ]),
    section("B", "Mapa del mercado", "Señales observadas, huecos y límites de la oportunidad.", [
      market("Tamaño / señales de demanda", profile.demandSignal),
      hypothesis("Saturación competitiva", profile.saturation),
      market("Actores principales", competitors.length ? competitors.map((item) => `${item.name} (${item.decision})`).join(" · ") : "Sin relación competitiva suficiente; ampliar evidencia."),
      hypothesis("Modelos comerciales", profile.commercialModels),
      pending("Rangos de precios observados", "No consolidado: extraer de fichas verificadas y fechar el rango antes de usarlo."),
      hypothesis("Garantías utilizadas / permitidas", profile.guarantees),
      hypothesis("Canales", profile.channels),
      market("Posicionamientos repetidos", niche.competitors.length ? "Especialización, rapidez, prueba y reducción de fricción; comprobar cada ficha antes de copiar." : "Pendiente de más evidencia."),
      hypothesis("Oportunidad no cubierta", profile.gap),
      hypothesis("Barreras de entrada", profile.barriers),
      hypothesis("Riesgo regulatorio", unit.compliance),
      hypothesis("Madurez digital", profile.maturity),
    ]),
    section("C", "Subnichos", "Cada entrada conserva problema, economía, filtro y prioridad.", unit.subniches.flatMap((name, index) => [
      hypothesis(`${index < 2 ? "P1" : index < 4 ? "P2" : "P3"} · ${name}`, `${unit.problem} Comprador: ${unit.decisionMaker}. Usuario: ${unit.endUser}. Urgencia ${index === 0 ? "alta" : index < 3 ? "media-alta" : "por validar"}; ciclo ${strategy.salesCycle}; cualificación mediante ${unit.qualification.slice(0, 3).join(", ").toLocaleLowerCase("es")}; resultado demostrable: ${unit.result}`),
      pending(`Economía · ${name}`, "Ticket, margen, demanda, competencia y capacidad deben validarse con cliente y fuente antes de asignar presupuesto."),
    ])),
    section("D", "Cliente ideal de RedVitalia", "Condiciones que hacen operable la captación.", [
      hypothesis("Tipo de empresa", profile.idealCompany), pending("Tamaño mínimo", profile.minimumSize), pending("Zona", "Cobertura real, radio y exclusiones declarados por el cliente."), pending("Capacidad", profile.capacity), pending("Equipo", "Responsable de atención, comercial y responsable de decisión confirmados."), pending("Disponibilidad", "Agenda y horarios visibles para la prueba."), pending("Ticket medio", "Dato canónico del cliente, segmentado por servicio."), pending("Margen", "Margen bruto real y criterio contable documentado."), hypothesis("Velocidad de atención", strategy.sla[0]?.target || "Definir SLA."), hypothesis("Activos necesarios", profile.assets), hypothesis("Reputación mínima", profile.reputation), pending("Capacidad comercial", "Guion, seguimiento, presupuesto/propuesta y cierre medibles."), pending("Capacidad de seguimiento", `Cumplir al menos: ${strategy.sla.map((item) => `${item.stage} ${item.target}`).join(" · ")}.`), pending("Volumen máximo absorbible", profile.maximumVolume), hypothesis("Señales de buen cliente", `${niche.target} Registra resultados, protege el SLA y acepta límites de compliance.`), hypothesis("Señales de mal cliente", `${niche.reject} Pide garantías, oculta margen o no devuelve estados.`),
    ]),
    section("E", "Criterios de rechazo", "Puerta comercial antes de invertir tiempo o medios.", [
      ...["Falta de capacidad", "Falta de margen", "Falta de disponibilidad", "Falta de diferenciación", "Mala reputación", "Respuesta fuera del SLA", "Ausencia de seguimiento", "Imposibilidad de medir", "Expectativas irreales", "Garantías fuera del control de RedVitalia", "Presupuesto insuficiente", "Producto poco rentable", "Cobertura poco realista"].map((label, index) => hypothesis(label, index < unit.rejection.length ? unit.rejection[index] : `${label}: bloquear hasta que el cliente aporte evidencia y un plan correctivo.`)),
    ]),
    section("F", "Producto RedVitalia", "Alcance, condiciones y continuidad del sistema.", [
      hypothesis("Nombre", `${unit.name} · Sistema RedVitalia`), hypothesis("Resultado vendido", unit.result), hypothesis("Incluye", unit.offer), hypothesis("No incluye", `Garantías de venta o resultado ajeno, inversión de medios, asesoramiento profesional sectorial ni activos no aprobados.`), hypothesis("Canal principal", unit.channel), hypothesis("Canal secundario", profile.channels), real("Landing", unit.landing, "Ruta nativa de propuesta dentro de la aplicación"), hypothesis("CRM", `Estados desde lead hasta ${unit.primaryConversion}; motivo de pérdida y valor obligatorios.`), hypothesis("Seguimiento", strategy.sla.map((item) => `${item.stage}: ${item.target}`).join(" · ")), hypothesis("Agenda", "Capacidad y disponibilidad confirmadas antes de captar."), hypothesis("Cualificación", unit.qualification.join(" · ")), hypothesis("Recordatorios", "Confirmación humana, recordatorio previo y recuperación de no-show con consentimiento."), hypothesis("Reposición", "Solo si la definición de inválido, ventana y límites quedan aprobados por contrato."), hypothesis("Garantía controlable", profile.guarantees), hypothesis("Periodo mínimo", "30 días o el volumen mínimo del experimento; no cortar antes por intuición."), pending("Condiciones de entrada", profile.pending), hypothesis("Condiciones para continuar", `SLA cumplido, datos completos y tendencia compatible con ${strategy.decisionRule}`), hypothesis("Condiciones para escalar", strategy.decisionRule), hypothesis("Condiciones para cancelar", strategy.killCriteria.join(" · ")),
    ]),
    section("G", "Escalera de ofertas", "Cómo entra, crece y se recupera el valor sin duplicar tarifas.", [
      hypothesis("Oferta de entrada", profile.entryOffer), hypothesis("Oferta principal", unit.offer), hypothesis("Oferta premium", profile.premiumOffer), hypothesis("Servicios adicionales", profile.extras), pending("Activación", `Consultar ${PRICING_SOURCE.name}; no copiar un importe en esta ficha.`), real("Landing", unit.landing, "Ruta nativa de propuesta"), hypothesis("Creatividades", `3 rutas × 2 conceptos × B2B/B2C, con adaptaciones y revisión humana.`), hypothesis("CRM", `Pipeline separado por ${unit.primaryConversion}.`), hypothesis("Automatizaciones", "Captura de origen, confirmación, recordatorio, no-show, resultado y reactivación."), pending("Setter", "Solo si la fuente canónica y la capacidad comercial confirman el servicio."), hypothesis("SEO", "Apoyo informativo después de validar el silo de alta intención."), hypothesis("Remarketing", "Por etapa y consentimiento; nunca mezclarlo con conversión primaria."), hypothesis("Reactivación", "Base legítima, causa anterior y ventana definida."), hypothesis("No-show", "Mensaje humano, una nueva franja y motivo de pérdida."), hypothesis("Oportunidades perdidas", "Secuencia por causa: tiempo, precio, documentación, capacidad o no decisión."),
    ]),
    section("H", "Definición de resultado", "Diccionario que evita mezclar señales y negocio.", resultDictionary(unit)),
    section("I", "Oportunidad válida", "Mínimos para que el caso avance.", [
      hypothesis("Datos mínimos", unit.qualification.join(" · ")), pending("Zona", "Dentro de cobertura confirmada."), hypothesis("Servicio", unit.name), pending("Urgencia", "Plazo compatible con la capacidad real."), pending("Capacidad económica", "Umbral acordado sin pedir información excesiva."), hypothesis("Propiedad / legitimidad", "Persona con autoridad o representación válida."), pending("Disponibilidad", "Acepta el siguiente paso dentro del SLA."), hypothesis("Teléfono", "Número real, contactable y no duplicado."), hypothesis("Consentimiento", "Base jurídica y texto aprobados; canal y fecha registrados."), hypothesis("Criterios sectoriales", unit.qualification.join(" · ")),
    ]),
    section("J", "Oportunidad inválida", "Descarte documentado, no una bolsa ambigua.", [
      ...["Duplicado", "Datos falsos", "Fuera de zona", "Servicio no ofrecido", "Sin capacidad económica", "Sin legitimidad", "Empleo", "Proveedor", "Competidor", "Estudiante", "Consulta informativa", "Teléfono incorrecto", "Menor sin representante"].map((label) => hypothesis(label, `${label}: registrar causa y no contar como ${unit.primaryConversion}.`)),
      hypothesis("Criterios específicos", unit.rejection.join(" · ")),
    ]),
    section("K", "Cualificación", "Qué se pregunta, cuándo y qué no debe capturarse.", qualificationStages(unit, profile)),
    section("L", "Funnel", "Recorrido completo con pérdida y reactivación.", [
      ...["Fuente", "Anuncio", "Landing", "Formulario", "Llamada", "Cualificación", "Agenda", "Recordatorios", "Asistencia", "Presupuesto / consulta", "Seguimiento", "Venta", "Facturación", "Motivo de pérdida", "Reactivación"].map((label, index) => hypothesis(label, niche.funnel[index] || `${label} registrado con fecha, propietario del dato y siguiente estado.`)),
    ]),
    section("M", "Campañas", "Arquitectura B2B y B2C separada y revisable.", [
      hypothesis("Canal recomendado", `${unit.channel}. ${profile.channels}`), hypothesis("Motivo", `Capturar la intención de ${asFragment(unit.problem)} y medir ${asFragment(unit.result)}.`), hypothesis("Arquitectura", `B2B para ${unit.decisionMaker}; B2C para ${unit.endUser}; presupuestos, landings y conversiones separados.`), hypothesis("Campañas y grupos", unit.subniches.map((item) => `${item}: exacta/alta intención + remarketing propio`).join(" · ")), hypothesis("Keywords", unit.subniches.map((item) => item.toLocaleLowerCase("es")).join(" · ")), hypothesis("Negativas", `empleo · curso · gratis · plantilla · foro · ${unit.rejection.slice(0, 2).join(" · ").toLocaleLowerCase("es")}`), hypothesis("Audiencias", `${unit.decisionMaker} / ${unit.endUser}`), hypothesis("Exclusiones", unit.rejection.join(" · ")), pending("Ubicaciones", profile.targeting), hypothesis("Horarios", "Solo cuando exista respuesta humana y capacidad."), hypothesis("Dispositivos", "Móvil prioritario; revisar calidad y llamadas por dispositivo."), hypothesis("Presupuesto", `${strategy.economics.media} € de hipótesis mensual; requiere aprobación.`), hypothesis("Puja", profile.bidding), hypothesis("Conversión primaria", unit.primaryConversion), hypothesis("Conversiones secundarias", "form_start · lead_validated · contactado · cita · presupuesto/oferta"), hypothesis("Señales de valor", `Valor y margen de ${asFragment(unit.result)}.`), hypothesis("Importación offline", "GCLID/GBRAID/WBRAID + estado CRM + fecha + valor, sin PII en analítica."), hypothesis("Remarketing", "Visitante, lead sin cita, no-show, propuesta no aceptada, pérdida y reactivación."), hypothesis("Recuperación", "Cadencia por causa y consentimiento."), hypothesis("Escalado", strategy.decisionRule),
    ]),
    section("N", "Landing", "Estructura propuesta, controles y variantes.", [
      hypothesis("Arquitectura", "Una landing por intención; cabecera breve, hero, formulario, encaje, proceso, prueba, FAQ y legal."), hypothesis("Hero", `${unit.problem} CTA: ${unit.systemId === "coches" ? "Comprobar viabilidad" : "Revisar mi caso"}.`), hypothesis("Problema", unit.problem), hypothesis("Solución", unit.offer), hypothesis("Diferenciadores", profile.gap), pending("Pruebas", profile.landingProof), hypothesis("Proceso", "Datos mínimos → revisión → cualificación → agenda/oferta → resultado."), hypothesis("FAQ", `Resolver: ${unit.rejection.slice(0, 3).join(" · ")}.`), hypothesis("Formulario", profile.formFirst), hypothesis("CTA", unit.systemId === "coches" ? "Revisar mi vehículo" : "Comprobar encaje"), pending("WhatsApp", "Secundario y solo si existe número, horario, consentimiento y responsable real."), pending("Teléfono", "Secundario y solo si se atiende; no optimizar a clic crudo."), pending("Legal", "Datos societarios, privacidad, cookies y responsable reales antes de publicar."), pending("Privacidad", "Finalidad, legitimación, destinatarios, conservación y derechos revisados."), hypothesis("Seguimiento", strategy.sla.map((item) => `${item.stage} ${item.target}`).join(" · ")), hypothesis("Versión móvil", profile.mobileRule), hypothesis("Velocidad", "Hero dimensionado, imágenes optimizadas, sin terceros innecesarios y LCP objetivo <2,5 s."), hypothesis("Medición", `${unit.primaryConversion} como primaria; clics y aperturas como secundarias.`),
    ]),
    section("O", "Copy", "Mensajes por audiencia y etapa.", [
      hypothesis("Propuesta B2B", niche.copy.b2b), hypothesis("Propuesta B2C", niche.copy.b2c), hypothesis("Titulares", unit.creativeRoutes.map((item) => `${item.name}: ${item.direction}`).join(" · ")), hypothesis("Texto largo", `${unit.problem} ${unit.offer} El siguiente paso depende del encaje y no implica garantía.`), hypothesis("Texto corto", `${unit.name}: revisamos el encaje antes de avanzar.`), hypothesis("CTA", "Solicitar diagnóstico / Revisar mi caso"), hypothesis("Objeciones", niche.objections.join(" · ")), hypothesis("Respuestas", unit.rejection.map((item) => `${item}: explicar límite y alternativa segura.`).join(" · ")), hypothesis("Guion de apertura", niche.opener), hypothesis("Seguimiento", "Confirmar contexto, siguiente paso y fecha; registrar causa si no continúa."), hypothesis("Reactivación", "Retomar solo con base legítima, contexto y posibilidad de baja."), hypothesis("No-show", "Comprobar disponibilidad, ofrecer una franja y cerrar si no existe interés."), hypothesis("Remarketing", profile.gap), hypothesis("Email", `Asunto: Siguiente paso para ${unit.name}. Cuerpo: confirmar datos, límites y próxima acción.`), hypothesis("WhatsApp", `Mensaje breve para confirmar ${unit.qualification.slice(0, 3).join(", ").toLocaleLowerCase("es")}; no pedir datos sensibles.`), hypothesis("Script de llamada", profile.phoneLater),
    ]),
    section("P", "Economía", "Hipótesis editables con cálculo visible en el laboratorio.", [
      real("Fee RedVitalia", `${niche.fee}. La cifra vive en ${PRICING_SOURCE.name}.`, PRICING_SOURCE.url), real("IVA y total", "Calculados desde la tarifa canónica; no se duplican aquí.", PRICING_SOURCE.url), hypothesis("Medios", `${strategy.economics.media} €/mes`), hypothesis("CPL", `${strategy.economics.cpl} €`), hypothesis("Válidos", `${strategy.economics.qualificationPct}%`), pending("Contacto", "Editar en laboratorio con dato real del cliente."), pending("Citas", "Editar en laboratorio."), hypothesis("Asistencia", `${strategy.economics.showPct}%`), hypothesis("Cierre", `${strategy.economics.closePct}%`), hypothesis("Valor bruto por venta", `${strategy.economics.valuePerSale} €`), hypothesis("Margen bruto", `${strategy.economics.grossMarginPct}%`), hypothesis("Cálculos", "Leads → válidos → contactados → citas → asistencias → ventas → facturación → margen → CAC/contribución/break-even."), hypothesis("Escenarios", "Conservador, base y favorable; no son previsiones garantizadas."),
    ]),
    section("Q", "Competencia", "Relaciones a la ficha canónica, sin duplicarla.", competitors.length ? competitors.flatMap((competitor) => [
      market(competitor.name, `Score ${competitor.score}. Decisión: ${competitor.decision}. Modelo, oferta, precio, garantía, canal, funnel, prueba, fortalezas y debilidades se consultan en su ficha canónica.`),
      real(`Enlace · ${competitor.name}`, `/?empresa=${encodeURIComponent(competitor.id)}`, "Ficha de empresa existente en la aplicación"),
    ]) : [pending("Competidores", "No hay suficientes relaciones; no inventar fichas ni atributos.")]),
    section("R", "Experimentos", "Una variable y umbrales escritos antes de gastar.", [
      hypothesis("Hipótesis", primaryExperiment.hypothesis), hypothesis("Variable", primaryExperiment.title), hypothesis("Control", "Flujo actual o versión generalista."), hypothesis("Variante", primaryExperiment.title), hypothesis("Canal", strategy.channel), hypothesis("Presupuesto", `${strategy.economics.media} € como techo hipotético; aprobación obligatoria.`), hypothesis("Duración", "30 días o hasta volumen mínimo."), hypothesis("Volumen mínimo", "100 conversiones de primera capa o 20 resultados offline; ajustar a la realidad."), hypothesis("Métrica principal", `Coste por ${asFragment(unit.result)}.`), hypothesis("Métricas secundarias", niche.kpis.join(" · ")), hypothesis("Aprobación", primaryExperiment.pass), hypothesis("Fallo", primaryExperiment.fail), hypothesis("Riesgo", strategy.risks[0]?.risk || "Decidir con muestra insuficiente."), hypothesis("Próxima acción", "Mantener, iterar una variable o pausar."), pending("Resultado", "Pendiente de prueba."), pending("Aprendizaje", "Pendiente de resultado y fuente."),
    ]),
    section("S", "Ejecución", "Puertas, cadencia, riesgos y cierre del aprendizaje.", [
      hypothesis("Puerta mínima", strategy.launchGate.join(" · ")), hypothesis("Checklist previo", `Cliente, oferta, zona, capacidad, prueba, tracking, privacidad, QA móvil y aprobación humana.`), hypothesis("Días 1–15", niche.plan[0] || "Instrumentar y comprobar el recorrido completo sin escalar."), hypothesis("Días 16–30", niche.plan[1] || "Corregir consultas, SLA y cualificación."), hypothesis("Días 31–60", niche.plan[2] || "Validar resultado offline y economía."), hypothesis("Días 61–90", niche.plan[3] || "Escalar solo la combinación ganadora o cerrar."), hypothesis("Regla de escala", strategy.decisionRule), hypothesis("Kill criteria", strategy.killCriteria.join(" · ")), hypothesis("Riesgos y respuesta", strategy.risks.map((item) => `${item.risk}: ${item.response}`).join(" · ")), hypothesis("Datos a recoger", `${strategy.tracking.join(" · ")} · fuente · fecha · valor · causa de pérdida.`), hypothesis("Informe posterior", "Volumen, calidad, SLA, funnel, economía, incidencias, decisión, evidencia, confianza, pendientes y siguiente prueba."),
    ]),
  ];
};

export const buildOperationalPlaybooks = (systemId: string, niche: NicheContext): OperationalPlaybook[] => {
  const strategy = STRATEGY[systemId];
  if (!strategy) return [];
  return CAPTURE_UNITS.filter((unit) => unit.systemId === systemId).map((unit) => ({
    unitId: unit.id,
    systemId,
    name: unit.name,
    version: "3.0",
    generatedAt: "2026-09-03",
    sections: buildSections(unit, niche, strategy, PROFILES[unit.id]),
  }));
};

export const validatePlaybook = (playbook: OperationalPlaybook) => {
  const codes = playbook.sections.map((item) => item.code);
  return codes.length === 19
    && new Set(codes).size === 19
    && playbook.sections.every((item) => item.items.length > 0)
    && playbook.sections.flatMap((item) => item.items).every((item) => item.source && item.evidence);
};
