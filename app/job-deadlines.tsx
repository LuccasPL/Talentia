'use client';
import {useMemo,useState} from 'react';
import {CalendarDays,ChevronRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {Data} from '@/lib/domain';
import {jobDeadlines,type JobDeadlineState} from '@/lib/job-deadlines';

const labels:Record<JobDeadlineState,string>={atrasado:'Data ultrapassada',hoje:'Hoje',futuro:'Próximos','sem-prazo':'A confirmar'};
const filters=['all','atrasado','hoje','futuro','sem-prazo'] as const;

export default function JobDeadlines({data,scope,now,onBriefing}:{data:Data;scope:string;now:number;onBriefing:(id:string)=>void}){
 const [filter,setFilter]=useState<(typeof filters)[number]>('all'),[page,setPage]=useState(1);
 const items=useMemo(()=>jobDeadlines(data,scope,now),[data,scope,now]);
 const filtered=items.filter(item=>filter==='all'||item.state===filter);
 const pages=Math.max(1,Math.ceil(filtered.length/8)),current=Math.min(page,pages);
 return <section className="panel job-deadlines" aria-labelledby="job-deadlines-title"><div className="job-deadlines-heading"><CalendarDays size={21} aria-hidden="true"/><div><h2 id="job-deadlines-title">Prazos de apresentação</h2><p className="muted">Datas registradas no briefing; confira o combinado com o cliente. Não indicam que a apresentação está pendente.</p></div></div><div className="job-deadline-filters" role="group" aria-label="Filtrar prazos de apresentação">{filters.map(value=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(1)}}><strong>{value==='all'?items.length:items.filter(item=>item.state===value).length}</strong><span>{value==='all'?'Todas':labels[value]}</span></button>)}</div><p className="job-deadline-count" role="status">{filtered.length} {filtered.length===1?'vaga nesta seleção':'vagas nesta seleção'} · Datas de Brasília</p><div className="job-deadline-list">{filtered.slice((current-1)*8,current*8).map(item=><article className="job-deadline-item" key={item.job.id}><div><h3>{item.job.title}</h3>{item.clientName&&<p>{item.clientName}</p>}<div className="job-deadline-tags"><span className={`tag job-deadline-${item.state}`}>{labels[item.state]}{item.date&&<> · <time dateTime={item.date}>{item.date.split('-').reverse().join('/')}</time></>}</span>{item.job.lifecycle?.state==='pausada'&&<span className="tag job-deadline-paused">Vaga pausada</span>}</div>{item.state==='sem-prazo'&&<small>{item.invalidDate?'Data a revisar no briefing.':'Prazo a confirmar com o cliente.'}</small>}</div><Button variant="outline" onClick={()=>onBriefing(item.job.id)}>Conferir briefing<ChevronRight size={15} aria-hidden="true"/></Button></article>)}</div>{!filtered.length&&<p className="job-deadline-empty">{items.length?'Nenhuma vaga nesta faixa de prazo. Escolha outro filtro para consultar as demais.':'Nenhuma vaga em andamento nesta seleção. Vagas preenchidas e canceladas ficam fora desta lista.'}</p>}{pages>1&&<nav className="candidate-pagination" aria-label="Páginas dos prazos de apresentação"><span>Página {current} de {pages}</span><div><Button variant="outline" disabled={current===1} onClick={()=>setPage(current-1)}>Anterior</Button><Button variant="outline" disabled={current===pages} onClick={()=>setPage(current+1)}>Próxima</Button></div></nav>}</section>;
}
