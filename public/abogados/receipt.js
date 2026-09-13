(() => {
 'use strict';
 const channel=new URLSearchParams(location.search).get('canal');
 const contact=document.getElementById('receipt-contact'),alternative=document.getElementById('receipt-alternative');
 if(channel==='phone'){contact.href='tel:+34919935237';contact.removeAttribute('target');contact.textContent='Llamar al 919 935 237 ↗';alternative.href='https://wa.me/34919935237';alternative.target='_blank';alternative.rel='noopener noreferrer';alternative.textContent='O continuar por WhatsApp';}
 // A receipt comes only from a validated native form success. Visiting this page is not a lead.
 try{
  const receipt=JSON.parse(sessionStorage.getItem('redvitalia.contact-receipt.v1')||'null');
  if(receipt&&['phone','whatsapp'].includes(channel)&&receipt.channel===channel&&typeof receipt.id==='string'&&receipt.id.length>0&&typeof receipt.at==='number'&&Number.isFinite(receipt.at)&&Date.now()-receipt.at>=0&&Date.now()-receipt.at<900000){
   document.querySelector('h1').innerHTML='Solicitud recibida.<br>Hablemos.';
   document.getElementById('receipt-message').textContent='Gracias. Tu solicitud ya se ha registrado en nuestro sistema de atención. Continúa por el canal que has elegido.';
   // Only an acknowledged native submission may produce this event. Consume the
   // receipt before queuing it, so a reload/back navigation cannot count it twice.
   if(receipt.analyticsEligible===true&&window.RedVitaliaMetrics?.consent===true&&!receipt.metricsSent){
    receipt.metricsSent=true;
    sessionStorage.setItem('redvitalia.contact-receipt.v1',JSON.stringify(receipt));
    window.RedVitaliaMetrics.track('generate_lead',{contact_channel:channel});
   }
  }
 }catch{/* The conversation remains available if browser storage is unavailable. */}
 for(const link of [contact,alternative])link.addEventListener('click',()=>{
  const clicked=link.getAttribute('href').startsWith('tel:')?'phone':'whatsapp';
  window.RedVitaliaMetrics?.track(clicked==='phone'?'contact_phone_click':'contact_whatsapp_click',{contact_channel:clicked});
 });
})();
