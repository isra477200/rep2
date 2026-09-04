"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import CompanyLogo from "./CompanyLogo";
import type { ArsenalData, CrucesData, LogoManifest, VerticalesData } from "./data-types";
import { applyMarketAmmo, buildMarketAmmo } from "./landings/market-ammo";
import { buildZip } from "./landings/zip";
import {
  ANGLES,
  ARCHITECTURES,
  AUTOMOTIVE_INTENTS,
  AUTOMOTIVE_MARKET_REFERENCES,
  applyAutomotiveIntent,
  applyEvidenceRecipe,
  applyStrategyRecommendation,
  applyVerticalPreset,
  buildEvidenceRecipes,
  buildLandingHtml,
  buildStrategyRecommendation,
  defaultBrief,
  landingCopyPreview,
  landingReadiness,
  type LandingBrief,
  type LandingIntelligence,
  type LandingSectionId,
} from "./landings/model";
import styles from "./LandingStudio.module.css";

type LandingStudioProps = {
  verticales: VerticalesData | null;
  logos: LogoManifest;
};

type Device = "desktop" | "mobile";
type EditorSection = "strategy" | "message" | "evidence" | "conversion";

const STORAGE_KEY = "rv-landing-studio-v4";

const safeParse = (raw: string | null): LandingBrief | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LandingBrief>;
    return { ...defaultBrief(value.verticalId), ...value } as LandingBrief;
  } catch {
    return null;
  }
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const download = (filename: string, content: string, type: string) =>
  downloadBlob(filename, new Blob([content], { type }));

const VARIANT_META = [
  ["a", "A · Resultado", "resultado"],
  ["b", "B · Dolor", "dolor"],
  ["c", "C · Compromiso", "compromiso"],
] as const;

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "landing";

const FIELD_LABELS: Record<string, string> = {
  headline: "Titular",
  promise: "Promesa",
  audience: "Público",
  offer: "Oferta",
  mechanism: "Mecanismo",
  primaryCta: "CTA",
  proof: "Prueba",
  price: "Precio",
  guarantee: "Riesgo/garantía",
  funnel: "Recorrido",
};

const SECTION_LABELS: Record<LandingSectionId, string> = {
  problem: "Problema",
  qualification: "Casos y encaje",
  mechanism: "Proceso",
  offer: "Oferta",
  proof: "Prueba",
  pricing: "Precio",
  guarantee: "Compromiso",
  faq: "Preguntas",
};

const qualityLabel = (score: number) => {
  if (score >= 85) return "Lista para test";
  if (score >= 75) return "Lista para revisión";
  if (score >= 60) return "Borrador sólido";
  return "Incompleta";
};

const severityLabel = (severity: string) => {
  if (severity === "blocker") return "Bloqueo";
  if (severity === "warning" || severity === "important") return "Revisar";
  return "Mejora";
};

