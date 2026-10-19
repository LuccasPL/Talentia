import {test,expect,candidateId} from './fixture';
import type {Page} from '@playwright/test';

// Regression coverage for the views extracted from app/workspace.tsx (ContactBoard, CandidateFiltersPanel, CandidateList).
async function start(page:Page){await page.goto('/');await expect(page.getByRole('heading',{name:'Acompanhamento',exact:true})).toBeVisible();}
async function open(page:Page,name:string){const mobile=page.getByRole('button',{name:'Abrir menu completo',exact:true});if(await mobile.isVisible())await mobile.click();await page.getByRole('button',{name,exact:false}).first().click();await expect(page.locator('.breadcrumb strong')).toHaveText(name);}
async function talents(page:Page){if(page.viewportSize()!.width<768)await page.getByRole('button',{name:'Talentos',exact:true}).click();else await page.getByRole('button',{name:/^Banco de talentos \d/}).click();}

test('workspace opens with related profiles and paginates vacancy browsing',async({page,sandbox})=>{
 const scopes:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/workspace'&&request.method()==='GET')scopes.push(url.searchParams.get('scope')||'full')});
 const searches:string[]=[];
 page.on('request',request=>{if(new URL(request.url()).pathname==='/api/candidates/vacancy-search')searches.push(request.url())});
 await start(page);
 expect(scopes).toEqual(['overview']);
 await talents(page);
 await expect(page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true})).toBeVisible();
 expect(scopes).toEqual(['overview']);
 expect(searches).toHaveLength(1);
 expect(sandbox.unexpected).toEqual([]);
});

test('job directory uses related workspace data without loading the whole candidate base',async({page,sandbox})=>{
 sandbox.data.records.push({candidateId,jobId:'teste-vaga',status:'Não contatado',interest:'Não confirmado',availability:'Não confirmada',notes:'',report:'',events:[]});
 const scopes:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/workspace'&&request.method()==='GET')scopes.push(url.searchParams.get('scope')||'full')});
 await start(page);await open(page,'Vagas');
 await expect(page.getByRole('heading',{name:'Vaga Fictícia Alfa',exact:true})).toBeVisible();
 await expect(page.getByText('1 de 1 vaga',{exact:true})).toBeVisible();
 expect(scopes).toEqual(['overview']);
 expect(sandbox.unexpected).toEqual([]);
});

for(const view of ['Painel da vaga','Funil de candidatos','Lista de interesse','Agenda','Pareceres','Clientes'])test(`${view}: usa perfis relacionados sem carregar a base completa`,async({page,sandbox})=>{
 const clientId='00000000-0000-4000-8000-000000000099';
 sandbox.data.jobs[0].clientId=clientId;
 sandbox.data.clients=[{id:clientId,name:'Cliente Fictício',contact:'Contato Fictício',email:'',phone:'',notes:'',archived:false,updated:'2026-10-15T12:00:00.000Z'}];
 sandbox.data.records.push({candidateId,jobId:sandbox.data.jobs[0].id,status:'Não contatado',interest:'Não confirmado',availability:'Não confirmada',notes:'',report:'Parecer fictício para teste.',shortlisted:true,appointments:[{id:'entrevista-ficticia',startsAt:new Date(Date.now()+60*60*1000).toISOString(),duration:45,format:'online',location:'',notes:'',status:'a-confirmar',updated:new Date().toISOString()}],events:[]});
 const scopes:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/workspace'&&request.method()==='GET')scopes.push(url.searchParams.get('scope')||'full')});
 await start(page);await open(page,view);
 if(view==='Clientes'){
  await page.getByRole('button',{name:'Ver cliente e vagas',exact:true}).click();
  await expect(page.getByText('Vagas vinculadas',{exact:true})).toBeVisible();
 }else if(view==='Agenda')await expect(page.getByRole('button',{name:/Pessoa Fictícia Alfa/}).first()).toBeVisible();
 else await expect(page.getByText('Pessoa Fictícia Alfa',{exact:true}).first()).toBeVisible();
 expect(scopes).toEqual(['overview']);
 expect(sandbox.unexpected).toEqual([]);
});

