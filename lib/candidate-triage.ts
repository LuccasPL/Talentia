import {z} from 'zod';
import {emptyRecord,type Candidate,type Data,type Job,type RecordData} from './domain.ts';
import {validInterviewDate} from './interview-invitation.ts';
export const triageLabels={avancar:'Avançar',investigar:'Investigar melhor','nao-seguir':'Não seguir nesta vaga'};
export const triageInputSchema=z.object({decision:z.enum(['avancar','investigar','nao-seguir']),reason:z.string().trim().min(5).max(3000),nextStep:z.string().trim().min(5).max(1000),dueOn:z.string().refine(s=>!s||validInterviewDate(s),'Data inválida.'),confirmed:z.literal(true)});
export type TriageInput=z.infer<typeof triageInputSchema>;
const entrySchema=triageInputSchema.omit({confirmed:true}).extend({sourceHash:z.string().regex(/^[a-f0-9]{64}$/),updated:z.string().datetime()});
export const triageSchema=entrySchema.extend({history:z.array(entrySchema).min(1).max(30)});
export type Triage=z.infer<typeof triageSchema>;
export function triageSource(candidate:Candidate,job:Job){const analysis=job.analyses.find(a=>a.candidateId===candidate.id);return JSON.stringify({candidate:{id:candidate.id,role:candidate.role,city:candidate.city,text:candidate.text},job:{id:job.id,description:job.description,conditions:job.conditions?{location:job.conditions.location,workMode:job.conditions.workMode,salary:job.conditions.salary,schedule:job.conditions.schedule,benefits:job.conditions.benefits,start:job.conditions.start}:undefined,criteria:job.criteria.map(c=>({id:c.id,text:c.text,kind:c.kind,priority:c.priority}))},evidence:analysis?.evidence.map(e=>({criterionId:e.criterionId,status:e.status,quote:e.quote,explanation:e.explanation,question:e.question}))||[]});}
export function saveTriage(data:Data,jobId:string,candidateId:string,input:unknown,sourceHash:string,at:string):Data{
 const candidate=data.candidates.find(c=>c.id===candidateId),job=data.jobs.find(j=>j.id===jobId);if(!candidate||!job)throw Error('A vaga ou o candidato não está disponível.');
 const body=triageInputSchema.parse(input),record=data.records.find(r=>r.jobId===jobId&&r.candidateId===candidateId)||emptyRecord(candidateId,jobId);
 if(record.triage?.history.length===30||record.events.length>=500)throw Error('O histórico da triagem atingiu o limite.');
 const entry=entrySchema.parse({...body,sourceHash,updated:at}),triage=triageSchema.parse({...entry,history:[...(record.triage?.history||[]),entry]});
 return {...data,records:[...data.records.filter(r=>r.jobId!==jobId||r.candidateId!==candidateId),{...record,triage,triageNeedsReview:false,reportNeedsReview:Boolean(record.report)||record.reportNeedsReview,events:[...record.events,{at,text:`Conclusão da triagem · ${triageLabels[body.decision]} · ${body.reason} · Próxima ação: ${body.nextStep}${body.dueOn?` · ${body.dueOn}`:''}`.slice(0,500)}]}]};
}
export function triageSummary(record:RecordData){const t=record.triage;return t?`TRIAGEM — DECISÃO DA RECRUTADORA\n${triageLabels[t.decision]}${record.triageNeedsReview?' · Revisão pendente':''}\nFundamento: ${t.reason}\nPróxima ação: ${t.nextStep}`:'';}
