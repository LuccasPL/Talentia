import {enforceRateLimit} from '@/lib/rate-limit';
import {readJson} from '@/lib/http-security';
import {mergeCandidateData} from '@/lib/candidate-duplicates';
import {candidateMergeSchema,candidateRestoreSchema,recordSchema,jobSchema} from '@/lib/validation';
import {owner,readData,checkOrigin,apiError,database,HttpError} from '@/lib/server';
export async function POST(request:Request){try{
 checkOrigin(request);const id=await owner();await enforceRateLimit('write');const input=candidateMergeSchema.parse(await readJson(request,262144)),current=await readData(id);
 if(current.version!==input.version)throw new HttpError('Os dados mudaram em outra sessão. Recarregue antes de reunir os cadastros.',409);
 let next;try{next=mergeCandidateData(current,input.primaryId,input.secondaryId,input.choices,new Date().toISOString())}catch(e){throw new HttpError((e as Error).message)}
 next.records.forEach(r=>recordSchema.parse(r));next.jobs.forEach(j=>jobSchema.parse(j));
 const payload=next.candidates.find(c=>c.id===input.primaryId)!;
 const result=await (await database()).rpc('merge_candidates',{expected_version:input.version,primary_id:input.primaryId,secondary_id:input.secondaryId,new_payload:payload,new_jobs:next.jobs,new_records:next.records});
 if(result.error)throw new HttpError('Não foi possível reunir os cadastros. Os originais foram preservados.',503);
 if(!result.data)throw new HttpError('Os dados mudaram em outra sessão. Recarregue antes de confirmar.',409);
 return Response.json(await readData(id));
}catch(e){return apiError(e)}}
export async function PATCH(request:Request){try{
 checkOrigin(request);const id=await owner();await enforceRateLimit('write');const input=candidateRestoreSchema.parse(await readJson(request,262144));
 const result=await (await database()).rpc('restore_candidate',{expected_version:input.version,candidate_id:input.candidateId});
 if(result.error)throw new HttpError('Não foi possível restaurar o cadastro.',503);
 if(!result.data)throw new HttpError('Os dados mudaram. Recarregue antes de restaurar.',409);
 return Response.json(await readData(id));
}catch(e){return apiError(e)}}
