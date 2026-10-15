import {test as base,expect} from '@playwright/test';
import {createHash,randomUUID} from 'node:crypto';
import {starterJob,emptyRecord,draftCriteria,termAnalysis,type Data} from '../../lib/domain';
import {jobSchema,recordSchema} from '../../lib/validation';
import {saveTriage,triageSource} from '../../lib/candidate-triage';
import {preserveJourney,changeJobLifecycle,saveEvaluation,recordClientAction,evaluationSource} from '../../lib/recruitment-journey';
import {reconcileReportReviews,reportSources} from '../../lib/report-review';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const candidateId='00000000-0000-4000-8000-000000000001';
export function fictionalData():Data{return {version:1,aiConfigured:true,clients:[],records:[],candidates:[{id:candidateId,name:'Pessoa Fictícia Alfa',role:'Atendimento',city:'São Paulo',phone:'',email:'',source:'Cadastro manual',updated:'2026-10-15',demo:false,text:'PERFIL FICTÍCIO. Atendimento ao público e demonstração de produtos em loja de exemplo.'}],jobs:[{...starterJob,id:'teste-vaga',title:'Vaga Fictícia Alfa',description:'Experiência com atendimento ao público.',criteria:[{id:'criterio-atendimento',text:'Experiência com atendimento ao público',kind:'experiencia',priority:'obrigatorio'}],analyses:[],stage:1}]};}
type Sandbox={data:Data;failNextSave:boolean;unexpected:string[]};
export const test=base.extend<{sandbox:Sandbox}>({
 sandbox:[async({context},use)=>{
  const state:Sandbox={data:fictionalData(),failNextSave:false,unexpected:[]};
  context.on('page',page=>page.on('pageerror',error=>state.unexpected.push(`Erro da interface: ${error.message}`)));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!=='http://127.0.0.1:4173'){state.unexpected.push(`${req.method()} ${url.origin}${url.pathname}`);await route.abort('blockedbyclient');return;}
   if(!url.pathname.startsWith('/api/')){await route.continue();return;}
   const reply=(body:unknown,status=200)=>route.fulfill({status,json:body});
   try{
    if(url.pathname==='/api/workspace'){
     if(req.method()==='GET')return await reply(state.data);
     if(state.failNextSave){state.failNextSave=false;return await reply({error:'Falha fictícia de rede. Tente novamente.'},503)}
     const body=req.postDataJSON();if(body.version!==state.data.version)return await reply({error:'Este espaço mudou em outra sessão. Recarregue a página antes de salvar.'},409);
     const next=preserveJourney(state.data,{...state.data,jobs:body.jobs.map((j:unknown)=>jobSchema.parse(j)),records:body.records.map((r:unknown)=>recordSchema.parse(r))});
     const sources=reportSources(next);next.records=reconcileReportReviews(state.data,next,r=>{const s=sources(r);return s?hash(s):null},body.approveReport,new Date().toISOString());
     state.data={...next,version:state.data.version!+1};return await reply(state.data);
    }
    if(url.pathname==='/api/candidates'&&req.method()==='POST'){
     const body=req.postDataJSON();if(!body.candidate?.name?.trim())return await reply({error:'Informe o nome.'},400);
     state.data={...state.data,candidates:[...state.data.candidates,{...body.candidate,id:randomUUID(),updated:new Date().toISOString()}],version:state.data.version!+1};return await reply(state.data);
    }
    if(url.pathname==='/api/ai'){
     const body=req.postDataJSON();if(body.action==='criteria')return await reply({criteria:draftCriteria(body.description),engine:'Simulação determinística · sem IA'});
     if(body.action==='analyze')return await reply({analyses:termAnalysis(state.data.candidates.filter(c=>body.candidateIds.includes(c.id)),body.criteria),engine:'Simulação determinística · sem IA'});
    }
    if(url.pathname==='/api/journey'){
     const b=req.postDataJSON(),at=new Date().toISOString();if(b.version!==state.data.version)return await reply({error:'Versão desatualizada.'},409);
     const job=state.data.jobs.find(j=>j.id===b.jobId)!,candidate=state.data.candidates.find(c=>c.id===b.candidateId)!,record=state.data.records.find(r=>r.jobId===b.jobId&&r.candidateId===b.candidateId)||emptyRecord(b.candidateId,b.jobId);
     if(b.action==='triage')state.data=saveTriage(state.data,b.jobId,b.candidateId,b.triage,hash(triageSource(candidate,job)),at);
     else if(b.action==='job')state.data=changeJobLifecycle(state.data,b.jobId,b.state,b.note,at);
     else if(b.action==='evaluation')state.data=saveEvaluation(state.data,b.jobId,b.candidateId,b.evaluation,hash(evaluationSource(candidate,job,record)),at);
     else if(b.action==='client')state.data=recordClientAction(state.data,b.jobId,b.candidateId,b.entry,at,randomUUID());
     else throw Error('Ação não simulada.');
     state.data.version=state.data.version!+1;return await reply(state.data);
    }
    if(url.pathname==='/api/imports'&&['GET','PATCH'].includes(req.method()))return await reply({imports:[],candidates:[]});
    if(url.pathname==='/api/candidate-refresh'&&req.method()==='GET')return await reply({links:[]});
    state.unexpected.push(`${req.method()} ${url.pathname}`);return await reply({error:'Operação não prevista no ambiente de testes.'},501);
   }catch(e){return await reply({error:(e as Error).message},400)}
  });
  await use(state);
  expect(state.unexpected,'Nenhuma chamada externa ou operação não simulada deve ocorrer.').toEqual([]);
 },{auto:true}],
});
export {expect};
