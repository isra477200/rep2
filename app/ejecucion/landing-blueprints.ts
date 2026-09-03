import { CAPTURE_UNITS, type CampaignMode, type CaptureUnit } from "./catalog.ts";

export type LandingBlueprint = {
  slug: string;
  unitId: string;
  mode: CampaignMode;
  name: string;
  kicker: string;
  headline: string;
  subheadline: string;
  cta: string;
  secondaryCta?: string;
  fit: string[];
  notFit: string[];
  fields: string[];
  process: string[];
  faq: Array<{ question: string; answer: string }>;
  event: string;
  intentCluster: string;
  proofNeeded: string[];
  sourceFields: string[];
  compliance: string;
  related: Array<{ label: string; href: string }>;
};

const sourceFields = [
  "gclid",
  "gbraid",
  "wbraid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "msclkid",
  "landing_route",
  "intent_cluster",
];

const landingSlug = (unit: CaptureUnit) => unit.landing.split("/").filter(Boolean).at(-1) || unit.id;

const b2bBlueprint = (unit: CaptureUnit): LandingBlueprint => ({
  slug: `${unit.id}-b2b`,
  unitId: unit.id,
  mode: "B2B",
  name: `Landing B2B · ${unit.name}`,
  kicker: `SISTEMA DE CAPTACIÓN PARA ${unit.system.toLocaleUpperCase("es")}`,
  headline: `${unit.result.replace(/[.!?]+$/, "")}: medir el resultado, no solo el formulario.`,
  subheadline: `RedVitalia propone un piloto de ${unit.offer.toLocaleLowerCase("es")} La campaña solo se activa después de comprobar capacidad, margen y seguimiento.`,
  cta: "Solicitar diagnóstico",
  secondaryCta: "Ver condiciones de entrada",
  fit: [
    `Empresa de ${unit.system.toLocaleLowerCase("es")} con capacidad comercial real.`,
    `Puede responder y dar seguimiento dentro del SLA acordado.`,
    `Acepta registrar ${unit.result.toLocaleLowerCase("es")} y su valor.`,
    "Dispone de zona, oferta y presupuesto de medios definidos.",
  ],
  notFit: [
    "Busca volumen garantizado o resultados que no controla RedVitalia.",
    "No puede devolver estados y valor desde su proceso comercial.",
    "No tiene capacidad semanal o atención suficiente.",
    ...unit.rejection.slice(0, 2),
  ],
  fields: [
    "Empresa y sitio web",
    "Nombre, cargo y teléfono",
    "Servicio o subnicho prioritario",
    "Zona de cobertura",
    "Ticket y margen aproximados",
    "Capacidad semanal",
    "Tiempo actual de respuesta",
    "CRM o método de seguimiento",
  ],
  process: [
    "Revisar oferta, zona, capacidad, activos y reputación.",
    "Definir oportunidad válida, SLA y resultado económico.",
    "Preparar landing, campañas, creatividades y medición.",
    "Lanzar solo con aprobación humana y cerrar el ciclo desde CRM.",
  ],
  faq: [
    { question: "¿RedVitalia garantiza ventas?", answer: "No. Diseña y opera el sistema de captación; la capacidad, la atención y el cierre siguen siendo variables del negocio." },
    { question: "¿Qué se considera un buen resultado?", answer: unit.result },
    { question: "¿Cuándo se puede escalar?", answer: "Cuando la contribución, la calidad y la capacidad se sostienen con datos, no solo cuando baja el CPL." },
    { question: "¿Qué falta antes de publicar?", answer: "Cliente, brand kit, pruebas autorizadas, zona, presupuesto, responsable de aprobación y configuración de medición." },
  ],
  event: `lead_form_submit_b2b_${unit.id.replaceAll("-", "_")}`,
  intentCluster: `${unit.id.replaceAll("-", "_")}_b2b`,
  proofNeeded: ["Marca y datos legales aprobados", "Pruebas o casos autorizados", "Cobertura y capacidad verificadas", "Privacidad, consentimiento y canal de envío"],
  sourceFields,
  compliance: unit.compliance,
  related: [
    { label: "Campaña B2B", href: `/campanas?unidad=${unit.id}&modo=B2B` },
    { label: "Creatividades B2B", href: `/biblioteca-creativa?unidad=${unit.id}&modo=B2B` },
  ],
});

