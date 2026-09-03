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
