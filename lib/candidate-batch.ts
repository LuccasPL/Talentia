import {emptyRecord,type Data,type RecordData} from './domain.ts';
import {shortlistRecord} from './candidate-shortlist.ts';
import {emptyInvitation,generateInvitation} from './interview-invitation.ts';

export type BatchSettings={recruiter:string;company:string;roleTitle:string;instructions:string};
export type BatchAction='shortlist'|'invitations';
export type BatchSummary={changed:number;blocked:number;existing:number};
export function applyCandidateBatch(data:Data,jobId:string,ids:string[],action:BatchAction,settings:BatchSettings|undefined,at:string):{records:RecordData[];summary:BatchSummary}{
 if(!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw Error('Selecione de 1 a 100 candidatos diferentes.');
 if(!data.jobs.some(j=>j.id===jobId))throw Error('A vaga não está disponível.');
 const active=new Map(data.candidates.filter(c=>!c.mergedInto).map(c=>[c.id,c]));
 if(ids.some(id=>!active.has(id)))throw Error('Um candidato selecionado não está disponível. Atualize a página.');
 if(action!=='shortlist'&&action!=='invitations')throw Error('Ação inválida.');
 if(action==='invitations'&&(!settings?.recruiter.trim()||!settings.roleTitle.trim()))throw Error('Informe seu nome e o nome da vaga no convite.');
 const summary:BatchSummary={changed:0,blocked:0,existing:0};
 const replacements=new Map<string,RecordData>();
 for(const id of ids){
  const stored=data.records.find(r=>r.candidateId===id&&r.jobId===jobId)||emptyRecord(id,jobId);
  if(action==='invitations'){
   if(stored.status==='Não contatar'){summary.blocked++;continue;}
   if(stored.invitation){summary.existing++;continue;}
   const invitation={...generateInvitation(active.get(id)!.name,{...emptyInvitation(settings!.roleTitle),...settings!}),updated:at};
   replacements.set(id,{...stored,invitation,events:[...stored.events,{at,text:'Rascunhos de convite preparados em lote · Sem envio'}]});
  }else{
   if(stored.shortlisted){summary.existing++;continue;}
   replacements.set(id,shortlistRecord(stored,true,at));
  }
  summary.changed++;
 }
 const records=data.records.map(r=>{if(r.jobId!==jobId||!replacements.has(r.candidateId))return r;const next=replacements.get(r.candidateId)!;replacements.delete(r.candidateId);return next;});
 return {records:[...records,...replacements.values()],summary};
}
