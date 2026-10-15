import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationAnswerSchema,applicationDuplicates,declaredCandidate,linkState,safeFileName} from '../lib/candidate-applications.ts';

const answer={name:'Pessoa Fictícia Beta',email:'beta@example.test',phone:'(11) 98888-7777',city:'Campinas, SP',role:'Atendimento',message:'',consent:true};
const candidate=(extra={})=>({id:'c1',name:'Outra Pessoa',role:'Vendas',city:'São Paulo',source:'PDF',text:'Experiência fictícia.',phone:'',email:'',updated:'2026-10-15',demo:false,...extra});
const application=(extra={})=>({id:'a1',link_id:'l1',job_id:'j1',job_title:'Vaga Fictícia',response:answer,file_name:'cv.pdf',file_sha256:'a'.repeat(64),file_size:1000,created_at:'2026-10-15T12:00:00Z',reviewed_at:null,decision:null,import_id:null,...extra});

test('answer schema requires consent, a contact and rejects unknown fields',()=>{
 assert.equal(applicationAnswerSchema.safeParse(answer).success,true);
 assert.equal(applicationAnswerSchema.safeParse({...answer,consent:false}).success,false);
 assert.equal(applicationAnswerSchema.safeParse({...answer,email:'',phone:''}).success,false);
 assert.equal(applicationAnswerSchema.safeParse({...answer,phone:'123'}).success,false);
 assert.equal(applicationAnswerSchema.safeParse({...answer,cpf:'000'}).success,false);
 assert.equal(applicationAnswerSchema.safeParse({...answer,name:'A'}).success,false);
});

test('link state distinguishes revoked, expired and full links',()=>{
 const link={id:'l',job_id:'j',context:{title:'T',recruiter:'R',conditions:{}},created_at:'2026-10-01T00:00:00Z',expires_at:'2026-10-20T00:00:00Z',revoked_at:null,max_submissions:10,submission_count:3};
 const now=Date.parse('2026-10-15T00:00:00Z');
 assert.equal(linkState(link,now),'ativo');
 assert.equal(linkState({...link,revoked_at:'2026-10-02T00:00:00Z'},now),'cancelado');
 assert.equal(linkState(link,Date.parse('2026-10-20T00:00:00Z')),'expirado');
 assert.equal(linkState({...link,submission_count:10},now),'completo');
});

test('duplicate hints match PDF, e-mail, phone suffix and name only as fallback, never demo profiles',()=>{
 const pool=[candidate({id:'pdf',fileKey:`owner/${'a'.repeat(64)}.pdf`}),candidate({id:'mail',email:'BETA@example.test '}),candidate({id:'phone',phone:'+55 11 98888-7777'}),candidate({id:'name',name:'pessoa ficticia beta'}),candidate({id:'demo',email:'beta@example.test',demo:true}),candidate({id:'other'})];
 const found=Object.fromEntries(applicationDuplicates(application(),pool).map(m=>[m.candidate.id,m.reasons]));
 assert.deepEqual(found,{pdf:['mesmo PDF'],mail:['mesmo e-mail'],phone:['mesmo telefone'],name:['mesmo nome']});
});

test('declared contacts override the PDF transcription without claiming verification',()=>{
 const imported=candidate({name:'NOME NO PDF',phone:'(11) 1111-1111',email:'pdf@example.test',city:'Cidade do PDF',role:'',verification:undefined});
 const result=declaredCandidate(imported,application(),'2026-10-16T10:00:00Z');
 assert.equal(result.name,'Pessoa Fictícia Beta');assert.equal(result.phone,answer.phone);assert.equal(result.email,answer.email);assert.equal(result.city,answer.city);assert.equal(result.role,'Atendimento');
 assert.equal(result.text,imported.text);assert.equal(result.source,'Candidatura por link · Vaga Fictícia');
 assert.equal(result.verification,undefined);
 assert.deepEqual(result.changeLog.at(-1).confirmed,[]);
 assert.deepEqual(result.changeLog.at(-1).fields.sort(),['city','email','name','phone','role']);
});

test('empty declared contacts keep the transcribed ones and the PDF role wins when present',()=>{
 const result=declaredCandidate(candidate({phone:'(11) 1111-1111',role:'Vendas'}),application({response:{...answer,phone:''}}),'2026-10-16T10:00:00Z');
 assert.equal(result.phone,'(11) 1111-1111');assert.equal(result.role,'Vendas');
});

test('file names from the device become short printable labels',()=>{
 assert.equal(safeFileName('../../etc/<script>cv\n.pdf'),'.. .. etc script cv .pdf');
 assert.equal(safeFileName('   '),'curriculo.pdf');
 assert.ok(safeFileName('a'.repeat(500)+'.pdf').length<=120);
});
