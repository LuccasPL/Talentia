import test from 'node:test';
import assert from 'node:assert/strict';
import {duplicatePairs,mergeCandidateData,defaultMergeChoices,preservedVersions} from '../lib/candidate-duplicates.ts';
import {emptyRecord} from '../lib/domain.ts';
const profile=(id,extra={})=>({id,name:'Pessoa Fictícia Teste',role:'Atendimento',city:'São Paulo',phone:'',email:'',text:'Experiência fictícia com atendimento em loja e recepção.',source:`CV ${id}.pdf`,fileKey:`owner/${id}.pdf`,updated:'2026-10-10T10:00:00.000Z',demo:false,...extra});
const primary=profile('a',{phone:'(11) 91234-5678',email:'PESSOA@example.invalid',verification:{phone:{at:'old',method:'Telefone'}}}),secondary=profile('b',{name:'Pessoa Ficticia Teste',phone:'+55 11 91234-5678',email:'pessoa@example.invalid'});
const data=()=>({candidates:[primary,secondary],jobs:[{id:'job',analyses:[{candidateId:'a',evidence:[]},{candidateId:'b',evidence:[]}]}],records:[],aiConfigured:true,version:1});

test('merging preserves a pending follow-up over a completed one and the latest registered contact',()=>{
 const input=data();input.records=[{...emptyRecord('a','job'),lastContactAt:'2026-10-09T15:00:00.000Z',followUp:{date:'2026-10-09',note:'Concluído',updated:'2026-10-09T15:00:00.000Z',completedAt:'2026-10-09T15:00:00.000Z'}},{...emptyRecord('b','job'),lastContactAt:'2026-10-10T15:00:00.000Z',followUp:{date:'2026-10-12',note:'Retomar contato',updated:'2026-10-10T15:00:00.000Z'}}];
 const output=mergeCandidateData(input,'a','b',defaultMergeChoices,'2026-10-10T18:00:00.000Z');
 const record=output.records.find(r=>r.candidateId==='a');assert.equal(record.followUp.note,'Retomar contato');assert.equal(record.followUp.completedAt,undefined);assert.equal(record.lastContactAt,'2026-10-10T15:00:00.000Z');assert.equal(output.records.find(r=>r.candidateId==='b').followUp.note,'Retomar contato');
});
test('duplicate signals normalize accents and Brazilian phone prefixes without treating empty contacts as evidence',()=>{
 const result=duplicatePairs([primary,secondary]);assert.equal(result.pairs.length,1);assert.deepEqual(new Set(result.pairs[0].reasons),new Set(['Nome completo igual','Telefone igual','E-mail igual']));
 assert.equal(duplicatePairs([profile('x',{name:'Ana Lima'}),profile('y',{name:'Bia Santos'})]).pairs.length,0);
 assert.equal(duplicatePairs([primary,{...secondary,mergedInto:'a'}]).pairs.length,0);
 assert.equal(duplicatePairs([primary,{...secondary,demo:true}]).pairs.length,0);
 assert.equal(duplicatePairs([primary,secondary],'inexistente').pairs.length,0);
 assert.equal(duplicatePairs([profile('x',{name:'Ana Lima'}),profile('y',{name:'Ana Lima'})]).pairs[0].reasons.length,1);
});
test('large same-name groups remain bounded and query can find a profile beyond the visible limit',()=>{
 const group=Array.from({length:5000},(_,i)=>profile(String(i),{email:`teste${i}@example.invalid`}));
 assert.equal(duplicatePairs(group).pairs.length,200);assert.equal(duplicatePairs(group).limited,true);
 assert.equal(duplicatePairs(group,'teste4999@').pairs.length,1);
});
test('merge keeps files, original profiles and both histories; selected fields clear confirmation and require new analysis',()=>{
 const a={...emptyRecord('a','job'),status:'Entrevista',notes:'Nota principal',report:'Parecer principal',shortlisted:true,interest:'Interessado',appointments:[{id:'meeting-a'}],interview:{candidateRevision:'v1',preparedAt:'old',updated:'old',items:[{id:'q-a',answer:'Resposta A'}]},invitation:{message:'Rascunho A'},events:[{at:'old',text:'Evento A'}]};
 const b={...emptyRecord('b','job'),status:'Não contatar',notes:'Nota secundária',report:'Parecer secundário',appointments:[{id:'meeting-b'}],interview:{candidateRevision:'v2',preparedAt:'old',updated:'old',items:[{id:'q-b',answer:'Resposta B'}]},invitation:{message:'Rascunho B'},events:[{at:'old',text:'Evento B'}]};
 const original={...data(),records:[a,b]};
 const result=mergeCandidateData(original,'a','b',{...defaultMergeChoices,phone:'secondary',text:'secondary'},'now');
 assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].fileKey,primary.fileKey);assert.equal(result.candidates[0].cvSourceId,'b');assert.equal(result.candidates[0].verification.phone,undefined);
 assert.equal(result.candidates[0].originalText,primary.text);assert.deepEqual(result.candidates[0].mergeHistory[0].candidate,primary);assert.deepEqual(result.candidates[0].mergeHistory[0].records,[a]);assert.equal(result.archivedCandidates[0].fileKey,secondary.fileKey);assert.equal(result.archivedCandidates[0].mergedInto,'a');
 const merged=result.records.find(r=>r.candidateId==='a');assert.match(merged.notes,/Nota secundária/);assert.match(merged.report,/Parecer secundário/);assert.equal(merged.reportNeedsReview,true);assert.equal(merged.status,'Não contatar');assert.equal(merged.shortlisted,true);assert.equal(merged.appointments.length,2);assert.equal(merged.interview.items.length,2);assert.equal(merged.invitation.message,'Rascunho A');assert.deepEqual(result.records.find(r=>r.candidateId==='b'),b);assert.equal(result.jobs[0].analyses.some(a=>a.candidateId==='a'),false);
 assert.deepEqual(original.records,[a,b]);assert.equal(original.candidates.length,2);
});
test('new-vacancy records are moved into the principal without dropping the original archive record',()=>{
 const b={...emptyRecord('b','other-job'),status:'Respondeu',availability:'Manhã'};
 const result=mergeCandidateData({...data(),records:[b]},'a','b',defaultMergeChoices,'now');
 assert.equal(result.records.find(r=>r.candidateId==='a').jobId,'other-job');assert.equal(result.records.find(r=>r.candidateId==='a').availability,'Manhã');assert.deepEqual(result.records.find(r=>r.candidateId==='b'),b);
});
test('a restored profile remains accessible as the chosen CV version without duplicate version entries',()=>{
 const merged=mergeCandidateData(data(),'a','b',{...defaultMergeChoices,text:'secondary'},'now');
 assert.deepEqual(preservedVersions(merged,merged.candidates[0]).map(c=>c.id),['a','b']);
 const restored={...merged,candidates:[...merged.candidates,secondary],archivedCandidates:[]};
 assert.deepEqual(preservedVersions(restored,restored.candidates[0]).map(c=>c.id),['a','b']);
});
test('merges reject unavailable profiles, loops and overflowing histories instead of truncating data',()=>{
 assert.throws(()=>mergeCandidateData(data(),'a','a',defaultMergeChoices,'now'));
 assert.throws(()=>mergeCandidateData(data(),'a','missing',defaultMergeChoices,'now'));
 assert.throws(()=>mergeCandidateData({...data(),archivedCandidates:[profile('old',{mergedInto:'b'})]},'a','b',defaultMergeChoices,'now'),/principal/);
 const records=[{...emptyRecord('a','job'),notes:'a'.repeat(20000)},{...emptyRecord('b','job'),notes:'texto adicional'}];
 assert.throws(()=>mergeCandidateData({...data(),records},'a','b',defaultMergeChoices,'now'),/limite/);
});
