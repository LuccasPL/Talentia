import test from 'node:test';
import assert from 'node:assert/strict';
import {jobDirectory,filterJobDirectory} from '../lib/job-directory.ts';
const job=(id,title,stage=0,updated='2026-10-10T10:00:00Z')=>({id,title,stage,updated,analyses:[],criteria:[]});
const record=(candidateId,jobId,extra={})=>({candidateId,jobId,report:'',shortlisted:false,...extra});
test('counts distinct active participants per vacancy and separates saved reports from review',()=>{
 const data={jobs:[{...job('a','Recepção'),analyses:[{candidateId:'p'},{candidateId:'p'},{candidateId:'q'},{candidateId:'gone'}]},job('b','Vendas')],candidates:[{id:'p'},{id:'q'},{id:'merged',mergedInto:'p'}],records:[record('p','a',{shortlisted:true,report:'Parecer',reportNeedsReview:true}),record('q','a',{report:'Salvo'}),record('p','b',{shortlisted:true}),record('gone','a',{report:'Órfão'}),record('merged','a',{shortlisted:true,report:'Arquivado'}),record('q','other',{report:'Outra vaga'})]};
 const before=structuredClone(data),items=jobDirectory(data);
 assert.deepEqual([items[0].people,items[0].shortlisted,items[0].reports,items[0].review],[2,1,1,1]);
 assert.deepEqual([items[1].people,items[1].shortlisted,items[1].reports,items[1].review],[1,1,0,0]);assert.deepEqual(data,before);
});
test('clients are resolved within the provided directory and archived links remain visible',()=>{
 const items=jobDirectory({jobs:[{...job('a','Varejo'),clientId:'c'},{...job('b','Hotel'),clientId:'missing'}],candidates:[],records:[],clients:[{id:'c',name:'São João',archived:true}]});
 assert.equal(items[0].clientName,'São João (arquivado)');assert.equal(items[1].clientName,'Sem cliente vinculado');
 assert.equal(filterJobDirectory(items,'varejo sao joao','all','name').length,1);assert.equal(filterJobDirectory(items,'hotel','2','updated').length,0);
});
test('filtering and sorting preserve source order and place invalid dates after valid ones',()=>{
 const items=jobDirectory({jobs:[job('a','Ágata',0,'invalid'),job('b','Bianca',1,'2026-10-12T10:00:00Z'),job('c','Carla',2,'2026-10-10T10:00:00Z')],candidates:[],records:[]});
 assert.deepEqual(filterJobDirectory(items,'','all','updated').map(i=>i.job.id),['b','c','a']);assert.deepEqual(filterJobDirectory(items,'agata','0','name').map(i=>i.job.id),['a']);assert.deepEqual(items.map(i=>i.job.id),['a','b','c']);
});
test('empty workspace and whitespace-only reports do not create progress',()=>{
 assert.deepEqual(jobDirectory({jobs:[],candidates:[],records:[]}),[]);
 const [item]=jobDirectory({jobs:[job('a','Vaga')],candidates:[{id:'p'}],records:[record('p','a',{report:'   ',reportNeedsReview:true})]});assert.equal(item.reports,0);assert.equal(item.review,0);
});
