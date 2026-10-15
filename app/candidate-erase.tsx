'use client';
import {useState} from 'react';
import {Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {Candidate,Data} from '@/lib/domain';
import {confirmsName} from '@/lib/candidate-erasure';

// Permanent erasure at the person's request (LGPD). Collapsed by default; requires typing the full name.
export default function CandidateErase({candidate,version,disabled,onErased}:{candidate:Candidate;version?:number;disabled:boolean;onErased:(data:Data,warnings:string[])=>void}){
 const [typed,setTyped]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const ready=confirmsName(candidate,typed);
 async function erase(){
  if(!ready||!version)return;
  setBusy(true);setError('');
  try{const r=await fetch('/api/candidates/erase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidateId:candidate.id,version,confirmName:typed})});const d=await r.json();if(!r.ok)throw Error(d.error);onErased(d.data,d.warnings||[])}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 if(candidate.demo)return null;
 return <details className="sheet-section erase-panel"><summary><Trash2 size={16} aria-hidden="true"/>Excluir dados desta pessoa</summary>
  <p>Use quando a pessoa pedir a exclusão dos dados dela. Isso apaga de forma definitiva, nesta conta:</p>
  <ul><li>o perfil, o currículo em PDF e perfis duplicados unidos a ele;</li><li>contatos, notas, entrevistas, pareceres e decisões do cliente em todas as vagas;</li><li>comparações com evidências, histórico de importação, candidatura aceita e links de atualização.</li></ul>
  <p className="muted">Não é possível desfazer. Cópias que já saíram do sistema (pareceres impressos, mensagens, planilhas exportadas) e candidaturas ainda pendentes na fila não são apagadas por aqui. Backups do provedor expiram conforme a política dele.</p>
  {disabled&&<p className="notice">Salve ou descarte as alterações abertas e aguarde outras operações antes de excluir.</p>}
  <fieldset disabled={busy||disabled}><label className="field-label" htmlFor="erase-confirm">Para confirmar, digite o nome completo: <strong>{candidate.name}</strong></label><input id="erase-confirm" className="text-input" autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)}/>
  {error&&<p className="notice" role="alert">{error}</p>}
  <Button variant="outline" className="erase-button" disabled={!ready} onClick={()=>void erase()}><Trash2 size={15} aria-hidden="true"/>{busy?'Excluindo…':'Excluir definitivamente'}</Button></fieldset>
 </details>;
}
