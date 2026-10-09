import type {Candidate,Job,RecordData} from './domain';
export type CandidateFilters={query:string;city:string;experience:string;pending:string;criterionId:string;onlyEvidence:boolean;sort:string};
export const emptyFilters:CandidateFilters={query:'',city:'',experience:'',pending:'all',criterionId:'all',onlyEvidence:false,sort:'name'};
const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
const containsTerms=(text:string,query:string)=>clean(query).split(/\s+/).filter(Boolean).every(term=>clean(text).includes(term));
export function filterCandidates(candidates:Candidate[],job:Job,records:RecordData[],filters:CandidateFilters):Candidate[]{
 const analyses=new Map(job.analyses.map(a=>[a.candidateId,a]));
 const contacts=new Map(records.filter(r=>r.jobId===job.id).map(r=>[r.candidateId,r]));
 return candidates.filter(c=>{
  const a=analyses.get(c.id),r=contacts.get(c.id);
  if(!containsTerms(`${c.name} ${c.role} ${c.city} ${c.text}`,filters.query)||!containsTerms(c.city,filters.city)||!containsTerms(`${c.role} ${c.text}`,filters.experience))return false;
  if(filters.onlyEvidence&&!a?.evidence.some(e=>e.status==='encontrada'))return false;
  if(filters.criterionId!=='all'&&!a?.evidence.some(e=>e.criterionId===filters.criterionId&&e.status==='encontrada'))return false;
  if(filters.pending==='contact'&&c.phone.trim()&&c.email.trim())return false;
  if(filters.pending==='location'&&c.city.trim())return false;
  if(filters.pending==='interest'&&r&&r.interest!=='Não confirmado')return false;
  if(filters.pending==='availability'&&r?.availability.trim()&&r.availability.trim()!=='Não confirmada')return false;
  if(filters.pending==='not-contacted'&&r&&r.status!=='Não contatado')return false;
  if(filters.pending==='not-analyzed'&&a)return false;
  if(filters.pending==='criteria'&&!a?.evidence.some(e=>e.status==='confirmar'))return false;
  return true;
 }).sort((a,b)=>filters.sort==='imported'?(Date.parse(b.updated)||0)-(Date.parse(a.updated)||0)||a.name.localeCompare(b.name,'pt-BR'):a.name.localeCompare(b.name,'pt-BR'));
}
export function selectAnalysisCandidates(candidates:Candidate[],ids?:string[]):Candidate[]{
 if(ids!==undefined){
  if(!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw Error('Selecione entre 1 e 100 perfis diferentes para comparar.');
  const byId=new Map(candidates.map(c=>[c.id,c]));
  if(ids.some(id=>!byId.has(id)))throw Error('Um dos perfis não está disponível na sua base. Atualize a página.');
  return ids.map(id=>byId.get(id)!);
 }
 if(!candidates.length||candidates.length>100)throw Error('Use os filtros para comparar entre 1 e 100 perfis por vez.');
 return candidates;
}