const b2cBlueprint = (unit: CaptureUnit): LandingBlueprint => ({
  slug: landingSlug(unit),
  unitId: unit.id,
  mode: "B2C",
  name: `Landing B2C · ${unit.name}`,
  kicker: unit.system.toLocaleUpperCase("es"),
  headline: `${unit.name}: revisamos el encaje antes de avanzar.`,
  subheadline: `${unit.problem} El formulario recoge los datos mínimos para comprobar si el caso encaja y explicar el siguiente paso sin garantías inventadas.`,
  cta: unit.systemId === "coches" ? "Comprobar si mi coche es valorable" : "Revisar mi caso",
  secondaryCta: "Ver casos que no encajan",
  fit: unit.qualification.slice(0, 4).map((item) => `${item} disponible o identificable.`),
  notFit: unit.rejection,
  fields: [...unit.qualification, "Teléfono", "Consentimiento de contacto"],
  process: [
    "Envías solo la información mínima del caso.",
    "Se comprueba zona, servicio, legitimidad y encaje.",
    "Un profesional confirma el siguiente paso y, cuando procede, agenda.",
    `El resultado final se registra como ${unit.result.toLocaleLowerCase("es")}`,
  ],
  faq: [
    { question: "¿Enviar el formulario garantiza que acepten el caso?", answer: "No. Primero se revisan los datos, la cobertura y las condiciones reales." },
    { question: "¿Qué información pedirán al principio?", answer: unit.qualification.slice(0, 5).join(", ") + "." },
    { question: "¿Qué ocurre después?", answer: "Si existe encaje, se confirma por teléfono el siguiente paso. La cita, oferta o presupuesto se mide por separado." },
    { question: "¿Qué no se puede prometer?", answer: unit.compliance },
  ],
  event: unit.id === "coches" ? "lead_form_submit_con_cargas" : `lead_form_submit_${unit.id.replaceAll("-", "_")}`,
  intentCluster: unit.id === "coches" ? "con_cargas" : unit.id.replaceAll("-", "_"),
  proofNeeded: ["Identidad y marca del cliente", "Pruebas reales autorizadas", "Cobertura y horario", "Datos legales, privacidad y consentimiento"],
  sourceFields,
  compliance: unit.compliance,
  related: [
    { label: "Campaña B2C", href: `/campanas?unidad=${unit.id}&modo=B2C` },
    { label: "Creatividades B2C", href: `/biblioteca-creativa?unidad=${unit.id}&modo=B2C` },
  ],
});

const carUnit = CAPTURE_UNITS.find((unit) => unit.id === "coches")!;

const carTriageBlueprint: LandingBlueprint = {
  ...b2cBlueprint(carUnit),
  name: "Landing B2C · Coches con cargas",
  kicker: "PROPIETARIOS · CARGA DESCONOCIDA O DUDOSA",
  headline: "Identifica la carga antes de decidir cómo vender tu coche.",
  subheadline: "Elige reserva, embargo, financiación o “no lo sé”. Revisamos titularidad, deuda y documentación para llevar cada caso al recorrido correcto sin prometer compra ni precio.",
  cta: "Identificar mi caso",
  fields: ["Marca y modelo", "Año", "Kilómetros", "Provincia", "Tipo de carga: reserva, embargo, financiado, otra o no lo sé", "Importe aproximado, si se conoce", "Titularidad", "Teléfono", "Consentimiento de contacto"],
  fit: ["Eres propietario o representante acreditado.", "Quieres vender el vehículo.", "Conoces la carga o necesitas identificarla.", "Aceptas una revisión antes de hablar de oferta."],
  notFit: ["Quieres comprar coches de subasta.", "Buscas asesoría sin intención de vender.", "No tienes titularidad ni representación.", "Esperas compra o precio garantizados."],
  process: ["Eliges la carga o marcas “no lo sé”.", "Se comprueban titularidad, deuda y documentación básica.", "El caso pasa al silo correcto y se valora su viabilidad.", "Tasación, oferta, aceptación y compra quedan como hitos separados."],
  faq: [
    { question: "¿Y si no sé qué carga tiene?", answer: "El selector conserva la opción “no lo sé” para revisar el caso sin obligarte a adivinar." },
    { question: "¿Esta página vende coches de subasta?", answer: "No. Está dirigida a propietarios o representantes que quieren vender." },
    { question: "¿Enviar los datos garantiza una compra?", answer: "No. Primero se revisa la viabilidad; tasación, oferta y compra son decisiones posteriores." },
    { question: "¿Tengo que enviar documentos sensibles?", answer: "No en el primer paso. La documentación se solicita por un canal aprobado después de confirmar encaje." },
  ],
};

