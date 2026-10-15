import test from 'node:test';
import assert from 'node:assert/strict';
import {planErasure,erasureGroup,confirmsName} from '../lib/candidate-erasure.ts';

const person=(id,extra={})=>({id,name:`Pessoa ${id}`,role:'',city:'',source:'PDF',text:'Experiência fictícia.',phone:'',email:'',updated:'2026-10-15',demo:false,...extra});
const record=(candidateId,jobId)=>({candidateId,jobId,status:'Contato realizado',interest:'',availability:'',notes:'nota fictícia',report:'',events:[]});
const job=(id,analyses)=>({id,title:id,description:'',criteria:[],analyses,stage:1,engine:'',revision:1,updated:''});
const analysis=candidateId=>({candidateId,evidence:[]});
function data(){
 return {aiConfigured:false,version:3,
  candidates:[person('a',{fileKey:'owner/a.pdf',cvSourceId:'a-cv'}),person('b',{mergeHistory:[{at:'2026-10-10',candidate:person('a'),records:[],analyses:[]},{at:'2026-10-11',candidate:person('z'),records:[],analyses:[]}]}),person('c')],
  archivedCandidates:[person('a-cv',{fileKey:'owner/a-cv.pdf',mergedInto:'a'}),person('a-dup',{mergedInto:'a'}),person('c-dup',{mergedInto:'c'})],
  jobs:[job('j1',[analysis('a'),analysis('c'),analysis('a-dup')]),job('j2',[analysis('c')])],
  records:[record('a','j1'),record('a','j2'),record('a-dup','j1'),record('c','j1')]};
}

test('the erasure group is the profile plus everything merged into it, never other people',()=>{
 assert.deepEqual(erasureGroup(data(),'a').map(c=>c.id),['a','a-cv','a-dup']);
 assert.throws(()=>erasureGroup(data(),'a-cv'),/perfil principal/);
 assert.throws(()=>erasureGroup(data(),'missing'),/perfil principal/);
 const demo=data();demo.candidates.push(person('d',{demo:true}));assert.throws(()=>erasureGroup(demo,'d'),/exemplo/);
});

test('records, analyses, files and snapshots of the person are removed; others are untouched',()=>{
 const input=data(),before=JSON.stringify(input);
 const plan=planErasure(input,'a');
 assert.deepEqual(plan.ids,['a','a-cv','a-dup']);
 assert.deepEqual(plan.records.map(r=>r.candidateId),['c']);
 assert.deepEqual(plan.jobs.map(j=>j.analyses.map(a=>a.candidateId)),[['c'],['c']]);
 assert.equal(plan.jobs[1],input.jobs[1],'untouched vacancies keep their identity');
 assert.deepEqual(plan.fileKeys.sort(),['owner/a-cv.pdf','owner/a.pdf']);
 assert.deepEqual(plan.rewritten.map(r=>r.id),['b']);
 assert.deepEqual(plan.rewritten[0].payload.mergeHistory.map(h=>h.candidate.id),['z']);
 assert.equal(JSON.stringify(input),before,'the input is not mutated');
});

test('typed confirmation ignores accents, case and spacing but requires the full name',()=>{
 assert.equal(confirmsName({name:'Ana Lúcia Souza'},'  ana   lucia SOUZA '),true);
 assert.equal(confirmsName({name:'Ana Lúcia Souza'},'Ana Lúcia'),false);
 assert.equal(confirmsName({name:'Ana Lúcia Souza'},''),false);
});
