import {z} from 'zod';
import {validateSearchPlan} from '@/lib/assisted-search';
import {apiError,database,owner,HttpError,checkOrigin,readJson} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import type {Candidate} from '@/lib/domain';
import type {VacancyCandidatePage} from '@/lib/vacancy-candidate-page';

export const dynamic='force-dynamic';

const inputSchema=z.object({
 jobId:z.string().min(1).max(100),plan:z.unknown(),mode:z.enum(['any','all']),
 query:z.string().max(120).default(''),city:z.string().max(80).default(''),experience:z.string().max(120).default(''),
 pending:z.enum(['all','contact','unverified-contact','unverified-location','location','interest','availability','not-contacted','not-analyzed','criteria']).default('all'),
 criterionId:z.string().max(100).default('all'),onlyEvidence:z.boolean().default(false),
 page:z.number().int().min(1).max(10000).default(1),sort:z.enum(['name','imported']).default('name'),selection:z.boolean().default(false)
});
const matchSchema=z.object({candidateId:z.string().min(1),groups:z.array(z.object({label:z.string().min(1).max(120),term:z.string().min(1).max(80),snippet:z.string().max(500),negated:z.boolean()})).min(1).max(8)});

export async function POST(request:Request){
 try{
  checkOrigin(request);
  await owner();
  await enforceRateLimit('read');
  const input=inputSchema.parse(await readJson(request,65536));
  const plan=validateSearchPlan(input.plan);
  const {data,error}=await(await database()).rpc('search_vacancy_candidate_assisted_page',{
   p_job_id:input.jobId,p_plan:plan,p_mode:input.mode,p_query:input.query,p_city:input.city,p_experience:input.experience,
   p_pending:input.pending,p_criterion_id:input.criterionId,p_only_evidence:input.onlyEvidence,
   p_page:input.page,p_sort:input.sort,p_selection:input.selection
  });
  if(error?.code==='PGRST202')throw new HttpError('A busca assistida paginada ainda não está disponível neste banco.',501);
  if(error||!data||typeof data!=='object'||Array.isArray(data))throw new HttpError('Não foi possível consultar os candidatos desta vaga.',503);
  const result=data as {total?:unknown;candidateIds?:unknown;candidates?:unknown;matches?:unknown};
  if(typeof result.total!=='number'||!Number.isSafeInteger(result.total)||!Array.isArray(result.candidateIds)||!Array.isArray(result.candidates)||!Array.isArray(result.matches))throw new HttpError('A consulta retornou dados inválidos.',503);
  if(result.candidateIds.some(id=>typeof id!=='string')||result.candidates.some(candidate=>!candidate||typeof candidate!=='object'||typeof candidate.id!=='string'))throw new HttpError('A consulta retornou perfis inválidos.',503);
  const ids=result.candidateIds as string[],candidates=result.candidates as Candidate[];
  const matches=z.array(matchSchema).parse(result.matches);
  if(matches.length!==candidates.length||matches.some((match,index)=>match.candidateId!==candidates[index].id))throw new HttpError('A consulta retornou trechos inválidos.',503);
  if(input.selection&&result.total<=100&&(ids.length!==result.total||candidates.length!==result.total||candidates.some((candidate,index)=>candidate.id!==ids[index])))throw new HttpError('Não foi possível carregar todos os perfis encontrados.',503);
  const response:VacancyCandidatePage={total:result.total,candidateIds:ids,candidates,page:input.page,pageSize:24,matches};
  return Response.json(response,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return apiError(error)}
}
