import {test as base,expect} from '@playwright/test';
import {createHash,randomUUID} from 'node:crypto';
import {starterJob,emptyRecord,draftCriteria,termAnalysis,type Data} from '../../lib/domain';
import {jobSchema,recordSchema,candidateEditSchema} from '../../lib/validation';
import {updateCandidateData} from '../../lib/candidate-update';
import {saveTriage,triageSource} from '../../lib/candidate-triage';
import {preserveJourney,changeJobLifecycle,saveEvaluation,recordClientAction,evaluationSource} from '../../lib/recruitment-journey';
import {reconcileReportReviews,reportSources} from '../../lib/report-review';
import {blankConditions} from '../../lib/candidate-refresh';
import {filterCandidates,emptyFilters} from '../../lib/candidate-search';
import {buildSearchIndex,findSearchMatches,searchOrder,validateSearchPlan} from '../../lib/assisted-search';
import {planErasure,confirmsName} from '../../lib/candidate-erasure';
import type {ApplicationLink,CandidateApplication,DiscardedApplication} from '../../lib/candidate-applications';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const candidateId='00000000-0000-4000-8000-000000000001';
export function fictionalData():Data{return {version:1,aiConfigured:true,clients:[],records:[],candidates:[{id:candidateId,name:'Pessoa Fictícia Alfa',role:'Atendimento',city:'São Paulo',phone:'',email:'',source:'Cadastro manual',updated:'2026-10-15',demo:false,text:'PERFIL FICTÍCIO. Atendimento ao público e demonstração de produtos em loja de exemplo.'}],jobs:[{...starterJob,id:'teste-vaga',title:'Vaga Fictícia Alfa',description:'Experiência com atendimento ao público.',criteria:[{id:'criterio-atendimento',text:'Experiência com atendimento ao público',kind:'experiencia',priority:'obrigatorio'}],analyses:[],stage:1}]};}
type Sandbox={data:Data;failNextSave:boolean;unavailablePagedSearch:boolean;unexpected:string[];candidateSaveGate?:Promise<void>;applicationLinks:ApplicationLink[];applications:(CandidateApplication|DiscardedApplication)[];applicationActions:string[];publicSubmissions:{answer:unknown;fileName:string;fileSize:number;formToken:string;website:string}[]};
// Simulated server form token (the real one is an HMAC signed by the server, checked by lib/public-application-security).
export const applicationFormToken='1792075000000.'+'a'.repeat(64);
// Public application page (/candidatura.html in the gallery): only this token opens the fictitious vacancy.
export const applicationToken='f'.repeat(64);
export const test=base.extend<{sandbox:Sandbox}>({
 sandbox:[async({context},use)=>{
  const state:Sandbox={data:fictionalData(),failNextSave:false,unavailablePagedSearch:false,unexpected:[],applicationLinks:[],applications:[],applicationActions:[],publicSubmissions:[]};
  context.on('page',page=>page.on('pageerror',error=>state.unexpected.push(`Erro da interface: ${error.message}`)));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!=='http://127.0.0.1:4173'){state.unexpected.push(`${req.method()} ${url.origin}${url.pathname}`);await route.abort('blockedbyclient');return;}
   if(!url.pathname.startsWith('/api/')){await route.continue();return;}
   const reply=(body:unknown,status=200)=>route.fulfill({status,json:body});
   try{
    if(url.pathname==='/api/workspace'){
     if(req.method()==='GET'){
      if(url.searchParams.get('scope')==='overview'){
       const related=new Set([...state.data.records.map(record=>record.candidateId),...state.data.jobs.flatMap(job=>job.analyses.map(analysis=>analysis.candidateId))]);
       return await reply({...state.data,candidates:state.data.candidates.filter(candidate=>related.has(candidate.id)),candidateCount:state.data.candidates.length});
      }
      return await reply(state.data);
     }
     if(state.failNextSave){state.failNextSave=false;return await reply({error:'Falha fictícia de rede. Tente novamente.'},503)}
     const body=req.postDataJSON();if(body.version!==state.data.version)return await reply({error:'Este espaço mudou em outra sessão. Recarregue a página antes de salvar.'},409);
     const next=preserveJourney(state.data,{...state.data,jobs:body.jobs.map((j:unknown)=>jobSchema.parse(j)),records:body.records.map((r:unknown)=>recordSchema.parse(r))});
     const sources=reportSources(next);next.records=reconcileReportReviews(state.data,next,r=>{const s=sources(r);return s?hash(s):null},body.approveReport,new Date().toISOString());
     state.data={...next,version:state.data.version!+1};return await reply(state.data);
    }
    if(url.pathname==='/api/candidates/vacancy-search'&&req.method()==='GET'){
     if(state.unavailablePagedSearch)return await reply({error:'A busca paginada ainda não está disponível neste banco.'},501);
     const job=state.data.jobs.find(item=>item.id===url.searchParams.get('jobId'));
     if(!job)return await reply({error:'Vaga não encontrada.'},404);
     const filters={...emptyFilters,query:url.searchParams.get('query')||'',city:url.searchParams.get('city')||'',experience:url.searchParams.get('experience')||'',pending:url.searchParams.get('pending')||'all',criterionId:url.searchParams.get('criterionId')||'all',onlyEvidence:url.searchParams.get('onlyEvidence')==='true',sort:url.searchParams.get('sort')||'name'};
     const matched=filterCandidates(state.data.candidates,job,state.data.records,filters),page=Number(url.searchParams.get('page')||1);
     return await reply({total:matched.length,candidateIds:matched.length<=100?matched.map(candidate=>candidate.id):[],candidates:matched.slice((page-1)*24,page*24),page,pageSize:24});
    }
    if(url.pathname==='/api/candidates/assisted-vacancy-search'&&req.method()==='POST'){
     const body=req.postDataJSON(),job=state.data.jobs.find(item=>item.id===body.jobId);
     if(!job)return await reply({error:'Vaga não encontrada.'},404);
     const plan=validateSearchPlan(body.plan),index=buildSearchIndex(state.data.candidates),matches=findSearchMatches(index,plan,body.mode);
     const filtered=filterCandidates(state.data.candidates,job,state.data.records,{...emptyFilters,query:body.query||'',city:body.city||'',experience:body.experience||'',pending:body.pending||'all',criterionId:body.criterionId||'all',onlyEvidence:Boolean(body.onlyEvidence),sort:body.sort||'name'}).filter(candidate=>matches.has(candidate.id)).sort((a,b)=>searchOrder(matches.get(a.id),matches.get(b.id))||a.name.localeCompare(b.name,'pt-BR'));
     const page=Number(body.page||1),selected=body.selection?filtered.slice(0,100):filtered.slice((page-1)*24,page*24);
     return await reply({total:filtered.length,candidateIds:filtered.length<=100?filtered.map(candidate=>candidate.id):[],candidates:selected,page,pageSize:24,matches:selected.map(candidate=>matches.get(candidate.id))});
    }
    if(url.pathname==='/api/candidates'&&req.method()==='POST'){
     const body=req.postDataJSON();if(!body.candidate?.name?.trim())return await reply({error:'Informe o nome.'},400);
     state.data={...state.data,candidates:[...state.data.candidates,{...body.candidate,id:randomUUID(),updated:new Date().toISOString()}],version:state.data.version!+1};return await reply(state.data);
    }
    // Erasure: simulated workspace change only (storage, imports and provider deletion are covered by SQL tests).
    if(url.pathname==='/api/candidates/erase'&&req.method()==='POST'){
     const b=req.postDataJSON();if(b.version!==state.data.version)return await reply({error:'Seu espaço mudou. Recarregue antes de excluir.'},409);
     const target=state.data.candidates.find(c=>c.id===b.candidateId);if(!target||!confirmsName(target,b.confirmName))return await reply({error:'Digite o nome completo do candidato para confirmar a exclusão.'},400);
     const plan=planErasure(state.data,b.candidateId),gone=new Set(plan.ids),rewritten=new Map(plan.rewritten.map(r=>[r.id,r.payload]));
     const keep=(list:Data['candidates'])=>list.filter(c=>!gone.has(c.id)).map(c=>rewritten.get(c.id)||c);
     state.data={...state.data,candidates:keep(state.data.candidates),archivedCandidates:keep(state.data.archivedCandidates||[]),jobs:plan.jobs,records:plan.records,version:state.data.version!+1};
     return await reply({data:state.data,warnings:[]});
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
     if(body.action==='analyze'){const job=state.data.jobs.find(j=>j.id===body.jobId);if(!job)return await reply({error:'Vaga não encontrada.'},404);const analyses=termAnalysis(state.data.candidates.filter(c=>body.candidateIds.includes(c.id)),job.criteria);state.data={...state.data,version:state.data.version!+1,jobs:state.data.jobs.map(item=>item.id!==job.id?item:{...item,analyses:[...item.analyses,...analyses],stage:2,engine:'Simulação determinística · sem IA'})};return await reply({analyses,engine:'Simulação determinística · sem IA',version:state.data.version});}
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
    if(url.pathname==='/api/public/applications'&&req.method()==='POST'){
     const unavailable={error:'Este link não está recebendo candidaturas. Ele pode ter expirado, sido cancelado ou atingido o limite de envios. Fale com a recrutadora.'};
     if(req.headers()['content-type']?.startsWith('application/json')){const b=req.postDataJSON();return await reply(b.token===applicationToken?{context:{title:'Vaga Fictícia Alfa',recruiter:'Recrutadora Fictícia',conditions:{...blankConditions,workMode:'Presencial',schedule:'Escala 6x1'}},expiresAt:'2026-10-29T12:00:00Z',formToken:applicationFormToken}:unavailable,b.token===applicationToken?200:410);}
     const body=req.postDataBuffer()?.toString('latin1')||'';const token=/name="token"\r\n\r\n([a-f0-9]{64})/.exec(body)?.[1];const answer=/name="answer"\r\n\r\n([\s\S]*?)\r\n--/.exec(body)?.[1];const file=/name="file"; filename="([^"]*)"\r\nContent-Type: [^\r]*\r\n\r\n([\s\S]*?)\r\n--/.exec(body);
     if(token!==applicationToken)return await reply(unavailable,410);
     const part=(name:string)=>new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)\\r\\n--`).exec(body)?.[1]||'';
     state.publicSubmissions.push({answer:answer?JSON.parse(Buffer.from(answer,'latin1').toString('utf8')):null,fileName:file?.[1]||'',fileSize:file?.[2].length||0,formToken:part('formToken'),website:part('website')});return await reply({received:true});
    }
    // Application links: simulated queue only. Accepting records the action; the real import is not simulated.
    if(url.pathname==='/api/applications'&&req.method()==='GET')return await reply({links:state.applicationLinks,applications:state.applications.filter(a=>!a.reviewed_at),serverTime:new Date().toISOString()});
    if(url.pathname==='/api/applications'&&req.method()==='POST'){
     const b=req.postDataJSON(),at=new Date().toISOString();state.applicationActions.push(b.action);
     if(b.action==='issue'){const job=state.data.jobs.find(j=>j.id===b.jobId);if(!job)return await reply({error:'Escolha uma vaga da sua base.'},400);const id=randomUUID();state.applicationLinks.unshift({id,job_id:job.id,context:{title:job.title,recruiter:b.recruiter,conditions:{...blankConditions,...job.conditions}},created_at:at,expires_at:new Date(Date.now()+b.days*86400000).toISOString(),revoked_at:null,max_submissions:b.maxSubmissions,submission_count:0});return await reply({id,token:'f'.repeat(64),expiresAt:state.applicationLinks[0].expires_at});}
     if(b.action==='revoke'){const link=state.applicationLinks.find(l=>l.id===b.linkId&&!l.revoked_at);if(!link)return await reply({error:'Este link já foi cancelado.'},409);link.revoked_at=at;return await reply({ok:true});}
     const app=state.applications.find(a=>a.id===b.applicationId&&!a.reviewed_at);if(!app)return await reply({error:'Esta candidatura já foi revisada.'},409);
     state.applications=state.applications.map(a=>a.id!==app.id?a:b.action==='accept'?{...app,reviewed_at:at,decision:'accepted'} as CandidateApplication:{...app,reviewed_at:at,decision:'discarded',response:null,file_name:null,file_sha256:null,file_size:null,import_id:null});return await reply(b.action==='accept'?{ok:true,warning:'',imports:[]}:{ok:true});
    }
    state.unexpected.push(`${req.method()} ${url.pathname}`);return await reply({error:'Operação não prevista no ambiente de testes.'},501);
   }catch(e){return await reply({error:(e as Error).message},400)}
  });
  await use(state);
  expect(state.unexpected,'Nenhuma chamada externa ou operação não simulada deve ocorrer.').toEqual([]);
 },{auto:true}],
});
export {expect};
