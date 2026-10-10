import {z} from 'zod';
import {recordSchema} from '@/lib/validation';
import {emptyRecord} from '@/lib/domain';
import {recordFollowUp} from '@/lib/contact-follow-up';
import {owner,readData,database,checkOrigin,apiError,HttpError} from '@/lib/server';
export const dynamic='force-dynamic';
const schema=z.object({candidateId:z.string().min(1).max(100),jobId:z.string().min(1).max(100),version:z.number().int().positive(),action:z.enum(['schedule','complete','cancel']),date:z.string().max(10).default(''),note:z.string().max(2000).default('')});
export async function POST(request:Request){try{checkOrigin(request);const id=await owner(),input=schema.parse(await request.json()),current=await readData(id);
 if(current.version!==input.version)throw new HttpError('Este espaço mudou em outra sessão. Recarregue a página antes de salvar.',409);
 if(!current.candidates.some(c=>c.id===input.candidateId)||!current.jobs.some(j=>j.id===input.jobId))throw new HttpError('A vaga ou o candidato não está disponível.',404);
 const stored=current.records.find(r=>r.candidateId===input.candidateId&&r.jobId===input.jobId)||emptyRecord(input.candidateId,input.jobId);
 let next;try{next=recordSchema.parse(recordFollowUp(stored,input.action,input.date,input.note,new Date().toISOString()));}catch(e){throw new HttpError((e as Error).message);}
 const records=[...current.records.filter(r=>!(r.candidateId===input.candidateId&&r.jobId===input.jobId)),next];
 const {data:updated,error}=await(await database()).rpc('save_workspace',{expected_version:input.version,new_jobs:current.jobs,new_records:records});
 if(error)throw new HttpError('Não foi possível salvar o próximo contato.',503);if(!updated)throw new HttpError('Este espaço mudou em outra sessão. Recarregue a página antes de salvar.',409);
 return Response.json(await readData(id),{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e)}}
