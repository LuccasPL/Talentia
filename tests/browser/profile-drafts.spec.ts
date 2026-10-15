import {test,expect} from './fixture';
import type {Page} from '@playwright/test';

async function openProfile(page:Page){
 await page.goto('/');await expect(page.getByRole('heading',{name:'Acompanhamento',exact:true})).toBeVisible();
 if(page.viewportSize()!.width<768)await page.getByRole('button',{name:'Talentos',exact:true}).click();
 else await page.getByRole('button',{name:/^Banco de talentos \d/}).click();
 await page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true}).click();
}
async function section(page:Page,name:string){
 if(page.viewportSize()!.width<768)await page.getByLabel('Seção do perfil',{exact:true}).selectOption({label:name});
 else await page.getByRole('tab',{name,exact:true}).click();
}

test('data draft: canceling close preserves an edited city',async({page})=>{
 await openProfile(page);await section(page,'Dados');
 await page.getByLabel('Cidade informada',{exact:true}).fill('Cidade fictícia ainda não salva');
 const dialogs:string[]=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await expect(page.getByLabel('Cidade informada',{exact:true})).toHaveValue('Cidade fictícia ainda não salva');
 expect(dialogs).toHaveLength(1);
});

test('invitation draft: canceling Escape preserves details without a generated message',async({page})=>{
 await openProfile(page);await section(page,'Convite');
 await page.getByRole('textbox',{name:'Seu nome',exact:true}).fill('Recrutadora fictícia');
 const dialogs:string[]=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});
 await page.keyboard.press('Escape');
 await expect(page.getByRole('textbox',{name:'Seu nome',exact:true})).toHaveValue('Recrutadora fictícia');
 expect(dialogs).toHaveLength(1);
});

function cancelDialogs(page:Page){const messages:string[]=[];page.on('dialog',async d=>{messages.push(d.message());await d.dismiss()});return messages;}
async function saveData(page:Page){await page.getByRole('button',{name:'Salvar dados e confirmações',exact:true}).click();}
async function invitation(page:Page){await section(page,'Convite');await page.getByRole('textbox',{name:'Seu nome',exact:true}).fill('Recrutadora fictícia');await page.getByRole('button',{name:'Preparar rascunhos',exact:true}).click();}

test('data confirmation: isolated checkbox and method survive canceled Escape and tab changes',async({page})=>{
 await openProfile(page);await section(page,'Dados');
 await page.getByRole('checkbox',{name:'Conferi esta localização com o candidato',exact:true}).check();
 await page.getByLabel('Como os dados foram confirmados?',{exact:true}).selectOption('Telefone');
 await section(page,'Convite');await section(page,'Dados');
 const dialogs=cancelDialogs(page);await page.keyboard.press('Escape');
 await expect(page.getByRole('checkbox',{name:'Conferi esta localização com o candidato',exact:true})).toBeChecked();
 await expect(page.getByLabel('Como os dados foram confirmados?',{exact:true})).toHaveValue('Telefone');expect(dialogs).toHaveLength(1);
});

