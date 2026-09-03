"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import ExecutionShell from "../../ejecucion/ExecutionShell";
import { CAPTURE_UNITS } from "../../ejecucion/catalog";
import { CAR_TRIAGE_LINKS, type LandingBlueprint } from "../../ejecucion/landing-blueprints";
import { downloadJson, usePersistentState } from "../../ejecucion/storage";
import styles from "./landing-blueprint.module.css";

export default function LandingBlueprintView({ blueprint }: { blueprint: LandingBlueprint }) {
  const [review, setReview] = usePersistentState<Record<string, boolean>>(`landing-review-${blueprint.slug}`, {});
  const [notes, setNotes] = usePersistentState(`landing-notes-${blueprint.slug}`, "");
  const [simulated, setSimulated] = useState(false);
  const isCarTriage = blueprint.slug === "vender-coche-con-cargas";
  const unit = CAPTURE_UNITS.find((item) => item.id === blueprint.unitId)!;
  const phoneField = blueprint.fields.find((field) => /tel[eé]fono/i.test(field)) || "Teléfono";
  const customerFields = [...new Set([...blueprint.fields.filter((field) => !/consentimiento|tel[eé]fono/i.test(field)).slice(0, 4), phoneField])];
  const checklist = [
    "Cliente, responsable y datos legales confirmados",
    "Marca, logo, colores y tipografías aprobados",
    "Oferta, zona, horario y capacidad verificados",
    "Pruebas y derechos de imagen documentados",
    "Formulario conectado al destino real",
    "Consentimiento, privacidad y CMP revisados",
    "Eventos probados sin duplicidades",
    "Versión móvil, rendimiento y accesibilidad validados",
  ];
  const completed = checklist.filter((item) => review[item]).length;

  return (
    <ExecutionShell
      active="campaigns"
      immersive
      eyebrow="LANDING · VISTA DE REVISIÓN"
      title={blueprint.name}
      description="Primero se muestra la experiencia comercial. Debajo queda la ficha de control para aprobarla sin mezclar ambos contextos."
    >
      <div className={styles.reviewNotice}>
        <Link prefetch={false} href="/entregables">← Entregables</Link>
        <span>PROPUESTA NO PUBLICADA</span>
        <p>La simulación no envía ni guarda datos.</p>
        <b>{completed}/{checklist.length} controles superados</b>
        <button className={styles.exportButton} type="button" onClick={() => downloadJson(`landing-${blueprint.slug}.json`, { ...blueprint, review, notes })}>Exportar ficha</button>
      </div>

      <article className={styles.customerPreview} aria-label="Vista comercial propuesta">
        <header className={styles.customerHeader}>
          <Link prefetch={false} href="/entregables" className={styles.customerBrand}><i>RV</i><span><b>RedVitalia</b><small>Propuesta de captación</small></span></Link>
          <nav aria-label="Secciones de la landing"><a href="#proceso">Proceso</a><a href="#casos">Casos</a><a href="#faq">Preguntas</a></nav>
          <a className={styles.headerCta} href="#formulario">{blueprint.cta}</a>
        </header>

        <section className={styles.commercialHero}>
          <div className={styles.commercialCopy}>
            <p>{blueprint.kicker}</p>
            <h2>{blueprint.headline}</h2>
            <span>{blueprint.subheadline}</span>
            <div className={styles.heroActions}><a href="#formulario">{blueprint.cta}</a>{blueprint.secondaryCta ? <a href="#casos">{blueprint.secondaryCta}</a> : null}</div>
            <ul className={styles.trustStrip}><li>Revisión previa</li><li>Siguiente paso claro</li><li>Sin promesas automáticas</li></ul>
          </div>
          <div className={styles.heroMedia}>
            <img src={unit.image} alt={`Atención profesional para ${unit.name}`} width="900" height="760" />
            <div><span>01</span><p>Cuéntanos el caso</p><span>02</span><p>Comprobamos el encaje</p><span>03</span><p>Recibes el siguiente paso</p></div>
          </div>
          <form id="formulario" className={styles.leadForm} onSubmit={(event) => { event.preventDefault(); setSimulated(true); }} onChange={() => setSimulated(false)}>
            <div className={styles.formHeading}><span>REVISIÓN INICIAL</span><h3>Comprueba si tu caso encaja</h3><p>Solo la información necesaria para una primera respuesta.</p></div>
            <div className={styles.formFields}>{customerFields.map((field, index) => <label key={field}><span>{field}</span><input required name={`lead-${index}`} type={/tel[eé]fono/i.test(field) ? "tel" : "text"} placeholder={/tel[eé]fono/i.test(field) ? "600 000 000" : "Escribe aquí"} /></label>)}</div>
            <label className={styles.consent}><input required type="checkbox" /><span>Acepto que contacten conmigo para revisar este caso. La versión final incluirá la política de privacidad aprobada.</span></label>
            <button type="submit">{blueprint.cta}</button>
            <small>Demostración segura: este formulario no transmite información.</small>
            {simulated ? <div className={styles.success} role="status"><b>Simulación correcta.</b> En la versión conectada recibirías la confirmación y el siguiente paso.</div> : null}
          </form>
        </section>

        <section className={styles.processSection} id="proceso">
          <header><p>UN PROCESO ENTENDIBLE</p><h2>Sabes qué ocurre antes de tomar una decisión.</h2></header>
          <div>{blueprint.process.slice(0, 4).map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></article>)}</div>
        </section>

        <section className={styles.fitSection} id="casos">
          <header><p>ANTES DE ENVIAR</p><h2>Comprueba si este recorrido es para ti.</h2></header>
          <div><article><h3>Podemos revisar estos casos</h3><ul>{blueprint.fit.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>Este recorrido no es adecuado si…</h3><ul>{blueprint.notFit.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul></article></div>
        </section>

        <section className={styles.faqSection} id="faq">
          <header><p>PREGUNTAS FRECUENTES</p><h2>Respuestas directas antes de dejar tus datos.</h2></header>
          <div>{blueprint.faq.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
        </section>
      </article>

      <section className={styles.controlDeck}>
        <header><div><p>FICHA DE REVISIÓN INTERNA</p><h2>Lo que falta para convertir la propuesta en una landing publicable.</h2></div><strong>{completed === checklist.length ? "Lista para aprobación" : "Publicación bloqueada"}</strong></header>

        {isCarTriage ? <div className={styles.triageBlock}><h3>Rutas específicas de vehículos</h3><div>{CAR_TRIAGE_LINKS.map((item) => <Link prefetch={false} key={item.href} href={item.href}><b>{item.label}</b><span>{item.description}</span><em>Abrir →</em></Link>)}</div></div> : null}

        <div className={styles.gateGrid}>{checklist.map((item) => <label key={item} className={review[item] ? styles.checked : ""}><input type="checkbox" checked={Boolean(review[item])} onChange={(event) => setReview((current) => ({ ...current, [item]: event.target.checked }))} /><span>{item}</span></label>)}</div>
        <label className={styles.notes}><span>Notas, responsables y decisiones pendientes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="No introduzcas datos personales ni credenciales." /></label>
        <details className={styles.technicalDetails}><summary>Consultar medición, campos de origen y requisitos de prueba</summary><div><article><h3>Conversión prevista</h3><code>{blueprint.event}</code><p>Cluster: {blueprint.intentCluster}</p></article><article><h3>Señales preservadas</h3><p>{blueprint.sourceFields.join(" · ")}</p></article><article><h3>Pruebas pendientes</h3><ul>{blueprint.proofNeeded.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>Restricción</h3><p>{blueprint.compliance}</p></article></div></details>
      </section>
    </ExecutionShell>
  );
}
