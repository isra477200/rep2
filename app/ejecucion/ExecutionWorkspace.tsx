"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import ExecutionShell, { type ExecutionSection } from "./ExecutionShell";
import styles from "./execution.module.css";
import {
  CAMPAIGNS,
  CAMPAIGN_STATES,
  CAPTURE_UNITS,
  CREATIVES,
  CREATIVE_FORMATS,
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
  architecture: string[];
  adStructure: Array<{ group: string; intent: string; message: string }>;
  followup: string[];
};

const pageCopy: Record<WorkspaceKind, { eyebrow: string; title: string; description: string }> = {
  campaigns: { eyebrow: "FÁBRICA DE CAMPAÑAS", title: "De una decisión de nicho a dos campañas distintas.", description: "B2B vende el sistema de RedVitalia a la empresa. B2C capta oportunidades para esa empresa. Presupuesto, landing, mensaje y conversión se mantienen separados." },
  creative: { eyebrow: "FÁBRICA CREATIVA", title: "Brief, concepto, composición y control en un mismo flujo.", description: "El arte base se genera con ChatGPT sin texto. Esta capa aplica copy editable, conserva metadatos y deja cada pieza pendiente de revisión humana." },
  library: { eyebrow: "BIBLIOTECA CREATIVA", title: "144 conceptos maestros, trazables y adaptados.", description: "Filtra por nicho, especialidad, B2B/B2C, ruta, estado y formato. Cada pieza conserva prompt, copy, restricciones, archivo maestro y siete adaptaciones." },
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
    const unit = CAPTURE_UNITS.find((item) => item.id === builder.unitId)!;
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
      architecture: [
        `Prospección ${builder.mode} por intención: ${builder.subniche}`,
        `Landing específica: ${base.landing}`,
        "Remarketing separado sin convertir clics en resultado primario",
        `Resultado offline: ${base.primaryConversion}`,
      ],
      adStructure: unit.subniches.slice(0, 4).map((group) => ({
        group,
        intent: builder.mode === "B2B" ? `Empresa que busca captar ${group.toLocaleLowerCase("es")}` : group,
        message: builder.mode === "B2B" ? unit.offer : unit.problem,
      })),
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
    <Metrics items={[{ label: "ARTES BASE CHATGPT", value: CAPTURE_UNITS.length, note: "Sin texto integrado" }, { label: "CONCEPTOS MAESTROS", value: CREATIVES.length, note: "6 B2B + 6 B2C por unidad" }, { label: "RUTAS POR UNIDAD", value: 3, note: "Direcciones distintas" }, { label: "ADAPTACIONES", value: CREATIVES.length * CREATIVE_FORMATS.length, note: `${CREATIVE_FORMATS.length} formatos por concepto` }]} />
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
  </>;
}

