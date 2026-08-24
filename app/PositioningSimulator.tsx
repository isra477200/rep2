"use client";

import { useMemo, useState } from "react";
import type { Company, PatternsData } from "./data-types";
import styles from "./PositioningSimulator.module.css";

type BillingModel =
  | "mensualidad"
  | "por-lead"
  | "por-cita"
  | "exito"
  | "proyecto"
  | "directorio"
  | "no-clasificable";

type ExclusivityLevel = 0 | 1 | 2;
type GuaranteeLevel = 0 | 1 | 2 | 3;

export type PositioningSimulatorProps = {
  companies: Company[];
  patterns: PatternsData;
  onOpenCompany?: (company: Company) => void;
};

type CompetitorSignals = {
  company: Company;
  model: BillingModel;
  price: number | null;
  slaMinutes: number | null;
  slaLabel: string | null;
  guarantee: GuaranteeLevel;
  exclusivity: ExclusivityLevel;
};

const MODEL_RULES: Array<{
  id: Exclude<BillingModel, "no-clasificable">;
  re: RegExp;
}> = [
  {
    id: "exito",
    re: /(100 ?% a [eé]xito|a [eé]xito|solo (se )?(cobra|factura|paga)|pago por resultado|no cure,? no pay|no win no fee|success fee|coste cero)/i,
  },
  {
    id: "por-cita",
    re: /(por (cita|reuni[oó]n)|per meeting|por reuni[oó]n (v[aá]lida|agendada|efectiva)|appointment)/i,
  },
  {
    id: "por-lead",
    re: /(por lead|per lead|pay per lead|precio del lead|cada lead|c[eé]ntimos por lead|€ ?\/ ?lead|coste por lead)/i,
  },
  {
    id: "mensualidad",
    re: /(mensual|al mes|\/ ?mes|month|retainer|cuota|suscripci[oó]n mensual|mo\b)/i,
  },
  {
    id: "proyecto",
    re: /(por proyecto|pago [uú]nico|one.?off|setup|implantaci[oó]n|desde .*proyecto)/i,
  },
  {
    id: "directorio",
    re: /(directorio|listado|perfil|marketplace|comisi[oó]n por (trabajo|servicio)|cr[eé]ditos)/i,
  },
];

const MODEL_FALLBACK_LABELS: Record<BillingModel, string> = {
  mensualidad: "Cuota mensual / retainer",
  "por-lead": "Pago por lead",
  "por-cita": "Pago por cita / reunión válida",
  exito: "100% a éxito",
  proyecto: "Proyecto / setup único",
  directorio: "Directorio / marketplace",
  "no-clasificable": "Oferta a medida / sin señal pública",
};

const PRICE_UNITS: Record<BillingModel, string> = {
  mensualidad: "€ / mes",
  "por-lead": "€ / lead",
  "por-cita": "€ / cita",
  exito: "€ / resultado",
  proyecto: "€ / proyecto",
  directorio: "€ / periodo",
  "no-clasificable": "€",
};

const GUARANTEES: Array<{
  value: GuaranteeLevel;
  label: string;
  detail: string;
}> = [
  { value: 0, label: "Sin garantía", detail: "No se publica remedio" },
  { value: 1, label: "Escrita", detail: "Promesa explícita" },
  { value: 2, label: "Medible", detail: "Volumen, calidad o plazo" },
  { value: 3, label: "Con remedio", detail: "Repone, devuelve o sigue gratis" },
];

const EXCLUSIVITIES: Array<{
  value: ExclusivityLevel;
  label: string;
  detail: string;
}> = [
  { value: 0, label: "Sin exclusividad", detail: "Oferta compartida o abierta" },
  { value: 1, label: "Lead exclusivo", detail: "No se revende el contacto" },
  { value: 2, label: "Territorio protegido", detail: "Un cliente por nicho y zona" },
];

const SLA_OPTIONS = [
  { value: 1, label: "1 min" },
  { value: 2, label: "2 min" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 30, label: "30 min" },
  { value: 120, label: "2 h" },
  { value: 1440, label: "24 h" },
  { value: 2880, label: "48 h" },
];

const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("es-ES");

const publicOfferText = (company: Company) =>
  [
    company.offer,
    company.priceLocal,
    company.ticket,
    company.guarantee,
    company.contract,
    company.funnel,
    company.cta,
  ]
    .filter(Boolean)
    .join(" ");

