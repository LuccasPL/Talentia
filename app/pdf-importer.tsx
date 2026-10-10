'use client';
import {useRef,useState} from 'react';
import {Upload,LoaderCircle,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {pdfProblem,importLabels} from '@/lib/pdf-import';
import type {ImportMonitor} from './use-pdf-imports';
type LocalFile={id:string;file:File;state:'waiting'|'uploading'|'sent'|'failed'|'duplicate';error:string};
export default function PdfImporter({enabled,monitor}:{enabled:boolean;monitor:ImportMonitor}){
 const {rows,setRows,checking,error:monitorError,refresh}=monitor;
 const [files,setFiles]=useState<LocalFile[]>([]),[sending,setSending]=useState(false),[error,setError]=useState(''),[retrying,setRetrying]=useState('');
 const input=useRef<HTMLInputElement>(null);
 function select(list:FileList|null){if(!list)return;const selection=Array.from(list).map(file=>{const error=pdfProblem(file);return {id:crypto.randomUUID(),file,state:error?'failed' as const:'waiting' as const,error}});setFiles(previous=>[...previous,...selection]);if(input.current)input.current.value='';}
 async function upload(retryId?:string){setSending(true);const selected=files.filter(f=>retryId?f.id===retryId:f.state==='waiting');for(const item of selected){if(pdfProblem(item.file))continue;setFiles(items=>items.map(f=>f.id===item.id?{...f,state:'uploading',error:''}:f));try{const form=new FormData();form.set('file',item.file);const response=await fetch('/api/imports',{method:'POST',body:form});const body=await response.json();if(!response.ok)throw Error(body.error||'Não foi possível enviar o PDF.');setRows(body.imports);setFiles(items=>items.map(f=>f.id===item.id?{...f,state:body.duplicate?'duplicate':'sent'}:f));}catch(e){setFiles(items=>items.map(f=>f.id===item.id?{...f,state:'failed',error:(e as Error).message}:f));}}setSending(false);void refresh();}
 async function retry(id:string){setRetrying(id);try{const response=await fetch('/api/imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({importId:id})});const body=await response.json();if(!response.ok)throw Error(body.error);setRows(body.imports);setError('')}catch(e){setError((e as Error).message)}finally{setRetrying('')}}
 const waiting=files.filter(f=>f.state==='waiting').length,done=files.filter(f=>['sent','duplicate','failed'].includes(f.state)).length;
 return <section className="pdf-importer" aria-label="Importação de PDFs">
 <button className="upload-zone" disabled={!enabled||sending} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(enabled&&!sending)select(e.dataTransfer.files)}}><Upload size={26}/><strong>Selecionar ou arrastar currículos em PDF</strong><span>Vários arquivos · até 2 MB por PDF · arquivos privados</span></button>
 <input ref={input} type="file" hidden multiple accept="application/pdf,.pdf" onChange={e=>select(e.target.files)}/>
 <p className="import-help">Mantenha esta página aberta durante o envio. Depois que cada arquivo aparecer no histórico como em processamento, você pode sair. A leitura continua no Claude. A Talentia atualiza a base automaticamente enquanto você usa o aplicativo e ao voltar para ele. Pode levar até 24 horas.</p>
 {files.length>0&&<><div aria-live="polite">{done} de {files.length} arquivos enviados ou verificados</div><progress max={files.length} value={done} aria-label="Progresso do envio"/><ul className="import-list">{files.map(item=><li key={item.id}><div><strong>{item.file.name}</strong><span>{({waiting:'Aguardando envio',uploading:'Enviando…',sent:'Enviado para leitura',duplicate:'PDF já cadastrado ou na fila',failed:'Precisa de atenção'})[item.state]}</span>{item.error&&<small>{item.error}</small>}</div>{item.state==='failed'&&!pdfProblem(item.file)&&<Button variant="outline" disabled={sending} onClick={()=>void upload(item.id)}>Tentar enviar novamente</Button>}</li>)}</ul><Button className="primary-button" disabled={!waiting||sending||!enabled} onClick={()=>void upload()}>{sending?<LoaderCircle className="spin" size={16}/>:<Upload size={16}/>}Enviar {waiting||''} PDF{waiting===1?'':'s'}</Button>{!sending&&<Button variant="ghost" onClick={()=>setFiles([])}>Limpar seleção</Button>}</>}
 <div className="import-history-title"><strong>Histórico recente</strong><Button variant="outline" disabled={checking||!enabled} onClick={()=>void refresh()}><RefreshCw size={15} className={checking?'spin':''}/>Atualizar</Button></div>
 {(error||monitorError)&&<p role="alert" className="import-error">{error||monitorError}</p>}
 <ul className="import-list">{rows.map(row=><li key={row.id}><div><strong>{row.source}</strong><span>{importLabels[row.status]}</span>{row.checked_at&&<small>Última consulta: {new Date(row.checked_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília)</small>}{row.error&&<small>{row.error}</small>}</div>{row.status==='failed'&&<Button variant="outline" disabled={!!retrying||sending} onClick={()=>void retry(row.id)}>{retrying===row.id?'Enviando…':'Tentar leitura novamente'}</Button>}</li>)}</ul>
 {!rows.length&&!checking&&<p className="import-help">Os PDFs enviados aparecerão aqui. O histórico mostra as 100 importações mais recentes.</p>}
 </section>;
}
