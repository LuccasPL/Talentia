import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSearchIndex,findSearchMatches,searchOrder,validateSearchPlan,savedSearchSchema} from '../lib/assisted-search.ts';
import {filterCandidates,emptyFilters} from '../lib/candidate-search.ts';
import {jobSchema} from '../lib/validation.ts';
const candidate=(id,text,other={})=>({id,name:'Pessoa de teste',role:'Profissional',city:'São Paulo',text,phone:'',email:'',...other});
const plan=(concepts=[{label:'Hospitalidade',terms:['concierge','recepção de hotel']}])=>validateSearchPlan({query:'Experiência com hospitalidade',concepts,notes:'Revisar contexto.'});
const match=(candidates,p=plan(),mode='any')=>findSearchMatches(buildSearchIndex(candidates),p,mode);
test('related terms retrieve professional experience absent from exact search',()=>{
 const candidates=[candidate('a','Concierge responsável por receber hóspedes.'),candidate('b','Programação de sistemas.')];
 assert.equal(filterCandidates(candidates,{id:'job',analyses:[]},[],{...emptyFilters,experience:'hospitalidade'}).length,0);
 assert.deepEqual([...match(candidates).keys()],['a']);
 assert.equal(match(candidates).get('a').groups[0].snippet,candidates[0].text);
});
test('any and all experiences produce distinct explicit scopes',()=>{
 const p=plan([{label:'Hotelaria',terms:['concierge']},{label:'Varejo',terms:['vendas']}]);
 const candidates=[candidate('a','Concierge e vendas.'),candidate('b','Concierge.'),candidate('c','Contabilidade.')];
 assert.deepEqual([...match(candidates,p).keys()],['a','b']);
 assert.deepEqual([...match(candidates,p,'all').keys()],['a']);
});
test('accent normalization respects complete words and phrases',()=>{
 const p=plan([{label:'Recepção',terms:['recepcao de hotel','hotel']}]);
 assert.deepEqual([...match([candidate('a','RECEPÇÃO-DE-HOTEL'),candidate('b','Hoteliers trabalham aqui.')],p).keys()],['a']);
});
test('negative mentions remain visible and rank below affirmative context',()=>{
 const results=match([candidate('negative','Não tenho experiência como concierge.'),candidate('positive','Atuei como concierge.'),candidate('later','Sem experiência em concierge. Posteriormente trabalhei como concierge.')]);
 assert.equal(results.get('negative').groups[0].negated,true);
 assert.equal(results.get('positive').groups[0].negated,false);
 assert.equal(results.get('later').groups[0].negated,false);
 assert.ok(searchOrder(results.get('positive'),results.get('negative'))<0);
});
test('dedicated contact and location fields and protected lines do not drive results',()=>{
 assert.equal(match([candidate('a','Religião: concierge\nE-mail: concierge@example.invalid\nAtuação em sistemas.',{name:'Concierge',city:'Concierge',email:'concierge@example.invalid'})]).size,0);
});
test('long excerpts retain literal accented and hyphenated matching text',()=>{
 const text='Rotina profissional '.repeat(80)+'RECEPÇÃO-DE-HOTEL e atendimento presencial '+ 'outras atividades '.repeat(80);
 const result=match([candidate('a',text)]).get('a').groups[0];
 assert.ok(result.snippet.includes('RECEPÇÃO-DE-HOTEL'));
 assert.ok(text.includes(result.snippet.replace(/^…|…$/g,'')));
 assert.ok(result.snippet.length<=502);
});
test('plans reject protected attributes, blank terms and duplicate groups',()=>{
 assert.throws(()=>plan([{label:'Idade',terms:['jovem']}]),/atributos pessoais/);
 assert.throws(()=>plan([{label:'Experiência',terms:['---']}]),/termo válido/);
 assert.throws(()=>plan([{label:'Hotelaria',terms:['hotel']},{label:'hotelaria',terms:['concierge']}]),/repetidas/);
 assert.deepEqual(plan([{label:'Experiência',terms:['RECEPÇÃO','recepcao','hotel']}]).concepts[0].terms,['RECEPÇÃO','hotel']);
});
test('saved searches keep server-side validation and backwards compatibility',()=>{
 const job={id:'job',title:'Vaga',description:'',criteria:[],analyses:[],stage:0,engine:'',revision:1,updated:''};
 const saved={id:'00000000-0000-4000-8000-000000000001',name:'Hotelaria',plan:plan(),mode:'any',updated:'2026-10-11T12:00:00.000Z'};
 assert.equal(jobSchema.parse(job).savedSearches,undefined);
 assert.equal(jobSchema.parse({...job,savedSearches:[saved]}).savedSearches[0].name,'Hotelaria');
 assert.equal(savedSearchSchema.safeParse({...saved,plan:{...saved.plan,concepts:[{label:'Idade',terms:['jovem']}]}}).success,false);
 assert.equal(jobSchema.safeParse({...job,savedSearches:Array(6).fill(saved)}).success,false);
});
test('existing city and missing-contact filters narrow related results',()=>{
 const candidates=[candidate('a','Concierge de hotel.'),candidate('b','Concierge de hotel.',{city:'Osasco'}),candidate('c','Concierge de hotel.',{phone:'123',email:'a@example.invalid'})];
 const matches=match(candidates);
 const filtered=filterCandidates(candidates,{id:'job',analyses:[]},[],{...emptyFilters,city:'sao paulo',pending:'contact'}).filter(c=>matches.has(c.id));
 assert.deepEqual(filtered.map(c=>c.id),['a']);
});
test('retrieval scans all 5000 profiles without changing source data',()=>{
 const candidates=Array.from({length:5000},(_,i)=>candidate(`candidate-${i}`,i===4999?'Concierge de hotel.':'Experiência em desenvolvimento de software. '.repeat(30)));
 const before=candidates[4999].text;
 const matches=match(candidates);
 assert.deepEqual([...matches.keys()],['candidate-4999']);
 assert.equal(candidates[4999].text,before);
});
