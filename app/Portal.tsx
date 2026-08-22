"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";

type Media = { file:string; type:string; bytes:number; order:number };
type Price = { currency:string|null; amount:number|null; eur:number|null; label:string };
type Company = {
  id:string; name:string; title:string; domain:string; website:string; country:string; primaryCountry:string; countries:string[]; market:string; markets:string[];
  scope:string; agencyType:string; offer:string; priceLocal:string; priceStatus:string; price:Price; ticket:string;
  contract:string; guarantee:string; channels:string[]; metaStatus:string; metaAds:number; googleStatus:string; googleAds:number;
  creativeArchive:number; score:number; threat:string; relation:string; decision:string; evidence:string; proof:string; team:string;
  cta:string; funnel:string; niche:string; legal:string; review:string; reviewedAt:string|null; sources:string[]; body:string;
  media:Media[]; mediaDeclared:number;
};
type Country = { name:string; count:number; topScore:number; withPublicPrice:number; withMedia:number };
type Summary = { companies:number; countries:number; media:number; mediaFailed:number; withMedia:number; publicPrices:number; priceCoveragePercent:number; sources:number; categories:{name:string;count:number}[]; completion:{status:string;recordsInProgress:number;residualPending:number;motherlessRecords:number;criticalEmptyUnexplained:number;orphanMedia:number;availableEvidencePlaced:number;unavailableEvidenceDocumented:number;recordsWithoutPublicSource:number;specialMarketRecords:number}; fx:{date:string;source:string;disclaimer:string} };
type Editorial = { blueprint:{title:string;body:string}; report:{title:string;body:string}; execution:{title:string;body:string} };
type View = "home"|"companies"|"countries"|"ads"|"compare"|"blueprint"|"audit";

