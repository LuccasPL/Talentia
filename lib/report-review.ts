import type {Data,Job,RecordData} from './domain';

export type ReportApproval={candidateId:string;jobId:string};
export type ReportReview={sourceHash:string;reviewedAt:string};

// Stable object ordering survives a JSONB round-trip. Array order is meaningful.
function canonical(value:unknown):unknown {
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>[k,canonical(v)]));
 return value;
}
export function jobReportSource(job:Job){return {id:job.id,title:job.title,description:job.description,conditions:job.conditions,clientId:job.clientId,criteria:job.criteria,engine:job.engine};}
export function jobReportChanged(before:Job,after:Job){return JSON.stringify(canonical(jobReportSource(before)))!==JSON.stringify(canonical(jobReportSource(after)));}

/** Indexed once per workspace, not once per record. No raw source snapshot is stored. */
export function reportSources(data:Data){
 const candidates=new Map(data.candidates.map(c=>[c.id,c])),jobs=new Map(data.jobs.map(j=>[j.id,j])),clients=new Map((data.clients||[]).map(c=>[c.id,c.name]));
 const analyses=new Map(data.jobs.map(j=>[j.id,new Map(j.analyses.map(a=>[a.candidateId,a]))]));
 return (record:RecordData)=>{
  const c=candidates.get(record.candidateId),j=jobs.get(record.jobId);
  if(!c||!j)return null;
  return JSON.stringify(canonical({schema:1,job:jobReportSource(j),client:j.clientId?clients.get(j.clientId)||'': '',candidate:{id:c.id,name:c.name,role:c.role,city:c.city,text:c.text,phone:c.phone,email:c.email,source:c.source,cvSourceId:c.cvSourceId,selfDeclaration:c.selfDeclaration},analysis:analyses.get(j.id)?.get(c.id),record:{interest:record.interest,availability:record.availability,notes:record.notes,conditionsResponse:record.conditionsResponse,triage:record.triage,evaluation:record.evaluation,interview:record.interview?{items:record.interview.items}:undefined},report:record.report}));
 };
}

export function reportReviewNeeded(record:RecordData,sourceHash:string|null){
 return Boolean(record.report.trim()&&(record.reportNeedsReview||!sourceHash||!record.reportReview||record.reportReview.sourceHash!==sourceHash));
}

/** The caller supplies server-computed hashes; browser-provided review metadata is ignored. */
export function reconcileReportReviews(current:Data,next:Data,hash:(record:RecordData)=>string|null,approved:ReportApproval|undefined,at:string):RecordData[]{
 const oldRecords=new Map(current.records.map(r=>[JSON.stringify([r.candidateId,r.jobId]),r]));
 if(approved&&!next.records.some(r=>r.candidateId===approved.candidateId&&r.jobId===approved.jobId&&r.report.trim()))throw Error('Abra um parecer preenchido para registrar a revisão.');
 return next.records.map(record=>{
  if(!record.report.trim())return {...record,reportReview:undefined,reportNeedsReview:false};
  const sourceHash=hash(record),old=oldRecords.get(JSON.stringify([record.candidateId,record.jobId]));
  if(approved?.candidateId===record.candidateId&&approved.jobId===record.jobId){
   if(!sourceHash)throw Error('A vaga ou o candidato não está disponível para revisar este parecer.');
   return {...record,reportNeedsReview:false,reportReview:{sourceHash,reviewedAt:at}};
  }
  const preserved={...record,reportReview:old?.reportReview,reportNeedsReview:Boolean(old?.reportNeedsReview||record.reportNeedsReview)};
  return {...preserved,reportNeedsReview:reportReviewNeeded(preserved,sourceHash)};
 });
}
