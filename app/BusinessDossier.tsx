"use client";

import { useEffect, useState } from "react";
import styles from "./BusinessDossier.module.css";
import { guionToText, kitToText, type Kit } from "./kit-text";

type KitTab = "llamada" | "closer" | "emails" | "propuesta" | "google" | "meta";

const CopyButton = ({ text, label = "Copiar" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.copyButton}
      data-copied={copied}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* portapapeles no disponible */
        }
      }}
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
};

type Etiquetado = { etiqueta: string };

type DossierImplicacion = {
  senal: string;
  dato: string;
  implicacion: string;
  etiqueta: string;
  fuente: string;
};

type DossierMovimiento = { quien: string; que: string; donde: string; fecha: string; etiqueta: string };

type DossierVertical = {
  id: string;
  label: string;
  n: number;
  spainN: number;
  medianEur: number | null;
  pricedN: number;
  adsActivePct: number;
  unit: string;
  clienteIdeal: string;
  estacionalidad: string;
  muestraPequena: boolean;
  historia: string;
  oferta: {
    etiqueta: string;
    posicionamiento: string;
    precio: { rango: string; formula: string; etiqueta: string; advertencia: string | null };
    garantia: { texto: string; respaldo: string };
    sla: { objetivo: string; referencia: string } | null;
    formulaTitular: { formula: string; uso: string; alternativas: string[] } | null;
    canales: string[];
  };
  economics: { escenarios: Array<{ clientes: number; mrr: number; formula: string }>; etiqueta: string; nota: string };
  debiles: {
    fragiles: Array<{ id: string; name: string; puntos: number; razones: string[] }>;
    rojos: Array<{ id: string; name: string; score: number; threat: string; adsActive: boolean }>;
  };
  referentes: Array<{ id: string; name: string; country: string; score: number }>;
  plan30: Array<{ semana: number; accion: string }>;
  kit: Kit;
};

type DossierData = {
  schema: string;
  generatedAt: string;
  nota: string;
  mercado: {
    universe: number;
    spainCount: number;
    worldMedianEur: number;
    huecoPrecioEspana: { rango: string; n: number } | null;
    slaFrontera: Array<{ id: string; name: string; sla: string }>;
    elasticidadGarantia: Array<{ label: string; n: number; medianEur: number | null }>;
    ganadores: {
      winners: { n: number; adsActivePct: number; pricePublicPct: number; guaranteePct: number; medianEur: number };
      resto: { n: number; adsActivePct: number; pricePublicPct: number; guaranteePct: number; medianEur: number };
    };
  };
  implicaciones: DossierImplicacion[];
  movimientos: DossierMovimiento[];
  grupos: Array<{ grupo: string; marcas: string[]; evidencia: string } & Etiquetado>;
  verticales: DossierVertical[];
};

const fmt = (n: number) => new Intl.NumberFormat("es-ES").format(n);

const Tag = ({ text }: { text: string }) => {
  const kind = /editorial/i.test(text) ? "editorial" : /estimado/i.test(text) ? "estimado" : "observado";
  return <span className={styles.tag} data-kind={kind}>{text}</span>;
};

