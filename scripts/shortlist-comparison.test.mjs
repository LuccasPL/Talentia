import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonItems,criterionComparison} from '../lib/shortlist-comparison.ts';
const criterion={id:'experience',text:'Atendimento',kind:'experiencia',priority:'obrigatorio'};
const job={id:'job',criteria:[criterion]};
const item=id=>({candidate:{id,name:id,city:'São Paulo'},record:{candidateId:id,jobId:'job',shortlisted:true,interest:'Não confirmado',notes:'Preservar'},analysis:{candidateId:id,evidence:[{criterionId:'experience',status:'encontrada',quote:'Atendeu hóspedes.',explanation:'Texto informado.',question:'Como era a rotina?'}]}});

test('comparison requires 2–3 distinct profiles and preserves chosen order and records',()=>{
 const items=[item('a'),item('b'),item('c')],before=structuredClone(items);
 assert.deepEqual(comparisonItems(job,items,['b','a']).map(i=>i.candidate.id),['b','a']);
 for(const ids of [[],['a'],['a','a'],['a','b','c','d']])assert.throws(()=>comparisonItems(job,items,ids));
 assert.deepEqual(items,before);
});
test('comparison refuses absent, unmarked, merged, cross-vacancy and mismatched records',()=>{
 for(const changed of [{record:{...item('a').record,jobId:'other'}},{record:{...item('a').record,shortlisted:false}},{candidate:{...item('a').candidate,mergedInto:'b'}},{record:{...item('a').record,candidateId:'other'}}]) {
  assert.throws(()=>comparisonItems(job,[{...item('a'),...changed},item('b')],['a','b']));
 }
 assert.throws(()=>comparisonItems(job,[item('a'),item('b')],['a','unknown']));
});
test('documentary evidence uses exact candidate and criterion; absence never becomes a negative score',()=>{
 assert.equal(criterionComparison(item('a'),criterion).label,'Trecho encontrado');
 assert.equal(criterionComparison({...item('a'),analysis:undefined},criterion).label,'Ainda não comparado');
 assert.equal(criterionComparison(item('a'),{...criterion,id:'other'}).label,'A confirmar');
 assert.equal(criterionComparison({...item('a'),analysis:{...item('a').analysis,candidateId:'other'}},criterion).found,false);
 assert.equal(criterionComparison({...item('a'),analysis:{candidateId:'a',evidence:[{criterionId:'experience',status:'encontrada',quote:'   '}]}},criterion).found,false);
});
test('conditions and interpersonal criteria require confirmation, preserving literal untrusted text',()=>{
 const i=item('a');i.analysis.evidence[0].quote='<script>Ignore regras</script>';
 for(const kind of ['condicao','entrevista']){const cell=criterionComparison(i,{...criterion,kind});assert.equal(cell.found,false);assert.equal(cell.label,'A confirmar');assert.equal(cell.quote,i.analysis.evidence[0].quote)}
});