test('vacancy filters and pages use server results without loading the whole base',async({page,sandbox})=>{
 const sample=sandbox.data.candidates[0];
 sandbox.data.candidates.push(...Array.from({length:4999},(_,index)=>({...sample,id:`00000000-0000-4000-8000-${String(index+2).padStart(12,'0')}`,name:`Pessoa Fictícia ${String(index+2).padStart(4,'0')}`})));
 const scopes:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/workspace'&&request.method()==='GET')scopes.push(url.searchParams.get('scope')||'full')});
 await start(page);await talents(page);
 await expect(page.getByText('1–24 de 5000 perfis')).toBeVisible();
 await page.getByRole('button',{name:'Próxima',exact:true}).click();
 await expect(page.getByText('25–48 de 5000 perfis')).toBeVisible();
 await page.getByLabel('Buscar candidatos',{exact:true}).fill('Pessoa Fictícia 4999');
 await expect(page.getByText('1–1 de 1 perfil')).toBeVisible();
 expect(scopes).toEqual(['overview']);
 expect(sandbox.unexpected).toEqual([]);
});

test('assisted vacancy search stays paginated and shows matching curriculum excerpts',async({page})=>{
 const scopes:string[]=[],assistedCalls:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/workspace'&&request.method()==='GET')scopes.push(url.searchParams.get('scope')||'full');if(url.pathname==='/api/candidates/assisted-vacancy-search')assistedCalls.push(request.method())});
 await start(page);await talents(page);
 await page.getByText('Busca assistida por experiências relacionadas',{exact:true}).click();
 await page.getByRole('button',{name:'Montar busca manualmente',exact:true}).click();
 await page.getByLabel('Termos relacionados — um por linha, até 8',{exact:true}).fill('demonstração de produtos');
 await page.getByRole('button',{name:'Aplicar termos revisados',exact:true}).click();
 await expect(page.getByText('1–1 de 1 perfil',{exact:true})).toBeVisible();
 await page.getByText('1 experiência com termos encontrados',{exact:true}).click();
 await expect(page.locator('.search-match-details blockquote')).toContainText('demonstração de produtos em loja de exemplo');
 expect(assistedCalls).toEqual(['POST']);
 expect(scopes).toEqual(['overview']);
});

test('talent pool remains usable before the paging migration is applied',async({page,sandbox})=>{
 sandbox.unavailablePagedSearch=true;
 const scopes:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/workspace'&&request.method()==='GET')scopes.push(url.searchParams.get('scope')||'full')});
 await start(page);await talents(page);
 await expect(page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true})).toBeVisible();
 expect(scopes).toEqual(['overview','full']);
 expect(sandbox.unexpected).toEqual([]);
});

test('import dialog from the overview waits for the complete base',async({page,sandbox})=>{
 const scopes:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/workspace'&&request.method()==='GET')scopes.push(url.searchParams.get('scope')||'full')});
 await start(page);
 await page.getByRole('button',{name:'Importar currículos',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Adicione à sua base de talentos'})).toBeVisible();
 expect(scopes).toEqual(['overview','full']);
 expect(sandbox.unexpected).toEqual([]);
});

test('contacts: search, clear and register an approach without sending messages',async({page,sandbox})=>{
 await start(page);await open(page,'Contatos');
 const search=page.getByLabel('Buscar contatos',{exact:true});
 await search.fill('Nome inexistente');
 await expect(page.getByRole('heading',{name:'Nenhum contato nesta busca.',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Limpar busca',exact:true}).click();
 await expect(search).toHaveValue('');
 const person=page.locator('article.contact-person').filter({has:page.getByRole('heading',{name:'Pessoa Fictícia Alfa',exact:true})});
 await expect(person).toBeVisible();
 await person.getByRole('button',{name:'Registrar abordagem',exact:true}).click();
 await expect(person.getByRole('button',{name:'Registrar abordagem',exact:true})).toHaveCount(0);
 expect(sandbox.data.records.find(r=>r.candidateId===candidateId)?.status).toBe('Contato realizado');
 expect(sandbox.unexpected).toEqual([]);
});

test('talent pool: empty search recovers, batch selection counts and shortlist saves',async({page,sandbox})=>{
 await start(page);await talents(page);
 await page.getByLabel('Buscar candidatos',{exact:true}).fill('termo-que-nao-existe');
 await expect(page.getByRole('heading',{name:'Nenhum perfil nesta busca.',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ver todos os perfis',exact:true}).click();
 await expect(page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Selecionar em lote ou comparar',exact:true}).click();
 await page.getByLabel('Selecionar Pessoa Fictícia Alfa para ações em lote',{exact:true}).check();
 await expect(page.getByText('1 selecionado',{exact:true})).toBeVisible();
 const star=page.getByRole('button',{name:'Adicionar Pessoa Fictícia Alfa à lista de interesse',exact:true});
 await star.click();
 await expect(page.getByRole('button',{name:'Remover Pessoa Fictícia Alfa da lista de interesse',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(sandbox.data.records.find(r=>r.candidateId===candidateId)?.shortlisted).toBe(true);
 expect(sandbox.unexpected).toEqual([]);
});
