import test from 'node:test';
import assert from 'node:assert/strict';
import {sweepFileQueue,fileCleanupWarning,fileCleanupRetryResponse} from '../lib/file-cleanup-workflow.ts';

function fixture(size=1){
 const state={queue:Array.from({length:size},(_,i)=>`owner-a/fake-${i}.pdf`),files:new Set(),calls:[],fail:'',throws:''};
 state.files=new Set(state.queue);
 function failed(op){if(state.throws===op)throw Error('simulated transport failure');return state.fail===op?Error('simulated API failure'):null;}
 const store={
  async list(owner,limit){state.calls.push(['list',owner,limit]);return {keys:state.queue.slice(0,limit),error:failed('list')};},
  async remove(keys){state.calls.push(['remove',keys.length]);const error=failed('remove');if(!error)keys.forEach(key=>state.files.delete(key));return {error};},
  async dequeue(owner,keys){state.calls.push(['dequeue',owner]);const error=failed('dequeue');if(!error)state.queue=state.queue.filter(key=>!keys.includes(key));return {error};},
  async count(owner){state.calls.push(['count',owner]);return {count:state.queue.length,error:failed('count')};},
 };
 return {state,store};
}

test('more than one batch stays pending and a later sweep completes it',async()=>{
 const {state,store}=fixture(125);
 assert.deepEqual(await sweepFileQueue('owner-a',store),{status:'pending',pending:25});
 assert.equal(state.files.size,25);assert.equal(state.queue.length,25);
 assert.deepEqual(state.calls,[['list','owner-a',100],['remove',100],['dequeue','owner-a'],['count','owner-a']]);
 assert.deepEqual(await sweepFileQueue('owner-a',store),{status:'complete',pending:0});
 assert.equal(state.files.size,0);assert.equal(state.queue.length,0);
});
test('read or storage failure never dequeues files or reports completion',async()=>{
 for(const fail of ['list','remove']){
  const {state,store}=fixture();state.fail=fail;
  assert.deepEqual(await sweepFileQueue('owner-a',store),{status:'unverified',pending:null});
  assert.equal(state.queue.length,1);assert.equal(state.files.size,1);
  assert.equal(state.calls.some(([op])=>op==='dequeue'),false);
 }
});
test('failed acknowledgement is unresolved and retries already removed files safely',async()=>{
 const {state,store}=fixture();state.fail='dequeue';
 assert.deepEqual(await sweepFileQueue('owner-a',store),{status:'unverified',pending:null});
 assert.equal(state.files.size,0);assert.equal(state.queue.length,1);
 state.fail='';
 assert.deepEqual(await sweepFileQueue('owner-a',store),{status:'complete',pending:0});
 assert.equal(state.queue.length,0);
});
test('count failure or thrown errors cannot become false success',async()=>{
 const {state,store}=fixture();state.fail='count';
 assert.deepEqual(await sweepFileQueue('owner-a',store),{status:'unverified',pending:null});
 for(const step of ['list','remove','dequeue','count']){
  const f=fixture();f.state.throws=step;
  assert.deepEqual(await sweepFileQueue('owner-a',f.store),{status:'unverified',pending:null});
 }
});
test('empty queues are confirmed by a fresh count, including concurrently added items',async()=>{
 const {state,store}=fixture(0);
 assert.deepEqual(await sweepFileQueue('owner-a',store),{status:'complete',pending:0});
 assert.equal(state.calls.some(([op])=>op==='remove'),false);
 store.count=async()=>({count:2,error:null});
 assert.deepEqual(await sweepFileQueue('owner-a',store),{status:'pending',pending:2});
});
test('unknown counts and foreign or invalid paths remain unverified',async()=>{
 for(const count of [null,NaN,-1,0.5]){
  const {store}=fixture(0);store.count=async()=>({count,error:null});
  assert.equal((await sweepFileQueue('owner-a',store)).status,'unverified');
 }
 for(const key of ['owner-b/fake.pdf','owner-a/',null]){
  const {state,store}=fixture();state.queue=[key];
  assert.equal((await sweepFileQueue('owner-a',store)).status,'unverified');
  assert.equal(state.calls.some(([op])=>op==='remove'),false);
 }
});
test('retry API returns 503 for unknown state instead of pending zero',async()=>{
 const unknown={status:'unverified',pending:null};
 const response=fileCleanupRetryResponse(unknown);
 assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{pending:null,complete:false,error:'Não foi possível confirmar a limpeza dos arquivos. Tente novamente.'});
 for(const result of [{status:'complete',pending:0},{status:'pending',pending:25}]){
  const r=fileCleanupRetryResponse(result);assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{pending:result.pending,complete:result.status==='complete'});
 }
 assert.match(fileCleanupWarning(unknown),/não foi possível confirmar/);
 assert.match(fileCleanupWarning({status:'pending',pending:25}),/25 arquivo/);
 assert.equal(fileCleanupWarning({status:'complete',pending:0}),'');
});
