import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfProblem,MAX_PDF_BYTES,batchExtraction} from '../lib/pdf-import.ts';
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