function CreativeLibraryView() {
  const [filters, setFilters] = usePersistentState("library-filters", { unitId: "Todos", mode: "Todos" as CampaignMode | "Todos", route: "Todas", status: "Todos", format: "Todos", query: "", view: "gallery" as "gallery" | "list" });
  const [creativeStates, setCreativeStates] = usePersistentState<Record<string, string>>("creative-states", {});
  const [notes, setNotes] = usePersistentState<Record<string, string>>("creative-notes", {});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [compare, setCompare] = usePersistentState<string[]>("library-compare", []);
  const [visible, setVisible] = useState(24);
  const routes = [...new Set(CREATIVES.map((item) => item.route))];
  const filtered = useMemo(() => CREATIVES.filter((item) => {
    const itemStatus = creativeStates[item.id] || item.status;
    return (filters.unitId === "Todos" || item.unitId === filters.unitId)
      && (filters.mode === "Todos" || item.mode === filters.mode)
      && (filters.route === "Todas" || item.route === filters.route)
      && (filters.status === "Todos" || itemStatus === filters.status)
      && (!filters.query.trim() || `${item.headline} ${item.concept} ${item.niche} ${item.subniche} ${item.angle} ${item.campaignId}`.toLocaleLowerCase("es").includes(filters.query.trim().toLocaleLowerCase("es")));
  }), [creativeStates, filters]);
  const detail = CREATIVES.find((item) => item.id === detailId) || null;
  const compared = compare.map((id) => CREATIVES.find((item) => item.id === id)).filter(Boolean) as typeof CREATIVES;
  const toggleCompare = (id: string) => setCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  const setFilter = (key: keyof typeof filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setVisible(24); };
  const clearFilters = () => { setFilters({ unitId: "Todos", mode: "Todos", route: "Todas", status: "Todos", format: "Todos", query: "", view: "gallery" }); setVisible(24); };

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

  const duplicateBrief = (item: (typeof CREATIVES)[number]) => downloadJson(`copia-${item.id}.json`, { ...item, id: `${item.id}-copy-${Date.now()}`, version: item.version + 1, status: "Brief", performance: null, learning: "Pendiente de prueba" });
  const prepareRegeneration = (item: (typeof CREATIVES)[number]) => downloadJson(`regenerar-${item.id}.json`, { action: "Generar con ChatGPT", sourceCreativeId: item.id, prompt: item.prompt, restrictions: item.restrictions, requiredReview: item.review, createdAt: new Date().toISOString() });

  return <>
    <Metrics items={[{ label: "CONCEPTOS", value: CREATIVES.length, note: "Metadatos completos" }, { label: "FORMATOS", value: CREATIVE_FORMATS.length, note: "Por concepto" }, { label: "ARCHIVOS ADAPTADOS", value: CREATIVES.length * CREATIVE_FORMATS.length, note: "Composición programática" }, { label: "GANADORAS", value: CREATIVES.filter((item) => (creativeStates[item.id] || item.status) === "Ganadora").length, note: "Solo estado humano local" }]} />
    <div className={styles.toolbar}>
      <label className={styles.grow}><span>Buscar</span><input value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder="Titular, ruta, nicho, ángulo o campaña" /></label>
      <label><span>Especialidad</span><select value={filters.unitId} onChange={(event) => setFilter("unitId", event.target.value)}><option>Todos</option>{CAPTURE_UNITS.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
      <label><span>Tipo</span><select value={filters.mode} onChange={(event) => setFilter("mode", event.target.value)}><option>Todos</option><option>B2B</option><option>B2C</option></select></label>
      <label><span>Ruta</span><select value={filters.route} onChange={(event) => setFilter("route", event.target.value)}><option>Todas</option>{routes.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Estado</span><select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option>Todos</option>{CREATIVE_STATES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Formato</span><select value={filters.format} onChange={(event) => setFilter("format", event.target.value)}><option>Todos</option>{CREATIVE_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>Vista</span><select value={filters.view} onChange={(event) => setFilter("view", event.target.value)}><option value="gallery">Galería</option><option value="list">Lista</option></select></label>
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
    {detail ? <><button className={styles.drawerBackdrop} aria-label="Cerrar detalle" onClick={() => setDetailId(null)} /><aside className={styles.drawer} aria-label="Detalle de creatividad"><header><div><p className={styles.kicker}>{detail.id}</p><h2>{detail.headline}</h2></div><button aria-label="Cerrar" onClick={() => setDetailId(null)}>×</button></header><img src={detail.master} alt={detail.alt} width="1080" height="1080" /><div className={styles.campaignMeta}><span className={detail.mode === "B2B" ? styles.modeB2B : styles.modeB2C}>{detail.mode}</span><span className={styles.status}>{creativeStates[detail.id] || detail.status}</span><span className={styles.evidence}>v{detail.version}</span></div><section className={styles.drawerSection}><h3>Concepto y dirección</h3><p>{detail.concept}</p><p>{detail.routeDirection}</p></section><section className={styles.drawerSection}><h3>Copy</h3><p><b>Titular:</b> {detail.headline}</p><p>{detail.copy}</p><p><b>CTA:</b> {detail.cta}</p></section><section className={styles.drawerSection}><h3>Prompt y restricciones</h3><p>{detail.prompt}</p><p>{detail.restrictions}</p></section><section className={styles.drawerSection}><h3>Adaptaciones</h3><div className={styles.adaptationGrid}>{detail.adaptations.map((item) => <a key={item.id} href={item.file} download>{item.name}<br />{item.width}×{item.height}</a>)}</div></section><section className={styles.drawerSection}><h3>Revisión y nota</h3><label className={styles.field}><span>Estado local</span><select value={creativeStates[detail.id] || detail.status} onChange={(event) => setCreativeStates((current) => ({ ...current, [detail.id]: event.target.value }))}>{CREATIVE_STATES.map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.field}><span>Nota</span><textarea value={notes[detail.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [detail.id]: event.target.value }))} placeholder="Motivo de aprobación, rechazo o corrección." /></label></section><section className={styles.drawerSection}><h3>Acciones seguras</h3><div className={styles.drawerActions}><button onClick={() => downloadJson(`${detail.id}.json`, { ...detail, status: creativeStates[detail.id] || detail.status, note: notes[detail.id] || "" })}>Exportar</button><button onClick={() => duplicateBrief(detail)}>Duplicar briefing</button><button onClick={() => prepareRegeneration(detail)}>Preparar regeneración</button><a href={`/campanas?unidad=${detail.unitId}&modo=${detail.mode}`}>Abrir campaña</a></div></section></aside></> : null}
  </>;
}

function EconomicsView() {
  const [input, setInput] = usePersistentState<LabInputs>("economics-input", { plan: "google", activation: 250, media: 1400, cpl: 48, valid: 45, contact: 80, appointment: 70, show: 70, close: 24, ticket: 2200, margin: 65, duration: 3, followup: 120, creative: 180, commercial: 200, technology: 90 });
  const setNumber = (key: keyof LabInputs, value: string) => setInput({ ...input, [key]: Number(value) || 0 });
  const base = calculateEconomics(input, 1);
  const conservative = calculateEconomics({ ...input, valid: input.valid * .85, show: input.show * .85, close: input.close * .75 }, 1.2);
  const favorable = calculateEconomics({ ...input, valid: Math.min(100, input.valid * 1.12), show: Math.min(100, input.show * 1.1), close: Math.min(100, input.close * 1.2) }, .85);
  const inputs: Array<[keyof LabInputs, string, string?]> = [["activation", "Activación única"], ["media", "Medios / mes"], ["cpl", "CPL"], ["valid", "% válido"], ["contact", "% contacto"], ["appointment", "% cita"], ["show", "Show rate"], ["close", "% cierre"], ["ticket", "Valor bruto / venta"], ["margin", "% margen bruto"], ["duration", "Meses de prueba"], ["followup", "Coste seguimiento del piloto"], ["creative", "Coste creativo del piloto"], ["commercial", "Coste comercial del piloto"], ["technology", "Coste tecnológico del piloto"]];
  return <><div className={styles.notice}><div><strong>Tarifa canónica verificada</strong><span>{PRICING_SOURCE.name} · corte {PRICING_SOURCE.verifiedAt}. Los ratios de conversión siguen marcados como hipótesis.</span></div><a href={PRICING_SOURCE.url} target="_blank" rel="noreferrer">Abrir fuente</a></div><section className={styles.labLayout}><div className={styles.labPanel}><h2>Variables editables</h2><label className={styles.field}><span>Plan RedVitalia</span><select value={input.plan} onChange={(event) => setInput({ ...input, plan: event.target.value })}>{PRICING.filter((item) => item.id !== "setter").map((item) => <option key={item.id} value={item.id}>{item.name} · {euro.format(item.net)} netos</option>)}</select></label><div className={styles.inputGrid}>{inputs.map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input type="number" min="0" max={["valid", "contact", "appointment", "show", "close", "margin"].includes(key) ? "100" : undefined} step={key === "duration" ? "1" : ".1"} value={input[key]} onChange={(event) => setNumber(key, event.target.value)} /></label>)}</div><div className={styles.formActions}><button className={styles.secondary} onClick={() => downloadJson("laboratorio-redvitalia.json", { input, output: base, evidence: { pricing: "Dato real", ratios: "Hipótesis" } })}>Exportar escenario</button></div></div><div><Metrics items={[{ label: "LEADS", value: number.format(base.leads), note: `${euro.format(base.mediaTotal)} ÷ ${euro.format(input.cpl)}` }, { label: "VENTAS", value: number.format(base.sales), note: `Durante ${base.duration} meses` }, { label: "CAC", value: euro.format(base.cac), note: "Coste total del piloto ÷ ventas" }, { label: "CONTRIBUCIÓN", value: euro.format(base.contribution), note: "Margen bruto menos coste total" }]} /><div className={styles.resultGrid}>{[{ label: "Oportunidades válidas", value: number.format(base.valid), note: `${input.valid}% de leads` }, { label: "Contactadas", value: number.format(base.contacted), note: `${input.contact}% de válidas` }, { label: "Citas", value: number.format(base.appointments), note: `${input.appointment}% de contactadas` }, { label: "Citas efectivas", value: number.format(base.attended), note: `${input.show}% show` }, { label: "Facturación", value: euro.format(base.revenue), note: "Ventas × valor bruto" }, { label: "Margen bruto", value: euro.format(base.grossMargin), note: `${input.margin}%` }, { label: "Coste / cita efectiva", value: euro.format(base.costPerAttended), note: "Coste total ÷ asistencias" }, { label: "Máximo / cita efectiva", value: euro.format(base.maxCostPerAttended), note: "Margen por venta × cierre" }, { label: "Máximo / venta", value: euro.format(base.maxCostPerSale), note: "Margen bruto por venta" }, { label: "ROAS", value: `${number.format(base.roas)}×`, note: "Facturación ÷ medios totales" }, { label: "MER", value: `${number.format(base.mer)}×`, note: "Facturación ÷ coste total" }, { label: "CPL máximo", value: euro.format(base.maxCpl), note: "Break-even según ratios" }, { label: "Ventas de equilibrio", value: number.format(base.breakEvenSales), note: "Coste total ÷ margen/venta" }, { label: "Fee total neto", value: euro.format(base.feeTotal), note: `${euro.format(base.plan.net)} × ${base.duration} meses` }, { label: "Plan mensual con IVA", value: euro.format(base.plan.total), note: `${euro.format(base.plan.net)} + IVA` }, { label: "Recuperación", value: base.recoveryMonths === null ? "No recupera" : `${number.format(base.recoveryMonths)} meses`, note: "Costes únicos ÷ contribución mensual previa" }].map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></article>)}</div><div className={styles.formula}>Medios totales = medios/mes × meses → leads = medios totales ÷ CPL → válidos = leads × % válido → citas efectivas = válidos × contacto × cita × show → ventas = citas efectivas × cierre → contribución = facturación × margen − medios totales − fee total − costes únicos.</div><div className={styles.scenarioTable}><div><span>Escenario</span><span>Ventas</span><span>CAC</span><span>Contribución</span></div>{[["Conservador", conservative], ["Base", base], ["Favorable", favorable]].map(([label, value]) => { const result = value as ReturnType<typeof calculate>; return <div key={label as string}><span>{label as string}</span><span>{number.format(result.sales)}</span><span>{euro.format(result.cac)}</span><span>{euro.format(result.contribution)}</span></div>; })}</div></div></section></>;
}

