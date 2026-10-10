import type {Candidate,Data,RecordData} from './domain';
import {normalize,emptyRecord} from './domain.ts';
import type {CandidateChanges} from './candidate-update';
export const mergeFields=['name','role','city','phone','email','text'] as const;
export type MergeChoices=Record<(typeof mergeFields)[number],'primary'|'secondary'>;
export const defaultMergeChoices:MergeChoices={name:'primary',role:'primary',city:'primary',phone:'primary',email:'primary',text:'primary'};
export const mergeFieldLabels={name:'Nome',role:'Cargo ou objetivo',city:'Localização',phone:'Telefone',email:'E-mail',text:'Experiências do currículo'};
export type DuplicatePair={first:Candidate;second:Candidate;reasons:string[]};
export function preservedVersions(data:Data,candidate:Candidate){
 const related=[candidate,...(data.archivedCandidates||[]).filter(c=>c.mergedInto===candidate.id)];
 const current=data.candidates.find(c=>c.id===candidate.cvSourceId);
 if(current&&!related.some(c=>c.id===current.id))related.push(current);
 return related;
}
const nameKey=(s:string)=>normalize(s).replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
function phoneKey(s:string){let digits=s.replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if((digits.length===12||digits.length===13)&&digits.startsWith('55'))digits=digits.slice(2);return digits.length>=10&&digits.length<=15&&!/^(\d)\1+$/.test(digits)?digits:'';}
function emailKey(s:string){const value=s.trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value:'';}
export function duplicatePairs(candidates:Candidate[],query='',limit=200){
 const groups=new Map<string,Candidate[]>(),pairs=new Map<string,DuplicatePair>();
 for(const c of candidates.filter(c=>!c.mergedInto&&!c.demo)){
  const name=nameKey(c.name);
  for(const [kind,key] of [['E-mail igual',emailKey(c.email)],['Telefone igual',phoneKey(c.phone)],['Nome completo igual',name.split(' ').length>=2?name:'']]){
   if(!key)continue;const token=`${kind}:${key}`;const group=groups.get(token)||[];group.push(c);groups.set(token,group);
  }
 }
 let limited=false;
 for(const [token,group] of [...groups].sort(([a],[b])=>Number(a.startsWith('Nome'))-Number(b.startsWith('Nome')))){ 
  const first=group[0];
  for(const second of group.slice(1)){
   if(query&&!normalize(`${first.name} ${second.name} ${first.email} ${second.email} ${first.phone} ${second.phone}`).includes(normalize(query.trim())))continue;
   const key=[first.id,second.id].sort().join(':');const pair=pairs.get(key);
   if(pair){pair.reasons.push(token.split(':')[0]);continue;}
   if(pairs.size>=limit){limited=true;continue;}
   pairs.set(key,{first,second,reasons:[token.split(':')[0]]});
  }
 }
 return {pairs:[...pairs.values()].sort((a,b)=>b.reasons.length-a.reasons.length),limited};
}
function combinedText(first:string,second:string,label:string){return !second||first===second?first:!first?second:`${first}\n\n${label}\n${second}`;}
function uniqueById<T extends {id:string}>(items:T[]){const seen=new Set<string>();return items.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true});}
function mergeRecords(primary:RecordData,secondary:RecordData,source:Candidate,at:string):RecordData{
 const notes=combinedText(primary.notes,secondary.notes,`Registro anterior · ${source.name}`);
 const report=combinedText(primary.report,secondary.report,`PARECER ANTERIOR · ${source.name} · REVISAR`);
 const appointments=uniqueById([...(primary.appointments||[]),...(secondary.appointments||[])]);
 const items=uniqueById([...(primary.interview?.items||[]),...(secondary.interview?.items||[])]);
 const events=[...primary.events,...secondary.events,{at,text:`Cadastros reunidos após revisão · ${source.name}`}];
 if(notes.length>20000||report.length>80000||appointments.length>30||items.length>60||events.length>500)throw Error('O histórico excede o limite de união. Mantenha os cadastros separados para preservar todos os dados.');
 return {...primary,status:primary.status==='Não contatar'||secondary.status==='Não contatar'?'Não contatar':primary.status==='Não contatado'?secondary.status:primary.status,
  interest:primary.interest==='Não confirmado'?secondary.interest:primary.interest,
  availability:primary.availability==='Não confirmada'?secondary.availability:primary.availability,
  notes,report,reportNeedsReview:Boolean(report),shortlisted:Boolean(primary.shortlisted||secondary.shortlisted),
  invitation:primary.invitation||secondary.invitation,
  followUp:primary.followUp&&!primary.followUp.completedAt?primary.followUp:secondary.followUp&&!secondary.followUp.completedAt?secondary.followUp:primary.followUp||secondary.followUp,
  lastContactAt:[primary.lastContactAt,secondary.lastContactAt].filter(Boolean).sort().at(-1),
  interview:items.length?{...(primary.interview||secondary.interview!),items,updated:at}:undefined,
  appointments,events};
}
export function mergeCandidateData(data:Data,primaryId:string,secondaryId:string,choices:MergeChoices,at:string):Data{
 if(primaryId===secondaryId)throw Error('Selecione dois cadastros diferentes.');
 const primary=data.candidates.find(c=>c.id===primaryId),secondary=data.candidates.find(c=>c.id===secondaryId);
 if(!primary||!secondary||primary.mergedInto||secondary.mergedInto)throw Error('Um dos cadastros não está disponível. Atualize a página.');
 if(secondary.mergeHistory?.length||data.archivedCandidates?.some(c=>c.mergedInto===secondaryId))throw Error('Este cadastro já reúne outras versões. Mantenha-o como principal.');
 const changes={} as CandidateChanges;for(const field of mergeFields)changes[field]=(choices[field]==='secondary'?secondary:primary)[field];
 const verification={...primary.verification};for(const field of ['phone','email','city'] as const)if(primary[field]!==changes[field])delete verification[field];
 const snapshotCandidate={...primary};delete snapshotCandidate.mergeHistory;
 const mergeHistory=[...(primary.mergeHistory||[]),{at,candidate:snapshotCandidate,records:data.records.filter(r=>r.candidateId===primaryId),analyses:data.jobs.flatMap(j=>j.analyses.filter(a=>a.candidateId===primaryId).map(analysis=>({jobId:j.id,analysis})))}];
 if(mergeHistory.length>50||JSON.stringify(mergeHistory).length>2000000)throw Error('O histórico de versões excede o limite de união. Mantenha os cadastros separados.');
 const updated:Candidate={...primary,...changes,mergeHistory,originalText:primary.originalText??primary.text,editedAt:at,verification,cvSourceId:choices.text==='secondary'?(secondary.cvSourceId||secondary.id):primary.cvSourceId,
  changeLog:[...(primary.changeLog||[]).slice(-99),{at,fields:mergeFields.filter(f=>primary[f]!==changes[f]),confirmed:[],method:'União de cadastros'}]};
 let records=[...data.records];
 for(const record of data.records.filter(r=>r.candidateId===secondaryId)){
  const existing=records.find(r=>r.candidateId===primaryId&&r.jobId===record.jobId)||emptyRecord(primaryId,record.jobId);
  const merged=mergeRecords(existing,record,secondary,at);
  records=[...records.filter(r=>!(r.candidateId===primaryId&&r.jobId===record.jobId)),merged];
 }
 records=records.map(r=>r.candidateId===primaryId&&r.report?{...r,reportNeedsReview:true}:r);
 return {...data,candidates:data.candidates.filter(c=>c.id!==secondaryId).map(c=>c.id===primaryId?updated:c),
  archivedCandidates:[...(data.archivedCandidates||[]),{...secondary,mergedInto:primaryId,mergedAt:at}],records,
  jobs:data.jobs.map(j=>({...j,analyses:j.analyses.filter(a=>a.candidateId!==primaryId)}))};
}
