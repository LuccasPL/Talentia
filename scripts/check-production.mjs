import assert from 'node:assert/strict';
const base=process.env.CHECK_URL||'https://talentia-two.vercel.app';
const root=await fetch(base,{redirect:'manual'});
assert.equal(root.status,307);
assert.equal(new URL(root.headers.get('location'),base).pathname,'/login');
const login=await fetch(base+'/login');
assert.equal(login.status,200);
const html=await login.text();
assert.match(html,/Bem-vinda ao seu espaço/);
assert.match(html,/type="email"/);
assert.match(html,/type="password"/);
assert.doesNotMatch(html,/Falta conectar o banco de dados/);
for(const path of ['/api/workspace','/api/files/00000000-0000-0000-0000-000000000000']){
 const response=await fetch(base+path);assert.equal(response.status,401);
 const body=await response.json();assert.match(body.error,/Entre na sua conta/);
}
for(const path of ['/api/workspace','/api/candidates','/api/ai','/api/upload']){
 const response=await fetch(base+path,{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,403);
}
const sameOrigin=await fetch(base+'/api/workspace',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
assert.equal(sameOrigin.status,401);
console.log('Passed: public login, Supabase configured, anonymous data access blocked, cross-origin requests rejected.');
