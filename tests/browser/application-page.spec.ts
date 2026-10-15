import {test,expect,applicationToken} from './fixture';

// Public /candidatura page rendered by the test gallery with simulated APIs. Not a validation of Supabase or the real upload.
const pdf={name:'curriculo-ficticio.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 currículo fictício para teste')};

test('application page: shows the vacancy, sends declared data with the PDF and confirms',async({page,sandbox})=>{
 await page.goto(`/candidatura.html#${applicationToken}`);
 await expect(page.getByRole('heading',{level:1,name:'Vaga Fictícia Alfa'})).toBeVisible();
 await expect(page.getByText('Recrutadora Fictícia',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('Escala 6x1',{exact:true})).toBeVisible();
 const send=page.getByRole('button',{name:'Enviar candidatura',exact:true});
 await expect(send).toBeDisabled();
 await page.getByLabel('Nome completo',{exact:true}).fill('Pessoa Fictícia Delta');
 await page.getByLabel('Telefone com DDD',{exact:true}).fill('(11) 90000-0000');
 await page.getByLabel('Cidade e estado',{exact:true}).fill('Campinas, SP');
 await page.locator('#apply-file').setInputFiles(pdf);
 await expect(page.getByText('curriculo-ficticio.pdf',{exact:true})).toBeVisible();
 await page.getByText(/^Autorizo Recrutadora Fictícia/).click();
 await expect(send).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await send.click();
 await expect(page.getByRole('heading',{name:'Candidatura enviada.',exact:true})).toBeVisible();
 expect(page.url()).not.toContain(applicationToken);
 expect(sandbox.publicSubmissions).toHaveLength(1);
 expect(sandbox.publicSubmissions[0].answer).toEqual({name:'Pessoa Fictícia Delta',email:'',phone:'(11) 90000-0000',city:'Campinas, SP',role:'',message:'',consent:true});
 expect(sandbox.publicSubmissions[0].fileName).toBe('curriculo-ficticio.pdf');
});

test('application page: rejects non-PDF files before sending and explains an unavailable link',async({page,sandbox})=>{
 await page.goto(`/candidatura.html#${applicationToken}`);
 await page.locator('#apply-file').setInputFiles({name:'curriculo.docx',mimeType:'application/octet-stream',buffer:Buffer.from('fictício')});
 await expect(page.getByRole('alert')).toHaveText('Selecione um arquivo PDF.');
 await expect(page.getByRole('button',{name:'Enviar candidatura',exact:true})).toBeDisabled();
 await page.goto(`/candidatura.html?outro=1#${'0'.repeat(64)}`);
 await expect(page.getByRole('heading',{name:'Link indisponível.',exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('não está recebendo candidaturas');
 expect(sandbox.publicSubmissions).toHaveLength(0);
});
