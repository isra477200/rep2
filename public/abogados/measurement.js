(() => {
  'use strict';
  const cfg=window.REDVITALIA_CONFIG||{}, storageKey='redvitalia.analytics-consent.v2';
  const knownPages=['index','redvitalia','segunda-oportunidad','herencias','divorcios','manual','anuncios','medicion','privacidad'];
  const name=location.pathname.split('/').pop().replace(/\.html$/,'');
  const pageId=knownPages.includes(name)?name:'resource';
  const pageKind=pageId==='redvitalia'?'commercial':['segunda-oportunidad','herencias','divorcios'].includes(pageId)?'demo':'resource';
  const campaignParams=new URLSearchParams(location.search),campaignValue=campaignParams.get('utm_content')||'';
  const paidCampaign=campaignParams.get('utm_campaign')==='sistema_redvitalia_abogados';
  const sourceCampaign=paidCampaign&&campaignParams.get('utm_source')==='google'&&campaignParams.get('utm_medium')==='cpc'?'pmax_campaign':paidCampaign&&campaignParams.get('utm_source')==='meta'&&campaignParams.get('utm_medium')==='paid_social'?'meta_campaign':'direct';
  const campaign=/^e[1-5]_(feed|square|story|meta_(feed|square|story)|pmax_(wide|square|portrait))$/i.test(campaignValue)?campaignValue.toLowerCase():sourceCampaign;
  const allowed=['page_view','contact_widget_open','contact_channel_select','contact_form_start','generate_lead','contact_whatsapp_click','contact_phone_click','contact_submit_error','asset_download','diagnostic_complete'];
  window.dataLayer=window.dataLayer||[];
  let choice=null,loaded=false,pageSent=false;
  try {const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&Date.now()-saved.at<183*86400000&&typeof saved.value==='boolean')choice=saved.value;}catch{/* Storage can be unavailable; keep consent in memory. */}
  const active=/^GTM-[A-Z0-9]{4,}$/.test(cfg.gtmId||'');
  const api={pageId,pageKind,campaign,consent:choice===true,track};window.RedVitaliaMetrics=api;
  function track(event,values={}){
    if(!allowed.includes(event)||!api.consent)return;
    const event_data={page_id:pageId,page_kind:pageKind,campaign,contact_channel:['phone','whatsapp'].includes(values.contact_channel)?values.contact_channel:'none',asset_id:/^(e[1-5]_(feed|square|story|meta_(feed|square|story)|pmax_(wide|square|portrait))|html_kit|ads_kit|gtm_container|manual|other_resource)$/.test(values.asset_id||'')?values.asset_id:'none'};
    window.dataLayer.push({event:'rv_'+event,event_data});
  }
  function enable(){
    if(!active||!api.consent)return;
    if(!loaded){
      loaded=true;window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
      window.dataLayer.push({event:'rv_analytics_ready'});
      const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtm.js?id='+cfg.gtmId;document.head.appendChild(script);
    }
    if(!window.rvSendGA4&&pageSent)window.dataLayer.push({event:'rv_analytics_ready'});
    if(window.rvGA4Consent)window.rvGA4Consent(true);
    if(!pageSent){track('page_view');pageSent=true;}
  }
  function setChoice(value){
    api.consent=value;choice=value;
    try{localStorage.setItem(storageKey,JSON.stringify({value,at:Date.now()}));}catch{/* Storage can be unavailable; keep consent in memory. */}
    if(window.rvGA4Consent)window.rvGA4Consent(value);
    if(value)enable();
    else {document.cookie.split(';').forEach(raw=>{const cookieName=raw.split('=')[0].trim();if(/^_ga(?:_|$)/.test(cookieName)){document.cookie=cookieName+'=; Max-Age=0; path=/; SameSite=Lax';document.cookie=cookieName+'=; Max-Age=0; path=/; domain='+location.hostname+'; SameSite=Lax';}});}
    panel.hidden=true;
  }
  const panel=document.createElement('section');panel.className='rv-privacy-panel';panel.hidden=true;panel.setAttribute('aria-label','Preferencias de analítica');
  panel.innerHTML='<h2>¿Nos ayudas a mejorar la web?</h2><p>Podemos medir visitas y acciones con Google Analytics. No enviamos los datos del formulario. Puedes rechazarlo y seguir contactando con normalidad.</p><div class="rv-privacy-actions"><button type="button" data-consent="no">Rechazar analítica</button><button type="button" data-consent="yes">Aceptar analítica</button></div><a class="rv-privacy-link" href="/abogados/privacidad.html">Más información</a>';
  if(location.protocol==='file:')panel.innerHTML=panel.innerHTML.replace('/abogados/privacidad.html','privacidad.html');
  document.body.appendChild(panel);panel.querySelector('[data-consent="no"]').addEventListener('click',()=>setChoice(false));panel.querySelector('[data-consent="yes"]').addEventListener('click',()=>setChoice(true));
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-privacy-settings]')){panel.hidden=false;panel.querySelector('button').focus();}
    const link=event.target.closest('a[download]');if(!link)return;
    const filename=(link.getAttribute('href')||'').split('/').pop();
    const asset=filename.match(/^redvitalia_(E[1-5]_(?:feed|square|story|meta_(?:feed|square|story)|pmax_(?:wide|square|portrait)))\.png$/i);
    track('asset_download',{asset_id:asset?asset[1].toLowerCase():/GTM/.test(filename)?'gtm_container':/anuncios|Sistema-RedVitalia-(?:Meta|PMax)/.test(filename)?'ads_kit':/kit/.test(filename)?'html_kit':/manual/.test(filename)?'manual':'other_resource'});
  });
  const footer=document.querySelector('footer');if(footer){const button=document.createElement('button');button.type='button';button.className='rv-privacy-link';button.dataset.privacySettings='';button.textContent='Preferencias de privacidad';footer.appendChild(button);}
  if(active&&choice===null)panel.hidden=false;enable();
})();
