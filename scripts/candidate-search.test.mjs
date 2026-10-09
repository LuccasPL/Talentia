import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyFilters,filterCandidates,selectAnalysisCandidates} from '../lib/candidate-search.ts';
const candidates=[
 {id:'a',name:'Ágata',role:'Vendedora',city:'São Paulo, SP',text:'Atendimento em varejo e demonstração de produtos.',phone:'',email:'a@example.invalid',updated:'2025-01-01'},
 {id:'b',name:'Beatriz',role:'Recepcionista',city:'Osasco, SP',text:'Hospitalidade em hotel e atendimento presencial.',phone:'123',email:'b@example.invalid',updated:'2026-01-01'},
 {id:'c',name:'Clara',role:'Vendedora',city:'',text:'Atendimento no varejo.',phone:'',email:'',updated:''}
];
const job={id:'job',analyses:[{candidateId:'a',evidence:[{criterionId:'retail',status:'encontrada'},{criterionId:'schedule',status:'confirmar'}]}]};
const records=[{candidateId:'a',jobId:'other',interest:'Interessado',status:'Respondeu',availability:'Confirmada'},{candidateId:'b',jobId:'job',interest:'Interessado',status:'Respondeu',availability:'A partir de novembro'}];
const find=(filters={})=>filterCandidates(candidates,job,records,{...emptyFilters,...filters}).map(c=>c.id);
test('accent-insensitive search combines city and all experience terms',()=>{
 assert.deepEqual(find({query:'agata',city:'sao paulo',experience:'demonstracao varejo'}),['a']);
 assert.deepEqual(find({city:'sao paulo',experience:'hospitalidade'}),[]);
 assert.deepEqual(find({experience:'atendimento'}),['a','b','c']);
});
test('missing contact and location are explicit data gaps',()=>{
 assert.deepEqual(find({pending:'contact'}),['a','c']);
 assert.deepEqual(find({pending:'location'}),['c']);
});
test('interest, availability and contact status are scoped to the selected job',()=>{
 for(const pending of ['interest','availability','not-contacted'])assert.deepEqual(find({pending}),['a','c']);
});
test('criterion evidence and pending analysis are distinct',()=>{
 assert.deepEqual(find({criterionId:'retail'}),['a']);
 assert.deepEqual(find({criterionId:'schedule'}),[]);
 assert.deepEqual(find({pending:'criteria'}),['a']);
 assert.deepEqual(find({pending:'not-analyzed'}),['b','c']);
 assert.deepEqual(find({onlyEvidence:true}),['a']);
});
test('ordering by import date keeps undated profiles last',()=>{
 assert.deepEqual(find({sort:'imported'}),['b','a','c']);
 assert.deepEqual(candidates.map(c=>c.id),['a','b','c']);
});
test('comparison selects only IDs from the authenticated owner database',()=>{
 assert.deepEqual(selectAnalysisCandidates(candidates,['b']).map(c=>c.id),['b']);
 assert.throws(()=>selectAnalysisCandidates(candidates,['foreign-owner']),/não está disponível/);
 assert.throws(()=>selectAnalysisCandidates(candidates,[]),/1 e 100/);
 assert.throws(()=>selectAnalysisCandidates(candidates,['a','a']),/diferentes/);
});
test('large databases require a bounded explicit subset instead of silent truncation',()=>{
 const large=Array.from({length:5000},(_,i)=>({...candidates[0],id:`candidate-${i}`}));
 assert.throws(()=>selectAnalysisCandidates(large),/1 e 100/);
 assert.equal(selectAnalysisCandidates(large,['candidate-4999'])[0].id,'candidate-4999');
 assert.throws(()=>selectAnalysisCandidates(large,large.slice(0,101).map(c=>c.id)),/1 e 100/);
});
