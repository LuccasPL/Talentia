import {test,expect} from '@playwright/test';
import type {Candidate} from '../../lib/domain';

const profiles:Candidate[]=Array.from({length:30},(_,index)=>({
  id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
  name:index===0?'Ána Fictícia':`Pessoa Fictícia ${String(index+1).padStart(2,'0')}`,
  role:'Atendimento',city:'São Paulo',phone:'',email:'',source:'Cadastro manual',
  text:'Experiência fictícia em hospitalidade e varejo.',updated:'2026-10-15T12:00:00Z',demo:false
}));

test('busca paginada consulta o servidor e abre apenas o perfil da página',async({page})=>{
  const calls:string[]=[];
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:4173')return route.abort('blockedbyclient');
    if(url.pathname.startsWith('/api/candidates/')&&url.pathname!=='/api/candidates/search'){
      const profile=profiles.find(item=>item.id===url.pathname.split('/').at(-1));
      return route.fulfill({status:profile?200:404,json:profile||{error:'Perfil não encontrado.'}});
    }
    if(url.pathname!=='/api/candidates/search')return route.continue();
    calls.push(url.search);
    const query=(url.searchParams.get('query')||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const filtered=query?profiles.filter(profile=>`${profile.name} ${profile.text}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(query)):profiles;
    const pageNumber=Number(url.searchParams.get('page')||1);
    return route.fulfill({json:{total:filtered.length,candidates:filtered.slice((pageNumber-1)*24,pageNumber*24).map(({id,name,role,city,updated,text})=>({id,name,role,city,updated,textPreview:text.slice(0,210)})),page:pageNumber,pageSize:24}});
  });
  await page.goto('/buscar.html');
  await expect(page.getByRole('status')).toContainText('30 perfis encontrados');
  await expect(page.locator('.quick-search-card')).toHaveCount(24);
  await page.getByRole('button',{name:'Próxima'}).click();
  await expect(page.getByRole('status')).toContainText('30 perfis encontrados');
  await expect(page.locator('.quick-search-card')).toHaveCount(6);
  await page.getByLabel('Nome ou palavras-chave').fill('ana ficticia');
  await expect(page.getByRole('status')).toContainText('1 perfil encontrado');
  await expect(page.locator('.quick-search-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Ver perfil'}).click();
  await expect(page.getByRole('heading',{name:'Ána Fictícia'})).toBeVisible();
  expect(calls.some(call=>call.includes('page=2'))).toBe(true);
  expect(calls.some(call=>call.includes('query=ana+ficticia')&&call.includes('page=1'))).toBe(true);
});
