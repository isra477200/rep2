"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import ExecutionShell, { type ExecutionSection } from "./ExecutionShell";
import styles from "./execution.module.css";
import packStyles from "./execution-pack.module.css";
import {
  CAMPAIGNS,
  CAMPAIGN_STATES,
  CAPTURE_UNITS,
  CREATIVES,
  CREATIVE_FORMATS,
  CREATIVE_REQUIREMENTS,
  CREATIVE_SPEC_SOURCES,
  CREATIVE_STATES,
  DECISIONS,
  DECISION_STATES,
  EXPERIMENTS,
  LEARNINGS,
  PRICING,
  PRICING_SOURCE,
  type CampaignMode,
} from "./catalog";
import { calculateEconomics, type LabInputs } from "./economics";
import { downloadJson, usePersistentState, writeStoredValue } from "./storage";

// The alias keeps the compact scenario table type-safe without duplicating the result type.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const calculate = calculateEconomics;

type WorkspaceKind = Exclude<ExecutionSection, "systems">;

type CampaignDraft = (typeof CAMPAIGNS)[number] & {
  subniche: string;
  brandKit: string;
  aggressiveness: string;
  trial: string;
  expectedResult: string;
  followup: string[];
};

const pageCopy: Record<WorkspaceKind, { eyebrow: string; title: string; description: string }> = {
  campaigns: { eyebrow: "FÁBRICA DE CAMPAÑAS", title: "De una decisión de nicho a dos campañas distintas.", description: "B2B vende el sistema de RedVitalia a la empresa. B2C capta oportunidades para esa empresa. Presupuesto, landing, mensaje y conversión se mantienen separados." },
  creative: { eyebrow: "FÁBRICA CREATIVA", title: "Brief, concepto, composición y control en un mismo flujo.", description: "El arte base se genera con ChatGPT sin texto. Esta capa aplica copy editable, conserva metadatos y deja cada pieza pendiente de revisión humana." },
  library: { eyebrow: "BIBLIOTECA CREATIVA", title: "144 conceptos maestros, trazables y adaptados.", description: "Filtra por nicho, cliente, campaña, canal, ángulo, fecha, estado y rendimiento. Cada pieza conserva siete archivos físicos y una matriz honesta de 23 entregables, incluidos bloqueos de marca y vídeo." },
  economics: { eyebrow: "LABORATORIO ECONÓMICO", title: "El CPL no decide. Decide la contribución.", description: "Edita fee, medios y ratios para ver el recorrido completo desde lead hasta venta. Los escenarios son hipótesis, nunca una previsión garantizada." },
  experiments: { eyebrow: "EXPERIMENTOS", title: "Cada prueba nace con aprobación y fallo escritos.", description: "Control, variante, volumen mínimo, métrica principal y próxima acción permanecen juntos para evitar declarar ganadores por intuición." },
  decisions: { eyebrow: "DECISIONES", title: "La fórmula ayuda. La aprobación sigue siendo humana.", description: "Prioridades, evidencia, riesgo y siguiente decisión quedan visibles. Cambiar un estado aquí no publica ni modifica campañas reales." },
  learnings: { eyebrow: "APRENDIZAJES", title: "Convertir resultados en reglas reutilizables.", description: "Separa lo que conviene copiar, adaptar, probar, vigilar o descartar y conserva la fuente que sostiene cada conclusión." },
};

const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

const readQuery = () => typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);

function Metrics({ items }: { items: Array<{ label: string; value: string | number; note: string }> }) {
  return <section className={styles.metrics}>{items.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></article>)}</section>;
}

function SectionHead({ kicker, title, text, side }: { kicker: string; title: string; text?: string; side?: string }) {
  return <header className={styles.sectionHead}><div><p className={styles.kicker}>{kicker}</p><h2>{title}</h2>{text ? <p>{text}</p> : null}</div>{side ? <span>{side}</span> : null}</header>;
}

