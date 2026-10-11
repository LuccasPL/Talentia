import {z} from 'zod';
import {emptyRecord,type Data,type Job} from './domain.ts';
import {updateCandidateData} from './candidate-update.ts';

export const conditionsSchema=z.object({location:z.string().trim().max(300).default(''),workMode:z.enum(['A combinar','Presencial','Híbrido','Remoto']).default('A combinar'),salary:z.string().trim().max(300).default(''),schedule:z.string().trim().max(500).default(''),benefits:z.string().trim().max(1000).default(''),start:z.string().trim().max(300).default('')});
export type JobConditions=z.infer<typeof conditionsSchema>;
export const blankConditions:JobConditions={location:'',workMode:'A combinar',salary:'',schedule:'',benefits:'',start:''};
export const refreshResponseSchema=z.object({phone:z.string().trim().max(100).refine(s=>!s||s.replace(/\D/g,'').length>=8,'Confira o telefone com DDD.'),email:z.union([z.literal(''),z.string().trim().email().max(300)]),city:z.string().trim().min(2).max(300),employment:z.enum(['Trabalhando','Sem trabalho no momento','Prefiro não informar']),interest:z.enum(['Interessado','Sem interesse','Quero mais detalhes']),availability:z.string().trim().min(2).max(1000),conditions:z.enum(['Compatíveis','Não compatíveis','Preciso esclarecer']),question:z.string().trim().max(2000),allowContact:z.boolean(),acknowledged:z.literal(true)}).refine(r=>Boolean(r.phone||r.email),'Informe pelo menos um meio de contato.');
export type RefreshResponse=z.infer<typeof refreshResponseSchema>;
export type RefreshLink={id:string;candidate_id:string;job_id:string;created_at:string;expires_at:string;submitted_at:string|null;reviewed_at:string|null;revoked_at:string|null;decision:'applied'|'discarded'|null;response:RefreshResponse|null;context:{title:string;recruiter:string;conditions:JobConditions}};
export function conditionsText(job:Job){const c=job.conditions;if(!c)return '';return [['Local',c.location],['Modalidade',c.workMode==='A combinar'?'':c.workMode],['Remuneração',c.salary],['Jornada e escala',c.schedule],['Benefícios',c.benefits],['Previsão de início',c.start]].filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join('\n');}
export function applyRefresh(data:Data,link:RefreshLink,at:string):Data{
 if(!link.response||!link.submitted_at||link.reviewed_at)throw Error('Esta resposta não está disponível para revisão.');
 const answer=refreshResponseSchema.parse(link.response),candidate=data.candidates.find(c=>c.id===link.candidate_id),job=data.jobs.find(j=>j.id===link.job_id);
 if(!candidate||!job)throw Error('A vaga ou o candidato não está mais disponível.');
 const next=updateCandidateData(data,candidate.id,{name:candidate.name,role:candidate.role,text:candidate.text,phone:answer.phone,email:answer.email,city:answer.city},[],'Resposta por link',at);
 // Possession of a link is not proof of phone/email ownership. Keep self-declaration distinct from verification.
 next.candidates=next.candidates.map(c=>c.id===candidate.id?{...c,selfDeclaration:{at:link.submitted_at!,employment:answer.employment}}:c);
 const old=next.records.find(r=>r.candidateId===candidate.id&&r.jobId===job.id)||emptyRecord(candidate.id,job.id);
 const record={...old,status:!answer.allowContact||old.status==='Não contatar'?'Não contatar':['Não contatado','Contato realizado'].includes(old.status)?'Respondeu':old.status,interest:answer.interest==='Quero mais detalhes'?'Não confirmado':answer.interest,availability:answer.availability,conditionsResponse:{at:link.submitted_at,answer:answer.conditions,question:answer.question,snapshot:link.context.conditions},reportNeedsReview:old.report?true:old.reportNeedsReview,events:[...old.events,{at,text:'Resposta declarada pelo candidato via link revisada e incorporada ao cadastro.'}].slice(-500)};
 next.records=[...next.records.filter(r=>!(r.candidateId===candidate.id&&r.jobId===job.id)),record];return next;
}
