import {test,expect,candidateId} from './fixture';
import type {Page} from '@playwright/test';
async function start(page:Page){await page.goto('/');await expect(page.getByRole('heading',{name:'Acompanhamento',exact:true})).toBeVisible();}
async function vacancy(page:Page){const mobile=page.getByRole('button',{name:'Abrir menu completo',exact:true});if(page.viewportSize()!.width<768)await mobile.click();await page.getByRole('button',{name:'Vaga Fictícia Alfa',exact:true}).click();if(page.viewportSize()!.width<768){await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();}}
async function profile(page:Page){const talents=page.getByRole('button',{name:'Talentos',exact:true});if(page.viewportSize()!.width<768)await talents.click();else await page.getByRole('button',{name:/^Banco de talentos \d/}).click();await page.getByRole('button',{name:'Ver perfil de Pessoa Fictícia Alfa',exact:true}).click();}
async function section(page:Page,name:string){const mobile=page.getByLabel('Seção do perfil',{exact:true});if(page.viewportSize()!.width<768)await mobile.selectOption({label:name==='Conclusão'?'Conclusão da entrevista':name});else await page.getByRole('tab',{name,exact:true}).click();}
async function menu(page:Page){const mobile=page.getByRole('button',{name:'Abrir menu completo',exact:true});if(await mobile.isVisible())await mobile.click();}

test('interview draft: canceling close preserves an unsaved response',async({page})=>{
 await start(page);await profile(page);await section(page,'Entrevista');
 await page.getByRole('button',{name:'Preparar roteiro',exact:true}).click();
 await page.getByLabel('Resposta registrada 1',{exact:true}).fill('Rascunho fictício ainda não salvo.');
 const dialogs:string[]=[];page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss()});
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await expect(page.getByLabel('Resposta registrada 1',{exact:true})).toHaveValue('Rascunho fictício ainda não salvo.');
 expect(dialogs).toHaveLength(1);
});

test('briefing: saves agreements, keeps criteria and survives reload',async({page,sandbox})=>{
 await start(page);await vacancy(page);
 await page.getByText('Acordos e pendências com o cliente',{exact:true}).click();
 await page.getByLabel('Quantidade de posições',{exact:true}).fill('3');
 await page.getByLabel('Prazo para apresentar candidatos',{exact:true}).fill('2026-12-20');
 await page.getByLabel('Quem decide pelo cliente?',{exact:true}).fill('Gestora Fictícia');
 await page.getByLabel('O que ainda precisa confirmar?',{exact:true}).fill('Confirmar comissão fictícia.');
 await page.getByRole('button',{name:'Salvar acordos do briefing',exact:true}).click();
 await expect(page.getByText('Acordos do briefing salvos.',{exact:true})).toBeVisible();
 expect(sandbox.data.jobs[0].criteria).toHaveLength(1);
 await page.reload();await vacancy(page);
 await page.getByText('Acordos e pendências com o cliente',{exact:true}).click();
 await expect(page.getByLabel('Quantidade de posições',{exact:true})).toHaveValue('3');
 await expect(page.getByLabel('Prazo para apresentar candidatos',{exact:true})).toHaveValue('2026-12-20');
 await expect(page.getByLabel('Quem decide pelo cliente?',{exact:true})).toHaveValue('Gestora Fictícia');
 await expect(page.getByLabel('O que ainda precisa confirmar?',{exact:true})).toHaveValue('Confirmar comissão fictícia.');
});

