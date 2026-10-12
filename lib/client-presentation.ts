import {z} from 'zod';
import type {Data} from './domain';
import {reportSections,type ReportSection} from './report-presentation.ts';
export const presentationRequest=z.object({jobId:z.string().min(1).max(100),candidateIds:z.array(z.string().uuid()).min(1).max(10),version:z.number().int().positive()}).superRefine((v,ctx)=>{if(new Set(v.candidateIds).size!==v.candidateIds.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Escolha perfis diferentes.'})});
export type PresentationOption={id:string;name:string;role:string;reason:string};
export type Presentation={jobId:string;title:string;client:string;preparedAt:string;version:number;profiles:{id:string;name:string;role:string;city:string;sections:ReportSection[]}[]};
export function presentationOptions(data:Data,jobId:string):PresentationOption[]{const records=new Map(data.records.filter(r=>r.jobId===jobId&&r.shortlisted).map(r=>[r.candidateId,r]));return data.candidates.filter(c=>records.has(c.id)).map(c=>{const r=records.get(c.id)!;return {id:c.id,name:c.name,role:c.role,reason:r.status==='Não contatar'?'Contato marcado como Não contatar.':!r.report.trim()?'Prepare e salve um parecer para este perfil.':r.reportNeedsReview?'Revise e salve novamente o parecer.':''}}).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));}
export function preparePresentation(data:Data,input:unknown,now=new Date().toISOString()):Presentation{
 const request=presentationRequest.parse(input);if(data.version!==request.version)throw Error('O espaço mudou. Recarregue esta página antes de preparar a apresentação.');
 const job=data.jobs.find(j=>j.id===request.jobId);if(!job)throw Error('Esta vaga não está disponível no seu espaço.');
 const options=new Map(presentationOptions(data,job.id).map(c=>[c.id,c]));
 const profiles=request.candidateIds.map(id=>{const option=options.get(id);if(!option)throw Error('Um perfil não está na lista de interesse desta vaga.');if(option.reason)throw Error(option.reason);const candidate=data.candidates.find(c=>c.id===id)!,record=data.records.find(r=>r.candidateId===id&&r.jobId===job.id)!;return {id:candidate.id,name:candidate.name,role:candidate.role,city:candidate.city,sections:reportSections(record.report)}});
 return {jobId:job.id,title:job.title,client:data.clients?.find(c=>c.id===job.clientId)?.name||'',preparedAt:now,version:request.version,profiles};
}
