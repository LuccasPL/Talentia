export class HttpError extends Error{
 status:number;retryAfter?:number;
 constructor(message:string,status=400,retryAfter?:number){super(message);this.status=status;this.retryAfter=retryAfter;}
}
export function assertSameOrigin(request:Request,expected:string){const origin=request.headers.get('origin');if(!origin||origin!==expected||request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError('Origem da solicitação não autorizada.',403);}
export async function boundedBody(request:Request,maxBytes:number):Promise<Uint8Array>{
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new HttpError('O conteúdo enviado excede o limite permitido.',413);
 if(!request.body)throw new HttpError('Envie o conteúdo da solicitação.');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpError('O conteúdo enviado excede o limite permitido.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function readJson(request:Request,maxBytes=256*1024):Promise<unknown>{
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new HttpError('Envie os dados no formato JSON.',415);
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedBody(request,maxBytes)));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError('O conteúdo JSON não é válido.');}
}
export async function readForm(request:Request,maxBytes=2*1024*1024+64*1024){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;'))throw new HttpError('Envie o arquivo como formulário.',415);
 const bytes=await boundedBody(request,maxBytes);try{return await new Response(bytes as BodyInit,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();}catch{throw new HttpError('O formulário enviado não é válido.');}
}
export function contentSecurityPolicy(nonce:string,supabaseUrl:string|undefined,dev=false){
 let connections="'self'";if(supabaseUrl){const url=new URL(supabaseUrl);if(url.protocol==='https:')connections+=` ${url.origin} ${url.origin.replace('https:','wss:')}`;}
 return `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src ${connections}${dev?' ws:':''}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';${dev?'':' upgrade-insecure-requests;'}`;
}
export function rateLimitOutcome(result:unknown){
 const r=result as {allowed?:boolean;retry_after?:number};
 if(!r||typeof r.allowed!=='boolean')throw new HttpError('Não foi possível verificar o limite de uso. Tente novamente.',503);
 if(!r.allowed)throw new HttpError('Limite de uso atingido. Aguarde antes de tentar novamente.',429,Math.max(1,Math.min(86400,Math.ceil(Number(r.retry_after)||60))));
}
