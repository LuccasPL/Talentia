import {z} from 'zod';
import {recordSchema} from '@/lib/validation';
import {applyCandidateBatch} from '@/lib/candidate-batch';
import {owner,readData,database,checkOrigin,apiError,HttpError} from '@/lib/server';
export const dynamic='force-dynamic';
const inputSchema=z.object({jobId:z.string().min(1).max(100),candidateIds:z.array(z.string().min(1).max(100)).min(1).max(100),version:z.number().int().positive(),action:z.enum(['shortlist','invitations']),settings:z.object({recruiter:z.string().trim().min(1).max(200),company:z.string().trim().max(200),roleTitle:z.string().trim().min(1).max(200),instructions:z.string().trim().max(2000)}).optional()});
export async function POST(request:Request){try{
 checkOrigin(request);const id=await owner();const input=inputSchema.parse(await request.json());const current=await readData(id);
 if(current.version!==input.version)throw new HttpError('Este espaço mudou em outra sessão. Recarregue a página antes de salvar.',409);
 let result;try{result=applyCandidateBatch(current,input.jobId,input.candidateIds,input.action,input.settings,new Date().toISOString());}catch(e){throw new HttpError((e as Error).message);}
 const records=z.array(recordSchema).max(10000).parse(result.records);
 if(result.summary.changed){const {data:updated,error}=await(await database()).rpc('save_workspace',{expected_version:input.version,new_jobs:current.jobs,new_records:records});if(error)throw new HttpError('Não foi possível salvar as ações em lote.',503);if(!updated)throw new HttpError('Este espaço mudou em outra sessão. Recarregue a página antes de salvar.',409);}
 return Response.json({data:await readData(id),summary:result.summary},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e)}}
