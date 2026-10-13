import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reportSources,reportReviewNeeded,reconcileReportReviews,jobReportChanged} from '../lib/report-review.ts';
import {preparePresentation} from '../lib/client-presentation.ts';
import {recordSchema} from '../lib/validation.ts';

const candidateId='00000000-0000-4000-8000-000000000001';
const at='2026-10-12T15:00:00.000Z';
const make=()=>({version:2,aiConfigured:false,clients:[{id:'client',name:'Cliente fictício'}],candidates:[{id:candidateId,name:'Perfil fictício',role:'Atendimento',city:'São Paulo',text:'Experiência fictícia de atendimento em loja.',phone:'',email:'',source:'Teste',updated:at,demo:true}],jobs:[{id:'job',title:'Loja',description:'Hospitalidade e varejo',clientId:'client',criteria:[{id:'c',text:'Varejo',kind:'experiencia',priority:'diferencial'}],analyses:[{candidateId,evidence:[{criterionId:'c',status:'encontrada',quote:'atendimento em loja',explanation:'Trecho',question:'Conte uma experiência.'}]}],conditions:{location:'Paulista'},engine:'Claude',stage:2,revision:1,updated:at}],records:[{candidateId,jobId:'job',status:'Respondeu',interest:'Interessado',availability:'A confirmar',notes:'Nota fictícia',report:'PARECER DA RECRUTADORA\nTexto original revisado.',shortlisted:true,events:[]}]});
function hashes(data){const source=reportSources(data);return r=>{const text=source(r);return text===null?null:createHash('sha256').update(text).digest('hex')};}
function approve(data){return {...data,records:reconcileReportReviews(data,data,hashes(data),{candidateId,jobId:'job'},at)};}
function reconcile(current,next,approval){return {...next,records:reconcileReportReviews(current,next,hashes(next),approval,at)};}

test('legacy reports require an explicit first review without rewriting their content',()=>{
 const data=make(),before=structuredClone(data),result=reconcile(data,data);
 assert.equal(result.records[0].reportNeedsReview,true);assert.equal(result.records[0].reportReview,undefined);
 assert.equal(result.records[0].report,data.records[0].report);assert.deepEqual(data,before);
 const reviewed=approve(result);assert.equal(reportReviewNeeded(reviewed.records[0],hashes(reviewed)(reviewed.records[0])),false);
 assert.equal(reviewed.records[0].reportReview.reviewedAt,at);assert.deepEqual(recordSchema.parse(reviewed.records[0]),reviewed.records[0]);
});

test('briefing, title, criteria type/priority/text, conditions, client and evidence changes invalidate review',()=>{
 const current=approve(make());
 for(const change of [d=>d.jobs[0].description+=' e vendas',d=>d.jobs[0].title='Outra vaga',d=>d.jobs[0].criteria[0].text='Hospitalidade',d=>d.jobs[0].criteria[0].kind='entrevista',d=>d.jobs[0].criteria[0].priority='obrigatorio',d=>d.jobs[0].criteria=[],d=>d.jobs[0].conditions.location='Outro local',d=>d.clients[0].name='Outro cliente',d=>d.jobs[0].analyses[0].evidence[0].quote='Outro trecho']){
  const next=structuredClone(current);change(next);const result=reconcile(current,next);assert.equal(result.records[0].reportNeedsReview,true);assert.equal(result.records[0].report,current.records[0].report);
 }
});

test('candidate data, interview records, interest, availability, notes and report text invalidate review',()=>{
 const current=approve(make());
 for(const change of [d=>d.candidates[0].text+=' Nova experiência.',d=>d.candidates[0].name='Nome corrigido',d=>d.candidates[0].city='Osasco',d=>d.records[0].notes+=' Uma informação.',d=>d.records[0].availability='Somente à tarde',d=>d.records[0].interest='Sem interesse',d=>d.records[0].report+=' Alterado',d=>d.records[0].interview={items:[{question:'Pergunta',answer:'Resposta'}]},d=>d.candidates[0].selfDeclaration={at,employment:'Trabalhando'}]){
  const next=structuredClone(current);change(next);assert.equal(reconcile(current,next).records[0].reportNeedsReview,true);
 }
});

