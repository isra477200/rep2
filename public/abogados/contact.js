(() => {
  'use strict';
  if (document.getElementById('rv-contact')) return;
  const config = window.REDVITALIA_CONFIG || {};
  const phone = '34919935237';
  const privacyHref=location.protocol==='file:'?'privacidad.html':'/abogados/privacidad.html';
  const demo = /\/(segunda-oportunidad|herencias|divorcios)\.html$/.test(location.pathname);
  const track = (name, values = {}) => window.RedVitaliaMetrics?.track(name, values);
  const host = document.createElement('aside');
  host.id = 'rv-contact'; host.className = 'rv-contact'; host.setAttribute('aria-label', 'Contacto con RedVitalia');
  host.innerHTML = `<section class="rv-drawer" id="rv-drawer" role="dialog" aria-modal="false" aria-labelledby="rv-title" hidden><div class="rv-drawer-head"><small>REDVITALIA / HABLEMOS</small><h2 id="rv-title">Estamos a tu disposición.</h2><p>${demo ? '¿Quieres esta página para tu despacho? Hablemos de marketing y captación.' : 'Cuéntanos qué necesita tu empresa. Elige cómo prefieres hablar con nosotros.'}</p><button type="button" class="rv-close" aria-label="Cerrar contacto">×</button></div><div class="rv-drawer-body"><div class="rv-options"><button type="button" class="channel-card" data-rv-channel="whatsapp"><span class="channel-icon" aria-hidden="true">◉</span><span><strong>Contactar por WhatsApp</strong><small>Escríbenos al 919 935 237.</small></span><b aria-hidden="true">↗</b></button><button type="button" class="channel-card" data-rv-channel="phone"><span class="channel-icon" aria-hidden="true">↗</span><span><strong>Llamar al 919 935 237</strong><small>Hablemos directamente.</small></span><b aria-hidden="true">↗</b></button><p class="rv-small">Te pediremos nombre, teléfono y empresa para atender tu solicitud.${demo ? ' No es un servicio de asesoramiento jurídico.' : ''}</p><button type="button" class="rv-privacy-link" data-privacy-settings>Preferencias de privacidad</button></div><form class="rv-form" hidden><button type="button" class="rv-back">← Cambiar de canal</button><p class="rv-channel-summary"></p><label>Nombre<input name="name" autocomplete="name" required minlength="2" maxlength="80" placeholder="Tu nombre"></label><label>Empresa o despacho<input name="company" autocomplete="organization" required minlength="2" maxlength="120" placeholder="Nombre de tu empresa"></label><label>Teléfono<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="22" placeholder="Ej.: 612 345 678"></label><label class="rv-trap" aria-hidden="true" tabindex="-1">Sitio web<input name="website" tabindex="-1" autocomplete="off"></label><label class="rv-consent"><input name="consent" type="checkbox" required><span>Solicito que RedVitalia utilice estos datos para atenderme. He leído la <a href="${privacyHref}" target="_blank" rel="noopener">información de privacidad</a>.</span></label><button type="submit" class="rv-submit">Preparar contacto</button><p class="rv-small">No incluyas datos de expedientes. No te suscribe a publicidad.</p></form><div class="rv-result" hidden aria-live="polite"><h3 class="rv-result-title"></h3><p class="rv-delivery"></p><textarea aria-label="Mensaje para WhatsApp" readonly rows="5" hidden></textarea><button type="button" class="rv-final-link">Continuar</button><button class="rv-back rv-retry" type="button" style="margin-top:20px">← Revisar mis datos o reintentar</button></div></div></section><button type="button" class="rv-launcher" aria-expanded="false" aria-controls="rv-drawer"><span class="rv-bubble-icon" aria-hidden="true">◌</span><span>Hablemos<small>WhatsApp o llamada</small></span></button>`;
  document.body.appendChild(host);
  const find = s => host.querySelector(s);
  const drawer = find('.rv-drawer'), launcher = find('.rv-launcher'), form = find('form');
  let channel = '', started = false, busy = false, opener = launcher, requestId = '', lastPayload = '', destination = '';
  const measuredRequests = new Set();
  function show(state) { drawer.dataset.step=state; ['options', 'form', 'result'].forEach(s => { find('.rv-' + s).hidden = s !== state; }); }
  function open(selected, target = launcher) {
    opener = target;
    if(drawer.hidden) { drawer.hidden = false; launcher.setAttribute('aria-expanded', 'true'); track('contact_widget_open'); }
    if(selected) choose(selected); else if(!busy){show('options');find('[data-rv-channel]').focus();}
  }
  function close() { drawer.hidden = true; launcher.setAttribute('aria-expanded', 'false'); opener.focus(); }
  function choose(value) {
    if (busy || !['phone','whatsapp'].includes(value)) return;
    channel = value; started = false; show('form');
    find('.rv-channel-summary').textContent = value === 'phone' ? 'Llamada · 919 935 237' : 'WhatsApp · 919 935 237';
    find('.rv-submit').textContent = value === 'phone' ? 'Guardar mis datos y preparar llamada' : 'Guardar mis datos y preparar WhatsApp';
    track('contact_channel_select', {contact_channel:channel}); form.elements.name.focus();
  }
  launcher.addEventListener('click',()=>drawer.hidden ? open() : close());
  find('.rv-close').addEventListener('click',close);
  host.querySelectorAll('[data-rv-channel]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.rvChannel)));
  find('.rv-back').addEventListener('click',()=>{if(!busy){show('options');find('[data-rv-channel]').focus();}});
  find('.rv-retry').addEventListener('click',()=>{show('form');form.elements.name.focus();});
  document.addEventListener('click',event=>{
    const trigger = event.target.closest('.contact-trigger');
    if(trigger){event.preventDefault();open(trigger.dataset.contactChannel, trigger);}
    if(event.target.closest('[data-privacy-settings]')&&host.contains(event.target))close();
  });
  drawer.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();}

  });
  form.addEventListener('input',()=>{['name','company','phone'].forEach(key=>form.elements[key].setCustomValidity(''));if(!started){started=true;track('contact_form_start',{contact_channel:channel});}});
  function normalizePhone(value){let p=value.replace(/[\s().-]/g,'');if(/^[6789]\d{8}$/.test(p))p='+34'+p;if(/^00/.test(p))p='+'+p.slice(2);return /^\+[1-9]\d{7,14}$/.test(p)?p:null;}
  const clean = (name,max)=>String(form.elements[name].value).trim().split('').map(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127?' ':c).join('').slice(0,max);
  function renderResult(payload,received){
    show('result');
    find('.rv-result-title').textContent = channel==='phone' ? 'Ya puedes abrir la llamada.' : 'Tu mensaje está preparado.';
    const status=find('.rv-delivery');status.className='rv-delivery'+(received?'':' rv-error');
    status.textContent=received ? 'Solicitud entregada al sistema de atención. Continúa por el canal que has elegido.' : 'Ahora no hemos podido registrar tus datos. Puedes contactar directamente abajo; si eliges WhatsApp, tus datos irán en el mensaje. La llamada no los envía.';
    const message=`Hola, RedVitalia. Soy ${payload.name}, de ${payload.company}. Mi teléfono es ${payload.phone}. Me gustaría hablar sobre captación para mi empresa. ¿Cuál sería el siguiente paso?`;
    const area=find('.rv-result textarea');area.hidden=channel!=='whatsapp';area.value=message;
    const link=find('.rv-final-link');destination=channel==='phone'?`tel:+${phone}`:`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    link.textContent=channel==='phone'?'Llamar al 919 935 237':'Abrir WhatsApp y revisar el mensaje';
    link.focus();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const normalized=normalizePhone(form.elements.phone.value);
    form.elements.phone.setCustomValidity(normalized?'':'Indica un teléfono válido. Para otro país, añade el prefijo con +.');
    form.elements.name.setCustomValidity(clean('name',80).length>=2?'':'Escribe tu nombre.');
    form.elements.company.setCustomValidity(clean('company',120).length>=2?'':'Escribe el nombre de tu empresa.');
    if(!form.reportValidity())return;
    const payload={name:clean('name',80),company:clean('company',120),phone:normalized,channel,consent:true,website:clean('website',100),source_page:window.RedVitaliaMetrics?.pageId || 'resource',campaign:window.RedVitaliaMetrics?.campaign || 'direct'};
    if(payload.name.length<2||payload.company.length<2)return;
    const serialized=JSON.stringify(payload);
    if(lastPayload!==serialized){requestId=crypto.randomUUID();lastPayload=serialized;}
    busy=true;const button=find('.rv-submit');button.disabled=true;button.textContent='Preparando…';
    let received=false;
    try{
      const endpoint=new URL(config.contactEndpoint||'/api/legal-contact',location.href);
      if(endpoint.origin!==location.origin||!['http:','https:'].includes(endpoint.protocol))throw Error('Unconfigured');
      const response=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,request_id:requestId}),signal:AbortSignal.timeout(10000)});
      const result=await response.json();received=response.ok&&result.accepted===true;
    }catch{/* Show a usable contact alternative without claiming that the CRM received it. */}
    busy=false;button.disabled=false;button.textContent=channel==='phone'?'Guardar mis datos y preparar llamada':'Guardar mis datos y preparar WhatsApp';
    if(received){if(!measuredRequests.has(requestId)){track('generate_lead',{contact_channel:channel});measuredRequests.add(requestId);}}else track('contact_submit_error',{contact_channel:channel});
    renderResult(payload,received);
  });
  find('.rv-final-link').addEventListener('click',()=>{
    track(channel==='phone'?'contact_phone_click':'contact_whatsapp_click',{contact_channel:channel});
    if(channel==='whatsapp')window.open(destination,'_blank','noopener,noreferrer');else location.href=destination;
  });
})();
