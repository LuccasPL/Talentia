import test from 'node:test';
import assert from 'node:assert/strict';
import {jobDeadlines} from '../lib/job-deadlines.ts';

const now=Date.parse('2026-10-16T01:00:00Z'); // 15/10, 22h em Brasília.
const job=(id,date,title=id,extra={})=>({id,title,description:'Vaga fictícia',criteria:[],analyses:[],stage:1,engine:'Teste',revision:1,updated:'',...(date===undefined?{}:{briefingPlan:{positions:null,presentationDue:date,decisionMaker:'',pendingNotes:''}}),...extra});
const data=(jobs,extra={})=>({jobs,candidates:[],records:[],clients:[],aiConfigured:false,...extra});

test('deadlines isolate selected vacancy and preserve all open vacancies without candidates',()=>{
 const input=data([job('a','2026-10-15'),job('b','2026-10-16')]);
 assert.deepEqual(jobDeadlines(input,'all',now).map(i=>i.job.id),['a','b']);
 assert.deepEqual(jobDeadlines(input,'b',now).map(i=>i.job.id),['b']);
 assert.deepEqual(jobDeadlines(input,'missing',now),[]);
});

test('deadline classification turns at civil midnight in Brasília rather than UTC',()=>{
 const input=data([job('yesterday','2026-10-14'),job('today','2026-10-15'),job('tomorrow','2026-10-16')]);
 assert.deepEqual(jobDeadlines(input,'all',now).map(i=>i.state),['atrasado','hoje','futuro']);
 assert.equal(jobDeadlines(input,'today',Date.parse('2026-10-16T02:59:59Z'))[0].state,'hoje');
 assert.equal(jobDeadlines(input,'today',Date.parse('2026-10-16T03:00:00Z'))[0].state,'atrasado');
});

test('absent and invalid legacy dates become unconfirmed without inventing dates',()=>{
 const input=data([job('legacy'),job('empty',''),job('impossible','2026-02-30'),job('localized','15/10/2026'),job('notpadded','2026-1-02'),job('validLeap','2028-02-29')]);
 const items=jobDeadlines(input,'all',now);
 for(const id of ['legacy','empty','impossible','localized','notpadded']){const item=items.find(i=>i.job.id===id);assert.equal(item.state,'sem-prazo');assert.equal(item.date,'');assert.equal(item.invalidDate,!['legacy','empty'].includes(id));}
 assert.equal(items.find(i=>i.job.id==='validLeap').state,'futuro');
});

test('filled and canceled vacancies are omitted while paused ones retain their explicit lifecycle',()=>{
 const lifecycle=state=>({state,updated:'2026-10-15T12:00:00Z',history:[]});
 const input=data([job('filled','2026-10-01','Filled',{lifecycle:lifecycle('preenchida')}),job('canceled','2026-10-01','Canceled',{lifecycle:lifecycle('cancelada')}),job('paused','2026-10-01','Paused',{lifecycle:lifecycle('pausada')}),job('legacy',undefined)]);
 const items=jobDeadlines(input,'all',now);assert.deepEqual(items.map(i=>i.job.id),['paused','legacy']);assert.equal(items[0].job.lifecycle.state,'pausada');assert.equal(items[0].state,'atrasado');
});

test('presentation or hiring records never infer fulfillment of a vacancy agreement',()=>{
 const input=data([job('a','2026-10-14')],{records:[{jobId:'a',candidateId:'person',status:'Contratado',clientHistory:[{kind:'apresentado',at:'2026-10-13T12:00:00Z'}]}]});
 const before=JSON.stringify(input);assert.equal(jobDeadlines(input,'all',now)[0].state,'atrasado');assert.equal(JSON.stringify(input),before);
});

test('ordering is chronological, then title in PT-BR and stable id, with undated jobs last',()=>{
 const input=data([job('undated-z','','Zebra'),job('same-b','2026-10-15','Águia'),job('future','2026-10-20','A'),job('same-a','2026-10-15','Águia'),job('undated-a',undefined,'Abelha'),job('first','2026-10-01','Z'),job('same-z','2026-10-15','Zebra')]);
 assert.deepEqual(jobDeadlines(input,'all',now).map(i=>i.job.id),['first','same-a','same-b','same-z','future','undated-a','undated-z']);
});

test('client labels use the linked client without removing unlinked jobs and all 100 jobs survive',()=>{
 const jobs=Array.from({length:100},(_,i)=>job(`job-${i}`,'2026-10-15',`Vaga ${String(i).padStart(3,'0')}`,i===0?{clientId:'client'}:{}));
 const input=data(jobs,{clients:[{id:'client',name:'Cliente fictício',archived:true}]});
 const items=jobDeadlines(input,'all',now);assert.equal(items.length,100);assert.equal(items[0].clientName,'Cliente fictício');assert.equal(items.at(-1).job.id,'job-99');assert.equal(input.jobs.length,100);
});
