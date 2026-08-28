/**
 * Contenido editorial específico por vertical para la landing generada:
 * proceso (4 pasos), preguntas frecuentes (4), el problema contado con el
 * dolor real del sector y un color de acento propio. Sin cifras inventadas:
 * los números viven en la banda de mercado; aquí solo lenguaje del sector.
 */

export type VerticalContent = {
  accent: string;
  /** Fragmento SVG (viewBox 0 0 240 240, trazo) con el motivo del sector para el arte del hero. */
  motif: string;
  problema: string;
  steps: Array<{ title: string; text: string }>;
  faqs: Array<{ question: string; answer: string }>;
};

export const VERTICAL_CONTENT: Record<string, VerticalContent> = {
  "clinicas-salud": {
    accent: "#0e7490",
    motif: '<path d="M98 46h44v52h52v44h-52v52H98v-52H46V98h52z"/>',
    problema:
      "Huecos de agenda entre semana, primeras visitas que no aparecen y campañas que traen curiosos en lugar de pacientes. Mientras, la clínica de al lado está llena y nadie te explica por qué.",
    steps: [
      { title: "Cuéntanos tu clínica", text: "Especialidades, zona, capacidad de agenda y qué tratamiento quieres llenar primero." },
      { title: "Comprobamos tu zona", text: "Demanda real y competencia alrededor de tu clínica antes de prometer nada." },
      { title: "Pacientes que encajan", text: "Campañas y filtro de entrada: motivo de consulta, zona y disponibilidad antes de llegar a recepción." },
      { title: "Tu agenda decide", text: "El volumen se ajusta a los huecos reales de tu agenda, no al revés." },
    ],
    faqs: [
      { question: "¿Qué cuenta como paciente válido?", answer: "Una persona con motivo de consulta real, dentro de tu zona y con intención de reservar. Los duplicados, los datos falsos y quien busca otra especialidad no cuentan, y así queda por escrito." },
      { question: "¿Cómo llegan los pacientes a mi clínica?", answer: "Directamente a tu teléfono, WhatsApp o agenda, en cuanto dejan sus datos. Nada de listas compartidas: cada paciente es solo tuyo." },
      { question: "¿Funciona para mi especialidad?", answer: "Antes de aceptar tu caso comprobamos demanda y competencia de tu especialidad en tu zona. Si no vemos hueco, te lo decimos y no se firma." },
      { question: "¿Hay permanencia o renovación automática?", answer: "No. La duración, la renovación y la cancelación aparecen en la propuesta antes de pagar. La renovación se gana con resultados, no con letra pequeña." },
    ],
  },
  "reformas-hogar": {
    accent: "#c2571b",
    motif: '<path d="M38 126 120 54l82 72"/><path d="M62 118v76h116v-76"/><path d="M104 194v-44h32v44"/>',
    problema:
      "Presupuestos que haces gratis y no se firman, meses valle con las furgonetas paradas y portales que venden el mismo aviso a cuatro empresas a la vez. Trabajar no es el problema; conseguir obra buena, sí.",
    steps: [
      { title: "Cuéntanos tu empresa", text: "Tipo de obra que quieres, zona que cubres y cuántos presupuestos puedes atender al mes." },
      { title: "Comprobamos tu zona", text: "Demanda de reformas y competencia real en tu radio de trabajo antes de prometer volumen." },
      { title: "Obras con intención", text: "Filtro de entrada: tipo de obra, plazo y expectativa de presupuesto antes de que te llegue el contacto." },
      { title: "Tú eliges qué obra entra", text: "Cada aviso es tuyo en exclusiva; decides cuáles visitar sin pagar por curiosos." },
    ],
    faqs: [
      { question: "¿El aviso se lo pasáis a más empresas?", answer: "No. Cada solicitud es tuya en exclusiva. Es la diferencia con los portales: no compites contra tres presupuestos más que salieron del mismo formulario." },
      { question: "¿Qué pasa con los curiosos y los 'solo mirar precios'?", answer: "El formulario pregunta tipo de obra, plazo y expectativa antes de entregarte el contacto. Los datos falsos o fuera de tu zona no cuentan como entregados." },
      { question: "¿Puedo elegir el tipo de obra?", answer: "Sí: baños, cocinas, integrales, locales… la campaña se monta sobre lo que te interesa, y se excluye lo que no." },
      { question: "¿Hay permanencia?", answer: "No. Condiciones, duración y cancelación van en la propuesta, por escrito, antes de pagar nada." },
    ],
  },
  "solar-energia": {
    accent: "#b45309",
    motif: '<circle cx="120" cy="120" r="42"/><path d="M120 34v26M120 180v26M34 120h26M180 120h26M59 59l18 18M163 163l18 18M181 59l-18 18M77 163l-18 18"/>',
    problema:
      "El boom pasó y ahora cada instalación se pelea: clientes que piden tres ofertas, subvenciones que confunden y campañas que traen curiosos sin tejado propio. La instaladora que sobrevive es la que controla su entrada de proyectos.",
    steps: [
      { title: "Cuéntanos tu instaladora", text: "Zona de trabajo, tipo de instalación (residencial, industrial, comunidades) y capacidad mensual." },
      { title: "Comprobamos la demanda", text: "Interés real de autoconsumo en tu zona y quién más está captando allí." },
      { title: "Proyectos con base", text: "Filtro de entrada: titularidad del inmueble, tipo de cubierta y motivación antes de pasarte el contacto." },
      { title: "Tú dimensionas", text: "El volumen se pacta según tu capacidad de instalación, no según lo que aguante tu paciencia." },
    ],
    faqs: [
      { question: "¿Qué cuenta como proyecto válido?", answer: "Propietario o decisor con inmueble apto en tu zona e interés real en instalar. Quien no cumple eso no cuenta como entregado, y queda por escrito." },
      { question: "¿Residencial o industrial?", answer: "La campaña se monta sobre el segmento que te interesa. Si haces las dos cosas, se separan para que puedas medir cada una." },
      { question: "¿Cómo evitáis a los que solo comparan?", answer: "Preguntando lo incómodo antes: titularidad, tipo de cubierta y plazo. No lo eliminamos todo, pero el filtro se nota desde la primera semana." },
      { question: "¿Hay permanencia?", answer: "No. Duración, renovación y cancelación van en la propuesta antes de pagar." },
    ],
  },
  inmobiliario: {
    accent: "#0f766e",
    motif: '<path d="M42 198V116h44V76h44v58h44v-38h28v102"/><path d="M30 198h180"/>',
    problema:
      "Compradores hay; lo que falta es producto. Captar al propietario que vende cuesta más que vender el piso, y los portales te tienen pagando por estar donde están todos. El encargo en exclusiva es la batalla real.",
    steps: [
      { title: "Cuéntanos tu agencia", text: "Zona de captación, tipo de inmueble objetivo y capacidad de tu equipo comercial." },
      { title: "Comprobamos tu plaza", text: "Rotación, competencia y presión de captación en tu zona antes de prometer encargos." },
      { title: "Propietarios con intención", text: "Filtro de entrada: motivo de venta, plazo y expectativa de precio antes de pasarte el contacto." },
      { title: "Tú cierras la exclusiva", text: "Te entregamos al propietario; la valoración y la firma de la exclusiva son tuyas." },
    ],
    faqs: [
      { question: "¿Qué cuenta como encargo potencial válido?", answer: "Propietario real, en tu zona, con intención de vender en un plazo razonable. Curiosos de tasación sin intención no cuentan como entregados." },
      { question: "¿El contacto se comparte con otras agencias?", answer: "No. Cada propietario que te entregamos es tuyo en exclusiva. No somos un portal." },
      { question: "¿Funciona en mi zona?", answer: "Se comprueba antes de firmar: rotación de vivienda y competencia de tu plaza. Si tu zona no da, te lo decimos y no se empieza." },
      { question: "¿Hay permanencia?", answer: "No. Todas las condiciones van en la propuesta, por escrito, antes de cualquier pago." },
    ],
  },
  legal: {
    accent: "#1e3a8a",
    motif: '<path d="M120 44v140M74 66h92M74 66l-28 54M74 66l28 54M166 66l-28 54M166 66l28 54"/><path d="M46 120a28 28 0 0 0 56 0M138 120a28 28 0 0 0 56 0M92 198h56"/>',
    problema:
      "El despacho vive del boca a boca y del que llama tarde y mal. Los casos rentables no llegan solos, y la publicidad jurídica mal hecha trae consultas que no puedes cobrar. Captar sin perder el prestigio es el equilibrio difícil.",
    steps: [
      { title: "Cuéntanos tu despacho", text: "Áreas de práctica, zona y qué tipo de asunto quieres captar (y cuál no)." },
      { title: "Comprobamos la demanda", text: "Búsquedas y competencia de tu área de práctica en tu zona antes de prometer consultas." },
      { title: "Consultas con fundamento", text: "Filtro de entrada: tipo de asunto, situación y urgencia antes de que llegue a tu mesa." },
      { title: "Tu criterio decide", text: "Aceptas los asuntos que encajan; los que no, no cuentan ni se cobran." },
    ],
    faqs: [
      { question: "¿Qué cuenta como consulta válida?", answer: "Un asunto real de tu área de práctica, en tu zona, con datos de contacto verificables. Consultas de otra materia o sin fundamento no cuentan como entregadas." },
      { question: "¿Es compatible con la deontología?", answer: "La captación se hace con publicidad lícita del despacho e información veraz; sin promesas de resultado judicial y sin comisiones por asunto." },
      { question: "¿Puedo excluir tipos de asunto?", answer: "Sí. Se define desde el primer día qué entra y qué no, y el filtro lo aplica antes de llegar a ti." },
      { question: "¿Hay permanencia?", answer: "No. Condiciones completas en la propuesta, por escrito, antes de pagar." },
    ],
  },
  "coches-motor": {
    accent: "#b91c1c",
    motif: '<path d="M40 142h18l24-36h76l24 36h18v34h-14"/><path d="M92 176H64M172 176h-24"/><circle cx="78" cy="176" r="16"/><circle cx="186" cy="176" r="16"/>',
    problema:
      "La campa vacía no factura. Los coches buenos vuelan y los particulares no saben que puedes resolverles la venta hoy. Comprar vehículo con criterio es tan difícil como venderlo: el flujo de entrada manda.",
    steps: [
      { title: "Cuéntanos tu compraventa", text: "Qué vehículo buscas, zona de compra y capacidad de valoración semanal." },
      { title: "Comprobamos tu zona", text: "Oferta de particulares y competencia de compra en tu radio antes de prometer volumen." },
      { title: "Vehículos con datos", text: "Filtro de entrada: marca, modelo, año, kilómetros y situación del vehículo antes de pasarte el contacto." },
      { title: "Tú valoras y compras", text: "Te llega el vehículo documentado; la tasación y la oferta son tuyas." },
    ],
    faqs: [
      { question: "¿Qué cuenta como vehículo válido?", answer: "Un particular con vehículo real, documentación localizable y disposición a vender. Los datos falsos o vehículos fuera de tu perfil de compra no cuentan." },
      { question: "¿Puedo definir el perfil de vehículo?", answer: "Sí: antigüedad, kilómetros, segmento y hasta situaciones especiales (cargas, financiación pendiente) si las trabajas." },
      { question: "¿Cómo llega el contacto?", answer: "Directo a tu teléfono o WhatsApp con los datos del vehículo, en cuanto el particular los deja." },
      { question: "¿Hay permanencia?", answer: "No. Condiciones por escrito en la propuesta antes de pagar nada." },
    ],
  },
  "b2b-sdr": {
    accent: "#4338ca",
    motif: '<path d="M56 200v-56M112 200v-88M168 200v-120"/><path d="M56 96l112-52M150 38l24-2-6 24"/>',
    problema:
      "El pipeline no se llena solo y tu equipo pierde horas en prospección fría que no llega a agenda. Las reuniones que sí valen son con decisores que encajan en tu cliente ideal — y eso exige método, no suerte.",
    steps: [
      { title: "Definimos tu cliente ideal", text: "Sector, tamaño, cargo del decisor y qué problema le resuelves." },
      { title: "Comprobamos el mercado", text: "Volumen real de cuentas objetivo y saturación de tu propuesta antes de prometer reuniones." },
      { title: "Reuniones cualificadas", text: "Prospección multicanal con filtro: solo pasa a tu agenda el decisor que encaja y acepta la reunión." },
      { title: "Tu equipo cierra", text: "Nosotros llenamos la agenda; la conversación comercial y el cierre son tuyos." },
    ],
    faqs: [
      { question: "¿Qué cuenta como reunión válida?", answer: "Reunión aceptada y celebrada con un decisor dentro del perfil pactado. Los no-show se reponen según las condiciones firmadas." },
      { question: "¿Con qué canales trabajáis?", answer: "Los que encajen con tu cliente ideal. La mezcla exacta se define en la propuesta y puedes auditarla." },
      { question: "¿Usáis mi marca o la vuestra?", answer: "Siempre tu marca y con tu aprobación de mensajes. Nada sale sin que lo hayas visto." },
      { question: "¿Hay permanencia?", answer: "No. Alcance, condiciones y cancelación por escrito antes de empezar." },
    ],
  },
  "directorios-marketplaces": {
    accent: "#0369a1",
    motif: '<rect x="46" y="46" width="40" height="40" rx="8"/><rect x="100" y="46" width="40" height="40" rx="8"/><rect x="154" y="46" width="40" height="40" rx="8"/><rect x="46" y="100" width="40" height="40" rx="8"/><rect x="100" y="100" width="40" height="40" rx="8"/><rect x="154" y="100" width="40" height="40" rx="8"/><rect x="46" y="154" width="40" height="40" rx="8"/><rect x="100" y="154" width="40" height="40" rx="8"/><rect x="154" y="154" width="40" height="40" rx="8"/>',
    problema:
      "El clásico problema del huevo y la gallina: sin demanda los profesionales se van, y sin oferta la demanda no vuelve. Comprar demanda cara para repartirla mal es la forma más rápida de quemar la plataforma.",
    steps: [
      { title: "Entendemos tu plataforma", text: "Qué lado te falta (oferta o demanda), en qué categorías y en qué zonas." },
      { title: "Comprobamos el mercado", text: "Coste real de captar cada lado en tus categorías antes de prometer volumen." },
      { title: "Solicitudes con destino", text: "Campañas y filtro de entrada para que cada solicitud llegue a la categoría y zona correctas." },
      { title: "Tu producto reparte", text: "Nosotros llenamos la entrada; el matching y la experiencia son tuyos." },
    ],
    faqs: [
      { question: "¿Qué cuenta como solicitud válida?", answer: "Una petición real, en categoría y zona activas de tu plataforma, con datos de contacto verificables. El resto no cuenta como entregado." },
      { question: "¿Podéis captar los dos lados?", answer: "Sí, pero por fases y con métricas separadas: mezclar oferta y demanda en una misma campaña es tirar el presupuesto." },
      { question: "¿Cómo se integra con nuestro producto?", answer: "Entrega por webhook o API a tu backend, con los campos que tu matching necesita." },
      { question: "¿Hay permanencia?", answer: "No. Todo el alcance va por escrito en la propuesta antes de pagar." },
    ],
  },
  "belleza-bienestar": {
    accent: "#be185d",
    motif: '<circle cx="120" cy="78" r="30"/><circle cx="78" cy="120" r="30"/><circle cx="162" cy="120" r="30"/><circle cx="120" cy="162" r="30"/><circle cx="120" cy="120" r="14"/>',
    problema:
      "Cabinas vacías de lunes a jueves, clientas que compran el bono de oferta y no vuelven, y la agenda dependiendo de Instagram. Llenar entre semana con clienta que repite es otro deporte.",
    steps: [
      { title: "Cuéntanos tu centro", text: "Servicios estrella, huecos que quieres llenar y zona de tu clientela." },
      { title: "Comprobamos tu zona", text: "Demanda y competencia alrededor del centro antes de prometer reservas." },
      { title: "Reservas con intención", text: "Campañas y filtro: servicio, disponibilidad y zona antes de que llegue la reserva." },
      { title: "Tu agenda manda", text: "El volumen se ajusta a tus huecos reales, priorizando los días que quieres llenar." },
    ],
    faqs: [
      { question: "¿Qué cuenta como reserva válida?", answer: "Una persona de tu zona que reserva un servicio real contigo. Las citas falsas o duplicadas no cuentan como entregadas." },
      { question: "¿Puedo promocionar solo ciertos servicios?", answer: "Sí, la campaña se monta sobre los servicios y franjas que te interesa llenar." },
      { question: "¿Cómo reduzco los no-show?", answer: "Confirmación previa y recordatorio en el flujo de reserva; las condiciones de reposición van en la propuesta." },
      { question: "¿Hay permanencia?", answer: "No. Condiciones por escrito antes de pagar, cancelación incluida." },
    ],
  },
  "hosteleria-turismo": {
    accent: "#a16207",
    motif: '<path d="M58 156a62 62 0 0 1 124 0"/><path d="M40 156h160"/><circle cx="120" cy="82" r="8"/><path d="M74 196h92"/>',
    problema:
      "Llenar el fin de semana no tiene mérito; el negocio se decide de lunes a jueves. Y cada reserva que entra por plataforma te cuesta comisión y te esconde al cliente. La reserva directa es la que deja margen.",
    steps: [
      { title: "Cuéntanos tu negocio", text: "Tipo de establecimiento, franjas que quieres llenar y de dónde viene tu cliente." },
      { title: "Comprobamos tu plaza", text: "Demanda y competencia en tu zona y temporada antes de prometer reservas." },
      { title: "Reservas directas", text: "Campañas que llevan la reserva a tu canal, no al de la comisión." },
      { title: "Tu servicio fideliza", text: "Nosotros traemos la primera visita; la repetición la gana tu producto." },
    ],
    faqs: [
      { question: "¿Qué cuenta como reserva válida?", answer: "Una reserva real en tu canal directo, dentro de las franjas pactadas. Las cancelaciones inmediatas y duplicados no cuentan." },
      { question: "¿Puedo centrarme en días concretos?", answer: "Sí: la campaña prioriza las franjas que quieres llenar, no las que se llenan solas." },
      { question: "¿Compite esto con las plataformas?", answer: "Convive: el objetivo es subir el peso de tu canal directo, que es el que no paga comisión." },
      { question: "¿Hay permanencia?", answer: "No. Condiciones completas en la propuesta antes de pagar." },
    ],
  },
  generalista: {
    accent: "#1769e0",
    motif: '<circle cx="120" cy="120" r="78"/><circle cx="120" cy="120" r="48"/><circle cx="120" cy="120" r="18"/>',
    problema:
      "Un mes bien y dos regular, dependiendo del boca a boca y de campañas sueltas que nadie mide. Sin un sistema de entrada estable, cada mes empieza de cero.",
    steps: [
      { title: "Cuéntanos tu negocio", text: "Qué vendes, a quién, en qué zona y cuánta capacidad tienes para atender más clientes." },
      { title: "Comprobamos el encaje", text: "Demanda y competencia de tu servicio en tu zona antes de confirmar nada." },
      { title: "Clientes con filtro", text: "Campañas y filtro de entrada para que llegue quien puede comprarte, no quien pasaba por ahí." },
      { title: "Decides con datos", text: "Coste por cliente visible cada semana; se escala lo que funciona y se corta lo que no." },
    ],
    faqs: [
      { question: "¿Qué cuenta como cliente potencial válido?", answer: "Una persona o negocio de tu zona con necesidad real de tu servicio y datos de contacto verificables. El resto no cuenta como entregado." },
      { question: "¿Cómo sé que esto funciona para mi sector?", answer: "Se comprueba antes de firmar: demanda y competencia de tu caso concreto. Si no hay hueco, te lo decimos." },
      { question: "¿Qué recibo exactamente cada mes?", answer: "Los contactos entregados, su coste y su estado, en un informe que entiendes sin ser marketero." },
      { question: "¿Hay permanencia?", answer: "No. Todas las condiciones van en la propuesta, por escrito, antes de pagar." },
    ],
  },
};
