import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareInterviewGuide,interviewItemCurrent,interviewSummary,recordInterview} from '../lib/interview-guide.ts';
import {recordSchema} from '../lib/validation.ts';
const candidate={id:'candidate-a',updated:'2026-10-09T12:00:00Z'};
const job={criteria:[{id:'found',text:'Atendimento no varejo',kind:'experiencia'},{id:'pending',text:'Colaboração',kind:'entrevista'}],analyses:[{candidateId:'candidate-a',evidence:[{criterionId:'found',status:'encontrada',question:'Pode descrever suas atividades de atendimento?'},{criterionId:'pending',status:'confirmar',question:'Conte uma situação em que apoiou sua equipe.'}]}]};
const record={candidateId:'candidate-a',jobId:'job-a',status:'Contato realizado',interest:'Não confirmado',availability:'Não confirmada',notes:'Preservar notas',report:'Parecer existente',events:[]};
test('guide prioritizes pending criteria and uses questions only from this candidate analysis',()=>{
 const guide=prepareInterviewGuide(candidate,job,undefined,'now');assert.equal(guide.items[0].criterionId,'pending');assert.equal(guide.items[0].question,'Conte uma situação em que apoiou sua equipe.');
 const another=prepareInterviewGuide({...candidate,id:'another'},job,undefined,'now');assert.ok(!another.items.some(i=>i.question==='Conte uma situação em que apoiou sua equipe.'));assert.ok(another.items.every(i=>!i.answer));
});
test('refresh preserves edited questions and answers and retains changed criteria as history',()=>{
 const old=prepareInterviewGuide(candidate,job,undefined,'now');old.items[0].question='Minha pergunta';old.items[0].answer='Minha resposta';
 const updatedJob={...job,criteria:[{...job.criteria[1],text:'Colaboração em equipes de loja'}]};
 const next=prepareInterviewGuide(candidate,updatedJob,old,'later');assert.equal(next.items[0].answer,'Minha resposta');assert.equal(next.items[0].question,'Minha pergunta');assert.equal(interviewItemCurrent(next.items[0],updatedJob),false);assert.equal(next.items.filter(i=>i.criterionText==='Colaboração em equipes de loja').length,1);
 const again=prepareInterviewGuide(candidate,updatedJob,next,'later');assert.equal(again.items.length,next.items.length);
});
test('saving answers preserves manual stages and flags an existing report for review',()=>{
 const guide=prepareInterviewGuide(candidate,job,undefined,'now');guide.items[0].answer='A pessoa relatou um exemplo de colaboração.';guide.items[0].observation='Aprofundar na próxima conversa.';
 const next=recordInterview(record,guide,'2026-10-09T15:00:00Z');assert.equal(next.status,record.status);assert.equal(next.interest,record.interest);assert.equal(next.availability,record.availability);assert.equal(next.report,record.report);assert.equal(next.notes,record.notes);assert.equal(next.reportNeedsReview,true);assert.match(interviewSummary(next.interview),/não são evidências documentais/);assert.match(interviewSummary(next.interview),/Observação da recrutadora/);
 const parsed=recordSchema.parse(next);assert.equal(parsed.interview.items[0].answer,guide.items[0].answer);assert.deepEqual(recordSchema.parse(record),record);
});
test('empty criteria, protected criteria and duplicate question IDs are rejected',()=>{
 assert.throws(()=>prepareInterviewGuide(candidate,{criteria:[],analyses:[]},undefined,'now'));
 assert.throws(()=>prepareInterviewGuide(candidate,{criteria:[{id:'x',text:'Idade até 30 anos',kind:'condicao'}],analyses:[]},undefined,'now'));
 const guide=prepareInterviewGuide(candidate,job,undefined,'now');guide.items[1].id=guide.items[0].id;assert.throws(()=>recordSchema.parse({...record,interview:guide}));
});
