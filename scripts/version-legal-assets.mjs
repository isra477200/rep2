import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../public/abogados/',import.meta.url);
const files=(await readdir(base)).filter(n=>/\.(?:js|css|zip)$/.test(n)&&n!=='asset-versions.js').sort();
const versions={};
for(const file of files){const bytes=await readFile(new URL(file,base));versions[file]=createHash('sha256').update(file.endsWith('.zip')?bytes:bytes.toString('utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,16);}
const script='window.RedVitaliaAssetVersions=Object.freeze('+JSON.stringify(versions)+');\n';
await writeFile(new URL('asset-versions.js',base),script);
versions['asset-versions.js']=createHash('sha256').update(script).digest('hex').slice(0,16);
await writeFile(new URL('asset-versions.json',base),JSON.stringify(versions,null,2)+'\n');
for(const file of (await readdir(base)).filter(n=>n.endsWith('.html'))){
 let html=await readFile(new URL(file,base),'utf8');
 if(!html.includes('src="asset-versions.js'))html=html.replace('<script ', '<script src="asset-versions.js" defer></script><script ');
 html=html.replace(/\b(src|href)="([^"/?]+\.(?:js|css|zip))(?:\?[^"#]*)?"/g,(match,attribute,name)=>versions[name]?attribute+'="'+name+'?v='+versions[name]+'"':match);
 await writeFile(new URL(file,base),html);
}
console.log('Versioned legal scripts, styles and downloads by content hash.');
