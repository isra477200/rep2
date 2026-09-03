"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import styles from "./execution.module.css";
import WorkspaceTransfer from "./WorkspaceTransfer";
import { CAPTURE_UNITS } from "./catalog";

export const EXECUTION_NAV = [
  { id: "delivery", href: "/entregables", label: "Centro de entregables", icon: "01" },
  { id: "systems", href: "/sistemas", label: "Sistemas de captación", icon: "02" },
  { id: "campaigns", href: "/campanas", label: "Campañas", icon: "03" },
  { id: "creative", href: "/creativos", label: "Fábrica creativa", icon: "04" },
  { id: "library", href: "/biblioteca-creativa", label: "Biblioteca creativa", icon: "05" },
  { id: "economics", href: "/laboratorio", label: "Laboratorio económico", icon: "06" },
  { id: "experiments", href: "/experimentos", label: "Experimentos", icon: "07" },
  { id: "decisions", href: "/decisiones", label: "Decisiones", icon: "08" },
  { id: "learnings", href: "/aprendizajes", label: "Aprendizajes", icon: "09" },
] as const;

export type ExecutionSection = (typeof EXECUTION_NAV)[number]["id"];

export default function ExecutionShell({ active, eyebrow, title, description, actions, children, compact = false, immersive = false }: {
  active: ExecutionSection;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  immersive?: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("es");
  const results = useMemo(() => normalized ? CAPTURE_UNITS.flatMap((unit) => [
    { id: `${unit.id}-system`, label: unit.name, detail: "Sistema", href: `/sistemas#/niche/${unit.systemId}` },
    { id: `${unit.id}-campaigns`, label: `${unit.name} · campañas`, detail: "B2B y B2C", href: `/campanas?unidad=${unit.id}` },
    { id: `${unit.id}-creative`, label: `${unit.name} · creatividades`, detail: "Biblioteca", href: `/biblioteca-creativa?unidad=${unit.id}` },
  ]).filter((item) => `${item.label} ${item.detail}`.toLocaleLowerCase("es").includes(normalized)).slice(0, 8) : [], [normalized]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("es") === "k") {
        event.preventDefault();
        document.getElementById(window.matchMedia("(max-width: 760px)").matches ? "execution-mobile-search" : "execution-global-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#execution-content">Saltar al contenido</a>
      <aside className={styles.sidebar}>
        <Link prefetch={false} className={styles.brand} href="/?vista=home" aria-label="Volver al mercado RedVitalia">
          <span>RV</span>
          <div><strong>RedVitalia</strong><small>INTELIGENCIA DE MERCADO</small></div>
        </Link>
        <p className={styles.groupLabel}>EJECUCIÓN REDVITALIA</p>
        <div className={styles.globalSearch}>
          <label htmlFor="execution-global-search">Buscar en ejecución <kbd>Ctrl K</kbd></label>
          <input id="execution-global-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sistema, campaña o creatividad" />
          {results.length ? <div role="listbox" aria-label="Resultados globales">{results.map((item) => <Link prefetch={false} role="option" aria-selected="false" key={item.id} href={item.href} onClick={() => setQuery("")}><span>{item.label}</span><small>{item.detail}</small></Link>)}</div> : normalized ? <small className={styles.searchEmpty}>Sin coincidencias</small> : null}
        </div>
        <nav aria-label="Ejecución RedVitalia">
          {EXECUTION_NAV.map((item) => (
            <Link prefetch={false} key={item.id} href={item.href} className={active === item.id ? styles.active : undefined} aria-current={active === item.id ? "page" : undefined}>
              <i>{item.icon}</i><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarStatus}>
          <span />
          <div><strong>Revisión humana obligatoria</strong><small>Nada se publica ni se envía a Ads desde aquí.</small></div>
        </div>
        <WorkspaceTransfer />
        <Link prefetch={false} className={styles.marketLink} href="/?vista=home">← Volver al estudio de mercado</Link>
      </aside>
      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          <Link prefetch={false} href="/?vista=home"><span>RV</span><strong>RedVitalia</strong></Link>
          <label>
            <span>Sección</span>
            <select defaultValue={EXECUTION_NAV.find((item) => item.id === active)?.href} onChange={(event) => window.location.assign(event.target.value)} aria-label="Navegación de ejecución">
              {EXECUTION_NAV.map((item) => <option key={item.id} value={item.href}>{item.label}</option>)}
            </select>
          </label>
        </header>
        {!immersive ? <div className={styles.mobileSearch}><label htmlFor="execution-mobile-search">Buscar en ejecución</label><input id="execution-mobile-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sistema, campaña o creatividad" />{results.length ? <div>{results.map((item) => <Link prefetch={false} key={item.id} href={item.href} onClick={() => setQuery("")}><span>{item.label}</span><small>{item.detail}</small></Link>)}</div> : null}</div> : null}
        {!immersive ? <header className={`${styles.pageHead} ${compact ? styles.pageHeadCompact : ""}`}>
          <div><nav className={styles.breadcrumbs} aria-label="Migas de pan"><Link prefetch={false} href="/?vista=home">Mercado</Link><span>/</span><Link prefetch={false} href="/sistemas">Ejecución</Link><span>/</span><b>{EXECUTION_NAV.find((item) => item.id === active)?.label}</b></nav><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
          {actions ? <div className={styles.pageActions}>{actions}</div> : null}
        </header> : null}
        <main id="execution-content" className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
