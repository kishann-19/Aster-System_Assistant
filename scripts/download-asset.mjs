import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {dirname} from 'node:path';import {createHash} from 'node:crypto';
const checksums=JSON.parse(await readFile(new URL('./asset-checksums.json',import.meta.url),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function downloadAsset(file,url){
 const expected=checksums[file];if(!expected)throw Error('Missing checksum: '+file);
 try{if(hash(await readFile(file))===expected)return}catch{}
 const r=await fetch(url,{signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error('Asset download failed: '+file);
 const bytes=Buffer.from(await r.arrayBuffer());if(hash(bytes)!==expected)throw Error('Asset integrity check failed: '+file+'. Check the upstream asset revision before updating checksums.');
 await mkdir(dirname(file),{recursive:true});const temporary=file+'.download';await writeFile(temporary,bytes);await rename(temporary,file);console.log('Verified '+file);
}
