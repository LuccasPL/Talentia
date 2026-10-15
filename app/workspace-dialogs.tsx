'use client';
import {useState} from 'react';
import {Plus,LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import CandidateCreate from './candidate-create';
import PdfImporter from './pdf-importer';
import type {ImportMonitor} from './use-pdf-imports';
import type {Data} from '@/lib/domain';

// Typed values live here; this component stays mounted, so a draft survives closing the dialog (as before the extraction).
export function NewJobDialog({open,onOpenChange,onCreate}:{open:boolean;onOpenChange:(open:boolean)=>void;onCreate:(title:string)=>Promise<boolean>}){
 const [newTitle,setNewTitle]=useState('');
 async function createJob(){if(!newTitle.trim())return;if(await onCreate(newTitle.trim()))setNewTitle('')}
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Uma nova oportunidade</DialogTitle><DialogDescription>Os critérios e os pareceres ficarão vinculados a esta vaga.</DialogDescription></DialogHeader><label className="field-label" htmlFor="new-title">Nome da vaga</label><input id="new-title" className="text-input" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Ex.: Analista financeiro" onKeyDown={e=>{if(e.key==='Enter')void createJob()}}/><Button className="primary-button" disabled={!newTitle.trim()} onClick={createJob}>Criar vaga</Button></DialogContent></Dialog>;
}

export function AddCandidatesDialog({open,onOpenChange,busy,connected,aiConfigured,monitor,candidateIds,onCreated,onOpenImported,onAddText}:{open:boolean;onOpenChange:(open:boolean)=>void;busy:boolean;connected:boolean;aiConfigured:boolean;monitor:ImportMonitor;candidateIds:string[];onCreated:(data:Data)=>void;onOpenImported:(id:string)=>void;onAddText:(name:string,city:string,text:string)=>Promise<boolean>}){
 const [candidateName,setCandidateName]=useState(''),[candidateCity,setCandidateCity]=useState(''),[candidateText,setCandidateText]=useState('');
 async function importText(){if(await onAddText(candidateName,candidateCity,candidateText)){setCandidateName('');setCandidateCity('');setCandidateText('')}}
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="import-dialog"><DialogHeader><DialogTitle>Adicione à sua base de talentos</DialogTitle><DialogDescription>Cadastre sem currículo, importe PDFs ou cole o conteúdo.</DialogDescription></DialogHeader><CandidateCreate disabled={!connected||busy} onData={onCreated}/><div className="or-divider">ou importe currículos</div><PdfImporter enabled={connected&&aiConfigured} monitor={monitor} candidateIds={candidateIds} onOpen={onOpenImported}/><div className="or-divider">ou adicione por texto</div><div className="two-fields"><div><label htmlFor="candidate-name" className="field-label">Nome</label><input id="candidate-name" className="text-input" value={candidateName} onChange={e=>setCandidateName(e.target.value)}/></div><div><label htmlFor="candidate-city" className="field-label">Cidade informada</label><input id="candidate-city" className="text-input" value={candidateCity} onChange={e=>setCandidateCity(e.target.value)}/></div></div><label htmlFor="candidate-text" className="field-label">Conteúdo do currículo</label><textarea id="candidate-text" className="notes-input" rows={5} value={candidateText} onChange={e=>setCandidateText(e.target.value)} placeholder="Cole experiências, atividades e qualificações informadas no currículo."/><Button className="primary-button" disabled={busy} onClick={importText}>{busy?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}Adicionar candidato</Button></DialogContent></Dialog>;
}
