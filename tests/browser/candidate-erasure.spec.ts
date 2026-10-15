import {test,expect,candidateId} from './fixture';
import type {Page} from '@playwright/test';

// Simulated APIs: covers the confirmation flow and the workspace result. Database, storage and provider
// deletion are covered by supabase/tests/candidate-erasure.sql.
async function openData(page:Page){
 await page.goto('/');await expect(page.getByRole('heading',{name:'Acompanhamento',exact:true})).toBeVisible();
 if(page.viewportSize()!.width<768)await page.getByRole('button',{name:'Talentos',exact:true}).click();else await page.getByRole('button',{name:/^Banco de talentos \d/}).click();
 await page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true}).click();
 if(page.viewportSize()!.width<768)await page.getByLabel('Seção do perfil',{exact:true}).selectOption({label:'Dados'});else await page.getByRole('tab',{name:'Dados',exact:true}).click();
}

test('erasure: requires the full name, removes the person and every record, and closes the profile',async({page,sandbox})=>{
 sandbox.data.records=[{candidateId,jobId:sandbox.data.jobs[0].id,status:'Contato realizado',interest:'Interessado',availability:'Imediata',notes:'Nota fictícia.',report:'',events:[]}];
 await openData(page);
 await page.getByText('Excluir dados desta pessoa',{exact:true}).click();
 const button=page.getByRole('button',{name:'Excluir definitivamente',exact:true});
 await expect(button).toBeDisabled();
 const confirm=page.getByLabel(/Para confirmar, digite o nome completo/);
 await confirm.fill('Pessoa Fictícia');
 await expect(button).toBeDisabled();
 await confirm.fill('pessoa ficticia alfa');
 await expect(button).toBeEnabled();
 await button.click();
 await expect(page.getByText('Dados da pessoa excluídos definitivamente.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true})).toHaveCount(0);
 expect(sandbox.data.candidates.some(c=>c.id===candidateId)).toBe(false);
 expect(sandbox.data.records.some(r=>r.candidateId===candidateId)).toBe(false);
 expect(sandbox.unexpected).toEqual([]);
});

test('erasure: stays collapsed and changes nothing until confirmed',async({page,sandbox})=>{
 const before=JSON.stringify(sandbox.data);
 await openData(page);
 await expect(page.getByRole('button',{name:'Excluir definitivamente',exact:true})).toBeHidden();
 await page.getByText('Excluir dados desta pessoa',{exact:true}).click();
 await expect(page.getByText('Não é possível desfazer.',{exact:false})).toBeVisible();
 expect(JSON.stringify(sandbox.data)).toBe(before);
});
