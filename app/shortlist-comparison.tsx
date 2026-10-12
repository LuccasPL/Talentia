'use client';
import {useState} from 'react';
import {Columns3} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {kindLabels,priorityLabels,type Job} from '@/lib/domain';
import type {ShortlistItem} from '@/lib/candidate-shortlist';
import {filterShortlist} from '@/lib/candidate-shortlist';
import {comparisonItems,criterionComparison} from '@/lib/shortlist-comparison';
import {contactStatusLabels} from '@/lib/contact-board';

export default function ShortlistComparison({job,items,onOpen}:{job:Job;items:ShortlistItem[];onOpen:(id:string,tab:string)=>void}) {
  const [ids,setIds]=useState<string[]>([]),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[page,setPage]=useState(1);
  const selected=ids.filter(id=>items.some(i=>i.candidate.id===id&&i.record.shortlisted&&!i.candidate.mergedInto));
  const compared=selected.length>=2?comparisonItems(job,items,selected):[];
  const options=filterShortlist(items,query,'all'),pages=Math.max(1,Math.ceil(options.length/24)),current=Math.min(page,pages);
  function toggle(id:string) {setIds(selected.includes(id)?selected.filter(i=>i!==id):[...selected,id].slice(0,3));}
  return <section className="panel comparison-picker">
    <div className="section-header"><div><h2>Compare os perfis lado a lado</h2><p className="muted">Escolha de dois a três candidatos desta lista. A comparação usa os registros já salvos, sem uma nova análise de IA.</p></div><Columns3 size={22}/></div>
    {items.length>0&&<><label className="field-label" htmlFor="comparison-query">Encontrar perfil para comparação</label><input id="comparison-query" className="text-input" value={query} placeholder="Nome, cidade ou função…" onChange={e=>{setQuery(e.target.value);setPage(1)}}/></>}
    <div className="comparison-options">{options.slice((current-1)*24,current*24).map(item=><label key={item.candidate.id}><input type="checkbox" checked={selected.includes(item.candidate.id)} disabled={selected.length===3&&!selected.includes(item.candidate.id)} onChange={()=>toggle(item.candidate.id)}/><span>{item.candidate.name}</span></label>)}</div>
    {items.length>0&&!options.length&&<p className="muted">Nenhum perfil nesta busca. Tente outro nome, cidade ou função.</p>}
    {options.length>24&&<nav className="candidate-pagination" aria-label="Páginas dos perfis para comparação"><span>Página {current} de {pages}</span><div><Button variant="outline" disabled={current===1} onClick={()=>setPage(current-1)}>Anterior</Button><Button variant="outline" disabled={current===pages} onClick={()=>setPage(current+1)}>Próxima</Button></div></nav>}
    {selected.length>0&&<div className="comparison-selection" aria-label="Perfis escolhidos">{selected.map(id=><Button key={id} variant="outline" aria-label={`Retirar ${items.find(i=>i.candidate.id===id)?.candidate.name} da comparação`} onClick={()=>toggle(id)}>{items.find(i=>i.candidate.id===id)?.candidate.name} ×</Button>)}</div>}
    {!items.length&&<p className="muted">Adicione perfis à lista de interesse para comparar.</p>}
    <div className="comparison-picker-actions"><span role="status">{selected.length} de 3 perfis escolhidos</span>{selected.length>0&&<Button variant="ghost" onClick={()=>setIds([])}>Limpar seleção</Button>}<Button disabled={selected.length<2} onClick={()=>setOpen(true)}><Columns3 size={16}/>Comparar lado a lado</Button></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="comparison-dialog"><DialogHeader><DialogTitle>Comparação de candidatos</DialogTitle><DialogDescription>{job.title} · Evidências documentais e registros da recrutadora. A decisão continua sendo sua.</DialogDescription></DialogHeader>
      {compared.length<2?<p>Revise a seleção: um perfil não está mais na lista desta vaga.</p>:<><p className="muted">Trechos não comprovam aderência. Condições e características pessoais precisam de conversa. No celular, deslize a tabela para ver os outros perfis.</p><div className="comparison-scroll" role="region" aria-label="Tabela de comparação de candidatos" tabIndex={0}><table><caption className="sr-only">Comparação dos perfis escolhidos para {job.title}</caption><thead><tr><th scope="col">Pontos para revisão</th>{compared.map(i=><th scope="col" key={i.candidate.id}><strong>{i.candidate.name}</strong><small>{i.candidate.role||'Função a confirmar'}</small><Button variant="outline" onClick={()=>{setOpen(false);onOpen(i.candidate.id,'evidence')}}>Abrir perfil</Button></th>)}</tr></thead><tbody>
        {([{label:'Localização informada',get:(i:ShortlistItem)=>i.candidate.city||'Não informada'},{label:'Etapa na vaga',get:(i:ShortlistItem)=>contactStatusLabels[i.record.status]||i.record.status},{label:'Interesse registrado',get:(i:ShortlistItem)=>i.record.interest||'Não confirmado'},{label:'Disponibilidade registrada',get:(i:ShortlistItem)=>i.record.availability||'Não informada'},{label:'Parecer',get:(i:ShortlistItem)=>i.record.report.trim()?(i.record.reportNeedsReview?'Precisa de revisão':'Salvo'):'Ainda não registrado'}]).map(row=><tr key={row.label}><th scope="row">{row.label}</th>{compared.map(i=><td key={i.candidate.id}>{row.get(i)}</td>)}</tr>)}
        {job.criteria.map(criterion=><tr key={criterion.id}><th scope="row">{criterion.text}<small>{kindLabels[criterion.kind]} · {priorityLabels[criterion.priority]}</small></th>{compared.map(i=>{const cell=criterionComparison(i,criterion);return <td key={i.candidate.id}><span className={`comparison-status ${cell.found?'with-quote':''}`}>{cell.label}</span>{cell.quote&&<blockquote>{cell.quote}</blockquote>}{cell.explanation&&<p>{cell.explanation}</p>}{cell.question&&<details><summary>Pergunta para confirmar</summary><p>{cell.question}</p></details>}</td>})}</tr>)}
      </tbody></table></div>{!job.criteria.length&&<p className="muted">Esta vaga ainda não tem critérios revisados. A tabela mostra apenas os dados registrados.</p>}</>}
    </DialogContent></Dialog>
  </section>;
}
