import type {Candidate,Job,RecordData} from './domain';
export type ShortlistItem={candidate:Candidate;record:RecordData;analysis:Job['analyses'][number]|undefined};
export function shortlistItems(candidates:Candidate[],job:Job,records:RecordData[]):ShortlistItem[]{
 const saved=new Map(records.filter(r=>r.jobId===job.id&&r.shortlisted===true).map(r=>[r.candidateId,r])),analyses=new Map(job.analyses.map(a=>[a.candidateId,a]));
 return candidates.flatMap(candidate=>{const record=saved.get(candidate.id);return record?[{candidate,record,analysis:analyses.get(candidate.id)}]:[]}).sort((a,b)=>a.candidate.name.localeCompare(b.candidate.name,'pt-BR'));
}
export function filterShortlist(items:ShortlistItem[],query:string,status:string){
 const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const terms=clean(query).trim().split(/\s+/).filter(Boolean);
 return items.filter(i=>(status==='all'||i.record.status===status)&&terms.every(t=>clean(`${i.candidate.name} ${i.candidate.role} ${i.candidate.city}`).includes(t)));
}
export function shortlistRecord(record:RecordData,value:boolean,at:string):RecordData{
 if(Boolean(record.shortlisted)===value)return record;
 return {...record,shortlisted:value,events:[...record.events,{at,text:value?'Adicionado à lista de interesse desta vaga pela recrutadora':'Removido da lista de interesse desta vaga pela recrutadora'}]};
}
