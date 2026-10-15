import {normalize,type Candidate,type Data,type Job,type RecordData} from './domain.ts';

// Permanent erasure of one person (LGPD request). Everything derived from the profile goes together:
// archived duplicates merged into it, records and analyses in every vacancy, and snapshots of it kept in
// other profiles' merge history. Storage files, imports, applications and refresh links are removed by the
// database function; this module only prepares the workspace JSON so the transaction can verify it.
export type ErasurePlan={ids:string[];jobs:Job[];records:RecordData[];rewritten:{id:string;payload:Candidate}[];fileKeys:string[]};

export function erasureGroup(data:Data,candidateId:string){
 const all=[...data.candidates,...(data.archivedCandidates||[])];
 const primary=all.find(c=>c.id===candidateId);
 if(!primary||primary.mergedInto)throw Error('Abra o perfil principal para excluir os dados desta pessoa.');
 if(primary.demo)throw Error('Perfis de exemplo não ficam salvos e não precisam ser excluídos.');
 return all.filter(c=>c.id===candidateId||c.mergedInto===candidateId);
}

export function planErasure(data:Data,candidateId:string):ErasurePlan{
 const group=erasureGroup(data,candidateId),ids=group.map(c=>c.id),gone=new Set(ids);
 const jobs=data.jobs.map(job=>job.analyses.some(a=>gone.has(a.candidateId))?{...job,analyses:job.analyses.filter(a=>!gone.has(a.candidateId))}:job);
 const records=data.records.filter(r=>!gone.has(r.candidateId));
 // A profile restored after a merge can still live inside another profile's history.
 const rewritten=[...data.candidates,...(data.archivedCandidates||[])].filter(c=>!gone.has(c.id)&&c.mergeHistory?.some(h=>gone.has(h.candidate.id))).map(c=>({id:c.id,payload:{...c,mergeHistory:c.mergeHistory!.filter(h=>!gone.has(h.candidate.id))}}));
 const fileKeys=[...new Set(group.map(c=>c.fileKey).filter((k):k is string=>Boolean(k)))];
 return {ids,jobs,records,rewritten,fileKeys};
}

// The recruiter types the full name: accents, case and extra spaces do not matter.
export function confirmsName(candidate:Pick<Candidate,'name'>,typed:string){const clean=(s:string)=>normalize(s).replace(/\s+/g,' ').trim();return clean(typed).length>0&&clean(typed)===clean(candidate.name);}
