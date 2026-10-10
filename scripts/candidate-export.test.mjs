import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCell,candidateCsv} from '../lib/candidate-export.ts';
const profile={id:'id-1',name:'Álvaro; "Silva"',role:'Atendimento',city:'São Paulo',phone:'+55 11 99999-0000',email:'candidato@example.invalid',source:'currículo.pdf',updated:'2026-10-11T01:00:00Z',verification:{phone:{at:'2026-10-10T14:00:00Z',method:'Contato'}}};
test('CSV uses Brazilian headers, UTF-8 BOM, quoted fields and Brasilia dates',()=>{
 const csv=candidateCsv([profile]);assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/"Nome";"Cargo"/);assert.match(csv,/"Álvaro; ""Silva"""/);assert.match(csv,/10\/10\/2026, 22:00/);assert.match(csv,/10\/10\/2026, 11:00/);assert.ok(csv.endsWith('\r\n'));
});
test('untrusted spreadsheet formulas remain text, including whitespace and newlines',()=>{
 for(const text of ['=HYPERLINK("https://attacker.invalid")',' +SUM(1;2)','\t@SUM(1;2)','\r\n-1+2','\uFEFF=2+2','\u0000=2+2'])assert.ok(csvCell(text).startsWith('"\''));
 assert.equal(csvCell('=1;"x"'),'"\'=1;""x"""');assert.equal(csvCell(null),'""');
});
test('export omits archived profiles and private CV/report fields without modifying the source',()=>{
 const all=[{...profile,text:'CV PRIVATE',fileKey:'PRIVATE PATH',mergeHistory:'PRIVATE HISTORY',report:'PRIVATE REPORT'},{...profile,id:'id-2',archived:'id-1',name:'ARCHIVED'}];const before=JSON.stringify(all),csv=candidateCsv(all);
 for(const text of ['CV PRIVATE','PRIVATE PATH','PRIVATE HISTORY','PRIVATE REPORT','ARCHIVED'])assert.ok(!csv.includes(text));assert.equal(JSON.stringify(all),before);assert.equal(candidateCsv([]).split('\r\n').length,2);
});
