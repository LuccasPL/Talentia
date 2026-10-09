import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarWeek,calendarDay,calendarSegments,calendarHours} from '../lib/weekly-calendar.ts';
import {brazilInstant} from '../lib/interview-agenda.ts';
const item=(id,date,time,duration=30,status='a-confirmar')=>({candidate:{id,name:'Teste fictício'},job:{id:'j',title:'Teste'},appointment:{id,startsAt:brazilInstant(date,time),duration,status}});
test('week starts on Monday, includes Sunday and crosses month/year independently of local timezone',()=>{
 assert.deepEqual(calendarWeek('2026-10-11'),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']);
 assert.equal(calendarWeek('2027-01-01')[0],'2026-12-28');assert.equal(calendarWeek('2027-01-01')[6],'2027-01-03');assert.equal(calendarDay('2026-12-28',7),'2027-01-04');
});
test('positions are based on Brasilia time and events crossing midnight are split without duplication at midnight',()=>{
 const days=calendarWeek('2026-10-09');const list=calendarSegments([item('a','2026-10-08','23:30',60),item('b','2026-10-07','23:30',30),item('outside','2026-10-15','14:30')],days);
 const parts=list.filter(s=>s.item.appointment.id==='a');assert.equal(parts.length,2);assert.equal(parts[0].date,'2026-10-08');assert.equal(parts[0].startMinute,1410);assert.equal(parts[0].endMinute,1440);assert.equal(parts[1].date,'2026-10-09');assert.equal(parts[1].endMinute,30);assert.ok(parts[1].continuesBefore);assert.equal(list.filter(s=>s.item.appointment.id==='b').length,1);assert.equal(list.filter(s=>s.item.appointment.id==='outside').length,0);
});
test('interviews starting in the previous week continue into Monday; weekend events remain visible',()=>{
 const list=calendarSegments([item('a','2026-10-04','23:45',60),item('sunday','2026-10-11','10:00')],calendarWeek('2026-10-09'));
 assert.equal(list[0].date,'2026-10-05');assert.equal(list[0].startMinute,0);assert.equal(list[0].endMinute,45);assert.equal(list[1].date,'2026-10-11');
});
test('overlaps share columns, adjacent appointments reuse space and brief appointments remain clickable',()=>{
 const list=calendarSegments([item('a','2026-10-09','14:00',60),item('b','2026-10-09','14:15',30),item('c','2026-10-09','15:00',30),item('short','2026-10-09','16:00',5),item('short2','2026-10-09','16:05',5)],calendarWeek('2026-10-09'));
 assert.equal(list[0].columns,2);assert.notEqual(list[0].column,list[1].column);assert.equal(list[2].columns,1);assert.equal(list[3].columns,2);assert.equal(list[4].columns,2);
 assert.deepEqual(calendarHours(list),{start:8,end:20});assert.deepEqual(calendarHours([]),{start:8,end:20});
});
test('early, late, completed and canceled events are not silently hidden or modified',()=>{
 const items=[item('early','2026-10-09','05:00',30,'realizada'),item('late','2026-10-09','23:00',30,'cancelada')],original=JSON.stringify(items);const list=calendarSegments(items,calendarWeek('2026-10-09'));assert.equal(list.length,2);assert.deepEqual(calendarHours(list),{start:5,end:24});assert.equal(JSON.stringify(items),original);
});
