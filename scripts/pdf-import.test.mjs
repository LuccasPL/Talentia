import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfProblem,MAX_PDF_BYTES,batchExtraction} from '../lib/pdf-import.ts';
import {mergeImportedProfiles,singleImportCheck} from '../lib/import-monitor.ts';

test('background import results preserve edits, other profiles and deduplicate recovered IDs',()=>{
 const edited={id:'existing',name:'Nome corrigido'},manual={id:'manual',name:'Adicionado por texto'};
 const result=mergeImportedProfiles([edited,manual],[{id:'existing',name:'Nome antigo'},{id:'new',name:'Novo'},{id:'new',name:'Duplicado'}]);
 assert.deepEqual(result,[edited,manual,{id:'new',name:'Novo'}]);
 assert.deepEqual(mergeImportedProfiles(result,result),result);
});

test('dialog, focus and automatic refresh share one check and can retry after failure',async()=>{
 let resolve,calls=0;
 const check=singleImportCheck(()=>{calls++;return new Promise(done=>{resolve=done})});
 const first=check(),second=check();assert.equal(first,second);
 await Promise.resolve();assert.equal(calls,1);resolve('ready');await first;
 const third=check();await Promise.resolve();assert.equal(calls,2);resolve('again');assert.equal(await third,'again');
 let attempts=0;
 const retry=singleImportCheck(async()=>{if(++attempts===1)throw Error('temporary');return 'recovered'});
 await assert.rejects(retry(),/temporary/);assert.equal(await retry(),'recovered');
});
test('2 MB applies per file, includes boundary and rejects empty and other formats',()=>{
 assert.equal(pdfProblem({name:'CV.PDF',size:MAX_PDF_BYTES}),'');
 assert.match(pdfProblem({name:'CV.pdf',size:MAX_PDF_BYTES+1}),/2 MB/);
 assert.match(pdfProblem({name:'CV.pdf',size:0}),/vazio/);
 assert.match(pdfProblem({name:'CV.exe',size:100}),/PDF/);
});
const line=(id,type='succeeded',stop='end_turn')=>JSON.stringify({custom_id:id,result:{type,message:{stop_reason:stop,content:[{type:'thinking',text:'ignore'},{type:'text',text:'{"name":"Perfil fictício"}'}]}}});
test('results are associated by custom_id regardless of order, without thinking text',()=>{
 assert.deepEqual(batchExtraction(line('another')+'\n'+line('expected'),'expected'),{name:'Perfil fictício'});
});
test('missing, expired, error and incomplete results cannot become candidates',()=>{
 for(const content of [line('wrong'),line('expected','expired'),line('expected','errored'),line('expected','succeeded','max_tokens')])assert.throws(()=>batchExtraction(content,'expected'));
});
