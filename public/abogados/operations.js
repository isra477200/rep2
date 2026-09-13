(() => {
 'use strict';
 const cfg=window.REDVITALIA_CONFIG||{};
 const set=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value;};
 const tracking=/^GTM-[A-Z0-9]{4,}$/.test(cfg.gtmId||'')||/^G-[A-Z0-9]{4,}$/.test(cfg.ga4Id||'');
 set('[data-tracking-health]',tracking?'Configurada con consentimiento':'Eventos preparados; conexión pendiente');
 if(tracking)document.querySelector('[data-tracking-dot]')?.classList.remove('unknown');
 fetch('/api/legal-contact',{headers:{Accept:'application/json'},cache:'no-store'}).then(r=>r.json()).then(data=>{
  set('[data-contact-health]',data.configured?(data.mode==='native_form'?'Formularios conectados a GoHighLevel':'Recepción conectada'):'Conexión pendiente');
  if(data.configured)document.querySelector('[data-health-dot]')?.classList.remove('unknown');
 }).catch(()=>set('[data-contact-health]','No se pudo comprobar'));
 fetch('campaign-status.json',{cache:'no-store'}).then(r=>r.json()).then(status=>{
  for(const platform of ['meta','pmax']){const entry=status[platform];if(!entry)continue;set(`[data-campaign-status="${platform}"]`,entry.label);set(`[data-campaign-evidence="${platform}"]`,entry.evidence);const link=document.querySelector(`[data-campaign-link="${platform}"]`);if(entry.url&&link){const url=new URL(entry.url);if(['adsmanager.facebook.com','business.facebook.com','ads.google.com'].includes(url.hostname)){link.href=url.href;link.textContent=platform==='meta'?'Abrir campaña en Meta ↗':'Abrir Google Ads ↗';link.target='_blank';link.rel='noopener';}}}
 }).catch(()=>{});
})();
