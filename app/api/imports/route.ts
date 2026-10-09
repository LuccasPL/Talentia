import {z} from 'zod';
import {owner,database,checkOrigin,apiError,HttpError,requireAiAccess,readData} from '@/lib/server';
import {listImports,submitImport,syncImports,retryImport} from '@/lib/import-server';
import {MAX_PDF_BYTES} from '@/lib/pdf-import';
export const maxDuration=300;
export async function GET(){try{return Response.json({imports:await listImports(await owner())},{headers:{'Cache-Control':'no-store'}})}catch(e){return apiError(e)}}
export async function PATCH(request:Request){try{checkOrigin(request);const id=await owner();requireAiAccess(id);const completed=await syncImports(id);return Response.json({imports:await listImports(id),...(completed?{data:await readData(id)}:{})})}catch(e){return apiError(e)}}
export async function POST(request:Request){try{
 checkOrigin(request);const id=await owner();requireAiAccess(id);
 if(!process.env.ANTHROPIC_API_KEY)throw new HttpError('Conecte o Claude para importar PDFs.',503);
 if(request.headers.get('content-type')?.includes('application/json')){const {importId}=z.object({importId:z.string().uuid()}).parse(await request.json());await retryImport(id,importId);return Response.json({imports:await listImports(id)})}
 const file=(await request.formData()).get('file');
 if(!(file instanceof File)||!file.size||file.size>MAX_PDF_BYTES)throw new HttpError('Selecione um PDF de até 2 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new HttpError('O arquivo não é um PDF válido.');
 const digest=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'),key=`${id}/${digest}.pdf`,db=await database();
 const existing=await db.from('candidates').select('id').eq('owner',id).eq('file_key',key).maybeSingle();if(existing.error)throw new HttpError('Não foi possível conferir arquivos repetidos.',503);if(existing.data)return Response.json({duplicate:true,imports:await listImports(id)});
 const previous=await db.from('pdf_imports').select('*').eq('owner',id).eq('file_key',key).maybeSingle();if(previous.error)throw new HttpError('Não foi possível conferir as importações.',503);
 if(previous.data){
  if(previous.data.status==='failed'){
   const oldFile=await db.storage.from('curriculos').download(key);
   if(oldFile.error){const uploaded=await db.storage.from('curriculos').upload(key,bytes,{contentType:'application/pdf',upsert:false});if(uploaded.error)throw new HttpError('Não foi possível guardar o PDF. Tente novamente.',409);}
   await submitImport(previous.data,bytes);return Response.json({imports:await listImports(id)});
  }
  return Response.json({duplicate:true,imports:await listImports(id)});
 }
 const row={id:crypto.randomUUID(),owner:id,source:file.name.slice(0,300),file_key:key,status:'failed',batch_id:null,candidate_id:crypto.randomUUID(),error:'Envio ainda não concluído.',created_at:new Date().toISOString()};
 const insert=await db.from('pdf_imports').insert(row);if(insert.error)throw new HttpError('Este PDF pode já estar na fila. Atualize o histórico.',409);
 const stored=await db.storage.from('curriculos').upload(key,bytes,{contentType:'application/pdf',upsert:false});
 if(stored.error){await db.from('pdf_imports').delete().eq('owner',id).eq('id',row.id);throw new HttpError('Não foi possível guardar o PDF. Tente selecionar o arquivo novamente.',409);}
 await submitImport(row,bytes);return Response.json({imports:await listImports(id)});
 }catch(e){return apiError(e)}}
