import {test,expect} from './fixture';
import type {Page} from '@playwright/test';
import type {CandidateApplication} from '../../lib/candidate-applications';

// Simulated APIs only: covers the recruiter screen, not Supabase RPCs, the public page or the real PDF import.
async function open(page:Page){await page.goto('/');await expect(page.getByRole('heading',{name:'Acompanhamento',exact:true})).toBeVisible();const mobile=page.getByRole('button',{name:'Abrir menu completo',exact:true});if(await mobile.isVisible())await mobile.click();await page.getByRole('button',{name:'Candidaturas por link',exact:true}).click();await expect(page.getByRole('heading',{name:'Receber currículos por link',exact:true})).toBeVisible();}
function application(id:string,name:string,extra:Partial<CandidateApplication['response']>={}):CandidateApplication{return {id,link_id:'link',job_id:'teste-vaga',job_title:'Vaga Fictícia Alfa',response:{name,email:'',phone:'(11) 90000-0000',city:'São Paulo',role:'',message:'Mensagem fictícia.',consent:true,...extra},file_name:'curriculo-ficticio.pdf',file_sha256:'b'.repeat(64),file_size:20480,created_at:'2026-10-15T12:00:00Z',reviewed_at:null,decision:null,import_id:null};}

test('applications: create a link, copy-ready message and cancel it',async({page,sandbox})=>{
 await open(page);
 await page.getByLabel('Seu nome, como os candidatos vão ver',{exact:true}).fill('Recrutadora Fictícia');
 await page.getByRole('button',{name:'Criar link para Vaga Fictícia Alfa',exact:true}).click();
 await expect(page.getByLabel('Mensagem para revisar e divulgar',{exact:true})).toHaveValue(new RegExp(`/candidatura#${'f'.repeat(64)}`));
 const link=page.locator('article.application-link').filter({hasText:'Vaga Fictícia Alfa'});
 await expect(link).toContainText('Recebendo candidaturas · 0 de 50 envios');
 page.once('dialog',dialog=>void dialog.accept());
 await link.getByRole('button',{name:'Cancelar link',exact:true}).click();
 await expect(link).toContainText('Cancelado');
 expect(sandbox.applicationActions).toEqual(['issue','revoke']);
 expect(sandbox.unexpected).toEqual([]);
});

test('applications: duplicates are flagged and nothing changes until the recruiter decides',async({page,sandbox})=>{
 sandbox.applications=[application('a1','Pessoa Fictícia Alfa'),application('a2','Pessoa Fictícia Gama',{email:'gama@example.test'})];
 const before=JSON.stringify(sandbox.data);
 await open(page);
 await expect(page.getByText('2 candidaturas aguardando sua revisão.',{exact:false})).toBeVisible();
 const alfa=page.locator('article.application-item').filter({hasText:'Pessoa Fictícia Alfa'}),gama=page.locator('article.application-item').filter({hasText:'Pessoa Fictícia Gama'});
 const desktop=page.viewportSize()!.width>=768;
 if(desktop)await expect(page.getByRole('button',{name:'Candidaturas por link 2',exact:true})).toBeVisible();
 await expect(alfa.getByRole('link',{name:'Abrir PDF enviado',exact:true})).toHaveAttribute('href','/api/applications/a1/file');
 await expect(alfa.getByText('Possível perfil já cadastrado:',{exact:true})).toBeVisible();
 await expect(alfa.getByRole('button',{name:'Pessoa Fictícia Alfa (mesmo nome)',exact:true})).toBeVisible();
 await expect(gama.getByText('Possível perfil já cadastrado:',{exact:true})).toHaveCount(0);
 const discardedData=JSON.stringify(sandbox.applications[0]);
 let discardMessage='';
 page.once('dialog',dialog=>{discardMessage=dialog.message();void dialog.dismiss()});
 await alfa.getByRole('button',{name:'Descartar',exact:true}).click();
 await expect(alfa).toBeVisible();expect(sandbox.applicationActions).toEqual([]);
 expect(discardMessage).toContain('Os dados informados e o PDF desta candidatura serão apagados da base ativa.');
 expect(discardMessage).toContain('Isso não exclui um perfil já cadastrado');
 expect(JSON.stringify(sandbox.applications[0])).toBe(discardedData);
 page.once('dialog',dialog=>void dialog.accept());
 await alfa.getByRole('button',{name:'Descartar',exact:true}).click();
 await expect(alfa).toHaveCount(0);
 if(desktop)await expect(page.getByRole('button',{name:'Candidaturas por link 1',exact:true})).toBeVisible();
 page.once('dialog',dialog=>void dialog.accept());
 await gama.getByRole('button',{name:'Aceitar e importar currículo',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Nenhuma candidatura pendente.',exact:true})).toBeVisible();
 expect(sandbox.applicationActions).toEqual(['discard','accept']);
 expect(sandbox.applications.map(a=>a.decision)).toEqual(['discarded','accepted']);
 expect(sandbox.applications[0]).toMatchObject({response:null,file_name:null,file_sha256:null,file_size:null,import_id:null});
 expect(sandbox.applications[1].response?.email).toBe('gama@example.test');
 expect(JSON.stringify(sandbox.data)).toBe(before);
 expect(sandbox.unexpected).toEqual([]);
});
