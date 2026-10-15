import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
if(!process.env.npm_execpath)throw Error('Execute com npm run test:agent.');
const started=new Date().toISOString(),steps=[];
for(const name of ['typecheck','lint','test','build','security:client','test:http','test:browser']){
 console.log(`\nTalentia · verificação: ${name}`);const start=Date.now();
 const result=spawnSync(process.execPath,[process.env.npm_execpath,'run',name],{stdio:'inherit',windowsHide:true,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
 steps.push({name,status:result.status===0?'passed':'failed',seconds:Math.round((Date.now()-start)/1000)});
 if(result.status!==0)break;
}
mkdirSync('outputs/test-agent',{recursive:true});
const passed=steps.length===7&&steps.every(s=>s.status==='passed');
writeFileSync('outputs/test-agent/last-run.json',JSON.stringify({started,finished:new Date().toISOString(),passed,steps,scope:'Regras de negócio + interface com APIs simuladas + HTTP local sem autenticação. Integração real Supabase/Claude não coberta.'},null,2));
console.log(passed?'Verificações concluídas. Relatório: outputs/test-agent/last-run.json':'Falha encontrada. Consulte a etapa acima e os relatórios em test-results/ e playwright-report/.');
process.exitCode=passed?0:1;
