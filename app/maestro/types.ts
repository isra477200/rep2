export type MaestroMode = "ask" | "analyze" | "create" | "audit";

export type MaestroMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  mode: MaestroMode;
};

export type MaestroTask = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  mode: MaestroMode;
  status: "Listo" | "Archivado";
};

export type MaestroStatus = "checking" | "ready" | "offline" | "unconfigured";

export const MAESTRO_MODES: Array<{
  id: MaestroMode;
  label: string;
  short: string;
  description: string;
  placeholder: string;
  prompts: string[];
}> = [
  {
    id: "ask",
    label: "Preguntar",
    short: "Respuesta ejecutiva",
    description: "Resuelve dudas usando el contexto completo de RedVitalia.",
    placeholder: "Pregunta por una campaña, un sistema, una decisión o cualquier parte de la aplicación…",
    prompts: [
      "¿Qué debería ejecutar primero esta semana y por qué?",
      "Explícame las diferencias entre las cuatro vías del sistema legal.",
      "¿Dónde están los mejores materiales para preparar una reunión comercial?",
    ],
  },
  {
    id: "analyze",
    label: "Analizar",
    short: "Comparar y decidir",
    description: "Cruza alternativas, economía, riesgos y señales disponibles.",
    placeholder: "Describe la decisión que necesitas tomar y los límites que debemos respetar…",
    prompts: [
      "Compara los tres sistemas con mejor posibilidad de conseguir clientes en 30 días.",
      "Analiza si conviene priorizar Google Ads, prospección o alianzas para clínicas.",
      "Detecta cuellos de botella entre caller, closer y campañas.",
    ],
  },
  {
    id: "create",
    label: "Crear entregable",
    short: "Encargo completo",
    description: "Produce una pieza terminada y reutilizable dentro del chat.",
    placeholder: "Pide el entregable completo: propuesta, guion, plan, briefing, secuencia, checklist…",
    prompts: [
      "Crea una propuesta comercial completa para captar un despacho de herencias.",
      "Prepara un guion de llamada fría y cinco seguimientos para compraventa de coches.",
      "Construye un plan de validación de 30 días para centros estéticos.",
    ],
  },
  {
    id: "audit",
    label: "Auditar",
    short: "Encontrar fallos",
    description: "Señala contradicciones, ausencias y correcciones prioritarias.",
    placeholder: "Indica qué parte quieres someter a una revisión severa…",
    prompts: [
      "Audita la propuesta de valor de RedVitalia y localiza promesas que requieren prueba.",
      "Revisa el sistema comercial completo y prioriza cinco correcciones.",
      "Audita la coherencia entre campañas, landings y métricas de decisión.",
    ],
  },
];

export const maestroMode = (mode: MaestroMode) => MAESTRO_MODES.find((item) => item.id === mode) || MAESTRO_MODES[0];
