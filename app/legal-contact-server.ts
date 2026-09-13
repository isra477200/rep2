export type LegalContact = { name:string; company:string; phone:string; channel:'phone'|'whatsapp'; consent:true; source_page:string; campaign:string; request_id:string };
export function parseLegalContact(value:unknown):LegalContact|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const data=value as Record<string,unknown>;
 const text=(key:string,max:number)=>typeof data[key]==='string'?(data[key] as string).trim().split('').map(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127?' ':c).join('').slice(0,max):'';
 const name=text('name',80),company=text('company',120),phone=text('phone',22),channel=data.channel;
 if(name.length<2||company.length<2||!/^\+[1-9]\d{7,14}$/.test(phone)||!['phone','whatsapp'].includes(String(channel))||data.consent!==true||data.website||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(text('request_id',40)))return null;
 const page=text('source_page',40),campaign=text('campaign',40);
 return {name,company,phone,channel:channel as LegalContact['channel'],consent:true,source_page:['index','redvitalia','segunda-oportunidad','herencias','divorcios','manual','anuncios','medicion','privacidad','resource'].includes(page)?page:'resource',campaign:/^(e[1-5]_(feed|square|story|meta_(feed|square|story)|pmax_(wide|square|portrait))|meta_campaign|pmax_campaign)$/.test(campaign)?campaign:'direct',request_id:text('request_id',40)};
}
export function legalContactWebhook(value:string|undefined):URL|null {
 try{const url=new URL(value||'');return url.protocol==='https:'&&url.hostname==='services.leadconnectorhq.com'&&/^\/hooks\//.test(url.pathname)&&!url.username&&!url.password?url:null;}catch{return null;}
}
type Slot={count:number;until:number};
const rates=new Map<string,Slot>();
const received=new Map<string,{expires:number;signature:string}>();
export async function receiveLegalContact(request:Request,options:{webhook?:string;fetcher?:typeof fetch;now?:number}={}){
 const respond=(status:number,body:Record<string,unknown>)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 const origin=request.headers.get('origin');
 const trusted=new Set(['https://redvitalia.srv1480016.hstgr.cloud']);
 if(process.env.NODE_ENV!=='production'){trusted.add('http://localhost:3000');trusted.add('http://127.0.0.1:3000');}
 if(!origin||!trusted.has(origin))return respond(403,{accepted:false,error:'origin'});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return respond(415,{accepted:false,error:'content_type'});
 if(Number(request.headers.get('content-length'))>5000)return respond(413,{accepted:false,error:'size'});
 const now=options.now??Date.now();
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
 for(const [key,slot]of rates)if(slot.until<now)rates.delete(key);
 for(const [key,slot]of received)if(slot.expires<now)received.delete(key);
 const rate=rates.get(ip);if(rate&&rate.until>now&&rate.count>=6)return respond(429,{accepted:false,error:'rate_limit'});
 if(!rate&&rates.size>=2000)return respond(429,{accepted:false,error:'busy'});
 rates.set(ip,{count:(rate?.count||0)+1,until:rate?.until||now+600000});
 let parsed:LegalContact|null;
 try{
  const reader=request.body?.getReader();if(!reader)return respond(400,{accepted:false,error:'invalid'});
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>5000){await reader.cancel();return respond(413,{accepted:false,error:'size'});}chunks.push(part.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  parsed=parseLegalContact(JSON.parse(new TextDecoder().decode(bytes)));
 }catch{return respond(400,{accepted:false,error:'invalid'});}
 if(!parsed)return respond(400,{accepted:false,error:'invalid'});
 const webhook=legalContactWebhook(options.webhook??process.env.REDVITALIA_GHL_WEBHOOK_URL);
 if(!webhook)return respond(503,{accepted:false,error:'not_configured'});
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(parsed)));
 const signature=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const prior=received.get(parsed.request_id);
 if(prior){return prior.signature===signature?respond(200,{accepted:true}):respond(409,{accepted:false,error:'request_conflict'});}
 try{
  const response=await (options.fetcher??fetch)(webhook,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:parsed.name,companyName:parsed.company,phone:parsed.phone,contact_channel:parsed.channel,source:'RedVitalia · Abogados',source_page:parsed.source_page,campaign:parsed.campaign,tags:['redvitalia-abogados','canal-'+parsed.channel],contact_permission:'Solicitud expresa de atención comercial; no suscripción a campañas',consent_version:'rv-contact-v2',consent_at:new Date(now).toISOString(),request_id:parsed.request_id}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)return respond(502,{accepted:false,error:'delivery_failed'});
  if(received.size>=5000)received.delete(received.keys().next().value!);
  received.set(parsed.request_id,{expires:now+86400000,signature});return respond(200,{accepted:true});
 }catch{return respond(502,{accepted:false,error:'delivery_failed'});}
}
