import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {database,HttpError,requireAiAccess} from './server';
import {SYSTEM} from './claude';
import {pdfSchema,pdfContent} from './pdf-extraction';
import {MAX_PDF_BYTES,batchExtraction} from './pdf-import';
import {candidateSchema} from './validation';
type StoredImport={id:string;owner:string;source:string;file_key:string;status:string;batch_id:string|null;batch_signature?:string;candidate_id:string;error:string;created_at:string};
function signature(row:StoredImport,batch:string){return createHmac('sha256',process.env.ANTHROPIC_API_KEY||'').update(JSON.stringify([row.owner,row.id,row.file_key,row.candidate_id,batch])).digest('hex');}
async function anthropic(path:string,init:RequestInit={}){
 if(!process.env.ANTHROPIC_API_KEY)throw new HttpError('Conecte o Claude para importar PDFs.',503);
 const response=await fetch(`https://api.anthropic.com/v1/messages/batches${path}`,{...init,cache:'no-store',headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new HttpError('Não foi possível consultar a leitura dos PDFs. Tente novamente em alguns instantes.',502);
 return response;
}
export async function listImports(owner:string){const db=await database();const result=await db.from('pdf_imports').select('id,source,status,error,created_at,checked_at,candidate_id').eq('owner',owner).order('created_at',{ascending:false}).limit(100);if(result.error)throw new HttpError('Não foi possível carregar as importações.',503);return result.data;}
export async function submitImport(row:StoredImport,bytes:Uint8Array){
 requireAiAccess(row.owner);const db=await database();
 // Only this compare-and-set winner may submit a paid request.
 const claim=await db.from('pdf_imports').update({status:'sending',error:''}).eq('owner',row.owner).eq('id',row.id).eq('status','failed').select('id');
 if(claim.error||!claim.data?.length)throw new HttpError('Este arquivo já está sendo processado.',409);
 try{
  const response=await anthropic('',{method:'POST',body:JSON.stringify({requests:[{custom_id:row.id,params:{model:process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5',max_tokens:12000,system:SYSTEM,messages:[{role:'user',content:pdfContent(bytes)}],output_config:{format:{type:'json_schema',schema:pdfSchema}}}}]})});
  const batch=await response.json() as {id:string};
  if(!/^msgbatch_[a-zA-Z0-9]+$/.test(batch.id))throw new HttpError('Resposta inválida ao iniciar a leitura.',502);
  const saved=await db.from('pdf_imports').update({status:'processing',batch_id:batch.id,batch_signature:signature(row,batch.id)}).eq('owner',row.owner).eq('id',row.id);
  if(saved.error)throw new HttpError('A leitura foi enviada, mas o acompanhamento não pôde ser salvo.',503);
 }catch(e){
  // A timeout may have reached the provider. Leave it in sending for recovery;
  // automatically resubmitting could create another paid batch.
  if(e instanceof HttpError&&e.status===502){await db.from('pdf_imports').update({status:'failed',error:e.message}).eq('owner',row.owner).eq('id',row.id);}
  else{await db.from('pdf_imports').update({error:'O envio precisa de verificação para evitar uma cobrança repetida. Não reenvie este PDF; solicite suporte.'}).eq('owner',row.owner).eq('id',row.id);}
  throw e;
 }
}
export async function syncImports(owner:string){
 requireAiAccess(owner);const db=await database();const pending=await db.from('pdf_imports').select('*').eq('owner',owner).eq('status','processing').order('checked_at',{ascending:true,nullsFirst:true}).limit(10);
 if(pending.error)throw new HttpError('Não foi possível conferir o processamento.',503);
 let completed=false;const deadline=Date.now()+60000;
 for(const row of pending.data as StoredImport[]){
  if(Date.now()>deadline)break;
  try{
   // Owner-editable metadata is never sufficient to authorize a provider batch.
   await db.from('pdf_imports').update({checked_at:new Date().toISOString()}).eq('owner',owner).eq('id',row.id);
   const expected=signature(row,row.batch_id||'');
   if(!row.batch_id||!/^msgbatch_[a-zA-Z0-9]+$/.test(row.batch_id)||!row.batch_signature||!/^[a-f0-9]{64}$/.test(row.batch_signature)||!timingSafeEqual(Buffer.from(row.batch_signature),Buffer.from(expected))){
    await db.from('pdf_imports').update({error:'O acompanhamento desta leitura precisa de verificação. Não reenvie o PDF; solicite suporte.'}).eq('owner',owner).eq('id',row.id);continue;
   }
   const batch=await (await anthropic(`/${row.batch_id}`)).json() as {processing_status:string};
   await db.from('pdf_imports').update({error:''}).eq('owner',owner).eq('id',row.id);
   if(batch.processing_status!=='ended')continue;
   const response=await anthropic(`/${row.batch_id}/results`);
   let candidate;
   try{const extracted=candidateSchema.pick({name:true,role:true,city:true,text:true,phone:true,email:true}).parse(batchExtraction(await response.text(),row.id));candidate=candidateSchema.parse({...extracted,id:row.candidate_id,source:row.source,updated:new Date().toISOString(),demo:false,fileKey:row.file_key});}
   catch{await db.from('pdf_imports').update({status:'failed',error:'O PDF não pôde ser lido por completo. Confira o arquivo e tente novamente.'}).eq('owner',owner).eq('id',row.id);continue;}
   const result=await db.rpc('complete_pdf_import',{import_id:row.id,new_payload:candidate});
   if(result.error)throw new HttpError('Não foi possível salvar o perfil. A leitura será recuperada na próxima atualização.',503);
   completed=true;
  }catch(e){
   // Keep the original batch so an interrupted check never incurs another paid submission.
   await db.from('pdf_imports').update({error:e instanceof HttpError?e.message:'A consulta demorou mais que o esperado. A Talentia tentará recuperar esta mesma leitura na próxima atualização.'}).eq('owner',owner).eq('id',row.id);
  }
 }
 return completed;
}
export async function retryImport(owner:string,id:string){
 const db=await database();const found=await db.from('pdf_imports').select('*').eq('owner',owner).eq('id',id).single();
 if(found.error||!found.data)throw new HttpError('Importação não encontrada.',404);
 const row=found.data as StoredImport;
 if(row.status!=='failed')throw new HttpError('Este arquivo não precisa de uma nova tentativa.',409);
 const file=await db.storage.from('curriculos').download(row.file_key);
 if(file.error||!file.data)throw new HttpError('Selecione novamente este PDF para concluir o envio.',409);
 if(file.data.size>MAX_PDF_BYTES)throw new HttpError('Selecione um PDF de até 2 MB.');
 await submitImport(row,new Uint8Array(await file.data.arrayBuffer()));
}
