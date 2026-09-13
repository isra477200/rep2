(() => {
 'use strict';
 const dimensions={feed:[1080,1350,'Feed'],square:[1080,1080,'Cuadrado'],story:[1080,1920,'Stories']};
 let angle='all',format='feed',copyData=[];
 function update(){
  let visible=0;const [w,h,label]=dimensions[format];
  document.querySelectorAll('.ad-campaign').forEach(card=>{
   const id=card.dataset.campaign;card.hidden=angle!=='all'&&angle!==id;if(!card.hidden)visible++;
   const base='redvitalia_'+id+'_'+format;
   const image=card.querySelector('img');image.src='ads/previews/'+base+'.webp';image.width=w;image.height=h;
   card.querySelector('.ad-image-link').href='ads/images/'+base+'.png';card.querySelector('.ad-image-download').href='ads/images/'+base+'.png';
   card.querySelector('.ad-dimensions').textContent=`PNG · ${w} × ${h}`;
   card.querySelector('.ad-destination p').textContent='https://redvitalia.srv1480016.hstgr.cloud/abogados/redvitalia.html?utm_source=meta&utm_medium=paid_social&utm_campaign=redvitalia_abogados&utm_content='+id.toLowerCase()+'_'+format;
  });
  document.querySelector('.ad-filter-status').textContent=`${visible} ${visible===1?'enfoque':'enfoques'} · ${label} ${w} × ${h}`;
 }
 document.querySelectorAll('[data-angle]').forEach(b=>b.addEventListener('click',()=>{angle=b.dataset.angle;document.querySelectorAll('[data-angle]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));update();}));
 document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>{format=b.dataset.format;document.querySelectorAll('[data-format]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));update();}));
 try{copyData=JSON.parse(document.getElementById('rv-ad-copy-data').textContent);}catch{document.querySelectorAll('[data-copy-select]').forEach(x=>{x.disabled=true;x.title='No se pudieron cargar las variantes. El texto recomendado sigue disponible.';});}
 document.querySelectorAll('[data-copy-select]').forEach(select=>select.addEventListener('change',()=>{
  const [id,key]=select.dataset.copySelect.split('-');const a=copyData.find(x=>x.id===id);if(!a)return;
  const text=a[key]?.[Number(select.value)];if(typeof text==='string'){document.getElementById(select.dataset.copySelect).textContent=text;select.closest('.ad-copy-group').querySelector('.copy-status').textContent='';}
 }));
})();
