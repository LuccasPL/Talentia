import {z} from 'zod';
import {applyRefresh,type RefreshLink} from '@/lib/candidate-refresh';
import {owner,database,readData,checkOrigin,readJson,apiError,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
const columns='id,candidate_id,job_id,context,response,created_at,expires_at,submitted_at,reviewed_at,revoked_at,decision';
export async function GET(request:Request){try{const id=await owner();await enforceRateLimit('read');const candidate=z.string().uuid().optional().parse(new URL(request.url).searchParams.get('candidate')||undefined);let query=(await database()).from('candidate_refresh_links').select(columns).eq('owner',id);query=candidate?query.eq('candidate_id',candidate):query.not('submitted_at','is',null).is('reviewed_at',null);const {data,error}=await query.order('created_at',{ascending:false}).limit(candidate?30:100);if(error)throw new HttpError('Não foi possível carregar os pedidos de atualização.',503);return Response.json({links:data,serverTime:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})}catch(e){return apiError(e)}}
export async function POST(request:Request){try{checkOrigin(request);const id=await owner();await enforceRateLimit('write');const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('issue'),candidateId:z.string().uuid(),jobId:z.string().min(1).max(100),recruiter:z.string().trim().min(2).max(200),days:z.union([z.literal(3),z.literal(7),z.literal(14)])}),
 z.object({action:z.literal('revoke'),linkId:z.string().uuid()}),
 z.object({action:z.literal('apply'),linkId:z.string().uuid(),version:z.number().int().positive()}),
 z.object({action:z.literal('discard'),linkId:z.string().uuid()})
 ]).parse(await readJson(request,8192));const db=await database();
 if(input.action==='issue'){const current=await readData(id);if(!current.candidates.some(c=>c.id===input.candidateId&&!c.demo)||!current.jobs.some(j=>j.id===input.jobId))throw new HttpError('Escolha um candidato e uma vaga da sua base.');if(current.records.some(r=>r.candidateId===input.candidateId&&r.jobId===input.jobId&&r.status==='Não contatar'))throw new HttpError('Este contato está marcado como Não contatar.');const {data,error}=await db.rpc('issue_candidate_refresh',{candidate_id:input.candidateId,job_id:input.jobId,recruiter:input.recruiter,days:input.days});if(error||!data)throw new HttpError('Não foi possível criar o link. Confira a vaga e o contato.',503);return Response.json(data,{headers:{'Cache-Control':'no-store'}})}
 if(input.action==='revoke'){const {data,error}=await db.rpc('revoke_candidate_refresh',{link_id:input.linkId});if(error)throw new HttpError('Não foi possível cancelar o link.',503);if(!data)throw new HttpError('Este link já foi respondido ou cancelado.',409);return Response.json({ok:true})}
 const {data:link,error:lookup}=await db.from('candidate_refresh_links').select(columns).eq('owner',id).eq('id',input.linkId).maybeSingle();if(lookup)throw new HttpError('Não foi possível carregar a resposta.',503);if(!link?.response||link.reviewed_at)throw new HttpError('Esta resposta não está disponível para revisão.',409);
 const current=await readData(id);if(input.action==='apply'&&current.version!==input.version)throw new HttpError('Seu espaço mudou. Recarregue antes de revisar a resposta.',409);
 const next=input.action==='apply'?applyRefresh(current,link as RefreshLink,new Date().toISOString()):current;
 const {data:ok,error}=await db.rpc('review_candidate_refresh',{link_id:input.linkId,expected_version:current.version,new_payload:next.candidates.find(c=>c.id===link.candidate_id)||{},new_jobs:next.jobs,new_records:next.records,discard:input.action==='discard'});if(error)throw new HttpError('Não foi possível revisar a resposta.',503);if(!ok)throw new HttpError('Os dados mudaram. Recarregue antes de salvar.',409);
 return Response.json(await readData(id),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return apiError(e)}}
