"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./execution.module.css";

export const EXECUTION_NAV = [
  { id: "systems", href: "/sistemas", label: "Sistemas de captación", icon: "01" },
  { id: "campaigns", href: "/campanas", label: "Campañas", icon: "02" },
  { id: "creative", href: "/creativos", label: "Fábrica creativa", icon: "03" },
  { id: "library", href: "/biblioteca-creativa", label: "Biblioteca creativa", icon: "04" },
  { id: "economics", href: "/laboratorio", label: "Laboratorio económico", icon: "05" },
  { id: "experiments", href: "/experimentos", label: "Experimentos", icon: "06" },
  { id: "decisions", href: "/decisiones", label: "Decisiones", icon: "07" },
  { id: "learnings", href: "/aprendizajes", label: "Aprendizajes", icon: "08" },
] as const;

export type ExecutionSection = (typeof EXECUTION_NAV)[number]["id"];

export default function ExecutionShell({ active, eyebrow, title, description, actions, children }: {
  active: ExecutionSection;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#execution-content">Saltar al contenido</a>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/?vista=home" aria-label="Volver al mercado RedVitalia">
          <span>RV</span>
          <div><strong>RedVitalia</strong><small>INTELIGENCIA DE MERCADO</small></div>
        </Link>
        <p className={styles.groupLabel}>EJECUCIÓN REDVITALIA</p>
        <nav aria-label="Ejecución RedVitalia">
          {EXECUTION_NAV.map((item) => (
            <Link key={item.id} href={item.href} className={active === item.id ? styles.active : undefined} aria-current={active === item.id ? "page" : undefined}>
              <i>{item.icon}</i><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarStatus}>
          <span />
          <div><strong>Revisión humana obligatoria</strong><small>Nada se publica ni se envía a Ads desde aquí.</small></div>
        </div>
        <Link className={styles.marketLink} href="/?vista=home">← Volver al estudio de mercado</Link>
      </aside>
      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          <Link href="/?vista=home"><span>RV</span><strong>RedVitalia</strong></Link>
          <label>
            <span>Sección</span>
            <select defaultValue={EXECUTION_NAV.find((item) => item.id === active)?.href} onChange={(event) => window.location.assign(event.target.value)} aria-label="Navegación de ejecución">
              {EXECUTION_NAV.map((item) => <option key={item.id} value={item.href}>{item.label}</option>)}
            </select>
          </label>
        </header>
        <header className={styles.pageHead}>
          <div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
          {actions ? <div className={styles.pageActions}>{actions}</div> : null}
        </header>
        <main id="execution-content" className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
