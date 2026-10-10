import {appointmentActive,appointmentEnd,appointmentFormats,brazilInstant,type AgendaItem} from './interview-agenda.ts';
import {calendarDay,calendarWeek} from './weekly-calendar.ts';

// RFC 5545 TEXT values: user content cannot create properties or invitations.
export function calendarText(value:string){return value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/;/g,'\\;').replace(/,/g,'\\,');}
export function foldCalendarLine(line:string){
 const encoder=new TextEncoder();let result='',bytes=0;
 for(const char of line){const size=encoder.encode(char).length;if(bytes+size>75){result+='\r\n ';bytes=1;}result+=char;bytes+=size;}
 return result;
}
export function weekExportItems(items:AgendaItem[],anchor:string){
 brazilInstant(anchor,'12:00');const days=calendarWeek(anchor),start=Date.parse(brazilInstant(days[0],'00:00')),end=Date.parse(brazilInstant(calendarDay(days[0],7),'00:00'));
 const seen=new Set<string>();
 return items.filter(item=>{
  const a=item.appointment;if(!appointmentActive(a))return false;
  const begins=Date.parse(a.startsAt),ends=appointmentEnd(a);
  if(!Number.isFinite(begins)||!Number.isInteger(a.duration)||a.duration<5||a.duration>240)throw Error('Há uma entrevista com data ou duração inválida. Revise o agendamento antes de exportar.');
  if(begins>=end||ends<=start)return false;
  const key=JSON.stringify([item.job.id,item.candidate.id,a.id]);if(seen.has(key))return false;seen.add(key);return true;
 }).toSorted((a,b)=>Date.parse(a.appointment.startsAt)-Date.parse(b.appointment.startsAt));
}
const utc=(value:string|number)=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function calendarExport(items:AgendaItem[],anchor:string,{includeNames=false,at=new Date().toISOString()}:{includeNames?:boolean;at?:string}={}){
 const selected=weekExportItems(items,anchor);if(!selected.length)throw Error('Não há entrevistas confirmadas ou a confirmar nesta semana com os filtros atuais.');
 if(selected.length>1000)throw Error('Há muitas entrevistas para um arquivo. Filtre por vaga antes de exportar.');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Talentia//Agenda de entrevistas//PT-BR','CALSCALE:GREGORIAN'];
 for(const {appointment:a,candidate,job} of selected){
  const id=encodeURIComponent(JSON.stringify([job.id,candidate.id,a.id]));
  lines.push('BEGIN:VEVENT',`UID:${id}@talentia-two.vercel.app`,`DTSTAMP:${utc(at)}`,`DTSTART:${utc(a.startsAt)}`,`DTEND:${utc(appointmentEnd(a))}`,
   `SUMMARY:${calendarText(`Entrevista${includeNames?` com ${candidate.name}`:''} · ${job.title}`)}`,
   `DESCRIPTION:${calendarText(`Agenda da Talentia. Formato: ${appointmentFormats[a.format]}. Situação: ${a.status==='confirmada'?'Confirmada':'A confirmar'}. Horário informado na Talentia: Brasília. Esta é uma cópia; confira alterações na Talentia.`)}`,
   `LOCATION:${calendarText(a.location||'Local ou acesso a definir')}`,'CLASS:PRIVATE','TRANSP:OPAQUE',`STATUS:${a.status==='confirmada'?'CONFIRMED':'TENTATIVE'}`,'END:VEVENT');
 }
 lines.push('END:VCALENDAR');const content=lines.map(foldCalendarLine).join('\r\n')+'\r\n';
 if(new TextEncoder().encode(content).length>2*1024*1024)throw Error('O arquivo é grande demais. Filtre por vaga antes de exportar.');
 return {content,count:selected.length,filename:`talentia-agenda-${calendarWeek(anchor)[0]}.ics`};
}
