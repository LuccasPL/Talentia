'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {blankConditions} from '@/lib/candidate-refresh';
import {blankAnswer,type ApplicationContext} from '@/lib/candidate-applications';
import {pdfProblem} from '@/lib/pdf-import';
import {brazilDate} from '@/lib/pt-br';

const conditionLabels:Record<string,string>={location:'Local',workMode:'Modalidade',salary:'Remuneração',schedule:'Jornada e escala',benefits:'Benefícios',start:'Previsão de início'};

export default function ApplicationForm(){
 const [token,setToken]=useState(''),[context,setContext]=useState<ApplicationContext|null>(null),[expiresAt,setExpiresAt]=useState(''),[draft,setDraft]=useState(blankAnswer),[file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[done,setDone]=useState(false);
 // The capability travels in the URL fragment, so it never reaches server logs, referrers or analytics.
 useEffect(()=>{const value=window.location.hash.slice(1);const abort=new AbortController();Promise.resolve().then(()=>{if(!/^[a-f0-9]{64}$/.test(value))throw Error('Abra o link completo enviado pela recrutadora.');return fetch('/api/public/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'view',token:value}),signal:abort.signal})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setToken(value);setContext(d.context);setExpiresAt(d.expiresAt)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!abort.signal.aborted)setBusy(false)});return()=>abort.abort()},[]);
 function field<K extends keyof typeof blankAnswer>(key:K,value:(typeof blankAnswer)[K]){setDraft(d=>({...d,[key]:value}))}
 function choose(next:File|undefined){if(!next){setFile(null);return}const problem=pdfProblem(next);setError(problem);setFile(problem?null:next)}
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!file||!draft.consent)return;
  if(!draft.phone.trim()&&!draft.email.trim()){setError('Informe pelo menos telefone ou e-mail.');return}
  setBusy(true);setError('');
  try{const form=new FormData();form.set('token',token);form.set('answer',JSON.stringify({...draft,consent:true}));form.set('file',file);const r=await fetch('/api/public/applications',{method:'POST',body:form});const d=await r.json();if(!r.ok)throw Error(d.error);setDone(true);window.history.replaceState(null,'',window.location.pathname);setToken('');}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="candidate-public-card"><div className="brand">talentia<span>.</span></div>{done?<><h1>Candidatura enviada.</h1><p>Seus dados e seu currículo foram enviados à recrutadora, que vai revisá-los. Isso não confirma uma entrevista nem uma contratação.</p><p>Você pode fechar esta página.</p></>:<><h1>Envie sua candidatura.</h1>{busy&&!context&&<p role="status">Carregando a oportunidade…</p>}{error&&<p className="notice" role="alert">{error}</p>}{context&&<><p><strong>{context.recruiter}</strong> está recebendo candidaturas para a oportunidade de <strong>{context.title}</strong>{expiresAt&&<> até {brazilDate(expiresAt)}</>}.</p><p>Sem criar conta. Preencha seus dados e anexe seu currículo em PDF.</p><div className="public-conditions"><h2>Condições da oportunidade</h2><dl>{Object.entries({...blankConditions,...context.conditions}).map(([key,value])=><div key={key}><dt>{conditionLabels[key]||key}</dt><dd>{value||'A combinar com a recrutadora'}</dd></div>)}</dl></div><form onSubmit={submit}><fieldset disabled={busy}>
  {([{key:'name',label:'Nome completo',type:'text',max:200,auto:'name',required:true},{key:'phone',label:'Telefone com DDD',type:'tel',max:100,auto:'tel',required:false},{key:'email',label:'E-mail',type:'email',max:300,auto:'email',required:false},{key:'city',label:'Cidade e estado onde mora',type:'text',max:300,auto:'address-level2',required:true},{key:'role',label:'Cargo ou área de atuação (opcional)',type:'text',max:300,auto:'organization-title',required:false}] as const).map(f=><div key={f.key}><label className="field-label" htmlFor={`apply-${f.key}`}>{f.label}</label><input id={`apply-${f.key}`} className="text-input" type={f.type} autoComplete={f.auto} required={f.required} minLength={f.required?2:undefined} maxLength={f.max} value={draft[f.key]} onChange={e=>field(f.key,e.target.value)}/></div>)}
  <p className="muted">Informe pelo menos telefone ou e-mail. Não envie CPF, documentos pessoais ou senhas.</p>
  <label className="field-label" htmlFor="apply-message">Mensagem para a recrutadora (opcional)</label><textarea className="notes-input" id="apply-message" maxLength={2000} rows={3} value={draft.message} onChange={e=>field('message',e.target.value)} placeholder="Disponibilidade, pretensão ou algo que queira contar."/>
  <label className="field-label" htmlFor="apply-file">Currículo em PDF (até 2 MB)</label><input id="apply-file" className="text-input" type="file" accept="application/pdf,.pdf" required onChange={e=>choose(e.target.files?.[0])}/>
  <label className="verification-check"><input type="checkbox" required checked={draft.consent} onChange={e=>field('consent',e.target.checked)}/>Autorizo {context.recruiter} a guardar meus dados e meu currículo para avaliar esta e outras oportunidades compatíveis. Posso pedir a correção ou a exclusão a qualquer momento diretamente a ela.</label>
  <Button type="submit" className="primary-button" disabled={!draft.consent||!file}>{busy?'Enviando…':'Enviar candidatura'}</Button>
 </fieldset></form><p className="muted">As informações serão revisadas pela recrutadora antes de entrar no banco de talentos. O conteúdo do currículo é lido por uma ferramenta de IA apenas para organizar seus dados.</p></>}</>}</section>;
}
