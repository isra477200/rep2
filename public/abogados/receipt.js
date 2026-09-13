(() => {
 'use strict';
 const channel=new URLSearchParams(location.search).get('canal');
 const contact=document.getElementById('receipt-contact'),alternative=document.getElementById('receipt-alternative');
 if(channel==='phone'){contact.href='tel:+34919935237';contact.removeAttribute('target');contact.textContent='Llamar al 919 935 237 ↗';alternative.href='https://wa.me/34919935237';alternative.target='_blank';alternative.rel='noopener noreferrer';alternative.textContent='O continuar por WhatsApp';}
 // A receipt comes only from a validated native form success. Visiting this page is not a lead.
 try{
  const receipt=JSON.parse(sessionStorage.getItem('redvitalia.contact-receipt.v1')||'null');
  if(receipt&&receipt.channel===channel&&typeof receipt.id==='string'&&Date.now()-receipt.at>=0&&Date.now()-receipt.at<900000){
   document.querySelector('h1').innerHTML='Solicitud recibida.<br>Hablemos.';
   document.getElementById('receipt-message').textContent='Gracias. Tu solicitud ya se ha registrado en nuestro sistema de atención. Continúa por el canal que has elegido.';
  }
 }catch{/* The conversation remains available if browser storage is unavailable. */}
 for(const link of [contact,alternative])link.addEventListener('click',()=>{
  const clicked=link.getAttribute('href').startsWith('tel:')?'phone':'whatsapp';
  window.RedVitaliaMetrics?.track(clicked==='phone'?'contact_phone_click':'contact_whatsapp_click',{contact_channel:clicked});
 });
})();
