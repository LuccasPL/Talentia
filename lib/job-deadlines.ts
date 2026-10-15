import type {Data,Job} from './domain';
import {brazilParts} from './interview-agenda.ts';
import {validInterviewDate} from './interview-invitation.ts';

export type JobDeadlineState='atrasado'|'hoje'|'futuro'|'sem-prazo';
export type JobDeadlineItem={job:Job;clientName:string;date:string;state:JobDeadlineState;invalidDate:boolean};

export function jobDeadlines(data:Data,scope:string,now:number):JobDeadlineItem[]{
 const today=brazilParts(new Date(now).toISOString()).date;
 const clients=new Map((data.clients||[]).map(client=>[client.id,client.name]));
 return data.jobs.filter(job=>(scope==='all'||job.id===scope)&&!['preenchida','cancelada'].includes(job.lifecycle?.state||'')).map(job=>{
  const raw=job.briefingPlan?.presentationDue;
  const date=typeof raw==='string'&&raw&&validInterviewDate(raw)?raw:'';
  const state:JobDeadlineState=!date?'sem-prazo':date<today?'atrasado':date===today?'hoje':'futuro';
  return {job,clientName:clients.get(job.clientId||'')||'',date,state,invalidDate:Boolean(raw)&&!date};
 }).sort((a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||a.job.title.localeCompare(b.job.title,'pt-BR')||a.job.id.localeCompare(b.job.id));
}
