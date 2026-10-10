import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarExport,calendarText,foldCalendarLine,weekExportItems} from '../lib/calendar-export.ts';
import {brazilInstant} from '../lib/interview-agenda.ts';
const item=(id,date,time,duration=30,status='a-confirmar')=>({candidate:{id:'c-'+id,name:'Pessoa fictícia',phone:'contato privado',cvText:'CV privado'},job:{id:'j',title:'Vaga fictícia'},appointment:{id,startsAt:brazilInstant(date,time),duration,status,format:'online',location:'Sala A; piso 2',notes:'observação privada'}});
const at='2026-10-10T12:00:00Z',unfold=text=>text.replace(/\r\n /g,'');

test('calendar exports preserve absolute times, duration, statuses and stable identities without sending invitations',()=>{
 const first=item('a','2026-10-15','14:30'),second=item('b','2026-10-16','10:00',60,'confirmada');
 const result=calendarExport([second,first],'2026-10-15',{at});const text=unfold(result.content);
 assert.equal(result.count,2);assert.equal(result.filename,'talentia-agenda-2026-10-12.ics');assert.match(text,/DTSTART:20261015T173000Z\r\nDTEND:20261015T180000Z/);assert.match(text,/STATUS:TENTATIVE/);assert.match(text,/STATUS:CONFIRMED/);assert.match(text,/CLASS:PRIVATE/);assert.doesNotMatch(text,/ATTENDEE:|ORGANIZER:|METHOD:|BEGIN:VALARM/);
 assert.ok(text.indexOf('20261015T173000Z')<text.indexOf('20261016T130000Z'));
 const ids=text.match(/^UID:.+$/gm);const changed=calendarExport([{...first,appointment:{...first.appointment,startsAt:brazilInstant('2026-10-15','16:00')}}],'2026-10-15',{at:'2026-10-11T12:00:00Z'});
 assert.equal(unfold(changed.content).match(/^UID:.+$/gm)[0],ids[0]);
});
test('only active filtered appointments overlapping the Brasilia week are exported, with no midnight duplication',()=>{
 const previous=item('previous','2026-10-11','23:45',60),midnight=item('midnight','2026-10-11','23:30',30),sunday=item('sun','2026-10-18','23:45',60);
 const data=[previous,previous,midnight,sunday,item('later','2026-10-19','00:00'),item('done','2026-10-15','14:00',30,'realizada'),item('cancel','2026-10-15','15:00',30,'cancelada')],original=JSON.stringify(data);
 assert.deepEqual(weekExportItems(data,'2026-10-15').map(i=>i.appointment.id),['previous','sun']);assert.equal(calendarExport(data,'2026-10-15',{at}).count,2);assert.equal(JSON.stringify(data),original);
 assert.throws(()=>calendarExport([], '2026-10-15',{at}),/Não há entrevistas/);assert.equal(calendarExport([sunday],'2026-10-15',{at}).count,1);
});
test('names are opt-in and private notes, CVs and contacts are never added',()=>{
 const first=item('a','2026-10-15','14:30');const plain=unfold(calendarExport([first],'2026-10-15',{at}).content),named=unfold(calendarExport([first],'2026-10-15',{at,includeNames:true}).content);
 assert.doesNotMatch(plain,/Pessoa fictícia|observação privada|CV privado|contato privado/);assert.match(named,/SUMMARY:Entrevista com Pessoa fictícia · Vaga fictícia/);assert.doesNotMatch(named,/observação privada|CV privado|contato privado/);
});
test('text and identity fields cannot inject calendar properties; UTF-8 folded lines round-trip accents and emoji',()=>{
 const first=item('a\r\nATTENDEE:evil@example.invalid','2026-10-15','14:30');first.candidate.name='João 😀 '.repeat(30)+'\r\nBEGIN:VALARM';first.appointment.location='Sala, A; B\\C\nATTENDEE:evil@example.invalid\u0000';
 const result=calendarExport([first],'2026-10-15',{at,includeNames:true}),text=unfold(result.content);
 for(const line of result.content.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);
 assert.equal((text.match(/^BEGIN:VEVENT$/gm)||[]).length,1);assert.doesNotMatch(text,/^ATTENDEE:|^BEGIN:VALARM/gm);assert.match(text,/LOCATION:Sala\\, A\\; B\\\\C\\nATTENDEE:/);assert.ok(text.includes(calendarText(first.candidate.name)));assert.ok(!result.content.includes('\u0000'));
 const long='SUMMARY:'+'é😀'.repeat(100);assert.equal(unfold(foldCalendarLine(long)),long);
});
test('invalid active appointments and excessive exports fail explicitly rather than creating a partial file',()=>{
 const first=item('a','2026-10-15','14:30');assert.throws(()=>calendarExport([{...first,appointment:{...first.appointment,startsAt:'invalid'}}],'2026-10-15',{at}),/inválida/);assert.throws(()=>calendarExport([{...first,appointment:{...first.appointment,duration:0}}],'2026-10-15',{at}),/inválida/);
 assert.throws(()=>calendarExport([first],'2026-02-30',{at}),/data válida/);assert.throws(()=>calendarExport(Array.from({length:1001},(_,i)=>({...first,appointment:{...first.appointment,id:String(i)}})),'2026-10-15',{at}),/muitas entrevistas/);
});
