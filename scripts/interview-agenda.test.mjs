import test from 'node:test';
import assert from 'node:assert/strict';
import {brazilInstant,brazilParts,agendaItems,filterAgenda,conflictingAppointments,recordAppointment} from '../lib/interview-agenda.ts';
import {recordSchema} from '../lib/validation.ts';
const now=Date.parse('2026-10-09T03:05:00.000Z'),person={id:'c',name:'Cíntia',city:'São Paulo'},job={id:'j',title:'Atendimento'};
const a={id:'37b3c808-a331-4d50-9e58-220fcfc3af87',startsAt:brazilInstant('2026-10-09','09:00'),duration:30,format:'online',location:'Link a definir',notes:'Teste',status:'a-confirmar',updated:'2026-10-09T03:00:00Z'};
const r={candidateId:'c',jobId:'j',status:'Contato realizado',interest:'Não confirmado',availability:'Não confirmada',notes:'Preservar',report:'Parecer',events:[],appointments:[a]};
const item=appointment=>({appointment,candidate:person,job});
test('Brasilia input is converted independently of the machine timezone and rejects impossible dates',()=>{
 assert.equal(brazilInstant('2026-10-09','09:00'),'2026-10-09T12:00:00.000Z');assert.deepEqual(brazilParts('2026-10-10T02:30:00.000Z'),{date:'2026-10-09',time:'23:30'});
 for(const [date,time] of [['2026-02-30','10:00'],['2026-10-09','25:00'],['','10:00']])assert.throws(()=>brazilInstant(date,time));
});
test('agenda joins each candidate and job and keeps multiple rounds without duplicating a reschedule',()=>{
 const updated=recordAppointment(r,{...a,startsAt:brazilInstant('2026-10-10','10:00')},'now');assert.equal(updated.appointments.length,1);assert.equal(updated.status,r.status);assert.equal(updated.interest,r.interest);assert.equal(updated.report,r.report);assert.equal(updated.notes,r.notes);
 assert.equal(agendaItems([person],[job],[updated,{...r,candidateId:'unknown'}]).length,1);assert.equal(recordAppointment(updated,{...a,id:crypto.randomUUID()},'now').appointments.length,2);
});
test('conflicts respect duration, adjacent slots, edited appointment and canceled interviews',()=>{
 assert.equal(conflictingAppointments([item(a)],{...a,id:crypto.randomUUID(),startsAt:brazilInstant('2026-10-09','09:15')}).length,1);
 assert.equal(conflictingAppointments([item(a)],{...a,id:crypto.randomUUID(),startsAt:brazilInstant('2026-10-09','09:30')}).length,0);
 assert.equal(conflictingAppointments([item(a)],a).length,0);
 assert.equal(conflictingAppointments([item({...a,status:'cancelada'})],{...a,id:crypto.randomUUID()}).length,0);
});
test('today and reminders use Brasilia midnight, all jobs and unrecorded completion only',()=>{
 const previous={...a,id:crypto.randomUUID(),startsAt:brazilInstant('2026-10-08','23:00')},finished={...previous,id:crypto.randomUUID(),status:'realizada'};
 const list=[item(a),item(previous),item(finished)],base={period:'today',status:'all',jobId:'all',query:'cintia sao paulo'};
 assert.equal(filterAgenda(list,base,now).length,1);assert.equal(filterAgenda(list,{...base,period:'overdue'},now).length,1);assert.equal(filterAgenda(list,{...base,period:'upcoming'},now).length,1);assert.equal(filterAgenda(list,{...base,jobId:'other'},now).length,0);
});
test('validation retains agenda on unrelated record saves and rejects duplicate or invalid appointments',()=>{
 assert.equal(recordSchema.parse(r).appointments[0].startsAt,a.startsAt);
 assert.throws(()=>recordSchema.parse({...r,appointments:[a,a]}));assert.throws(()=>recordSchema.parse({...r,appointments:[{...a,duration:0}]}));assert.throws(()=>recordSchema.parse({...r,appointments:[{...a,startsAt:'2026-02-30T12:00:00.000Z'}]}));
 const {appointments,...old}=r;assert.deepEqual(recordSchema.parse(old),old);
});
