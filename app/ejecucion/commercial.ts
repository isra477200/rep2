import { CAPTURE_UNITS } from "./catalog.ts";

export const PIPELINE_STAGES = [
  "Lista",
  "Contactado",
  "Conversación",
  "Reunión",
  "Diagnóstico",
  "Propuesta",
  "Ganado",
  "Perdido",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

type VerticalIntel = {
  signal: string;
  opener: string;
  tension: string;
  questions: string[];
  proof: string;
  noGo: string;
};

const INTEL: Record<string, VerticalIntel> = {
  "segunda-oportunidad": {
    signal: "Despacho con área concursal visible, intake estable y capacidad semanal para consultas.",
    opener: "Estamos ayudando a despachos a separar Segunda Oportunidad del resto de áreas y a medir desde la búsqueda hasta el asunto aceptado. ¿Ahora mismo queréis crecer en esta especialidad o la agenda ya está cubierta?",
    tension: "Mucho formulario no equivale a buen asunto: el valor aparece al filtrar deuda, acreedores, situación y capacidad real de atención.",
    questions: ["¿Cuántas consultas nuevas podéis atender por semana?", "¿Qué hace que un asunto sea aceptable?", "¿Quién responde y en cuánto tiempo?", "¿Registráis asunto aceptado y valor?"],
    proof: "Enseñar el recorrido especialidad → precalificación → consulta → asunto aceptado; nunca prometer exoneración.",
    noGo: "No avanzar si exigen promesas judiciales, no tienen agenda o no devolverán el resultado al sistema.",
  },
  herencias: {
    signal: "Despacho de sucesiones con capacidad documental y foco en casos concretos.",
    opener: "Estamos trabajando captación separada para herencias bloqueadas, inmuebles y conflictos entre herederos. ¿Es una línea que queréis hacer crecer o no es prioritaria ahora?",
    tension: "Mezclar herencias simples, conflictivas e internacionales produce mensajes genéricos y economías imposibles de leer.",
    questions: ["¿Qué casuística queréis priorizar?", "¿Cuánto tarda la primera revisión?", "¿Quién sigue un caso que no contrata en la primera consulta?", "¿Cómo registráis el asunto aceptado?"],
    proof: "Mostrar silos por casuística y seguimiento de ciclo largo sin anticipar plazos ni resultados.",
    noGo: "No avanzar si buscan volumen genérico, no pueden revisar documentación o quieren garantizar resultados.",
  },
  divorcios: {
    signal: "Despacho de familia con agenda diferenciada por modalidad y proceso de seguimiento.",
    opener: "Ayudamos a separar mutuo acuerdo, contencioso y modificación de medidas para medir qué asunto merece inversión. ¿Qué modalidad os interesa reforzar?",
    tension: "Un solo mensaje para todos los conflictos atrae consultas muy distintas y dificulta conocer la rentabilidad real.",
    questions: ["¿Qué modalidad aporta mejor encaje?", "¿Cuántas consultas podéis atender?", "¿Quién hace la primera llamada?", "¿Se registra el asunto contratado?"],
    proof: "Enseñar campañas y medición por modalidad, con mensajes prudentes y sin explotar miedo o menores.",
    noGo: "No avanzar si mezclan todas las áreas o quieren usar miedo, presión o promesas sobre custodia y sentencia.",
  },
  toldos: {
    signal: "Instalador con ticket premium, radio definido, visitas disponibles y portfolio propio.",
    opener: "Trabajamos captación local para llenar visitas de proyectos de pérgolas y cerramientos que encajen en ticket y zona. ¿Os faltan proyectos o la capacidad de instalación está cubierta?",
    tension: "La agenda se rompe cuando una visita técnica se consume en catálogo, repuesto, bricolaje o presupuestos incompatibles.",
    questions: ["¿Cuál es vuestro ticket mínimo?", "¿Cuántas visitas podéis hacer por semana?", "¿Cuánto tardáis en presupuestar?", "¿Tenéis obras propias autorizadas?"],
    proof: "Mostrar filtro por producto, medidas, zona, inversión y plazo antes de reservar la visita.",
    noGo: "No avanzar si compiten por recambio barato, no tienen material propio o no pueden presupuestar con rapidez.",
  },
  coches: {
    signal: "Comprador con liquidez, logística, criterios de compra documentados y tasación rápida.",
    opener: "Montamos captación específica para vehículos con reserva, embargo, financiación, avería o siniestro, medida hasta compra y margen. ¿Qué tipo de vehículo os interesa comprar ahora?",
    tension: "Optimizar al formulario llena el equipo de vehículos que no pueden comprarse o que destruyen margen.",
    questions: ["¿Qué aceptáis esta semana?", "¿En cuánto tiempo emitís oferta?", "¿Qué zonas cubrís?", "¿Podéis devolver compra y margen por origen?"],
    proof: "Enseñar silos por problema del vehículo y retroalimentación del margen, no solo del lead.",
    noGo: "No avanzar sin liquidez, proceso documental, logística o criterios de compra actualizados.",
  },
  estetica: {
    signal: "Clínica con tratamiento prioritario, coordinador, agenda y revisión de claims.",
    opener: "Ayudamos a clínicas a trabajar una sola línea de tratamiento y medir desde captación hasta valoración asistida y venta. ¿Qué tratamiento queréis llenar ahora?",
    tension: "El problema rara vez es solo el anuncio: respuesta lenta, no-shows y falta de seguimiento destruyen la inversión.",
    questions: ["¿Qué tratamiento es prioritario?", "¿Quién confirma las citas?", "¿Cómo recuperáis no-shows?", "¿La venta queda registrada por origen?"],
    proof: "Mostrar campaña monoproducto, confirmación humana y devolución de venta sin promesas médicas.",
    noGo: "No avanzar sin agenda, coordinador, control de claims o registro del resultado comercial.",
  },
  climatizacion: {
    signal: "Instalador con zonas, servicios, horarios y capacidad técnica controlados.",
    opener: "Trabajamos campañas separadas para instalación, sustitución y aerotermia, sincronizadas con técnicos y zonas. ¿Dónde está hoy el cuello de botella: demanda o capacidad?",
    tension: "Activar demanda sin disponibilidad, cobertura ni respuesta telefónica genera coste y reseñas negativas.",
    questions: ["¿Qué servicio deja mejor margen?", "¿Qué zonas cubrís esta semana?", "¿Cuántas llamadas se pierden?", "¿Cuánto tardáis en presupuestar?"],
    proof: "Enseñar activación por servicio y zona, conectada al trabajo ganado.",
    noGo: "No avanzar si no controlan disponibilidad, pierden llamadas o mezclan reparaciones con instalaciones.",
  },
  reformas: {
    signal: "Empresa con portfolio propio, umbral económico, capacidad de visitas y seguimiento de presupuestos.",
    opener: "Ayudamos a reformistas a filtrar zona, alcance, presupuesto y plazo antes de la visita. ¿Os faltan proyectos de valor o tiempo para presupuestar los que ya entran?",
    tension: "Visitar pequeños arreglos o proyectos sin presupuesto roba horas a las oportunidades de mayor valor.",
    questions: ["¿Qué obra mínima os interesa?", "¿Cuántas visitas podéis asumir?", "¿Cuánto tardáis en presupuestar?", "¿Cómo seguís presupuestos abiertos?"],
    proof: "Mostrar el filtro económico y operativo antes de visita, más seguimiento del presupuesto.",
    noGo: "No avanzar si aceptan cualquier trabajo, no hacen seguimiento o carecen de imágenes propias autorizadas.",
  },
  dental: {
    signal: "Clínica con tratamiento prioritario, coordinador y trazabilidad hasta aceptación.",
    opener: "Trabajamos sistemas por tratamiento para medir desde la primera visita hasta el plan aceptado. ¿Qué línea queréis hacer crecer sin llenar la agenda de citas que no asisten?",
    tension: "La cita reservada no paga la captación: asistencia, valoración y aceptación son las etapas que revelan el rendimiento.",
    questions: ["¿Qué tratamiento priorizáis?", "¿Cuál es la capacidad semanal?", "¿Quién confirma y sigue planes?", "¿Se registra el tratamiento aceptado?"],
    proof: "Enseñar captación, confirmación y seguimiento conectados al tratamiento aceptado.",
    noGo: "No avanzar sin coordinador, agenda o registro; nunca prometer resultados clínicos.",
  },
  inmobiliarias: {
    signal: "Agencia con foco hiperlocal, agente de captación y proceso de valoración.",
    opener: "Ayudamos a convertir campañas de propietarios en visitas de captación y encargos medibles, no en formularios de curiosos. ¿Qué barrios o tipologías queréis reforzar?",
    tension: "Una valoración sin intención, seguimiento ni agente disponible crea volumen aparente y cero cartera.",
    questions: ["¿Qué zonas domináis?", "¿Quién visita al propietario?", "¿Cómo seguís una valoración?", "¿Registráis el encargo firmado?"],
    proof: "Mostrar foco hiperlocal, intención de venta y seguimiento hasta encargo.",
    noGo: "No avanzar si quieren fingir compradores, garantizar precio o no tienen agente disponible.",
  },
  audicion: {
    signal: "Centro con agenda, consentimiento, atención accesible y trazabilidad de la valoración.",
    opener: "Trabajamos captación local prudente para llevar solicitudes hasta una valoración asistida y una solución propuesta. ¿Qué servicio tiene capacidad ahora?",
    tension: "En salud, la presión comercial y los claims agresivos dañan confianza además de aumentar el riesgo de cumplimiento.",
    questions: ["¿Qué servicio queréis priorizar?", "¿Quién confirma la cita?", "¿Cómo gestionáis consentimiento y privacidad?", "¿Registráis asistencia y propuesta?"],
    proof: "Enseñar un recorrido respetuoso desde consulta hasta valoración, sin diagnosticar desde publicidad.",
    noGo: "No avanzar si esperan diagnosticar, prometer mejora o usar datos sensibles sin un proceso adecuado.",
  },
  mudanzas: {
    signal: "Operador con rutas, inventario, capacidad y respuesta rápida de presupuesto.",
    opener: "Ayudamos a filtrar origen, destino, fecha y volumen antes de presupuestar. ¿Os falta demanda rentable o velocidad para responder a la que ya recibís?",
    tension: "La demanda fuera de ruta o fecha ocupa al equipo y esconde dónde sí hay capacidad rentable.",
    questions: ["¿Qué rutas son rentables?", "¿Qué fechas tienen capacidad?", "¿Cuánto tardáis en presupuestar?", "¿Qué servicios rechazáis?"],
    proof: "Mostrar captación por ruta e intención conectada con capacidad operativa.",
    noGo: "No avanzar si no controlan cobertura, fechas, inventario o velocidad de presupuesto.",
  },
};

export const COMMERCIAL_VERTICALS = CAPTURE_UNITS.map((unit) => ({
  ...unit,
  ...(INTEL[unit.id] || {
    signal: unit.decisionMaker,
    opener: `Estamos trabajando un sistema de captación específico para ${unit.name}, medido hasta ${unit.result.toLocaleLowerCase("es")}. ¿Es una prioridad ahora?`,
    tension: unit.problem,
    questions: unit.qualification.slice(0, 4).map((item) => `¿Cómo gestionáis ${item.toLocaleLowerCase("es")}?`),
    proof: unit.offer,
    noGo: unit.rejection.join("; "),
  }),
}));

export const CADENCE = [
  { day: 1, channel: "Llamada + email", objective: "Abrir una conversación", action: "Llamada breve al decisor. Si no responde, email de 5 líneas con una observación específica y una pregunta binaria." },
  { day: 2, channel: "LinkedIn", objective: "Dar contexto", action: "Visitar perfil y enviar conexión sin pitch: nombre, motivo sectorial y una frase." },
  { day: 3, channel: "Llamada", objective: "Validar prioridad", action: "Segundo intento en otra franja. Preguntar si crecimiento, capacidad o conversión es el cuello de botella." },
  { day: 5, channel: "Email", objective: "Aportar criterio", action: "Compartir el mapa de fuga típico del sector: demanda → respuesta → cita → resultado final." },
  { day: 6, channel: "Llamada", objective: "Conseguir decisión", action: "Referencia al email. Pedir 12 minutos o cerrar la secuencia si no es prioridad." },
  { day: 8, channel: "LinkedIn", objective: "Abrir vía alternativa", action: "Mensaje corto con pregunta sobre especialidad, zona, tratamiento o servicio prioritario." },
  { day: 10, channel: "Llamada + buzón", objective: "Dejar motivo claro", action: "Mensaje de menos de 25 segundos: por qué llamamos, qué queremos comprobar y cómo devolver la llamada." },
  { day: 12, channel: "Email", objective: "Reducir fricción", action: "Enviar checklist de encaje: oferta, capacidad, respuesta, seguimiento y trazabilidad." },
  { day: 15, channel: "Llamada + cierre", objective: "Cerrar el bucle", action: "Último intento. Confirmar si se archiva, se retoma en una fecha o se agenda diagnóstico." },
] as const;

export const CALL_DISPOSITIONS = [
  "No contesta",
  "Buzón de voz",
  "Gatekeeper",
  "Contacto incorrecto",
  "No encaja",
  "Retomar",
  "Conversación",
  "Reunión",
  "No contactar",
] as const;

export const CLOSER_SCORE = [
  { id: "focus", label: "Foco", question: "¿Existe una línea de servicio prioritaria y concreta?" },
  { id: "economics", label: "Economía", question: "¿Conocen ticket, margen o valor de la venta final?" },
  { id: "capacity", label: "Capacidad", question: "¿Pueden atender la demanda adicional esta semana o este mes?" },
  { id: "speed", label: "Velocidad", question: "¿Responden al contacto con rapidez y responsable claro?" },
  { id: "followup", label: "Seguimiento", question: "¿Hay un proceso para no contactados, no-shows y propuestas abiertas?" },
  { id: "tracking", label: "Trazabilidad", question: "¿Pueden devolver citas, ventas y valor por origen?" },
  { id: "proof", label: "Prueba", question: "¿Disponen de marca, material y prueba real autorizada?" },
  { id: "decision", label: "Decisión", question: "¿Está presente el decisor y existe una fecha de decisión?" },
] as const;

export const QA_CALL = [
  "Abre con permiso y motivo sectorial en menos de 25 segundos.",
  "Menciona una señal verificable de la empresa; no finge personalización.",
  "Formula una pregunta de prioridad antes de explicar RedVitalia.",
  "Explora el proceso actual antes de proponer un canal o una campaña.",
  "Comprueba encaje, capacidad y disponibilidad del decisor.",
  "No promete leads, ventas, posiciones, plazos ni resultados.",
  "Mantiene tono directo, pausado y respetuoso, incluso ante rechazo.",
  "Escucha y recoge palabras exactas del prospecto.",
  "Confirma decisor, capacidad y siguiente paso con fecha.",
  "Registra resultado, objeción y acción siguiente en el sistema.",
  "Respeta una petición de no contacto y las normas aplicables al canal.",
] as const;
