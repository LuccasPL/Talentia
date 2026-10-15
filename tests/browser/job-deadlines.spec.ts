import {test,expect} from './fixture';
import type {Page} from '@playwright/test';
import type {Job} from '../../lib/domain';
import {blankBriefingPlan} from '../../lib/job-briefing';

const now=new Date('2026-10-16T01:00:00Z'); // Ainda dia 15 em Brasília.
function vacancy(base:Job,id:string,title:string,date?:string,state?:'pausada'|'preenchida'|'cancelada'):Job{return {...structuredClone(base),id,title,briefingPlan:{...blankBriefingPlan,presentationDue:date||''},...(state?{lifecycle:{state,note:'Registro fictício.',updated:'2026-10-15T12:00:00Z',history:[]}}:{})};}
async function start(page:Page){await page.clock.setFixedTime(now);await page.goto('/');await expect(page.getByRole('heading',{name:'Acompanhamento',exact:true})).toBeVisible();}
const panel=(page:Page)=>page.getByRole('region',{name:'Prazos de apresentação',exact:true});

test('presentation deadlines respect vacancy scope, classify legacy dates and open the correct briefing without saving',async({page,sandbox})=>{
 const base=sandbox.data.jobs[0];sandbox.data.jobs=[vacancy(base,base.id,'Vaga Fictícia Alfa','2026-10-15'),vacancy(base,'beta','Vaga Fictícia Beta','2026-10-14','pausada'),vacancy(base,'invalid','Vaga Fictícia Data Inválida','2026-02-30'),vacancy(base,'closed','Vaga Fictícia Encerrada','2026-10-01','preenchida')];
 const before=JSON.stringify(sandbox.data);await start(page);const deadlines=panel(page);
 await expect(deadlines.getByRole('heading',{name:'Vaga Fictícia Alfa',exact:true})).toBeVisible();
 await expect(deadlines.getByRole('heading',{name:'Vaga Fictícia Beta',exact:true})).toHaveCount(0);
 await page.getByLabel('Acompanhamento da vaga',{exact:true}).selectOption('all');
 await expect(deadlines.getByRole('heading',{name:'Vaga Fictícia Beta',exact:true})).toBeVisible();await expect(deadlines.getByText('Vaga pausada',{exact:true})).toBeVisible();
 await expect(deadlines.getByText('Data a revisar no briefing.',{exact:true})).toBeVisible();await expect(deadlines.getByRole('heading',{name:'Vaga Fictícia Encerrada',exact:true})).toHaveCount(0);
 await deadlines.getByRole('button',{name:/Data ultrapassada$/}).click();
 const row=deadlines.locator('article').filter({has:page.getByRole('heading',{name:'Vaga Fictícia Beta',exact:true})});
 await row.getByRole('button',{name:'Conferir briefing',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Checklist do briefing',exact:true})).toBeVisible();
 await page.getByText('Acordos e pendências com o cliente',{exact:true}).click();
 await expect(page.getByLabel('Prazo para apresentar candidatos',{exact:true})).toHaveValue('2026-10-14');
 expect(JSON.stringify(sandbox.data)).toBe(before);
});

test('deadline filters handle missing dates and empty selections with no horizontal overflow',async({page,sandbox})=>{
 const base=sandbox.data.jobs[0];sandbox.data.jobs=[vacancy(base,base.id,'Vaga Fictícia Alfa','2026-10-15'),vacancy(base,'future','Vaga Fictícia Futura','2026-10-20'),vacancy(base,'missing','Vaga Fictícia Sem Data'),vacancy(base,'invalid','Vaga Fictícia Inválida','2026-02-30')];
 await start(page);await page.getByLabel('Acompanhamento da vaga',{exact:true}).selectOption('all');const deadlines=panel(page);
 await deadlines.getByRole('button',{name:/A confirmar$/}).click();await expect(deadlines.locator('article')).toHaveCount(2);
 await expect(deadlines.getByText('Prazo a confirmar com o cliente.',{exact:true})).toBeVisible();await expect(deadlines.getByText('Data a revisar no briefing.',{exact:true})).toBeVisible();
 await deadlines.getByRole('button',{name:/Próximos$/}).click();await expect(deadlines.getByRole('heading',{name:'Vaga Fictícia Futura',exact:true})).toBeVisible();
 await deadlines.getByRole('button',{name:/Data ultrapassada$/}).click();await expect(deadlines.locator('article')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('all 100 vacancies remain reachable in eight-item pages and changing filters resets the page',async({page,sandbox})=>{
 const base=sandbox.data.jobs[0];sandbox.data.jobs=Array.from({length:100},(_,i)=>vacancy(base,i===0?base.id:`job-${i}`,`Vaga Fictícia ${String(i).padStart(3,'0')}${i===99?' — '+ 'Título longo '.repeat(12):''}`,i===0?'2026-10-15':'2026-10-20'));
 await start(page);await page.getByLabel('Acompanhamento da vaga',{exact:true}).selectOption('all');const deadlines=panel(page);
 await expect(deadlines.locator('article')).toHaveCount(8);
 for(let i=0;i<12;i++)await deadlines.getByRole('button',{name:'Próxima',exact:true}).click();
 await expect(deadlines.getByRole('heading',{name:/^Vaga Fictícia 099/})).toBeVisible();await expect(deadlines.locator('article')).toHaveCount(4);
 await expect(deadlines.getByRole('button',{name:'Próxima',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await deadlines.getByRole('button',{name:/Hoje$/}).click();await expect(deadlines.getByRole('heading',{name:'Vaga Fictícia 000',exact:true})).toBeVisible();
 await deadlines.getByRole('button',{name:/Todas$/}).click();await expect(deadlines.locator('article')).toHaveCount(8);await expect(deadlines.getByRole('button',{name:'Anterior',exact:true})).toBeDisabled();
});

test('the visible date classification refreshes across midnight in Brasília',async({page,sandbox})=>{
 sandbox.data.jobs[0]=vacancy(sandbox.data.jobs[0],sandbox.data.jobs[0].id,'Vaga Fictícia Alfa','2026-10-15');
 await page.clock.install({time:new Date('2026-10-16T02:59:30Z')});await page.goto('/');const deadlines=panel(page);
 await expect(deadlines.getByRole('button',{name:/Hoje$/})).toContainText('1');
 await page.clock.runFor(60000);
 await expect(deadlines.getByRole('button',{name:/Data ultrapassada$/})).toContainText('1');
 await expect(deadlines.getByRole('button',{name:/Hoje$/})).toContainText('0');
});
