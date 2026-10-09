import type {Candidate,Data} from './domain';
export type VerifiedField='phone'|'email'|'city';
export type Verification={at:string;method:string};
export type CandidateChanges={name:string;role:string;city:string;phone:string;email:string;text:string};
export function updateCandidateData(data:Data,id:string,changes:CandidateChanges,confirmed:VerifiedField[],method:string,at:string):Data{
 const old=data.candidates.find(c=>c.id===id);if(!old)throw Error('Candidato não encontrado.');
 if(confirmed.some(field=>!changes[field].trim()))throw Error('Preencha o dado antes de registrar sua confirmação.');
 const changed=(Object.keys(changes) as (keyof CandidateChanges)[]).filter(key=>old[key]!==changes[key]);
 const verification={...old.verification};
 for(const field of ['phone','email','city'] as const){if(changed.includes(field))delete verification[field];if(confirmed.includes(field))verification[field]={at,method}}
 const candidate:Candidate={...old,...changes,originalText:old.originalText??old.text,editedAt:at,verification,changeLog:[...(old.changeLog||[]).slice(-99),{at,fields:changed,confirmed,method:confirmed.length?method:''}]};
 return {...data,candidates:data.candidates.map(c=>c.id===id?candidate:c),jobs:data.jobs.map(job=>changed.includes('text')?{...job,analyses:job.analyses.filter(a=>a.candidateId!==id)}:job),records:data.records.map(r=>r.candidateId===id&&changed.length&&r.report?{...r,reportNeedsReview:true}:r)};
}
