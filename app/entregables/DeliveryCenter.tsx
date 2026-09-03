"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import Link from "next/link";
import ExecutionShell from "../ejecucion/ExecutionShell";
import { CAMPAIGNS, CAPTURE_UNITS, CREATIVES, CREATIVE_FORMATS, type CampaignMode } from "../ejecucion/catalog";
import { LANDING_BLUEPRINTS } from "../ejecucion/landing-blueprints";
import styles from "./delivery.module.css";

const number = new Intl.NumberFormat("es-ES");
const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const packageHref = (campaignId: string) => `/assets/ejecucion/packages/${campaignId}.zip`;

export default function DeliveryCenter() {
  const [selectedId, setSelectedId] = useState("segunda-oportunidad-b2c");
  const [mode, setMode] = useState<CampaignMode | "Todos">("Todos");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => CAMPAIGNS.filter((campaign) => {
    const haystack = `${campaign.unit} ${campaign.id} ${campaign.mode} ${campaign.channel}`.toLocaleLowerCase("es");
    return (mode === "Todos" || campaign.mode === mode) && haystack.includes(query.trim().toLocaleLowerCase("es"));
  }), [mode, query]);

  const selected = CAMPAIGNS.find((campaign) => campaign.id === selectedId) || CAMPAIGNS[0];
  const unit = CAPTURE_UNITS.find((item) => item.id === selected.unitId)!;
  const creatives = CREATIVES.filter((item) => item.campaignId === selected.id);
  const heroCreative = creatives[0];
  const visualSet = [
    heroCreative?.adaptations.find((item) => item.id === "meta-square"),
    heroCreative?.adaptations.find((item) => item.id === "google-landscape"),
    creatives[1]?.adaptations.find((item) => item.id === "story"),
  ].filter(Boolean) as Array<(typeof heroCreative.adaptations)[number]>;
  const landing = LANDING_BLUEPRINTS.find((item) => item.unitId === selected.unitId && item.mode === selected.mode);

  return (
    <ExecutionShell
      active="delivery"
      compact
      eyebrow="ENTREGA OPERATIVA"
      title="Todo lo producido, listo para revisar y descargar."
      description="Cada paquete reúne briefing, landing, medición y 42 imágenes reales. Lo que depende de marca, pruebas o aprobación del cliente aparece separado, no escondido."
      actions={<a className={styles.headerDownload} href="/assets/ejecucion/delivery-manifest.json" download>Descargar inventario</a>}
    >
      <section className={styles.commercialKit} aria-labelledby="commercial-kit-title">
        <header className={styles.kitHeader}>
          <div>
            <p className={styles.kitEyebrow}>KIT COMERCIAL · CAPTACIÓN B2B</p>
            <h2 id="commercial-kit-title">Material para conseguir y cerrar clientes de RedVitalia.</h2>
            <p>Prospección a empresas que contratarán a RedVitalia para gestionar su publicidad y captación. No son guiones para vender al consumidor final.</p>
          </div>
          <div className={styles.kitSummary}>
            <span><b>9</b> materiales principales</span>
            <span><b>91</b> páginas/diapositivas + <b>10</b> hojas CRM</span>
            <span><b>40</b> rutas operativas por vertical</span>
            <span><b>4</b> formas de ver y activar cada ruta</span>
            <Link prefetch={false} href="/operacion-comercial">Abrir operación comercial</Link>
            <a href="/assets/ejecucion/enablement/09-INFORME-EJECUTIVO-AMPLIACION.md">Leer informe ejecutivo</a>
            <a href="/assets/ejecucion/enablement/KIT-COMERCIAL-REDVITALIA.zip" download>Descargar kit completo</a>
          </div>
        </header>

        <article className={styles.routePack}>
          <div className={styles.routePackMark}><span>10×4</span><small>MAPA</small></div>
          <div>
            <p>ARQUITECTURA DE CRECIMIENTO · NUEVO</p>
            <h3>40 rutas para captar cuentas, ejecutar, crear demanda y expandir.</h3>
            <span>Diez verticales, cuatro vías por sistema, embudos, criterios, activos, límites y sprint de 30 días. Todo navegable dentro de la aplicación y exportable para trabajar fuera.</span>
          </div>
          <nav>
            <a href="/sistemas#/routes">Explorar en la aplicación</a>
            <a href="/assets/ejecucion/enablement/10-MAPA-40-RUTAS-REDVITALIA.csv" download>Descargar CSV</a>
            <a href="/assets/ejecucion/enablement/10-MAPA-40-RUTAS-REDVITALIA.json" download>Descargar JSON</a>
          </nav>
        </article>

        <div className={styles.kitGrid}>
          <article className={styles.kitCard}>
            <img src="/assets/ejecucion/enablement/previews/presentacion-comercial.png" alt="Vista previa de la presentación comercial" />
            <div><p>PARA EL PROSPECTO</p><h3>Presentación comercial</h3><span>12 diapositivas para conducir el diagnóstico y explicar el sistema con claridad.</span><nav><a href="/assets/ejecucion/enablement/01-PRESENTACION-COMERCIAL-REDVITALIA.pdf">Abrir PDF</a><a href="/assets/ejecucion/enablement/01-PRESENTACION-COMERCIAL-REDVITALIA.pptx" download>Editar PPTX</a></nav></div>
          </article>
          <article className={styles.kitCard}>
            <img src="/assets/ejecucion/enablement/previews/playbook-closer.png" alt="Vista previa del playbook para closers" />
            <div><p>USO INTERNO · CLOSER</p><h3>Playbook por verticales</h3><span>Discovery, objeciones, criterios de rechazo y 12 battlecards sectoriales.</span><nav><a href="/assets/ejecucion/enablement/02-PLAYBOOK-CLOSER-POR-VERTICALES.pdf">Abrir PDF</a><a href="/assets/ejecucion/enablement/02-PLAYBOOK-CLOSER-POR-VERTICALES.pptx" download>Editar PPTX</a></nav></div>
          </article>
          <article className={styles.kitCard}>
            <img src="/assets/ejecucion/enablement/previews/manual-llamada-fria.png" alt="Portada del manual de llamada fría" />
            <div><p>USO INTERNO · CALLER</p><h3>Manual de llamada fría</h3><span>Guiones exactos, gatekeeper, objeciones, seguimiento, CRM y entrenamiento.</span><nav><a href="/assets/ejecucion/enablement/03-MANUAL-PROSPECCION-Y-LLAMADA-FRIA.pdf">Abrir PDF</a><a href="/assets/ejecucion/enablement/03-MANUAL-PROSPECCION-Y-LLAMADA-FRIA.docx" download>Editar DOCX</a></nav></div>
          </article>
          <article className={styles.kitCard}>
            <img src="/assets/ejecucion/enablement/previews/manual-closer.png" alt="Portada del manual del closer" />
            <div><p>USO INTERNO · CLOSER</p><h3>Manual del closer</h3><span>Handoff, scorecard, economía, cierres, señales por vertical y certificación.</span><nav><a href="/assets/ejecucion/enablement/04-MANUAL-CLOSER-REDVITALIA.pdf">Abrir PDF</a><a href="/assets/ejecucion/enablement/04-MANUAL-CLOSER-REDVITALIA.docx" download>Editar DOCX</a></nav></div>
          </article>
          <article className={styles.kitCard}>
            <img src="/assets/ejecucion/enablement/previews/academia-caller.png" alt="Vista previa de la academia para callers" />
            <div><p>FORMACIÓN · CALLER</p><h3>Academia de prospección</h3><span>18 diapositivas para formar, practicar, evaluar y certificar a quien abre conversaciones en frío.</span><nav><a href="/assets/ejecucion/enablement/05-ACADEMIA-CALLER-REDVITALIA.pdf">Abrir PDF</a><a href="/assets/ejecucion/enablement/05-ACADEMIA-CALLER-REDVITALIA.pptx" download>Editar PPTX</a></nav></div>
          </article>
          <article className={styles.kitCard}>
            <img src="/assets/ejecucion/enablement/previews/secuencias-multicanal.png" alt="Portada del manual de secuencias multicanal" />
            <div><p>USO INTERNO · SDR</p><h3>Secuencias multicanal B2B</h3><span>Cadencia de 15 días con llamada, email, LinkedIn, WhatsApp, voicemail y criterios de salida.</span><nav><a href="/assets/ejecucion/enablement/06-SECUENCIAS-MULTICANAL-B2B.pdf">Abrir PDF</a><a href="/assets/ejecucion/enablement/06-SECUENCIAS-MULTICANAL-B2B.docx" download>Editar DOCX</a></nav></div>
          </article>
          <article className={styles.kitCard}>
            <img src="/assets/ejecucion/enablement/previews/diagnostico-propuesta.png" alt="Portada de la plantilla de diagnóstico y propuesta" />
            <div><p>USO INTERNO · CLOSER</p><h3>Diagnóstico y propuesta</h3><span>Workbook para discovery, scorecard, economía, plan mutuo, go/no-go y recap con siguiente decisión.</span><nav><a href="/assets/ejecucion/enablement/07-PLANTILLA-DIAGNOSTICO-PROPUESTA.pdf">Abrir PDF</a><a href="/assets/ejecucion/enablement/07-PLANTILLA-DIAGNOSTICO-PROPUESTA.docx" download>Editar DOCX</a></nav></div>
          </article>
          <article className={styles.kitCard}>
            <img src="/assets/ejecucion/enablement/previews/crm-dashboard.png" alt="Dashboard del sistema comercial CRM" />
            <div><p>OPERACIÓN · EQUIPO</p><h3>Sistema comercial CRM</h3><span>10 hojas editables: cuentas, pipeline, actividad, cadencia, dashboard, scorecards e inteligencia vertical.</span><nav><a href="/assets/ejecucion/enablement/08-SISTEMA-COMERCIAL-CRM.xlsx" download>Descargar XLSX</a><Link prefetch={false} href="/operacion-comercial">Usar en la plataforma</Link></nav></div>
          </article>
        </div>
      </section>

      <section className={styles.summary} aria-label="Resumen de entregables">
        <article><span>Paquetes de campaña</span><strong>{CAMPAIGNS.length}</strong><small>12 B2B + 12 B2C</small></article>
        <article><span>Archivos gráficos</span><strong>{number.format(CREATIVES.length * CREATIVE_FORMATS.length)}</strong><small>JPG listos para descarga</small></article>
        <article><span>Propuestas de landing</span><strong>{LANDING_BLUEPRINTS.length}</strong><small>Separadas por intención</small></article>
        <article className={styles.guardrail}><span>Publicaciones automáticas</span><strong>0</strong><small>Revisión humana obligatoria</small></article>
      </section>

      <section className={styles.deliveryDesk}>
        <aside className={styles.packageRail}>
          <header>
            <div><p>PAQUETES</p><h2>{filtered.length} disponibles</h2></div>
            <div className={styles.modeSwitch} aria-label="Filtrar por tipo">
              {(["Todos", "B2B", "B2C"] as const).map((item) => <button key={item} className={mode === item ? styles.switchActive : ""} onClick={() => setMode(item)}>{item}</button>)}
            </div>
          </header>
          <label className={styles.packageSearch}>
            <span>Buscar paquete</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Especialidad, canal o campaña" />
          </label>
          <div className={styles.packageList}>
            {filtered.map((campaign) => {
              const itemUnit = CAPTURE_UNITS.find((item) => item.id === campaign.unitId)!;
              const active = campaign.id === selected.id;
              return <button key={campaign.id} className={active ? styles.packageActive : ""} onClick={() => setSelectedId(campaign.id)} aria-pressed={active}>
                <img src={itemUnit.image} alt="" width="56" height="56" />
                <span><b>{campaign.unit}</b><small>{campaign.mode} · 42 imágenes · ZIP</small></span>
                <em>→</em>
              </button>;
            })}
          </div>
        </aside>

        <div className={styles.packageDetail}>
          <header className={styles.packageTitle}>
            <div>
              <p><span className={selected.mode === "B2B" ? styles.b2b : styles.b2c}>{selected.mode}</span> PAQUETE {selected.id}</p>
              <h2>{selected.unit}</h2>
              <p>{selected.objective}</p>
            </div>
            <div className={styles.statusStack}><strong>Contenido listo</strong><span>Marca y prueba pendientes</span></div>
          </header>

          <div className={styles.visualBoard}>
            <figure className={styles.square}><img src={visualSet[0]?.file || unit.image} alt={heroCreative?.alt || unit.name} /></figure>
            <figure className={styles.landscape}><img src={visualSet[1]?.file || unit.image} alt="Adaptación horizontal" /></figure>
            <figure className={styles.story}><img src={visualSet[2]?.file || unit.image} alt="Adaptación vertical" /></figure>
            <div className={styles.visualNote}><b>6 conceptos</b><span>7 formatos por concepto</span></div>
          </div>

          <div className={styles.primaryActions}>
            <a href={packageHref(selected.id)} download><span>Descargar paquete ZIP</span><small>Briefing + landing + 42 JPG + inventario</small></a>
            <Link prefetch={false} href={landing ? `/landings/${landing.slug}` : unit.landing}><span>Revisar landing</span><small>Vista comercial + ficha de aprobación</small></Link>
            <Link prefetch={false} href={`/biblioteca-creativa?unidad=${selected.unitId}&modo=${selected.mode}`}><span>Abrir creatividades</span><small>Estados, formatos y comparación</small></Link>
          </div>

          <section className={styles.packageContents}>
            <article>
              <p>INCLUIDO</p>
              <ul>
                <li><b>42 imágenes</b><span>Meta, Stories, Google y hero de landing</span></li>
                <li><b>Briefing completo</b><span>Objetivo, público, oferta, keywords y exclusiones</span></li>
                <li><b>Plano de landing</b><span>Mensaje, formulario, FAQ, proceso y medición</span></li>
                <li><b>Inventario CSV</b><span>Nombres, dimensiones y rutas de cada archivo</span></li>
              </ul>
            </article>
            <article>
              <p>ANTES DE PUBLICAR</p>
              <ul className={styles.pendingList}>
                <li><b>Brand kit real</b><span>Logo, colores y tipografías del cliente</span></li>
                <li><b>Prueba autorizada</b><span>Casos, reseñas o material verificable</span></li>
                <li><b>Datos operativos</b><span>Zona, presupuesto, capacidad y responsable</span></li>
                <li><b>Aprobación humana</b><span>Legal, privacidad, medición y publicación</span></li>
              </ul>
            </article>
          </section>

          <footer className={styles.packageFooter}>
            <div><span>Medios propuestos</span><strong>{euro.format(selected.budget)}</strong></div>
            <div><span>Canal</span><strong>{selected.channel}</strong></div>
            <div><span>Conversión principal</span><code>{selected.primaryConversion}</code></div>
            <Link prefetch={false} href={`/campanas?unidad=${selected.unitId}&modo=${selected.mode}`}>Ver planificación completa →</Link>
          </footer>
        </div>
      </section>
    </ExecutionShell>
  );
}
