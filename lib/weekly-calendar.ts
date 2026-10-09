import {brazilParts,appointmentEnd,type AgendaItem} from './interview-agenda.ts';
export type CalendarSegment={item:AgendaItem;date:string;startMinute:number;endMinute:number;continuesBefore:boolean;continuesAfter:boolean;column:number;columns:number};
export function calendarDay(date:string,offset:number){return new Date(Date.parse(`${date}T12:00:00Z`)+offset*86400000).toISOString().slice(0,10)}
export function calendarWeek(anchor:string){const weekday=new Date(`${anchor}T12:00:00Z`).getUTCDay();const monday=calendarDay(anchor,-((weekday+6)%7));return Array.from({length:7},(_,i)=>calendarDay(monday,i))}
const minute=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
export function calendarSegments(items:AgendaItem[],days:string[]):CalendarSegment[]{
 const timed=items.map(item=>({item,start:brazilParts(item.appointment.startsAt),end:brazilParts(new Date(appointmentEnd(item.appointment)).toISOString())}));
 return days.flatMap(date=>{
  const segments=timed.flatMap(({item,start,end})=>{
   if(date<start.date||date>end.date)return [];
   const startMinute=date===start.date?minute(start.time):0,endMinute=date===end.date?minute(end.time):1440;
   if(endMinute<=startMinute)return [];
   return [{item,date,startMinute,endMinute,continuesBefore:date>start.date,continuesAfter:date<end.date,column:0,columns:1}];
  }).sort((a,b)=>a.startMinute-b.startMinute||b.endMinute-a.endMinute||a.item.appointment.id.localeCompare(b.item.appointment.id));
  // Small appointments also need enough space for a clickable label.
  const visualEnd=(s:CalendarSegment)=>Math.min(1440,Math.max(s.endMinute,s.startMinute+22));
  let group:CalendarSegment[]=[],ends:number[]=[],groupEnd=0;
  function finish(){for(const s of group)s.columns=ends.length;group=[];ends=[];groupEnd=0}
  for(const s of segments){if(group.length&&s.startMinute>=groupEnd)finish();let column=ends.findIndex(end=>end<=s.startMinute);if(column<0)column=ends.length;ends[column]=visualEnd(s);s.column=column;group.push(s);groupEnd=Math.max(groupEnd,visualEnd(s))}finish();
  return segments;
 });
}
export function calendarHours(segments:CalendarSegment[]){return segments.reduce((range,s)=>({start:Math.min(range.start,Math.floor(s.startMinute/60)),end:Math.max(range.end,Math.ceil(s.endMinute/60))}),{start:8,end:20})}
export const calendarTime=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