test('discarded data and invitation never leak into a reopened profile',async({page,sandbox})=>{
 sandbox.data.candidates.push({...sandbox.data.candidates[0],id:'00000000-0000-4000-8000-000000000002',name:'Pessoa Fictícia Beta'});
 await openProfile(page);await section(page,'Dados');await page.getByLabel('Cidade informada',{exact:true}).fill('Cidade descartada');
 await section(page,'Convite');await page.getByRole('textbox',{name:'Seu nome',exact:true}).fill('Texto descartado');
 const messages:string[]=[];page.on('dialog',async d=>{messages.push(d.message());await d.accept()});
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Beta',exact:true}).click();await section(page,'Dados');
 await expect(page.getByLabel('Cidade informada',{exact:true})).toHaveValue('São Paulo');
 await section(page,'Convite');await expect(page.getByRole('textbox',{name:'Seu nome',exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true}).click();await section(page,'Dados');
 await expect(page.getByLabel('Cidade informada',{exact:true})).toHaveValue('São Paulo');expect(messages).toHaveLength(1);
});

for(const saved of ['Dados','Convite'] as const)test(`saving ${saved} leaves the other dirty form protected`,async({page,sandbox})=>{
 await openProfile(page);await section(page,'Dados');await page.getByLabel('Cidade informada',{exact:true}).fill('Cidade fictícia editada');
 await invitation(page);
 if(saved==='Dados'){await section(page,'Dados');await saveData(page);await expect.poll(()=>sandbox.data.candidates[0].city).toBe('Cidade fictícia editada');await expect(page.getByRole('button',{name:'Salvar dados e confirmações',exact:true})).toBeDisabled();}
 else{await page.getByRole('button',{name:'Salvar rascunhos',exact:true}).click();await expect(page.getByRole('button',{name:'Salvar rascunhos',exact:true})).toBeDisabled();}
 const dialogs=cancelDialogs(page);await page.getByRole('button',{name:'Fechar',exact:true}).click();expect(dialogs).toHaveLength(1);
 await section(page,saved==='Dados'?'Convite':'Dados');
 if(saved==='Dados')await expect(page.getByRole('textbox',{name:'Seu nome',exact:true})).toHaveValue('Recrutadora fictícia');
 else await expect(page.getByLabel('Cidade informada',{exact:true})).toHaveValue('Cidade fictícia editada');
});

test('data save succeeds, clears its warning and survives simulated reload',async({page,sandbox})=>{
 await openProfile(page);await section(page,'Dados');await page.getByLabel('Cidade informada',{exact:true}).fill('Cidade fictícia salva');
 await saveData(page);await expect.poll(()=>sandbox.data.candidates[0].city).toBe('Cidade fictícia salva');
 await expect(page.getByRole('button',{name:'Salvar dados e confirmações',exact:true})).toBeDisabled();
 const dialogs=cancelDialogs(page);await page.getByRole('button',{name:'Fechar',exact:true}).click();expect(dialogs).toHaveLength(0);
 await openProfile(page);await section(page,'Dados');await expect(page.getByLabel('Cidade informada',{exact:true})).toHaveValue('Cidade fictícia salva');
});

for(const failure of ['network','conflict'] as const)test(`data save ${failure} keeps pending edits and close protection`,async({page,sandbox})=>{
 await openProfile(page);await section(page,'Dados');await page.getByLabel('Cidade informada',{exact:true}).fill('Cidade fictícia pendente');
 if(failure==='network')sandbox.failNextSave=true;else sandbox.data.version!++;
 await saveData(page);await expect(page.getByText(failure==='network'?'Falha fictícia de rede. Tente novamente.':'Este espaço mudou em outra sessão. Recarregue antes de editar.',{exact:true})).toBeVisible();
 const dialogs=cancelDialogs(page);await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await expect(page.getByLabel('Cidade informada',{exact:true})).toHaveValue('Cidade fictícia pendente');expect(dialogs).toHaveLength(1);expect(sandbox.data.candidates[0].city).toBe('São Paulo');
 if(failure==='network'){await saveData(page);await expect.poll(()=>sandbox.data.candidates[0].city).toBe('Cidade fictícia pendente');}
});

test('invitation save failure retains text; retry clears only the saved warning',async({page,sandbox})=>{
 await openProfile(page);await invitation(page);await page.getByLabel('Mensagem para o candidato',{exact:true}).fill('Convite inteiramente fictício.');
 sandbox.failNextSave=true;await page.getByRole('button',{name:'Salvar rascunhos',exact:true}).click();await expect(page.getByText('Falha fictícia de rede. Tente novamente.',{exact:true})).toBeVisible();
 const dialogs=cancelDialogs(page);await page.getByRole('button',{name:'Fechar',exact:true}).click();await expect(page.getByLabel('Mensagem para o candidato',{exact:true})).toHaveValue('Convite inteiramente fictício.');expect(dialogs).toHaveLength(1);
 await page.getByRole('button',{name:'Salvar rascunhos',exact:true}).click();await expect(page.getByRole('button',{name:'Salvar rascunhos',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Fechar',exact:true}).click();expect(dialogs).toHaveLength(1);
 await openProfile(page);await section(page,'Convite');await expect(page.getByLabel('Mensagem para o candidato',{exact:true})).toHaveValue('Convite inteiramente fictício.');
});

test('late candidate save cannot replace a newly opened session of the same person',async({page,sandbox})=>{
 await openProfile(page);await section(page,'Dados');await page.getByLabel('Cidade informada',{exact:true}).fill('Resposta antiga fictícia');
 let release!:()=>void;sandbox.candidateSaveGate=new Promise<void>(resolve=>{release=resolve});
 const request=page.waitForRequest(r=>r.url().endsWith('/api/candidates')&&r.method()==='PATCH');await saveData(page);await request;
 page.once('dialog',async d=>d.accept());await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true}).click();await section(page,'Dados');
 await page.getByLabel('Cidade informada',{exact:true}).fill('Nova sessão fictícia pendente');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/candidates')&&r.request().method()==='PATCH');release();await response;
 await expect.poll(()=>sandbox.data.candidates[0].city).toBe('Resposta antiga fictícia');
 await expect(page.getByLabel('Cidade informada',{exact:true})).toHaveValue('Nova sessão fictícia pendente');
 const dialogs=cancelDialogs(page);await page.getByRole('button',{name:'Fechar',exact:true}).click();expect(dialogs).toHaveLength(1);
});

test('beforeunload is canceled for a data draft and released when restored',async({page})=>{
 await openProfile(page);await section(page,'Dados');await page.getByLabel('Cidade informada',{exact:true}).fill('Cidade temporária fictícia');
 const canceled=()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented});
 await expect.poll(canceled).toBe(true);await page.getByLabel('Cidade informada',{exact:true}).fill('São Paulo');await expect.poll(canceled).toBe(false);
});

test('CV history shortcut also protects unsaved candidate data',async({page,sandbox})=>{
 const candidate=sandbox.data.candidates[0];sandbox.data.archivedCandidates=[{...candidate,id:'00000000-0000-4000-8000-000000000003',name:'Histórico Fictício',mergedInto:candidate.id}];
 await openProfile(page);await section(page,'Dados');await page.getByLabel('Cidade informada',{exact:true}).fill('Cidade fictícia protegida');
 await section(page,'Evidências');const dialogs=cancelDialogs(page);
 await page.getByRole('button',{name:'Ver currículos e históricos anteriores',exact:true}).click();
 await expect(page.getByLabel('Seção do perfil',{exact:true})).toBeAttached();
 await section(page,'Dados');await expect(page.getByLabel('Cidade informada',{exact:true})).toHaveValue('Cidade fictícia protegida');expect(dialogs).toHaveLength(1);
});