function ExperimentsView() {
  const [states, setStates] = usePersistentState<Record<string, string>>("experiment-states", {});
  const grouped = ["Borrador", "En prueba", "Cerrado"].map((group) => ({ group, items: EXPERIMENTS.filter((item) => { const state = states[item.id] || item.status; return group === "Borrador" ? !["En prueba", "Aprobado", "Fallido"].includes(state) : group === "En prueba" ? state === "En prueba" : ["Aprobado", "Fallido"].includes(state); }) }));
  const update = (id: string, value: string) => setStates((current) => ({ ...current, [id]: value }));
  return <><Metrics items={[{ label: "HIPÓTESIS", value: EXPERIMENTS.length, note: "Una por unidad de captación" }, { label: "EN PRUEBA", value: Object.values(states).filter((item) => item === "En prueba").length, note: "Estado local" }, { label: "CON RESULTADO", value: Object.values(states).filter((item) => ["Aprobado", "Fallido"].includes(item)).length, note: "Sin inventar ganadores" }, { label: "PRESUPUESTO TOTAL", value: euro.format(EXPERIMENTS.reduce((sum, item) => sum + item.budget, 0)), note: "Hipótesis, no gasto autorizado" }]} /><div className={styles.board}>{grouped.map((column) => <section className={styles.boardColumn} key={column.group}><header><h2>{column.group}</h2><span>{column.items.length}</span></header>{column.items.map((item) => <article className={styles.experimentCard} key={item.id}><span className={styles.evidence}>Hipótesis</span><h3>{item.unit}</h3><p>{item.hypothesis}</p><div className={styles.experimentFacts}><span><b>Variable:</b> {item.variable}</span><span><b>Volumen:</b> {item.minimumVolume}</span><span><b>Pasa:</b> {item.pass}</span><span><b>Falla:</b> {item.fail}</span></div><select aria-label={`Estado de ${item.unit}`} value={states[item.id] || item.status} onChange={(event) => update(item.id, event.target.value)}><option>Borrador</option><option>Pendiente de aprobación</option><option>En prueba</option><option>Aprobado</option><option>Fallido</option></select></article>)}</section>)}</div><div className={styles.formActions}><button className={styles.secondary} onClick={() => downloadJson("experimentos-redvitalia.json", EXPERIMENTS.map((item) => ({ ...item, status: states[item.id] || item.status })))}>Exportar experimentos</button></div></>;
}

