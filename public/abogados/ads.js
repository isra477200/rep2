(() => {
 'use strict';
 let angle='all',platform='meta',format='feed',copyData=[],platforms={};
 try{copyData=JSON.parse(document.getElementById('rv-ad-copy-data').textContent);platforms=JSON.parse(document.getElementById('rv-ad-platform-data').textContent);}catch{return;}
 function update(){
  let visible=0;const [w,h,label]=platforms[platform].formats[format];
  document.querySelectorAll('[data-platform-only]').forEach(el=>el.hidden=el.dataset.platformOnly!==platform);
  document.querySelectorAll('.ad-campaign').forEach(card=>{
   const id=card.dataset.campaign;card.hidden=angle!=='all'&&angle!==id;if(!card.hidden)visible++;
   const base='redvitalia_'+id+'_'+platform+'_'+format;
   const image=card.querySelector('img');image.src='ads/previews/'+base+'.webp';image.width=w;image.height=h;
   card.querySelector('.ad-image-link').href='ads/images/'+base+'.png';card.querySelector('.ad-image-download').href='ads/images/'+base+'.png';
   card.querySelector('.ad-dimensions').textContent=`PNG · ${w} × ${h}`;
   card.querySelector('.ad-destination p').textContent='https://redvitalia.srv1480016.hstgr.cloud/abogados/redvitalia.html?utm_source='+(platform==='meta'?'meta':'google')+'&utm_medium='+(platform==='meta'?'paid_social':'cpc')+'&utm_campaign=sistema_redvitalia_abogados&utm_content='+id.toLowerCase()+'_'+platform+'_'+format;
  });
  document.querySelector('.ad-filter-status').textContent=`${visible} ${visible===1?'enfoque':'enfoques'} · ${platforms[platform].name} · ${label} ${w} × ${h}`;
 }
 const formats=document.querySelector('.ad-format-filter');
 formats.addEventListener('click',event=>{const b=event.target.closest('[data-format]');if(!b)return;format=b.dataset.format;formats.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));update();});
 document.querySelectorAll('[data-platform]').forEach(b=>b.addEventListener('click',()=>{platform=b.dataset.platform;format=Object.keys(platforms[platform].formats)[0];document.querySelectorAll('[data-platform]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));formats.replaceChildren(...Object.entries(platforms[platform].formats).map(([id,[,,label]])=>{const el=document.createElement('button');el.type='button';el.dataset.format=id;el.textContent=label;el.setAttribute('aria-pressed',String(id===format));return el;}));update();}));
 document.querySelectorAll('[data-angle]').forEach(b=>b.addEventListener('click',()=>{angle=b.dataset.angle;document.querySelectorAll('[data-angle]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));update();}));
 document.querySelectorAll('[data-copy-select]').forEach(select=>select.addEventListener('change',()=>{
  const [id,key]=select.dataset.copySelect.split('-');const a=copyData.find(x=>x.id===id);if(!a)return;
  const text=a[key]?.[Number(select.value)];if(typeof text==='string'){document.getElementById(select.dataset.copySelect).textContent=text;select.closest('.ad-copy-group').querySelector('.copy-status').textContent='';}
 }));
 update();
})();
