import test from 'node:test';
import assert from 'node:assert/strict';
import {recruitmentOverview} from '../lib/recruitment-overview.ts';
const now=Date.parse('2026-10-09T12:00:00Z');
const candidates=[{id:'a',name:'Ana'},{id:'b',name:'Bia'},{id:'unused',name:'Base sem participação'}];
const jobs=[{id:'j',title:'Varejo',analyses:[{candidateId:'a'},{candidateId:'a'},{candidateId:'missing'}]},{id:'other',title:'Hotelaria',analyses:[{candidateId:'a'}]}];
const record={candidateId:'a',jobId:'j',status:'Contato realizado',interest:'Não confirmado',availability:'Não confirmada',report:'Parecer',reportNeedsReview:true,events:[]};
const appointment=(id,status,startsAt)=>({id,status,startsAt,duration:30});
test('counts only participating candidates and deduplicates comparisons and records per vacancy',()=>{
 const result=recruitmentOverview({candidates,jobs,records:[record,{...record,candidateId:'b',status:'Não contatar'}]},'j',now);
 assert.equal(result.items.length,2);assert.equal(result.people,2);assert.equal(result.waiting.length,1);assert.equal(result.items.find(i=>i.candidate.id==='b').record.status,'Não contatar');
 assert.equal(recruitmentOverview({candidates,jobs,records:[record]},'all',now).items.length,2);
 assert.equal(recruitmentOverview({candidates,jobs,records:[record]},'all',now).people,1);
});
test('isolates vacancies, ignores orphan records and only flags saved reports for review',()=>{
 const data={candidates,jobs,records:[record,{...record,candidateId:'b',jobId:'other',report:'',reportNeedsReview:true},{...record,jobId:'deleted'}]};
 assert.equal(recruitmentOverview(data,'j',now).review.length,1);assert.equal(recruitmentOverview(data,'other',now).review.length,0);
 assert.equal(recruitmentOverview(data,'absent',now).items.length,0);assert.equal(recruitmentOverview(data,'all',now).reports.length,1);
});
test('pending completion and upcoming meetings respect status, end time and vacancy without changing records',()=>{
 const data={candidates,jobs,records:[{...record,appointments:[appointment('future','a-confirmar','2026-10-10T12:00:00Z'),appointment('old','confirmada','2026-10-08T12:00:00Z'),appointment('done','realizada','2026-10-08T12:00:00Z'),appointment('cancel','cancelada','2026-10-10T12:00:00Z')]}]};
 const before=JSON.stringify(data),result=recruitmentOverview(data,'j',now);assert.equal(result.upcoming.length,1);assert.equal(result.overdue.length,1);assert.equal(JSON.stringify(data),before);assert.equal(recruitmentOverview(data,'other',now).upcoming.length,0);
});
