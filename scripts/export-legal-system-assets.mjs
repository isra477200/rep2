import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {platforms,destination} from './legal-system-campaigns.mjs';
const source=process.argv[2];
if(!source)throw new Error('Pass the generated master directory as the first argument.');
const out=fileURLToPath(new URL('../public/abogados/ads/',import.meta.url));
await mkdir(path.join(out,'images'),{recursive:true});await mkdir(path.join(out,'previews'),{recursive:true});
const assets=[];
for(const [platform,data] of Object.entries(platforms))for(const [format,[width,height]] of Object.entries(data.formats))for(let i=1;i<=5;i++){
 const folder=format==='square'?'square':format==='story'?'meta-story':format==='wide'?'pmax-wide':format==='portrait'?'pmax-portrait':'meta-feed';
 const input=await readFile(path.join(source,folder,`S${i}.png`));
 const meta=await sharp(input).metadata();
 if(Math.abs(meta.width/meta.height-width/height)>.005)throw new Error(`Unexpected master ratio: ${folder}/S${i}`);
 const id=`E${i}`,base=`redvitalia_${id}_${platform}_${format}`;
 // Format-only resampling of the approved image; never crop or redraw its content.
 const png=await sharp(input).resize(width,height,{fit:'fill'}).png({compressionLevel:9}).toBuffer();
 if(png.length>5*1024*1024)throw new Error(`${base} exceeds the 5 MB image limit`);
 await writeFile(path.join(out,'images',base+'.png'),png);
 await sharp(png).resize({width:600,withoutEnlargement:true}).webp({quality:87}).toFile(path.join(out,'previews',base+'.webp'));
 assets.push({id,platform,format,width,height,bytes:png.length,file:'images/'+base+'.png',preview:'previews/'+base+'.webp',destination:destination(platform,id,format)});
}
await writeFile(path.join(out,'assets.json'),JSON.stringify(assets,null,2));
console.log(JSON.stringify({exports:assets.length,bytes:assets.reduce((n,a)=>n+a.bytes,0)}));
