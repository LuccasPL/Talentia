import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
// Report paths only. Never print a credential, even when the scan fails.
const patterns=[/sk-ant-[a-zA-Z0-9_-]{24,}/g,/\bre_[a-zA-Z0-9_-]{24,}/g,/sb_secret_[a-zA-Z0-9_-]{20,}/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g];
export function hasPrivateCredential(text,secrets=[]){
 if(secrets.some(value=>value.length>=16&&text.includes(value)))return true;
 if(patterns.some(pattern=>{pattern.lastIndex=0;return pattern.test(text);}))return true;
 for(const jwt of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
  try{if(JSON.parse(Buffer.from(jwt[1],'base64url').toString()).role==='service_role')return true;}catch{/* Not a valid JWT. */}
 }
 return false;
}
export async function scanDirectory(path,secrets=[]){
 let count=0;const findings=[];
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(?:js|json|map|html)$/.test(file)){count++;if(hasPrivateCredential(await readFile(file,'utf8'),secrets))findings.push(file);}}}
 await walk(path);return{count,findings};
}
if(process.argv[1]?.endsWith('audit-client-secrets.mjs')){
 let local='';try{local=await readFile('.env.local','utf8');}catch{/* CI has no local credentials. */}
 const secrets=[];
 for(const line of local.split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/);if(match&&!match[1].startsWith('NEXT_PUBLIC_')&&/(KEY|SECRET|TOKEN|PASSWORD)/.test(match[1]))secrets.push(match[2].trim().replace(/^['"]|['"]$/g,''));}
 for(const [name,value]of Object.entries(process.env))if(!name.startsWith('NEXT_PUBLIC_')&&/(KEY|SECRET|TOKEN|PASSWORD)/.test(name)&&value)secrets.push(value);
 const result=await scanDirectory('.next/static',secrets);
 console.log(JSON.stringify({clientFiles:result.count,privateCredentialFiles:result.findings}));
 if(result.findings.length)process.exitCode=1;
}