export default function LandingStudio({ verticales, logos }: LandingStudioProps) {
  const [brief, setBrief] = useState<LandingBrief>(() => defaultBrief());
  const [studyVerticalId, setStudyVerticalId] = useState("clinicas-salud");
  const [hydrated, setHydrated] = useState(false);
  const [intelligence, setIntelligence] = useState<LandingIntelligence | null>(null);
  const [arsenalData, setArsenalData] = useState<ArsenalData | null>(null);
  const [crucesData, setCrucesData] = useState<CrucesData | null>(null);
  const [intelligenceError, setIntelligenceError] = useState(false);
  const [activeSection, setActiveSection] = useState<EditorSection>("strategy");
  const [device, setDevice] = useState<Device>("desktop");
  const [compare, setCompare] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [buildingStep, setBuildingStep] = useState(-1);
  const [editMode, setEditMode] = useState(false);
  const previewPanelRef = useRef<HTMLElement | null>(null);
  const [visibleExamples, setVisibleExamples] = useState(4);
  const [previousBrief, setPreviousBrief] = useState<LandingBrief | null>(null);

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      const saved = safeParse(window.localStorage.getItem(STORAGE_KEY));
      if (saved && active) {
        setBrief(saved);
        setStudyVerticalId(saved.verticalId);
      }
      if (active) setHydrated(true);
    });
    fetch("/data/arsenal.json")
      .then((response) => (response.ok ? (response.json() as Promise<ArsenalData>) : null))
      .then((value) => { if (active && value) setArsenalData(value); })
      .catch(() => {});
    fetch("/data/cruces.json")
      .then((response) => (response.ok ? (response.json() as Promise<CrucesData>) : null))
      .then((value) => { if (active && value) setCrucesData(value); })
      .catch(() => {});
    fetch("/data/landing-intelligence.json", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<LandingIntelligence>) : null))
      .then((value) => {
        if (!active) return;
        if (value?.schemaVersion === "rv-landing-intelligence-v3") setIntelligence(value);
        else setIntelligenceError(true);
      })
      .catch(() => {
        if (active) setIntelligenceError(true);
      });
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brief));
    } catch {
      /* El editor funciona aunque el navegador no permita persistencia. */
    }
  }, [brief, hydrated]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const update = <K extends keyof LandingBrief>(key: K, value: LandingBrief[K]) =>
    setBrief((current) => ({
      ...current,
      [key]: value,
      ...(key === "leadEndpoint" ? { leadEndpointVerified: false } : {}),
      ...(["gtmId", "service", "zone"].includes(key) ? { trackingVerified: false } : {}),
      activeRecipeId: ["architecture", "angle", "variant", "ctaMode", "ctaLabel", "objective", "trafficSource", "awareness"].includes(key)
        ? ""
        : current.activeRecipeId,
      evidencePlan: ["architecture", "angle", "variant", "ctaMode", "ctaLabel", "objective", "trafficSource", "awareness"].includes(key)
        ? null
        : current.evidencePlan,
    }));
  const selectVertical = (verticalId: string) => {
    setPreviousBrief(brief);
    setBrief((current) => ({
      ...current,
      verticalId,
      intent: "vertical-default",
      activeRecipeId: "",
      evidencePlan: null,
      leadEndpointVerified: false,
      trackingVerified: false,
      // Las piezas que venían del estudio del vertical anterior se retiran para no mezclar datos.
      marketStats: [],
      proof: ammo && current.proof === ammo.proofLine ? "" : current.proof,
      guarantee: ammo && current.guarantee === ammo.guaranteeSuggestion ? "" : current.guarantee,
    }));
    setStudyVerticalId(verticalId);
    setVisibleExamples(4);
    setToast("Vertical cambiado; hemos mantenido tu contenido");
  };
  const loadVerticalPreset = () => {
    setPreviousBrief(brief);
    setBrief((current) => applyVerticalPreset(current, current.verticalId));
    setToast("Contenido base del vertical cargado; puedes deshacerlo");
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { rvEdit?: string; value?: string };
      if (!data?.rvEdit || typeof data.value !== "string") return;
      const value = data.value.replace(/\s+/g, " ").trim();
      const [field, indexRaw, sub] = data.rvEdit.split(":");
      if (field === "headline") update("headlineOverride", value);
      else if (field === "sub") update("subheadlineOverride", value);
      else if (field === "pain") update("pain", value);
      else if (field === "problem") update("problemOverride", value);
      else if (field === "offer") update("offer", value);
      else if (field === "proof") update("proof", value);
      else if (field === "price") update("price", value);
      else if (field === "guarantee") update("guarantee", value);
      else if (field === "cta") update("ctaLabel", value);
      else if (field === "step" || field === "faq") {
        const index = Number(indexRaw);
        if (!Number.isInteger(index)) return;
        setBrief((current) => {
          if (field === "step") {
            const base = current.stepsOverride ?? [
              { title: "Cuéntanos el contexto", text: `Recogemos ${current.filter}.` },
              { title: "Se comprueba el encaje", text: "El responsable debe confirmar alcance, zona y viabilidad antes de ofrecer condiciones." },
              { title: "Se concreta el siguiente paso", text: "La respuesta debe explicar qué puede avanzar y qué queda pendiente." },
              { title: "Decides si avanzar", text: "Solo se formaliza lo que ambas partes hayan revisado y aceptado." },
            ];
            if (!base[index]) return current;
            const next = base.map((step, i) => (i === index ? { ...step, [sub === "title" ? "title" : "text"]: value } : { ...step }));
            return { ...current, stepsOverride: next };
          }
          const base = current.faqsOverride ?? [
            { question: `¿Qué cuenta como ${current.unit || "oportunidad"} con encaje?`, answer: `Se define usando ${current.filter}. También deben acordarse duplicados, datos incorrectos y casos fuera de zona.` },
            { question: "¿Qué ocurre después de enviar el formulario?", answer: "El responsable debe explicar el siguiente paso. El envío no confirma precio, disponibilidad ni resultado." },
            { question: "¿Existe exclusividad?", answer: "Solo si su zona, alcance y duración aparecen de forma expresa en las condiciones aceptadas." },
            { question: "¿Hay permanencia o renovación automática?", answer: "Duración, renovación y cancelación deben figurar en la propuesta o contrato antes de cualquier pago." },
          ];
          if (!base[index]) return current;
          const next = base.map((faq, i) => (i === index ? { ...faq, [sub === "question" ? "question" : "answer"]: value } : { ...faq }));
          return { ...current, faqsOverride: next };
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ammo = useMemo(
    () => buildMarketAmmo(brief.verticalId, verticales, arsenalData, crucesData, brief.unit),
    [brief.verticalId, brief.unit, verticales, arsenalData, crucesData],
  );
  useEffect(() => {
    if (!hydrated || !ammo) return;
    setBrief((current) => {
      if (current.verticalId !== ammo.verticalId) return current;
      const wantsStats = !(current.marketStats || []).length && ammo.stats.length > 0;
      if (wantsStats) return applyMarketAmmo(current, ammo);
      return current;
    });
  }, [ammo, hydrated]);

  const autoBuild = () => {
    setPreviousBrief(brief);
    setBrief((current) => {
      let next = applyVerticalPreset({ ...current, intent: "vertical-default" as LandingBrief["intent"] }, studyVerticalId);
      const recommendation = buildStrategyRecommendation(next, verticalIntel);
      next = applyStrategyRecommendation(next, recommendation);
      const recipes = buildEvidenceRecipes(verticalIntel, intelligence?.universal, next);
      if (recipes[0]) next = applyEvidenceRecipe(next, recipes[0]);
      // El estudio aporta estructura y contexto; la prueba, el precio y la garantía
      // escritos por el usuario se conservan y nunca se deducen de competidores.
      next = { ...next, proof: current.proof, guarantee: current.guarantee, price: current.price, marketStats: [] };
      const freshAmmo = buildMarketAmmo(studyVerticalId, verticales, arsenalData, crucesData, next.unit);
      if (freshAmmo) next = applyMarketAmmo(next, freshAmmo);
      const destination = current.destination.trim();
      return {
        ...next,
        brand: current.brand,
        zone: current.zone,
        destination: current.destination,
        // El destino que ha escrito el usuario manda sobre el modo de CTA de la receta.
        ctaMode: destination ? (/^https:\/\//i.test(destination) ? "calendar" : "whatsapp") : next.ctaMode,
        // El flujo express genera la landing completa: problema, encaje, proceso y oferta + 4 FAQ.
        depth: "extended" as LandingBrief["depth"],
      };
    });
    setActiveSection("conversion");
    // Secuencia de montaje visible: el usuario ve construirse la landing paso a paso.
    setBuildingStep(0);
    window.setTimeout(() => previewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    [1, 2, 3].forEach((step) => window.setTimeout(() => setBuildingStep(step), step * 420));
    window.setTimeout(() => {
      setBuildingStep(-1);
      setToast("Landing montada con estructura del estudio; completa prueba, condiciones y conexiones antes de publicar");
    }, 1850);
  };

  // La vista previa se reconstruye con un pequeño retardo para que escribir sea fluido;
  // el HTML de exportación se genera solo al pulsar descargar/copiar.
  const [previewBrief, setPreviewBrief] = useState<LandingBrief>(brief);
  useEffect(() => {
    // En modo edición en página el iframe conserva su DOM (el usuario está escribiendo
    // dentro); el brief se actualiza igualmente y la preview se regenera al salir.
    if (editMode) return;
    const timeout = window.setTimeout(() => setPreviewBrief(brief), 350);
    return () => window.clearTimeout(timeout);
  }, [brief, editMode]);
  const exportHtml = () => buildLandingHtml(brief);
  const previewHtml = useMemo(() => {
    const html = buildLandingHtml({ ...previewBrief, leadEndpoint: "", gtmId: "" });
    if (!editMode) return html;
    const editRuntime =
      "<style>[data-edit]{outline:2px dashed rgba(23,105,224,.5);outline-offset:3px;cursor:text;border-radius:3px;transition:outline-color .15s}[data-edit]:hover{outline-color:#1769e0;background:rgba(23,105,224,.06)}[data-edit]:focus{outline:2px solid #1769e0;background:#fff}</style>" +
      "<script>!function(){document.querySelectorAll('[data-edit]').forEach(function(el){el.setAttribute('contenteditable','plaintext-only');el.addEventListener('blur',function(){parent.postMessage({rvEdit:el.getAttribute('data-edit'),value:el.innerText},'*')});el.addEventListener('keydown',function(e){if(e.key==='Enter'&&el.tagName!=='P'){e.preventDefault();el.blur()}})});document.querySelectorAll('summary[data-edit]').forEach(function(el){el.addEventListener('click',function(e){e.preventDefault()})});document.querySelectorAll('a[data-edit]').forEach(function(el){el.addEventListener('click',function(e){e.preventDefault()})})}()</script>";
    return html.replace("</body>", editRuntime + "</body>");
  }, [previewBrief, editMode]);
  const readiness = useMemo(() => landingReadiness(brief), [brief]);
  const publishReady = readiness.publishable;
  const guaranteeReady = Boolean(brief.guarantee.trim()) && Boolean(readiness.checks.find((check) => check.id === "guarantee")?.ok);
  const availableVariants = useMemo(
    () => guaranteeReady ? VARIANT_META : VARIANT_META.filter(([variant]) => variant !== "c"),
    [guaranteeReady],
  );
  useEffect(() => {
    if (hydrated && brief.variant === "c" && !guaranteeReady)
      setBrief((current) => ({ ...current, variant: "a" }));
  }, [brief.variant, guaranteeReady, hydrated]);
  const verticalIntel =
    intelligence?.verticals[studyVerticalId] || intelligence?.verticals.generalista || null;
  const evidenceRecipes = useMemo(
    () => buildEvidenceRecipes(verticalIntel, intelligence?.universal, previewBrief),
    [previewBrief, verticalIntel, intelligence?.universal],
  );
  const activeRecipe =
    brief.verticalId === studyVerticalId
      ? evidenceRecipes.find((recipe) => recipe.id === brief.activeRecipeId) || null
      : null;
  const strategyRecommendation = useMemo(
    () => buildStrategyRecommendation(previewBrief, verticalIntel),
    [previewBrief, verticalIntel],
  );
  const variantA = useMemo(() => landingCopyPreview({ ...brief, variant: "a" }), [brief]);
  const variantB = useMemo(() => landingCopyPreview({ ...brief, variant: "b" }), [brief]);
  const variantC = useMemo(() => landingCopyPreview({ ...brief, variant: "c" }), [brief]);
  const compareHtml = useMemo(
    () =>
      compare
        ? availableVariants.map(([variant]) =>
            buildLandingHtml({ ...brief, variant, leadEndpoint: "", gtmId: "" }),
          )
        : null,
    [availableVariants, brief, compare],
  );
  const landingCount = intelligence?.universal.roles.landing || 0;
  const exactAutomotiveIntent = brief.verticalId === "coches-motor" && brief.intent !== "vertical-default";
  const automotivePlaybook = brief.intent !== "vertical-default" ? AUTOMOTIVE_INTENTS[brief.intent] : null;
  const endpointConfigured = /^https:\/\//i.test(brief.leadEndpoint.trim());
  // Contenido efectivo de pasos y FAQs (override del usuario ?? contenido del vertical),
  // para que TODO sea editable antes de descargar.
  const effectiveSteps = brief.stepsOverride ?? [
    { title: "Cuéntanos el contexto", text: `Recogemos ${brief.filter}.` },
    { title: "Se comprueba el encaje", text: "El responsable debe confirmar alcance, zona y viabilidad antes de ofrecer condiciones." },
    { title: "Se concreta el siguiente paso", text: "La respuesta debe explicar qué puede avanzar y qué queda pendiente." },
    { title: "Decides si avanzar", text: "Solo se formaliza lo que ambas partes hayan revisado y aceptado." },
  ];
  const effectiveFaqs = brief.faqsOverride ?? [
    { question: `¿Qué cuenta como ${brief.unit || "oportunidad"} con encaje?`, answer: `Se define usando ${brief.filter}. También deben acordarse duplicados, datos incorrectos y casos fuera de zona.` },
    { question: "¿Qué ocurre después de enviar el formulario?", answer: "El responsable debe explicar el siguiente paso. El envío no confirma precio, disponibilidad ni resultado." },
    { question: "¿Existe exclusividad?", answer: "Solo si su zona, alcance y duración aparecen de forma expresa en las condiciones aceptadas." },
    { question: "¿Hay permanencia o renovación automática?", answer: "Duración, renovación y cancelación deben figurar en la propuesta o contrato antes de cualquier pago." },
  ];
  const setStep = (index: number, field: "title" | "text", value: string) => {
    const next = effectiveSteps.map((step, i) => (i === index ? { ...step, [field]: value } : { ...step }));
    update("stepsOverride", next);
  };
  const setFaq = (index: number, field: "question" | "answer", value: string) => {
    const next = effectiveFaqs.map((faq, i) => (i === index ? { ...faq, [field]: value } : { ...faq }));
    update("faqsOverride", next);
  };
  const preview = (
    <div className={`${styles.previewFrame} ${styles[device]}`}>
      <iframe
        title="Vista previa de la landing generada"
        srcDoc={previewHtml}
        sandbox="allow-scripts allow-forms allow-popups"
      />
    </div>
  );
  const filename = `landing-${slug(brief.service)}-${slug(brief.zone)}.html`;
  const downloadPack = async () => {
    if (!publishReady) {
      setToast("Resuelve los bloqueos antes de descargar el pack de campaña");
      return;
    }
    const files = availableVariants.map(([variant, , suffix]) => ({
      name: `landing-${variant}-${suffix}-${slug(brief.zone)}.html`,
      content: buildLandingHtml({ ...brief, variant }),
    }));
    files.push({ name: "brief.json", content: JSON.stringify(brief, null, 2) });
    files.push({
      name: "LEEME.txt",
      content: [
        `PACK DE CAMPAÑA · ${brief.brand} · ${brief.service} · ${brief.zone}`,
        "",
        "Contenido:",
        "- landing-a-resultado: el hero vende el resultado.",
        "- landing-b-dolor: el hero abre con el problema que reconoce el cliente.",
        ...(guaranteeReady ? ["- landing-c-compromiso: solo incluida porque la garantía supera los controles de periodo, métrica, condiciones y remedio."] : []),
        "- brief.json: configuración completa; se puede volver a cargar en el Landing Studio.",
        "",
        "Antes de publicar:",
        "1. Endpoint HTTPS del CRM configurado y probado con una respuesta 2xx.",
        "2. GTM con el evento de conversión comprobado en Preview (sin datos personales).",
        "3. URLs reales de privacidad y cookies + responsable legal en el footer.",
        "4. Destino del CTA (WhatsApp, teléfono o calendario) verificado a mano.",
        "",
        "Cómo testar: misma campaña, mismo presupuesto, reparto 50/50 entre dos variantes",
        "como máximo; una sola variable por test. La tercera variante entra cuando haya",
        "un ganador claro. Sin datos propios de conversión, ninguna variante 'gana' de serie.",
      ].join("\n"),
    });
    downloadBlob(`pack-${slug(brief.service)}-${slug(brief.zone)}.zip`, buildZip(files));
    setToast(`Pack descargado: ${availableVariants.length} variantes validadas + brief + instrucciones`);
  };

  return (
    <div className={styles.studio}>
      <section className={styles.hero}>
        <div>
          <p>LANDING INTELLIGENCE STUDIO</p>
          <h1>De la competencia real a una landing completa, medible y lista para campaña.</h1>
          <span>
            El blueprint ordena la página con patrones observados; la intención y el objetivo gobiernan
            el formulario. Las recomendaciones conservan sus fuentes y ningún lead se da por capturado sin entrega real.
          </span>
        </div>
        <div className={styles.sourceScore}>
          <span>CORPUS ANALIZADO</span>
          <strong>{intelligence?.source.capturedPages ?? "…"}</strong>
          <b>páginas completas</b>
          <small>
            {intelligence ? `${landingCount} landings · ${intelligence.universal.roles.conversion ?? 0} páginas de conversión` : "Cargando corpus y calidad de extracción"}
          </small>
        </div>
      </section>

      <section className={styles.truthBar} aria-label="Método del generador">
        <div><b>Observado</b><span>Frecuencia y ejemplos de páginas capturadas.</span></div>
        <div><b>Aportado</b><span>Oferta, prueba y condiciones que introduces tú.</span></div>
        <div><b>Recomendado</b><span>Estructura razonada para convertirla en un test.</span></div>
        <div><b>No afirmamos</b><span>Qué página gana sin datos propios de conversión.</span></div>
      </section>

      <section className={styles.express} aria-labelledby="express-title">
        <div className={styles.expressIntro}>
          <p>GENERADOR EXPRESS</p>
          <h2 id="express-title">Tu landing completa en un clic</h2>
          <span>Elige el vertical, pon marca, zona y destino, y pulsa Generar. La estructura y los textos parten del estudio de {verticales?.verticales.length || 11} verticales; tu precio, prueba y garantía nunca se inventan ni se copian de un competidor.</span>
        </div>
        <div className={styles.expressForm}>
          <label>Vertical
            <select value={studyVerticalId} onChange={(event) => { setStudyVerticalId(event.target.value); setVisibleExamples(4); }}>
              {(verticales?.verticales || []).map((vertical) => <option key={vertical.id} value={vertical.id}>{vertical.label}</option>)}
              {!verticales?.verticales.some((vertical) => vertical.id === "generalista") ? <option value="generalista">Generalista</option> : null}
            </select>
          </label>
          <label>Marca<input value={brief.brand} onChange={(event) => update("brand", event.target.value)} placeholder="RedVitalia" /></label>
          <label>Zona<input value={brief.zone === "tu zona" ? "" : brief.zone} onChange={(event) => update("zone", event.target.value || "tu zona")} placeholder="Madrid, Valencia…" /></label>
          <label>WhatsApp o URL de agenda<input value={brief.destination} onChange={(event) => update("destination", event.target.value)} placeholder="34600000000" /></label>
          <div className={styles.expressTones} role="group" aria-label="Estilo visual">
            {([["consultative", "Consultivo", "confianza y claridad"], ["direct", "Directo", "alto contraste"], ["premium", "Premium", "editorial y sobrio"]] as const).map(([id, label, hint]) => (
              <button key={id} type="button" data-selected={brief.tone === id} onClick={() => update("tone", id)}><b>{label}</b><span>{hint}</span></button>
            ))}
          </div>
          <button type="button" className={styles.expressGo} onClick={autoBuild}>⚡ Generar landing completa</button>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.editor} aria-label="Configuración de la landing">
          <div className={styles.editorHeader}>
            <div><span>03 · CONSTRUIR</span><h2>Construye la página</h2></div>
            <div className={styles.score} data-score={readiness.score >= 75 ? "good" : readiness.score >= 60 ? "mid" : "low"}>
              <strong>{readiness.score}</strong><span>/100</span>
            </div>
          </div>
          <div className={styles.scoreLabel}>
            <b>{readiness.blockers.length ? `Faltan ${readiness.blockers.length} decisiones antes de publicar` : qualityLabel(readiness.score)}</b>
            <span>{readiness.blockers.length ? `${readiness.passed} de ${readiness.total} controles resueltos` : `${readiness.warnings.length} mejoras opcionales pendientes`}</span>
          </div>
          {previousBrief ? <button className={styles.undoButton} type="button" onClick={() => { setBrief(previousBrief); setStudyVerticalId(previousBrief.verticalId); setPreviousBrief(null); setToast("Cambio deshecho"); }}>Deshacer último cambio</button> : null}
          <nav className={styles.editorNav} aria-label="Pasos del brief">
            {([
              ["strategy", "01", "Estrategia"],
              ["message", "02", "Mensaje"],
              ["evidence", "03", "Prueba y oferta"],
              ["conversion", "04", "Conversión y marca"],
            ] as const).map(([id, number, label]) => (
              <button key={id} className={activeSection === id ? styles.active : ""} onClick={() => setActiveSection(id)}>
                <span>{number}</span>{label}
              </button>
            ))}
          </nav>

          {activeSection === "strategy" ? (
            <div className={styles.controls}>
              <label>Vertical<select value={brief.verticalId} onChange={(event) => selectVertical(event.target.value)}>
                {(verticales?.verticales || []).map((vertical) => <option key={vertical.id} value={vertical.id}>{vertical.label}</option>)}
                {!verticales?.verticales.some((vertical) => vertical.id === "generalista") ? <option value="generalista">Generalista</option> : null}
              </select></label>
              <div className={styles.presetNotice}><span>El cambio de vertical conserva tus textos.</span><button type="button" onClick={loadVerticalPreset}>Cargar el contenido base de {verticalIntel?.label || "este vertical"}</button></div>
              {brief.verticalId === "coches-motor" ? (
                <section className={styles.intentLab} aria-labelledby="automotive-intent-title">
                  <div>
                    <span>INTENCIÓN DE BÚSQUEDA</span>
                    <h3 id="automotive-intent-title">No mezcles situaciones que necesitan respuestas distintas</h3>
                    <p>Reserva, embargo, financiación y carga desconocida cambian titular, campos, proceso, preguntas y evento de conversión.</p>
                  </div>
                  <div className={styles.intentGrid}>
                    {(Object.entries(AUTOMOTIVE_INTENTS) as Array<[Exclude<LandingBrief["intent"], "vertical-default">, (typeof AUTOMOTIVE_INTENTS)[Exclude<LandingBrief["intent"], "vertical-default">]]>).map(([id, intent]) => (
                      <button
                        type="button"
                        key={id}
                        className={brief.intent === id ? styles.selected : ""}
                        onClick={() => {
                          setPreviousBrief(brief);
                          setBrief((current) => applyAutomotiveIntent(current, id));
                          setToast(`${intent.label}: brief, formulario y medición aplicados`);
                        }}
                      >
                        <b>{intent.label}</b>
                        <span>{intent.result}</span>
                        <small>{intent.formFields.length} señales · {intent.eventName}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              <div className={styles.strategyContextGrid}>
                <label>Objetivo principal<select value={brief.objective} onChange={(event) => update("objective", event.target.value as LandingBrief["objective"])}><option value="qualified">Solicitud cualificada</option><option value="booking">Reserva o llamada</option><option value="quote">Presupuesto o propuesta</option><option value="contact">Contacto directo</option></select></label>
                <label>Origen del tráfico<select value={brief.trafficSource} onChange={(event) => update("trafficSource", event.target.value as LandingBrief["trafficSource"])}><option value="mixed">Mixto</option><option value="meta">Meta / interrupción</option><option value="google">Google / intención</option><option value="organic">Orgánico o referido</option><option value="outbound">Outbound</option></select></label>
                <label>Temperatura<select value={brief.awareness} onChange={(event) => update("awareness", event.target.value as LandingBrief["awareness"])}><option value="cold">Fría</option><option value="warm">Templada</option><option value="hot">Caliente</option></select></label>
                <label>Profundidad<select value={brief.depth} onChange={(event) => update("depth", event.target.value as LandingBrief["depth"])}><option value="short">Breve</option><option value="standard">Estándar</option><option value="extended">Extensa</option></select></label>
                <label>Campos del formulario<select value={brief.formFieldsTarget} disabled={exactAutomotiveIntent} onChange={(event) => update("formFieldsTarget", Number(event.target.value))}>{[3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value} campos</option>)}</select></label>
              </div>
              <div className={styles.inlineRecommendation}>
                <div><span>RECOMENDACIÓN ACTUAL</span><b>{exactAutomotiveIntent ? `${automotivePlaybook?.label} · formulario específico` : `${ARCHITECTURES.find((item) => item.id === strategyRecommendation.architecture)?.label} · ${strategyRecommendation.compatibility}/100 encaje`}</b><small>{exactAutomotiveIntent ? `${automotivePlaybook?.formFields.length || 0} campos obligatorios para no perder vehículo, carga, zona o contacto` : strategyRecommendation.suggestedFormFields ? `${strategyRecommendation.suggestedFormFields} campos como punto de partida, usando la mediana del vertical cuando existe` : "Longitud de formulario pendiente de evidencia"}</small></div>
                <button type="button" disabled={exactAutomotiveIntent} onClick={() => { if (exactAutomotiveIntent) return; setPreviousBrief(brief); setBrief((current) => applyStrategyRecommendation(current, strategyRecommendation)); }}>Aplicar</button>
              </div>
                <div className={styles.blueprintPanel} data-active={Boolean(brief.evidencePlan)}>
                  <header>
                  <div><span>BLUEPRINT QUE GOBIERNA EL ORDEN DEL HTML</span><b>{brief.evidencePlan?.strategyLabel || "Todavía no has aplicado una estrategia"}</b></div>
                  {brief.evidencePlan ? <small>{exactAutomotiveIntent ? "Curación editorial" : brief.evidencePlan.confidence === "high" ? "Confianza alta" : brief.evidencePlan.confidence === "medium" ? "Confianza media" : "Exploratoria"} · {brief.evidencePlan.sourceCompanies.length} fuentes aplicadas de {brief.evidencePlan.sampleBase} revisadas</small> : null}
                </header>
                {brief.evidencePlan ? (
                  <>
                    <ol>{brief.evidencePlan.sectionSequence.map((section, index) => <li key={section}><i>{String(index + 1).padStart(2, "0")}</i><b>{SECTION_LABELS[section]}</b></li>)}</ol>
                    <div className={styles.blueprintSources}>
                      <span>FUENTES CONSERVADAS</span>
                      {brief.evidencePlan.sourceCompanies.map((source) => source.url ? (
                        <a key={source.companyId} href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>
                      ) : (
                        <a key={source.companyId} href={`?vista=companies&empresa=${encodeURIComponent(source.companyId)}#record-site-capture`} target="_blank" rel="noopener noreferrer">{source.name}</a>
                      ))}
                    </div>
                  </>
                ) : <p>Aplica una recomendación o una receta. La secuencia, el formulario y el render dejarán de ser una plantilla genérica.</p>}
              </div>
              <fieldset><legend>Arquitectura del funnel</legend><div className={styles.optionGrid}>
                {ARCHITECTURES.map((item) => <button type="button" key={item.id} className={brief.architecture === item.id ? styles.selected : ""} onClick={() => update("architecture", item.id)}><b>{item.label}</b><span>{item.description}</span><small>{item.bestFor}</small></button>)}
              </div></fieldset>
              <fieldset><legend>Ángulo del mensaje</legend><div className={styles.angleGrid}>
                {ANGLES.map((item) => <button type="button" key={item.id} className={brief.angle === item.id ? styles.selected : ""} onClick={() => update("angle", item.id)} title={item.description}>{item.label}</button>)}
              </div></fieldset>
              <div className={styles.twoCols}>
                <label>Sistema visual<select value={brief.tone} onChange={(event) => update("tone", event.target.value as LandingBrief["tone"])}><option value="consultative">Consultivo · confianza</option><option value="direct">Directo · alto contraste</option><option value="premium">Premium · editorial</option></select></label>
                <label>Variante activa<select value={brief.variant} onChange={(event) => update("variant", event.target.value as LandingBrief["variant"])}><option value="a">A · Resultado</option><option value="b">B · Dolor</option></select></label>
              </div>
              <div className={styles.variantCompare}>
                <button type="button" className={brief.variant === "a" ? styles.selected : ""} onClick={() => update("variant", "a")}><span>A · RESULTADO</span><b>{variantA.headline}</b><small>{variantA.cta}</small></button>
                <button type="button" className={brief.variant === "b" ? styles.selected : ""} onClick={() => update("variant", "b")}><span>B · DOLOR</span><b>{variantB.headline}</b><small>{variantB.cta}</small></button>
                <button type="button" disabled={!guaranteeReady} title={!guaranteeReady ? "Disponible cuando la garantía define periodo, métrica, condiciones y remedio" : undefined} className={brief.variant === "c" ? styles.selected : ""} onClick={() => update("variant", "c")}><span>C · COMPROMISO</span><b>{guaranteeReady ? variantC.headline : "Requiere una garantía contractual completa"}</b><small>{guaranteeReady ? variantC.cta : "No se genera desde datos de competidores"}</small></button>
              </div>
              <p className={styles.helper}>A, B y C cambian únicamente el encuadre del hero. Arquitectura, oferta, prueba y CTA permanecen iguales para que el test sea interpretable. C brilla cuando hay garantía real.</p>
            </div>
          ) : null}

          {activeSection === "message" ? (
            <div className={styles.controls}>
              <div className={styles.twoCols}>
                <label>Marca<input value={brief.brand} onChange={(event) => update("brand", event.target.value)} /></label>
                <label>Zona<input value={brief.zone} onChange={(event) => update("zone", event.target.value)} placeholder="Madrid, España…" /></label>
              </div>
              <label>Servicio<input value={brief.service} onChange={(event) => update("service", event.target.value)} /></label>
              <label>Titular personalizado (opcional)<input value={brief.headlineOverride} onChange={(event) => update("headlineOverride", event.target.value)} placeholder="Vacío = titular generado según ángulo y variante" /></label>
              {brief.headlineOverride.trim() ? (
                <div className={styles.presetNotice}><span>El titular manual manda sobre ángulo y variante en el hero.</span><button type="button" onClick={() => update("headlineOverride", "")}>Volver al titular generado</button></div>
              ) : null}
              <label>Público<textarea value={brief.audience} onChange={(event) => update("audience", event.target.value)} /></label>
              <label>Resultado deseado<textarea value={brief.result} onChange={(event) => update("result", event.target.value)} /></label>
              <label>Problema que reconoce el cliente<textarea value={brief.pain} onChange={(event) => update("pain", event.target.value)} /></label>
              <label>Unidad que se capta<input value={brief.unit} onChange={(event) => update("unit", event.target.value)} placeholder="pacientes, reuniones, solicitudes…" /></label>
              <label>Subtítulo personalizado (opcional)<textarea value={brief.subheadlineOverride} onChange={(event) => update("subheadlineOverride", event.target.value)} placeholder="Vacío = subtítulo generado según oferta y estilo" /></label>
              {!exactAutomotiveIntent ? (
                <>
                  <div className={styles.contentEditorHead}><span>PASOS DEL PROCESO</span><small>Se publican tal cual los dejes aquí.</small>{brief.stepsOverride ? <button type="button" onClick={() => update("stepsOverride", null)}>Restaurar los del vertical</button> : null}</div>
                  {effectiveSteps.slice(0, 4).map((step, index) => (
                    <div key={`step-${index}`} className={styles.contentEditorRow}>
                      <input value={step.title} onChange={(event) => setStep(index, "title", event.target.value)} placeholder={`Paso ${index + 1}`} />
                      <textarea value={step.text} onChange={(event) => setStep(index, "text", event.target.value)} />
                    </div>
                  ))}
                  <div className={styles.contentEditorHead}><span>PREGUNTAS FRECUENTES</span><small>Máximo 4; las vacías no se publican.</small>{brief.faqsOverride ? <button type="button" onClick={() => update("faqsOverride", null)}>Restaurar las del vertical</button> : null}</div>
                  {(effectiveFaqs.length ? effectiveFaqs : [{ question: "", answer: "" }]).slice(0, 4).map((faq, index) => (
                    <div key={`faq-${index}`} className={styles.contentEditorRow}>
                      <input value={faq.question} onChange={(event) => setFaq(index, "question", event.target.value)} placeholder={`Pregunta ${index + 1}`} />
                      <textarea value={faq.answer} onChange={(event) => setFaq(index, "answer", event.target.value)} />
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}

          {activeSection === "evidence" ? (
            <div className={styles.controls}>
              <label>Qué incluye la oferta<textarea value={brief.offer} onChange={(event) => update("offer", event.target.value)} /></label>
              <label>Criterios de cualificación<textarea value={brief.filter} onChange={(event) => update("filter", event.target.value)} /></label>
              <label>Prueba verificable<textarea value={brief.proof} onChange={(event) => update("proof", event.target.value)} placeholder="Caso, reseña o dato con empresa, periodo y fuente. Si lo dejas vacío, el bloque desaparece." /></label>
              <label>Precio o rango publicado<input value={brief.price} onChange={(event) => update("price", event.target.value)} placeholder="Ej. Desde 690 €/mes + inversión" /></label>
              <label>Garantía o compromiso contractual<textarea value={brief.guarantee} onChange={(event) => update("guarantee", event.target.value)} placeholder="Métrica, periodo, exclusiones y remedio. Si no existe, déjalo vacío." /></label>
              {brief.marketStats?.length ? (
                <div className={styles.presetNotice}><span>Banda “El mercado, en cifras” activa con {brief.marketStats.length} datos del estudio del vertical.</span><button type="button" onClick={() => update("marketStats", [])}>Quitar banda de cifras</button></div>
              ) : null}
              <p className={styles.helper}>La página pública nunca mostrará “por configurar”. Los bloques sin respaldo se eliminan automáticamente.</p>
            </div>
          ) : null}

          {activeSection === "conversion" ? (
            <div className={styles.controls}>
              <div className={styles.deliveryNotice} data-ready={endpointConfigured && brief.leadEndpointVerified}>
                <div><span>ENTREGA DEL LEAD</span><b>{brief.leadEndpointVerified && endpointConfigured ? "Endpoint HTTPS probado" : endpointConfigured ? "Endpoint configurado; falta probarlo" : "Sin endpoint HTTPS no existe lead capturado"}</b><p>El formulario hace POST, espera una respuesta válida y solo entonces registra la conversión. WhatsApp, llamada o calendario quedan como siguiente paso.</p></div>
              </div>
              <label>Endpoint HTTPS del CRM / webhook<input value={brief.leadEndpoint} onChange={(event) => update("leadEndpoint", event.target.value)} placeholder="https://crm.tudominio.com/leads" /></label>
              <div className={styles.verificationCheck}><input id="lead-endpoint-verified" type="checkbox" checked={brief.leadEndpointVerified} onChange={(event) => update("leadEndpointVerified", event.target.checked)} /><label htmlFor="lead-endpoint-verified"><b>Envío real probado</b><small>Marca esto solo después de recibir un lead de prueba y una respuesta 2xx del endpoint.</small></label></div>
              <label>Google Tag Manager<input value={brief.gtmId} onChange={(event) => update("gtmId", event.target.value)} placeholder="GTM-XXXXXXX" /></label>
              <div className={styles.verificationCheck}><input id="tracking-verified" type="checkbox" checked={brief.trackingVerified} onChange={(event) => update("trackingVerified", event.target.checked)} /><label htmlFor="tracking-verified"><b>Conversión comprobada</b><small>Marca esto después de ver el evento correcto en Preview / Tag Assistant sin datos personales.</small></label></div>
              <div className={styles.twoCols}>
                <label>Conversión<select value={brief.ctaMode} onChange={(event) => update("ctaMode", event.target.value as LandingBrief["ctaMode"])}><option value="whatsapp">WhatsApp</option><option value="phone">Llamada</option><option value="calendar">Calendario / URL</option></select></label>
                <label>Color<input className={styles.colorInput} type="color" value={brief.accent} onChange={(event) => update("accent", event.target.value)} /></label>
              </div>
              <label>{brief.ctaMode === "calendar" ? "URL del calendario" : "Teléfono destino"}<input value={brief.destination} onChange={(event) => update("destination", event.target.value)} placeholder={brief.ctaMode === "calendar" ? "https://calendly.com/…" : "34600000000"} /></label>
              <label>Texto del CTA<input value={brief.ctaLabel} onChange={(event) => update("ctaLabel", event.target.value)} placeholder="Se genera según la arquitectura" /></label>
              <label>URL del logo<input value={brief.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="https://…/logo.svg" /></label>
              <label>Imagen principal<input value={brief.heroImageUrl} onChange={(event) => update("heroImageUrl", event.target.value)} placeholder="https://…/imagen.webp" /></label>
              <div className={styles.twoCols}>
                <label>Responsable legal<input value={brief.legalName} onChange={(event) => update("legalName", event.target.value)} placeholder="Razón social real" /></label>
                <label>CIF / identificación<input value={brief.legalId} onChange={(event) => update("legalId", event.target.value)} placeholder="Opcional en el footer" /></label>
              </div>
              <label>Política de privacidad<input value={brief.privacyUrl} onChange={(event) => update("privacyUrl", event.target.value)} placeholder="https://…/privacidad" /></label>
              <label>Política de cookies<input value={brief.cookiesUrl} onChange={(event) => update("cookiesUrl", event.target.value)} placeholder="https://…/cookies" /></label>
              <p className={styles.helper}>La analítica solo carga tras aceptar el aviso. Entonces conserva UTM y click IDs y envía a dataLayer únicamente el evento, la intención, la ruta y el número de campos completados: nunca datos personales, económicos ni del vehículo.</p>
            </div>
          ) : null}

          <div className={styles.checklist}>
            <div><span>04 · VALIDAR</span><b>Controles antes de exportar</b></div>
            {readiness.checks.map((check) => <button type="button" key={check.id} data-ok={check.ok} data-severity={check.severity} onClick={() => setActiveSection(check.section as EditorSection)}><i>{check.ok ? "✓" : "!"}</i><span>{check.label}<small>{check.ok ? "Resuelto" : severityLabel(check.severity)}</small></span><b>→</b></button>)}
          </div>
        </aside>

        <main className={styles.previewPanel} ref={previewPanelRef}>
          <header className={styles.previewToolbar}>
            <div><span>04 · VALIDAR EN CONTEXTO</span><b>{ARCHITECTURES.find((item) => item.id === brief.architecture)?.label}</b></div>
            <div className={styles.previewActions}>
              <div className={styles.segmented}><button className={!compare && device === "desktop" ? styles.active : ""} onClick={() => { setCompare(false); setDevice("desktop"); }}>Escritorio</button><button className={!compare && device === "mobile" ? styles.active : ""} onClick={() => { setCompare(false); setDevice("mobile"); }}>Móvil</button><button className={compare ? styles.active : ""} onClick={() => setCompare((current) => !current)}>Comparar A/B/C</button></div>
              <button
                className={styles.editToggle}
                type="button"
                data-active={editMode}
                title="Editar los textos clicando directamente en la página"
                onClick={() => {
                  setEditMode((current) => {
                    const next = !current;
                    setToast(next ? "Modo edición: clica cualquier texto de la página y escríbelo ahí mismo" : "Cambios guardados en el brief");
                    return next;
                  });
                }}
              >
                {editMode ? "✓ Terminar edición" : "✏️ Editar en la página"}
              </button>
              <button
                className={styles.angleCycle}
                type="button"
                title="Rotar el enfoque del titular del hero"
                onClick={() => {
                  const order = ["outcome", "territory", "speed", "risk", "authority"] as const;
                  const nextAngle = order[(order.indexOf(brief.angle as (typeof order)[number]) + 1) % order.length];
                  update("angle", nextAngle);
                  const labels: Record<string, string> = { outcome: "Resultado", territory: "Territorio", speed: "Velocidad", risk: "Riesgo invertido", authority: "Autoridad" };
                  setToast(`Titular con enfoque «${labels[nextAngle]}»`);
                }}
              >
                ↻ Otro titular
              </button>
              <button className={styles.iconButton} onClick={() => setFullscreen(true)} aria-label="Abrir vista previa a pantalla completa">⛶</button>
            </div>
          </header>
          {buildingStep >= 0 ? (
            <div className={styles.buildOverlay} role="status" aria-live="polite">
              <div>
                <b>Montando tu landing…</b>
                <ol>
                  {["Leyendo el estudio del vertical", "Eligiendo estructura y enfoque con evidencia", "Añadiendo contexto de mercado seguro", "Renderizando tu página"].map((label, index) => (
                    <li key={label} data-state={buildingStep > index ? "done" : buildingStep === index ? "active" : "wait"}>
                      <i>{buildingStep > index ? "✓" : index + 1}</i>{label}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
          {compare && compareHtml ? (
            <div className={styles.compareTriple}>
              {availableVariants.map(([variant, label], index) => (
                <figure key={variant}>
                  <figcaption>{label}{brief.variant === variant ? " · activa" : ""}</figcaption>
                  <iframe
                    title={`Variante ${label}`}
                    srcDoc={compareHtml[index]}
                    sandbox="allow-scripts allow-forms allow-popups"
                  />
                </figure>
              ))}
            </div>
          ) : (
            preview
          )}
          <div className={styles.exportBar}>
            <div><span>ESTADO</span><b>{publishReady ? "Sin bloqueos críticos" : `${readiness.blockers.length} bloqueos por resolver`}</b><small>{publishReady ? "HTML listo para revisión humana y test." : "La exportación sigue disponible para revisión interna, pero todavía no es publicable."}</small></div>
            <div>
              <button className={styles.packButton} disabled={!publishReady} title={!publishReady ? "Resuelve los bloqueos críticos antes de descargar" : undefined} onClick={downloadPack}>Descargar pack validado ({availableVariants.map(([variant]) => variant.toUpperCase()).join("/")} + brief)</button>
              <button onClick={() => download(filename, exportHtml(), "text/html;charset=utf-8")}>{publishReady ? "Descargar HTML" : "Exportar versión para revisión"}</button>
              <button onClick={async () => { try { await navigator.clipboard.writeText(exportHtml()); setToast("HTML copiado"); } catch { setToast("No se pudo copiar"); } }}>Copiar HTML</button>
              <button onClick={() => download(filename.replace(/\.html$/, ".json"), JSON.stringify(brief, null, 2), "application/json;charset=utf-8")}>Guardar brief</button>
            </div>
          </div>
        </main>
      </section>

      <section className={styles.advancedBar}>
        <button type="button" onClick={() => setAdvancedOpen((value) => !value)}>
          {advancedOpen ? "▾ Ocultar modo avanzado" : "▸ Modo avanzado: estudio del vertical, munición del mercado y enfoques con evidencia"}
        </button>
        <span>El generador de arriba ya usa todo esto por ti; entra solo si quieres afinar a mano.</span>
      </section>

      {advancedOpen ? (<>
      <section className={styles.studyBoard} aria-labelledby="landing-study-title">
        <header className={styles.studyHeader}>
          <div>
            <p>01 · ESTUDIAR</p>
            <h2 id="landing-study-title">Entiende el vertical antes de elegir una estructura</h2>
            <span>El estudio separa cobertura, patrones y recomendaciones. Los CTA de navegación, cookies y páginas adyacentes ya no contaminan las frecuencias.</span>
          </div>
          <div className={styles.studySelector}>
            <label>
              Vertical analizado
              <select value={studyVerticalId} onChange={(event) => { setStudyVerticalId(event.target.value); setVisibleExamples(4); }}>
                {(verticales?.verticales || []).map((vertical) => <option key={vertical.id} value={vertical.id}>{vertical.label}</option>)}
                {!verticales?.verticales.some((vertical) => vertical.id === "generalista") ? <option value="generalista">Generalista</option> : null}
              </select>
            </label>
            {brief.verticalId !== studyVerticalId ? (
              <button type="button" onClick={() => selectVertical(studyVerticalId)}>Usar este vertical sin borrar mi brief</button>
            ) : <span>Estudio y brief sincronizados ✓</span>}
          </div>
        </header>

        {intelligenceError ? (
          <div className={styles.intelligenceError} role="alert">
            No hemos podido cargar el estudio. Puedes seguir editando, pero las recomendaciones basadas en evidencia no están disponibles.
          </div>
        ) : null}

        <div className={styles.studyStats}>
          <article><span>MUESTRA DEPURADA</span><strong>{verticalIntel?.sampleSize ?? "—"}</strong><small>empresas con página comercial y vertical defendible</small></article>
          <article><span>CON LANDING</span><strong>{verticalIntel?.companiesWithLanding ?? "—"}</strong><small>empresas con al menos una landing capturada</small></article>
          <article><span>CTA RECUPERABLE</span><strong>{verticalIntel?.study ? `${verticalIntel.study.coverage.ctaCoveragePct}%` : "—"}</strong><small>acciones comerciales después de eliminar boilerplate</small></article>
          <article><span>CONFIANZA</span><strong>{verticalIntel?.study?.confidence === "high" ? "Alta" : verticalIntel?.study?.confidence === "medium" ? "Media" : verticalIntel?.study ? "Exploratoria" : "—"}</strong><small>según tamaño, cobertura y calidad de la muestra</small></article>
        </div>

        <div className={styles.studyGrid}>
          <article className={styles.studySignalCard}>
            <span>LO MÁS OBSERVADO</span>
            <h3>{verticalIntel?.study?.dominantHero?.label || "Sin apertura dominante"}</h3>
            <p>{verticalIntel?.study?.dominantHero ? `${verticalIntel.study.dominantHero.count} de ${verticalIntel.study.dominantHero.sampleBase || verticalIntel.sampleSize} empresas.` : "La muestra no permite fijar una familia de apertura con suficiente soporte."}</p>
            <div><b>Acción principal</b><strong>{verticalIntel?.study?.dominantCta?.label || "Sin señal suficiente"}</strong></div>
            <small>Frecuencia observada; no demuestra conversión.</small>
          </article>

          <article className={styles.studyOpportunityCard}>
            <span>QUÉ EXPLICAN MENOS</span>
            <h3>Huecos de contenido del vertical</h3>
            <ul>
              {(verticalIntel?.study?.opportunities || []).map((item) => (
                <li key={item.field}><b>{FIELD_LABELS[item.field] || item.field}</b><span>{item.presence}% en el vertical · {item.delta > 0 ? "+" : ""}{item.delta} puntos frente a la base</span></li>
              ))}
              {verticalIntel?.study && !verticalIntel.study.opportunities.length ? <li><b>Sin hueco consistente</b><span>La muestra no muestra una diferencia defendible frente a la base.</span></li> : null}
            </ul>
            <small>Un hueco es una variable para probar, no una oportunidad garantizada.</small>
          </article>

          <article className={styles.strategyCard}>
            <span>DECISIÓN RECOMENDADA</span>
            <div className={styles.compatibility}><strong>{exactAutomotiveIntent ? "B2C" : strategyRecommendation.compatibility}</strong><small>{exactAutomotiveIntent ? "intención exacta" : "/100 encaje estructural"}</small></div>
            <h3>{exactAutomotiveIntent ? automotivePlaybook?.label : ARCHITECTURES.find((item) => item.id === strategyRecommendation.architecture)?.label}</h3>
            <p>{exactAutomotiveIntent ? "Esta landing usa la cohorte española de compra de vehículos con cargas; las recomendaciones genéricas de talleres y concesionarios quedan aisladas." : strategyRecommendation.reasons[0]}</p>
            <ul>{exactAutomotiveIntent ? <><li>Formulario y preguntas específicos</li><li>Proceso, aceptación y exclusiones propios</li></> : strategyRecommendation.reasons.slice(1).map((reason) => <li key={reason}>{reason}</li>)}</ul>
            <button type="button" disabled={exactAutomotiveIntent} onClick={() => { if (exactAutomotiveIntent) return; setPreviousBrief(brief); setBrief((current) => applyStrategyRecommendation(current, strategyRecommendation)); setToast("Estrategia aplicada; revisa el destino del CTA"); }}>{exactAutomotiveIntent ? "La intención B2C ya gobierna esta landing" : "Aplicar recomendación"}</button>
          </article>
        </div>

        <div className={styles.realAnatomy}>
          <div className={styles.realAnatomyIntro}>
            <span>SECUENCIA OBSERVADA</span>
            <b>Qué bloques aparecen y en qué momento</b>
            <p>Clasificación automática y revisable de los encabezados ordenados; excluye errores, cookies y coincidencias ambiguas conocidas.</p>
          </div>
          <ol>
            {(verticalIntel?.sectionPatterns || intelligence?.universal.sectionPatterns || []).map((pattern) => (
              <li key={pattern.id}>
                <i>{pattern.medianPosition ?? "—"}</i>
                <div><b>{pattern.label}</b><span>{pattern.count} empresas · {pattern.share}% de la muestra</span></div>
                <em style={{ width: `${Math.max(8, pattern.share)}%` }} />
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.studyInsights}>
          <div><span>CONCLUSIONES ACCIONABLES</span><b>Qué merece convertirse en hipótesis</b></div>
          <ol>
            {(verticalIntel?.recommendations || []).slice(0, 4).map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
          </ol>
          {(verticalIntel?.study?.warnings || []).length ? <aside><b>Límites de esta muestra</b>{verticalIntel?.study?.warnings.map((warning) => <span key={warning}>{warning}</span>)}</aside> : null}
        </div>

        {studyVerticalId === "coches-motor" ? (
          <section className={styles.automotiveCohort}>
            <header><div><span>COHORTE ESPECÍFICA · ESPAÑA</span><b>Compra de coches con reserva, financiación, embargo o cargas</b></div><p>El corpus genérico de “motor” está formado sobre todo por marketing para talleres y concesionarios. No lo usamos para justificar estas landings B2C. Esta cohorte separada sí corresponde a la intención.</p></header>
            <div>{AUTOMOTIVE_MARKET_REFERENCES.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noopener noreferrer"><b>{reference.name}</b><span>{reference.market} · idioma {reference.language} · revisada {reference.reviewedAt}</span><span>{reference.observed}</span><small>{reference.observedSections.join(" → ")} · Ver página ↗</small></a>)}</div>
          </section>
        ) : null}

        <div className={styles.studyReferences}>
          <div><span>REFERENCIAS DEL ESTUDIO</span><b>Abre la captura y contrasta el patrón</b></div>
          {(verticalIntel?.examples || []).slice(0, 3).map((example) => (
            <a key={example.companyId} href={`?vista=companies&empresa=${encodeURIComponent(example.companyId)}#record-site-capture`} target="_blank" rel="noopener noreferrer">
              <span className={styles.studyReferenceBrand}>
                <CompanyLogo company={{ id: example.companyId, name: example.name }} logos={logos} size="small" />
                <strong>{example.name}</strong>
              </span>
              <small>{example.headline || example.offer}</small><b>Ver evidencia ↗</b>
            </a>
          ))}
        </div>
      </section>

      {ammo && (
        <section className={styles.ammoBoard} aria-labelledby="landing-ammo-title">
          <header className={styles.studyHeader}>
            <div>
              <p>01B · MUNICIÓN DEL MERCADO</p>
              <h2 id="landing-ammo-title">Rellena el brief con lo mejor de {ammo.label}</h2>
              <p className={styles.ammoNote}>
                {ammo.n} competidores analizados{ammo.spainN ? ` (${ammo.spainN} en España)` : ""}
                {ammo.medianEur ? ` · mediana numérica observada ${ammo.medianEur} € (modelo por verificar)` : ""}
                {ammo.slaTop ? ` · SLA más agresivo: ${ammo.slaTop.name} (${ammo.slaTop.sla})` : ""}. Cada pieza cita su fuente.
              </p>
            </div>
            <div className={styles.ammoActions}>
              <button type="button" className={styles.autoBuild} onClick={autoBuild}>
                ⚡ Montar landing completa (1 clic)
              </button>
              <button
                type="button"
                className={styles.ammoApply}
                onClick={() => {
                  setBrief((current) => applyMarketAmmo(current, ammo));
                  setToast("Contexto seguro añadido; prueba, precio y garantía propios se mantienen intactos");
                }}
              >
                Añadir contexto seguro al brief
              </button>
            </div>
          </header>
          <div className={styles.ammoColumns}>
            <div>
              <h3>Garantías observadas · referencia, no copiar</h3>
              {ammo.guarantees.length === 0 && <p className={styles.ammoEmpty}>Sin garantías fuertes registradas en este vertical.</p>}
              {ammo.guarantees.map((quote) => (
                <article
                  key={quote.company + quote.text.slice(0, 24)}
                  className={styles.ammoQuote}
                >
                  <span>“{quote.text}”</span>
                  <small>{quote.company}{quote.extra ? ` · ${quote.extra}` : ""}</small>
                </article>
              ))}
            </div>
            <div>
              <h3>Titulares destacados · referencia, no copiar</h3>
              {ammo.headlines.length === 0 && <p className={styles.ammoEmpty}>Sin titulares de referentes 80+ en este vertical.</p>}
              {ammo.headlines.map((quote) => (
                <article
                  key={quote.company + quote.text.slice(0, 24)}
                  className={styles.ammoQuote}
                >
                  <span>“{quote.text}”</span>
                  <small>{quote.company}{quote.extra ? ` · ${quote.extra}` : ""}</small>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={styles.recipeSection} aria-labelledby="landing-recipes-title">
        <header>
          <div>
            <p>02 · ELEGIR ENFOQUE</p>
            <h2 id="landing-recipes-title">Compara rutas, evidencia y coste de cada decisión</h2>
          </div>
          <span>
            Cambian arquitectura, enfoque y CTA. Tu oferta, prueba, precio y garantía se conservan:
            nunca copiamos claims de otra empresa.
          </span>
        </header>
        {evidenceRecipes.length ? (
          <div className={styles.recipeGrid}>
            {evidenceRecipes.map((recipe, index) => (
              <article
                key={recipe.id}
                className={activeRecipe?.id === recipe.id ? styles.recipeActive : ""}
              >
                <div className={styles.recipeTopline}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <span data-confidence={recipe.confidence}>{recipe.strategyLabel} · confianza {recipe.confidence === "high" ? "alta" : recipe.confidence === "medium" ? "media" : "exploratoria"}</span>
                </div>
                <h3>{recipe.label}</h3>
                <p>{recipe.summary}</p>
                <div className={styles.recipeDecision}>
                  <b>{recipe.fitReason}</b>
                  <span>{recipe.tradeoff}</span>
                </div>
                <div className={styles.recipeSignals}>
                  <span><b>{recipe.heroFamily.share}%</b> apertura · {recipe.evidenceScope.hero}</span>
                  <span><b>{recipe.ctaFamily.share}%</b> CTA · {recipe.evidenceScope.cta}</span>
                  <span><b>{recipe.observedTogether}</b> coincidencias reales</span>
                </div>
                <div className={styles.recipeModules}>
                  {recipe.modules.map((module) => <span key={module}>{module}</span>)}
                </div>
                <div className={styles.recipeSources}>
                  <b>Qué sustenta cada parte</b>
                  <div className={styles.recipeSourceGroups}>
                    <div><span>APERTURA</span>{recipe.sourceGroups.hero.slice(0, 3).map((source) => (
                      <a
                        key={`hero-${source.companyId}`}
                        href={`?vista=companies&empresa=${encodeURIComponent(source.companyId)}#record-site-capture`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={source.text}
                      >
                        {source.name}
                      </a>
                    ))}</div>
                    <div><span>CTA</span>{recipe.sourceGroups.cta.slice(0, 3).map((source) => (
                      <a
                        key={`cta-${source.companyId}`}
                        href={`?vista=companies&empresa=${encodeURIComponent(source.companyId)}#record-site-capture`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={source.text}
                      >
                        {source.name}
                      </a>
                    ))}</div>
                  </div>
                </div>
                {recipe.warnings.map((warning) => <small className={styles.recipeWarning} key={warning}>{warning}</small>)}
                <button
                  type="button"
                  disabled={brief.verticalId !== studyVerticalId || exactAutomotiveIntent}
                  onClick={() => {
                    if (exactAutomotiveIntent) {
                      setToast("Las recetas genéricas de motor quedan bloqueadas mientras uses una intención B2C específica");
                      return;
                    }
                    if (brief.verticalId !== studyVerticalId) {
                      setToast("Primero sincroniza este vertical con el brief");
                      return;
                    }
                    setPreviousBrief(brief);
                    setBrief((current) => applyEvidenceRecipe(current, recipe));
                    setActiveSection("strategy");
                    setToast("Enfoque aplicado; oferta, prueba, precio y garantía se mantienen");
                  }}
                >
                  {exactAutomotiveIntent ? "No aplicable a esta intención B2C" : activeRecipe?.id === recipe.id ? "Enfoque aplicado ✓" : "Probar este enfoque"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.recipeEmpty}>Preparando las recetas observadas del vertical…</p>
        )}
        <footer>
          <b>{activeRecipe ? "Enfoque activo" : "Condición de uso"}</b>
          <span>
            {activeRecipe
              ? activeRecipe.requirements.join(" · ")
              : "Selecciona una receta; te mostraremos qué evidencia propia necesitas antes de publicar."}
          </span>
          {previousBrief ? <button type="button" onClick={() => { setBrief(previousBrief); setPreviousBrief(null); setToast("Cambio deshecho"); }}>Deshacer último cambio</button> : null}
        </footer>
      </section>

      <section className={styles.evidenceSection}>
        <header><div><p>EVIDENCIA DETALLADA</p><h2>Audita cada decisión y abre sus fuentes</h2></div><span>{intelligence?.source.methodology || "Patrones descriptivos; no son métricas de rendimiento."}</span></header>
        <div className={styles.evidenceStats}>
          <article><span>EMPRESAS RELACIONADAS</span><strong>{verticalIntel?.sampleSize ?? "—"}</strong><small>Muestra disponible para {verticalIntel?.label || "este vertical"}</small></article>
          <article><span>PÁGINAS CAPTURADAS</span><strong>{verticalIntel?.capturedPages ?? "—"}</strong><small>{verticalIntel?.companiesWithLanding ?? "—"} con landing específica</small></article>
          <article><span>RECORRIDO MEDIANO</span><strong>{verticalIntel?.medianFunnelSteps ?? intelligence?.universal.medianFunnelSteps ?? "—"}</strong><small>pasos descritos en la lectura comercial</small></article>
          <article><span>FORMULARIO MEDIANO</span><strong>{verticalIntel?.medianFormFields ?? intelligence?.universal.medianFormFields ?? "—"}</strong><small>campos observados; se adapta al objetivo</small></article>
        </div>
        <div className={styles.evidenceColumns}>
          <article className={styles.anatomy}>
            <div className={styles.sectionTitle}><span>ANATOMÍA RECOMENDADA</span><b>8 bloques con una función</b></div>
            <ol>{(intelligence?.universal.anatomy || []).map((item) => <li key={item.id}><i>{String((intelligence?.universal.anatomy || []).findIndex((row) => row.id === item.id) + 1).padStart(2, "0")}</i><div><b>{item.label}</b><span>{item.purpose}</span></div></li>)}</ol>
          </article>
          <article className={styles.patterns}>
            <div className={styles.sectionTitle}><span>PATRONES OBSERVADOS</span><b>Frecuencia, no victoria</b></div>
            <h3>Cómo abren</h3>
            {(verticalIntel?.heroFamilies || intelligence?.universal.heroFamilies || []).slice(0, 4).map((family) => <div className={styles.patternRow} key={family.id}><div><b>{family.label}</b><span>{family.count} empresas de la muestra</span></div><strong>{family.share}%</strong></div>)}
            <h3>Qué acción piden</h3>
            {(verticalIntel?.ctaFamilies || intelligence?.universal.ctaFamilies || []).slice(0, 4).map((family) => <div className={styles.patternRow} key={family.id}><div><b>{family.label}</b><span>{family.count} empresas de la muestra</span></div><strong>{family.share}%</strong></div>)}
          </article>
          <article className={styles.coverage}>
            <div className={styles.sectionTitle}><span>QUÉ SUELEN EXPLICAR</span><b>Presencia en las fichas</b></div>
            {Object.entries(verticalIntel?.fieldPresence || intelligence?.universal.fieldPresence || {}).map(([key, value]) => <div key={key}><span>{FIELD_LABELS[key] || key}</span><b>{value}%</b><i><em style={{ width: `${value}%` }} /></i></div>)}
          </article>
        </div>

        <div className={styles.examplesHeader}><div><p>REFERENCIAS NAVEGABLES</p><h3>Ve la landing, su captura y lo que dice</h3></div><span>Máximo una ficha por tarjeta; la evidencia puede abrirse y contrastarse.</span></div>
        <div className={styles.exampleGrid}>
          {(verticalIntel?.examples || []).slice(0, visibleExamples).map((example) => (
            <article key={example.companyId} className={styles.exampleCard}>
              <a className={styles.exampleImage} href={`?vista=companies&empresa=${encodeURIComponent(example.companyId)}#record-site-capture`} target="_blank" rel="noopener noreferrer">
                {example.thumbnail ? <img src={example.thumbnail} alt={`Captura de ${example.name}`} loading="lazy" /> : <span>Sin vista previa</span>}
              </a>
              <div>
                <span>{example.country} · idioma {example.language || "no identificado"} · {example.capturedPages} páginas</span>
                <div className={styles.exampleBrand}>
                  <CompanyLogo company={{ id: example.companyId, name: example.name }} logos={logos} size="small" />
                  <h4>{example.name}</h4>
                </div>
                <p>{example.headline || example.offer}</p>
                {example.sectionHeadings?.length ? <ol className={styles.exampleOutline}>{example.sectionHeadings.slice(0, 5).map((heading, index) => <li key={`${example.companyId}-${heading}`}><i>{String(index + 1).padStart(2, "0")}</i><span>{heading}</span></li>)}</ol> : null}
                <div><a href={`?vista=companies&empresa=${encodeURIComponent(example.companyId)}#record-site-capture`} target="_blank" rel="noopener noreferrer">Abrir ficha</a>{example.sourceUrl ? <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer">Visitar web ↗</a> : null}</div>
              </div>
            </article>
          ))}
        </div>
        {verticalIntel && visibleExamples < verticalIntel.examples.length ? <button className={styles.moreButton} onClick={() => setVisibleExamples((current) => current + 4)}>Ver más referencias</button> : null}
      </section>

      </>) : null}

      {fullscreen ? (
        <div className={styles.fullscreen} role="dialog" aria-modal="true" aria-label="Vista previa completa de la landing">
          <header><div><span>VISTA PREVIA COMPLETA</span><b>{brief.brand} · {brief.service}</b></div><div className={styles.segmented}><button className={device === "desktop" ? styles.active : ""} onClick={() => setDevice("desktop")}>Escritorio</button><button className={device === "mobile" ? styles.active : ""} onClick={() => setDevice("mobile")}>Móvil</button></div><button className={styles.closeButton} onClick={() => setFullscreen(false)}>Cerrar ×</button></header>
          {preview}
        </div>
      ) : null}
      {toast ? <div className={styles.toast} role="status">{toast}</div> : null}
    </div>
  );
}
