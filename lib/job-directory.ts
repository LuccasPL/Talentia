import type {Data,Job} from './domain';

export const jobPreparationLabels=['Descrição da vaga','Revisão de critérios','Exploração dos candidatos'];
export type JobDirectoryItem={job:Job;clientName:string;people:number;shortlisted:number;reports:number;review:number};
export function jobDirectory(data:Data):JobDirectoryItem[]{
 const active=new Set(data.candidates.filter(c=>!c.mergedInto).map(c=>c.id));
 const clients=new Map((data.clients||[]).map(c=>[c.id,c]));
 const records=new Map<string,Map<string,Data['records'][number]>>();
 for(const record of data.records){if(!active.has(record.candidateId))continue;let group=records.get(record.jobId);if(!group){group=new Map();records.set(record.jobId,group)}group.set(record.candidateId,record)}
 return data.jobs.map(job=>{const saved=[...(records.get(job.id)?.values()||[])];const people=new Set(saved.map(r=>r.candidateId));for(const a of job.analyses)if(active.has(a.candidateId))people.add(a.candidateId);const client=job.clientId?clients.get(job.clientId):undefined;return {job,clientName:client?`${client.name}${client.archived?' (arquivado)':''}`:'Sem cliente vinculado',people:people.size,shortlisted:saved.filter(r=>r.shortlisted).length,reports:saved.filter(r=>r.report.trim()&&!r.reportNeedsReview).length,review:saved.filter(r=>r.report.trim()&&r.reportNeedsReview).length}});
}
export function filterJobDirectory(items:JobDirectoryItem[],query:string,stage:string,sort:string){
 const normalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 const timestamp=(v:string)=>{const n=Date.parse(v);return Number.isFinite(n)?n:0};
 return items.filter(i=>(stage==='all'||String(i.job.stage)===stage)&&words.every(w=>normalize(`${i.job.title} ${i.clientName}`).includes(w))).sort((a,b)=>sort==='name'?a.job.title.localeCompare(b.job.title,'pt-BR'):timestamp(b.job.updated)-timestamp(a.job.updated)||a.job.title.localeCompare(b.job.title,'pt-BR'));
}
