"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import CompanyLogo from "./CompanyLogo";
import type { LogoManifest, VerticalesData } from "./data-types";
import {
  ANGLES,
  ARCHITECTURES,
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
} from "./landings/model";
import styles from "./LandingStudio.module.css";

type LandingStudioProps = {
  verticales: VerticalesData | null;
  logos: LogoManifest;
};

type Device = "desktop" | "mobile";
type EditorSection = "strategy" | "message" | "evidence" | "conversion";

const STORAGE_KEY = "rv-landing-studio-v2";

const safeParse = (raw: string | null): LandingBrief | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LandingBrief>;
    return { ...defaultBrief(value.verticalId), ...value } as LandingBrief;
  } catch {
    return null;
  }
};

const download = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

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
  const [intelligenceError, setIntelligenceError] = useState(false);
  const [activeSection, setActiveSection] = useState<EditorSection>("strategy");
  const [device, setDevice] = useState<Device>("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState("");
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
    fetch("/data/landing-intelligence.json", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<LandingIntelligence>) : null))
      .then((value) => {
        if (!active) return;
        if (value?.schemaVersion === "rv-landing-intelligence-v2") setIntelligence(value);
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
      activeRecipeId: ["architecture", "angle", "variant", "ctaMode", "ctaLabel", "objective", "trafficSource", "awareness"].includes(key)
        ? ""
        : current.activeRecipeId,
    }));
  const selectVertical = (verticalId: string) => {
    setPreviousBrief(brief);
    setBrief((current) => ({ ...current, verticalId, activeRecipeId: "" }));
    setStudyVerticalId(verticalId);
    setVisibleExamples(4);
    setToast("Vertical cambiado; hemos mantenido tu contenido");
  };
  const loadVerticalPreset = () => {
    setPreviousBrief(brief);
    setBrief((current) => applyVerticalPreset(current, current.verticalId));
    setToast("Contenido base del vertical cargado; puedes deshacerlo");
  };

  const html = useMemo(() => buildLandingHtml(brief), [brief]);
  const readiness = useMemo(() => landingReadiness(brief), [brief]);
  const publishReady = readiness.publishable;
  const verticalIntel =
    intelligence?.verticals[studyVerticalId] || intelligence?.verticals.generalista || null;
  const evidenceRecipes = useMemo(
    () => buildEvidenceRecipes(verticalIntel, intelligence?.universal, brief),
    [brief, verticalIntel, intelligence?.universal],
  );
  const activeRecipe =
    brief.verticalId === studyVerticalId
      ? evidenceRecipes.find((recipe) => recipe.id === brief.activeRecipeId) || null
      : null;
  const strategyRecommendation = useMemo(
    () => buildStrategyRecommendation(brief, verticalIntel),
    [brief, verticalIntel],
  );
  const variantA = useMemo(() => landingCopyPreview({ ...brief, variant: "a" }), [brief]);
  const variantB = useMemo(() => landingCopyPreview({ ...brief, variant: "b" }), [brief]);
  const landingCount = intelligence?.universal.roles.landing || 0;
  const preview = (
    <div className={`${styles.previewFrame} ${styles[device]}`}>
      <iframe title="Vista previa de la landing generada" srcDoc={html} sandbox="" />
    </div>
  );
  const filename = `landing-${slug(brief.service)}-${slug(brief.zone)}.html`;

  return (
    <div className={styles.studio}>
      <section className={styles.hero}>
        <div>
          <p>LANDING INTELLIGENCE STUDIO</p>
          <h1>Estudia el mercado. Diseña con criterio. Genera una landing lista para probar.</h1>
          <span>
            Un recorrido completo desde el corpus depurado hasta el HTML: patrones observados,
            decisiones explicadas, variantes comparables y controles antes de publicar.
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
            <div className={styles.compatibility}><strong>{strategyRecommendation.compatibility}</strong><small>/100 encaje estructural</small></div>
            <h3>{ARCHITECTURES.find((item) => item.id === strategyRecommendation.architecture)?.label}</h3>
            <p>{strategyRecommendation.reasons[0]}</p>
            <ul>{strategyRecommendation.reasons.slice(1).map((reason) => <li key={reason}>{reason}</li>)}</ul>
            <button type="button" onClick={() => { setPreviousBrief(brief); setBrief((current) => applyStrategyRecommendation(current, strategyRecommendation)); setToast("Estrategia aplicada; revisa el destino del CTA"); }}>Aplicar recomendación</button>
          </article>
        </div>

        <div className={styles.studyInsights}>
          <div><span>CONCLUSIONES ACCIONABLES</span><b>Qué merece convertirse en hipótesis</b></div>
          <ol>
            {(verticalIntel?.recommendations || []).slice(0, 4).map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
          </ol>
          {(verticalIntel?.study?.warnings || []).length ? <aside><b>Límites de esta muestra</b>{verticalIntel?.study?.warnings.map((warning) => <span key={warning}>{warning}</span>)}</aside> : null}
        </div>

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
                  disabled={brief.verticalId !== studyVerticalId}
                  onClick={() => {
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
                  {activeRecipe?.id === recipe.id ? "Enfoque aplicado ✓" : "Probar este enfoque"}
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
              <div className={styles.strategyContextGrid}>
                <label>Objetivo principal<select value={brief.objective} onChange={(event) => update("objective", event.target.value as LandingBrief["objective"])}><option value="qualified">Solicitud cualificada</option><option value="booking">Reserva o llamada</option><option value="quote">Presupuesto o propuesta</option><option value="contact">Contacto directo</option></select></label>
                <label>Origen del tráfico<select value={brief.trafficSource} onChange={(event) => update("trafficSource", event.target.value as LandingBrief["trafficSource"])}><option value="mixed">Mixto</option><option value="meta">Meta / interrupción</option><option value="google">Google / intención</option><option value="organic">Orgánico o referido</option><option value="outbound">Outbound</option></select></label>
                <label>Temperatura<select value={brief.awareness} onChange={(event) => update("awareness", event.target.value as LandingBrief["awareness"])}><option value="cold">Fría</option><option value="warm">Templada</option><option value="hot">Caliente</option></select></label>
                <label>Profundidad<select value={brief.depth} onChange={(event) => update("depth", event.target.value as LandingBrief["depth"])}><option value="short">Breve</option><option value="standard">Estándar</option><option value="extended">Extensa</option></select></label>
                <label>Campos del formulario<select value={brief.formFieldsTarget} onChange={(event) => update("formFieldsTarget", Number(event.target.value))}>{[3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value} campos</option>)}</select></label>
              </div>
              <div className={styles.inlineRecommendation}>
                <div><span>RECOMENDACIÓN ACTUAL</span><b>{ARCHITECTURES.find((item) => item.id === strategyRecommendation.architecture)?.label} · {strategyRecommendation.compatibility}/100 encaje</b><small>{strategyRecommendation.suggestedFormFields ? `${strategyRecommendation.suggestedFormFields} campos como punto de partida, usando la mediana del vertical cuando existe` : "Longitud de formulario pendiente de evidencia"}</small></div>
                <button type="button" onClick={() => { setPreviousBrief(brief); setBrief((current) => applyStrategyRecommendation(current, strategyRecommendation)); }}>Aplicar</button>
              </div>
              <fieldset><legend>Arquitectura del funnel</legend><div className={styles.optionGrid}>
                {ARCHITECTURES.map((item) => <button type="button" key={item.id} className={brief.architecture === item.id ? styles.selected : ""} onClick={() => update("architecture", item.id)}><b>{item.label}</b><span>{item.description}</span><small>{item.bestFor}</small></button>)}
              </div></fieldset>
              <fieldset><legend>Ángulo del mensaje</legend><div className={styles.angleGrid}>
                {ANGLES.map((item) => <button type="button" key={item.id} className={brief.angle === item.id ? styles.selected : ""} onClick={() => update("angle", item.id)} title={item.description}>{item.label}</button>)}
              </div></fieldset>
              <div className={styles.twoCols}>
                <label>Tono<select value={brief.tone} onChange={(event) => update("tone", event.target.value as LandingBrief["tone"])}><option value="consultative">Consultivo</option><option value="direct">Directo</option><option value="premium">Premium</option></select></label>
                <label>Variante activa<select value={brief.variant} onChange={(event) => update("variant", event.target.value as LandingBrief["variant"])}><option value="a">A · Resultado</option><option value="b">B · Dolor</option></select></label>
              </div>
              <div className={styles.variantCompare}>
                <button type="button" className={brief.variant === "a" ? styles.selected : ""} onClick={() => update("variant", "a")}><span>A · RESULTADO</span><b>{variantA.headline}</b><small>{variantA.cta}</small></button>
                <button type="button" className={brief.variant === "b" ? styles.selected : ""} onClick={() => update("variant", "b")}><span>B · DOLOR</span><b>{variantB.headline}</b><small>{variantB.cta}</small></button>
              </div>
              <p className={styles.helper}>A y B cambian únicamente el encuadre del hero. Arquitectura, oferta, prueba y CTA permanecen iguales para que el test sea interpretable.</p>
            </div>
          ) : null}

          {activeSection === "message" ? (
            <div className={styles.controls}>
              <div className={styles.twoCols}>
                <label>Marca<input value={brief.brand} onChange={(event) => update("brand", event.target.value)} /></label>
                <label>Zona<input value={brief.zone} onChange={(event) => update("zone", event.target.value)} placeholder="Madrid, España…" /></label>
              </div>
              <label>Servicio<input value={brief.service} onChange={(event) => update("service", event.target.value)} /></label>
              <label>Público<textarea value={brief.audience} onChange={(event) => update("audience", event.target.value)} /></label>
              <label>Resultado deseado<textarea value={brief.result} onChange={(event) => update("result", event.target.value)} /></label>
              <label>Problema que reconoce el cliente<textarea value={brief.pain} onChange={(event) => update("pain", event.target.value)} /></label>
              <label>Unidad que se capta<input value={brief.unit} onChange={(event) => update("unit", event.target.value)} placeholder="pacientes, reuniones, solicitudes…" /></label>
            </div>
          ) : null}

          {activeSection === "evidence" ? (
            <div className={styles.controls}>
              <label>Qué incluye la oferta<textarea value={brief.offer} onChange={(event) => update("offer", event.target.value)} /></label>
              <label>Criterios de cualificación<textarea value={brief.filter} onChange={(event) => update("filter", event.target.value)} /></label>
              <label>Prueba verificable<textarea value={brief.proof} onChange={(event) => update("proof", event.target.value)} placeholder="Caso, reseña o dato con empresa, periodo y fuente. Si lo dejas vacío, el bloque desaparece." /></label>
              <label>Precio o rango publicado<input value={brief.price} onChange={(event) => update("price", event.target.value)} placeholder="Ej. Desde 690 €/mes + inversión" /></label>
              <label>Garantía o compromiso contractual<textarea value={brief.guarantee} onChange={(event) => update("guarantee", event.target.value)} placeholder="Métrica, periodo, exclusiones y remedio. Si no existe, déjalo vacío." /></label>
              <p className={styles.helper}>La página pública nunca mostrará “por configurar”. Los bloques sin respaldo se eliminan automáticamente.</p>
            </div>
          ) : null}

          {activeSection === "conversion" ? (
            <div className={styles.controls}>
              <div className={styles.twoCols}>
                <label>Conversión<select value={brief.ctaMode} onChange={(event) => update("ctaMode", event.target.value as LandingBrief["ctaMode"])}><option value="whatsapp">WhatsApp</option><option value="phone">Llamada</option><option value="calendar">Calendario / URL</option></select></label>
                <label>Color<input className={styles.colorInput} type="color" value={brief.accent} onChange={(event) => update("accent", event.target.value)} /></label>
              </div>
              <label>{brief.ctaMode === "calendar" ? "URL del calendario" : "Teléfono destino"}<input value={brief.destination} onChange={(event) => update("destination", event.target.value)} placeholder={brief.ctaMode === "calendar" ? "https://calendly.com/…" : "34600000000"} /></label>
              <label>Texto del CTA<input value={brief.ctaLabel} onChange={(event) => update("ctaLabel", event.target.value)} placeholder="Se genera según la arquitectura" /></label>
              <label>URL del logo<input value={brief.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="https://…/logo.svg" /></label>
              <label>Imagen principal<input value={brief.heroImageUrl} onChange={(event) => update("heroImageUrl", event.target.value)} placeholder="https://…/imagen.webp" /></label>
              <label>Política de privacidad<input value={brief.privacyUrl} onChange={(event) => update("privacyUrl", event.target.value)} placeholder="https://…/privacidad" /></label>
            </div>
          ) : null}

          <div className={styles.checklist}>
            <div><span>04 · VALIDAR</span><b>Controles antes de exportar</b></div>
            {readiness.checks.map((check) => <button type="button" key={check.id} data-ok={check.ok} data-severity={check.severity} onClick={() => setActiveSection(check.section as EditorSection)}><i>{check.ok ? "✓" : "!"}</i><span>{check.label}<small>{check.ok ? "Resuelto" : severityLabel(check.severity)}</small></span><b>→</b></button>)}
          </div>
        </aside>

        <main className={styles.previewPanel}>
          <header className={styles.previewToolbar}>
            <div><span>04 · VALIDAR EN CONTEXTO</span><b>{ARCHITECTURES.find((item) => item.id === brief.architecture)?.label}</b></div>
            <div className={styles.previewActions}>
              <div className={styles.segmented}><button className={device === "desktop" ? styles.active : ""} onClick={() => setDevice("desktop")}>Escritorio</button><button className={device === "mobile" ? styles.active : ""} onClick={() => setDevice("mobile")}>Móvil</button></div>
              <button className={styles.iconButton} onClick={() => setFullscreen(true)} aria-label="Abrir vista previa a pantalla completa">⛶</button>
            </div>
          </header>
          {preview}
          <div className={styles.exportBar}>
            <div><span>ESTADO</span><b>{publishReady ? "Sin bloqueos críticos" : `${readiness.blockers.length} bloqueos por resolver`}</b><small>{publishReady ? "HTML listo para revisión humana y test." : "La exportación sigue disponible para revisión interna, pero todavía no es publicable."}</small></div>
            <div>
              <button onClick={() => download(filename, html, "text/html;charset=utf-8")}>{publishReady ? "Descargar HTML" : "Exportar versión para revisión"}</button>
              <button onClick={async () => { try { await navigator.clipboard.writeText(html); setToast("HTML copiado"); } catch { setToast("No se pudo copiar"); } }}>Copiar HTML</button>
              <button onClick={() => download(filename.replace(/\.html$/, ".json"), JSON.stringify(brief, null, 2), "application/json;charset=utf-8")}>Guardar brief</button>
            </div>
          </div>
        </main>
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
                <span>{example.country} · {example.capturedPages} páginas</span>
                <div className={styles.exampleBrand}>
                  <CompanyLogo company={{ id: example.companyId, name: example.name }} logos={logos} size="small" />
                  <h4>{example.name}</h4>
                </div>
                <p>{example.headline || example.offer}</p>
                <div><a href={`?vista=companies&empresa=${encodeURIComponent(example.companyId)}#record-site-capture`} target="_blank" rel="noopener noreferrer">Abrir ficha</a>{example.sourceUrl ? <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer">Visitar web ↗</a> : null}</div>
              </div>
            </article>
          ))}
        </div>
        {verticalIntel && visibleExamples < verticalIntel.examples.length ? <button className={styles.moreButton} onClick={() => setVisibleExamples((current) => current + 4)}>Ver más referencias</button> : null}
      </section>

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
