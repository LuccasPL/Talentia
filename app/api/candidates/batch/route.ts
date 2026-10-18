import {enforceRateLimit} from '@/lib/rate-limit';
import {readJson} from '@/lib/http-security';
import {z} from 'zod';
import {recordSchema,jobSchema,candidateSchema} from '@/lib/validation';
import {applyCandidateBatch} from '@/lib/candidate-batch';
import {owner,database,checkOrigin,apiError,HttpError} from '@/lib/server';
import type {Data} from '@/lib/domain';
export const dynamic='force-dynamic';
const inputSchema=z.object({jobId:z.string().min(1).max(100),candidateIds:z.array(z.string().uuid()).min(1).max(100).refine(ids=>new Set(ids).size===ids.length),version:z.number().int().positive(),action:z.enum(['shortlist','invitations']),settings:z.object({recruiter:z.string().trim().min(1).max(200),company:z.string().trim().max(200),roleTitle:z.string().trim().min(1).max(200),instructions:z.string().trim().max(2000)}).optional()});
export async function POST(request:Request){try{
 checkOrigin(request);const id=await owner();await enforceRateLimit('write');const input=inputSchema.parse(await readJson(request,262144));const db=await database();const stored=await db.from('workspaces').select('jobs,records,version').eq('owner',id).single();
 if(stored.error||!stored.data)throw new HttpError('Não foi possível carregar os dados da vaga.',503);
 const jobs=z.array(jobSchema).parse(stored.data.jobs),existingRecords=z.array(recordSchema).max(10000).parse(stored.data.records),version=z.number().int().positive().parse(stored.data.version);
 if(version!==input.version)throw new HttpError('Este espaço mudou em outra sessão. Recarregue a página antes de salvar.',409);
 const found=await db.from('candidates').select('payload').eq('owner',id).in('id',input.candidateIds).is('payload->>mergedInto',null);
 if(found.error)throw new HttpError('Não foi possível conferir os perfis selecionados.',503);
 const candidates=found.data.map(row=>candidateSchema.parse(row.payload));if(candidates.length!==input.candidateIds.length)throw new HttpError('Um dos candidatos não está disponível. Atualize a busca.',409);
 const current={jobs,records:existingRecords,candidates,version,clients:[],aiConfigured:true} as unknown as Data;
 let result;try{result=applyCandidateBatch(current,input.jobId,input.candidateIds,input.action,input.settings,new Date().toISOString());}catch(e){throw new HttpError((e as Error).message);}
 const records=z.array(recordSchema).max(10000).parse(result.records);
 if(result.summary.changed){const {data:updated,error}=await db.rpc('save_workspace',{expected_version:version,new_jobs:jobs,new_records:records});if(error)throw new HttpError('Não foi possível salvar as ações em lote.',503);if(!updated)throw new HttpError('Este espaço mudou em outra sessão. Recarregue a página antes de salvar.',409);}
 return Response.json({data:{records,version:version+(result.summary.changed?1:0)},summary:result.summary},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e)}}