function CampaignPack({ campaign }: { campaign: (typeof CAMPAIGNS)[number] }) {
  const blocks = [
    { title: "Audiencias", items: campaign.audiences },
    { title: "Ubicaciones y exclusiones", items: [...campaign.locations, ...campaign.exclusions] },
    { title: "Automatización", items: campaign.automationPlan },
    { title: "KPIs", items: campaign.kpis },
    { title: "Control", items: campaign.controls },
    { title: "Escalar", items: campaign.scaleCriteria },
    { title: "Parar", items: campaign.stopCriteria },
    { title: "Riesgos", items: campaign.risks },
  ];
  return <div className={packStyles.campaignPack}>
    <section><h3>Arquitectura y grupos</h3><p>{campaign.strategicSummary}</p><div className={packStyles.packSequence}>{campaign.architecture.map((item, index) => <span key={item}><b>{index + 1}</b>{item}</span>)}</div><div className={packStyles.packTable}><div><span>Grupo</span><span>Intención</span><span>Mensaje</span></div>{campaign.adStructure.map((item) => <article key={item.id}><strong>{item.name}</strong><p>{item.intent}</p><span>{item.message}</span></article>)}</div></section>
    <section><h3>Landing, formulario y medición</h3><div className={packStyles.packColumns}><article><b>Landing</b><p>{campaign.landingPlan.hero}</p><small>{campaign.landingPlan.sections.join(" · ")}</small></article><article><b>Formulario inicial</b><p>{campaign.formPlan.firstStep.join(" · ")}</p><small>Después: {campaign.formPlan.later.join(" · ") || "Sin campos adicionales"}</small></article><article><b>Evento primario</b><p><code>{campaign.trackingPlan.primary}</code></p><small>{campaign.trackingPlan.quality.join(" · ")}</small></article><article><b>Puja</b><p>{campaign.bidding.start}</p><small>{campaign.bidding.evolve}</small></article></div></section>
    <section><h3>Producción creativa</h3><div className={packStyles.packColumns}>{campaign.creativeNeeds.map((item) => <article key={item.route}><b>{item.route}</b><p>{item.direction}</p><small>{item.variants.join(" · ")}</small></article>)}</div></section>
    <section><h3>Remarketing por etapa</h3><div className={packStyles.packColumns}>{campaign.remarketingStages.map((item) => <article key={item.stage}><b>{item.stage}</b><p>{item.message}</p></article>)}</div></section>
    <section><h3>Presupuesto, control y decisión</h3><div className={packStyles.budgetBar} aria-label="Distribución presupuestaria">{campaign.budgetAllocation.map((item) => <span key={item.bucket} style={{ flexBasis: `${item.share}%` }}><b>{item.share}%</b>{item.bucket}</span>)}</div><div className={packStyles.packLists}>{blocks.map((block) => <article key={block.title}><h4>{block.title}</h4><ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div></section>
    <section><h3>Puerta de lanzamiento</h3><div className={packStyles.packChecklist}>{campaign.launchChecklist.map((item) => <span key={item}>□ {item}</span>)}</div></section>
  </div>;
}

function CampaignsView() {
  const defaultBuilder = {
    unitId: "segunda-oportunidad",
    subniche: "Deuda financiera",
    mode: "B2B" as CampaignMode,
    objective: "Conseguir una reunión cualificada",
    zone: "España",
    budget: "900",
    channel: "Google Search + Meta remarketing",
    offer: "Auditoría del recorrido actual + piloto",
    brandKit: "Pendiente de cliente",
    audience: "Socio director o responsable de negocio",
    aggressiveness: "Prudente",
    trial: "30 días",
    client: "",
    result: "Reunión asistida",
  };
  const [unitId, setUnitId] = usePersistentState("campaign-filter-unit", "segunda-oportunidad");
  const [mode, setMode] = usePersistentState<CampaignMode | "Todos">("campaign-filter-mode", "Todos");
  const [status, setStatus] = usePersistentState("campaign-filter-status", "Todos");
  const [campaignStates, setCampaignStates] = usePersistentState<Record<string, string>>("campaign-states", {});
  const [builder, setBuilder] = usePersistentState("campaign-builder", defaultBuilder);
  const [preview, setPreview] = usePersistentState<CampaignDraft | null>("campaign-draft", null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const query = readQuery();
    const requestedUnit = query.get("unidad");
    const requestedMode = query.get("modo");
    if (requestedUnit && CAPTURE_UNITS.some((item) => item.id === requestedUnit)) {
      setUnitId(requestedUnit);
      setBuilder((current) => ({ ...current, unitId: requestedUnit }));
    }
    if (requestedMode === "B2B" || requestedMode === "B2C") {
      setMode(requestedMode);
      setBuilder((current) => ({ ...current, mode: requestedMode }));
    }
  }, [setBuilder, setMode, setUnitId]);

  const filtered = useMemo(() => CAMPAIGNS.filter((item) => {
    const itemStatus = campaignStates[item.id] || item.status;
    return (unitId === "Todos" || item.unitId === unitId)
      && (mode === "Todos" || item.mode === mode)
      && (status === "Todos" || itemStatus === status);
  }), [campaignStates, mode, status, unitId]);

  const selectedBase = CAMPAIGNS.find((item) => item.id === selectedId) || null;
  const selected = selectedBase ? { ...selectedBase, status: campaignStates[selectedBase.id] || selectedBase.status } : null;

  const selectBuilderUnit = (nextId: string) => {
    const unit = CAPTURE_UNITS.find((item) => item.id === nextId)!;
    setBuilder((current) => ({
      ...current,
      unitId: nextId,
      subniche: unit.subniches[0],
      audience: current.mode === "B2B" ? unit.decisionMaker : unit.endUser,
      result: current.mode === "B2B" ? "Reunión asistida" : unit.result,
    }));
  };

  const selectBuilderMode = (nextMode: CampaignMode) => {
    const unit = CAPTURE_UNITS.find((item) => item.id === builder.unitId)!;
    setBuilder((current) => ({
      ...current,
      mode: nextMode,
      audience: nextMode === "B2B" ? unit.decisionMaker : unit.endUser,
      objective: nextMode === "B2B" ? "Conseguir una reunión cualificada" : `Generar ${unit.result.toLocaleLowerCase("es")}`,
      result: nextMode === "B2B" ? "Reunión asistida" : unit.result,
    }));
  };

  const createPreview = () => {
    const base = CAMPAIGNS.find((item) => item.unitId === builder.unitId && item.mode === builder.mode)!;
    const next: CampaignDraft = {
      ...base,
      zone: builder.zone.trim() || base.zone,
      budget: Math.max(0, Number(builder.budget) || base.budget),
      channel: builder.channel.trim() || base.channel,
      audience: builder.audience.trim() || base.audience,
      objective: builder.objective.trim() || base.objective,
      offer: builder.offer.trim() || base.offer,
      status: "Borrador",
      subniche: builder.subniche,
      brandKit: builder.brandKit,
      aggressiveness: builder.aggressiveness,
      trial: builder.trial,
      expectedResult: builder.result,
      followup: ["Contacto dentro del SLA", "Confirmación y cualificación", "Recordatorio", "Resultado y motivo de pérdida", "Reactivación con consentimiento"],
    };
    setPreview(next);
  };

  const changeCampaignState = (id: string, next: string) => setCampaignStates((current) => ({ ...current, [id]: next }));

  return (
    <>
      <div className={styles.notice}>
        <div><strong>Control humano activo</strong><span>Los cambios y exportaciones son locales. No se conecta con Google Ads ni Meta Ads.</span></div>
        <a href="#campaign-builder">Crear campaña</a>
      </div>
      <Metrics items={[
        { label: "CAMPAÑAS BASE", value: CAMPAIGNS.length, note: "12 B2B + 12 B2C" },
        { label: "LISTAS PARA APROBAR", value: CAMPAIGNS.filter((item) => (campaignStates[item.id] || item.status) === "Lista para aprobar").length, note: "Estado recuperable" },
        { label: "CONVERSIONES PRIMARIAS", value: new Set(CAMPAIGNS.map((item) => item.primaryConversion)).size, note: "Sin mezclar especialidades" },
        { label: "PUBLICACIONES AUTOMÁTICAS", value: 0, note: "Bloqueadas por diseño" },
      ]} />
      <div className={styles.toolbar}>
        <label><span>Especialidad</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="Todos">Todas</option>{CAPTURE_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
        <label><span>Tipo</span><select value={mode} onChange={(event) => setMode(event.target.value as CampaignMode | "Todos")}><option>Todos</option><option>B2B</option><option>B2C</option></select></label>
        <label><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{CAMPAIGN_STATES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className={styles.secondary} onClick={() => { setUnitId("Todos"); setMode("Todos"); setStatus("Todos"); }}>Limpiar filtros</button>
      </div>
      {filtered.length ? (
        <section className={styles.campaignGrid} aria-label="Campañas filtradas">
          {filtered.map((item) => {
            const itemStatus = campaignStates[item.id] || item.status;
            return <article className={styles.campaignCard} key={item.id}><div><div className={styles.campaignMeta}><span className={item.mode === "B2B" ? styles.modeB2B : styles.modeB2C}>{item.mode}</span><span className={styles.status}>{itemStatus}</span><span className={styles.evidence}>{item.evidence}</span></div><h3>{item.unit}</h3><p>{item.objective}</p><div className={styles.campaignMeta}><span className={styles.pill}>{item.channel}</span><span className={styles.pill}>{euro.format(item.budget)} medios</span><span className={styles.pill}>{item.primaryConversion}</span></div></div><button type="button" onClick={() => setSelectedId(item.id)}>Abrir</button></article>;
          })}
        </section>
      ) : <div className={styles.empty}><p>No hay campañas con esta combinación.</p><button className={styles.secondary} onClick={() => { setUnitId("Todos"); setMode("Todos"); setStatus("Todos"); }}>Mostrar todas</button></div>}
      {selected ? (
        <section className={styles.detailPanel}>
          <header><div><span className={selected.mode === "B2B" ? styles.modeB2B : styles.modeB2C}>{selected.mode}</span><h2>{selected.unit}</h2><p>{selected.id} · {selected.status}</p></div><button aria-label="Cerrar detalle" onClick={() => setSelectedId(null)}>×</button></header>
          <div className={styles.detailGrid}>
            <article><h3>Objetivo y público</h3><p>{selected.objective}</p><p>{selected.audience}</p></article>
            <article><h3>Oferta y mensaje</h3><p>{selected.offer}</p><p>{selected.message}</p></article>
            <article><h3>Arquitectura</h3><ul><li>{selected.channel}</li><li>{selected.schedule}</li><li>{selected.devices}</li><li><a href={selected.landing}>Abrir landing propuesta</a></li></ul></article>
            <article><h3>Keywords y negativas</h3><p><b>Atacar:</b> {selected.keywords.join(" · ")}</p><p><b>Excluir:</b> {selected.negatives.join(" · ")}</p></article>
            <article><h3>Medición</h3><p><b>Primaria:</b> {selected.primaryConversion}</p><p><b>Secundarias:</b> {selected.secondaryConversions.join(" · ")}</p></article>
            <article><h3>Seguimiento multicanal</h3><p><b>Email:</b> {selected.messages.emailSubject}</p><p><b>Apertura:</b> {selected.messages.openingScript}</p><p><b>No-show:</b> {selected.messages.noShow}</p></article>
            <article><h3>Control</h3><label className={styles.field}><span>Estado local</span><select value={selected.status} onChange={(event) => changeCampaignState(selected.id, event.target.value)}>{CAMPAIGN_STATES.map((item) => <option key={item}>{item}</option>)}</select></label><button className={styles.secondary} onClick={() => downloadJson(`${selected.id}.json`, selected)}>Exportar briefing completo</button></article>
          </div>
          <details className={packStyles.packDisclosure} open><summary>Ver pack operativo completo</summary><CampaignPack campaign={selected} /></details>
        </section>
      ) : null}
      <section className={styles.section} id="campaign-builder">
        <SectionHead kicker="CONSTRUCTOR" title="Configurar una campaña revisable" text="Todos los campos pedidos por la fábrica quedan vinculados al nicho, la landing, la creatividad y la conversión. El borrador se recupera tras recargar." />
        <div className={styles.builder}>
          <div className={styles.formCard}>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>Nicho / especialidad</span><select value={builder.unitId} onChange={(event) => selectBuilderUnit(event.target.value)}>{CAPTURE_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
              <label className={styles.field}><span>Subnicho</span><select value={builder.subniche} onChange={(event) => setBuilder({ ...builder, subniche: event.target.value })}>{CAPTURE_UNITS.find((item) => item.id === builder.unitId)?.subniches.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className={styles.field}><span>B2B o B2C</span><select value={builder.mode} onChange={(event) => selectBuilderMode(event.target.value as CampaignMode)}><option>B2B</option><option>B2C</option></select></label>
              <label className={styles.field}><span>Objetivo</span><input value={builder.objective} onChange={(event) => setBuilder({ ...builder, objective: event.target.value })} /></label>
              <label className={styles.field}><span>Zona</span><input value={builder.zone} onChange={(event) => setBuilder({ ...builder, zone: event.target.value })} /></label>
              <label className={styles.field}><span>Presupuesto de medios</span><input type="number" min="0" value={builder.budget} onChange={(event) => setBuilder({ ...builder, budget: event.target.value })} /></label>
              <label className={styles.field}><span>Canal</span><input value={builder.channel} onChange={(event) => setBuilder({ ...builder, channel: event.target.value })} /></label>
              <label className={styles.field}><span>Agresividad</span><select value={builder.aggressiveness} onChange={(event) => setBuilder({ ...builder, aggressiveness: event.target.value })}><option>Prudente</option><option>Equilibrada</option><option>Exploratoria</option></select></label>
              <label className={styles.field}><span>Oferta</span><input value={builder.offer} onChange={(event) => setBuilder({ ...builder, offer: event.target.value })} /></label>
              <label className={styles.field}><span>Público</span><input value={builder.audience} onChange={(event) => setBuilder({ ...builder, audience: event.target.value })} /></label>
              <label className={styles.field}><span>Cliente</span><input placeholder="Opcional hasta asignación" value={builder.client} onChange={(event) => setBuilder({ ...builder, client: event.target.value })} /></label>
              <label className={styles.field}><span>Brand kit</span><input value={builder.brandKit} onChange={(event) => setBuilder({ ...builder, brandKit: event.target.value })} /></label>
              <label className={styles.field}><span>Periodo de prueba</span><input value={builder.trial} onChange={(event) => setBuilder({ ...builder, trial: event.target.value })} /></label>
              <label className={styles.field}><span>Resultado esperado</span><input value={builder.result} onChange={(event) => setBuilder({ ...builder, result: event.target.value })} /></label>
            </div>
            <div className={styles.formActions}><button className={styles.primary} onClick={createPreview}>Generar briefing</button>{preview ? <button className={styles.secondary} onClick={() => downloadJson(`brief-${preview.id}.json`, preview)}>Descargar</button> : null}</div>
          </div>
          <div className={styles.previewCard} aria-live="polite">
            <small>PREVISUALIZACIÓN ESTRATÉGICA</small>
            {preview ? <><h2>{preview.unit} · {preview.mode}</h2><p>{preview.objective}</p><div className={styles.previewList}>{[
              ["Arquitectura", `${preview.channel} · ${preview.zone} · ${preview.adStructure.length} grupos`],
              ["Landing y formulario", `${preview.landing} · ${CAPTURE_UNITS.find((unit) => unit.id === preview.unitId)?.qualification.slice(0, 4).join(" · ")}`],
              ["Creatividad", `${preview.brandKit} · ${preview.aggressiveness} · rutas ligadas al subnicho ${preview.subniche}`],
              ["Medición", `${preview.primaryConversion} como resultado primario; clics y formularios son señales intermedias.`],
              ["Seguimiento", preview.followup.join(" → ")],
              ["Puerta de control", `Borrador · ${preview.trial} · requiere datos, revisión y aprobación humana.`],
            ].map(([title, text], index) => <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></> : <><h2>Aún no hay borrador.</h2><p>Completa los campos y genera un briefing para revisar la estructura antes de producir creatividad.</p></>}
          </div>
        </div>
      </section>
    </>
  );
}

function CreativeFactoryView() {
  const [unitId, setUnitId] = usePersistentState("creative-factory-unit", "segunda-oportunidad");
  const [mode, setMode] = usePersistentState<CampaignMode>("creative-factory-mode", "B2B");
  const unit = CAPTURE_UNITS.find((item) => item.id === unitId)!;
  const candidates = CREATIVES.filter((item) => item.unitId === unitId && item.mode === mode);
  const [route, setRoute] = usePersistentState("creative-factory-route", 0);
  const [concept, setConcept] = usePersistentState("creative-factory-concept", 0);
  const selected = candidates[Math.min(route * 2 + concept, candidates.length - 1)] || CREATIVES[0];
  const [savedBriefId, setSavedBriefId] = usePersistentState("creative-saved-brief", "");
  const [qa, setQa] = usePersistentState<Record<string, Record<string, boolean>>>("creative-qa", {});
  const qaItems = ["Ortografía y CTA", "Legibilidad y contraste", "Márgenes seguros", "Recortes y anatomía", "Coherencia de marca", "Promesas y cumplimiento", "Datos y precio verificados", "Derechos de imagen", "Sin marcas ajenas"];
  const selectedQa = qa[selected.id] || {};
  const completedQa = qaItems.filter((item) => selectedQa[item]).length;

  useEffect(() => {
    const query = readQuery();
    const requestedUnit = query.get("unidad");
    const requestedMode = query.get("modo");
    if (requestedUnit && CAPTURE_UNITS.some((item) => item.id === requestedUnit)) {
      setUnitId(requestedUnit);
      setRoute(0);
      setConcept(0);
    }
    if (requestedMode === "B2B" || requestedMode === "B2C") setMode(requestedMode);
  }, [setConcept, setMode, setRoute, setUnitId]);

  const resetUnit = (id: string) => { setUnitId(id); setRoute(0); setConcept(0); };
  const saveBrief = () => {
    writeStoredValue("creative-brief", selected);
    setSavedBriefId(selected.id);
  };
  const toggleQa = (item: string, checked: boolean) => setQa((current) => ({ ...current, [selected.id]: { ...(current[selected.id] || {}), [item]: checked } }));

  return <>
    <div className={styles.notice}><div><strong>Generación real, automatización pendiente</strong><span>Los 12 artes base se generaron con ChatGPT. Esta aplicación prepara y verifica el briefing; no finge una API de generación conectada.</span></div><a href={`/biblioteca-creativa?unidad=${unitId}&modo=${mode}`}>Abrir biblioteca filtrada</a></div>
    <Metrics items={[{ label: "ARTES BASE CHATGPT", value: CAPTURE_UNITS.length, note: "Sin texto integrado" }, { label: "CONCEPTOS MAESTROS", value: CREATIVES.length, note: "6 B2B + 6 B2C por unidad" }, { label: "COBERTURA", value: CREATIVE_REQUIREMENTS.length, note: "Entregables por concepto" }, { label: "ARCHIVOS", value: CREATIVES.length * CREATIVE_FORMATS.length, note: `${CREATIVE_FORMATS.length} adaptaciones físicas por concepto` }]} />
    <section className={styles.builder}>
      <div className={styles.formCard}>
        <SectionHead kicker="BRIEF" title="Leer el sistema antes de componer" />
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.full}`}><span>Nicho / especialidad</span><select value={unitId} onChange={(event) => resetUnit(event.target.value)}>{CAPTURE_UNITS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className={styles.field}><span>Campaña</span><select value={mode} onChange={(event) => { setMode(event.target.value as CampaignMode); setRoute(0); setConcept(0); }}><option>B2B</option><option>B2C</option></select></label>
          <label className={styles.field}><span>Ruta creativa</span><select value={route} onChange={(event) => { setRoute(Number(event.target.value)); setConcept(0); }}>{unit.creativeRoutes.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></label>
          <label className={styles.field}><span>Concepto</span><select value={concept} onChange={(event) => setConcept(Number(event.target.value))}><option value={0}>Resultado verificable</option><option value={1}>Proceso y filtro</option></select></label>
          <label className={styles.field}><span>Cliente</span><input value="Sin cliente asignado" readOnly /></label>
          <label className={`${styles.field} ${styles.full}`}><span>Restricción crítica</span><textarea value={unit.compliance} readOnly /></label>
        </div>
        <div className={styles.formActions}><button className={styles.primary} onClick={saveBrief}>{savedBriefId === selected.id ? "Brief guardado" : "Guardar brief"}</button><button className={styles.secondary} onClick={() => downloadJson(`brief-${selected.id}.json`, selected)}>Exportar brief</button><a className={styles.secondary} href={selected.master} download>Descargar maestro</a></div>
      </div>
      <div><div className={styles.creativeCanvas}><img src={selected.baseImage} alt={selected.alt} width="1600" height="900" /><div className={styles.creativeOverlay}><small>{selected.mode} · {selected.route}</small><h2>{selected.headline}</h2><p>{selected.copy}</p><b>{selected.cta}</b></div></div><div className={styles.creativeMeta}><span><b>Ángulo</b><br />{selected.angle}</span><span><b>Estado de QA</b><br />{completedQa}/{qaItems.length} controles</span><span><b>Herramienta</b><br />ChatGPT + composición</span></div></div>
    </section>
    <section className={styles.section}>
      <SectionHead kicker="CONTROL DE CALIDAD" title="Comprobar antes de aprobar" text="Los controles se recuperan tras recargar. Completar la lista no publica ni aprueba la pieza." side={`${completedQa}/${qaItems.length}`} />
      <div className={styles.qaList}>{qaItems.map((item) => <label key={item}><input type="checkbox" checked={Boolean(selectedQa[item])} onChange={(event) => toggleQa(item, event.target.checked)} />{item}</label>)}</div>
    </section>
    <section className={styles.section}>
      <SectionHead kicker="ESPECIFICACIONES" title="Fuentes oficiales revisadas" text="Los logos permanecen bloqueados hasta recibir el brand kit real. Una imagen de portada no se presenta como vídeo terminado." side={`Corte ${CREATIVE_SPEC_SOURCES[0].checkedAt}`} />
      <div className={packStyles.packColumns}>{CREATIVE_SPEC_SOURCES.map((source) => <article className={styles.sourceCard} key={source.platform}><b>{source.platform}</b><p>{source.note}</p><a href={source.url} target="_blank" rel="noreferrer">Abrir documentación oficial</a></article>)}</div>
    </section>
  </>;
}

function CreativeLibraryView() {
  const [filters, setFilters] = usePersistentState("library-filters", { unitId: "Todos", mode: "Todos" as CampaignMode | "Todos", route: "Todas", status: "Todos", format: "Todos", client: "Todos", campaign: "Todas", channel: "Todos", angle: "Todos", date: "Todas", performance: "Todos", query: "", view: "gallery" as "gallery" | "list" });
  const [savedViews, setSavedViews] = usePersistentState<Record<string, typeof filters>>("library-saved-views", {});
  const [viewName, setViewName] = useState("");
  const [creativeStates, setCreativeStates] = usePersistentState<Record<string, string>>("creative-states", {});
  const [notes, setNotes] = usePersistentState<Record<string, string>>("creative-notes", {});
  const [performance, setPerformance] = usePersistentState<Record<string, { spend: number; impressions: number; clicks: number; leads: number; results: number; note: string }>>("creative-performance", {});
  const [versions, setVersions] = usePersistentState<Array<{ id: string; sourceId: string; version: number; status: string; createdAt: string }>>("creative-versions", []);
  const [jobs, setJobs] = usePersistentState<Array<{ id: string; creativeId: string; action: string; format?: string; status: string; createdAt: string }>>("creative-jobs", []);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [compare, setCompare] = usePersistentState<string[]>("library-compare", []);
  const [visible, setVisible] = useState(24);
  const routes = [...new Set(CREATIVES.map((item) => item.route))];
  const clients = [...new Set(CREATIVES.map((item) => item.client))];
  const campaigns = [...new Set(CREATIVES.map((item) => item.campaignId))];
  const channels = [...new Set(CREATIVES.map((item) => item.channel))];
  const angles = [...new Set(CREATIVES.map((item) => item.angle))];
  const dates = [...new Set(CREATIVES.map((item) => item.date))];
  const filtered = useMemo(() => CREATIVES.filter((item) => {
    const itemStatus = creativeStates[item.id] || item.status;
    return (filters.unitId === "Todos" || item.unitId === filters.unitId)
      && (filters.mode === "Todos" || item.mode === filters.mode)
      && (filters.route === "Todas" || item.route === filters.route)
      && (filters.status === "Todos" || itemStatus === filters.status)
      && (filters.client === "Todos" || item.client === filters.client)
      && (filters.campaign === "Todas" || item.campaignId === filters.campaign)
      && (filters.channel === "Todos" || item.channel === filters.channel)
      && (filters.angle === "Todos" || item.angle === filters.angle)
      && (filters.date === "Todas" || item.date === filters.date)
      && (filters.performance === "Todos" || (filters.performance === "Con datos" ? Boolean(performance[item.id]) : !performance[item.id]))
      && (!filters.query.trim() || `${item.headline} ${item.concept} ${item.niche} ${item.subniche} ${item.angle} ${item.campaignId}`.toLocaleLowerCase("es").includes(filters.query.trim().toLocaleLowerCase("es")));
  }), [creativeStates, filters, performance]);
  const detail = CREATIVES.find((item) => item.id === detailId) || null;
  const compared = compare.map((id) => CREATIVES.find((item) => item.id === id)).filter(Boolean) as typeof CREATIVES;
  const toggleCompare = (id: string) => setCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  const setFilter = (key: keyof typeof filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setVisible(24); };
  const clearFilters = () => { setFilters({ unitId: "Todos", mode: "Todos", route: "Todas", status: "Todos", format: "Todos", client: "Todos", campaign: "Todas", channel: "Todos", angle: "Todos", date: "Todas", performance: "Todos", query: "", view: "gallery" }); setVisible(24); };
  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    setSavedViews((current) => ({ ...current, [name]: filters }));
    setViewName("");
  };

  useEffect(() => {
    const query = readQuery();
    const requestedUnit = query.get("unidad");
    const requestedMode = query.get("modo");
    const requestedCreative = query.get("creatividad");
    setFilters((current) => ({
      ...current,
      unitId: requestedUnit && CAPTURE_UNITS.some((item) => item.id === requestedUnit) ? requestedUnit : current.unitId,
      mode: requestedMode === "B2B" || requestedMode === "B2C" ? requestedMode : current.mode,
    }));
    if (requestedCreative && CREATIVES.some((item) => item.id === requestedCreative)) {
      window.setTimeout(() => setDetailId(requestedCreative), 0);
    }
  }, [setFilters]);

  const creativeFile = (item: (typeof CREATIVES)[number]) => filters.format === "Todos"
    ? item.master
    : item.adaptations.find((adaptation) => adaptation.id === filters.format)?.file || item.master;

  const duplicateBrief = (item: (typeof CREATIVES)[number]) => {
    const createdAt = new Date().toISOString();
    const nextVersion = Math.max(item.version, ...versions.filter((version) => version.sourceId === item.id).map((version) => version.version), 0) + 1;
    const version = { id: `${item.id}-v${nextVersion}`, sourceId: item.id, version: nextVersion, status: "Brief", createdAt };
    setVersions((current) => [...current, version]);
    writeStoredValue("creative-brief", { ...item, ...version, performance: null, learning: "Pendiente de prueba" });
  };
  const prepareRegeneration = (item: (typeof CREATIVES)[number]) => setJobs((current) => [...current, { id: `job-${Date.now()}`, creativeId: item.id, action: "Regenerar con ChatGPT", status: "Preparada · ejecución manual", createdAt: new Date().toISOString() }]);
  const prepareAdaptation = (item: (typeof CREATIVES)[number], format = "Formato seleccionado en revisión") => setJobs((current) => [...current, { id: `job-${Date.now()}`, creativeId: item.id, action: "Adaptar", format, status: "Preparada", createdAt: new Date().toISOString() }]);
  const setPerformanceValue = (id: string, key: "spend" | "impressions" | "clicks" | "leads" | "results" | "note", value: string | number) => setPerformance((current) => {
    const existing = current[id] || { spend: 0, impressions: 0, clicks: 0, leads: 0, results: 0, note: "" };
    return { ...current, [id]: { ...existing, [key]: value } };
  });

  return <>
    <Metrics items={[{ label: "CONCEPTOS", value: CREATIVES.length, note: "Metadatos completos" }, { label: "ENTREGABLES", value: CREATIVE_REQUIREMENTS.length, note: "Cobertura por concepto" }, { label: "ARCHIVOS FÍSICOS", value: CREATIVES.length * CREATIVE_FORMATS.length, note: "7 adaptaciones descargables" }, { label: "CON RENDIMIENTO", value: Object.keys(performance).length, note: "Registro local trazable" }]} />
    <div className={styles.toolbar}>
      <label className={styles.grow}><span>Buscar</span><input value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder="Titular, ruta, nicho, ángulo o campaña" /></label>
      <label><span>Especialidad</span><select value={filters.unitId} onChange={(event) => setFilter("unitId", event.target.value)}><option>Todos</option>{CAPTURE_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
      <label><span>Tipo</span><select value={filters.mode} onChange={(event) => setFilter("mode", event.target.value)}><option>Todos</option><option>B2B</option><option>B2C</option></select></label>
      <label><span>Ruta</span><select value={filters.route} onChange={(event) => setFilter("route", event.target.value)}><option>Todas</option>{routes.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Estado</span><select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option>Todos</option>{CREATIVE_STATES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Formato</span><select value={filters.format} onChange={(event) => setFilter("format", event.target.value)}><option>Todos</option>{CREATIVE_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>Cliente</span><select value={filters.client} onChange={(event) => setFilter("client", event.target.value)}><option>Todos</option>{clients.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Campaña</span><select value={filters.campaign} onChange={(event) => setFilter("campaign", event.target.value)}><option>Todas</option>{campaigns.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Canal</span><select value={filters.channel} onChange={(event) => setFilter("channel", event.target.value)}><option>Todos</option>{channels.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Ángulo</span><select value={filters.angle} onChange={(event) => setFilter("angle", event.target.value)}><option>Todos</option>{angles.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Fecha</span><select value={filters.date} onChange={(event) => setFilter("date", event.target.value)}><option>Todas</option>{dates.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Rendimiento</span><select value={filters.performance} onChange={(event) => setFilter("performance", event.target.value)}><option>Todos</option><option>Con datos</option><option>Sin datos</option></select></label>
      <label><span>Vista</span><select value={filters.view} onChange={(event) => setFilter("view", event.target.value)}><option value="gallery">Galería</option><option value="list">Lista</option></select></label>
      <label><span>Vista guardada</span><select defaultValue="" onChange={(event) => { if (event.target.value && savedViews[event.target.value]) setFilters(savedViews[event.target.value]); }}><option value="">Seleccionar</option>{Object.keys(savedViews).map((name) => <option key={name}>{name}</option>)}</select></label>
      <label><span>Nombre de vista</span><input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Ej. Legal pendiente" /></label>
      <button className={styles.secondary} onClick={saveView} disabled={!viewName.trim()}>Guardar vista</button>
      <button className={styles.secondary} onClick={clearFilters}>Limpiar</button>
    </div>
    <SectionHead kicker={filters.view === "gallery" ? "GALERÍA" : "LISTA"} title={`${filtered.length} conceptos encontrados`} text="Estados, filtros, comparación y notas se recuperan tras recargar. Ningún cambio publica una pieza." side={`Mostrando ${Math.min(visible, filtered.length)}`} />
    {filtered.length ? <section className={`${styles.libraryGrid} ${filters.view === "list" ? styles.libraryList : ""}`}>{filtered.slice(0, visible).map((item) => {
      const itemStatus = creativeStates[item.id] || item.status;
      const file = creativeFile(item);
      return <article className={styles.creativeCard} key={item.id}><button onClick={() => setDetailId(item.id)} aria-label={`Abrir ${item.headline}`}><img loading="lazy" decoding="async" src={filters.format === "Todos" ? item.thumbnail : file} alt={item.alt} width="480" height="480" /></button><div className={styles.creativeCardBody}><div className={styles.campaignMeta}><span className={item.mode === "B2B" ? styles.modeB2B : styles.modeB2C}>{item.mode}</span><span className={styles.status}>{itemStatus}</span></div><h3>{item.headline}</h3><p>{item.subniche} · {item.route}</p><p>{item.campaignId} · {filters.format === "Todos" ? item.format : CREATIVE_FORMATS.find((format) => format.id === filters.format)?.name}</p><div className={styles.cardActions}><a href={file} download>Descargar</a><button onClick={() => toggleCompare(item.id)}>{compare.includes(item.id) ? "Quitar" : "Comparar"}</button></div></div></article>;
    })}</section> : <div className={styles.empty}><p>No hay creatividades con esta combinación.</p><button className={styles.secondary} onClick={clearFilters}>Borrar filtros</button></div>}
    {visible < filtered.length ? <div className={styles.formActions}><button className={styles.primary} onClick={() => setVisible((current) => current + 24)}>Cargar 24 más</button></div> : null}
    {compare.length ? <div className={styles.compareTray}><span><b>{compare.length}/3</b> piezas seleccionadas</span><button onClick={() => document.getElementById("creative-comparison")?.scrollIntoView({ behavior: "smooth" })}>Comparar versiones</button></div> : null}
    {compared.length ? <section className={styles.section} id="creative-comparison"><SectionHead kicker="COMPARADOR" title="Versiones lado a lado" /><div className={styles.comparison}>{compared.map((item) => <article key={item.id}><img loading="lazy" src={item.thumbnail} alt={item.alt} width="480" height="480" /><h3>{item.headline}</h3><p>{item.routeDirection}</p><p><b>{creativeStates[item.id] || item.status}</b> · {item.review}</p><button className={styles.quiet} onClick={() => toggleCompare(item.id)}>Quitar del comparador</button></article>)}</div></section> : null}
    {detail ? <>
      <button className={styles.drawerBackdrop} aria-label="Cerrar detalle" onClick={() => setDetailId(null)} />
      <aside className={styles.drawer} aria-label="Detalle de creatividad">
        <header><div><p className={styles.kicker}>{detail.id}</p><h2>{detail.headline}</h2></div><button aria-label="Cerrar" onClick={() => setDetailId(null)}>×</button></header>
        <img src={detail.master} alt={detail.alt} width="1080" height="1080" />
        <div className={styles.campaignMeta}><span className={detail.mode === "B2B" ? styles.modeB2B : styles.modeB2C}>{detail.mode}</span><span className={styles.status}>{creativeStates[detail.id] || detail.status}</span><span className={styles.evidence}>v{detail.version}</span><span className={styles.pill}>{detail.channel}</span></div>
        <section className={styles.drawerSection}><h3>Concepto y dirección</h3><p>{detail.concept}</p><p>{detail.routeDirection}</p><p><b>Cliente:</b> {detail.client} · <b>Campaña:</b> {detail.campaignId}</p></section>
        <section className={styles.drawerSection}><h3>Copy</h3><p><b>Titular:</b> {detail.headline}</p><p>{detail.copy}</p><p><b>CTA:</b> {detail.cta}</p></section>
        <section className={styles.drawerSection}><h3>Prompt y restricciones</h3><p>{detail.prompt}</p><p>{detail.restrictions}</p></section>
        <section className={styles.drawerSection}><h3>Archivos maestros</h3><div className={styles.adaptationGrid}>{detail.adaptations.map((item) => <a key={item.id} href={item.file} download>{item.name}<br />{item.width}×{item.height}</a>)}</div></section>
        <section className={styles.drawerSection}><h3>Cobertura de formatos y entregables</h3><div className={styles.experimentFacts}>{detail.deliverables.map((item) => <span key={item.id}><b>{item.channel} · {item.name}:</b> {item.status}{item.file ? <> · <a href={item.file} download>descargar</a></> : null}</span>)}</div></section>
        <section className={styles.drawerSection}><h3>Paquete de vídeo</h3><p><b>{detail.videoPackage.status}</b></p><p>{detail.videoPackage.duration} · {detail.videoPackage.format}</p><ol>{detail.videoPackage.scenes.map((item) => <li key={item}>{item}</li>)}</ol></section>
        <section className={styles.drawerSection}><h3>Rendimiento posterior</h3><div className={styles.inputGrid}>{([['spend','Gasto'],['impressions','Impresiones'],['clicks','Clics'],['leads','Leads'],['results','Resultados']] as const).map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input type="number" min="0" value={performance[detail.id]?.[key] || 0} onChange={(event) => setPerformanceValue(detail.id, key, Number(event.target.value) || 0)} /></label>)}</div><label className={styles.field}><span>Lectura / aprendizaje</span><textarea value={performance[detail.id]?.note || ""} onChange={(event) => setPerformanceValue(detail.id, "note", event.target.value)} /></label></section>
        <section className={styles.drawerSection}><h3>Revisión y nota</h3><label className={styles.field}><span>Estado local</span><select value={creativeStates[detail.id] || detail.status} onChange={(event) => setCreativeStates((current) => ({ ...current, [detail.id]: event.target.value }))}>{CREATIVE_STATES.map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.field}><span>Nota</span><textarea value={notes[detail.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [detail.id]: event.target.value }))} placeholder="Motivo de aprobación, rechazo o corrección." /></label></section>
        <section className={styles.drawerSection}><h3>Versiones y cola</h3><div className={styles.experimentFacts}>{versions.filter((item) => item.sourceId === detail.id).map((item) => <span key={item.id}><b>v{item.version}</b> · {item.status} · {item.createdAt}</span>)}{jobs.filter((item) => item.creativeId === detail.id).map((item) => <span key={item.id}><b>{item.action}</b>{item.format ? ` · ${item.format}` : ""} · {item.status}</span>)}{!versions.some((item) => item.sourceId === detail.id) && !jobs.some((item) => item.creativeId === detail.id) ? <span>Sin versiones locales ni trabajos pendientes.</span> : null}</div></section>
        <section className={styles.drawerSection}><h3>Acciones seguras</h3><div className={styles.drawerActions}><button onClick={() => downloadJson(`${detail.id}.json`, { ...detail, status: creativeStates[detail.id] || detail.status, note: notes[detail.id] || "", performance: performance[detail.id] || null, versions: versions.filter((item) => item.sourceId === detail.id), jobs: jobs.filter((item) => item.creativeId === detail.id) })}>Exportar</button><button onClick={() => duplicateBrief(detail)}>Crear versión</button><button onClick={() => prepareRegeneration(detail)}>Preparar regeneración</button><button onClick={() => prepareAdaptation(detail, filters.format === "Todos" ? "Nuevo formato" : filters.format)}>Preparar adaptación</button><a href={`/campanas?unidad=${detail.unitId}&modo=${detail.mode}`}>Vincular / abrir campaña</a></div></section>
      </aside>
    </> : null}
  </>;
}

function EconomicsView() {
  const [input, setInput] = usePersistentState<LabInputs>("economics-input", { plan: "google", fee: 0, vatPct: 21, activation: 250, media: 1400, cpl: 48, valid: 45, contact: 80, appointment: 70, show: 70, close: 24, ticket: 2200, margin: 65, duration: 3, followup: 120, creative: 180, commercial: 200, technology: 90 });
  const setNumber = (key: keyof LabInputs, value: string) => setInput({ ...input, [key]: Number(value) || 0 });
  const base = calculateEconomics(input, 1);
  const conservative = calculateEconomics({ ...input, valid: input.valid * .85, show: input.show * .85, close: input.close * .75 }, 1.2);
  const favorable = calculateEconomics({ ...input, valid: Math.min(100, input.valid * 1.12), show: Math.min(100, input.show * 1.1), close: Math.min(100, input.close * 1.2) }, .85);
  const inputs: Array<[keyof LabInputs, string]> = [["fee", "Fee neto / mes · 0 usa tarifa"], ["vatPct", "% IVA"], ["activation", "Activación única"], ["media", "Medios / mes"], ["cpl", "CPL"], ["valid", "% válido"], ["contact", "% contacto"], ["appointment", "% cita"], ["show", "Show rate"], ["close", "% cierre"], ["ticket", "Valor bruto / venta"], ["margin", "% margen bruto"], ["duration", "Meses de prueba"], ["followup", "Coste seguimiento del piloto"], ["creative", "Coste creativo del piloto"], ["commercial", "Coste comercial del piloto"], ["technology", "Coste tecnológico del piloto"]];
  const sensitivity = [
    { label: "CPL", low: calculateEconomics({ ...input, cpl: input.cpl * .9 }), high: calculateEconomics({ ...input, cpl: input.cpl * 1.1 }) },
    { label: "% válido", low: calculateEconomics({ ...input, valid: input.valid * .9 }), high: calculateEconomics({ ...input, valid: input.valid * 1.1 }) },
    { label: "Show rate", low: calculateEconomics({ ...input, show: input.show * .9 }), high: calculateEconomics({ ...input, show: input.show * 1.1 }) },
    { label: "Cierre", low: calculateEconomics({ ...input, close: input.close * .9 }), high: calculateEconomics({ ...input, close: input.close * 1.1 }) },
    { label: "Ticket", low: calculateEconomics({ ...input, ticket: input.ticket * .9 }), high: calculateEconomics({ ...input, ticket: input.ticket * 1.1 }) },
    { label: "Margen", low: calculateEconomics({ ...input, margin: input.margin * .9 }), high: calculateEconomics({ ...input, margin: input.margin * 1.1 }) },
  ];
  return <><div className={styles.notice}><div><strong>Tarifa canónica verificada</strong><span>{PRICING_SOURCE.name} · corte {PRICING_SOURCE.verifiedAt}. Fee e IVA pueden simularse sin modificar la fuente; los ratios siguen marcados como hipótesis.</span></div><a href={PRICING_SOURCE.url} target="_blank" rel="noreferrer">Abrir fuente</a></div><section className={styles.labLayout}><div className={styles.labPanel}><h2>Variables editables</h2><label className={styles.field}><span>Plan RedVitalia</span><select value={input.plan} onChange={(event) => setInput({ ...input, plan: event.target.value, fee: 0 })}>{PRICING.filter((item) => item.id !== "setter").map((item) => <option key={item.id} value={item.id}>{item.name} · {euro.format(item.net)} netos</option>)}</select></label><div className={styles.inputGrid}>{inputs.map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input type="number" min="0" max={["valid", "contact", "appointment", "show", "close", "margin", "vatPct"].includes(key) ? "100" : undefined} step={key === "duration" ? "1" : ".1"} value={input[key] ?? 0} onChange={(event) => setNumber(key, event.target.value)} /></label>)}</div><div className={styles.formActions}><button className={styles.secondary} onClick={() => downloadJson("laboratorio-redvitalia.json", { input, output: base, sensitivity, evidence: { pricing: "Dato real", ratios: "Hipótesis" } })}>Exportar escenario</button></div></div><div><Metrics items={[{ label: "LEADS", value: number.format(base.leads), note: `${euro.format(base.mediaTotal)} ÷ ${euro.format(input.cpl)}` }, { label: "VENTAS", value: number.format(base.sales), note: `Durante ${base.duration} meses` }, { label: "CAC", value: euro.format(base.cac), note: "Coste total del piloto ÷ ventas" }, { label: "CONTRIBUCIÓN", value: euro.format(base.contribution), note: "Margen bruto menos coste total" }]} /><div className={styles.resultGrid}>{[{ label: "Oportunidades válidas", value: number.format(base.valid), note: `${input.valid}% de leads` }, { label: "Contactadas", value: number.format(base.contacted), note: `${input.contact}% de válidas` }, { label: "Citas", value: number.format(base.appointments), note: `${input.appointment}% de contactadas` }, { label: "Citas efectivas", value: number.format(base.attended), note: `${input.show}% show` }, { label: "Facturación", value: euro.format(base.revenue), note: "Ventas × valor bruto" }, { label: "Margen bruto", value: euro.format(base.grossMargin), note: `${input.margin}%` }, { label: "Coste / cita efectiva", value: euro.format(base.costPerAttended), note: "Coste total ÷ asistencias" }, { label: "Máximo / cita efectiva", value: euro.format(base.maxCostPerAttended), note: "Margen por venta × cierre" }, { label: "Máximo / venta", value: euro.format(base.maxCostPerSale), note: "Margen bruto por venta" }, { label: "ROAS", value: `${number.format(base.roas)}×`, note: "Facturación ÷ medios totales" }, { label: "MER", value: `${number.format(base.mer)}×`, note: "Facturación ÷ coste total" }, { label: "CPL máximo", value: euro.format(base.maxCpl), note: "Break-even según ratios" }, { label: "Ventas de equilibrio", value: number.format(base.breakEvenSales), note: "Coste total ÷ margen/venta" }, { label: "Fee total neto", value: euro.format(base.feeTotal), note: `${euro.format(base.effectiveFee)} × ${base.duration} meses` }, { label: "Fee mensual con IVA", value: euro.format(base.feeGrossMonthly), note: `${euro.format(base.effectiveFee)} + ${base.vatPct}% IVA` }, { label: "Recuperación", value: base.recoveryMonths === null ? "No recupera" : `${number.format(base.recoveryMonths)} meses`, note: "Costes únicos ÷ contribución mensual previa" }].map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></article>)}</div><div className={styles.formula}>Medios totales = medios/mes × meses → leads = medios totales ÷ CPL → válidos = leads × % válido → citas efectivas = válidos × contacto × cita × show → ventas = citas efectivas × cierre → contribución = facturación × margen − medios totales − fee total − costes únicos.</div><div className={styles.scenarioTable}><div><span>Escenario</span><span>Ventas</span><span>CAC</span><span>Contribución</span></div>{[["Conservador", conservative], ["Base", base], ["Favorable", favorable]].map(([label, value]) => { const result = value as ReturnType<typeof calculate>; return <div key={label as string}><span>{label as string}</span><span>{number.format(result.sales)}</span><span>{euro.format(result.cac)}</span><span>{euro.format(result.contribution)}</span></div>; })}</div><SectionHead kicker="SENSIBILIDAD" title="Qué mueve más la contribución" text="Cada fila modifica solo una variable ±10%; no mezcla escenarios." /><div className={styles.scenarioTable}><div><span>Variable</span><span>-10%</span><span>Base</span><span>+10%</span></div>{sensitivity.map((item) => <div key={item.label}><span>{item.label}</span><span>{euro.format(item.low.contribution)}</span><span>{euro.format(base.contribution)}</span><span>{euro.format(item.high.contribution)}</span></div>)}</div></div></section></>;
}

function ExperimentsView() {
  type ExperimentResult = { control: number; variant: number; volume: number; spend: number; start: string; end: string; source: string; range: string; confidence: string; notes: string };
  const emptyResult: ExperimentResult = { control: 0, variant: 0, volume: 0, spend: 0, start: "", end: "", source: "", range: "", confidence: "Baja", notes: "" };
  const [states, setStates] = usePersistentState<Record<string, string>>("experiment-states", {});
  const [results, setResults] = usePersistentState<Record<string, ExperimentResult>>("experiment-results", {});
  const [openId, setOpenId] = useState<string | null>(null);
  const grouped = ["Borrador", "En prueba", "Cerrado"].map((group) => ({ group, items: EXPERIMENTS.filter((item) => { const state = states[item.id] || item.status; return group === "Borrador" ? !["En prueba", "Aprobado", "Fallido", "Inconcluso"].includes(state) : group === "En prueba" ? state === "En prueba" : ["Aprobado", "Fallido", "Inconcluso"].includes(state); }) }));
  const update = (id: string, value: string) => setStates((current) => ({ ...current, [id]: value }));
  const setResult = (id: string, key: keyof ExperimentResult, value: string | number) => setResults((current) => ({ ...current, [id]: { ...emptyResult, ...(current[id] || {}), [key]: value } }));
  const evaluate = (result: ExperimentResult) => {
    if (!result.source.trim() || !result.start || !result.end || result.volume < 20 || result.control <= 0 || result.variant <= 0) return { decision: "Pendiente", detail: "Faltan fuente, fechas, volumen mínimo o valores comparables." };
    const change = ((result.variant - result.control) / result.control) * 100;
    if (change <= -15) return { decision: "Aprobado", detail: `${number.format(Math.abs(change))}% menos coste que el control; comprobar el criterio sectorial antes de escalar.` };
    if (change >= 15) return { decision: "Fallido", detail: `${number.format(change)}% más coste que el control; no adoptar la variante.` };
    return { decision: "Inconcluso", detail: `Diferencia de ${number.format(change)}%; no supera el umbral operativo de ±15%.` };
  };
  const closeExperiment = (id: string) => {
    const evaluation = evaluate(results[id] || emptyResult);
    if (evaluation.decision !== "Pendiente") update(id, evaluation.decision);
  };
  const exportData = EXPERIMENTS.map((item) => ({ ...item, status: states[item.id] || item.status, observed: results[item.id] || null, evaluation: evaluate(results[item.id] || emptyResult) }));
  return <>
    <Metrics items={[{ label: "HIPÓTESIS", value: EXPERIMENTS.length, note: "Una por unidad de captación" }, { label: "EN PRUEBA", value: Object.values(states).filter((item) => item === "En prueba").length, note: "Estado local" }, { label: "CON RESULTADO", value: Object.values(states).filter((item) => ["Aprobado", "Fallido", "Inconcluso"].includes(item)).length, note: "Con fuente y muestra" }, { label: "PRESUPUESTO TOTAL", value: euro.format(EXPERIMENTS.reduce((sum, item) => sum + item.budget, 0)), note: "Hipótesis, no gasto autorizado" }]} />
    <div className={styles.notice}><div><strong>Lectura prudente</strong><span>La comparación automática interpreta la métrica principal como coste: menos es mejor. La decisión final exige revisar calidad, capacidad y criterio sectorial.</span></div><button className={styles.secondary} onClick={() => downloadJson("experimentos-redvitalia.json", exportData)}>Exportar todo</button></div>
    <div className={styles.board}>{grouped.map((column) => <section className={styles.boardColumn} key={column.group}><header><h2>{column.group}</h2><span>{column.items.length}</span></header>{column.items.map((item) => {
      const result = results[item.id] || emptyResult;
      const evaluation = evaluate(result);
      return <article className={styles.experimentCard} key={item.id}>
        <span className={styles.evidence}>Hipótesis</span><h3>{item.unit}</h3><p>{item.hypothesis}</p>
        <div className={styles.experimentFacts}><span><b>Variable:</b> {item.variable}</span><span><b>Control:</b> {item.control}</span><span><b>Variante:</b> {item.variant}</span><span><b>Volumen:</b> {item.minimumVolume}</span><span><b>Métrica:</b> {item.primaryMetric}</span><span><b>Pasa:</b> {item.pass}</span><span><b>Falla:</b> {item.fail}</span><span><b>Riesgo:</b> {item.risk}</span></div>
        <select aria-label={`Estado de ${item.unit}`} value={states[item.id] || item.status} onChange={(event) => update(item.id, event.target.value)}><option>Borrador</option><option>Pendiente de aprobación</option><option>En prueba</option><option>Inconcluso</option><option>Aprobado</option><option>Fallido</option></select>
        <button className={styles.quiet} onClick={() => setOpenId(openId === item.id ? null : item.id)}>{openId === item.id ? "Cerrar resultados" : "Registrar resultados"}</button>
        {openId === item.id ? <div className={styles.experimentEditor}>
          <div className={styles.inputGrid}>{([['control','Coste control'],['variant','Coste variante'],['volume','Volumen'],['spend','Gasto']] as const).map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input type="number" min="0" value={result[key]} onChange={(event) => setResult(item.id, key, Number(event.target.value) || 0)} /></label>)}<label className={styles.field}><span>Inicio</span><input type="date" value={result.start} onChange={(event) => setResult(item.id, "start", event.currentTarget.value)} onInput={(event) => setResult(item.id, "start", event.currentTarget.value)} /></label><label className={styles.field}><span>Fin</span><input type="date" value={result.end} onChange={(event) => setResult(item.id, "end", event.currentTarget.value)} onInput={(event) => setResult(item.id, "end", event.currentTarget.value)} /></label><label className={styles.field}><span>Confianza</span><select value={result.confidence} onChange={(event) => setResult(item.id, "confidence", event.target.value)}><option>Baja</option><option>Media</option><option>Alta</option></select></label><label className={styles.field}><span>Rango / segmento</span><input value={result.range} onChange={(event) => setResult(item.id, "range", event.target.value)} /></label></div>
          <label className={styles.field}><span>Fuente obligatoria</span><input value={result.source} onChange={(event) => setResult(item.id, "source", event.target.value)} placeholder="Informe, exportación o URL verificable" /></label><label className={styles.field}><span>Resultado y aprendizaje</span><textarea value={result.notes} onChange={(event) => setResult(item.id, "notes", event.target.value)} /></label>
          <div className={styles.experimentVerdict} data-decision={evaluation.decision}><b>{evaluation.decision}</b><span>{evaluation.detail}</span></div><button className={styles.primary} disabled={evaluation.decision === "Pendiente"} onClick={() => closeExperiment(item.id)}>Cerrar con esta evaluación</button>
        </div> : null}
      </article>;
    })}</section>)}</div>
  </>;
}

function DecisionsView() {
  type DecisionEvidence = { source: string; date: string; range: string; data: string; confidence: string; pending: string; rationale: string; result: string };
  const emptyEvidence: DecisionEvidence = { source: "", date: "", range: "", data: "", confidence: "Baja", pending: "", rationale: "", result: "Pendiente" };
  const [states, setStates] = usePersistentState<Record<string, string>>("decision-states", {});
  const [evidence, setEvidence] = usePersistentState<Record<string, DecisionEvidence>>("decision-evidence", {});
  const approvalStates = ["Comprobada", "Pendiente de aprobación", "Aprobada", "Ejecutada"];
  const hasRequiredEvidence = (id: string) => Boolean(evidence[id]?.source.trim() && evidence[id]?.date && evidence[id]?.rationale.trim());
  const safeState = (id: string, fallback: string) => {
    const stored = states[id] || fallback;
    return approvalStates.includes(stored) && !hasRequiredEvidence(id) ? "Pendiente de datos" : stored;
  };
  const update = (id: string, value: string) => setStates((current) => ({ ...current, [id]: value }));
  const setEvidenceValue = (id: string, key: keyof DecisionEvidence, value: string) => setEvidence((current) => ({ ...current, [id]: { ...emptyEvidence, ...(current[id] || {}), [key]: value } }));
  return <><div className={styles.notice}><div><strong>Decisión vigente: sistema jurídico primero</strong><span>La prioridad se conserva aunque el ranking editable cambie. Aprobar aquí registra intención; no lanza campañas ni mueve presupuesto.</span></div><a href="/sistemas#portfolio">Revisar ranking</a></div><Metrics items={[{ label: "DECISIONES", value: DECISIONS.length, note: "Una por sistema" }, { label: "PENDIENTES DE DATOS", value: DECISIONS.filter((item) => safeState(item.id, item.status) === "Pendiente de datos").length, note: "Antes de abrir frente" }, { label: "COMPROBADAS", value: DECISIONS.filter((item) => hasRequiredEvidence(item.id)).length, note: "Fuente, fecha y razón" }, { label: "EJECUTADAS", value: DECISIONS.filter((item) => safeState(item.id, item.status) === "Ejecutada").length, note: "Estado local, sin ejecución automática" }]} /><section className={styles.decisionTimeline}>{DECISIONS.map((item) => {
    const record = evidence[item.id] || emptyEvidence;
    const checked = hasRequiredEvidence(item.id);
    const state = safeState(item.id, item.status);
    return <article className={styles.decisionCard} key={item.id}><div><div className={styles.campaignMeta}><span className={styles.evidence}>{item.evidence}</span><span className={styles.status}>{state}</span><span className={checked ? styles.modeB2C : styles.evidence}>{checked ? "Comprobación completa" : "Faltan datos"}</span></div><h3>{item.title}</h3><p><b>Recomendación:</b> {item.recommendation}</p><p><b>Riesgo:</b> {item.risk}</p><p><b>Siguiente decisión:</b> {item.next}</p><details className={styles.experimentEditor}><summary>Fuente, dato y razonamiento</summary><div className={styles.inputGrid}><label className={styles.field}><span>Fuente</span><input value={record.source} onChange={(event) => setEvidenceValue(item.id, "source", event.target.value)} /></label><label className={styles.field}><span>Fecha</span><input type="date" value={record.date} onChange={(event) => setEvidenceValue(item.id, "date", event.currentTarget.value)} onInput={(event) => setEvidenceValue(item.id, "date", event.currentTarget.value)} /></label><label className={styles.field}><span>Rango / muestra</span><input value={record.range} onChange={(event) => setEvidenceValue(item.id, "range", event.target.value)} /></label><label className={styles.field}><span>Confianza</span><select value={record.confidence} onChange={(event) => setEvidenceValue(item.id, "confidence", event.target.value)}><option>Baja</option><option>Media</option><option>Alta</option></select></label></div><label className={styles.field}><span>Dato comprobado</span><textarea value={record.data} onChange={(event) => setEvidenceValue(item.id, "data", event.target.value)} /></label><label className={styles.field}><span>Razonamiento obligatorio</span><textarea value={record.rationale} onChange={(event) => setEvidenceValue(item.id, "rationale", event.target.value)} /></label><label className={styles.field}><span>Información pendiente</span><textarea value={record.pending} onChange={(event) => setEvidenceValue(item.id, "pending", event.target.value)} /></label><label className={styles.field}><span>Resultado posterior</span><textarea value={record.result} onChange={(event) => setEvidenceValue(item.id, "result", event.target.value)} /></label></details></div><aside><label className={styles.field}><span>Estado</span><select value={state} onChange={(event) => update(item.id, event.target.value)}>{DECISION_STATES.map((optionState) => <option key={optionState} disabled={approvalStates.includes(optionState) && !checked}>{optionState}</option>)}</select></label>{!checked ? <small>Fuente, fecha y razonamiento son obligatorios para comprobar o aprobar.</small> : null}<button onClick={() => downloadJson(`${item.id}.json`, { ...item, status: state, evidence: record })}>Exportar decisión</button></aside></article>;
  })}</section></>;
}

function LearningsView() {
  type LearningRecord = { id: string; type: string; title: string; detail: string; source: string; status: string; date: string; confidence: string; experimentId: string; decisionId: string; range: string; risk: string };
  const [extra, setExtra] = usePersistentState<LearningRecord[]>("learnings", []);
  const [form, setForm] = usePersistentState("learning-draft", { type: "Probar", title: "", detail: "", source: "", status: "Pendiente de resultado", date: "", confidence: "Baja", experimentId: "", decisionId: "", range: "", risk: "" });
  const items: LearningRecord[] = [...LEARNINGS.map((item) => ({ ...item, date: "", confidence: item.status === "Comprobada" ? "Media" : "Baja", experimentId: "", decisionId: "", range: "Síntesis existente", risk: "Revalidar cuando cambie la evidencia" })), ...extra];
  const add = () => { if (!form.title.trim() || !form.detail.trim() || !form.source.trim() || !form.date) return; setExtra((current) => [...current, { ...form, id: `learn-local-${Date.now()}` }]); setForm({ ...form, title: "", detail: "", source: "", date: "", experimentId: "", decisionId: "", range: "", risk: "" }); };
  return <><Metrics items={[{ label: "APRENDIZAJES", value: items.length, note: "Reglas con fuente" }, { label: "COMPROBADOS", value: items.filter((item) => item.status === "Comprobada").length, note: "No equivale a causalidad" }, { label: "PENDIENTES", value: items.filter((item) => item.status !== "Comprobada").length, note: "Necesitan experimento" }, { label: "CATEGORÍAS", value: new Set(items.map((item) => item.type)).size, note: "Copiar · adaptar · probar · vigilar · descartar" }]} /><section className={styles.learningGrid}>{items.map((item) => <article className={styles.learningCard} key={item.id}><span className={styles.evidence}>{item.type}</span><h2>{item.title}</h2><p>{item.detail}</p><p><b>Confianza:</b> {item.confidence} · <b>Rango:</b> {item.range || "No indicado"}<br /><b>Experimento:</b> {item.experimentId || "No vinculado"} · <b>Decisión:</b> {item.decisionId || "No vinculada"}<br /><b>Riesgo:</b> {item.risk || "No indicado"}</p><footer><span>{item.source}{item.date ? ` · ${item.date}` : ""}</span><strong>{item.status}</strong></footer></article>)}</section><section className={styles.section}><SectionHead kicker="CAPTURA" title="Registrar un aprendizaje nuevo" text="Título, detalle, fuente y fecha son obligatorios. Puede vincularse con experimento y decisión sin duplicar sus registros." /><div className={styles.learningForm}><label className={styles.field}><span>Clasificación</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{["Copiar", "Adaptar", "Probar", "Vigilar", "Descartar"].map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.field}><span>Estado</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Pendiente de resultado</option><option>Comprobada</option></select></label><label className={styles.field}><span>Título</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className={styles.field}><span>Fuente</span><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label><label className={styles.field}><span>Fecha</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.currentTarget.value })} onInput={(event) => setForm({ ...form, date: event.currentTarget.value })} /></label><label className={styles.field}><span>Confianza</span><select value={form.confidence} onChange={(event) => setForm({ ...form, confidence: event.target.value })}><option>Baja</option><option>Media</option><option>Alta</option></select></label><label className={styles.field}><span>Experimento vinculado</span><select value={form.experimentId} onChange={(event) => setForm({ ...form, experimentId: event.target.value })}><option value="">Sin vincular</option>{EXPERIMENTS.map((item) => <option key={item.id} value={item.id}>{item.unit}</option>)}</select></label><label className={styles.field}><span>Decisión vinculada</span><select value={form.decisionId} onChange={(event) => setForm({ ...form, decisionId: event.target.value })}><option value="">Sin vincular</option>{DECISIONS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className={styles.field}><span>Rango / muestra</span><input value={form.range} onChange={(event) => setForm({ ...form, range: event.target.value })} /></label><label className={styles.field}><span>Riesgo / información pendiente</span><input value={form.risk} onChange={(event) => setForm({ ...form, risk: event.target.value })} /></label><label className={styles.field}><span>Detalle</span><textarea value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} /></label><div className={styles.formActions}><button className={styles.primary} onClick={add} disabled={!form.title.trim() || !form.detail.trim() || !form.source.trim() || !form.date}>Guardar aprendizaje</button><button className={styles.secondary} onClick={() => downloadJson("aprendizajes-redvitalia.json", items)}>Exportar</button></div></div></section></>;
}

export default function ExecutionWorkspace({ kind }: { kind: WorkspaceKind }) {
  const copy = pageCopy[kind];
  return <ExecutionShell active={kind} eyebrow={copy.eyebrow} title={copy.title} description={copy.description} actions={<a href="/sistemas">Ver los diez sistemas</a>}>
    {kind === "campaigns" ? <CampaignsView /> : null}
    {kind === "creative" ? <CreativeFactoryView /> : null}
    {kind === "library" ? <CreativeLibraryView /> : null}
    {kind === "economics" ? <EconomicsView /> : null}
    {kind === "experiments" ? <ExperimentsView /> : null}
    {kind === "decisions" ? <DecisionsView /> : null}
    {kind === "learnings" ? <LearningsView /> : null}
  </ExecutionShell>;
}
