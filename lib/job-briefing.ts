import {z} from 'zod';
import type {Job} from './domain';
import {validInterviewDate} from './interview-invitation.ts';
import {brazilParts} from './interview-agenda.ts';

export const briefingPlanSchema=z.object({
 positions:z.number().int().min(1).max(10000).nullable(),
 presentationDue:z.string().refine(v=>!v||validInterviewDate(v),'Informe uma data válida.'),
 decisionMaker:z.string().trim().max(300),
 pendingNotes:z.string().trim().max(3000),
});
export type BriefingPlan=z.infer<typeof briefingPlanSchema>;
export const blankBriefingPlan:BriefingPlan={positions:null,presentationDue:'',decisionMaker:'',pendingNotes:''};
export function briefingChecklist(job:Job){
 const plan=job.briefingPlan,c=job.conditions;
 const items=[
  {label:'Perfil e responsabilidades',done:!!job.description.trim()},
  {label:'Critérios para a busca',done:job.criteria.length>0},
  {label:'Local de trabalho',done:!!c?.location?.trim()||c?.workMode==='Remoto'},
  {label:'Jornada e escala',done:!!c?.schedule?.trim()},
  {label:'Remuneração',done:!!c?.salary?.trim()},
  {label:'Quantidade de posições',done:!!plan?.positions},
  {label:'Prazo de apresentação',done:!!plan?.presentationDue},
  {label:'Quem decide pelo cliente',done:!!plan?.decisionMaker.trim()},
 ];
 return {items,completed:items.filter(i=>i.done).length,pending:items.filter(i=>!i.done),notes:plan?.pendingNotes||''};
}
export function presentationDeadline(job:Job,now:number){
 const due=job.briefingPlan?.presentationDue;
 if(!due||['preenchida','cancelada'].includes(job.lifecycle?.state||''))return null;
 const today=brazilParts(new Date(now).toISOString()).date;
 return {date:due,state:due<today?'atrasado':due===today?'hoje':'futuro'} as const;
}
