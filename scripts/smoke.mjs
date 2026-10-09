import assert from 'node:assert/strict';
const base=process.env.SMOKE_URL||'http://localhost:3010';
const home=await fetch(base,{redirect:'manual'});
assert.equal(home.status,307);
assert.equal(new URL(home.headers.get('location'),base).pathname,'/login');
const login=await fetch(`${base}/login`);
assert.equal(login.status,200);
assert.match(await login.text(),/Falta conectar o banco de dados/);
for(const path of ['/api/workspace','/api/files/00000000-0000-0000-0000-000000000000']){
 const response=await fetch(base+path);assert.equal(response.status,503);assert.match((await response.json()).error,/configurado/);
}
for(const path of ['/api/workspace','/api/candidates','/api/ai','/api/upload']){
 const response=await fetch(base+path,{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,403);
}
const sameOrigin=await fetch(`${base}/api/workspace`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
assert.equal(sameOrigin.status,503);
console.log('Passed: login redirect, setup screen, protected data routes, cross-origin rejection, no configuration bypass.');
