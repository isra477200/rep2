"use client";

import styles from "./CampaignLaunchpad.module.css";

export type CampaignLaunchpadProps = {
  patternCount: number;
  opportunityCount: number;
  playbookCount: number;
  onOpenFactory?: () => void;
  onOpenAdLab?: (query?: string) => void;
  onOpenLandings?: () => void;
};

export default function CampaignLaunchpad({
  patternCount,
  opportunityCount,
  playbookCount,
  onOpenFactory,
  onOpenAdLab,
  onOpenLandings,
}: CampaignLaunchpadProps) {
  return (
    <section className={styles.shell} aria-labelledby="campaign-launchpad-title">
      <header className={styles.hero}>
        <div>
          <p>CONSTRUCTOR DE CAMPAÑAS</p>
          <h3 id="campaign-launchpad-title">Una única ruta desde la evidencia hasta un experimento medible.</h3>
          <span>
            El Growth Lab ya no termina en una conclusión: transporta el
            contexto a la Fábrica 360, genera anuncios Meta y Google, una
            landing V3, formulario, seguimiento, tracking y el test A/B/C.
          </span>
        </div>
        <button type="button" onClick={onOpenFactory}>Crear campaña completa →</button>
      </header>

      <div className={styles.inventory}>
        <article><strong>{opportunityCount}</strong><span>señales de oportunidad</span><small>Hipótesis, no demanda demostrada</small></article>
        <article><strong>{patternCount}</strong><span>patrones observados</span><small>Con adopción, empresas y límites</small></article>
        <article><strong>{playbookCount}</strong><span>playbooks sólidos</span><small>España · por vertical</small></article>
        <article><strong>219</strong><span>recorridos contrastados</span><small>Anuncio → landing → acción observable</small></article>
      </div>

      <div className={styles.flow}>
        <article>
          <i>01</i><span>DECIDIR</span><h4>Selecciona oportunidad, patrón o playbook</h4>
          <p>Empieza por una señal con denominador, confianza y evidencia navegable.</p>
        </article>
        <article>
          <i>02</i><span>CREAR</span><h4>Genera Meta, Google, landing y funnel</h4>
          <p>Todo sale del mismo público, oferta, prueba, eje y mercado.</p>
        </article>
        <article>
          <i>03</i><span>VALIDAR</span><h4>Bloquea claims, destinos o tracking incompletos</h4>
          <p>Lo que no esté listo se exporta como borrador, nunca como página publicable.</p>
        </article>
        <article>
          <i>04</i><span>MEDIR</span><h4>Guarda un A/B/C con una sola variable</h4>
          <p>“Ganador” solo aparece con test cerrado, mínimos y métricas propias.</p>
        </article>
      </div>

      <section className={styles.cohorts} aria-labelledby="cohorts-title">
        <header><div><span>PLAYBOOKS PAÍS × VERTICAL</span><h4 id="cohorts-title">La interfaz enseña la fuerza real de cada muestra.</h4></div><small>Corte de evidencia: 28 ago 2026</small></header>
        <div>
          <article data-status="solid">
            <span>ESPAÑA · SÓLIDO</span><h5>8 verticales listos para construir</h5>
            <dl><div><dt>Empresas elegibles</dt><dd>309</dd></div><div><dt>Identidades fiables</dt><dd>1.280</dd></div><div><dt>Con landing</dt><dd>262</dd></div></dl>
            <p>Clínicas, reformas, B2B/SDR, inmobiliario, legal, belleza, solar y generalista.</p>
          </article>
          <article data-status="exploratory">
            <span>FRANCIA · EXPLORATORIO</span><h5>Útil para landing y funnel; no para patrones publicitarios</h5>
            <dl><div><dt>Fichas</dt><dd>26</dd></div><div><dt>Con capturas</dt><dd>20</dd></div><div><dt>Anuncios aptos</dt><dd>1</dd></div></dl>
            <p>Hay 56 páginas y 96 piezas recuperadas, pero la base semántica publicitaria todavía es insuficiente.</p>
          </article>
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" onClick={() => onOpenAdLab?.()}>Abrir evidencia publicitaria</button>
        <button type="button" onClick={onOpenLandings}>Estudiar y editar la landing</button>
        <button type="button" className={styles.primary} onClick={onOpenFactory}>Entrar en la Fábrica 360</button>
      </div>
    </section>
  );
}
