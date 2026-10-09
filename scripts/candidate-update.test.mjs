import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updateCandidateData} from '../lib/candidate-update.ts';
const c={id:'c',name:'Teste',role:'Atendimento',city:'São Paulo',phone:'11999990000',email:'teste@example.invalid',text:'Experiência fictícia com atendimento e varejo.',fileKey:'owner/original.pdf',source:'original.pdf',updated:'2026-10-01',verification:{phone:{at:'2026-10-01',method:'Telefone'}}};
const data={candidates:[c],jobs:[{id:'job',analyses:[{candidateId:'c'},{candidateId:'other'}]}],records:[{candidateId:'c',jobId:'job',report:'Parecer',invitation:{message:'Convite'}},{candidateId:'other',report:'Outro'}]};
const changes={name:c.name,role:c.role,city:c.city,phone:c.phone,email:c.email,text:c.text};
test('editing a phone clears old confirmation without auto-confirming the replacement',()=>{
 const d=updateCandidateData(data,'c',{...changes,phone:'11888880000'},[],'WhatsApp','2026-10-09');
 assert.equal(d.candidates[0].verification.phone,undefined);
 assert.equal(d.candidates[0].updated,c.updated);assert.equal(d.candidates[0].fileKey,c.fileKey);
 assert.equal(d.candidates[0].originalText,c.text);
 assert.equal(d.jobs[0].analyses.length,2);
 assert.equal(d.records[0].reportNeedsReview,true);assert.equal(d.records[0].invitation.message,'Convite');
 assert.ok(c.verification.phone);
});
test('explicit confirmation records time and method only for selected fields',()=>{
 const d=updateCandidateData(data,'c',changes,['email','city'],'WhatsApp','2026-10-09');
 assert.equal(d.candidates[0].verification.email.at,'2026-10-09');
 assert.equal(d.candidates[0].verification.city.method,'WhatsApp');
 assert.equal(d.candidates[0].verification.phone.at,'2026-10-01');
 assert.equal(d.records[0].reportNeedsReview,undefined);
});
test('experience correction invalidates only that candidate analysis and preserves the first source',()=>{
 const first=updateCandidateData(data,'c',{...changes,text:'Nova experiência fictícia em hospitalidade e recepção.'},[],'Outro','2026-10-09');
 assert.deepEqual(first.jobs[0].analyses.map(a=>a.candidateId),['other']);
 assert.equal(first.records[0].report,'Parecer');assert.equal(first.records[0].reportNeedsReview,true);
 assert.equal(first.records[1].reportNeedsReview,undefined);
 const second=updateCandidateData(first,'c',{...changes,text:'Outra experiência fictícia com vendas e atendimento.'},[],'Outro','2026-10-10');
 assert.equal(second.candidates[0].originalText,c.text);assert.equal(second.candidates[0].changeLog.length,2);
});
test('unknown candidates and empty confirmed fields are rejected',()=>{
 assert.throws(()=>updateCandidateData(data,'foreign',changes,[],'Outro','now'),/não encontrado/);
 assert.throws(()=>updateCandidateData(data,'c',{...changes,email:''},['email'],'Outro','now'),/Preencha/);
});
