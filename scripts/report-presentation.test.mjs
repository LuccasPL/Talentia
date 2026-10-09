import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportSections} from '../lib/report-presentation.ts';
test('draft sections preserve quotes and recruiter assessment',()=>{
 const text='PARECER PARA REVISÃO\nNome — Vaga\n\nEXPERIÊNCIA DECLARADA\nAtendimento.\n\nRELAÇÃO COM OS CRITÉRIOS\nTrecho: “Varejo”\n\nPARECER DA RECRUTADORA\nMinha avaliação.\nRequer revisão humana.';
 assert.deepEqual(reportSections(text),[{title:'EXPERIÊNCIA DECLARADA',content:'Atendimento.'},{title:'RELAÇÃO COM OS CRITÉRIOS',content:'Trecho: “Varejo”'},{title:'PARECER DA RECRUTADORA',content:'Minha avaliação.\nRequer revisão humana.'}]);
});
test('custom text, unknown headings and HTML-like text remain literal content',()=>{
 assert.deepEqual(reportSections('Minha avaliação\n<script>alert(1)</script>'),[{title:'Parecer',content:'Minha avaliação\n<script>alert(1)</script>'}]);
 assert.deepEqual(reportSections('Introdução\r\nPARECER DA RECRUTADORA\r\nConclusão'),[{title:'Parecer',content:'Introdução'},{title:'PARECER DA RECRUTADORA',content:'Conclusão'}]);
 assert.deepEqual(reportSections(''),[]);
});