const billingText = (company: Company) =>
  [
    company.offer,
    company.priceLocal,
    company.ticket,
    company.guarantee,
    company.contract,
  ]
    .filter(Boolean)
    .join(" ");

export function classifyBillingModel(company: Company): BillingModel {
  const text = billingText(company);
  return MODEL_RULES.find((rule) => rule.re.test(text))?.id || "no-clasificable";
}

export function detectSla(company: Company): {
  minutes: number | null;
  label: string | null;
} {
  const text = [company.offer, company.funnel, company.cta, company.guarantee]
    .filter(Boolean)
    .join(" ");
  const match = text.match(
    /(?:en |menos de |dentro de |<\s?)(\d+)\s?(minutos|min\b|horas?|h\b)/i,
  );
  if (!match || !/(contact|respond|respuesta|llama|lead|cita|atenci)/i.test(text))
    return { minutes: null, label: null };
  const minutes = /min/i.test(match[2])
    ? Number(match[1])
    : Number(match[1]) * 60;
  return minutes > 0 && minutes <= 2880
    ? { minutes, label: match[0].trim() }
    : { minutes: null, label: null };
}

export function detectGuaranteeLevel(company: Company): GuaranteeLevel {
  const text = (company.guarantee || "").trim();
  if (text.length < 25) return 0;
  const explicitRemedy =
    /((si|cuando).{0,100}(reemplaz|repone|sustituy|devuel|reembols|gratis|sin coste)|(?:se|te|lo|la)?\s*(reemplaza|repone|sustituye|devuelve|reembolsa)|reposici[oó]n (gratuita|sin coste|del lead|de la cita)|devoluci[oó]n (total|[ií]ntegra|del 100|de la cuota|del dinero)|trabaja\w* gratis|prolonga\w* (gratis|sin coste|la campaña|el servicio)|free until|solo (se )?(cobra|factura|paga)|no se factura|coste cero|no pagas)/i.test(
      text,
    );
  if (explicitRemedy) return 3;
  const negativeOpening =
    /^(ninguna|no (aplica|comprob|consta|detect|encontr|garantiza|hay|localiz|menciona|ofrece|publica|se |visible)|sin garant|verificado:\s*no|declara expresamente que no|consulta gratuita;\s*sin)/i.test(
      text,
    );
  if (negativeOpening) return 0;
  if (
    /(garantiza \d|m[ií]nimo de \d|al menos \d|\d+\+? (leads|citas|reuniones|contactos)|en \d+ (d[ií]as|semanas)|criterios? (pactados?|acordados?)|(?:lead|cita|reuni[oó]n) (cualificad|v[aá]lid)|promesa (medible|num[eé]rica))/i.test(
      text,
    )
  )
    return 2;
  return 1;
}

export function detectExclusivityLevel(company: Company): ExclusivityLevel {
  const text = publicOfferText(company);
  const positiveMentions = text
    .split(/[.;\n]+/)
    .filter((sentence) => /exclusiv/i.test(sentence))
    .filter(
      (sentence) =>
        !/(no (garantiza|hay|incluye|ofrece|publica|se (encontr[oó]|localiz[oó]|detect[oó])|son?|es)|sin|tampoco).{0,45}exclusiv|exclusiv.{0,30}(no comprob|no verific|no public|no localiz|compartid)/i.test(
          sentence,
        ),
    );
  if (!positiveMentions.length) return 0;
  const positiveText = positiveMentions.join(" ");
  if (
    /(exclusiv\w*.{0,55}(territori|zona|geogr[aá]fic|provincia|localidad|plaza)|(?:territori|zona|geogr[aá]fic|provincia|localidad|plaza).{0,55}exclusiv)/i.test(
      positiveText,
    )
  )
    return 2;
  return 1;
}

function percentileAtOrBelow(values: number[], value: number) {
  if (!values.length) return 0;
  const lower = values.filter((entry) => entry < value).length;
  const equal = values.filter((entry) => entry === value).length;
  return Math.round(((lower + equal * 0.5) / values.length) * 100);
}

function speedPercentile(values: number[], minutes: number) {
  if (!values.length) return 0;
  const slower = values.filter((entry) => entry > minutes).length;
  const equal = values.filter((entry) => entry === minutes).length;
  return Math.round(((slower + equal * 0.5) / values.length) * 100);
}

