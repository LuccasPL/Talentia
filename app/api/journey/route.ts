import {z} from 'zod';
import {owner,readData,database,checkOrigin,readJson,apiError,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import {jobSchema,recordSchema} from '@/lib/validation';
import {saveReportReviews} from '@/lib/report-review-server';
import {evaluationHash} from '@/lib/journey-server';
import {changeJobLifecycle,saveEvaluation,recordClientAction,evaluationInputSchema,clientInputSchema} from '@/lib/recruitment-journey';
import {emptyRecord} from '@/lib/domain';
const base={version:z.number().int().positive(),jobId:z.string().min(1).max(100)};
const inputSchema=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('job'),state:z.enum(['rascunho','aberta','pausada','preenchida','cancelada']),note:z.string().trim().max(2000)}),
 z.object({...base,action:z.literal('evaluation'),candidateId:z.string().uuid(),evaluation:evaluationInputSchema}),
 z.object({...base,action:z.literal('client'),candidateId:z.string().uuid(),entry:clientInputSchema})
]);
export async function POST(request:Request){try{checkOrigin(request);const ownerId=await owner();await enforceRateLimit('write');const input=inputSchema.parse(await readJson(request,262144)),current=await readData(ownerId);if(input.version!==current.version)throw new HttpError('O espaço mudou em outra sessão. Recarregue antes de salvar.',409);const at=new Date().toISOString();let next;
 try{if(input.action==='job')next=changeJobLifecycle(current,input.jobId,input.state,input.note,at);else if(input.action==='evaluation'){const record=current.records.find(r=>r.jobId===input.jobId&&r.candidateId===input.candidateId)||emptyRecord(input.candidateId,input.jobId);const hash=evaluationHash(current,record);if(!hash)throw Error('Vaga ou candidato não encontrado.');next=saveEvaluation(current,input.jobId,input.candidateId,input.evaluation,hash,at);}else next=recordClientAction(current,input.jobId,input.candidateId,input.entry,at,crypto.randomUUID());}catch(e){if(e instanceof z.ZodError)throw e;throw new HttpError((e as Error).message);}
 next.records=saveReportReviews(current,next);next.jobs.forEach(j=>jobSchema.parse(j));next.records.forEach(r=>recordSchema.parse(r));if(next.records.length>10000||JSON.stringify({jobs:next.jobs,records:next.records}).length>2500000)throw new HttpError('O histórico atingiu o limite de tamanho deste espaço.');
 const result=await(await database()).rpc('save_workspace',{expected_version:input.version,new_jobs:next.jobs,new_records:next.records});if(result.error)throw new HttpError('Não foi possível salvar o andamento do processo.',503);if(!result.data)throw new HttpError('O espaço mudou em outra sessão. Recarregue antes de salvar.',409);return Response.json(await readData(ownerId),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return apiError(e)}}