function DecisionsView() {
  const [states, setStates] = usePersistentState<Record<string, string>>("decision-states", {});
  const update = (id: string, value: string) => setStates((current) => ({ ...current, [id]: value }));
  return <><div className={styles.notice}><div><strong>Decisión vigente: sistema jurídico primero</strong><span>La prioridad se conserva aunque el ranking editable cambie. Aprobar aquí registra intención; no lanza campañas ni mueve presupuesto.</span></div><a href="/sistemas#portfolio">Revisar ranking</a></div><Metrics items={[{ label: "DECISIONES", value: DECISIONS.length, note: "Una por sistema" }, { label: "PENDIENTES DE DATOS", value: DECISIONS.filter((item) => (states[item.id] || item.status) === "Pendiente de datos").length, note: "Antes de abrir frente" }, { label: "PENDIENTES DE APROBACIÓN", value: DECISIONS.filter((item) => (states[item.id] || item.status) === "Pendiente de aprobación").length, note: "Prioridad jurídica" }, { label: "EJECUTADAS", value: DECISIONS.filter((item) => states[item.id] === "Ejecutada").length, note: "Estado local, sin ejecución automática" }]} /><section className={styles.decisionTimeline}>{DECISIONS.map((item) => <article className={styles.decisionCard} key={item.id}><div><div className={styles.campaignMeta}><span className={styles.evidence}>{item.evidence}</span><span className={styles.status}>{states[item.id] || item.status}</span></div><h3>{item.title}</h3><p><b>Recomendación:</b> {item.recommendation}</p><p><b>Riesgo:</b> {item.risk}</p><p><b>Siguiente decisión:</b> {item.next}</p></div><aside><label className={styles.field}><span>Estado</span><select value={states[item.id] || item.status} onChange={(event) => update(item.id, event.target.value)}>{DECISION_STATES.map((state) => <option key={state}>{state}</option>)}</select></label><button onClick={() => downloadJson(`${item.id}.json`, { ...item, status: states[item.id] || item.status })}>Exportar decisión</button></aside></article>)}</section></>;
}

