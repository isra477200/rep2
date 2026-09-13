(() => {
 'use strict';
 document.querySelectorAll('.demo-form').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();form.querySelector('.demo-result').hidden=false;}));
 document.querySelectorAll('.copy-script').forEach(button=>button.addEventListener('click',async()=>{
  const value=document.getElementById(button.dataset.copy)?.textContent||'';const status=button.nextElementSibling;
  try{await navigator.clipboard.writeText(value);status.textContent='Copiado';}catch{status.textContent='Selecciona el texto para copiarlo manualmente.';}
 }));
 const diagnostic=document.querySelector('#diagnostic-form');
 if(diagnostic)diagnostic.addEventListener('submit',event=>{
  event.preventDefault();const data=new FormData(diagnostic);const stage=data.get('stage');
  const options={demand:['Primero: demanda y mensaje.','Revisaríamos qué servicio queréis impulsar, en qué zona se busca y cómo lo explica la página. Después plantearíamos una prueba de captación.'],quality:['Primero: criterios de encaje.','Separaríamos consultas válidas y motivos de descarte. Así se puede revisar el mensaje, la segmentación y las preguntas iniciales.'],followup:['Primero: respuesta y próxima acción.','Revisaríamos cómo se responde, se agenda y se recuerda la cita. Cada consulta necesita responsable y siguiente acción.'],measure:['Primero: unir las etapas.','Acordaríamos cómo registrar solicitud, consulta válida, cita asistida y asunto aceptado. Con ese recorrido se puede decidir qué mejorar.']};
  const [title,text]=data.get('owner')==='no'?['Primero: quién atiende y cómo.','Antes de aumentar las consultas, conviene asignar un responsable, un horario y un proceso de atención. Después revisaremos la captación.']:options[stage]||options.measure;
  const result=document.querySelector('#diagnostic-result');result.querySelector('h3').textContent=title;result.querySelector('p').textContent=text;result.hidden=false;
  window.RedVitaliaMetrics?.track('diagnostic_complete');
 });
 const setup=document.querySelector('#measurement-config');
 const save=(filename,value,type)=>{const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
 function ids(){if(!setup.reportValidity())return null;return{gtm:setup.elements.gtm.value.trim(),ga4:setup.elements.ga4.value.trim()};}
 if(setup){
  setup.addEventListener('submit',async event=>{
   event.preventDefault();const values=ids();if(!values)return;
   const status=document.querySelector('#measurement-status');
   try{const container=JSON.parse(document.getElementById('rv-gtm-template').textContent);container.containerVersion.variable.find(v=>v.name==='RV · GA4 ID').parameter.find(p=>p.key==='value').value=values.ga4;save('RedVitalia-GTM-'+values.gtm+'.json',JSON.stringify(container,null,2),'application/json');status.textContent='Contenedor preparado con tu ID de GA4. Descarga también la configuración de la web.';}catch{status.textContent='No se pudo preparar. Puedes descargar la plantilla base y configurar su variable RV · GA4 ID.';}
  });
  document.querySelector('#download-configuration').addEventListener('click',()=>{const values=ids();if(!values)return;save('configuration.js',`window.REDVITALIA_CONFIG = Object.freeze(${JSON.stringify({gtmId:values.gtm,contactEndpoint:'/api/legal-contact',phone:'34919935237',displayPhone:'919 935 237'},null,2)});\n`,'text/javascript');});
 }
})();
