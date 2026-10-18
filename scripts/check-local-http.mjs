import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {once} from 'node:events';
// No credentials are inherited. The fake Supabase URL is never contacted without a session.
const env=Object.fromEntries(['PATH','Path','SYSTEMROOT','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
Object.assign(env,{NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:9',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictional_test_only',ANTHROPIC_API_KEY:'',TALENTIA_AI_USER_IDS:'',NEXT_TELEMETRY_DISABLED:'1'});
const base='http://127.0.0.1:4174';
try{await fetch(base,{signal:AbortSignal.timeout(500)});throw Error('A porta 4174 está ocupada. Pare o serviço antes do teste.')}catch(e){if(e.message.includes('ocupada'))throw e}
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','4174'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='';for(const stream of [server.stdout,server.stderr])stream.on('data',s=>{log=(log+s).slice(-4000)});
try{
 let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error(`Servidor encerrou antes do teste: ${log}`);try{const r=await fetch(base+'/login',{signal:AbortSignal.timeout(1000)});if(r.status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}assert.ok(ready,'Servidor local não ficou pronto.');
 const root=await fetch(base,{redirect:'manual'});assert.equal(root.status,307);assert.equal(new URL(root.headers.get('location'),base).pathname,'/login');
 const searchPage=await fetch(base+'/buscar',{redirect:'manual'});assert.equal(searchPage.status,307);assert.equal(new URL(searchPage.headers.get('location'),base).pathname,'/login');
 const login=await fetch(base+'/login');assert.equal(login.status,200);assert.match(await login.text(),/Bem-vinda ao seu espaço/);assert.match(login.headers.get('content-security-policy'),/script-src[^;]*'nonce-/);assert.equal(login.headers.get('x-frame-options'),'DENY');assert.equal(login.headers.get('x-content-type-options'),'nosniff');
 const paths=['/api/workspace','/api/candidates/search?query=ana','/api/candidates/vacancy-search?jobId=teste-vaga','/api/candidates/00000000-0000-4000-8000-000000000001','/api/candidate-refresh','/api/usage','/api/imports','/api/files/00000000-0000-4000-8000-000000000001'];
 for(const path of paths){const r=await fetch(base+path);assert.equal(r.status,401,`${path}: acesso anônimo`)}
 for(const path of ['/api/workspace','/api/candidates','/api/ai','/api/journey','/api/upload','/api/pipeline']){
  const headers={'Content-Type':'application/json',Origin:base};const same=await fetch(base+path,{method:'POST',headers,body:'{}'});assert.equal(same.status,401,`${path}: sem sessão`);
  const cross=await fetch(base+path,{method:'POST',headers:{...headers,Origin:'https://untrusted.invalid'},body:'{}'});assert.equal(cross.status,403,`${path}: origem externa`);
 }
 console.log(`HTTP local: login protegido, ${paths.length} consultas privadas, 6 escritas sem sessão/origem externa e cabeçalhos verificados. Nenhum banco real foi acessado.`);
}finally{if(server.exitCode===null){const done=once(server,'exit');server.kill();await done}}