const carBlueprints: LandingBlueprint[] = [
  {
    ...b2cBlueprint(carUnit),
    slug: "vender-coche-reserva-dominio",
    name: "Landing B2C · Reserva de dominio",
    kicker: "PROPIETARIOS · RESERVA DE DOMINIO",
    headline: "Calcula si puedes vender tu coche con reserva de dominio.",
    subheadline: "Revisamos vehículo, deuda y financiera para valorar si la operación es viable antes de que canceles nada a ciegas.",
    cta: "Revisar mi reserva",
    fields: ["Marca y modelo", "Año", "Kilómetros", "Provincia", "Deuda pendiente aproximada", "Financiera, si se conoce", "Titularidad", "Teléfono", "Consentimiento de contacto"],
    fit: ["Eres titular o representante acreditado.", "Quieres vender, no comprar un coche de subasta.", "Puedes identificar la financiera o la deuda aproximada.", "El vehículo y la documentación pueden revisarse."],
    notFit: ["Buscas asesoría legal sin intención de vender.", "No eres titular ni representante.", "Vehículo robado o documentación imposible.", "Esperas una compra o precio garantizados."],
    process: ["Envías vehículo, deuda y financiera.", "Se revisa la reserva y la documentación disponible.", "Se calcula la viabilidad y una posible oferta neta.", "Si aceptas, se acuerdan cancelación, pago y recogida."],
    faq: [
      { question: "¿Tengo que cancelar antes?", answer: "No necesariamente. La propuesta es revisar primero la viabilidad; el proceso concreto depende de la financiera y la documentación." },
      { question: "¿Y si debo más de lo que vale?", answer: "Puede no ser viable. Se compara deuda, valor y costes antes de pedirte que avances." },
      { question: "¿Quién habla con la financiera?", answer: "Debe definirse en la operación real. La landing no promete intermediación hasta que el comprador confirme su proceso." },
      { question: "¿Enviar datos garantiza una oferta?", answer: "No. Permite revisar el caso; tasación, oferta y compra son hitos distintos." },
    ],
    event: "lead_form_submit_reserva",
    intentCluster: "reserva_dominio",
  },
  {
    ...b2cBlueprint(carUnit),
    slug: "vender-coche-embargado",
    name: "Landing B2C · Embargo o precinto",
    kicker: "SOLO PROPIETARIOS QUE QUIEREN VENDER",
    headline: "Consulta si puedes vender tu coche con embargo.",
    subheadline: "Revisamos titularidad, tipo de embargo o precinto e importe aproximado antes de hablar de precio. Esta página no vende coches de subasta.",
    cta: "Revisar mi embargo",
    fields: ["Marca y modelo", "Año", "Kilómetros", "Provincia", "Tipo de embargo o precinto", "Importe aproximado", "Titularidad", "Teléfono", "Consentimiento de contacto"],
    fit: ["Eres propietario o representante acreditado.", "Quieres vender el vehículo.", "Puedes indicar el tipo de embargo, aunque sea desconocido.", "Aceptas una revisión antes de recibir oferta."],
    notFit: ["Quieres comprar vehículos embargados o de subasta.", "Buscas solo asesoría jurídica.", "No tienes legitimidad sobre el vehículo.", "Esperas una compra inmediata garantizada."],
    process: ["Identificas vehículo, titularidad y carga.", "Se revisa si es embargo, precinto u otra anotación.", "Se valora viabilidad y condiciones de la operación.", "Solo después puede emitirse una oferta y acordarse la gestión."],
    faq: [
      { question: "¿Se puede vender siempre?", answer: "No. Depende del tipo de carga, importe, titularidad, documentación y proceso del comprador." },
      { question: "¿Esta página es para subastas?", answer: "No. Está dirigida a propietarios que quieren vender su vehículo." },
      { question: "¿Qué ocurre si hay precinto?", answer: "Debe revisarse de forma específica antes de prometer traslado, transferencia o compra." },
      { question: "¿Qué documentos hacen falta?", answer: "Al principio bastan los datos básicos; la documentación exacta se solicita después de confirmar encaje." },
    ],
    event: "lead_form_submit_embargo",
    intentCluster: "embargo_precinto",
  },
  {
    ...b2cBlueprint(carUnit),
    slug: "vender-coche-financiado",
    name: "Landing B2C · Financiación pendiente",
    kicker: "PROPIETARIOS · FINANCIACIÓN PENDIENTE",
    headline: "Revisamos la financiación antes de calcular la venta neta.",
    subheadline: "Si aún pagas el coche o no sabes si existe reserva de dominio, ordenamos deuda, contrato y vehículo antes de hablar de una posible oferta.",
    cta: "Revisar mi financiación",
    fields: ["Marca y modelo", "Año", "Kilómetros", "Provincia", "Financiera o tipo de préstamo", "Cuota o deuda aproximada", "Titularidad", "Teléfono", "Consentimiento de contacto"],
    fit: ["Eres titular o representante acreditado.", "Quieres vender el vehículo.", "Existe un préstamo, leasing o financiación pendiente.", "Puedes aportar datos básicos del contrato después del primer contacto."],
    notFit: ["Quieres refinanciar sin vender.", "Buscas asesoría jurídica aislada.", "No tienes legitimidad sobre el vehículo.", "Esperas un precio garantizado sin revisión."],
    process: ["Envías vehículo, financiera y deuda aproximada.", "Se comprueba el tipo de financiación y si existe reserva.", "Se calcula la posible venta neta y la viabilidad.", "Si encaja, se acuerdan documentos, pago, cancelación y recogida."],
    faq: [
      { question: "¿Financiado y reserva de dominio son lo mismo?", answer: "No siempre. La revisión debe confirmar el contrato y las anotaciones del vehículo." },
      { question: "¿Puedo saber cuánto me quedaría?", answer: "Solo tras contrastar valor, deuda y costes. La landing no presenta una cifra automática como oferta." },
      { question: "¿Pedirán documentos al principio?", answer: "No se pide documentación sensible en el primer paso; se solicita después si el caso encaja." },
      { question: "¿La valoración obliga a vender?", answer: "No. Revisión, oferta y aceptación son pasos separados." },
    ],
    event: "lead_form_submit_financiado",
    intentCluster: "financiado_pendiente",
  },
];

const baseBlueprints = CAPTURE_UNITS.flatMap((unit) => [b2bBlueprint(unit), unit.id === "coches" ? carTriageBlueprint : b2cBlueprint(unit)]);

export const LANDING_BLUEPRINTS = [...baseBlueprints, ...carBlueprints];

export const getLandingBlueprint = (slug: string) => LANDING_BLUEPRINTS.find((item) => item.slug === slug);

export const CAR_TRIAGE_LINKS = [
  { label: "Reserva de dominio", description: "Hay una limitación registral ligada a la financiación.", href: "/landings/vender-coche-reserva-dominio" },
  { label: "Embargo o precinto", description: "Existe o puede existir una anotación administrativa o judicial.", href: "/landings/vender-coche-embargado" },
  { label: "Financiación pendiente", description: "Quedan cuotas o deuda y no sabes si hay reserva.", href: "/landings/vender-coche-financiado" },
];
