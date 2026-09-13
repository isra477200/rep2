(() => {
 'use strict';
 const form = document.querySelector('#agency-form');
 if (form) form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const field = name => String(data.get(name) || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 150);
  const message = `Hola, RedVitalia. Soy ${field('name')}, de ${field('firm')}. Me interesa un diagnóstico de captación para ${field('specialty')} en ${field('zone')}. Queremos revisar: ${field('need')}. Me gustaría conocer el siguiente paso.`;
  document.querySelector('#message-preview').value = message;
  document.querySelector('#whatsapp-link').href = `https://wa.me/34637371993?text=${encodeURIComponent(message)}`;
  const result = document.querySelector('#agency-result');
  result.hidden = false;
  result.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 });
 document.querySelectorAll('.demo-form').forEach(demo => demo.addEventListener('submit',event => {
  event.preventDefault();
  demo.querySelector('.demo-result').hidden = false;
 }));
 document.querySelectorAll('.copy-script').forEach(button => button.addEventListener('click', async () => {
  const text = document.getElementById(button.dataset.copy).textContent;
  const status = button.nextElementSibling;
  try { await navigator.clipboard.writeText(text); status.textContent = 'Copiado'; }
  catch { status.textContent = 'Selecciona el texto para copiarlo manualmente.'; }
 }));
 if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
   if(entry.isIntersecting){entry.target.classList.add('reveal-ready');observer.unobserve(entry.target);}
  }),{threshold:.12});
  document.querySelectorAll('.section-heading,.service-cards article,.collection-card,.vertical-card').forEach(el=>observer.observe(el));
 }
})();
