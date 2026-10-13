import {test} from 'node:test';
import assert from 'node:assert/strict';
import {curriculumPending,attachmentChoices} from '../lib/manual-candidate.ts';
import {mergeCandidateData} from '../lib/candidate-duplicates.ts';
import {candidateSchema,candidateEditSchema} from '../lib/validation.ts';
const manual={id:'11111111-1111-4111-8111-111111111111',name:'Pessoa fictícia',role:'',city:'São Paulo',phone:'11999999999',email:'',text:'',source:'Cadastro manual',demo:false,updated:'2026-10-13'};
const pdf={...manual,id:'22222222-2222-4222-8222-222222222222',role:'Vendas',phone:'11888888888',email:'teste@example.invalid',text:'Experiência fictícia em vendas e atendimento.',source:'teste.pdf',fileKey:'owner/teste.pdf'};
test('manual candidate accepts only a name and can be edited without fabricated experience',()=>{
 assert.equal(candidateSchema.parse(manual).text,'');
 const {name,role,city,phone,email,text}=manual;
 assert.equal(candidateEditSchema.parse({candidateId:manual.id,version:1,changes:{name,role,city,phone,email,text},confirmedFields:[],method:'Outro'}).changes.text,'');
});
test('curriculum pending is explicit and clears when linked to a PDF',()=>{
 assert.equal(curriculumPending(manual),true);
 assert.equal(curriculumPending({...manual,cvSourceId:pdf.id}),false);
 assert.equal(curriculumPending(pdf),false);
});
test('link preserves identity, verified contacts, notes, appointments and archives PDF source',()=>{
 const data={candidates:[{...manual,verification:{phone:{at:'2026-10-13',method:'WhatsApp'}}},pdf],jobs:[{id:'job',analyses:[{candidateId:manual.id},{candidateId:'other'}]}],records:[{candidateId:manual.id,jobId:'job',notes:'Conversa já realizada',report:'Parecer anterior',events:[],appointments:[{id:'event'}]}]};
 const next=mergeCandidateData(data,manual.id,pdf.id,attachmentChoices(manual),'2026-10-13');
 const c=next.candidates[0];assert.equal(next.candidates.length,1);assert.equal(c.id,manual.id);assert.equal(c.phone,manual.phone);assert.equal(c.email,pdf.email);assert.equal(c.text,pdf.text);assert.equal(c.cvSourceId,pdf.id);assert.equal(c.verification.phone.method,'WhatsApp');
 assert.equal(next.archivedCandidates[0].fileKey,pdf.fileKey);assert.equal(next.records[0].notes,'Conversa já realizada');assert.equal(next.records[0].appointments[0].id,'event');assert.equal(next.records[0].reportNeedsReview,true);assert.deepEqual(next.jobs[0].analyses.map(a=>a.candidateId),['other']);assert.equal(data.candidates.length,2);
});
