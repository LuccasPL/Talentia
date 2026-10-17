import {z} from 'zod';
import {owner,database,readData,checkOrigin,readJson,apiError,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import {planErasure,confirmsName,erasureGroup} from '@/lib/candidate-erasure';
import {deleteProviderBatches,erasureImportProofs} from '@/lib/import-server';
import {sweepFiles} from '@/lib/file-cleanup';
import {fileCleanupWarning,fileCleanupRetryResponse} from '@/lib/file-cleanup-workflow';
export const maxDuration=60;

export async function POST(request:Request){try{
 checkOrigin(request);const id=await owner();await enforceRateLimit('write');
 const input=z.object({candidateId:z.string().uuid(),version:z.number().int().positive(),confirmName:z.string().max(300)}).parse(await readJson(request,4096));
 const current=await readData(id);
 if(current.version!==input.version)throw new HttpError('Seu espaço mudou. Recarregue antes de excluir.',409);
 const primary=erasureGroup(current,input.candidateId)[0];
 const candidate=[...current.candidates,...(current.archivedCandidates||[])].find(c=>c.id===input.candidateId)||primary;
 if(!confirmsName(candidate,input.confirmName))throw new HttpError('Digite o nome completo do candidato para confirmar a exclusão.');
 const plan=planErasure(current,input.candidateId);
 const proofs=await erasureImportProofs(id,plan.ids,plan.fileKeys);
 const {data,error}=await (await database()).rpc('erase_candidate',{expected_version:current.version,candidate_ids:plan.ids,new_jobs:plan.jobs,new_records:plan.records,rewritten:plan.rewritten});
 if(error)throw new HttpError('Não foi possível excluir os dados. Nada foi apagado; tente novamente.',503);
 if(!data)throw new HttpError('Seu espaço mudou. Recarregue antes de excluir.',409);
 const result=data as {fileKeys:string[];batchIds:string[]};
 const [filesPending,batchesFailed]=await Promise.all([sweepFiles(id),deleteProviderBatches(id,result.batchIds||[],proofs)]);
 const warnings=[fileCleanupWarning(filesPending),batchesFailed?'Não foi possível confirmar a exclusão de todas as leituras no provedor de IA. Solicite suporte para conferir as pendências.':''].filter(Boolean);
 return Response.json({data:await readData(id),warnings},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e)}}

// Retries files left in the queue by an earlier erasure.
export async function PATCH(request:Request){try{
 checkOrigin(request);const id=await owner();await enforceRateLimit('write');
 return fileCleanupRetryResponse(await sweepFiles(id));
}catch(e){return apiError(e)}}