test('vacancy: creates a separate opportunity, organizes criteria and compares fictional profiles',async({page,sandbox})=>{
 await start(page);await menu(page);await page.getByRole('button',{name:'Criar vaga',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Uma nova oportunidade'});await dialog.getByLabel('Nome da vaga',{exact:true}).fill('Nova Vaga Fictícia');
 await dialog.getByRole('button',{name:'Criar vaga',exact:true}).click();await expect(dialog).not.toBeVisible();
 if(await page.getByRole('dialog').isVisible())await page.keyboard.press('Escape');
 await page.getByLabel('Perfil, experiências e condições importantes',{exact:true}).fill('Experiência com atendimento ao público.');
 await page.getByRole('button',{name:'Organizar critérios',exact:true}).click();
 await expect(page.getByRole('heading',{name:'O briefing virou critérios.',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Comparar 1 perfil filtrado',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Experiências para explorar',exact:true})).toBeVisible();
 expect(sandbox.data.jobs).toHaveLength(2);expect(sandbox.data.jobs[0].analyses[0].candidateId).toBe(candidateId);
});

test('manual candidate: validates required data and creates a profile without a CV',async({page,sandbox})=>{
 await start(page);await page.getByRole('button',{name:'Adicionar candidato',exact:true}).click();
 const dialog=page.getByRole('dialog');const save=dialog.getByRole('button',{name:'Cadastrar candidato',exact:true});await expect(save).toBeDisabled();
 await dialog.getByLabel('Nome *',{exact:true}).fill('Pessoa Fictícia Beta');
 await dialog.getByLabel('E-mail',{exact:true}).fill('invalido');await expect(save).toBeDisabled();
 await dialog.getByLabel('E-mail',{exact:true}).fill('');await save.click();await expect(dialog).not.toBeVisible();
 expect(sandbox.data.candidates.find(c=>c.name==='Pessoa Fictícia Beta')?.source).toBe('Cadastro manual');
 await page.reload();await expect(page.getByRole('button',{name:'Adicionar candidato',exact:true})).toBeVisible();
 if(page.viewportSize()!.width<768)await page.getByRole('button',{name:'Talentos',exact:true}).click();else await page.getByRole('button',{name:/^Banco de talentos \d/}).click();
 await expect(page.getByRole('heading',{name:'Pessoa Fictícia Beta',exact:true})).toBeVisible();
});

test('PDF import: invalid extension and files above 2 MB never reach the server',async({page})=>{
 await start(page);await page.getByRole('button',{name:'Adicionar candidato',exact:true}).click();
 await page.getByRole('dialog').locator('input[type=file]').setInputFiles([{name:'arquivo-invalido.txt',mimeType:'text/plain',buffer:Buffer.from('FICTÍCIO')},{name:'curriculo-grande.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(2*1024*1024+1)}]);
 await expect(page.getByText('Precisa de atenção',{exact:true})).toHaveCount(2);
 await expect(page.getByRole('button',{name:/^Enviar.*PDF/})).toBeDisabled();
});

test('save errors: preserves typed agreements and allows a successful retry',async({page,sandbox})=>{
 await start(page);await vacancy(page);await page.getByText('Acordos e pendências com o cliente',{exact:true}).click();
 await page.getByLabel('Quem decide pelo cliente?',{exact:true}).fill('Decisora Fictícia');sandbox.failNextSave=true;
 await page.getByRole('button',{name:'Salvar acordos do briefing',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Falha fictícia de rede.');
 await expect(page.getByLabel('Quem decide pelo cliente?',{exact:true})).toHaveValue('Decisora Fictícia');
 await page.getByRole('button',{name:'Salvar acordos do briefing',exact:true}).click();
 await expect(page.getByText('Acordos do briefing salvos.',{exact:true})).toBeVisible();expect(sandbox.data.jobs[0].briefingPlan?.decisionMaker).toBe('Decisora Fictícia');
});

test('concurrent session: refuses to overwrite a newer workspace',async({page,sandbox})=>{
 await start(page);await vacancy(page);await page.getByText('Acordos e pendências com o cliente',{exact:true}).click();
 await page.getByLabel('Quem decide pelo cliente?',{exact:true}).fill('Edição ainda não salva');sandbox.data.version!++;
 await page.getByRole('button',{name:'Salvar acordos do briefing',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Este espaço mudou em outra sessão.');expect(sandbox.data.jobs[0].briefingPlan).toBeUndefined();
});

test('interview to client: saved answers allow evaluation and a reviewed report is captured in the presentation',async({page,sandbox})=>{
 await start(page);await profile(page);await section(page,'Entrevista');
 await page.getByRole('button',{name:'Preparar roteiro',exact:true}).click();
 await page.getByLabel('Resposta registrada 1',{exact:true}).fill('EXEMPLO FICTÍCIO: acolhi e orientei clientes na loja de exemplo.');
 await page.getByRole('button',{name:'Salvar roteiro e respostas',exact:true}).click();
 await expect(page.getByText('Roteiro e respostas salvos nesta vaga.',{exact:true})).toBeVisible();
 await section(page,'Conclusão');
 await expect(page.getByLabel('Conclusão deste critério',{exact:true})).toBeEnabled();
 await page.getByLabel('Conclusão deste critério',{exact:true}).selectOption('demonstrado');
 await page.getByLabel('Exemplo observado e fundamento (obrigatório)',{exact:true}).fill('Evidência fictícia de acolhimento e orientação.');
 await page.getByLabel('Justificativa e pontos de atenção',{exact:true}).fill('Avaliação inteiramente fictícia para teste automatizado.');
 await page.getByRole('button',{name:'Salvar conclusão revisada',exact:true}).click();await expect(page.getByText('Andamento salvo.',{exact:true})).toBeVisible();
 await section(page,'Parecer');await page.getByRole('button',{name:'Preparar rascunho',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Parecer editável',exact:true})).toContainText('EXEMPLO FICTÍCIO');
 await page.getByRole('button',{name:'Salvar parecer revisado',exact:true}).click();await expect(page.getByText('Parecer revisado e salvo.',{exact:true})).toBeVisible();
 await section(page,'Processo e cliente');
 await page.getByLabel('Pessoa com quem falou (obrigatório)',{exact:true}).fill('Cliente Fictício');
 await page.getByLabel('Detalhes, motivo e próximos passos',{exact:true}).fill('APRESENTAÇÃO FICTÍCIA. Nenhum documento enviado.');
 await page.getByRole('checkbox',{name:'Confirmo que a ação ocorreu e que o registro descreve o andamento real.',exact:true}).check();
 await page.getByRole('button',{name:'Registrar andamento',exact:true}).click();
 await expect.poll(()=>sandbox.data.records[0]?.clientHistory?.length).toBe(1);
 expect(sandbox.data.records[0].clientHistory?.[0].reportSnapshot).toContain('EXEMPLO FICTÍCIO');
 expect(sandbox.data.records[0].status).toBe('Apresentado ao cliente');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.reload();await profile(page);
 await section(page,'Processo e cliente');await expect(page.getByText('APRESENTAÇÃO FICTÍCIA. Nenhum documento enviado.',{exact:true})).toBeVisible();
});

test('agenda: stores Brasília date and time without confirming the candidate',async({page,sandbox})=>{
 await start(page);await profile(page);await section(page,'Entrevista');
 await page.getByRole('button',{name:'Agendar entrevista deste candidato',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Agendar entrevista',exact:true});
 await dialog.getByLabel('Data da entrevista',{exact:true}).fill('2026-12-20');
 await dialog.getByLabel('Horário de Brasília',{exact:true}).fill('14:30');
 await dialog.getByRole('button',{name:'Salvar entrevista na agenda',exact:true}).click();await expect(dialog).not.toBeVisible();
 const record=sandbox.data.records.find(r=>r.candidateId===candidateId)!;expect(record.appointments?.[0].startsAt).toBe('2026-12-20T17:30:00.000Z');expect(record.interest).toBe('Não confirmado');expect(record.status).toBe('Não contatado');
});

test('responsive layout: briefing and open candidate remain inside the viewport',async({page})=>{
 await start(page);await vacancy(page);await page.getByText('Acordos e pendências com o cliente',{exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await profile(page);await section(page,'Triagem');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('triage: requires human confirmation and persists without changing contact stage',async({page,sandbox})=>{
 await start(page);await profile(page);await section(page,'Triagem');
 const save=page.getByRole('button',{name:'Salvar triagem revisada',exact:true});await expect(save).toBeDisabled();
 await page.getByLabel('Por que tomou essa decisão?',{exact:true}).fill('Experiência fictícia de atendimento; disponibilidade a confirmar.');
 await page.getByLabel('Próxima ação',{exact:true}).fill('Confirmar disponibilidade da pessoa fictícia.');await expect(save).toBeDisabled();
 await page.getByRole('checkbox',{name:'Revisei as informações e esta é a minha decisão para esta vaga.',exact:true}).check();
 await save.click();await expect(page.getByText('Andamento salvo.',{exact:true})).toBeVisible();
 expect(sandbox.data.records.find(r=>r.candidateId===candidateId)?.status).toBe('Não contatado');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.reload();await profile(page);
 await section(page,'Triagem');await expect(page.getByLabel('Próxima ação',{exact:true})).toHaveValue('Confirmar disponibilidade da pessoa fictícia.');
});
