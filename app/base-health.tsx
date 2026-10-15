'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import type {Data} from '@/lib/domain';
import {baseHealth,filterHealth,healthMatches,healthFilters,type HealthFilter} from '@/lib/base-health';
import {brazilDate} from '@/lib/pt-br';

export default function BaseHealth({data,jobId,disabled,onJob,onOpen,onResponses}:{data:Data;jobId:string;disabled:boolean;onJob:(id:string)=>void;onOpen:(id:string)=>void;onResponses:()=>void}){
 const [days,setDays]=useState(90),[now,setNow]=useState(()=>Date.now()),[query,setQuery]=useState(''),[city,setCity]=useState(''),[filter,setFilter]=useState<HealthFilter>('review'),[page,setPage]=useState(1);
 const rows=baseHealth(data,jobId,days,now),filtered=filterHealth(rows,filter,query,city),pages=Math.max(1,Math.ceil(filtered.length/25)),currentPage=Math.min(page,pages),job=data.jobs.find(j=>j.id===jobId);
 function clear(){setQuery('');setCity('');setFilter('review');setPage(1)}
 return <>
  <section className="panel health-toolbar">
   <div className="health-fields">
    <div><label className="field-label" htmlFor="health-job">Vaga para conferir bloqueios de contato</label><select id="health-job" className="text-input" disabled={disabled} value={jobId} onChange={e=>{onJob(e.target.value);setPage(1)}}>{data.jobs.map(j=><option key={j.id} value={j.id}>{j.title}</option>)}</select></div>
    <div><label className="field-label" htmlFor="health-days">Revisar registros com</label><select id="health-days" className="text-input" value={days} onChange={e=>{setDays(Number(e.target.value));setPage(1)}}>{[30,90,180].map(n=><option key={n} value={n}>{n} dias ou mais</option>)}</select></div>
   </div>
   <p className="muted">A base inteira é considerada. A vaga define apenas o bloqueio “Não contatar”. Datas de importação e edição do currículo não confirmam os dados. A ordem começa pelos perfis sem registro, depois pelos registros mais antigos; não indica aderência à vaga.</p>
   <div className="health-summary">{(['review','missing','never','old','declaration','blocked','inactive'] as const).map(key=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>{setFilter(key);setPage(1)}}><strong>{rows.filter(r=>healthMatches(r,key)).length}</strong><span>{healthFilters[key]}</span></button>)}</div>
   <p className="muted">As categorias podem se sobrepor. Contatos bloqueados ficam fora dos filtros de revisão e declaração recente.</p>
   <div className="health-fields health-search">
    <div><label className="field-label" htmlFor="health-query">Nome ou função</label><input id="health-query" className="text-input" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></div>
    <div><label className="field-label" htmlFor="health-city">Cidade informada</label><input id="health-city" className="text-input" value={city} onChange={e=>{setCity(e.target.value);setPage(1)}}/></div>
    <div><label className="field-label" htmlFor="health-filter">Situação dos dados</label><select id="health-filter" className="text-input" value={filter} onChange={e=>{setFilter(e.target.value as HealthFilter);setPage(1)}}>{Object.entries(healthFilters).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
   </div>
   <div className="report-actions"><Button variant="ghost" onClick={clear}>Limpar filtros</Button><Button variant="outline" onClick={()=>setNow(Date.now())}>Recalcular prazos</Button><Button variant="outline" onClick={onResponses}>Ver respostas recebidas</Button></div>
   <p className="muted" role="status">{filtered.length} de {rows.length} perfis · Referência: {brazilDate(new Date(now).toISOString(),true)} (Brasília)</p>
  </section>
  <div className="health-list">{filtered.slice((currentPage-1)*25,currentPage*25).map(row=><article className="panel health-card" key={row.candidate.id}>
   <div><h2>{row.candidate.name}</h2><p className="muted">{row.candidate.role||'Função a confirmar'} · {row.candidate.city||'Cidade não informada'}</p>
    <p className="health-date">{row.lastSignal?`Última confirmação ou declaração: ${brazilDate(row.lastSignal)}${row.old?' · registro antigo':''}`:'Sem confirmação ou declaração válida registrada'}</p>{row.inactive&&<p className="health-retention">Sem atividade há mais de 24 meses. Confirme se a pessoa ainda quer participar de processos ou exclua os dados na aba Dados do perfil.</p>}
    <ul className="health-reasons">{row.missing.map(reason=><li key={reason}>{reason}</li>)}{row.pending.length>0&&<li>Sem confirmação nos últimos {days} dias: {row.pending.join(', ')}</li>}{row.recentDeclaration&&<li>Declaração recente incorporada pelo link; não comprova identidade ou titularidade dos contatos.</li>}{!row.needsReview&&<li>Dados presentes com confirmações recentes. Não confirma interesse ou disponibilidade para esta vaga.</li>}{row.blocked&&<li>Não contatar em {job?.title}. Confira o registro antes de qualquer novo contato.</li>}</ul>
   </div><div className="health-actions"><Button variant="outline" disabled={disabled} onClick={()=>onOpen(row.candidate.id)}>Revisar dados no perfil</Button><small>Edite ou registre confirmações na aba Dados. Para contatos permitidos, o perfil também oferece o link de atualização sem cadastro.</small></div>
  </article>)}</div>
  {!filtered.length&&<section className="panel empty-panel"><h2>Nenhum perfil nesta combinação.</h2><p>Experimente outro filtro ou prazo de revisão.</p><Button variant="outline" onClick={clear}>Limpar filtros</Button></section>}
  {filtered.length>25&&<div className="health-pagination"><Button variant="outline" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Anterior</Button><span>Página {currentPage} de {pages}</span><Button variant="outline" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Próxima</Button></div>}
  <p className="muted pipeline-footnote">Esta visão apenas organiza registros existentes. Nenhum contato é feito, nenhum dado é alterado e nenhuma chamada de IA é consumida.</p>
 </>;
}
