"use client";

import Link from "next/link";
import ExecutionShell from "../../ejecucion/ExecutionShell";
import { CAR_TRIAGE_LINKS, type LandingBlueprint } from "../../ejecucion/landing-blueprints";
import { downloadJson, usePersistentState } from "../../ejecucion/storage";
import styles from "./landing-blueprint.module.css";

export default function LandingBlueprintView({ blueprint }: { blueprint: LandingBlueprint }) {
  const [review, setReview] = usePersistentState<Record<string, boolean>>(`landing-review-${blueprint.slug}`, {});
  const [notes, setNotes] = usePersistentState(`landing-notes-${blueprint.slug}`, "");
  const isCarTriage = blueprint.slug === "vender-coche-con-cargas";
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
      eyebrow="LANDING PROPUESTA · NO PUBLICADA"
      title={blueprint.name}
      description="Ruta nativa de revisión. Documenta mensaje, formulario, triaje, medición y bloqueos sin simular una captación real ni enviar datos."
      actions={<button type="button" onClick={() => downloadJson(`landing-${blueprint.slug}.json`, { ...blueprint, review, notes })}>Exportar ficha</button>}
    >
      <div className={styles.statusBar}>
        <div><strong>Estado: propuesta interna</strong><span>0 envíos reales · 0 automatizaciones · aprobación humana pendiente</span></div>
        <span>{completed}/{checklist.length} controles</span>
      </div>

      <section className={styles.preview} aria-label="Primera pantalla propuesta">
        <div className={styles.heroCopy}>
          <p>{blueprint.kicker}</p>
          <h2>{blueprint.headline}</h2>
          <span>{blueprint.subheadline}</span>
          <div className={styles.proposedActions} aria-label="Llamadas a la acción propuestas">
            <strong>{blueprint.cta}</strong>
            {blueprint.secondaryCta ? <em>{blueprint.secondaryCta}</em> : null}
          </div>
          <small>Los CTA se muestran como contenido propuesto; esta pantalla interna no captura datos.</small>
        </div>
        <aside className={styles.formBlueprint}>
          <span>FORMULARIO PROPUESTO · {blueprint.mode}</span>
          <h3>Datos para decidir el siguiente paso</h3>
          <ol>{blueprint.fields.map((field) => <li key={field}>{field}</li>)}</ol>
          <b>Evento tras validación y envío real</b>
          <code>{blueprint.event}</code>
        </aside>
      </section>

      {isCarTriage ? (
        <section className={styles.section}>
          <header><p>TRIAJE DE CARGA</p><h2>Separar la intención antes de pedir más datos</h2><span>El usuario que ya conoce la carga pasa a una landing específica; “no lo sé” permanece en este flujo general.</span></header>
          <div className={styles.triageGrid}>
            {CAR_TRIAGE_LINKS.map((item) => <Link prefetch={false} key={item.href} href={item.href}><strong>{item.label}</strong><span>{item.description}</span><b>Abrir propuesta →</b></Link>)}
          </div>
        </section>
      ) : null}

      <section className={styles.twoColumns}>
        <article><p>ENCAJA</p><h2>Casos que deben avanzar</h2><ul>{blueprint.fit.map((item) => <li key={item}>{item}</li>)}</ul></article>
        <article className={styles.negative}><p>NO ENCAJA</p><h2>Casos que deben salir del flujo</h2><ul>{blueprint.notFit.map((item) => <li key={item}>{item}</li>)}</ul></article>
      </section>

      <section className={styles.section}>
        <header><p>PROCESO</p><h2>Qué debe ocurrir después del clic</h2></header>
        <div className={styles.process}>{blueprint.process.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></article>)}</div>
      </section>

      <section className={styles.section}>
        <header><p>OBJECIONES</p><h2>Preguntas que la landing debe resolver</h2></header>
        <div className={styles.faq}>{blueprint.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className={styles.measurement}>
        <article><p>MEDICIÓN</p><h2>Señales preservadas</h2><div>{blueprint.sourceFields.map((field) => <code key={field}>{field}</code>)}</div><p><b>Cluster:</b> {blueprint.intentCluster}</p><p><b>Conversión:</b> {blueprint.event}</p></article>
        <article><p>PRUEBA PENDIENTE</p><h2>No publicar sin evidencia real</h2><ul>{blueprint.proofNeeded.map((item) => <li key={item}>{item}</li>)}</ul><p><b>Restricción:</b> {blueprint.compliance}</p></article>
      </section>

      <section className={styles.review}>
        <header><div><p>PUERTA DE PUBLICACIÓN</p><h2>Revisión explícita y reversible</h2></div><strong>{completed === checklist.length ? "Lista para aprobación humana" : "Bloqueada"}</strong></header>
        <div>{checklist.map((item) => <label key={item}><input type="checkbox" checked={Boolean(review[item])} onChange={(event) => setReview((current) => ({ ...current, [item]: event.target.checked }))} /><span>{item}</span></label>)}</div>
        <label className={styles.notes}><span>Notas, responsables y decisiones pendientes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="No introduzcas datos personales ni credenciales." /></label>
      </section>

      <nav className={styles.related} aria-label="Elementos relacionados">
        {blueprint.related.map((item) => <Link prefetch={false} key={item.href} href={item.href}>{item.label} →</Link>)}
      </nav>
    </ExecutionShell>
  );
}
