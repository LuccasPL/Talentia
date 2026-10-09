import type {Candidate,RecordData} from './domain';
export const contactStatusLabels:Record<string,string>={'Não contatado':'Não contatado','Contato realizado':'Aguardando retorno','Respondeu':'Respondeu','Entrevista':'Entrevista','Selecionado':'Selecionado','Encerrado':'Encerrado','Não contatar':'Não contatar'};
export type ContactItem={candidate:Candidate;record:RecordData;lastUpdate:string};
export function contactItems(candidates:Candidate[],records:RecordData[],jobId:string):ContactItem[]{
 const current=new Map(records.filter(r=>r.jobId===jobId).map(r=>[r.candidateId,r]));
 return candidates.map(candidate=>{
 const record=current.get(candidate.id)||{candidateId:candidate.id,jobId,status:'Não contatado',interest:'Não confirmado',availability:'Não confirmada',notes:'',report:'',events:[]};
 const lastUpdate=record.events.reduce((latest,event)=>Date.parse(event.at)>(Date.parse(latest)||0)?event.at:latest,'');
 return {candidate,record,lastUpdate};
 }).sort((a,b)=>a.candidate.name.localeCompare(b.candidate.name,'pt-BR'));
}
export function filterContactItems(items:ContactItem[],query:string,status:string){
 const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return items.filter(item=>(status==='all'||item.record.status===status)&&terms.every(term=>normalize(`${item.candidate.name} ${item.candidate.city} ${item.candidate.role}`).includes(term)));
}
export function approachRecord(record:RecordData,at:string):RecordData{
 if(record.status!=='Não contatado')throw Error('A etapa deste contato mudou. Atualize a página antes de registrar a abordagem.');
 return {...record,status:'Contato realizado',events:[...record.events,{at,text:'Abordagem registrada pela recrutadora · Aguardando retorno'}]};
}