function clampPercentile(value: number) {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function guaranteeLabel(level: GuaranteeLevel) {
  return GUARANTEES.find((item) => item.value === level)?.label || "Sin garantía";
}

function exclusivityLabel(level: ExclusivityLevel) {
  return EXCLUSIVITIES.find((item) => item.value === level)?.label || "Sin exclusividad";
}

function short(text: string, length = 128) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > length
    ? `${normalized.slice(0, length).replace(/\s+\S*$/, "")}…`
    : normalized;
}

function signalsFor(company: Company): CompetitorSignals {
  const sla = detectSla(company);
  return {
    company,
    model: classifyBillingModel(company),
    price:
      typeof company.price?.eur === "number" && company.price.eur > 0
        ? company.price.eur
        : null,
    slaMinutes: sla.minutes,
    slaLabel: sla.label,
    guarantee: detectGuaranteeLevel(company),
    exclusivity: detectExclusivityLevel(company),
  };
}

function packageScore({
  slaPercentile,
  guaranteePercentile,
  exclusivityPercentile,
  modelWinnerRate,
}: {
  slaPercentile: number;
  guaranteePercentile: number;
  exclusivityPercentile: number;
  modelWinnerRate: number;
}) {
  return Math.round(
    slaPercentile * 0.4 +
      guaranteePercentile * 0.3 +
      exclusivityPercentile * 0.2 +
      modelWinnerRate * 0.1,
  );
}

