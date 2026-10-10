import test from 'node:test';
import assert from 'node:assert/strict';
import {brazilDay,followUpItems,recordFollowUp,followUpMessage,waitingDays} from '../lib/contact-follow-up.ts';
import {emptyRecord} from '../lib/domain.ts';
import {recordSchema} from '../lib/validation.ts';
const at='2026-10-10T18:00:00.000Z',record={...emptyRecord('a','j'),status:'Contato realizado',notes:'Nota preservada',report:'Parecer preservado',invitation:undefined,appointments:[]};
test('Brasilia date governs due reminders and waiting days at UTC midnight',()=>{
 const now=Date.parse('2026-10-11T01:00:00Z');assert.equal(brazilDay(now),'2026-10-10');
 assert.equal(waitingDays({...record,lastContactAt:'2026-10-09T23:00:00Z'},now),1);
 assert.equal(waitingDays(record,now),null);assert.equal(waitingDays({...record,status:'Respondeu',lastContactAt:at},now),null);
});
test('scheduling and completion preserve recruitment data, and copying a draft has no side effects',()=>{
 const scheduled=recordFollowUp(record,'schedule','2026-10-12',' Confirmar interesse ',at);assert.equal(scheduled.followUp.note,'Confirmar interesse');
 for(const key of ['status','notes','report','interest','availability','appointments'])assert.deepEqual(scheduled[key],record[key]);
 const message=followUpMessage('Ana Pereira','Atendimento','Adriana','Empresa','Contato realizado');assert.match(message,/Olá, Ana!/);assert.match(message,/retomando nosso contato/);assert.match(message,/não receber novos contatos/);assert.equal(scheduled.followUp.completedAt,undefined);
 const completed=recordFollowUp(scheduled,'complete','','','2026-10-12T14:00:00.000Z');assert.equal(completed.lastContactAt,completed.followUp.completedAt);assert.equal(completed.status,record.status);assert.equal(recordSchema.parse(completed).followUp.date,'2026-10-12');
 assert.throws(()=>recordFollowUp(completed,'complete','','',at));
 const cancelled=recordFollowUp(scheduled,'cancel','','',at);assert.equal(cancelled.followUp,undefined);assert.equal(cancelled.notes,record.notes);
});
test('pending list isolates jobs, excludes archived and terminal records, and sorts by date',()=>{
 const records=['2026-10-12','2026-10-09','2026-10-10'].map((date,i)=>recordFollowUp({...record,candidateId:String(i)},'schedule',date,'',at));
 const data={candidates:[{id:'0',name:'Ana'},{id:'1',name:'Bia'},{id:'2',name:'Carla'},{id:'archived',mergedInto:'0',name:'Outra'}],jobs:[{id:'j'},{id:'other'}],records:[...records,{...records[0],jobId:'other'},...['Não contatar','Encerrado','Selecionado'].map(status=>({...records[0],status})),{...records[0],candidateId:'missing'},{...records[0],candidateId:'archived'},{...records[0],followUp:{...records[0].followUp,completedAt:at}}]};
 const list=followUpItems(data,'j',Date.parse(at));assert.deepEqual(list.map(i=>i.record.followUp.date),['2026-10-09','2026-10-10','2026-10-12']);assert.equal(list.filter(i=>i.due).length,2);assert.equal(list.filter(i=>i.overdue).length,1);assert.equal(followUpItems(data,'all',Date.parse(at)).length,4);
});
test('invalid dates and blocked contacts cannot create reminders or messages',()=>{
 for(const date of ['','2026-02-30','2026-13-01'])assert.throws(()=>recordFollowUp(record,'schedule',date,'',at));
 assert.throws(()=>recordSchema.parse({...record,followUp:{date:'2026-02-30',note:'',updated:at}}));
 assert.throws(()=>recordFollowUp({...record,status:'Não contatar'},'schedule','2026-10-12','',at));
 assert.throws(()=>followUpMessage('Ana','Vaga','Adriana','','Não contatar'));assert.throws(()=>followUpMessage('Ana','Vaga',' ','','Contato realizado'));
 assert.equal(recordSchema.parse(record).followUp,undefined);
});
