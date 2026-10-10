import assert from 'node:assert/strict';
import {hasPrivateCredential} from './audit-client-secrets.mjs';
const base=process.argv[2]||'https://talentia-two.vercel.app';
if(!['talentia-two.vercel.app','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use only the Talentia production site or local test server.');
const result={target:base,checks:[]};
async function call(path,options={}){return fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(20000),...options});}
const login=await call('/login'),html=await login.text();assert.equal(login.status,200);
for(const [name,value]of [['x-content-type-options','nosniff'],['x-frame-options','DENY'],['referrer-policy','no-referrer']])assert.equal(login.headers.get(name),value);
const csp=login.headers.get('content-security-policy');assert.match(csp,/script-src 'self' 'nonce-([^']+)' 'strict-dynamic'/);
const nonce=csp.match(/'nonce-([^']+)'/)[1];assert.ok(html.includes(`nonce="${nonce}"`));assert.doesNotMatch(csp,/unsafe-eval/);
assert.notEqual((await call('/login')).headers.get('content-security-policy'),csp);result.checks.push('security headers, script nonce in HTML, nonce renewal');
for(const path of ['/api/workspace','/api/imports','/api/files/3c24b236-9109-40ff-ba35-4489811722d2'])assert.equal((await call(path)).status,401);
result.checks.push('anonymous workspace, import history and CV access denied');
for(const path of ['/api/ai','/api/candidates','/api/candidates/batch','/api/candidates/merge','/api/contacts/follow-up','/api/imports','/api/upload','/api/workspace','/auth/logout']){
 assert.equal((await call(path,{method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},body:'{}'})).status,403);
}
assert.equal((await call('/api/ai',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{}'})).status,401);
result.checks.push('foreign-origin mutations rejected, unauthenticated AI blocked before provider call');
const callback=await call('/auth/callback?next=https%3A%2F%2Fattacker.invalid');assert.ok(callback.status>=300&&callback.status<400);assert.equal(new URL(callback.headers.get('location'),base).origin,new URL(base).origin);
result.checks.push('authentication callback cannot redirect to a foreign origin');
const scripts=[...new Set([...html.matchAll(/src="([^\"]+\.js(?:\?[^\"]*)?)"/g)].map(m=>m[1]))];
for(const path of scripts){const url=new URL(path,base);assert.equal(url.origin,new URL(base).origin);const response=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);assert.equal(hasPrivateCredential(await response.text()),false);}
result.checks.push(`no private-key pattern in ${scripts.length} public login scripts`);
console.log(JSON.stringify(result,null,2));