function LearningsView() {
  const [extra, setExtra] = usePersistentState<Array<{ id: string; type: string; title: string; detail: string; source: string; status: string }>>("learnings", []);
  const [form, setForm] = usePersistentState("learning-draft", { type: "Probar", title: "", detail: "", source: "", status: "Pendiente de resultado" });
  const items = [...LEARNINGS, ...extra];
  const add = () => { if (!form.title.trim() || !form.detail.trim() || !form.source.trim()) return; setExtra((current) => [...current, { ...form, id: `learn-local-${Date.now()}` }]); setForm({ ...form, title: "", detail: "", source: "" }); };
  return <><Metrics items={[{ label: "APRENDIZAJES", value: items.length, note: "Reglas con fuente" }, { label: "COMPROBADOS", value: items.filter((item) => item.status === "Comprobada").length, note: "No equivale a causalidad" }, { label: "PENDIENTES", value: items.filter((item) => item.status !== "Comprobada").length, note: "Necesitan experimento" }, { label: "CATEGORÍAS", value: new Set(items.map((item) => item.type)).size, note: "Copiar · adaptar · probar · vigilar · descartar" }]} /><section className={styles.learningGrid}>{items.map((item) => <article className={styles.learningCard} key={item.id}><span className={styles.evidence}>{item.type}</span><h2>{item.title}</h2><p>{item.detail}</p><footer><span>{item.source}</span><strong>{item.status}</strong></footer></article>)}</section><section className={styles.section}><SectionHead kicker="CAPTURA" title="Registrar un aprendizaje nuevo" text="Título, detalle y fuente son obligatorios. El borrador y los registros se recuperan tras recargar." /><div className={styles.learningForm}><label className={styles.field}><span>Clasificación</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{["Copiar", "Adaptar", "Probar", "Vigilar", "Descartar"].map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.field}><span>Estado</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Pendiente de resultado</option><option>Comprobada</option></select></label><label className={styles.field}><span>Título</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className={styles.field}><span>Fuente</span><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label><label className={styles.field}><span>Detalle</span><textarea value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} /></label><div className={styles.formActions}><button className={styles.primary} onClick={add} disabled={!form.title.trim() || !form.detail.trim() || !form.source.trim()}>Guardar aprendizaje</button><button className={styles.secondary} onClick={() => downloadJson("aprendizajes-redvitalia.json", items)}>Exportar</button></div></div></section></>;
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
