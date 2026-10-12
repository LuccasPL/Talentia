import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewSession,nextUnansweredQuestion} from '../lib/interview-session.ts';
const job={criteria:[{id:'c',text:'Atendimento',kind:'experiencia'}]};
const item=(id,answer='',extra={})=>({id,criterionId:'c',criterionText:'Atendimento',kind:'experiencia',question:'Pergunta',answer,observation:'',...extra});
test('focused interview separates historical criteria and only counts answers on current questions',()=>{
 const guide={items:[item('a','Resposta'),item('b','',{criterionText:'Atendimento anterior'}),item('g','',{kind:'geral',criterionId:'interest'}),item('d','   ',{observation:'Uma nota não é resposta'})]},before=structuredClone(guide);
 const session=interviewSession(guide,job);assert.deepEqual(session.current.map(i=>i.id),['a','g','d']);assert.deepEqual(session.previous.map(i=>i.id),['b']);assert.equal(session.answered,1);assert.deepEqual(guide,before);
});
test('next unanswered searches forward then wraps without choosing the active question',()=>{
 const items=[item('a'),item('b','Respondida'),item('c')];assert.equal(nextUnansweredQuestion(items,'a'),'c');assert.equal(nextUnansweredQuestion(items,'c'),'a');assert.equal(nextUnansweredQuestion(items,'missing'),'a');
});
test('no fabricated question or completion for empty or fully answered guides',()=>{
 assert.equal(nextUnansweredQuestion([],'a'),undefined);assert.equal(nextUnansweredQuestion([item('a')],'a'),undefined);assert.equal(nextUnansweredQuestion([item('a','Sim'),item('b','Sim')],'a'),undefined);assert.deepEqual(interviewSession(undefined,job),{current:[],previous:[],answered:0});
});
test('criterion kind changes remove it from the current session; generic conversation stays',()=>{
 const session=interviewSession({items:[item('a'),item('g','',{kind:'geral'})]},{criteria:[{id:'c',text:'Atendimento',kind:'entrevista'}]});assert.deepEqual(session.current.map(i=>i.id),['g']);assert.deepEqual(session.previous.map(i=>i.id),['a']);
});
