import {test as base,expect} from '@playwright/test';
import {createHash,randomUUID} from 'node:crypto';
import {starterJob,emptyRecord,draftCriteria,termAnalysis,type Data} from '../../lib/domain';
import {jobSchema,recordSchema,candidateEditSchema} from '../../lib/validation';
import {updateCandidateData} from '../../lib/candidate-update';
import {saveTriage,triageSource} from '../../lib/candidate-triage';
import {preserveJourney,changeJobLifecycle,saveEvaluation,recordClientAction,evaluationSource} from '../../lib/recruitment-journey';
import {reconcileReportReviews,reportSources} from '../../lib/report-review';
import {blankConditions} from '../../lib/candidate-refresh';
import type {ApplicationLink,CandidateApplication} from '../../lib/candidate-applications';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const candidateId='00000000-0000-4000-8000-000000000001';
export function fictionalData():Data{return {version:1,aiConfigured:true,clients:[],records:[],candidates:[{id:candidateId,name:'Pessoa Fictícia Alfa',role:'Atendimento',city:'São Paulo',phone:'',email:'',source:'Cadastro manual',updated:'2026-10-15',demo:false,text:'PERFIL FICTÍCIO. Atendimento ao público e demonstração de produtos em loja de exemplo.'}],jobs:[{...starterJob,id:'teste-vaga',title:'Vaga Fictícia Alfa',description:'Experiência com atendimento ao público.',criteria:[{id:'criterio-atendimento',text:'Experiência com atendimento ao público',kind:'experiencia',priority:'obrigatorio'}],analyses:[],stage:1}]};}
type Sandbox={data:Data;failNextSave:boolean;unexpected:string[];candidateSaveGate?:Promise<void>;applicationLinks:ApplicationLink[];applications:CandidateApplication[];applicationActions:string[]};
export const test=base.extend<{sandbox:Sandbox}>({
 sandbox:[async({context},use)=>{
  const state:Sandbox={data:fictionalData(),failNextSave:false,unexpected:[],applicationLinks:[],applications:[],applicationActions:[]};
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
    if(url.pathname==='/api/candidates'&&req.method()==='PATCH'){
     const input=candidateEditSchema.parse(req.postDataJSON());
     if(state.candidateSaveGate){const gate=state.candidateSaveGate;state.candidateSaveGate=undefined;await gate;}
     if(state.failNextSave){state.failNextSave=false;return await reply({error:'Falha fictícia de rede. Tente novamente.'},503)}
     if(input.version!==state.data.version)return await reply({error:'Este espaço mudou em outra sessão. Recarregue antes de editar.'},409);
     const next=updateCandidateData(state.data,input.candidateId,input.changes,input.confirmedFields,input.method,new Date().toISOString());
     state.data={...next,version:state.data.version!+1};return await reply(state.data);
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
    // Application links: simulated queue only. Accepting records the action; the real import is not simulated.
    if(url.pathname==='/api/applications'&&req.method()==='GET')return await reply({links:state.applicationLinks,applications:state.applications.filter(a=>!a.reviewed_at),serverTime:new Date().toISOString()});
    if(url.pathname==='/api/applications'&&req.method()==='POST'){
     const b=req.postDataJSON(),at=new Date().toISOString();state.applicationActions.push(b.action);
     if(b.action==='issue'){const job=state.data.jobs.find(j=>j.id===b.jobId);if(!job)return await reply({error:'Escolha uma vaga da sua base.'},400);const id=randomUUID();state.applicationLinks.unshift({id,job_id:job.id,context:{title:job.title,recruiter:b.recruiter,conditions:{...blankConditions,...job.conditions}},created_at:at,expires_at:new Date(Date.now()+b.days*86400000).toISOString(),revoked_at:null,max_submissions:b.maxSubmissions,submission_count:0});return await reply({id,token:'f'.repeat(64),expiresAt:state.applicationLinks[0].expires_at});}
     if(b.action==='revoke'){const link=state.applicationLinks.find(l=>l.id===b.linkId&&!l.revoked_at);if(!link)return await reply({error:'Este link já foi cancelado.'},409);link.revoked_at=at;return await reply({ok:true});}
     const app=state.applications.find(a=>a.id===b.applicationId&&!a.reviewed_at);if(!app)return await reply({error:'Esta candidatura já foi revisada.'},409);
     app.reviewed_at=at;app.decision=b.action==='accept'?'accepted':'discarded';return await reply(b.action==='accept'?{ok:true,warning:'',imports:[]}:{ok:true});
    }
    state.unexpected.push(`${req.method()} ${url.pathname}`);return await reply({error:'Operação não prevista no ambiente de testes.'},501);
   }catch(e){return await reply({error:(e as Error).message},400)}
  });
  await use(state);
  expect(state.unexpected,'Nenhuma chamada externa ou operação não simulada deve ocorrer.').toEqual([]);
 },{auto:true}],
});
export {expect};
