'use client';
import {useEffect,useState,type DragEvent} from 'react';
import {MapPin,Building2,Wallet,Clock3,Gift,CalendarDays,FileText,UploadCloud,CheckCircle2,ShieldCheck,LinkIcon,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {blankConditions} from '@/lib/candidate-refresh';
import {blankAnswer,type ApplicationContext} from '@/lib/candidate-applications';
import {pdfProblem} from '@/lib/pdf-import';
import {brazilDate} from '@/lib/pt-br';

const conditionItems=[{key:'location',label:'Local',icon:MapPin},{key:'workMode',label:'Modalidade',icon:Building2},{key:'salary',label:'Remuneração',icon:Wallet},{key:'schedule',label:'Jornada e escala',icon:Clock3},{key:'benefits',label:'Benefícios',icon:Gift},{key:'start',label:'Previsão de início',icon:CalendarDays}] as const;
const fields=[{key:'name',label:'Nome completo',type:'text',max:200,auto:'name',required:true,wide:true},{key:'phone',label:'Telefone com DDD',type:'tel',max:100,auto:'tel',required:false,wide:false},{key:'email',label:'E-mail',type:'email',max:300,auto:'email',required:false,wide:false},{key:'city',label:'Cidade e estado',type:'text',max:300,auto:'address-level2',required:true,wide:false},{key:'role',label:'Cargo ou área (opcional)',type:'text',max:300,auto:'organization-title',required:false,wide:false}] as const;
const size=(bytes:number)=>bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1).replace('.',',')} MB`;

export default function ApplicationForm(){
 const [token,setToken]=useState(''),[context,setContext]=useState<ApplicationContext|null>(null),[expiresAt,setExpiresAt]=useState(''),[draft,setDraft]=useState(blankAnswer),[file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[fileError,setFileError]=useState(''),[busy,setBusy]=useState(true),[done,setDone]=useState(false),[dragging,setDragging]=useState(false),[formToken,setFormToken]=useState(''),[website,setWebsite]=useState('');
 // The capability travels in the URL fragment, so it never reaches server logs, referrers or analytics.
 useEffect(()=>{const value=window.location.hash.slice(1);const abort=new AbortController();Promise.resolve().then(()=>{if(!/^[a-f0-9]{64}$/.test(value))throw Error('Abra o link completo enviado pela recrutadora.');return fetch('/api/public/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'view',token:value}),signal:abort.signal})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setToken(value);setContext(d.context);setExpiresAt(d.expiresAt);setFormToken(d.formToken||'')}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!abort.signal.aborted)setBusy(false)});return()=>abort.abort()},[]);
 function field<K extends keyof typeof blankAnswer>(key:K,value:(typeof blankAnswer)[K]){setDraft(d=>({...d,[key]:value}))}
 function choose(next:File|undefined){if(!next)return;const problem=pdfProblem(next);setFileError(problem);setFile(problem?null:next)}
 function drop(e:DragEvent<HTMLLabelElement>){e.preventDefault();setDragging(false);if(!busy)choose(e.dataTransfer.files?.[0])}
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!draft.consent)return;
  if(!file){setFileError('Anexe seu currículo em PDF para continuar.');return}
  if(!draft.phone.trim()&&!draft.email.trim()){setError('Informe pelo menos telefone ou e-mail.');return}
  setBusy(true);setError('');
  try{const form=new FormData();form.set('token',token);form.set('answer',JSON.stringify({...draft,consent:true}));form.set('file',file);form.set('formToken',formToken);form.set('website',website);const r=await fetch('/api/public/applications',{method:'POST',body:form});const d=await r.json();if(!r.ok)throw Error(d.error);setDone(true);window.history.replaceState(null,'',window.location.pathname);setToken('');window.scrollTo({top:0})}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const brand=<div className="apply-brand">talentia<span>.</span></div>;
 if(done)return <div className="apply-shell apply-center"><section className="apply-card apply-status" aria-live="polite">{brand}<CheckCircle2 className="apply-status-icon" size={44} aria-hidden="true"/><h1>Candidatura enviada.</h1><p>Seus dados e seu currículo chegaram para {context?.recruiter||'a recrutadora'}, que vai revisá-los com atenção.</p><p className="apply-muted">O envio não confirma uma entrevista nem uma contratação. Você pode fechar esta página.</p></section></div>;
 if(!context)return <div className="apply-shell apply-center"><section className="apply-card apply-status">{brand}{busy?<p role="status" className="apply-loading">Carregando a oportunidade…</p>:<><LinkIcon className="apply-status-icon apply-status-muted" size={40} aria-hidden="true"/><h1>Link indisponível.</h1><p role="alert">{error}</p></>}</section></div>;
 const conditions={...blankConditions,...context.conditions};
 return <div className="apply-shell">
  <header className="apply-header">{brand}<span className="apply-badge"><ShieldCheck size={15} aria-hidden="true"/>Revisado por uma pessoa</span></header>
  <div className="apply-layout">
   <section className="apply-intro" aria-labelledby="apply-title">
    <span className="apply-eyebrow">CANDIDATURA</span>
    <h1 id="apply-title">{context.title}</h1>
    <p className="apply-lead"><strong>{context.recruiter}</strong> está recebendo candidaturas para esta oportunidade{expiresAt&&<> até <time dateTime={expiresAt}>{brazilDate(expiresAt)}</time></>}. Sem criar conta: leva poucos minutos.</p>
    <div className="apply-conditions"><h2>Condições da oportunidade</h2><dl>{conditionItems.map(({key,label,icon:Icon})=>{const value=key==='workMode'&&conditions.workMode==='A combinar'?'':conditions[key];return <div key={key}><Icon size={18} aria-hidden="true"/><div><dt>{label}</dt><dd className={value?'':'apply-pending'}>{value||'A combinar com a recrutadora'}</dd></div></div>})}</dl></div>
   </section>
   <section className="apply-card apply-form-card" aria-labelledby="apply-form-title">
    <h2 id="apply-form-title">Seus dados</h2>
    <p className="apply-muted">Informe pelo menos telefone ou e-mail. Não envie CPF, documentos pessoais ou senhas.</p>
    {error&&<p className="apply-alert" role="alert">{error}</p>}
    <form onSubmit={submit} noValidate={false}><fieldset disabled={busy}>
     {/* Honeypot: hidden from people and assistive tech; automated scripts tend to fill every field. */}
     <div className="apply-trap" aria-hidden="true"><label htmlFor="apply-website">Site</label><input id="apply-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></div>
     <div className="apply-fields">{fields.map(f=><div key={f.key} className={f.wide?'apply-wide':''}><label className="apply-label" htmlFor={`apply-${f.key}`}>{f.label}</label><input id={`apply-${f.key}`} className="apply-input" type={f.type} autoComplete={f.auto} required={f.required} minLength={f.required?2:undefined} maxLength={f.max} value={draft[f.key]} onChange={e=>field(f.key,e.target.value)}/></div>)}</div>
     <h2 className="apply-section">Currículo</h2>
     <label htmlFor="apply-file" className={`apply-drop${dragging?' dragging':''}${file?' has-file':''}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={drop}>
      <input id="apply-file" className="apply-file-input" type="file" accept="application/pdf,.pdf" onChange={e=>{choose(e.target.files?.[0]);e.target.value=''}} aria-describedby="apply-file-help"/>
      {file?<><FileText size={26} aria-hidden="true"/><span className="apply-drop-text"><strong>{file.name}</strong><small>{size(file.size)} · toque para trocar</small></span></>:<><UploadCloud size={28} aria-hidden="true"/><span className="apply-drop-text"><strong>Anexar currículo em PDF</strong><small id="apply-file-help">Arraste o arquivo ou toque para escolher · até 2 MB</small></span></>}
     </label>
     {file&&<button type="button" className="apply-remove" onClick={()=>{setFile(null);setFileError('')}}><X size={14} aria-hidden="true"/>Remover arquivo</button>}
     {fileError&&<p className="apply-alert" role="alert">{fileError}</p>}
     <label className="apply-label" htmlFor="apply-message">Mensagem para a recrutadora (opcional)</label>
     <textarea className="apply-input apply-textarea" id="apply-message" maxLength={2000} rows={4} value={draft.message} onChange={e=>field('message',e.target.value)} placeholder="Disponibilidade, pretensão ou algo que queira contar."/>
     <label className="apply-consent"><input type="checkbox" required checked={draft.consent} onChange={e=>field('consent',e.target.checked)}/><span>Autorizo {context.recruiter} a guardar meus dados e meu currículo para avaliar esta e outras oportunidades compatíveis. Posso pedir a correção ou a exclusão a qualquer momento diretamente a ela.</span></label>
     <Button type="submit" className="apply-submit" disabled={!draft.consent||!file}>{busy?'Enviando…':'Enviar candidatura'}</Button>
    </fieldset></form>
    <p className="apply-footnote">As informações são revisadas pela recrutadora antes de entrar no banco de talentos. O conteúdo do currículo é lido por uma ferramenta de IA apenas para organizar seus dados.</p>
   </section>
  </div>
 </div>;
}
