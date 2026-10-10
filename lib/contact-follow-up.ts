import type {Data,RecordData} from './domain';
import {validInterviewDate} from './interview-invitation.ts';
export type FollowUp={date:string;note:string;updated:string;completedAt?:string};
export function brazilDay(now:number):string{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function followUpItems(data:Data,jobId:string,now:number){
 const today=brazilDay(now),candidates=new Map(data.candidates.filter(c=>!c.mergedInto).map(c=>[c.id,c])),jobs=new Map(data.jobs.map(j=>[j.id,j]));
 return data.records.flatMap(record=>{const candidate=candidates.get(record.candidateId),job=jobs.get(record.jobId),reminder=record.followUp;
  if(!candidate||!job||(jobId!=='all'&&job.id!==jobId)||!reminder||reminder.completedAt||['Não contatar','Encerrado','Selecionado'].includes(record.status))return [];
  return [{candidate,job,record,due:reminder.date<=today,overdue:reminder.date<today}];
 }).sort((a,b)=>a.record.followUp!.date.localeCompare(b.record.followUp!.date)||a.candidate.name.localeCompare(b.candidate.name,'pt-BR'));
}
export function recordFollowUp(record:RecordData,action:'schedule'|'complete'|'cancel',date:string,note:string,at:string):RecordData{
 if(action!=='cancel'&&['Não contatar','Encerrado','Selecionado'].includes(record.status))throw Error('Este processo está encerrado ou bloqueado para novos contatos.');
 if(action==='schedule'){
  if(!date||!validInterviewDate(date)||note.length>2000)throw Error('Informe uma data válida e uma observação de até 2.000 caracteres.');
  return {...record,followUp:{date,note:note.trim(),updated:at},events:[...record.events,{at,text:`Próximo contato definido para ${date.split('-').reverse().join('/')}`}]};
 }
 if(!record.followUp||record.followUp.completedAt)throw Error('Não há lembrete pendente para atualizar.');
 if(action==='complete')return {...record,lastContactAt:at,followUp:{...record.followUp,completedAt:at,updated:at},events:[...record.events,{at,text:'Contato manual registrado pela recrutadora · Lembrete concluído · Sem envio pelo sistema'}]};
 if(action!=='cancel')throw Error('Ação inválida.');
 return {...record,followUp:undefined,events:[...record.events,{at,text:'Lembrete de próximo contato cancelado pela recrutadora'}]};
}
export function followUpMessage(name:string,jobTitle:string,recruiter:string,company:string,status:string){
 if(status==='Não contatar')throw Error('Este contato está marcado como Não contatar.');
 if(!recruiter.trim())throw Error('Informe seu nome antes de preparar o lembrete.');
 const first=name.trim().split(/\s+/)[0]||'tudo bem';
 return `Olá, ${first}! Tudo bem? Sou ${recruiter.trim()}, responsável pelo recrutamento${company.trim()?` para ${company.trim()}`:''}.${status==='Contato realizado'?' Estou retomando nosso contato sobre':' Gostaria de conversar sobre'} a oportunidade de ${jobTitle}. Você tem interesse em conhecer os detalhes? Podemos combinar um horário que funcione para você.\n\nSe preferir não receber novos contatos, é só me avisar.`;
}
export function waitingDays(record:RecordData,now:number):number|null{
 if(record.status!=='Contato realizado'||!record.lastContactAt||!Number.isFinite(Date.parse(record.lastContactAt)))return null;
 return Math.max(0,Math.floor((Date.parse(brazilDay(now)+'T12:00:00Z')-Date.parse(brazilDay(Date.parse(record.lastContactAt))+'T12:00:00Z'))/86400000));
}
