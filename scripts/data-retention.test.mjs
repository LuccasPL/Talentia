import test from 'node:test';
import assert from 'node:assert/strict';
import {baseHealth,healthMatches,lastActivity,INACTIVE_DAYS} from '../lib/base-health.ts';

const now=Date.parse('2026-10-15T12:00:00Z'),day=86400000,ago=days=>new Date(now-days*day).toISOString();
const candidate=(extra={})=>({id:'a',name:'Pessoa Fictícia',role:'',city:'São Paulo',phone:'11999999999',email:'',updated:ago(800),demo:false,...extra});
const record=(extra={})=>({candidateId:'a',jobId:'j1',status:'Contato realizado',interest:'',availability:'',notes:'',report:'',events:[],...extra});
const data=(candidates,records=[])=>({candidates,records,jobs:[],aiConfigured:false});

test('profiles are flagged only after 24 months without any activity, never removed',()=>{
 assert.equal(INACTIVE_DAYS,730);
 const row=baseHealth(data([candidate()]),'j1',90,now)[0];
 assert.equal(row.inactive,true);assert.equal(healthMatches(row,'inactive'),true);
 assert.equal(baseHealth(data([candidate({updated:ago(729)})]),'j1',90,now)[0].inactive,false);
 assert.equal(baseHealth(data([candidate({updated:ago(730)})]),'j1',90,now)[0].inactive,true,'threshold is inclusive');
});

test('any recent signal counts as activity, including contacts in other vacancies',()=>{
 const old=candidate();
 assert.equal(baseHealth(data([{...old,editedAt:ago(10)}]),'j1',90,now)[0].inactive,false);
 assert.equal(baseHealth(data([{...old,selfDeclaration:{at:ago(10),employment:'Trabalhando'}}]),'j1',90,now)[0].inactive,false);
 assert.equal(baseHealth(data([{...old,verification:{phone:{at:ago(10),method:'Ligação'}}}]),'j1',90,now)[0].inactive,false);
 assert.equal(baseHealth(data([old],[record({jobId:'outra-vaga',events:[{at:ago(5),text:'Contato fictício'}]})]),'j1',90,now)[0].inactive,false);
 assert.equal(baseHealth(data([old],[record({lastContactAt:ago(3)})]),'j1',90,now)[0].inactive,false);
});

test('future or invalid dates never keep a profile looking active',()=>{
 assert.equal(lastActivity(candidate({updated:'data inválida',editedAt:new Date(now+day).toISOString()}),[],now),0);
 assert.equal(baseHealth(data([candidate({updated:'',editedAt:new Date(now+day).toISOString()})]),'j1',90,now)[0].inactive,false,'unknown activity is not flagged as inactive');
});
