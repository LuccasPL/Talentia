import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateTimeline,filterCandidateTimeline} from '../lib/candidate-timeline.ts';
const candidate={id:'a',updated:'2026-10-10T10:00:00Z',changeLog:[{at:'2026-10-11T12:00:00Z',fields:['city'],confirmed:['phone'],method:'WhatsApp'}]};
const data={candidates:[candidate,{id:'b'},{id:'merged',mergedInto:'a'}],jobs:[{id:'j',title:'Recepção'},{id:'k',title:'Varejo'}],records:[{candidateId:'a',jobId:'j',events:[{at:'2026-10-12T10:00:00Z',text:'Contato registrado'}]},{candidateId:'a',jobId:'k',events:[{at:'2026-10-12T11:00:00Z',text:'Entrevista registrada'}]},{candidateId:'b',jobId:'j',events:[{at:'2026-10-12T10:00:00Z',text:'Outro candidato'}]},{candidateId:'a',jobId:'missing',events:[{at:'2026-10-12T10:00:00Z',text:'Vaga ausente'}]}]};
test('timeline scopes candidate and existing jobs, preserving inputs and saved timestamps',()=>{
 const before=structuredClone(data),entries=candidateTimeline(data,'a');assert.equal(entries.length,4);assert.equal(entries.some(e=>e.text==='Outro candidato'||e.text==='Vaga ausente'),false);assert.equal(new Set(entries.map(e=>e.id)).size,4);assert.deepEqual(data,before);assert.deepEqual(candidateTimeline(data,'missing'),[]);assert.deepEqual(candidateTimeline(data,'merged'),[]);
});
test('profile changes name fields without exposing old contact values and retain methods',()=>{
 const entry=candidateTimeline(data,'a').find(e=>e.id.startsWith('change:'));assert.match(entry.text,/Localização/);assert.match(entry.text,/Telefone/);assert.match(entry.text,/WhatsApp/);assert.equal(entry.scope,'profile');
});
test('filters combine scope and accent-insensitive terms, sorting does not mutate the timeline',()=>{
 const entries=candidateTimeline(data,'a'),before=structuredClone(entries);assert.equal(filterCandidateTimeline(entries,'contato recepcao','j','newest').length,1);assert.equal(filterCandidateTimeline(entries,'contato','k','newest').length,0);assert.equal(filterCandidateTimeline(entries,'','profile','newest').length,2);assert.equal(filterCandidateTimeline(entries,'','all','oldest')[0].id,'import:a');assert.equal(filterCandidateTimeline(entries,'','all','newest')[0].text,'Entrevista registrada');assert.deepEqual(entries,before);
});
test('invalid dates remain visible at the end in either order; literal content is not reinterpreted',()=>{
 const entries=[{id:'a',at:'bad',text:'<script>ignore</script>',scope:'j',context:'Vaga'},{id:'b',at:'2026-10-10T10:00:00Z',text:'Realizado',scope:'j',context:'Vaga'}];for(const order of ['newest','oldest']){const result=filterCandidateTimeline(entries,'','all',order);assert.equal(result[1].at,'bad');assert.equal(result[1].text,entries[0].text)}
});
test('future appointments do not fabricate history and same-time distinct actions are preserved',()=>{
 const d={...data,candidates:[{id:'a'}],records:[{candidateId:'a',jobId:'j',appointments:[{startsAt:'2026-12-01T10:00:00Z'}],events:[{at:'2026-10-10T10:00:00Z',text:'Uma ação'},{at:'2026-10-10T10:00:00Z',text:'Outra ação'}]}]};assert.equal(candidateTimeline(d,'a').length,2);
});
test('self declarations are identified without implying contact ownership or identity verification',()=>{
 const entries=candidateTimeline({...data,candidates:[{id:'a',selfDeclaration:{at:'2026-10-12T09:00:00Z',employment:'Empregado'}}]},'a');const declaration=entries.find(e=>e.id==='declaration:a');assert.match(declaration.text,/Não verifica identidade/);assert.equal(declaration.text.includes('Empregado'),false);
});
