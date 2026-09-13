(function(){
var id=(window.REDVITALIA_CONFIG||{}).ga4Id;
if(!/^G-[A-Z0-9]{4,}$/.test(id)||!window.RedVitaliaMetrics||!window.RedVitaliaMetrics.consent||window.rvSendGA4)return;
window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
window.gtag('js',new Date());
var cleanLocation=window.RedVitaliaMetrics.pageId==='resource'?location.origin+'/':location.origin+'/abogados/'+window.RedVitaliaMetrics.pageId+'.html';
var campaignParams=new URLSearchParams(location.search||'');var source=campaignParams.get('utm_source'),medium=campaignParams.get('utm_medium'),content=campaignParams.get('utm_content');
if(campaignParams.get('utm_campaign')==='sistema_redvitalia_abogados'&&((source==='meta'&&medium==='paid_social')||(source==='google'&&medium==='cpc'))){cleanLocation+='?utm_source='+source+'&utm_medium='+medium+'&utm_campaign=sistema_redvitalia_abogados';if(/^e[1-5]_(meta_(feed|square|story)|pmax_(wide|square|portrait))$/.test(content||''))cleanLocation+='&utm_content='+content;}
window.gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:cleanLocation,page_referrer:'',cookie_domain:location.hostname});
window.rvGA4Consent=function(allowed){window['ga-disable-'+id]=!allowed;window.gtag('consent','update',{analytics_storage:allowed?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});};
window.rvSendGA4=function(name,data){if(!window.RedVitaliaMetrics.consent)return;var safe={send_to:id,page_location:cleanLocation,page_referrer:'',page_title:'RedVitalia · '+window.RedVitaliaMetrics.pageId};var keys=['page_id','page_kind','campaign','contact_channel','asset_id'];for(var i=0;i<keys.length;i++){var key=keys[i];if(data&&typeof data[key]==='string'&&/^[a-z0-9_-]{1,40}$/.test(data[key]))safe[key]=data[key];}window.gtag('event',name,safe);};
var script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(script);
})();
if(window.rvSendGA4){for(const item of [...window.dataLayer]){if(item&&/^rv_(page_view|contact_widget_open|contact_channel_select|generate_lead|contact_whatsapp_click|contact_phone_click|asset_download|diagnostic_complete)$/.test(item.event||''))window.rvSendGA4(item.event.slice(3),item.event_data);}}