export default function PositioningSimulator({
  companies,
  patterns,
  onOpenCompany,
}: PositioningSimulatorProps) {
  const [model, setModel] = useState<BillingModel>("mensualidad");
  const [price, setPrice] = useState(900);
  const [slaMinutes, setSlaMinutes] = useState(10);
  const [guarantee, setGuarantee] = useState<GuaranteeLevel>(3);
  const [exclusivity, setExclusivity] = useState<ExclusivityLevel>(2);

  const allSignals = useMemo(() => companies.map(signalsFor), [companies]);
  const modelStats = useMemo(
    () => new Map(patterns.modelStats.map((item) => [item.id, item])),
    [patterns],
  );
  const selectedModelStats = modelStats.get(model);

  const modelOptions = useMemo(() => {
    const ids = new Set<BillingModel>([
      ...patterns.modelStats.map((item) => item.id as BillingModel),
      ...Object.keys(MODEL_FALLBACK_LABELS).map((id) => id as BillingModel),
    ]);
    return [...ids].sort((left, right) => {
      const leftN = modelStats.get(left)?.n || 0;
      const rightN = modelStats.get(right)?.n || 0;
      return rightN - leftN;
    });
  }, [modelStats, patterns.modelStats]);

  const analysis = useMemo(() => {
    const comparable = allSignals.filter(
      (entry) =>
        entry.model === model &&
        entry.company.scope !== "Excluir — fuente/no negocio",
    );
    const priced = comparable.filter(
      (entry): entry is CompetitorSignals & { price: number } =>
        entry.price !== null,
    );
    const modelSlas = comparable
      .map((entry) => entry.slaMinutes)
      .filter((value): value is number => value !== null);
    const allSlas = allSignals
      .map((entry) => entry.slaMinutes)
      .filter((value): value is number => value !== null);
    const slaReference = modelSlas.length >= 5 ? modelSlas : allSlas;
    const guaranteeValues = comparable.map((entry) => entry.guarantee);
    const exclusivityValues = comparable.map((entry) => entry.exclusivity);
    const pricePercentile = percentileAtOrBelow(
      priced.map((entry) => entry.price),
      price,
    );
    const slaPercentile = speedPercentile(slaReference, slaMinutes);
    const guaranteePercentile = percentileAtOrBelow(guaranteeValues, guarantee);
    const exclusivityPercentile = percentileAtOrBelow(
      exclusivityValues,
      exclusivity,
    );
    const modelWinnerRate = selectedModelStats?.winnersPct || 0;
    const score = packageScore({
      slaPercentile,
      guaranteePercentile,
      exclusivityPercentile,
      modelWinnerRate,
    });

    const competitorScores = comparable.map((entry) => {
      const entrySlaPercentile = entry.slaMinutes
        ? speedPercentile(slaReference, entry.slaMinutes)
        : 0;
      return packageScore({
        slaPercentile: entrySlaPercentile,
        guaranteePercentile: percentileAtOrBelow(
          guaranteeValues,
          entry.guarantee,
        ),
        exclusivityPercentile: percentileAtOrBelow(
          exclusivityValues,
          entry.exclusivity,
        ),
        modelWinnerRate,
      });
    });
    const marketPercentile = clampPercentile(
      percentileAtOrBelow(competitorScores, score),
    );

    const pool = priced.length >= 5 ? priced : comparable;
    const closest = [...pool]
      .map((entry) => {
        const priceDistance = entry.price
          ? Math.min(
              1,
              Math.abs(Math.log((entry.price + 1) / (price + 1))) /
                Math.log(10),
            )
          : 0.75;
        const slaDistance = entry.slaMinutes
          ? Math.min(
              1,
              Math.abs(
                Math.log((entry.slaMinutes + 1) / (slaMinutes + 1)),
              ) / Math.log(48),
            )
          : 0.65;
        const guaranteeDistance = Math.abs(entry.guarantee - guarantee) / 3;
        const exclusivityDistance =
          Math.abs(entry.exclusivity - exclusivity) / 2;
        return {
          ...entry,
          distance:
            priceDistance * 0.42 +
            slaDistance * 0.25 +
            guaranteeDistance * 0.18 +
            exclusivityDistance * 0.15,
        };
      })
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          right.company.score - left.company.score,
      )
      .slice(0, 5);

    const territorialN = comparable.filter(
      (entry) => entry.exclusivity === 2,
    ).length;
    const remedyN = comparable.filter((entry) => entry.guarantee === 3).length;
    const recommendations: string[] = [];
    if (slaPercentile < 70)
      recommendations.push(
        `Bajar el SLA de ${SLA_OPTIONS.find((item) => item.value === slaMinutes)?.label || `${slaMinutes} min`} a 10 minutos o menos elevaría la señal de velocidad.`,
      );
    if (guarantee < 3)
      recommendations.push(
        "Añadir un remedio escrito —reposición, continuidad gratis o devolución— convierte una promesa en garantía defendible.",
      );
    if (exclusivity < 2)
      recommendations.push(
        "La protección por nicho y zona crea una diferencia que el cliente puede comprobar y el competidor no puede duplicar sin limitar ventas.",
      );
    if (pricePercentile >= 80)
      recommendations.push(
        "El precio queda en franja premium: conviene enseñar volumen, criterios de cita válida y remedio junto a la tarifa.",
      );
    else if (pricePercentile <= 20)
      recommendations.push(
        "El precio queda en la franja baja: valida que no esté anclando la oferta como mano de obra barata frente al valor de una cita.",
      );
    if (!recommendations.length)
      recommendations.push(
        "El paquete está equilibrado. La siguiente mejora no es otra promesa: es publicar prueba verificable de cumplimiento.",
      );

    return {
      comparable,
      priced,
      slaReference,
      slaReferenceIsModel: modelSlas.length >= 5,
      pricePercentile,
      slaPercentile,
      guaranteePercentile,
      exclusivityPercentile,
      modelWinnerRate,
      score,
      marketPercentile,
      closest,
      territorialN,
      remedyN,
      recommendations,
    };
  }, [
    allSignals,
    exclusivity,
    guarantee,
    model,
    price,
    selectedModelStats?.winnersPct,
    slaMinutes,
  ]);

  const modelLabel =
    selectedModelStats?.label || MODEL_FALLBACK_LABELS[model];
  const priceRangeMax = Math.max(
    2000,
    Math.ceil(Math.max(price, (selectedModelStats?.medianEur || 500) * 4) / 100) *
      100,
  );

  return (
    <section className={styles.simulator} aria-labelledby="positioning-title">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SIMULADOR DE POSICIONAMIENTO</p>
          <h2 id="positioning-title">Prueba la oferta antes de sacarla al mercado</h2>
          <p>
            Ajusta las cinco palancas de RedVitalia. El resultado compara la
            oferta con señales públicas de la base, no con supuestos de facturación
            o rentabilidad.
          </p>
        </div>
        <div className={styles.datasetStamp}>
          <span>BASE OBSERVADA</span>
          <strong>{compact.format(patterns.universe)}</strong>
          <small>fichas · corte {patterns.generatedAt}</small>
        </div>
      </header>

      <div className={styles.workspace}>
        <form className={styles.controls} onSubmit={(event) => event.preventDefault()}>
          <div className={styles.panelHeading}>
            <span>01</span>
            <div>
              <strong>Configura el paquete</strong>
              <small>Los cambios recalculan el mercado al instante</small>
            </div>
          </div>

          <label className={styles.field}>
            <span>Modelo de cobro</span>
            <select
              value={model}
              onChange={(event) => {
                const next = event.target.value as BillingModel;
                setModel(next);
                const median = modelStats.get(next)?.medianEur;
                if (median) setPrice(median);
              }}
            >
              {modelOptions.map((id) => (
                <option key={id} value={id}>
                  {modelStats.get(id)?.label || MODEL_FALLBACK_LABELS[id]}
                </option>
              ))}
            </select>
            <small>
              {selectedModelStats
                ? `${compact.format(selectedModelStats.n)} señales clasificadas · ${selectedModelStats.winnersPct}% con puntuación 80+`
                : "Sin estadística agregada disponible"}
            </small>
          </label>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span>Precio público</span>
              <label className={styles.priceInput}>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={price}
                  aria-label="Precio en euros"
                  onChange={(event) =>
                    setPrice(Math.max(1, Number(event.target.value) || 1))
                  }
                />
                <b>{PRICE_UNITS[model]}</b>
              </label>
            </div>
            <input
              className={styles.range}
              type="range"
              min={1}
              max={priceRangeMax}
              step={model === "por-lead" ? 5 : 25}
              value={Math.min(price, priceRangeMax)}
              aria-label={`Precio ${PRICE_UNITS[model]}`}
              onChange={(event) => setPrice(Number(event.target.value))}
            />
            <div className={styles.rangeLegend}>
              <span>1 €</span>
              <span>
                mediana observada {selectedModelStats?.medianEur ? euro.format(selectedModelStats.medianEur) : "s/d"}
              </span>
              <span>{euro.format(priceRangeMax)}</span>
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend>SLA de primer contacto</legend>
            <div className={styles.optionGridSmall}>
              {SLA_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={slaMinutes === item.value ? styles.selected : ""}
                  aria-pressed={slaMinutes === item.value}
                  onClick={() => setSlaMinutes(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Garantía</legend>
            <div className={styles.optionStack}>
              {GUARANTEES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={guarantee === item.value ? styles.selected : ""}
                  aria-pressed={guarantee === item.value}
                  onClick={() => setGuarantee(item.value)}
                >
                  <b>{item.label}</b>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Exclusividad</legend>
            <div className={styles.optionStack}>
              {EXCLUSIVITIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={exclusivity === item.value ? styles.selected : ""}
                  aria-pressed={exclusivity === item.value}
                  onClick={() => setExclusivity(item.value)}
                >
                  <b>{item.label}</b>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          </fieldset>
        </form>

        <div className={styles.results} aria-live="polite">
          <div className={styles.panelHeading}>
            <span>02</span>
            <div>
              <strong>Posición visible estimada</strong>
              <small>Comparada dentro del mismo modelo de cobro</small>
            </div>
          </div>

          <div className={styles.percentileHero}>
            <div
              className={styles.dial}
              style={{
                background: `conic-gradient(#1a73e8 ${analysis.marketPercentile * 3.6}deg, #dce5f2 0deg)`,
              }}
              aria-label={`Percentil ${analysis.marketPercentile}`}
            >
              <div>
                <small>PERCENTIL</small>
                <strong>P{analysis.marketPercentile}</strong>
                <span>{analysis.score}/100</span>
              </div>
            </div>
            <div>
              <span className={styles.inferredBadge}>INFERENCIA EXPLÍCITA</span>
              <h3>
                Se sitúa por encima de aproximadamente el {analysis.marketPercentile}%
                del grupo comparable
              </h3>
              <p>
                {compact.format(analysis.comparable.length)} ofertas clasificadas
                como <b>{modelLabel}</b>. El índice no predice ventas: ordena lo
                que un comprador puede comprobar antes de hablar con la empresa.
              </p>
            </div>
          </div>

          <div className={styles.metrics}>
            <article>
              <span>Precio</span>
              <strong>
                {analysis.priced.length ? `P${analysis.pricePercentile}` : "—"}
              </strong>
              <small>
                {analysis.priced.length
                  ? `Más caro que el ${analysis.pricePercentile}% de ${analysis.priced.length} precios comparables`
                  : "Sin precios suficientes en este modelo"}
              </small>
            </article>
            <article>
              <span>Velocidad</span>
              <strong>
                {analysis.slaReference.length ? `P${analysis.slaPercentile}` : "—"}
              </strong>
              <small>
                Más rápido que el {analysis.slaPercentile}% de {analysis.slaReference.length} SLA publicados
              </small>
            </article>
            <article>
              <span>Garantía</span>
              <strong>P{analysis.guaranteePercentile}</strong>
              <small>
                {analysis.remedyN} competidores del grupo publican un remedio detectable
              </small>
            </article>
            <article>
              <span>Exclusividad</span>
              <strong>P{analysis.exclusivityPercentile}</strong>
              <small>
                {analysis.territorialN} ofertas del grupo declaran protección territorial
              </small>
            </article>
          </div>

          <div className={styles.scoreBreakdown}>
            <h3>Qué empuja el índice</h3>
            {[
              { label: "SLA visible", value: analysis.slaPercentile, weight: "40%" },
              {
                label: "Garantía observable",
                value: analysis.guaranteePercentile,
                weight: "30%",
              },
              {
                label: "Exclusividad observable",
                value: analysis.exclusivityPercentile,
                weight: "20%",
              },
              {
                label: "Tasa 80+ del modelo",
                value: analysis.modelWinnerRate,
                weight: "10%",
              },
            ].map((item) => (
              <div key={item.label} className={styles.scoreRow}>
                <span>{item.label}</span>
                <i>
                  <b style={{ width: `${item.value}%` }} />
                </i>
                <strong>{item.value}</strong>
                <small>peso {item.weight}</small>
              </div>
            ))}
          </div>

          <div className={styles.recommendation}>
            <span>LECTURA RECOMENDADA · INFERIDA</span>
            <ul>
              {analysis.recommendations.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className={styles.comparables}>
        <div className={styles.comparablesHeading}>
          <div>
            <p className={styles.eyebrow}>COMPETIDORES MÁS PARECIDOS</p>
            <h3>El espejo real de esta configuración</h3>
          </div>
          <p>
            Coincidencia por modelo, precio, SLA, garantía y exclusividad. La
            cercanía es una <b>inferencia matemática</b>; cada dato mostrado sale de
            su ficha pública.
          </p>
        </div>

        {analysis.closest.length ? (
          <div className={styles.competitorList}>
            {analysis.closest.map((entry, index) => (
              <article key={entry.company.id}>
                <div className={styles.competitorRank}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className={styles.competitorIdentity}>
                  <small>
                    {entry.company.primaryCountry} · score observado {entry.company.score}
                  </small>
                  <h4>{entry.company.name}</h4>
                  <p>
                    {entry.company.offer
                      ? short(entry.company.offer)
                      : "Oferta pública sin resumen suficiente."}
                  </p>
                </div>
                <dl className={styles.signalGrid}>
                  <div>
                    <dt>Precio observado</dt>
                    <dd>{entry.price ? euro.format(entry.price) : "No observable"}</dd>
                  </div>
                  <div>
                    <dt>SLA detectado</dt>
                    <dd>{entry.slaLabel || "No observable"}</dd>
                  </div>
                  <div>
                    <dt>Garantía detectada</dt>
                    <dd>{guaranteeLabel(entry.guarantee)}</dd>
                  </div>
                  <div>
                    <dt>Exclusividad detectada</dt>
                    <dd>{exclusivityLabel(entry.exclusivity)}</dd>
                  </div>
                </dl>
                {onOpenCompany ? (
                  <button
                    type="button"
                    className={styles.openButton}
                    onClick={() => onOpenCompany(entry.company)}
                  >
                    Abrir ficha →
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            No hay suficientes ofertas comparables con esta configuración.
          </div>
        )}
      </section>

      <details className={styles.methodology}>
        <summary>Metodología, límites y trazabilidad</summary>
        <div>
          <p>
            <b>Observado:</b> modelo, precio convertible, SLA textual, garantía y
            exclusividad se extraen de las fichas públicas del portal. La
            clasificación del modelo reproduce las mismas reglas usadas para
            generar <i>patterns.json</i>. Un dato no publicado se trata como señal
            no observable, no como prueba de que la empresa no lo ofrezca.
          </p>
          <p>
            <b>Inferido:</b> el índice pondera SLA 40%, garantía 30%, exclusividad
            20% y proporción de fichas 80+ del modelo 10%. Después sitúa ese índice
            frente a las ofertas del mismo modelo. El precio queda fuera del
            índice porque ni caro ni barato significa mejor por sí solo; se usa
            para el percentil de precio y para localizar comparables.
          </p>
          <p>
            <b>Límite:</b> el resultado mide diferenciación comercial visible, no
            calidad de servicio, margen, probabilidad de cierre ni facturación.
            Los SLA se comparan dentro del modelo cuando hay al menos cinco; en
            caso contrario se usa el benchmark global y se indica el tamaño de la
            muestra ({analysis.slaReference.length}).
          </p>
        </div>
      </details>
    </section>
  );
}
