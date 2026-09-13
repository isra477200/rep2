(() => {
 'use strict';
 if(document.getElementById('rv-contact')||new URLSearchParams(location.search).get('preview')==='1')return;
 const cfg=window.REDVITALIA_CONFIG||{}, forms=cfg.ghlForms||{};
 const instances=[];
 const track=(name,values={})=>window.RedVitaliaMetrics?.track(name,values);
 const priorityLabels={demand:'Conseguir más consultas',quality:'Mejorar la calidad de las consultas',followup:'Convertir consultas en citas',measure:'Saber qué termina en cliente'};
 const host=document.createElement('aside');host.id='rv-contact';host.className='rv-contact';host.setAttribute('aria-label','Contacto con RedVitalia');
 host.innerHTML='<section class="rv-drawer" id="rv-drawer" role="dialog" aria-modal="false" aria-labelledby="rv-title" hidden><div class="rv-drawer-head"><small>REDVITALIA / HABLEMOS</small><h2 id="rv-title">Estamos a tu disposición.</h2><p>Cuéntanos qué necesita tu despacho. ¿Prefieres WhatsApp o llamada?</p><button type="button" class="rv-close" aria-label="Cerrar contacto">×</button></div><div data-native-widget></div></section><button type="button" class="rv-launcher" aria-expanded="false" aria-controls="rv-drawer"><span class="rv-bubble-icon" aria-hidden="true">◌</span><span>¿Hablamos de tu despacho?<small>WhatsApp o llamada · 919 935 237</small></span></button>';
 document.body.appendChild(host);
 const drawer=host.querySelector('.rv-drawer'),launcher=host.querySelector('.rv-launcher');let opener=launcher;
 const bridge=window.RedVitaliaNativeBridge?.create({forms,locationId:'KdwdmsNodpCq6RYicQ1N',eventTarget:window,pageURL:location.protocol==='file:'?'https://redvitalia.srv1480016.hstgr.cloud/abogados/redvitalia.html':location.href,getConsent:()=>({hasResponded:window.RedVitaliaMetrics?.hasResponded===true,analytics:window.RedVitaliaMetrics?.consent===true}),onReady:({frameId})=>{const frame=document.getElementById(frameId);if(frame){frame.dataset.ready='true';const entry=instances.find(e=>Object.values(e.frames).includes(frame));if(entry?.current===frame)frame.hidden=false;entry?.slot.querySelector('[data-native-loading]')?.setAttribute('hidden','');}},onAck:({channel})=>{
  // The provider redirects immediately. Defer measurement to the confirmed receipt
  // page so navigation cannot discard the event before Analytics loads/sends it.
  try{sessionStorage.setItem('redvitalia.contact-receipt.v1',JSON.stringify({id:crypto.randomUUID(),channel,at:Date.now(),analyticsEligible:window.RedVitaliaMetrics?.consent===true}));}
  catch{track('generate_lead',{contact_channel:channel});}
 }});
 document.addEventListener('rv-consent-change',()=>bridge?.refreshConsent());
 function mount(slot,lazy=false){
  slot.innerHTML='<div class="rv-native-channels" role="group" aria-label="Cómo prefieres contactar"><button type="button" data-channel="whatsapp" aria-pressed="true">Contactar por WhatsApp</button><button type="button" data-channel="phone" aria-pressed="false">Llamar</button></div><p class="rv-native-context" hidden></p><p class="rv-native-fallback"><a data-native-direct target="_blank" rel="noopener noreferrer">Abrir el formulario en una ventana independiente ↗</a><br>Teléfono de RedVitalia: <strong>919 935 237</strong>.</p><p class="rv-native-fallback" data-native-loading role="status">Cargando formulario…</p><div class="rv-native-frame"></div>';
  const entry={slot,channel:'whatsapp',frames:{},current:null,lazy,submitted:false};instances.push(entry);
  function select(channel){entry.channel=channel;slot.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.channel===channel)));if(!entry.lazy){load(entry);track('contact_channel_select',{contact_channel:channel});}}
  slot.querySelectorAll('[data-channel]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.channel)));entry.select=select;if(!lazy)load(entry);return entry;
 }
 function load(entry){
  const holder=entry.slot.querySelector('.rv-native-frame'),direct=entry.slot.querySelector('[data-native-direct]');
  const id=forms[entry.channel];
  if(!bridge||!/^[A-Za-z0-9]{15,40}$/.test(id||'')){holder.innerHTML='<p class="rv-native-fallback">El formulario no está disponible. Puedes llamar al <a href="tel:+34919935237">919 935 237</a>.</p>';direct.hidden=true;return;}
  for(const frame of Object.values(entry.frames))frame.hidden=true;
  let frame=entry.frames[entry.channel];
  if(!frame){frame=document.createElement('iframe');frame.className='rv-native-form';frame.title='Solicitar contacto por '+(entry.channel==='phone'?'teléfono':'WhatsApp')+' con RedVitalia';frame.dataset.channel=entry.channel;bridge.register(frame,{channel:entry.channel,search:location.search,priority:window.RedVitaliaContactContext?.priority});holder.appendChild(frame);entry.frames[entry.channel]=frame;const waitingFrame=frame;setTimeout(()=>{if(waitingFrame.dataset.ready!=='true'){waitingFrame.hidden=true;const message=entry.slot.querySelector('[data-native-loading]');message.hidden=false;message.textContent='Si el formulario no aparece, puedes abrirlo con el enlace anterior.';}},8000);}
  direct.href=frame.src;direct.hidden=false;
  frame.hidden=false;entry.current=frame;entry.lazy=false;
 }
 const widget=mount(host.querySelector('[data-native-widget]'),true);
 document.querySelectorAll('[data-rv-inline]').forEach(slot=>mount(slot));
 function open(channel,target=launcher){opener=target;drawer.hidden=false;launcher.setAttribute('aria-expanded','true');if(['phone','whatsapp'].includes(channel))widget.select(channel);load(widget);host.querySelector('[data-channel="'+widget.channel+'"]').focus();track('contact_widget_open');}
 function close(){drawer.hidden=true;launcher.setAttribute('aria-expanded','false');opener.focus();}
 document.addEventListener('rv-open-contact',()=>open());
 launcher.addEventListener('click',()=>drawer.hidden?open():close());host.querySelector('.rv-close').addEventListener('click',close);
 drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
 document.addEventListener('click',event=>{const trigger=event.target.closest('.contact-trigger');if(trigger){event.preventDefault();open(trigger.dataset.contactChannel,trigger);}if(event.target.closest('[data-privacy-settings]')&&host.contains(event.target))close();});
 document.addEventListener('rv-priority-change',()=>{for(const entry of instances){const priority=window.RedVitaliaContactContext?.priority,box=entry.slot.querySelector('.rv-native-context');box.hidden=!priorityLabels[priority];box.textContent=priorityLabels[priority]?'Tu prioridad: '+priorityLabels[priority]+'. Indícala también en la conversación.':'';}});
})();
