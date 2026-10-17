import {z} from 'zod';
import {apiError,database,owner,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import type {Candidate} from '@/lib/domain';

export const dynamic='force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const ownerId=await owner();
    await enforceRateLimit('read');
    const candidateId=z.string().uuid().parse((await params).id);
    const {data,error}=await(await database()).from('candidates').select('payload').eq('owner',ownerId).eq('id',candidateId).maybeSingle();
    if(error)throw new HttpError('Não foi possível abrir o perfil.',503);
    if(!data||!data.payload||typeof data.payload!=='object'||'mergedInto' in data.payload)throw new HttpError('Este perfil não está disponível.',404);
    return Response.json(data.payload as Candidate,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return apiError(error)}
}