test('calendar, follow-up, shortlist, timestamps and unrelated profile analyses do not invalidate review',()=>{
 const current=approve(make()),next=structuredClone(current);
 next.records[0].shortlisted=false;next.records[0].events.push({at,text:'Contato agendado'});next.records[0].appointments=[{id:'appointment',startsAt:at}];next.records[0].followUp={date:'2026-10-13'};
 next.jobs[0].updated='2026-10-13T10:00:00.000Z';next.jobs[0].stage=1;next.jobs[0].revision=2;next.jobs[0].analyses.push({candidateId:'other',evidence:[]});
 next.candidates[0].editedAt=at;next.candidates[0].verification={city:{at,method:'WhatsApp'}};
 assert.equal(reconcile(current,next).records[0].reportNeedsReview,false);
});

test('a routine save cannot clear review or replace server-owned review metadata',()=>{
 const current=approve(make());current.records[0].reportNeedsReview=true;
 const next=structuredClone(current);next.records[0].reportNeedsReview=false;next.records[0].reportReview={sourceHash:'f'.repeat(64),reviewedAt:'2026-10-14T00:00:00.000Z'};
 const saved=reconcile(current,next);assert.equal(saved.records[0].reportNeedsReview,true);assert.deepEqual(saved.records[0].reportReview,current.records[0].reportReview);
 const reviewed=reconcile(current,next,{candidateId,jobId:'job'});assert.equal(reviewed.records[0].reportNeedsReview,false);assert.equal(reviewed.records[0].reportReview.sourceHash,hashes(next)(next.records[0]));
});

test('approval is scoped to one exact candidate-vacancy pair and empty/missing targets are refused',()=>{
 const data=make();data.jobs.push({...structuredClone(data.jobs[0]),id:'other'});data.records.push({...structuredClone(data.records[0]),jobId:'other'});
 const reviewed=approve(data);assert.equal(reviewed.records[0].reportNeedsReview,false);assert.equal(reviewed.records[1].reportNeedsReview,true);
 assert.throws(()=>reconcile(data,data,{candidateId,jobId:'missing'}),/preenchido/);
 const empty=make();empty.records[0].report='  ';assert.throws(()=>approve(empty),/preenchido/);assert.equal(reconcile(empty,empty).records[0].reportReview,undefined);
 const missing=make();missing.candidates=[];assert.throws(()=>approve(missing),/não está disponível/);
});

test('read-time verification detects stale sources even if a write omitted the review flag',()=>{
 const current=approve(make()),next=structuredClone(current);next.jobs[0].criteria[0].text='Novo critério';
 const record=next.records[0];assert.equal(record.reportNeedsReview,false);assert.equal(reportReviewNeeded(record,hashes(next)(record)),true);
 const checked={...next,records:next.records.map(r=>({...r,reportNeedsReview:reportReviewNeeded(r,hashes(next)(r))}))};
 assert.throws(()=>preparePresentation(checked,{jobId:'job',candidateIds:[candidateId],version:2}),/Revise/);
});

test('canonical fingerprints survive object key reordering during JSONB storage',()=>{
 const data=approve(make()),next=structuredClone(data);next.jobs[0].criteria[0]={priority:'diferencial',kind:'experiencia',text:'Varejo',id:'c'};
 next.records[0].reportReview={reviewedAt:at,sourceHash:data.records[0].reportReview.sourceHash};
 assert.equal(hashes(data)(data.records[0]),hashes(next)(next.records[0]));assert.equal(reportReviewNeeded(next.records[0],hashes(next)(next.records[0])),false);
 assert.equal(jobReportChanged(data.jobs[0],next.jobs[0]),false);
});

test('reapproval binds to the current sources and only stores a digest and review date',()=>{
 const current=approve(make()),next=structuredClone(current);next.records[0].notes+=' Informação nova.';next.records[0].report+=' Texto conferido.';
 const reviewed=reconcile(current,next,{candidateId,jobId:'job'});assert.equal(reportReviewNeeded(reviewed.records[0],hashes(reviewed)(reviewed.records[0])),false);
 assert.deepEqual(Object.keys(reviewed.records[0].reportReview).sort(),['reviewedAt','sourceHash']);assert.match(reviewed.records[0].reportReview.sourceHash,/^[a-f0-9]{64}$/);
 assert.doesNotMatch(JSON.stringify(reviewed.records[0].reportReview),/Informação nova|Experiência|atendimento/);
 assert.equal(preparePresentation(reviewed,{jobId:'job',candidateIds:[candidateId],version:2}).profiles.length,1);
});
