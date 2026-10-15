import test from 'node:test';
import assert from 'node:assert/strict';
import {clientIp,clientHash,issueFormToken,checkFormToken,pdfRisks,FORM_MIN_MS,FORM_MAX_MS} from '../lib/public-application-security.ts';

const secret='s'.repeat(48),link='f'.repeat(64),now=Date.parse('2026-10-15T15:00:00Z');
const pdf=text=>new TextEncoder().encode(`%PDF-1.7\n${text}\n%%EOF`);

test('client hash is keyed, stable and never contains the IP',()=>{
 const a=clientHash(secret,'203.0.113.7');
 assert.match(a,/^[a-f0-9]{64}$/);assert.equal(a,clientHash(secret,'203.0.113.7'));
 assert.notEqual(a,clientHash('o'.repeat(48),'203.0.113.7'));assert.notEqual(a,clientHash(secret,'203.0.113.8'));
 assert.ok(!a.includes('203'));
});

test('client IP prefers the platform header and falls back to one shared bucket',()=>{
 assert.equal(clientIp(new Headers({'x-real-ip':'203.0.113.7','x-forwarded-for':'198.51.100.1'})),'203.0.113.7');
 assert.equal(clientIp(new Headers({'x-forwarded-for':'198.51.100.1, 10.0.0.1'})),'198.51.100.1');
 assert.equal(clientIp(new Headers()),'unknown');
});

test('form token rejects fast, stale, forged and cross-link submissions',()=>{
 const token=issueFormToken(secret,link,now);
 assert.equal(checkFormToken(secret,link,token,now+FORM_MIN_MS-1),'fast');
 assert.equal(checkFormToken(secret,link,token,now+FORM_MIN_MS),'ok');
 assert.equal(checkFormToken(secret,link,token,now+FORM_MAX_MS+1),'expired');
 assert.equal(checkFormToken(secret,'e'.repeat(64),token,now+FORM_MIN_MS),'invalid');
 assert.equal(checkFormToken('o'.repeat(48),link,token,now+FORM_MIN_MS),'invalid');
 assert.equal(checkFormToken(secret,link,`${now-60000}.${token.split('.')[1]}`,now+FORM_MIN_MS),'invalid');
 assert.equal(checkFormToken(secret,link,'',now),'invalid');
});

test('plain PDFs pass and risky features are named, including hex-escaped names',()=>{
 assert.deepEqual(pdfRisks(pdf('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj')),[]);
 assert.deepEqual(pdfRisks(pdf('<< /S /JavaScript /JS (app.alert(1)) >>')),['scripts']);
 assert.deepEqual(pdfRisks(pdf('<< /S /J#61vaScript >>')),['scripts']);
 assert.deepEqual(pdfRisks(pdf('<< /S /Launch /F (cmd.exe) >>')),['ações automáticas']);
 assert.deepEqual(pdfRisks(pdf('<< /Names << /EmbeddedFiles 3 0 R >> >>')),['arquivos anexados']);
 assert.deepEqual(pdfRisks(pdf('trailer << /Encrypt 9 0 R >>')),['proteção por senha']);
 assert.deepEqual(pdfRisks(pdf('<< /AcroForm << /XFA 5 0 R >> /RichMedia 1 >>')),['mídia incorporada','formulários XFA']);
 // Ordinary words in text streams that merely start with a risky prefix are not matches.
 assert.deepEqual(pdfRisks(pdf('<< /JSONData 1 >> (JavaScript developer)')),[]);
});
