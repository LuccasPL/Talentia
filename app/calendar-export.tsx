'use client';
import {useRef,useState} from 'react';
import {Download,CalendarDays} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {calendarExport,weekExportItems} from '@/lib/calendar-export';
import {calendarWeek} from '@/lib/weekly-calendar';
import type {AgendaItem} from '@/lib/interview-agenda';
import {brazilDate} from '@/lib/pt-br';

export default function CalendarExport({items,anchor}:{items:AgendaItem[];anchor:string}){
 const [open,setOpen]=useState(false),[includeNames,setIncludeNames]=useState(false),[notice,setNotice]=useState('');const title=useRef<HTMLHeadingElement|null>(null);
 const days=calendarWeek(anchor);let count=0,error='';try{count=weekExportItems(items,anchor).length;}catch(e){error=e instanceof Error?e.message:'Revise os agendamentos antes de exportar.';}
 function download(){try{
  const result=calendarExport(items,anchor,{includeNames}),url=URL.createObjectURL(new Blob([result.content],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download=result.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(`${result.count} ${result.count===1?'entrevista incluída':'entrevistas incluídas'} no arquivo de calendário.`);
 }catch(e){setNotice(e instanceof Error?e.message:'Não foi possível preparar o arquivo.');}}
 return <><Button variant="outline" onClick={()=>{setNotice('');setIncludeNames(false);setOpen(true)}}><Download size={16}/>Exportar semana (.ics)</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="calendar-export-dialog" onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus({preventScroll:true});}}><DialogHeader><DialogTitle ref={title} tabIndex={-1} className="outline-none">Leve sua agenda com você</DialogTitle><DialogDescription>Baixe uma cópia dos encontros desta semana para importar no seu calendário.</DialogDescription></DialogHeader>
  <div className="calendar-export-range"><CalendarDays size={20}/><div><strong>{brazilDate(`${days[0]}T12:00:00Z`)} — {brazilDate(`${days[6]}T12:00:00Z`)}</strong><p>{count} {count===1?'entrevista confirmada ou a confirmar':'entrevistas confirmadas ou a confirmar'} com os filtros atuais</p></div></div>
  <p>O arquivo inclui vaga, horário, duração, formato e local ou acesso informado. Entrevistas realizadas e canceladas ficam de fora.</p>
  <label className="calendar-export-option"><input type="checkbox" checked={includeNames} onChange={e=>{setIncludeNames(e.target.checked);setNotice('')}}/><span>Incluir nomes dos candidatos<small>Respostas, pareceres e observações da entrevista não são incluídos.</small></span></label>
  <div className="notice"><p>Importe em um calendário privado. Os horários aparecerão no fuso configurado nele. A cópia não se atualiza automaticamente; ao reagendar ou cancelar, ajuste também seu calendário para evitar horários antigos ou duplicados.</p></div>
  {error&&<p role="alert">{error}</p>}{!error&&!count&&<p role="status">Navegue para outra semana ou ajuste os filtros da agenda para exportar encontros.</p>}
  <Button className="primary-button" disabled={!!error||!count} onClick={download}><Download size={16}/>Baixar arquivo de calendário</Button><p role="status" aria-live="polite" className="calendar-export-notice">{notice}</p>
 </DialogContent></Dialog></>;
}
