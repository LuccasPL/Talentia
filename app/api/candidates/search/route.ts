import {z} from 'zod';
import {apiError,database,owner,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import type {CandidateSearchItem} from '@/lib/candidate-paged-search';

export const dynamic='force-dynamic';

const paramsSchema=z.object({
  query:z.string().max(120).default(''),
  city:z.string().max(80).default(''),
  experience:z.string().max(120).default(''),
  page:z.coerce.number().int().min(1).max(10000).default(1),
  sort:z.enum(['name','imported']).default('name')
});

export async function GET(request:Request){
  try{
    await owner();
    await enforceRateLimit('read');
    const url=new URL(request.url);
    const input=paramsSchema.parse(Object.fromEntries(['query','city','experience','page','sort'].filter(key=>url.searchParams.has(key)).map(key=>[key,url.searchParams.get(key)])));
    const {data,error}=await(await database()).rpc('search_candidate_page',{
      p_query:input.query,p_city:input.city,p_experience:input.experience,p_page:input.page,p_sort:input.sort
    });
    if(error||!data||typeof data!=='object'||Array.isArray(data))throw new HttpError('Não foi possível consultar os candidatos.',503);
    const result=data as {total?:unknown;candidates?:unknown};
    if(typeof result.total!=='number'||!Number.isSafeInteger(result.total)||!Array.isArray(result.candidates))throw new HttpError('A consulta retornou dados inválidos.',503);
    return Response.json({total:result.total,candidates:result.candidates as CandidateSearchItem[],page:input.page,pageSize:24},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return apiError(error)}
}
