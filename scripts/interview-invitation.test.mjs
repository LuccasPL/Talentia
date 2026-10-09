import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyInvitation,generateInvitation,validInterviewDate} from '../lib/interview-invitation.ts';
import {recordSchema} from '../lib/validation.ts';
const base={...emptyInvitation('Atendimento em loja conceito'),recruiter:'Recrutadora de Teste'};
test('invitation without schedule asks to arrange details instead of confirming an interview',()=>{
 const d=generateInvitation('Perfil Ficticio',base);
 assert.match(d.emailBody,/Olá, Perfil/);assert.match(d.subject,/Atendimento em loja conceito/);
 assert.match(d.message,/combinar o melhor dia/);
 assert.doesNotMatch(d.emailBody,/confirmada|agendada|aprovad|salário|500 lojas/i);
 assert.equal(base.emailBody,'');assert.equal(d.updated,'');
});
test('provided schedule uses Brazilian date and explicit Brasilia time',()=>{
 const d=generateInvitation('Perfil Ficticio',{...base,date:'2026-10-20',time:'14:30',format:'online',location:'Link de teste',company:'Empresa Fictícia',instructions:'Conversa de 30 minutos'});
 for(const content of [d.emailBody,d.message]){
 assert.match(content,/20\/10\/2026/);assert.match(content,/14:30 \(horário de Brasília\)/);
 assert.match(content,/Formato: on-line/);assert.match(content,/Link de teste/);
 assert.match(content,/outro dia ou horário/);assert.match(content,/Empresa Fictícia/);
 }
});
test('unknown employer, date and format are not invented',()=>{
 const d=generateInvitation('Teste',base);
 assert.doesNotMatch(d.emailBody,/Empresa:|Data sugerida:|Horário sugerido:|Formato:/);
 assert.match(d.message,/não receber novos contatos/);
});
test('generation requires identity and rejects impossible dates and times',()=>{
 assert.throws(()=>generateInvitation('Teste',emptyInvitation('Vaga')),/Informe/);
 for(const date of ['2026-02-30','2026-13-01','2026-10-20T00:00'])assert.throws(()=>generateInvitation('Teste',{...base,date}),/Confira/);
 assert.throws(()=>generateInvitation('Teste',{...base,time:'25:00'}),/Confira/);
 assert.equal(validInterviewDate('2028-02-29'),true);assert.equal(validInterviewDate('2026-02-29'),false);
});
test('old records remain valid and invitation edits survive workspace validation',()=>{
 const old={candidateId:'candidate',jobId:'job',status:'Entrevista',interest:'Não confirmado',availability:'Não confirmada',notes:'Notas',report:'Parecer',events:[]};
 assert.equal(recordSchema.parse(old).invitation,undefined);
 const invitation={...generateInvitation('Teste',base),message:'Texto editado manualmente',updated:'2026-10-09T15:00:00Z'};
 assert.deepEqual(recordSchema.parse({...old,invitation}).invitation,invitation);
 assert.equal(recordSchema.safeParse({...old,invitation:{...invitation,message:'x'.repeat(6001)}}).success,false);
});
