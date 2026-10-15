import type {Candidate,Data} from './domain.ts';
import {normalizeSearch} from './assisted-search.ts';
export const healthFilters={review:'Dados a revisar',missing:'Contato ou cidade ausente',never:'Sem confirmação ou declaração registrada',old:'Último registro antigo',verification:'Confirmações pendentes',declaration:'Declaração recente',blocked:'Não contatar nesta vaga',inactive:'Sem atividade há 24 meses',all:'Todos os perfis'} as const;
export type HealthFilter=keyof typeof healthFilters;
export type HealthRow={candidate:Candidate;blocked:boolean;missing:string[];pending:string[];lastSignal:string;old:boolean;recentDeclaration:boolean;needsReview:boolean;lastActivity:string;inactive:boolean};
// Retention review: profiles are never removed automatically; after this period without any activity they are flagged.
export const INACTIVE_DAYS=730;
// Latest sign of activity across every vacancy: import/edit, confirmations, declarations, changes, contacts and events.
export function lastActivity(candidate:Candidate,records:Data['records'],now:number){const times=[candidate.updated,candidate.editedAt,candidate.selfDeclaration?.at,...Object.values(candidate.verification||{}).map(v=>v?.at),...(candidate.changeLog||[]).map(c=>c.at),...records.filter(r=>r.candidateId===candidate.id).flatMap(r=>[r.lastContactAt,...(r.events||[]).map(e=>e.at)])].map(v=>validTime(v,now));return Math.max(0,...times);}
const fields={phone:'Telefone',email:'E-mail',city:'Cidade'} as const;
function validTime(value:string|undefined,now:number){const time=Date.parse(value||'');return Number.isFinite(time)&&time<=now?time:0;}
export function baseHealth(data:Data,jobId:string,days:number,now:number):HealthRow[]{
 if(![30,90,180].includes(days)||!Number.isFinite(now))throw Error('Confira o prazo de revisão.');
 const cutoff=now-days*86400000,records=new Map(data.records.filter(r=>r.jobId===jobId).map(r=>[r.candidateId,r]));
 return data.candidates.filter(c=>!c.mergedInto).map(candidate=>{
  const missing=[];if(!candidate.phone.trim()&&!candidate.email.trim())missing.push('Sem telefone ou e-mail');if(!candidate.city.trim())missing.push('Cidade não informada');
  const present=(Object.keys(fields) as (keyof typeof fields)[]).filter(field=>candidate[field].trim());
  const confirmations=present.map(field=>validTime(candidate.verification?.[field]?.at,now));
  const declared=validTime(candidate.selfDeclaration?.at,now),latest=Math.max(0,declared,...confirmations);
  const pending=present.filter(field=>validTime(candidate.verification?.[field]?.at,now)<=cutoff).map(field=>fields[field]);
  const old=latest>0&&latest<=cutoff;
  const active=lastActivity(candidate,data.records,now);
  return {candidate,blocked:records.get(candidate.id)?.status==='Não contatar',missing,pending,lastSignal:latest?new Date(latest).toISOString():'',old,recentDeclaration:declared>cutoff,needsReview:missing.length>0||pending.length>0||!latest||old,lastActivity:active?new Date(active).toISOString():'',inactive:active>0&&active<=now-INACTIVE_DAYS*86400000};
 }).sort((a,b)=>(Date.parse(a.lastSignal)||0)-(Date.parse(b.lastSignal)||0)||a.candidate.name.localeCompare(b.candidate.name,'pt-BR'));
}
export function healthMatches(row:HealthRow,filter:HealthFilter){if(filter==='blocked')return row.blocked;if(row.blocked&&filter!=='all')return false;switch(filter){case 'review':return row.needsReview;case 'missing':return row.missing.length>0;case 'never':return !row.lastSignal;case 'old':return row.old;case 'verification':return row.pending.length>0;case 'declaration':return row.recentDeclaration;case 'inactive':return row.inactive;default:return true;}}
export function filterHealth(rows:HealthRow[],filter:HealthFilter,query:string,city:string){const terms=normalizeSearch(query).split(' ').filter(Boolean),region=normalizeSearch(city);return rows.filter(r=>healthMatches(r,filter)&&terms.every(t=>normalizeSearch(`${r.candidate.name} ${r.candidate.role}`).includes(t))&&normalizeSearch(r.candidate.city).includes(region));}
