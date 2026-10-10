import {emptyRecord,type Data,type RecordData} from './domain.ts';
import {agendaItems,filterAgenda} from './interview-agenda.ts';
export function recruitmentOverview(data:Data,jobId:string,now:number){
 const jobs=data.jobs.filter(j=>jobId==='all'||j.id===jobId),people=new Map(data.candidates.map(c=>[c.id,c]));
 const records=new Map(data.records.map(r=>[`${r.jobId}:${r.candidateId}`,r]));
 const items=jobs.flatMap(job=>{
  const ids=new Set([...job.analyses.map(a=>a.candidateId),...data.records.filter(r=>r.jobId===job.id).map(r=>r.candidateId)]);
  return [...ids].flatMap(id=>{const candidate=people.get(id);if(!candidate)return [];
   const record:RecordData=records.get(`${job.id}:${id}`)||emptyRecord(id,job.id);
   return [{candidate,job,record}];
  });
 }).sort((a,b)=>a.candidate.name.localeCompare(b.candidate.name,'pt-BR')||a.job.title.localeCompare(b.job.title,'pt-BR'));
 const appointments=agendaItems(data.candidates,jobs,data.records),filters={period:'upcoming',status:'all',jobId:'all',query:''};
 return {items,people:new Set(items.map(i=>i.candidate.id)).size,waiting:items.filter(i=>i.record.status==='Contato realizado'),review:items.filter(i=>i.record.report.trim()&&i.record.reportNeedsReview),reports:items.filter(i=>i.record.report.trim()),upcoming:filterAgenda(appointments,filters,now),overdue:filterAgenda(appointments,{...filters,period:'overdue'},now)};
}
