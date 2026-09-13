"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { chapters, evidence, profiles, scripts, sourceNotes } from './legal-acquisition-content';
import { buildDossier, clientEconomics, contextLabels, defaultContext, fillText, matchingScripts, pendingFields, prospectCsv, readSavedContext, readSavedProgress, type EconomicsInput, type LegalContext } from './legal-acquisition-model';
import styles from './LegalAcquisition.module.css';

type Page = 'ruta' | 'biblioteca' | 'evidencia' | 'numeros';
const storageKey = 'redvitalia.abogados.v1';
const money = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
function download(name: string, content: string, mime = 'text/markdown;charset=utf-8') {
 const url = URL.createObjectURL(new Blob([content], {type: mime}));
 const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function CopyCard({ item, context }: { item: (typeof scripts)[number]; context: LegalContext }) {
 const [status, setStatus] = useState('');
 const area = useRef<HTMLTextAreaElement>(null);
 const value = fillText(item.text, context);
 const count = pendingFields(value).length;
 async function copy() {
  try { await navigator.clipboard.writeText(value); setStatus('Copiado'); }
  catch { area.current?.focus(); area.current?.select(); setStatus('Texto seleccionado. Usa Ctrl+C para copiar.'); }
 }
 return <article className={styles.copyCard}>
  <div className={styles.cardTop}><span className={styles.tag}>{item.kind}</span><button onClick={copy} aria-label={`Copiar ${item.title}`}>Copiar texto</button></div>
  <h3>{item.title}</h3><p className={styles.hint}>{item.when}</p>
  <textarea ref={area} aria-label={`Texto de ${item.title}`} value={value} readOnly rows={Math.min(17, Math.max(6, value.split('\n').length))} spellCheck={false}/>
  <div className={styles.cardBottom}><small>{count ? `${count} indicaciones o datos entre corchetes: revisa y completa antes de usar.` : 'Texto personalizado: revisa nombres y contexto antes de usar.'}</small><span role="status">{status}</span></div>
 </article>;
}

export default function LegalAcquisition({onOpenCompany}: {onOpenCompany: (id: string) => void}) {
 const [context, setContext] = useState<LegalContext>(defaultContext);
 const [complete, setComplete] = useState<string[]>([]);
 const [loaded, setLoaded] = useState(false);
 const [saved, setSaved] = useState('');
 const working = useRef<{context: LegalContext; complete: string[]}>({context:defaultContext,complete:[]});
 const [page, setPage] = useState<Page>('ruta');
 const [active, setActive] = useState(chapters[0].id);
 const [query, setQuery] = useState('');
 const [chapterFilter, setChapterFilter] = useState('');
 const [economics, setEconomics] = useState<EconomicsInput>({ticket:2500, margin:40, close:20, media:1200, setup:300, tools:100, share:50});
 const chapterRef = useRef<HTMLElement>(null);
 function openChapter(id: string) {
  setActive(id);
  requestAnimationFrame(()=>chapterRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
 }
 useEffect(() => {
  let data: {context?: unknown; complete?: unknown} = {};
  try { data = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* Datos antiguos o almacenamiento no disponible. */ }
  working.current = {context:readSavedContext(data.context),complete:readSavedProgress(data.complete)};
  // Restore external browser storage once after hydration; server and first client render stay equal.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setContext(readSavedContext(data.context)); setComplete(readSavedProgress(data.complete)); setLoaded(true);
 }, []);
 function persist(nextContext: LegalContext, nextComplete: string[]) {
  try { localStorage.setItem(storageKey, JSON.stringify({context:nextContext, complete:nextComplete})); setSaved('Guardado en este navegador'); }
  catch { setSaved('No se pudo guardar aquí. Descarga el manual para conservarlo.'); }
 }
 function update(key: keyof LegalContext, value: string) { const next = readSavedContext({...working.current.context,[key]:value}); working.current.context=next; setContext(next); if(loaded)persist(next,working.current.complete); }
 function toggle(id: string) { const current=working.current.complete; const next = current.includes(id) ? current.filter(x=>x!==id) : [...current,id]; working.current.complete=next; setComplete(next); persist(working.current.context,next); }
 function resetContext() { working.current.context=defaultContext; setContext(defaultContext); persist(defaultContext,working.current.complete); }
 const profile = profiles.find(p=>p.id===context.profile) ?? profiles[0];
 const chapter = chapters.find(c=>c.id===active) ?? chapters[0];
 const selectedScripts = matchingScripts(query, chapterFilter);
 const calculation = clientEconomics(economics);
 return <div className={styles.shell}>
  <header className={styles.hero}>
   <div><span className={styles.eyebrow}>REDVITALIA / PLAN COMERCIAL · ESPAÑA</span><h1>El próximo cliente:<br/><em>un despacho de abogados.</em></h1><p>Una ruta para encontrarlo, abrir conversación, presentar la propuesta y poner el servicio en marcha. Con cada texto a mano.</p>
    <div className={styles.heroActions}><button onClick={()=>{setPage('ruta');openChapter('llamadas');}}>Ir al guion de llamada ↗</button><button className={styles.secondary} onClick={()=>download('RedVitalia-abogados-manual.md',buildDossier(context))}>Descargar manual completo ↓</button></div>
   </div><aside className={styles.heroAside}><span>EMPEZAMOS POR</span><strong>{profile.name}</strong><p>Un servicio y una zona para validar la oferta.</p><div><b>{scripts.length}</b><span>textos utilizables</span></div><div><b>12</b><span>pasos de trabajo</span></div><div><b>2</b><span>creativos originales</span></div></aside>
  </header>
  <section className={styles.config} aria-label="Personalizar el material">
   <div className={styles.configTop}><div><h2>Adáptalo a tu próxima conversación</h2><p>Completa los datos conocidos. Lo pendiente queda señalado entre corchetes.</p></div><span role="status">{saved || 'Datos y avance se guardan solo en este navegador'}</span></div>
   <div className={styles.fields}><label>Especialidad<select value={context.profile} onChange={e=>update('profile',e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   {(['zona','despacho','nombre','asesor','contacto'] as const).map(key=><label key={key}>{contextLabels[key]}<input value={context[key]} onChange={e=>update(key,e.target.value)} placeholder={key==='zona'?'Ej.: Valencia':contextLabels[key]} maxLength={350}/></label>)}</div>
   <details className={styles.extraFields}><summary>Observación de la web, enlaces y fecha de reunión</summary><div className={styles.fields}>
    <label className={styles.wide}>{contextLabels.observacion}<textarea rows={2} value={context.observacion} onChange={e=>update('observacion',e.target.value)} placeholder="Describe únicamente lo que has comprobado. No introduzcas datos de expedientes." maxLength={1500}/></label>
    {(['enlaceDiagnostico','cita','enlaceReunion'] as const).map(key=><label key={key}>{contextLabels[key]}<input value={context[key]} onChange={e=>update(key,e.target.value)} maxLength={350}/></label>)}</div>
    <button className={styles.textButton} onClick={resetContext}>Restablecer los datos de personalización</button>
   </details>
  </section>
  <nav className={styles.tabs} aria-label="Herramientas para captar abogados">{([['ruta','Ruta de trabajo'],['biblioteca',`Biblioteca · ${scripts.length} textos`],['evidencia','Qué tomamos del panel'],['numeros','Costes y medición']] as [Page,string][]).map(([id,label])=><button key={id} onClick={()=>setPage(id)} aria-current={page===id?'page':undefined}>{label}</button>)}</nav>
  <section className={styles.landingLinks} aria-label="Landings en HTML"><div><span className={styles.tag}>4 LANDINGS HTML · 8 IMÁGENES ORIGINALES</span><h2>Todo el recorrido, también en páginas.</h2><p>RedVitalia con contacto por WhatsApp. Tres modelos para los futuros clientes del despacho.</p></div><div><a href="/abogados/index.html" target="_blank" rel="noreferrer">Explorar las landings ↗</a><a href="/abogados/RedVitalia-abogados-kit.zip" download>Descargar kit HTML ↓</a></div></section>
  {page==='ruta' && <div className={styles.workspace}><aside className={styles.steps}><div className={styles.progress}><b>{complete.length}/12 pasos preparados</b><progress max={12} value={complete.length}/><small>Marcar un paso indica preparación, no clientes conseguidos.</small></div><nav aria-label="Pasos de captación">{chapters.map(c=><button key={c.id} onClick={()=>openChapter(c.id)} aria-current={active===c.id?'step':undefined}><span>{c.label}</span>{complete.includes(c.id)&&<b aria-label="Preparado">✓</b>}</button>)}</nav><button className={styles.downloadCsv} onClick={()=>download('RedVitalia-prospeccion-despachos.csv',prospectCsv,'text/csv;charset=utf-8')}>Descargar plantilla de contactos ↓</button></aside>
   <main ref={chapterRef} className={styles.content} aria-label={chapter.title}><div className={styles.chapterHeader}><span className={styles.eyebrow}>{chapter.label}</span><h2>{chapter.title}</h2><p>{chapter.intro}</p></div>
    {chapter.id==='estrategia'&&<div className={styles.profile}><span className={styles.tag}>{profile.priority}</span><h3>{profile.name}</h3><p>{profile.target}</p><p><strong>Necesidad:</strong> {profile.problem}</p><p><strong>Mensaje central:</strong> {profile.angle}</p></div>}
    <ol className={styles.actions}>{chapter.actions.map((a,i)=><li key={i}>{fillText(a,context)}</li>)}</ol>
    {chapter.id==='cliente-final'&&<div className={styles.profile}><h3>Filtro para {profile.name}</h3><ul>{profile.qualification.map(p=><li key={p}>{p}</li>)}</ul><h4>Criterios del mensaje</h4><ul>{profile.exclusions.map(p=><li key={p}>{p}</li>)}</ul><h4>Búsquedas iniciales para Google</h4><p>{profile.keywords.map(t=>t.replace('[zona]',context.zona||'[zona por definir]')).join(' · ')}</p></div>}
    {chapter.id==='creativos'&&<div className={styles.creatives}>{[{file:'creativo-seguimiento.png',title:'A · Cada consulta, un siguiente paso',alt:'Creativo RedVitalia con oficina ilustrativa y mensaje de seguimiento'},{file:'creativo-recorrido.png',title:'B · De la consulta al asunto',alt:'Creativo RedVitalia con tres pasos: consulta, cita y asunto'}].map(c=><figure key={c.file}><a href={`/abogados/${c.file}`} target="_blank" rel="noreferrer"><img src={`/abogados/${c.file}`} alt={c.alt} loading="lazy"/></a><figcaption><b>{c.title}</b><span>Imagen generada · ilustrativa</span><a href={`/abogados/${c.file}`} download>Descargar PNG ↓</a></figcaption></figure>)}</div>}
    <div className={styles.scriptList}>{scripts.filter(s=>s.chapter===chapter.id).map(item=><CopyCard key={item.id} item={item} context={context}/>)}</div>
    {chapter.id==='prospectos'&&<p className={styles.note}>La plantilla de contactos es un CSV vacío preparado para tu CRM u hoja de cálculo. Este apartado no incorpora una base de despachos ni verifica el permiso de contacto por ti.</p>}
    <label className={styles.check}><input type="checkbox" checked={complete.includes(chapter.id)} onChange={()=>toggle(chapter.id)}/><span><b>Marcar este paso como preparado</b>{chapter.done}</span></label>
    {chapters.indexOf(chapter)<chapters.length-1&&<button className={styles.next} onClick={()=>openChapter(chapters[chapters.indexOf(chapter)+1].id)}>Siguiente paso →</button>}
   </main></div>}
  {page==='biblioteca'&&<section className={styles.library}><h2>Los textos, listos para encontrar y copiar</h2><p>Copiar respeta la personalización de arriba. Revisa las indicaciones entre corchetes antes de usar el texto.</p><div className={styles.filters}><label>Buscar texto<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Prueba: correo, garantía, recepción…"/></label><label>Etapa<select value={chapterFilter} onChange={e=>setChapterFilter(e.target.value)}><option value="">Todas las etapas</option>{chapters.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label></div><p role="status">{selectedScripts.length} textos encontrados</p><div className={styles.scriptList}>{selectedScripts.map(item=><CopyCard key={item.id} item={item} context={context}/>)}</div>{!selectedScripts.length&&<p>Prueba otra palabra o selecciona todas las etapas.</p>}</section>}
  {page==='evidencia'&&<section className={styles.library}><h2>Los mecanismos que aprovechamos</h2><p>Observaciones del archivo y de páginas consultadas el 13 de septiembre de 2026. La aplicación a RedVitalia es una propuesta propia; las promesas de otros anunciantes no son resultados nuestros.</p><div className={styles.evidenceGrid}>{evidence.map(e=><article key={e.company} className={styles.evidence}><span className={styles.tag}>{e.status}</span><h3>{e.name}</h3><p>{e.observed}</p><h4>Aplicación en este apartado</h4><p>{e.apply}</p><p className={styles.note}>{e.limit}</p><div className={styles.links}><button onClick={()=>onOpenCompany(e.company)}>Abrir ficha del panel ↗</button><a href={e.url} target="_blank" rel="noreferrer">Web de origen ↗</a></div></article>)}</div><h3>Fuentes de precios y criterios de uso</h3><div className={styles.sources}>{sourceNotes.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a><span>{s.note}</span></p>)}</div></section>}
  {page==='numeros'&&<section className={styles.library}><h2>¿Qué tendría que pasar para que el piloto tenga sentido?</h2><p>Calculadora del <strong>despacho</strong>. Los valores iniciales son un ejemplo ficticio. Usa importes netos y añade impuestos no recuperables al coste cuando corresponda.</p><div className={styles.calculator}><div className={styles.fields}>{([['ticket','Honorario medio cobrado por asunto (€)'],['margin','Margen antes de captación (%)'],['close','Consultas válidas → asunto (%)'],['media','Medios del periodo (€)'],['setup','Preparación imputada al periodo (€)'],['tools','Herramientas y atención imputadas (€)'],['share','Parte del margen destinada a captar (%)']] as [keyof EconomicsInput,string][]).map(([key,label])=><label key={key}>{label}<input type="number" min={0} max={['margin','close','share'].includes(key)?100:undefined} step="any" value={Number.isNaN(economics[key])?'':economics[key]} onChange={e=>setEconomics({...economics,[key]:e.target.value===''?NaN:Number(e.target.value)})}/></label>)}</div><p className={styles.note}>Gestión Google Ads añadida al cálculo: 400 € netos. Factura de gestión: 484 € con IVA. Medios, preparación y herramientas se facturan aparte. La contribución no es el beneficio final del despacho.</p></div>{calculation?<><div className={styles.metrics}>{[[money(calculation.cost),'Coste neto total del periodo'],[String(calculation.breakEvenCases),'Asuntos para cubrir ese coste'],[money(calculation.maxCac),'Tope operativo por asunto'],[money(calculation.maxValidQuery),'Tope total por consulta válida']].map(([n,l])=><div key={l}><strong>{n}</strong><span>{l}</span></div>)}</div><p>Contribución por asunto: <b>{money(calculation.contribution)}</b>. El punto de equilibrio divide el coste total entre esa contribución y redondea hacia arriba. El tope operativo aplica el porcentaje que has elegido; no es un precio de mercado ni una previsión de demanda.</p><p>Tope por consulta válida = contribución × parte destinada a captar × conversión a asunto. Incluye el coste total de captación, no solo publicidad. Si no existe una tasa histórica, ensaya varios escenarios y valida en el piloto.</p></>:<p role="alert" className={styles.note}>Completa importes válidos y porcentajes mayores que 0 y hasta 100. No se calculan resultados con datos vacíos o imposibles.</p>}<div className={styles.scriptList}>{scripts.filter(s=>s.id==='metricas-b2b'||s.id==='prueba-ejemplo').map(item=><CopyCard key={item.id} item={item} context={context}/>)}</div></section>}
  <footer className={styles.footer}><span>Material de trabajo · Edición 13/09/2026</span><p>Las imágenes y ejemplos ilustran la propuesta. Los textos no envían mensajes, reservan reuniones ni activan campañas. Guarda cada oportunidad y su permiso en tu CRM; aquí se conserva únicamente la personalización y el avance local.</p><a href="/abogados/RedVitalia-abogados-manual.md" download>Manual base descargable</a></footer>
 </div>;
}
