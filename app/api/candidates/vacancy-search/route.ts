import {z} from 'zod';
import {apiError,database,owner,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import type {Candidate} from '@/lib/domain';
import type {VacancyCandidatePage} from '@/lib/vacancy-candidate-page';

export const dynamic='force-dynamic';

const paramsSchema=z.object({
 jobId:z.string().min(1).max(100),
 query:z.string().max(120).default(''),
 city:z.string().max(80).default(''),
 experience:z.string().max(120).default(''),
 pending:z.enum(['all','contact','unverified-contact','unverified-location','location','interest','availability','not-contacted','not-analyzed','criteria']).default('all'),
 criterionId:z.string().max(100).default('all'),
 onlyEvidence:z.enum(['true','false']).default('false'),
 page:z.coerce.number().int().min(1).max(10000).default(1),
 sort:z.enum(['name','imported']).default('name'),
 selection:z.enum(['true','false']).default('false')
});

export async function GET(request:Request){
 try{
  await owner();
  await enforceRateLimit('read');
  const url=new URL(request.url);
  const keys=['jobId','query','city','experience','pending','criterionId','onlyEvidence','page','sort','selection'];
  const input=paramsSchema.parse(Object.fromEntries(keys.filter(key=>url.searchParams.has(key)).map(key=>[key,url.searchParams.get(key)])));
  const rpc=input.selection==='true'?'search_vacancy_candidate_selection':'search_vacancy_candidate_page';
  const params={
   p_job_id:input.jobId,p_query:input.query,p_city:input.city,p_experience:input.experience,
   p_pending:input.pending,p_criterion_id:input.criterionId,p_only_evidence:input.onlyEvidence==='true',
   ...(input.selection==='true'?{}:{p_page:input.page}),p_sort:input.sort
  };
  const {data,error}=await(await database()).rpc(rpc,params);
  if(error?.code==='PGRST202')throw new HttpError(input.selection==='true'?'A seleção paginada ainda não está disponível neste banco.':'A busca paginada ainda não está disponível neste banco.',501);
  if(error||!data||typeof data!=='object'||Array.isArray(data))throw new HttpError('Não foi possível consultar os candidatos desta vaga.',503);
  const result=data as {total?:unknown;candidateIds?:unknown;candidates?:unknown};
  if(typeof result.total!=='number'||!Number.isSafeInteger(result.total)||!Array.isArray(result.candidateIds)||!Array.isArray(result.candidates))throw new HttpError('A consulta retornou dados inválidos.',503);
  if(result.candidateIds.some(id=>typeof id!=='string')||result.candidates.some(candidate=>!candidate||typeof candidate!=='object'||typeof candidate.id!=='string'))throw new HttpError('A consulta retornou perfis inválidos.',503);
  if(input.selection==='true'){
   const ids=result.candidateIds as string[],candidates=result.candidates as Candidate[];
   if(result.total<=100&&(ids.length!==result.total||candidates.length!==result.total||candidates.some((candidate,index)=>candidate.id!==ids[index])))throw new HttpError('Não foi possível carregar todos os perfis encontrados.',503);
   return Response.json({total:result.total,candidateIds:result.candidateIds as string[],candidates:result.candidates as Candidate[]},{headers:{'Cache-Control':'private, no-store'}});
  }
  const response:VacancyCandidatePage={total:result.total,candidateIds:result.candidateIds as string[],candidates:result.candidates as Candidate[],page:input.page,pageSize:24};
  return Response.json(response,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return apiError(error)}
}
