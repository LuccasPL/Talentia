import test from 'node:test';
import assert from 'node:assert/strict';
import {shortlistItems,filterShortlist,shortlistRecord} from '../lib/candidate-shortlist.ts';
import {recordSchema} from '../lib/validation.ts';
const record={candidateId:'a',jobId:'j',status:'Não contatar',interest:'Não confirmado',availability:'Não confirmada',notes:'Nota preservada',report:'Parecer preservado',reportNeedsReview:true,events:[],appointments:[],invitation:undefined,interview:undefined};
test('marking and removing a shortlist preserve stage, interest, reports and interviews; repeating does not add an event',()=>{
 const marked=shortlistRecord(record,true,'2026-10-09T16:00:00Z');assert.equal(marked.shortlisted,true);assert.equal(marked.events.length,1);
 for(const key of ['status','interest','availability','notes','report','reportNeedsReview','appointments','interview','invitation'])assert.deepEqual(marked[key],record[key]);
 assert.equal(shortlistRecord(marked,true,'later'),marked);const removed=shortlistRecord(marked,false,'2026-10-09T16:01:00Z');assert.equal(removed.shortlisted,false);assert.equal(removed.status,'Não contatar');assert.equal(removed.events.length,2);assert.equal(record.events.length,0);
});
test('shortlists belong to a vacancy, ignore orphan candidates and return only that vacancy evidence',()=>{
 const candidates=[{id:'a',name:'Ágata',city:'São Paulo',role:'Varejo'},{id:'b',name:'Bianca',city:'Recife',role:'Hospitalidade'}];
 const job={id:'j',analyses:[{candidateId:'a',evidence:[{quote:'Evidência desta vaga'}]}]};
 const records=[{...record,shortlisted:true},{...record,candidateId:'b',jobId:'other',shortlisted:true},{...record,candidateId:'deleted',shortlisted:true}];
 const list=shortlistItems(candidates,job,records);assert.equal(list.length,1);assert.equal(list[0].candidate.id,'a');assert.equal(list[0].analysis.evidence[0].quote,'Evidência desta vaga');
 assert.equal(shortlistItems(candidates,{id:'third',analyses:[]},records).length,0);assert.equal(shortlistItems(candidates,job,[{...record,shortlisted:false}]).length,0);
 assert.equal(filterShortlist(list,'agata sao paulo varejo','Não contatar').length,1);assert.equal(filterShortlist(list,'agata','Selecionado').length,0);
});
test('validation preserves the optional shortlist across unrelated saves and rejects nonboolean values',()=>{
 const old=recordSchema.parse(record);assert.equal(old.shortlisted,undefined);assert.equal(recordSchema.parse({...record,shortlisted:true}).shortlisted,true);assert.equal(recordSchema.parse({...record,shortlisted:false}).shortlisted,false);assert.throws(()=>recordSchema.parse({...record,shortlisted:'true'}));
});
