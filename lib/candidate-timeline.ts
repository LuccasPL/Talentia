import type {Data} from './domain';

export type TimelineEntry={id:string;at:string;text:string;scope:string;context:string};
const fieldNames:Record<string,string>={name:'Nome',role:'Cargo ou área',city:'Localização',phone:'Telefone',email:'E-mail',text:'Experiências'};
export function candidateTimeline(data:Data,candidateId:string):TimelineEntry[]{
 const candidate=data.candidates.find(c=>c.id===candidateId&&!c.mergedInto);
 if(!candidate)return [];
 const jobs=new Map(data.jobs.map(j=>[j.id,j]));
 const result:TimelineEntry[]=[];
 if(candidate.updated)result.push({id:`import:${candidate.id}`,at:candidate.updated,text:'Entrada do perfil na base.',scope:'profile',context:'Cadastro do candidato'});
 for(const [index,change] of (candidate.changeLog||[]).entries()){
  const edited=change.fields.map(f=>fieldNames[f]||'Outro campo').join(', '),confirmed=change.confirmed.map(f=>fieldNames[f]||'Outro campo').join(', ');
  result.push({id:`change:${candidate.id}:${index}`,at:change.at,text:[edited?`Dados alterados: ${edited}.`:'',confirmed?`Dados confirmados: ${confirmed}.`:'',change.method?`Método registrado: ${change.method}.`:''].filter(Boolean).join(' ')||'Atualização do cadastro registrada.',scope:'profile',context:'Cadastro do candidato'});
 }
 if(candidate.selfDeclaration?.at)result.push({id:`declaration:${candidate.id}`,at:candidate.selfDeclaration.at,text:'Declaração do candidato incorporada ao cadastro. Não verifica identidade ou titularidade dos contatos.',scope:'profile',context:'Cadastro do candidato'});
 for(const [recordIndex,record] of data.records.entries()){
  if(record.candidateId!==candidateId)continue;
  const job=jobs.get(record.jobId);if(!job)continue;
  for(const [index,event] of record.events.entries())result.push({id:`event:${recordIndex}:${index}`,at:event.at,text:event.text,scope:job.id,context:job.title});
 }
 return result;
}
export function filterCandidateTimeline(entries:TimelineEntry[],query:string,scope:string,order:string){
 const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const words=clean(query).trim().split(/\s+/).filter(Boolean);
 return entries.filter(e=>(scope==='all'||scope===e.scope)&&words.every(w=>clean(`${e.text} ${e.context}`).includes(w))).sort((a,b)=>{
  const left=Date.parse(a.at),right=Date.parse(b.at);
  if(!Number.isFinite(left))return Number.isFinite(right)?1:a.id.localeCompare(b.id);
  if(!Number.isFinite(right))return -1;
  return (order==='oldest'?left-right:right-left)||a.id.localeCompare(b.id);
 });
}
