import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contactItems,filterContactItems,approachRecord} from '../lib/contact-board.ts';
import {brazilDate} from '../lib/pt-br.ts';
const candidates=[{id:'a',name:'Ágata',role:'Vendedora',city:'São Paulo'},{id:'b',name:'Beatriz',role:'Recepcionista',city:'Osasco'}];
const existing={candidateId:'a',jobId:'other',status:'Respondeu',interest:'Interessado',availability:'Imediata',notes:'Nota de outra vaga',report:'Parecer de outra vaga',events:[{at:'2026-10-01T15:00:00Z',text:'Registro'}]};
test('contact queue includes people without records and isolates jobs',()=>{
 const items=contactItems(candidates,[existing],'current');
 assert.equal(items.length,2);
 assert.equal(items[0].record.status,'Não contatado');
 assert.equal(items[0].record.interest,'Não confirmado');
 assert.equal(items[0].record.notes,'');
 assert.equal(items[0].lastUpdate,'');
});
test('contact search ignores accents and combines stage with terms',()=>{
 const items=contactItems(candidates,[],'current');
 assert.deepEqual(filterContactItems(items,'agata sao','Não contatado').map(i=>i.candidate.id),['a']);
 assert.deepEqual(filterContactItems(items,'','Contato realizado'),[]);
});
test('registering an approach preserves notes, report and unconfirmed interest',()=>{
 const original={...contactItems(candidates,[],'current')[0].record,notes:'Teste',report:'Parecer salvo'};
 const next=approachRecord(original,'2026-10-09T12:00:00Z');
 assert.equal(next.status,'Contato realizado');
 assert.equal(next.interest,'Não confirmado');
 assert.equal(next.availability,'Não confirmada');
 assert.equal(next.notes,'Teste');assert.equal(next.report,'Parecer salvo');
 assert.equal(original.status,'Não contatado');assert.equal(original.events.length,0);
 assert.equal(next.events.length,1);
});
test('quick approach cannot overwrite a changed or do-not-contact stage',()=>{
 const base=contactItems(candidates,[],'current')[0].record;
 for(const status of ['Não contatar','Contato realizado','Respondeu','Encerrado'])assert.throws(()=>approachRecord({...base,status},'2026-10-09T12:00:00Z'),/etapa/);
});
test('last update uses actual latest event and Brazilian dates use Brasilia time',()=>{
 const r={...existing,jobId:'current',events:[{at:'2026-10-09T12:00:00Z',text:'New'},{at:'2026-10-01T12:00:00Z',text:'Old'}]};
 assert.equal(contactItems(candidates,[r],'current')[0].lastUpdate,'2026-10-09T12:00:00Z');
 assert.equal(brazilDate('2026-10-09T01:00:00Z'),'08/10/2026');
 assert.equal(brazilDate('invalid'),'Data não informada');
});
