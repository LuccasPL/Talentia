import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpError,assertSameOrigin,boundedBody,readJson,readForm,contentSecurityPolicy,rateLimitOutcome} from '../lib/http-security.ts';
const origin='https://talentia-two.vercel.app';
const status=n=>e=>e instanceof HttpError&&e.status===n;
test('mutations reject absent, foreign and cross-site origins',()=>{
 for(const headers of [{},{origin:'https://attacker.invalid'},{origin,'sec-fetch-site':'cross-site'}])assert.throws(()=>assertSameOrigin(new Request(origin,{headers}),origin),status(403));
 assertSameOrigin(new Request(origin,{headers:{origin,'sec-fetch-site':'same-origin'}}),origin);
});
test('body cap checks actual bytes even with a forged or missing length',async()=>{
 for(const headers of [{},{'content-length':'1'},{'content-length':'500'}])await assert.rejects(boundedBody(new Request(origin,{method:'POST',body:'oversized',headers}),4),status(413));
 assert.equal((await boundedBody(new Request(origin,{method:'POST',body:'four'}),4)).byteLength,4);
});
test('JSON rejects wrong content type, malformed data and invalid UTF-8',async()=>{
 const request=body=>new Request(origin,{method:'POST',body,headers:{'content-type':'application/json'}});
 await assert.rejects(readJson(new Request(origin,{method:'POST',body:'{}'})),status(415));
 await assert.rejects(readJson(request('{')),status(400));
 await assert.rejects(readJson(request(new Uint8Array([0xff]))),status(400));
 assert.deepEqual(await readJson(request('{"ok":true}')),{ok:true});
});
test('multipart cap rejects oversized files before form decoding',async()=>{
 const form=new FormData();form.set('file',new File(['x'.repeat(500)],'test.pdf'));
 const encoded=new Response(form),bytes=await encoded.arrayBuffer();
 await assert.rejects(readForm(new Request(origin,{method:'POST',body:bytes,headers:encoded.headers}),128),status(413));
 const valid=new FormData();valid.set('file',new File(['%PDF-test'],'test.pdf'));
 assert.equal((await readForm(new Request(origin,{method:'POST',body:valid}))).get('file').name,'test.pdf');
});
test('rate denial uses 429 and retry time; missing counter data fails closed',()=>{
 rateLimitOutcome({allowed:true});
 assert.throws(()=>rateLimitOutcome({allowed:false,retry_after:42}),e=>status(429)(e)&&e.retryAfter===42);
 for(const value of [null,{},'ok'])assert.throws(()=>rateLimitOutcome(value),status(503));
});
test('production CSP admits only nonced scripts and the configured database origin',()=>{
 const policy=contentSecurityPolicy('random-nonce','https://db.supabase.co');
 assert.match(policy,/script-src 'self' 'nonce-random-nonce' 'strict-dynamic';/);
 assert.doesNotMatch(policy,/unsafe-eval|script-src[^;]*unsafe-inline|connect-src[^;]*\*/);
 assert.match(policy,/connect-src 'self' https:\/\/db.supabase.co wss:\/\/db.supabase.co;/);
 assert.match(policy,/object-src 'none'/);assert.match(policy,/frame-ancestors 'none'/);
});
