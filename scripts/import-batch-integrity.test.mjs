import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {batchSignature,verifiedBatch,deleteVerifiedBatches} from '../lib/import-batch-integrity.ts';

const secret='fictional-signing-secret-for-tests';
function proof(extra={}){
 const row={owner:'owner-a',id:'import-a',file_key:'owner-a/fake.pdf',candidate_id:'candidate-a',batch_id:'msgbatch_FakeA',...extra};
 return {...row,batch_signature:batchSignature(row,row.batch_id,secret)};
}
test('signatures remain compatible with already signed imports',()=>{
 const row=proof();
 const legacy=createHmac('sha256',secret).update(JSON.stringify([row.owner,row.id,row.file_key,row.candidate_id,row.batch_id])).digest('hex');
 assert.equal(row.batch_signature,legacy);
 assert.equal(verifiedBatch('owner-a',row,secret),true);
});
test('proof binds owner, import, document, candidate and provider batch',()=>{
 const row=proof();
 for(const changed of [{owner:'owner-b'},{id:'import-b'},{file_key:'owner-a/other.pdf'},{candidate_id:'candidate-b'},{batch_id:'msgbatch_FakeB'}]){
  assert.equal(verifiedBatch('owner-a',{...row,...changed},secret),false);
 }
 assert.equal(verifiedBatch('owner-b',row,secret),false);
 assert.equal(verifiedBatch('owner-a',proof({file_key:'owner-b/foreign.pdf'}),secret),false);
});
test('missing, malformed, forged and old-key proofs fail closed',()=>{
 const row=proof();
 for(const batch_signature of [null,undefined,'','x'.repeat(64),'a'.repeat(64)])assert.equal(verifiedBatch('owner-a',{...row,batch_signature},secret),false);
 for(const key of ['', 'rotated-fictional-key'])assert.equal(verifiedBatch('owner-a',row,key),false);
 assert.equal(verifiedBatch('owner-a',proof({batch_id:'../other'}),secret),false);
});
test('forged database batch IDs never reach the provider deletion callback',async()=>{
 const calls=[];
 const row=proof();
 const forged={...row,batch_id:'msgbatch_OtherAccount'};
 const failed=await deleteVerifiedBatches('owner-a',[forged.batch_id],[forged],secret,async id=>calls.push(id));
 assert.equal(failed,1);assert.deepEqual(calls,[]);
});
test('only requested verified batches are removed, once, and failures are reported',async()=>{
 const row=proof(),second=proof({id:'import-b',batch_id:'msgbatch_FakeB'}),untouched=proof({id:'import-c',batch_id:'msgbatch_FakeC'});
 const calls=[];
 const failed=await deleteVerifiedBatches('owner-a',[row.batch_id,row.batch_id,second.batch_id,'bad-id'],[row,second,untouched],secret,async id=>{calls.push(id);if(id===second.batch_id)throw Error('simulated provider failure')});
 assert.deepEqual(calls,[row.batch_id,second.batch_id]);assert.equal(failed,2);
});
test('absent snapshots or another account cannot authorize deletion',async()=>{
 const calls=[],row=proof();
 assert.equal(await deleteVerifiedBatches('owner-a',[row.batch_id],[],secret,async id=>calls.push(id)),1);
 assert.equal(await deleteVerifiedBatches('owner-b',[row.batch_id],[row],secret,async id=>calls.push(id)),1);
 assert.deepEqual(calls,[]);
});
