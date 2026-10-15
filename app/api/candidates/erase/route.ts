import {z} from 'zod';
import {owner,database,readData,checkOrigin,readJson,apiError,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import {planErasure,confirmsName,erasureGroup} from '@/lib/candidate-erasure';
import {deleteProviderBatches} from '@/lib/import-server';
export const maxDuration=60;

// Removes queued files of this account from the private bucket; returns how many are still pending.
async function sweepFiles(id:string){
 const db=await database();
 const pending=await db.from('pending_file_deletions').select('file_key').eq('owner',id).limit(100);
 if(pending.error)return -1;
 const keys=pending.data.map(r=>r.file_key as string).filter(k=>k.startsWith(`${id}/`));
 if(!keys.length)return 0;
 const removed=await db.storage.from('curriculos').remove(keys);
 if(removed.error)return keys.length;
 // Storage reports what it deleted; files already gone are also safe to dequeue.
 await db.from('pending_file_deletions').delete().eq('owner',id).in('file_key',keys);
 return 0;
}

export async function POST(request:Request){try{
 checkOrigin(request);const id=await owner();await enforceRateLimit('write');
 const input=z.object({candidateId:z.string().uuid(),version:z.number().int().positive(),confirmName:z.string().max(300)}).parse(await readJson(request,4096));
 const current=await readData(id);
 if(current.version!==input.version)throw new HttpError('Seu espaço mudou. Recarregue antes de excluir.',409);
 const primary=erasureGroup(current,input.candidateId)[0];
 const candidate=[...current.candidates,...(current.archivedCandidates||[])].find(c=>c.id===input.candidateId)||primary;
 if(!confirmsName(candidate,input.confirmName))throw new HttpError('Digite o nome completo do candidato para confirmar a exclusão.');
 const plan=planErasure(current,input.candidateId);
 const {data,error}=await (await database()).rpc('erase_candidate',{expected_version:current.version,candidate_ids:plan.ids,new_jobs:plan.jobs,new_records:plan.records,rewritten:plan.rewritten});
 if(error)throw new HttpError('Não foi possível excluir os dados. Nada foi apagado; tente novamente.',503);
 if(!data)throw new HttpError('Seu espaço mudou. Recarregue antes de excluir.',409);
 const result=data as {fileKeys:string[];batchIds:string[]};
 const [filesPending,batchesFailed]=await Promise.all([sweepFiles(id),deleteProviderBatches(result.batchIds||[])]);
 const warnings=[filesPending!==0?'O arquivo do currículo será apagado do armazenamento na próxima tentativa.':'',batchesFailed?'A leitura guardada pelo provedor de IA não pôde ser apagada agora; ela expira automaticamente em até 29 dias.':''].filter(Boolean);
 return Response.json({data:await readData(id),warnings},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e)}}

// Retries files left in the queue by an earlier erasure.
export async function PATCH(request:Request){try{
 checkOrigin(request);const id=await owner();await enforceRateLimit('write');
 const pending=await sweepFiles(id);
 return Response.json({pending:Math.max(0,pending)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e)}}