export default function BusinessDossier() {
  const [data, setData] = useState<DossierData | null>(null);
  const [error, setError] = useState(false);
  const [openVertical, setOpenVertical] = useState<string>("");
  const [kitTabs, setKitTabs] = useState<Record<string, KitTab>>({});

  useEffect(() => {
    let active = true;
    fetch("/data/dossier.json", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<DossierData>) : Promise.reject()))
      .then((value) => {
        if (!active) return;
        if (value?.schema === "rv-dossier-v1") {
          setData(value);
          setOpenVertical(value.verticales[0]?.id || "");
        } else setError(true);
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="view"><p className={styles.error}>No se ha podido cargar el dossier. Regenera con <code>node scripts/build-dossier.mjs</code>.</p></div>;
  if (!data) return <div className="loading">Montando el dossier de negocio…</div>;

  const { mercado } = data;

  return (
    <div className="view">
      <section className="page-head">
        <p className="eyebrow">DOSSIER DE NEGOCIO · GENERADO {data.generatedAt}</p>
        <h1>El estudio, convertido en un negocio para montar</h1>
        <p>{data.nota}</p>
      </section>

      <section className={styles.marketBand} aria-label="El mercado en cifras">
        <article><span>UNIVERSO</span><strong>{fmt(mercado.universe)}</strong><small>empresas analizadas · {fmt(mercado.spainCount)} en España</small></article>
        <article><span>MEDIANA GLOBAL</span><strong>{mercado.worldMedianEur} €/mes</strong><small>sobre fichas con precio conocido</small></article>
        {mercado.huecoPrecioEspana ? <article><span>HUECO DE PRECIO (ES)</span><strong>{mercado.huecoPrecioEspana.rango}</strong><small>solo {mercado.huecoPrecioEspana.n} actores en el tramo</small></article> : null}
        {mercado.slaFrontera[0] ? <article><span>SLA FRONTERA</span><strong>{mercado.slaFrontera[0].sla}</strong><small>{mercado.slaFrontera[0].name}; la mayoría ni declara SLA</small></article> : null}
        <article><span>GANADORES (80+)</span><strong>{mercado.ganadores.winners.pricePublicPct}% / {mercado.ganadores.winners.guaranteePct}%</strong><small>publican precio / dan garantía (resto: {mercado.ganadores.resto.pricePublicPct}% / {mercado.ganadores.resto.guaranteePct}%)</small></article>
      </section>

      <section className="content-section">
        <div className={styles.sectionHead}>
          <p className="eyebrow">QUÉ IMPLICA CADA SEÑAL</p>
          <h2>Las conclusiones, con sus consecuencias</h2>
          <p>Cada tarjeta separa el dato observado de su lectura. La lectura es criterio, no medición.</p>
        </div>
        <div className={styles.implicationGrid}>
          {data.implicaciones.map((item) => (
            <article key={item.senal} className={styles.implicationCard}>
              <header><h3>{item.senal}</h3><Tag text={item.etiqueta} /></header>
              <p className={styles.dato}><b>Dato.</b> {item.dato}</p>
              <p className={styles.lectura}><b>Implicación.</b> {item.implicacion}</p>
              <small>Fuente: {item.fuente}</small>
            </article>
          ))}
        </div>
      </section>

      {(data.movimientos.length || data.grupos.length) ? (
        <section className="content-section">
          <div className={styles.sectionHead}>
            <p className="eyebrow">EL TABLERO SE MUEVE</p>
            <h2>Movimientos y estructuras de poder</h2>
          </div>
          <div className={styles.movesGrid}>
            {data.movimientos.map((m) => (
              <article key={m.quien + m.que.slice(0, 20)} className={styles.moveCard}>
                <header><b>{m.quien}</b><Tag text={m.etiqueta} /></header>
                <p>{m.que}</p>
                <small>{m.donde}{m.fecha ? ` · ${m.fecha}` : ""}</small>
              </article>
            ))}
            {data.grupos.map((g) => (
              <article key={g.grupo} className={styles.moveCard} data-grupo="true">
                <header><b>Grupo {g.grupo}</b><Tag text={g.etiqueta} /></header>
                <p>{g.marcas.join(" · ")}</p>
                <small>{g.evidencia} — varias “rivales” comparten dueño y backend</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="content-section">
        <div className={styles.sectionHead}>
          <p className="eyebrow">UN NEGOCIO POR VERTICAL</p>
          <h2>Elige el campo de juego; el plan ya está escrito</h2>
          <p>Ordenados por tamaño de oportunidad en España (empresas × mediana de precio). Cada dossier incluye la oferta, los números y los primeros 30 días.</p>
        </div>

        {data.verticales.map((v) => (
          <details
            key={v.id}
            className={styles.verticalDossier}
            open={openVertical === v.id}
            onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) setOpenVertical(v.id); }}
          >
            <summary>
              <div className={styles.summaryMain}>
                <b>{v.label}</b>
                <span>{v.n} empresas · {v.spainN} en España{v.medianEur ? ` · mediana ${v.medianEur} €/mes` : " · precio no publicado"}{v.muestraPequena ? " · muestra pequeña" : ""}</span>
              </div>
              <i aria-hidden="true">＋</i>
            </summary>

            <p className={styles.historia}>{v.historia}</p>
            {v.clienteIdeal ? <p className={styles.clienteIdeal}><b>Cliente ideal:</b> {v.clienteIdeal}{v.estacionalidad ? ` · Estacionalidad: ${v.estacionalidad}` : ""}</p> : null}

            <div className={styles.dossierColumns}>
              <article className={styles.offerCard}>
                <header><h4>La oferta con la que entrar</h4><Tag text={v.oferta.etiqueta} /></header>
                <p>{v.oferta.posicionamiento}</p>
                <div className={styles.offerRow}><span>PRECIO</span><div><b>{v.oferta.precio.rango}</b><small>{v.oferta.precio.formula}</small>{v.oferta.precio.advertencia ? <small className={styles.warn}>{v.oferta.precio.advertencia}</small> : null}</div></div>
                <div className={styles.offerRow}><span>GARANTÍA</span><div><b>{v.oferta.garantia.texto}</b><small>{v.oferta.garantia.respaldo}</small></div></div>
                {v.oferta.sla ? <div className={styles.offerRow}><span>SLA</span><div><b>{v.oferta.sla.objetivo}</b><small>{v.oferta.sla.referencia}</small></div></div> : null}
                {v.oferta.formulaTitular ? <div className={styles.offerRow}><span>TITULAR</span><div><b>Fórmula «{v.oferta.formulaTitular.formula}»</b><small>{v.oferta.formulaTitular.uso}{v.oferta.formulaTitular.alternativas.length ? ` · alternativas: ${v.oferta.formulaTitular.alternativas.join(", ")}` : ""}</small></div></div> : null}
                <div className={styles.offerRow}><span>CANALES</span><div><b>{v.oferta.canales.join(" · ")}</b><small>los tres canales dominantes entre los ganadores del estudio</small></div></div>
                <a className={styles.offerCta} href={`?vista=landings`}>Montar la landing de este vertical en el Landing Studio →</a>
              </article>

              <div className={styles.sideCol}>
                {v.economics.escenarios.length ? (
                  <article className={styles.econCard}>
                    <header><h4>Qué números salen</h4><Tag text={v.economics.etiqueta} /></header>
                    {v.economics.escenarios.map((e) => (
                      <div key={e.clientes} className={styles.econRow}><b>{fmt(e.mrr)} €/mes</b><small>{e.formula}</small></div>
                    ))}
                    <small className={styles.econNote}>{v.economics.nota}</small>
                  </article>
                ) : null}

                {(v.debiles.fragiles.length || v.debiles.rojos.length) ? (
                  <article className={styles.preyCard}>
                    <h4>A quién atacar y a quién vigilar</h4>
                    {v.debiles.fragiles.length ? (
                      <div>
                        <span className={styles.preyLabel}>FRÁGILES (atacar)</span>
                        {v.debiles.fragiles.map((f) => (
                          <a key={f.id} href={`?vista=companies&empresa=${encodeURIComponent(f.id)}`}><b>{f.name}</b><small>{f.razones.join(" · ")}</small></a>
                        ))}
                      </div>
                    ) : null}
                    {v.debiles.rojos.length ? (
                      <div>
                        <span className={styles.preyLabel}>EN ROJO (vigilar)</span>
                        {v.debiles.rojos.map((r) => (
                          <a key={r.id} href={`?vista=companies&empresa=${encodeURIComponent(r.id)}`}><b>{r.name}</b><small>score {r.score}{r.adsActive ? " · ads activos" : " · sin ads"}</small></a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ) : null}

                {v.referentes.length ? (
                  <article className={styles.refCard}>
                    <h4>De quién aprender</h4>
                    {v.referentes.map((r) => (
                      <a key={r.id} href={`?vista=companies&empresa=${encodeURIComponent(r.id)}`}><b>{r.name}</b><small>{r.country} · score {r.score}</small></a>
                    ))}
                  </article>
                ) : null}
              </div>
            </div>

            <div className={styles.plan}>
              <h4>Los primeros 30 días</h4>
              <ol>
                {v.plan30.map((p) => (
                  <li key={p.semana}><i>S{p.semana}</i><p>{p.accion}</p></li>
                ))}
              </ol>
            </div>

            {v.kit ? (() => {
              const tab: KitTab = kitTabs[v.id] || "llamada";
              const setTab = (next: KitTab) => setKitTabs((current) => ({ ...current, [v.id]: next }));
              const kit = v.kit;
              return (
                <div className={styles.kit}>
                  <header className={styles.kitHead}>
                    <div>
                      <h4>Kit de salida al mercado · todo RedVitalia, copia y pega</h4>
                      {kit.senales ? <b className={styles.kitSenales}>{kit.senales}</b> : null}
                      <small>{kit.etiqueta}</small>
                    </div>
                    <button
                      type="button"
                      className={styles.kitDownload}
                      onClick={() => {
                        const blob = new Blob([kitToText(v.label, kit)], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `kit-redvitalia-${v.id}.txt`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Descargar kit completo (.txt)
                    </button>
                  </header>
                  <nav className={styles.kitTabs} aria-label="Piezas del kit">
                    {([
                      ["llamada", "☎ Llamada fría"],
                      ["closer", "🤝 Closer"],
                      ["emails", "✉ Emails + WhatsApp"],
                      ["propuesta", "📄 Propuesta"],
                      ["google", "🔍 Google Ads"],
                      ["meta", "◼ Meta Ads"],
                    ] as Array<[KitTab, string]>).map(([id, label]) => (
                      <button key={id} type="button" className={tab === id ? styles.kitTabActive : ""} onClick={() => setTab(id)}>{label}</button>
                    ))}
                  </nav>

                  {(tab === "llamada" || tab === "closer") ? (() => {
                    const guion = tab === "llamada" ? kit.llamadaFria : kit.closer;
                    return (
                      <div className={styles.kitPanel}>
                        <div className={styles.kitPanelHead}><p>{guion.para}</p><CopyButton text={guionToText(guion)} label="Copiar guion completo" /></div>
                        {guion.pasos.map((paso) => (
                          <article key={paso.fase} className={styles.kitStep}>
                            <b>{paso.fase}</b>
                            <p>{paso.texto}</p>
                          </article>
                        ))}
                        <h5>Objeciones y respuestas</h5>
                        {guion.objeciones.map((o) => (
                          <article key={o.objecion} className={styles.kitObjection}>
                            <b>{o.objecion}</b>
                            <p>{o.respuesta}</p>
                          </article>
                        ))}
                      </div>
                    );
                  })() : null}

                  {tab === "emails" ? (
                    <div className={styles.kitPanel}>
                      {kit.emails.map((email) => (
                        <article key={email.id} className={styles.kitEmail}>
                          <header>
                            <div><span>{email.cuando}</span><b>Asunto: {email.asunto}</b></div>
                            <CopyButton text={`Asunto: ${email.asunto}\n\n${email.cuerpo}`} />
                          </header>
                          <pre>{email.cuerpo}</pre>
                        </article>
                      ))}
                      {kit.whatsapp?.length ? (
                        <>
                          <h5>Seguimiento por WhatsApp</h5>
                          {kit.whatsapp.map((w) => (
                            <article key={w.cuando} className={styles.kitEmail} data-wa="true">
                              <header>
                                <div><span>{w.cuando}</span></div>
                                <CopyButton text={w.texto} />
                              </header>
                              <pre>{w.texto}</pre>
                            </article>
                          ))}
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {tab === "propuesta" && kit.propuesta ? (
                    <div className={styles.kitPanel}>
                      <div className={styles.kitPanelHead}><p>{kit.propuesta.nota}</p><CopyButton text={kit.propuesta.texto} label="Copiar propuesta completa" /></div>
                      <article className={styles.kitEmail}><pre>{kit.propuesta.texto}</pre></article>
                    </div>
                  ) : null}

                  {tab === "google" ? (
                    <div className={styles.kitPanel}>
                      <div className={styles.kitPanelHead}><p><b>{kit.googleAds.campana}</b> — {kit.googleAds.estructura}</p></div>
                      <div className={styles.kitAdsGrid}>
                        <article>
                          {(kit.googleAds.adGroups?.length ? kit.googleAds.adGroups : [{ nombre: `Keywords (${kit.googleAds.keywords[0]?.concordancia})`, keywords: kit.googleAds.keywords.map((k) => k.kw), nota: "" }]).map((group) => (
                            <div key={group.nombre}>
                              <header><b>{group.nombre}</b><CopyButton text={group.keywords.map((k) => `"${k}"`).join("\n")} /></header>
                              <div className={styles.kitChips}>{group.keywords.map((k) => <span key={k}>&quot;{k}&quot;</span>)}</div>
                              {group.nota ? <small className={styles.kitNote}>{group.nota}</small> : null}
                            </div>
                          ))}
                          <header><b>Negativas</b><CopyButton text={kit.googleAds.negativas.join("\n")} /></header>
                          <div className={styles.kitChips} data-neg="true">{kit.googleAds.negativas.map((n) => <span key={n}>{n}</span>)}</div>
                        </article>
                        <article>
                          <header><b>Titulares RSA · {kit.googleAds.titulares.length} (≤30 car.)</b><CopyButton text={kit.googleAds.titulares.join("\n")} /></header>
                          <ol>{kit.googleAds.titulares.map((t) => <li key={t}>{t}<i>{t.length}</i></li>)}</ol>
                        </article>
                        <article>
                          <header><b>Descripciones (≤90 car.)</b><CopyButton text={kit.googleAds.descripciones.join("\n")} /></header>
                          <ol>{kit.googleAds.descripciones.map((d) => <li key={d}>{d}<i>{d.length}</i></li>)}</ol>
                          <header><b>Callouts y sitelinks</b><CopyButton text={`${kit.googleAds.callouts.join("\n")}\n\n${kit.googleAds.sitelinks.map((s) => `${s.texto}: ${s.descripcion}`).join("\n")}`} /></header>
                          <div className={styles.kitChips}>{kit.googleAds.callouts.map((c) => <span key={c}>{c}</span>)}</div>
                          <ul className={styles.kitSitelinks}>{kit.googleAds.sitelinks.map((s) => <li key={s.texto}><b>{s.texto}</b> — {s.descripcion}</li>)}</ul>
                        </article>
                      </div>
                      <small className={styles.kitNote}>{kit.googleAds.nota}</small>
                    </div>
                  ) : null}

                  {tab === "meta" ? (
                    <div className={styles.kitPanel}>
                      <div className={styles.kitPanelHead}><p><b>{kit.metaAds.campana}</b> — {kit.metaAds.nota}</p></div>
                      {kit.metaAds.anuncios.map((ad) => (
                        <article key={ad.nombre} className={styles.kitMetaAd}>
                          <header>
                            <div><b>{ad.nombre}</b><span>{ad.angulo}</span></div>
                            <CopyButton text={`TEXTO PRINCIPAL:\n${ad.primaryText}\n\nTITULAR: ${ad.headline}\nDESCRIPCIÓN: ${ad.description}\nCTA: ${ad.cta}`} label="Copiar anuncio" />
                          </header>
                          <pre>{ad.primaryText}</pre>
                          <div className={styles.kitMetaFields}>
                            <span><b>Titular:</b> {ad.headline}</span>
                            <span><b>Descripción:</b> {ad.description}</span>
                            <span><b>CTA:</b> {ad.cta}</span>
                          </div>
                          <div className={styles.kitPrompt}>
                            <header><b>Prompt de imagen · opción foto (para ChatGPT)</b><CopyButton text={`${ad.imagenPrompt}\n\n${ad.notaChatGPT}`} label="Copiar prompt" /></header>
                            <pre>{ad.imagenPrompt}</pre>
                            <small>{ad.notaChatGPT}</small>
                          </div>
                          {ad.imagenPromptAlt ? (
                            <div className={styles.kitPrompt} data-alt="true">
                              <header><b>Prompt de imagen · opción cartel tipográfico</b><CopyButton text={`${ad.imagenPromptAlt}\n\n${ad.notaChatGPT}`} label="Copiar prompt" /></header>
                              <pre>{ad.imagenPromptAlt}</pre>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })() : null}
          </details>
        ))}
      </section>
    </div>
  );
}
