import type {Candidate,Job,RecordData} from './domain';
export type Appointment={id:string;startsAt:string;duration:number;format:'online'|'presencial'|'telefone';location:string;notes:string;status:'a-confirmar'|'confirmada'|'realizada'|'cancelada';updated:string};
export type AgendaItem={appointment:Appointment;candidate:Candidate;job:Job};
export const appointmentLabels={'a-confirmar':'A confirmar',confirmada:'Confirmada',realizada:'Realizada',cancelada:'Cancelada'};
export const appointmentFormats={online:'On-line',presencial:'Presencial',telefone:'Telefone'};
export function brazilParts(value:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';return {date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};}
export function brazilInstant(date:string,time:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Informe uma data e um horário válidos.');
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number),wanted=Date.UTC(y,m-1,d,h,min);
 if(y<2000||y>2100||new Date(wanted).toISOString().slice(0,10)!==date)throw Error('Informe uma data válida entre 2000 e 2100.');
 let instant=wanted;
 for(let i=0;i<3;i++){const local=brazilParts(new Date(instant).toISOString());const localAsUtc=Date.parse(`${local.date}T${local.time}:00Z`);instant+=wanted-localAsUtc;}
 const result=new Date(instant).toISOString(),local=brazilParts(result);
 if(local.date!==date||local.time!==time)throw Error('Esse horário não existe no fuso de Brasília. Escolha outro horário.');
 return result;
}
export const appointmentEnd=(a:Appointment)=>Date.parse(a.startsAt)+a.duration*60000;
export const appointmentActive=(a:Appointment)=>a.status==='a-confirmar'||a.status==='confirmada';
export function agendaItems(candidates:Candidate[],jobs:Job[],records:RecordData[]):AgendaItem[]{const people=new Map(candidates.map(c=>[c.id,c])),vacancies=new Map(jobs.map(j=>[j.id,j]));return records.flatMap(r=>{const candidate=people.get(r.candidateId),job=vacancies.get(r.jobId);return candidate&&job?(r.appointments||[]).map(appointment=>({appointment,candidate,job})):[]}).sort((a,b)=>Date.parse(a.appointment.startsAt)-Date.parse(b.appointment.startsAt));}
export type AgendaFilters={period:string;status:string;jobId:string;query:string};
export function filterAgenda(items:AgendaItem[],filters:AgendaFilters,now:number){
 const today=brazilParts(new Date(now).toISOString()).date,weekEnd=new Date(Date.parse(`${today}T12:00:00Z`)+7*86400000).toISOString().slice(0,10);
 const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),words=normalize(filters.query).split(/\s+/).filter(Boolean);
 return items.filter(({appointment:a,candidate:c,job:j})=>{const day=brazilParts(a.startsAt).date;if(filters.jobId!=='all'&&filters.jobId!==j.id)return false;if(filters.status!=='all'&&filters.status!==a.status)return false;if(!words.every(w=>normalize(`${c.name} ${j.title} ${c.city} ${a.location}`).includes(w)))return false;
 if(filters.period==='today')return day===today;
 if(filters.period==='week')return day>=today&&day<weekEnd;
 if(filters.period==='upcoming')return appointmentActive(a)&&appointmentEnd(a)>now;
 if(filters.period==='overdue')return appointmentActive(a)&&appointmentEnd(a)<=now;
 if(filters.period==='past')return appointmentEnd(a)<=now;
 return true;
 });
}
export function conflictingAppointments(items:AgendaItem[],appointment:Appointment){if(!appointmentActive(appointment))return [];const start=Date.parse(appointment.startsAt),end=appointmentEnd(appointment);return items.filter(({appointment:a})=>a.id!==appointment.id&&appointmentActive(a)&&Date.parse(a.startsAt)<end&&appointmentEnd(a)>start);}
export function recordAppointment(record:RecordData,appointment:Appointment,at:string):RecordData{
 const previous=(record.appointments||[]).find(a=>a.id===appointment.id);
 const appointments=previous?(record.appointments||[]).map(a=>a.id===appointment.id?{...appointment,updated:at}:a):[...(record.appointments||[]),{...appointment,updated:at}];
 if(appointments.length>30)throw Error('Este candidato atingiu o limite de 30 entrevistas nesta vaga.');
 return {...record,appointments,events:[...record.events,{at,text:`${previous?'Entrevista atualizada':'Entrevista registrada'} na agenda · ${appointmentLabels[appointment.status]}`}]};
}
