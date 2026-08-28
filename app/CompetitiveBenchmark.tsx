"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AdLandingAuditData,
  AdLandingAuditDimension,
  AdLandingAuditItem,
} from "./AdLandingAuditPanel";
import styles from "./CompetitiveBenchmark.module.css";

export type CompetitiveBenchmarkProps = {
  onOpenCompany?: (companyId: string) => void;
};

const STATUS: Record<AdLandingAuditDimension["status"], string> = {
  aligned: "Alineado",
  partial: "Parcial",
  leak: "Fuga",
  not_observed: "No observado",
};

const confidenceLabel = (value: string) =>
  value === "high" ? "Alta" : value === "medium" ? "Media" : "Baja";

const score = (value: number | null) => (value === null ? "—" : `${value}`);

export default function CompetitiveBenchmark({
  onOpenCompany,
}: CompetitiveBenchmarkProps) {
  const [data, setData] = useState<AdLandingAuditData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/ad-landing-audit.json", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as AdLandingAuditData;
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Error de carga");
      });
    return () => controller.abort();
  }, []);

  const verticals = useMemo(() => {
    if (!data) return [];
    return [
      ...new Map(
        data.items.map((item) => [item.vertical, item.verticalLabel]),
      ).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLocaleLowerCase("es");
    return data.items
      .filter((item) => item.qualityScore !== null)
      .filter((item) => vertical === "all" || item.vertical === vertical)
      .filter(
        (item) =>
          confidence === "all" || item.confidence.label === confidence,
      )
      .filter(
        (item) =>
          !needle ||
          `${item.companyName} ${item.country} ${item.verticalLabel}`
            .toLocaleLowerCase("es")
            .includes(needle),
      )
      .sort(
        (a, b) =>
          (b.qualityScore || 0) - (a.qualityScore || 0) ||
          b.confidence.score - a.confidence.score,
      );
  }, [confidence, data, query, vertical]);

  const compared = useMemo(() => {
    const explicit = selectedIds
      .map((id) => data?.items.find((item) => item.id === id) || null)
      .filter((item): item is AdLandingAuditItem => Boolean(item));
    return explicit.length ? explicit : filtered.slice(0, 3);
  }, [data, filtered, selectedIds]);

  const dimensionRows = useMemo(() => {
    const ids = new Map<string, string>();
    for (const item of compared)
      for (const dimension of item.dimensions)
        ids.set(dimension.id, dimension.label);
    return [...ids.entries()];
  }, [compared]);

  const toggle = (id: string) => {
    setNotice("");
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
      return;
    }
    if (selectedIds.length >= 4) {
      setNotice("Puedes comparar un máximo de cuatro empresas a la vez.");
      return;
    }
    setSelectedIds([...selectedIds, id]);
  };

  if (error)
    return (
      <div className={styles.state} role="alert">
        No se pudo cargar el benchmark ({error}).
      </div>
    );
  if (!data)
    return <div className={styles.state}>Preparando comparables y cobertura…</div>;

  return (
    <section className={styles.shell} aria-labelledby="benchmark-title">
      <header className={styles.hero}>
        <div>
          <p>BENCHMARK COMPETITIVO EXPLICABLE</p>
          <h3 id="benchmark-title">Compara continuidad, prueba y fricción sin fingir datos de rentabilidad.</h3>
          <span>
            El índice describe lo que se observa entre anuncio y landing. La
            confianza y la cobertura se muestran aparte; un dato ausente nunca
            vale cero.
          </span>
        </div>
        <div className={styles.heroStats}>
          <strong>{data.summary.evaluable}</strong>
          <span>empresas comparables</span>
          <small>{data.summary.insufficientEvidence} sin evidencia suficiente</small>
        </div>
      </header>

      <div className={styles.filters}>
        <label>
          Buscar empresa
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, país o vertical…" />
        </label>
        <label>
          Vertical
          <select value={vertical} onChange={(event) => setVertical(event.target.value)}>
            <option value="all">Todas</option>
            {verticals.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label>
          Confianza
          <select value={confidence} onChange={(event) => setConfidence(event.target.value)}>
            <option value="all">Todas</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option>
          </select>
        </label>
        <div><strong>{filtered.length}</strong><span>resultados</span></div>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.picker}>
          <header><b>Elige hasta 4</b><span>Índice ≠ rendimiento</span></header>
          <div>
            {filtered.slice(0, 120).map((item) => {
              const selected = selectedIds.includes(item.id) ||
                (!selectedIds.length && compared.some((candidate) => candidate.id === item.id));
              return (
                <button key={item.id} type="button" data-selected={selected} onClick={() => toggle(item.id)}>
                  <i aria-hidden="true">{selected ? "✓" : "+"}</i>
                  <span><b>{item.companyName}</b><small>{item.verticalLabel} · cobertura {item.confidence.evaluatedShare}%</small></span>
                  <strong>{score(item.qualityScore)}</strong>
                </button>
              );
            })}
          </div>
          {notice ? <p role="status">{notice}</p> : null}
        </aside>

        <div className={styles.comparison}>
          <div className={styles.companyCards}>
            {compared.map((item) => (
              <article key={item.id}>
                <span>{item.verticalLabel} · {item.country}</span>
                <h4>{item.companyName}</h4>
                <dl>
                  <div><dt>Continuidad</dt><dd>{score(item.qualityScore)}</dd></div>
                  <div><dt>Confianza</dt><dd>{item.confidence.score}</dd></div>
                  <div><dt>Cobertura</dt><dd>{item.confidence.evaluatedShare}%</dd></div>
                </dl>
                <small>{confidenceLabel(item.confidence.label)} · {item.ads.uniqueCopies} copies · {item.landing.capture.captureFile ? "captura completa" : "captura limitada"}</small>
                {onOpenCompany ? <button onClick={() => onOpenCompany(item.companyId)}>Abrir ficha →</button> : null}
              </article>
            ))}
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr><th>Dimensión</th>{compared.map((item) => <th key={item.id}>{item.companyName}</th>)}</tr>
              </thead>
              <tbody>
                {dimensionRows.map(([id, label]) => (
                  <tr key={id}>
                    <th>{label}</th>
                    {compared.map((item) => {
                      const dimension = item.dimensions.find((candidate) => candidate.id === id);
                      return (
                        <td key={item.id} data-status={dimension?.status || "not_observed"}>
                          <strong>{score(dimension?.score ?? null)}</strong>
                          <span>{dimension ? STATUS[dimension.status] : "No observado"}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            La comparación solo ordena señales observables. No usa ingresos,
            conversiones ni margen de los competidores, porque esos datos no
            están disponibles. “Ganador” queda reservado a tus experimentos
            cerrados con métricas propias.
          </p>
        </div>
      </div>
    </section>
  );
}
