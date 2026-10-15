import {z} from 'zod';
import {owner,database,readData,checkOrigin,readJson,apiError,HttpError,requireAiAccess} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import {listImports,submitImport} from '@/lib/import-server';
import {MAX_PDF_BYTES} from '@/lib/pdf-import';
export const maxDuration=300;
const linkColumns='id,job_id,context,created_at,expires_at,revoked_at,max_submissions,submission_count';
const applicationColumns='id,link_id,job_id,job_title,response,file_name,file_sha256,file_size,created_at,reviewed_at,decision,import_id';

export async function GET(){try{
 const id=await owner();await enforceRateLimit('read');const db=await database();
 const [links,applications]=await Promise.all([
  db.from('application_links').select(linkColumns).eq('owner',id).order('created_at',{ascending:false}).limit(30),
  db.from('candidate_applications').select(applicationColumns).eq('owner',id).is('reviewed_at',null).order('created_at',{ascending:false}).limit(100),
 ]);
 if(links.error||applications.error)throw new HttpError('Não foi possível carregar as candidaturas.',503);
 return Response.json({links:links.data,applications:applications.data,serverTime:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e)}}

export async function POST(request:Request){try{
 checkOrigin(request);const id=await owner();
 const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('issue'),jobId:z.string().min(1).max(100),recruiter:z.string().trim().min(2).max(200),days:z.union([z.literal(7),z.literal(14),z.literal(30)]),maxSubmissions:z.union([z.literal(10),z.literal(50),z.literal(200)])}),
  z.object({action:z.literal('revoke'),linkId:z.string().uuid()}),
  z.object({action:z.literal('discard'),applicationId:z.string().uuid()}),
  z.object({action:z.literal('accept'),applicationId:z.string().uuid()}),
 ]).parse(await readJson(request,8192));
 const db=await database();
 if(input.action==='issue'){
  await enforceRateLimit('write');
  if(!(await readData(id)).jobs.some(j=>j.id===input.jobId))throw new HttpError('Escolha uma vaga da sua base.');
  const {data,error}=await db.rpc('issue_application_link',{job_id:input.jobId,recruiter:input.recruiter,days:input.days,max_submissions:input.maxSubmissions});
  if(error||!data)throw new HttpError(error?.message.includes('too many links')?'Você já tem 20 links ativos. Cancele algum antes de criar outro.':'Não foi possível criar o link. Salve a vaga e tente novamente.',error?.message.includes('too many links')?409:503);
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }
 if(input.action==='revoke'){
  await enforceRateLimit('write');
  const {data,error}=await db.rpc('revoke_application_link',{link_id:input.linkId});
  if(error)throw new HttpError('Não foi possível cancelar o link.',503);if(!data)throw new HttpError('Este link já foi cancelado.',409);
  return Response.json({ok:true});
 }
 const found=await db.from('candidate_applications').select(applicationColumns).eq('owner',id).eq('id',input.applicationId).maybeSingle();
 if(found.error)throw new HttpError('Não foi possível carregar a candidatura.',503);
 if(!found.data||found.data.reviewed_at)throw new HttpError('Esta candidatura já foi revisada.',409);
 if(input.action==='discard'){
  await enforceRateLimit('write');
  const {data,error}=await db.rpc('review_application',{application_id:input.applicationId,accept:false,import_id:null});
  if(error)throw new HttpError('Não foi possível descartar a candidatura.',503);if(!data)throw new HttpError('Esta candidatura já foi revisada.',409);
  return Response.json({ok:true});
 }
 // Accept: the PDF enters the same paid, monitored import pipeline as a recruiter upload.
 requireAiAccess(id);await enforceRateLimit('upload');
 if(!process.env.ANTHROPIC_API_KEY)throw new HttpError('Conecte o Claude para importar o currículo.',503);
 const app=found.data,key=`${id}/${app.file_sha256}.pdf`;
 const [existing,previous]=await Promise.all([db.from('candidates').select('id').eq('owner',id).eq('file_key',key).maybeSingle(),db.from('pdf_imports').select('id').eq('owner',id).eq('file_key',key).maybeSingle()]);
 if(existing.error||previous.error)throw new HttpError('Não foi possível conferir arquivos repetidos.',503);
 if(existing.data||previous.data)throw new HttpError('Este PDF já está na sua base ou na fila de importação. Descarte a candidatura e confira o perfil existente.',409);
 const file=await db.rpc('application_file',{application_id:app.id});
 if(file.error||typeof file.data!=='string')throw new HttpError('O arquivo desta candidatura não está disponível.',409);
 const bytes=new Uint8Array(Buffer.from(file.data,'base64'));
 const digest=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
 if(bytes.length>MAX_PDF_BYTES||digest!==app.file_sha256)throw new HttpError('O arquivo desta candidatura não confere. Descarte e peça um novo envio.',409);
 const row={id:crypto.randomUUID(),owner:id,source:`Candidatura · ${app.file_name}`.slice(0,300),file_key:key,status:'failed',batch_id:null,candidate_id:crypto.randomUUID(),error:'Envio ainda não concluído.',created_at:new Date().toISOString()};
 const insert=await db.from('pdf_imports').insert(row);
 if(insert.error)throw new HttpError('Este PDF pode já estar na fila. Atualize o histórico de importações.',409);
 const stored=await db.storage.from('curriculos').upload(key,bytes,{contentType:'application/pdf',upsert:false});
 if(stored.error){const old=await db.storage.from('curriculos').download(key);if(old.error){await db.from('pdf_imports').delete().eq('owner',id).eq('id',row.id);throw new HttpError('Não foi possível guardar o PDF. Tente novamente.',409);}}
 const reviewed=await db.rpc('review_application',{application_id:app.id,accept:true,import_id:row.id});
 if(reviewed.error||!reviewed.data){await db.from('pdf_imports').delete().eq('owner',id).eq('id',row.id);throw new HttpError('Esta candidatura já foi revisada.',409);}
 // From here the application is accepted; a failed submission can be retried from the import history.
 let warning='';try{await submitImport(row,bytes)}catch(e){warning=e instanceof HttpError?e.message:'A leitura do PDF não pôde ser iniciada. Tente novamente pelo histórico de importações.'}
 return Response.json({ok:true,warning,imports:await listImports(id)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e)}}
