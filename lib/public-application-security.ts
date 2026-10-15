import {createHmac,timingSafeEqual} from 'node:crypto';

// Server-side defenses for the public application link. The secret (TALENTIA_PUBLIC_GATEWAY_SECRET) never
// reaches the browser; the database only knows its SHA-256 (private.gateway_keys).
export const FORM_MIN_MS=4000,FORM_MAX_MS=6*60*60*1000;
const hmac=(secret:string,value:string)=>createHmac('sha256',secret).update(value).digest('hex');

// On Vercel the platform sets x-real-ip / the first x-forwarded-for entry; anything else falls back to one shared bucket.
export function clientIp(headers:Headers){return (headers.get('x-real-ip')||headers.get('x-forwarded-for')?.split(',')[0]||'').trim().slice(0,100)||'unknown';}
// Only this keyed hash is stored, so the database never holds the raw IP and cannot reverse it without the secret.
export function clientHash(secret:string,ip:string){return hmac(secret,`ip:${ip}`);}

// Proves the form was opened by our server at least FORM_MIN_MS earlier (automated posts skip the page).
export function issueFormToken(secret:string,linkToken:string,now:number){return `${now}.${hmac(secret,`form:${linkToken}:${now}`)}`;}
export function checkFormToken(secret:string,linkToken:string,formToken:string,now:number):'ok'|'fast'|'expired'|'invalid'{
 const match=/^(\d{13})\.([a-f0-9]{64})$/.exec(formToken);if(!match)return 'invalid';
 const expected=Buffer.from(hmac(secret,`form:${linkToken}:${match[1]}`)),given=Buffer.from(match[2]);
 if(!timingSafeEqual(expected,given))return 'invalid';
 const age=now-Number(match[1]);
 if(age<FORM_MIN_MS)return 'fast';
 if(age>FORM_MAX_MS)return 'expired';
 return 'ok';
}

// Heuristic, not an antivirus: rejects PDFs that declare scripts, launch actions, attachments, rich media,
// XFA forms or encryption. Names may be hex-escaped (#4A → J). Content inside compressed object streams is not inspected.
const risky=[{pattern:/\/(JavaScript|JS)\b/,label:'scripts'},{pattern:/\/Launch\b/,label:'ações automáticas'},{pattern:/\/(EmbeddedFiles?|FileAttachment)\b/,label:'arquivos anexados'},{pattern:/\/RichMedia\b/,label:'mídia incorporada'},{pattern:/\/XFA\b/,label:'formulários XFA'},{pattern:/\/Encrypt\b/,label:'proteção por senha'}];
export function pdfRisks(bytes:Uint8Array):string[]{
 const text=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength).toString('latin1').replace(/\/[^\s/<>[\]()%]*/g,name=>name.replace(/#([0-9a-fA-F]{2})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16))));
 return risky.filter(r=>r.pattern.test(text)).map(r=>r.label);
}
