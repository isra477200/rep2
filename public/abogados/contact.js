(() => {
 'use strict';
 if(document.getElementById('rv-contact')||new URLSearchParams(location.search).get('preview')==='1')return;
 const forms=window.REDVITALIA_CONFIG?.ghlForms||{}, instances=[];
 const track=(name,values={})=>window.RedVitaliaMetrics?.track(name,values);
 const priorityLabels={demand:'Conseguir más consultas',quality:'Mejorar la calidad de las consultas',followup:'Convertir consultas en citas',measure:'Saber qué termina en cliente'};
 const host=document.createElement('aside');host.id='rv-contact';host.className='rv-contact';host.setAttribute('aria-label','Contacto con Nidia Guerrero · RedVitalia');
 host.innerHTML='<section class="rv-drawer" id="rv-drawer" role="dialog" aria-modal="false" aria-labelledby="rv-title" data-step="choice" hidden><div class="rv-drawer-head"><small>SISTEMA REDVITALIA · ABOGADOS</small><h2 id="rv-title">Hablemos de tu despacho.</h2><p>Estamos a tu entera disposición. Elige WhatsApp o llamada para conversar con nosotros.</p><div class="rv-person"><span class="rv-initials" aria-hidden="true">NG</span><span><strong>Nidia Guerrero</strong><small>RedVitalia · 919 935 237</small></span></div><button type="button" class="rv-close" aria-label="Cerrar contacto">×</button></div><div data-native-widget></div></section><button type="button" class="rv-launcher" aria-expanded="false" aria-controls="rv-drawer"><span class="rv-launcher-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2V11.5a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg></span><span>¿Hablamos?<small>Nidia Guerrero · RedVitalia</small></span></button>';
 document.body.appendChild(host);
 const drawer=host.querySelector('.rv-drawer'),launcher=host.querySelector('.rv-launcher');let opener=launcher;
 function renderLoadState(entry){
  const frame=entry.current;if(!frame)return;
  const ready=frame.dataset.ready==='true',failed=frame.dataset.failed==='true'&&!ready;
  frame.hidden=failed;
  const message=entry.slot.querySelector('[data-native-loading]');
  message.hidden=ready;message.textContent=failed?'El formulario tarda en responder. Puedes abrirlo en otra ventana.':'Preparando tu formulario…';
  const help=entry.slot.querySelector('.rv-native-help');
  if(failed){help.open=true;entry.recovery=true;}
  else if(entry.recovery){help.open=false;entry.recovery=false;}
 }
 const preview=location.protocol==='file:'||['localhost','127.0.0.1'].includes(location.hostname);
 const bridge=window.RedVitaliaNativeBridge?.create({forms,locationId:'KdwdmsNodpCq6RYicQ1N',eventTarget:window,pageURL:preview?'https://redvitalia.srv1480016.hstgr.cloud/abogados/redvitalia.html':location.href,getConsent:()=>({hasResponded:window.RedVitaliaMetrics?.hasResponded===true,analytics:window.RedVitaliaMetrics?.consent===true}),onReady:({frameId})=>{
  const frame=document.getElementById(frameId);if(!frame)return;
  frame.dataset.ready='true';delete frame.dataset.failed;
  const entry=instances.find(e=>Object.values(e.frames).includes(frame));
  if(entry?.current===frame)renderLoadState(entry);
 },onAck:({channel})=>{
  // Defer measurement until the verified receipt page: the native provider
  // redirects immediately, which could otherwise discard the Analytics event.
  try{sessionStorage.setItem('redvitalia.contact-receipt.v1',JSON.stringify({id:crypto.randomUUID(),channel,at:Date.now(),analyticsEligible:window.RedVitaliaMetrics?.consent===true}));}
  catch{track('generate_lead',{contact_channel:channel});}
 }});
 document.addEventListener('rv-consent-change',()=>bridge?.refreshConsent());
 function mount(slot){
  slot.dataset.contactStep='choice';
  slot.innerHTML='<p class="rv-choice-intro">¿Cómo prefieres conversar?</p><div class="rv-native-channels" role="group" aria-label="Cómo prefieres contactar"><button type="button" data-channel="whatsapp" aria-pressed="false"><span>Contactar por WhatsApp</span><small>Escríbenos y seguimos la conversación.</small><b aria-hidden="true">↗</b></button><button type="button" data-channel="phone" aria-pressed="false"><span>Llamar al 919 935 237</span><small>Habla con nosotros por teléfono.</small><b aria-hidden="true">↗</b></button></div><p class="rv-choice-note">Te pediremos <strong>nombre, empresa y teléfono</strong> antes de continuar. Sin compromiso de contratación.</p><div class="rv-native-details" hidden><p class="rv-native-next" role="status"></p><p class="rv-native-context" hidden></p><p class="rv-native-loading" data-native-loading role="status" hidden>Preparando tu formulario…</p><div class="rv-native-frame"></div><details class="rv-native-help"><summary>¿No aparece el formulario?</summary><p><a data-native-direct target="_blank" rel="noopener noreferrer">Abrir formulario en otra ventana ↗</a></p><p>Nidia Guerrero · RedVitalia<br>919 935 237</p></details></div>';
  const entry={slot,channel:null,frames:{},current:null,recovery:false};instances.push(entry);
  entry.select=channel=>{
   if(!['phone','whatsapp'].includes(channel))return;
   entry.channel=channel;slot.dataset.contactStep='form';slot.querySelector('.rv-native-details').hidden=false;
   slot.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.channel===channel)));
   slot.querySelector('.rv-native-next').textContent=channel==='phone'?'Completa tus datos. Después podrás llamar al 919 935 237.':'Completa tus datos. Después podrás abrir WhatsApp.';
   if(slot.hasAttribute('data-native-widget'))drawer.dataset.step='form';
   load(entry);track('contact_channel_select',{contact_channel:channel});
  };
  slot.querySelectorAll('[data-channel]').forEach(b=>b.addEventListener('click',()=>entry.select(b.dataset.channel)));
  return entry;
 }
 function load(entry){
  const holder=entry.slot.querySelector('.rv-native-frame'),direct=entry.slot.querySelector('[data-native-direct]');
  if(!bridge||!/^[A-Za-z0-9]{15,40}$/.test(forms[entry.channel]||'')){holder.innerHTML='<p class="rv-native-fallback">El formulario no está disponible. Puedes llamar al <a href="tel:+34919935237">919 935 237</a>.</p>';direct.hidden=true;return;}
  for(const frame of Object.values(entry.frames))frame.hidden=true;
  let frame=entry.frames[entry.channel];
  if(!frame){
   frame=document.createElement('iframe');frame.className='rv-native-form';frame.title='Nombre, empresa y teléfono para contactar por '+(entry.channel==='phone'?'llamada':'WhatsApp')+' con RedVitalia';frame.dataset.channel=entry.channel;
   bridge.register(frame,{channel:entry.channel,search:location.search,priority:window.RedVitaliaContactContext?.priority});
   entry.frames[entry.channel]=frame;entry.current=frame;holder.appendChild(frame);
   setTimeout(()=>{if(frame.dataset.ready!=='true'){frame.dataset.failed='true';if(entry.current===frame)renderLoadState(entry);}},8000);
  }
  entry.current=frame;direct.href=frame.src;direct.hidden=false;renderLoadState(entry);
 }
 const widget=mount(host.querySelector('[data-native-widget]'));
 document.querySelectorAll('[data-rv-inline]').forEach(slot=>mount(slot));
 function open(channel,target=launcher){
  opener=target;drawer.hidden=false;launcher.setAttribute('aria-expanded','true');
  if(['phone','whatsapp'].includes(channel))widget.select(channel);
  host.querySelector(widget.channel?'[data-channel="'+widget.channel+'"]':'[data-channel]').focus();
  track('contact_widget_open');
 }
 function close(){drawer.hidden=true;launcher.setAttribute('aria-expanded','false');opener?.focus();}
 document.addEventListener('rv-open-contact',()=>open());
 launcher.addEventListener('click',()=>drawer.hidden?open():close());host.querySelector('.rv-close').addEventListener('click',close);
 drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
 document.addEventListener('click',event=>{const trigger=event.target.closest('.contact-trigger');if(trigger){event.preventDefault();open(trigger.dataset.contactChannel,trigger);}if(event.target.closest('[data-privacy-settings]')&&host.contains(event.target))close();});
 document.addEventListener('rv-priority-change',()=>{for(const entry of instances){const priority=window.RedVitaliaContactContext?.priority,box=entry.slot.querySelector('.rv-native-context');box.hidden=!priorityLabels[priority];box.textContent=priorityLabels[priority]?'Tu prioridad: '+priorityLabels[priority]+'. Indícala también en la conversación.':'';}});
})();
