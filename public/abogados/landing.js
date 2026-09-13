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
  window.RedVitaliaContactContext={priority:stage,owner:data.get('owner')};document.dispatchEvent(new Event('rv-priority-change'));window.RedVitaliaMetrics?.track('diagnostic_complete');
 });
 const exampleDialog=document.querySelector('.rv-example-dialog');
 if(exampleDialog){document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{exampleDialog.querySelector('h2').textContent=button.dataset.title;exampleDialog.querySelector('iframe').src=button.dataset.example+'.html?preview=1';exampleDialog.showModal();}));exampleDialog.querySelector('.example-close').addEventListener('click',()=>exampleDialog.close());exampleDialog.querySelector('.example-contact').addEventListener('click',()=>{exampleDialog.close();document.dispatchEvent(new CustomEvent('rv-open-contact'));});exampleDialog.addEventListener('close',()=>{exampleDialog.querySelector('iframe').removeAttribute('src');});}
})();
