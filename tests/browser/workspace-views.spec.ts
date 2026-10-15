import {test,expect,candidateId} from './fixture';
import type {Page} from '@playwright/test';

// Regression coverage for the views extracted from app/workspace.tsx (ContactBoard, CandidateFiltersPanel, CandidateList).
async function start(page:Page){await page.goto('/');await expect(page.getByRole('heading',{name:'Acompanhamento',exact:true})).toBeVisible();}
async function open(page:Page,name:string){const mobile=page.getByRole('button',{name:'Abrir menu completo',exact:true});if(await mobile.isVisible())await mobile.click();await page.getByRole('button',{name,exact:true}).click();}
async function talents(page:Page){if(page.viewportSize()!.width<768)await page.getByRole('button',{name:'Talentos',exact:true}).click();else await page.getByRole('button',{name:/^Banco de talentos \d/}).click();}

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
 await page.getByLabel('Selecionar Pessoa Fictícia Alfa para ações em lote',{exact:true}).check();
 await expect(page.getByText('1 selecionado',{exact:true})).toBeVisible();
 const star=page.getByRole('button',{name:'Adicionar Pessoa Fictícia Alfa à lista de interesse',exact:true});
 await star.click();
 await expect(page.getByRole('button',{name:'Remover Pessoa Fictícia Alfa da lista de interesse',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(sandbox.data.records.find(r=>r.candidateId===candidateId)?.shortlisted).toBe(true);
 expect(sandbox.unexpected).toEqual([]);
});
