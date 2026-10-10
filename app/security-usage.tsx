'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Download,RefreshCw,ShieldCheck,Sparkles} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {usageSnapshotSchema,usageLabel,usagePercent,renewalLabel,effectiveAiRemaining,type UsageSnapshot} from '@/lib/usage-status';

type Snapshot=UsageSnapshot&{aiEnabled:boolean};
async function fetchSnapshot(signal:AbortSignal):Promise<Snapshot>{
 const response=await fetch('/api/usage',{cache:'no-store',signal}),body=await response.json();
 if(!response.ok)throw Error(body.error||'Não foi possível consultar o uso.');
 const parsed=usageSnapshotSchema.safeParse(body);if(!parsed.success)throw Error('Não foi possível conferir os limites. Tente novamente.');
 return {...parsed.data,aiEnabled:body.aiEnabled===true};
}
export default function SecurityUsage({open,onOpenChange,connected}:{open:boolean;onOpenChange:(open:boolean)=>void;connected:boolean}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[exporting,setExporting]=useState(false),[notice,setNotice]=useState('');
 const mounted=useRef(false),activeRequest=useRef<AbortController|null>(null),exportRequest=useRef<AbortController|null>(null),exportLock=useRef(false);
 const load=useCallback((signal:AbortSignal)=>{
  void fetchSnapshot(signal).then(value=>{if(!signal.aborted)setSnapshot(value);}).catch(e=>{if(!signal.aborted)setError(e instanceof Error?e.message:'Não foi possível consultar o uso.');}).finally(()=>{if(!signal.aborted)setLoading(false);});
 },[]);
 useEffect(()=>{
  mounted.current=true;
  if(open&&connected){const controller=new AbortController();activeRequest.current=controller;void load(controller.signal);return()=>{mounted.current=false;activeRequest.current?.abort();exportRequest.current?.abort();};}
  return()=>{mounted.current=false;};
 },[open,connected,load]);
 function refresh(){setLoading(true);setError('');activeRequest.current?.abort();const controller=new AbortController();activeRequest.current=controller;void load(controller.signal);}
 async function exportCandidates(){
  if(exportLock.current)return;exportLock.current=true;setExporting(true);setNotice('');const controller=new AbortController();exportRequest.current=controller;
  try{
   const response=await fetch('/api/export/candidates',{method:'POST',signal:controller.signal});
   if(!response.ok){const body=await response.json();throw Error(body.error||'Não foi possível exportar os candidatos.');}
   const blob=await response.blob();
   if(!mounted.current||controller.signal.aborted)return;
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=response.headers.get('Content-Disposition')?.match(/filename="(talentia-candidatos-[0-9-]+\.csv)"/)?.[1]||'talentia-candidatos.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   const count=Number(response.headers.get('X-Talentia-Export-Count'));
   setNotice(`${count} ${count===1?'candidato incluído':'candidatos incluídos'} no arquivo CSV.`);refresh();
  }catch(e){if(mounted.current&&!controller.signal.aborted)setNotice(e instanceof Error?e.message:'Não foi possível exportar os candidatos.');}
  finally{exportLock.current=false;setExporting(false);}
 }
 const primary=snapshot?.limits.filter(l=>l.bucket==='ai-call'||l.bucket==='ai-request'||l.bucket==='upload')||[];
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="security-dialog"><DialogHeader><DialogTitle>Segurança e uso</DialogTitle><DialogDescription>Acompanhe os limites da sua conta e cuide da sua base de talentos.</DialogDescription></DialogHeader>
  <section className="security-protection"><ShieldCheck size={22}/><div><h2>Seu espaço é privado</h2><p>Currículos e registros ficam associados à sua conta. Os limites de uso são verificados no servidor.</p></div></section>
  <section aria-labelledby="usage-heading"><div className="security-section-heading"><h2 id="usage-heading"><Sparkles size={18}/>Uso da Talentia</h2><Button variant="outline" onClick={refresh} disabled={!connected||loading}><RefreshCw size={16}/>{loading?'Consultando…':'Atualizar uso'}</Button></div>
   {!connected?<p role="status">Aguarde seu espaço carregar para consultar o uso.</p>:error?<p role="alert" className="security-feedback">{error}</p>:!snapshot?<p role="status">Consultando os limites da sua conta…</p>:<>
    <p className="security-caption">{snapshot.aiEnabled?`Disponíveis nesta consulta: até ${effectiveAiRemaining(snapshot.limits)} chamadas à IA, considerando os limites da hora e do dia.`:'A IA ainda não está liberada para esta conta. Você pode continuar organizando seus dados.'}</p>
    <div className="usage-grid">{primary.map(limit=><article className="usage-card" key={`${limit.bucket}-${limit.windowSeconds}`}><h3>{usageLabel(limit)}</h3><p><strong>{limit.used}</strong> de {limit.limit} tentativas</p><div role="progressbar" aria-label={usageLabel(limit)} aria-valuemin={0} aria-valuemax={limit.limit} aria-valuenow={Math.min(limit.used,limit.limit)} className="usage-track"><span style={{width:`${usagePercent(limit)}%`}}/></div><small>{limit.remaining} restantes · Renova em {renewalLabel(limit.resetsAt)} (Brasília)</small></article>)}</div>
    <p className="security-caption">Uma comparação pode usar vários lotes de IA. Tentativas contam mesmo se não forem concluídas. Os números são limites de uso; o valor cobrado depende do consumo na Anthropic.</p>
    <details className="usage-details"><summary>Outros limites da conta</summary>{snapshot.limits.filter(l=>!primary.includes(l)).map(l=><div key={`${l.bucket}-${l.windowSeconds}`}><span>{usageLabel(l)}</span><strong>{l.used} / {l.limit}</strong><small>Renova em {renewalLabel(l.resetsAt)} (Brasília)</small></div>)}</details>
    <p className="security-updated">Consulta de {renewalLabel(snapshot.generatedAt)} (Brasília). Use Atualizar uso após trabalhar na base.</p>
   </>}
  </section>
  <section className="security-export"><h2><Download size={18}/>Exportar dados cadastrais</h2><p>Baixe os candidatos ativos em CSV para abrir no Excel: nome, cargo, cidade, contatos, origem do currículo e datas de confirmação. A exportação usa os dados salvos na sua conta.</p><p className="security-caption">O arquivo contém informações pessoais. Guarde-o em um local seguro e compartilhe com cuidado.</p><Button className="primary-button" disabled={!connected||exporting} onClick={exportCandidates}><Download size={16}/>{exporting?'Preparando arquivo…':'Baixar candidatos em CSV'}</Button><p role="status" aria-live="polite" className="security-feedback">{notice}</p></section>
 </DialogContent></Dialog>;
}