const nav:{id:View;label:string;icon:string}[]=[
  {id:"home",label:"Resumen",icon:"⌂"},{id:"companies",label:"Empresas",icon:"◎"},{id:"countries",label:"Países",icon:"◈"},
  {id:"ads",label:"Galerías",icon:"▣"},{id:"compare",label:"Comparador",icon:"⇄"},{id:"blueprint",label:"Blueprint",icon:"✦"},
  {id:"audit",label:"Auditoría",icon:"✓"}
];
const scopeShort:Record<string,string>={
  "Núcleo — agencia/leadgen":"Agencia / leadgen","Vertical — broker/marketplace":"Broker / marketplace",
  "Adyacente — BPO/infraestructura":"BPO / infraestructura","Excluir — fuente/no negocio":"Fuera del núcleo"
};
const fmt=(n:number)=>new Intl.NumberFormat("es-ES").format(n);
const strip=(s:string)=>s.replace(/[*_#]/g,"").replace(/<[^>]+>/g,"").trim();
const short=(s:string,n=170)=>s.length>n?s.slice(0,n).replace(/\s+\S*$/,"")+"…":s;

function RichText({text}:{text:string}) {
  const lines=text.split("\n").map(x=>x.trim()).filter(Boolean);
  return <div className="rich-text">{lines.map((line,i)=>{
    const clean=strip(line); if(!clean) return null;
    if(line.startsWith("### ")) return <h4 key={i}>{clean}</h4>;
    if(line.startsWith("## ")) return <h3 key={i}>{clean}</h3>;
    if(line.startsWith("# ")) return <h2 key={i}>{clean}</h2>;
    if(/^[-*] /.test(line)) return <p className="bullet" key={i}>{clean}</p>;
    if(/^\d+\. /.test(line)) return <p className="numbered" key={i}>{clean}</p>;
    if(/^---+$/.test(line)||/^<(?:table|tr|td)/.test(line)) return null;
    return <p key={i}>{clean}</p>;
  })}</div>;
}

function SourcesList({sources}:{sources:string[]}) {
  if(!sources.length) return <p>No hay una URL pública independiente conservada.</p>;
  const first=sources.slice(0,12),rest=sources.slice(12);
  const links=(items:string[],offset=0)=><div className="source-links">{items.map((source,index)=><a href={source} target="_blank" rel="noreferrer" key={source}>Fuente {offset+index+1} ↗</a>)}</div>;
  return <>{links(first)}{rest.length>0&&<details className="more-sources"><summary>Ver las {rest.length} fuentes adicionales</summary>{links(rest,12)}</details>}</>;
}

function MediaTile({item,name,onOpen}:{item:Media;name:string;onOpen:()=>void}) {
  if(item.type.includes("video")||/\.(mp4|webm|mov)$/i.test(item.file)) return <button className="media-tile" onClick={onOpen} aria-label={"Abrir vídeo de "+name}><video src={item.file} muted preload="metadata"/><span className="play">▶</span></button>;
  if(item.type.includes("pdf")||/\.pdf$/i.test(item.file)) return <a className="media-tile document" href={item.file} target="_blank" rel="noreferrer"><b>PDF</b><span>Abrir documento</span></a>;
  return <button className="media-tile" onClick={onOpen} aria-label={"Ampliar material de "+name}><img src={item.file} alt={"Material de "+name} loading="lazy"/></button>;
}

function MediaRail({company,onOpen}:{company:Company;onOpen:(m:Media,c:Company)=>void}) {
  const rail=useRef<HTMLDivElement>(null);
  return <article className="rail-card"><div className="rail-head"><div><span>{company.primaryCountry}</span><h3>{company.name}</h3></div><div className="rail-tools"><b>{company.media.length} materiales</b><button onClick={()=>rail.current?.scrollBy({left:-640,behavior:"smooth"})} aria-label="Anterior">←</button><button onClick={()=>rail.current?.scrollBy({left:640,behavior:"smooth"})} aria-label="Siguiente">→</button></div></div><div className="media-rail" ref={rail}>{company.media.map(m=><MediaTile key={m.file} item={m} name={company.name} onOpen={()=>onOpen(m,company)}/>)}</div></article>;
}

function CompanyCard({c,onOpen,onCompare,selected}:{c:Company;onOpen:()=>void;onCompare:()=>void;selected:boolean}) {
  const scoreClass=c.score>=85?"high":c.score>=60?"mid":"low";
  return <article className="company-card"><div className="card-top"><span className="company-logo">{c.name.slice(0,2).toUpperCase()}</span><span className={"score score-"+scoreClass}>{c.score}/100</span></div><p className="country-label">{c.primaryCountry}</p><h3>{c.name}</h3><span className="pill">{scopeShort[c.scope]||c.scope}</span><p className="offer">{short(c.offer||c.relation||"Oferta no documentada.")}</p><div className="price-box"><small>PRECIO LOCAL</small><strong>{short(c.priceLocal||"No publicado",75)}</strong><span>{c.price.eur!=null?"≈ "+c.price.label:c.price.label}</span></div><div className="card-meta"><span>{c.media.length?"▣ "+c.media.length:"Sin galería"}</span><span>{c.evidence}</span></div><div className="card-buttons"><button onClick={onOpen}>Abrir ficha</button><button className={selected?"compare-on":""} onClick={onCompare} aria-label={selected?"Quitar del comparador":"Añadir al comparador"}>{selected?"✓":"⇄"}</button></div></article>;
}

export default function Portal(){
  const [companies,setCompanies]=useState<Company[]>([]),[countries,setCountries]=useState<Country[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null),[editorial,setEditorial]=useState<Editorial|null>(null);
  const [view,setView]=useState<View>("home"),[query,setQuery]=useState(""),[scope,setScope]=useState("Todos"),[country,setCountry]=useState("Todos");
  const [priceOnly,setPriceOnly]=useState(false),[channel,setChannel]=useState("Todos"),[visible,setVisible]=useState(24);
  const [active,setActive]=useState<Company|null>(null),[lightbox,setLightbox]=useState<{media:Media;company:Company}|null>(null);
  const [compare,setCompare]=useState<string[]>([]),[galleryLimit,setGalleryLimit]=useState(8),[editorialTab,setEditorialTab]=useState<keyof Editorial>("blueprint");
  const [loading,setLoading]=useState(true),[error,setError]=useState("");

  useEffect(()=>{Promise.all([
    fetch("/data/companies.json").then(r=>r.json()),fetch("/data/countries.json").then(r=>r.json()),
    fetch("/data/summary.json").then(r=>r.json()),fetch("/data/editorial.json").then(r=>r.json())
  ]).then(([c,co,s,e])=>{setCompanies(c);setCountries(co);setSummary(s);setEditorial(e);setCompare(c.slice(0,3).map((x:Company)=>x.id));setLoading(false)}).catch(()=>{setError("No se pudo cargar la instantánea del radar.");setLoading(false)})},[]);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==="Escape"){setActive(null);setLightbox(null)}};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn)},[]);

  const scopes=useMemo(()=>["Todos",...new Set(companies.map(x=>x.scope))],[companies]);
  const channels=useMemo(()=>["Todos",...new Set(companies.flatMap(x=>x.channels))].sort(),[companies]);
  const countryOptions=useMemo(()=>{
    const canonical=countries.map(x=>({name:x.name,count:x.count}));
    const special=[...new Set(companies.filter(x=>!x.countries.length).map(x=>x.primaryCountry))]
      .map(name=>({name,count:companies.filter(x=>!x.countries.length&&x.primaryCountry===name).length}))
      .sort((a,b)=>a.name.localeCompare(b.name,"es"));
    return [...canonical,...special];
  },[companies,countries]);
  const filtered=useMemo(()=>companies.filter(c=>{const q=query.toLocaleLowerCase("es");return (!q||[c.name,c.primaryCountry,...c.countries,c.market,c.agencyType,c.offer,c.priceLocal,c.niche,...c.channels].join(" ").toLocaleLowerCase("es").includes(q))&&(scope==="Todos"||c.scope===scope)&&(country==="Todos"||c.countries.includes(country)||(!c.countries.length&&c.primaryCountry===country))&&(!priceOnly||c.price.eur!=null)&&(channel==="Todos"||c.channels.includes(channel))}),[companies,query,scope,country,priceOnly,channel]);
  const galleries=useMemo(()=>companies.filter(x=>x.media.length).sort((a,b)=>b.media.length-a.media.length),[companies]);
  const compared=compare.map(id=>companies.find(x=>x.id===id)).filter(Boolean) as Company[];
  const top=companies.slice(0,4);
  const go=(v:View)=>{setView(v);window.scrollTo({top:0,behavior:"smooth"})};
  const chooseCountry=(name:string)=>{setCountry(name);setView("companies");setVisible(24);window.scrollTo({top:0,behavior:"smooth"})};
  const toggleCompare=(id:string)=>setCompare(x=>x.includes(id)?x.filter(y=>y!==id):x.length<4?[...x,id]:x);

  if(loading) return <main className="loading-screen"><div className="brandmark">RV</div><h1>Preparando el radar mundial</h1><p>Cargando fichas, países, precios y galerías…</p></main>;
  if(error||!summary) return <main className="loading-screen"><h1>No se pudo abrir el portal</h1><p>{error}</p></main>;

  return <main className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={()=>go("home")}><span className="brandmark">RV</span><span><strong>RedVitalia</strong><small>Radar mundial de captación</small></span></button><nav aria-label="Navegación principal">{nav.map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>go(n.id)}><i>{n.icon}</i><span>{n.label}</span>{n.id==="companies"&&<b>712</b>}{n.id==="countries"&&<b>195</b>}{n.id==="ads"&&<b>{fmt(summary.media)}</b>}</button>)}</nav><div className="side-status"><span className="dot"/><div><strong>Instantánea verificada</strong><small>22 agosto 2026</small></div></div></aside>
    <section className="main"><header className="topbar"><div className="global-search"><span>⌕</span><input value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value&&view==="home")setView("companies")}} placeholder="Busca empresa, país, modelo, canal o precio…" aria-label="Buscar en todo el radar"/>{query&&<button onClick={()=>setQuery("")} aria-label="Borrar búsqueda">×</button>}</div><div className="data-date">CORTE · 22 AGO 2026</div><span className="avatar">RV</span></header>

      {view==="home"&&<div className="view"><section className="hero"><div><p className="eyebrow">INTELIGENCIA COMPETITIVA · REDVITALIA</p><h1>Todo el mercado de captación,<br/><em>por fin legible.</em></h1><p>Empresas, ofertas, precios, anuncios y patrones mundiales en una única sala de mando diseñada para decidir y ejecutar.</p><div className="hero-buttons"><button onClick={()=>go("companies")}>Explorar las 712 empresas</button><button className="secondary" onClick={()=>go("blueprint")}>Abrir Blueprint</button></div></div><div className="hero-orbit"><span>195</span><strong>países auditados</strong><small>Una sola fuente canónica</small></div></section><section className="stat-grid"><article><span>EMPRESAS CANÓNICAS</span><strong>{fmt(summary.companies)}</strong><small>Fichas madre completas</small></article><article><span>MATERIALES LOCALES</span><strong>{fmt(summary.media)}</strong><small>Imágenes, vídeo y documentos</small></article><article><span>FUENTES PÚBLICAS</span><strong>{fmt(summary.sources)}</strong><small>Sin enlaces privados</small></article><article><span>PRECIOS CONVERTIBLES</span><strong>{fmt(summary.publicPrices)}</strong><small>{summary.priceCoveragePercent}% del universo</small></article></section><section className="content-section"><div className="section-head"><div><p className="eyebrow">REFERENTES PRIORITARIOS</p><h2>Los modelos con mayor valor estratégico</h2></div><button className="link-button" onClick={()=>go("companies")}>Ver todos →</button></div><div className="company-grid home-grid">{top.map(c=><CompanyCard key={c.id} c={c} onOpen={()=>setActive(c)} onCompare={()=>toggleCompare(c.id)} selected={compare.includes(c.id)}/>)}</div></section><section className="decision-strip"><div><p className="eyebrow">DE LA INVESTIGACIÓN A LA ACCIÓN</p><h2>Tres formas de utilizar el portal</h2></div><button onClick={()=>go("countries")}><b>01</b><span><strong>Explorar mercados</strong><small>195 países con presencia y huecos</small></span>→</button><button onClick={()=>go("compare")}><b>02</b><span><strong>Comparar modelos</strong><small>Oferta, precio, contrato y garantía</small></span>→</button><button onClick={()=>go("blueprint")}><b>03</b><span><strong>Decidir qué aplicar</strong><small>Blueprint y sistema operativo</small></span>→</button></section></div>}

      {view==="companies"&&<div className="view"><section className="page-head"><p className="eyebrow">BASE EMPRESARIAL</p><h1>712 fichas madre, sin ruido</h1><p>Cada tarjeta abre la evidencia completa, las fuentes públicas y la galería local de la empresa.</p></section><section className="filterbar"><label>Modelo<select value={scope} onChange={e=>{setScope(e.target.value);setVisible(24)}}>{scopes.map(x=><option key={x}>{x}</option>)}</select></label><label>País / mercado<select value={country} onChange={e=>{setCountry(e.target.value);setVisible(24)}}><option>Todos</option>{countryOptions.map(x=><option key={x.name} value={x.name}>{x.name} · {x.count}</option>)}</select></label><label>Canal<select value={channel} onChange={e=>{setChannel(e.target.value);setVisible(24)}}>{channels.map(x=><option key={x}>{x}</option>)}</select></label><label className="check"><input type="checkbox" checked={priceOnly} onChange={e=>setPriceOnly(e.target.checked)}/> Solo precio convertible</label><button onClick={()=>{setScope("Todos");setCountry("Todos");setChannel("Todos");setPriceOnly(false);setQuery("")}}>Limpiar</button></section><div className="result-line"><strong>{fmt(filtered.length)} resultados</strong><span>Ordenados por puntuación estratégica</span></div><section className="company-grid">{filtered.slice(0,visible).map(c=><CompanyCard key={c.id} c={c} onOpen={()=>setActive(c)} onCompare={()=>toggleCompare(c.id)} selected={compare.includes(c.id)}/>)}</section>{visible<filtered.length&&<button className="load-more" onClick={()=>setVisible(x=>x+24)}>Mostrar 24 más</button>}</div>}

      {view==="countries"&&<div className="view"><section className="page-head"><p className="eyebrow">MATRIZ MUNDIAL</p><h1>195 países, con presencia y huecos</h1><p>Los países sin empresa comparable también aparecen: un cero es una conclusión de cobertura, no un olvido.</p></section><div className="country-summary"><article><strong>{countries.filter(x=>x.count).length}</strong><span>con actores vinculados</span></article><article><strong>{countries.filter(x=>!x.count).length}</strong><span>sin actor vinculable</span></article><article><strong>195</strong><span>Estados auditados</span></article></div><section className="country-grid">{countries.map(c=><button key={c.name} className={c.count?"has-data":"empty"} onClick={()=>c.count&&chooseCountry(c.name)} disabled={!c.count}><span>{c.name}</span><strong>{c.count}</strong><small>{c.count?c.withPublicPrice+" con precio · "+c.withMedia+" con galería":"Sin actor empresarial vinculado"}</small></button>)}</section><p className="source-note">Marco territorial: 193 Estados miembros de Naciones Unidas más la Santa Sede y el Estado de Palestina. Una empresa puede operar en varios mercados; los recuentos territoriales no deben sumarse como empresas únicas.</p></div>}

      {view==="ads"&&<div className="view"><section className="page-head"><p className="eyebrow">ARCHIVO VISUAL</p><h1>Galerías que sí se pueden recorrer</h1><p>{fmt(summary.media)} archivos copiados localmente, organizados por ficha madre. Desliza, usa las flechas o abre cualquier pieza a pantalla completa.</p></section><div className="gallery-stats"><span><b>{fmt(summary.withMedia)}</b> empresas con galería</span><span><b>{fmt(summary.media)}</b> archivos disponibles</span><span><b>{summary.mediaFailed}</b> URLs no recuperables</span></div><section className="rails">{galleries.slice(0,galleryLimit).map(c=><MediaRail key={c.id} company={c} onOpen={(m,company)=>setLightbox({media:m,company})}/>)}</section>{galleryLimit<galleries.length&&<button className="load-more" onClick={()=>setGalleryLimit(x=>x+8)}>Mostrar 8 galerías más</button>}<div className="limitation"><strong>Qué significa “no recuperable”</strong><p>La URL pública original responde 403/404 o dejó de servir el archivo. Se conserva la limitación en la auditoría; no se sustituye por una imagen inventada.</p></div></div>}

      {view==="compare"&&<div className="view"><section className="page-head"><p className="eyebrow">COMPARADOR</p><h1>Decide con las diferencias a la vista</h1><p>Selecciona hasta cuatro empresas desde sus tarjetas. Ya hemos cargado tres referentes para empezar.</p></section><div className="compare-picker">{companies.slice(0,40).map(c=><button key={c.id} className={compare.includes(c.id)?"selected":""} onClick={()=>toggleCompare(c.id)}>{compare.includes(c.id)?"✓ ":""}{c.name}</button>)}</div>{compared.length?<div className="compare-table"><div className="compare-row header"><b>Dimensión</b>{compared.map(c=><strong key={c.id}>{c.name}<button onClick={()=>toggleCompare(c.id)}>×</button></strong>)}</div>{[
        ["País",(c:Company)=>c.countries.join(", ")||c.primaryCountry],["Modelo",(c:Company)=>c.agencyType],["Puntuación",(c:Company)=>c.score+"/100"],["Oferta",(c:Company)=>c.offer||"No documentada"],["Precio local",(c:Company)=>c.priceLocal||"No publicado"],["Equivalencia EUR",(c:Company)=>c.price.eur!=null?"≈ "+c.price.label:c.price.label],["Contrato",(c:Company)=>c.contract||"No publicado"],["Garantía",(c:Company)=>c.guarantee||"No publicada"],["Canales",(c:Company)=>c.channels.join(", ")||"No documentados"],["Decisión RV",(c:Company)=>c.decision],["Evidencia",(c:Company)=>c.evidence]
      ].map(item=><div className="compare-row" key={item[0] as string}><b>{item[0] as string}</b>{compared.map(c=><span key={c.id}>{(item[1] as (c:Company)=>string)(c)}</span>)}</div>)}</div>:<div className="empty-state">Añade empresas al comparador desde la base.</div>}</div>}

      {view==="blueprint"&&editorial&&<div className="view editorial-view"><section className="page-head"><p className="eyebrow">CONCLUSIONES Y EJECUCIÓN</p><h1>Del radar al negocio definitivo</h1><p>La síntesis estratégica completa, separada de la base para que el equipo pueda decidir sin atravesar miles de registros.</p></section><div className="editorial-tabs"><button className={editorialTab==="blueprint"?"active":""} onClick={()=>setEditorialTab("blueprint")}>Blueprint</button><button className={editorialTab==="execution"?"active":""} onClick={()=>setEditorialTab("execution")}>Sistema operativo</button><button className={editorialTab==="report"?"active":""} onClick={()=>setEditorialTab("report")}>Informe estratégico</button></div><article className="editorial-paper"><div className="paper-title"><span>REDVITALIA · 22/08/2026</span><h2>{editorial[editorialTab].title}</h2></div><RichText text={editorial[editorialTab].body}/></article></div>}

      {view==="audit"&&<div className="view"><section className="page-head"><p className="eyebrow">METODOLOGÍA Y CONTROL</p><h1>Qué contiene, qué demuestra y qué limita</h1><p>Una auditoría útil distingue ausencia de evidencia, precio oculto, estimación, declaración propia y dato confirmado.</p></section><section className="audit-grid"><article><span>COBERTURA</span><strong>712 / 195</strong><p>Empresas canónicas y Estados auditados.</p></article><article><span>MEDIOS</span><strong>{fmt(summary.media)} / {fmt(summary.media+summary.mediaFailed)}</strong><p>Recuperados frente a URLs localizadas.</p></article><article><span>PRECIOS</span><strong>{summary.publicPrices}</strong><p>Con importe y moneda convertibles.</p></article><article><span>FUENTES</span><strong>{fmt(summary.sources)}</strong><p>URLs públicas únicas conservadas.</p></article></section><section className="method-columns"><article><h2>Reglas de evidencia</h2><ul><li><b>Confirmado:</b> fuente oficial o registro contrastable.</li><li><b>Probable:</b> varias señales, pero falta una prueba primaria.</li><li><b>Estimado:</b> inferencia señalada; nunca se presenta como tarifa.</li><li><b>No publicado:</b> no se inventa una cifra.</li><li><b>No recuperable:</b> el origen dejó de servir el archivo.</li></ul></article><article><h2>Precios y monedas</h2><ul><li>Se conserva el texto local original.</li><li>Solo se convierte cuando moneda e importe son inequívocos.</li><li>Instantánea FX: {summary.fx.date}.</li><li>Las tasas son orientativas, no contractuales.</li><li>Fee e inversión publicitaria se separan cuando es posible.</li></ul></article><article><h2>Privacidad y estructura</h2><ul><li>Una única base conceptual: empresas y evidencias.</li><li>“Radar” es el estudio; “Universo activo” era una etiqueta histórica.</li><li>No se publican enlaces internos ni privados.</li><li>Los medios viven en la ficha correspondiente.</li><li>Las fuentes externas se abren desde la ficha.</li></ul></article></section><div className="audit-banner"><strong>Limitaciones documentadas</strong><p>Instantánea a 22/08/2026. Precios, campañas, equipos y condiciones pueden cambiar. Cinco archivos públicos no pudieron recuperarse porque el servidor de origen los rechaza o ya no existen. Las métricas comerciales de terceros se identifican como autodeclaradas cuando no existe auditoría independiente.</p></div></div>}
      {view==="audit"&&<section className="completion-panel"><div className="completion-mark">✓</div><div><p className="eyebrow">CRITERIOS DE CIERRE</p><h2>{summary.completion.status}</h2><p>La auditoría canónica no conserva trabajo abierto ni evidencia disponible fuera de su ficha madre.</p></div><div className="completion-kpis"><span><b>{summary.completion.recordsInProgress}</b> En curso</span><span><b>{summary.completion.residualPending}</b> pendientes</span><span><b>{summary.completion.motherlessRecords}</b> sin madre</span><span><b>{summary.completion.criticalEmptyUnexplained}</b> críticos vacíos</span><span><b>{summary.completion.orphanMedia}</b> medios huérfanos</span><span><b>{summary.completion.recordsWithoutPublicSource}</b> sin fuente pública</span></div></section>}
    </section>

    {active&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setActive(null)}><article className="detail-modal" role="dialog" aria-modal="true" aria-label={"Ficha de "+active.name}><button className="modal-close" onClick={()=>setActive(null)} aria-label="Cerrar">×</button><header><div><p>{active.countries.join(", ")||active.primaryCountry} · {scopeShort[active.scope]||active.scope}</p><h2>{active.name}</h2><div className="modal-tags"><span>{active.score}/100</span><span>{active.evidence}</span><span>{active.review}</span></div></div>{active.website&&<a href={active.website} target="_blank" rel="noreferrer">Abrir web oficial ↗</a>}</header><div className="detail-grid"><section><h3>Oferta y público</h3><p>{active.offer||"No documentado."}</p><h4>Nicho</h4><p>{active.niche||"No documentado."}</p><h4>CTA</h4><p>{active.cta||"No documentado."}</p></section><section className="price-panel"><small>PRECIO LOCAL</small><strong>{active.priceLocal||"No publicado"}</strong><small>EQUIVALENCIA ORIENTATIVA</small><b>{active.price.eur!=null?"≈ "+active.price.label:active.price.label}</b><p>{active.priceStatus}</p></section><section><h3>Contrato y garantía</h3><h4>Permanencia</h4><p>{active.contract||"No publicada."}</p><h4>Riesgo invertido</h4><p>{active.guarantee||"No publicado."}</p></section><section><h3>Lectura RedVitalia</h3><p><b>{active.decision}</b> · {active.relation||"Sin decisión documentada."}</p><h4>Canales</h4><div className="modal-tags">{active.channels.map(x=><span key={x}>{x}</span>)}</div></section></div>{active.media.length>0&&<section className="detail-gallery"><div className="section-head"><div><p className="eyebrow">GALERÍA LOCAL</p><h3>{active.media.length} materiales</h3></div></div><div className="media-rail">{active.media.map(m=><MediaTile key={m.file} item={m} name={active.name} onOpen={()=>setLightbox({media:m,company:active})}/>)}</div></section>}<section className="detail-text"><h3>Análisis completo</h3><RichText text={active.body}/></section><section className="sources"><h3>Fuentes públicas</h3><SourcesList sources={active.sources}/></section></article></div>}
    {lightbox&&<div className="lightbox" role="dialog" aria-modal="true"><button aria-label="Cerrar" onClick={()=>setLightbox(null)}>×</button><div>{lightbox.media.type.includes("video")||/\.(mp4|webm|mov)$/i.test(lightbox.media.file)?<video src={lightbox.media.file} controls autoPlay><track kind="captions" src="/empty.vtt" srcLang="es" label="Sin subtítulos disponibles"/></video>:<img src={lightbox.media.file} alt={"Material ampliado de "+lightbox.company.name}/>}<p>{lightbox.company.name} · material {lightbox.media.order} de {lightbox.company.media.length}</p></div></div>}
  </main>;
}
