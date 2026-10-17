'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Search,MapPin,FileText,LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import type {Candidate} from '@/lib/domain';
import type {CandidateSearchItem,CandidateSearchResult} from '@/lib/candidate-paged-search';
import {brazilDate} from '@/lib/pt-br';

export default function SearchPage(){
  const [query,setQuery]=useState(''),[city,setCity]=useState(''),[experience,setExperience]=useState('');
  const [sort,setSort]=useState<'name'|'imported'>('name'),[page,setPage]=useState(1);
  const [result,setResult]=useState<CandidateSearchResult|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [selected,setSelected]=useState<Candidate|null>(null),[opening,setOpening]=useState<string|null>(null),[profileError,setProfileError]=useState('');
  const [revision,setRevision]=useState(0);

  useEffect(()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);setError('');
      const params=new URLSearchParams({query,city,experience,page:String(page),sort});
      try{
        const response=await fetch(`/api/candidates/search?${params}`,{signal:controller.signal,cache:'no-store'});
        const body=await response.json();
        if(!response.ok)throw Error(body.error||'Não foi possível buscar candidatos.');
        setResult(body as CandidateSearchResult);
      }catch(cause){if(!controller.signal.aborted)setError((cause as Error).message)}
      finally{if(!controller.signal.aborted)setLoading(false)}
    },revision?0:400);
    return()=>{window.clearTimeout(timer);controller.abort()};
  },[query,city,experience,page,sort,revision]);

  function update(value:string,setter:(value:string)=>void){setter(value);setPage(1);setRevision(0)}
  function submit(event:React.FormEvent){event.preventDefault();setRevision(value=>value+1)}
  async function openProfile(item:CandidateSearchItem){
    if(opening)return;
    setOpening(item.id);setProfileError('');
    try{
      const response=await fetch(`/api/candidates/${encodeURIComponent(item.id)}`,{cache:'no-store'});
      const body=await response.json();
      if(!response.ok)throw Error(body.error||'Não foi possível abrir o perfil.');
      setSelected(body as Candidate);
    }catch(cause){setProfileError((cause as Error).message)}
    finally{setOpening(null)}
  }
  const pages=Math.max(1,Math.ceil((result?.total||0)/24));

  return <main className="quick-search-shell">
    <header className="quick-search-header"><Link href="/" className="quick-search-back"><ArrowLeft size={17}/>Voltar à Talentia</Link><span>Banco de talentos</span></header>
    <div className="quick-search-content"><div className="quick-search-heading"><span className="eyebrow">BUSCA NA BASE</span><h1>Encontre o perfil certo, sem percorrer todos os currículos.</h1><p>Pesquise nome, função, cidade e experiências. A Talentia consulta o banco e carrega apenas 24 perfis por página.</p></div>
    <form className="quick-search-form panel" onSubmit={submit} role="search">
      <div className="quick-search-main-field"><label className="field-label" htmlFor="quick-query">Nome ou palavras-chave</label><input id="quick-query" className="text-input" value={query} onChange={event=>update(event.target.value,setQuery)} maxLength={120} placeholder="Ex.: Ana varejo hospitalidade" autoComplete="off"/></div>
      <div><label className="field-label" htmlFor="quick-city">Cidade ou região</label><input id="quick-city" className="text-input" value={city} onChange={event=>update(event.target.value,setCity)} maxLength={80} placeholder="Ex.: São Paulo"/></div>
      <div><label className="field-label" htmlFor="quick-experience">Experiência mencionada</label><input id="quick-experience" className="text-input" value={experience} onChange={event=>update(event.target.value,setExperience)} maxLength={120} placeholder="Ex.: atendimento loja"/></div>
      <div className="quick-search-actions"><label className="field-label" htmlFor="quick-sort">Ordenar</label><select id="quick-sort" className="text-input" value={sort} onChange={event=>{setSort(event.target.value as 'name'|'imported');setPage(1)}}><option value="name">Nome, A–Z</option><option value="imported">Importados recentemente</option></select><Button type="submit" className="primary-button"><Search size={16}/>Buscar</Button></div>
    </form>
    <div className="quick-search-status" role="status" aria-live="polite">{loading?<><LoaderCircle className="spin" size={17}/>Buscando perfis…</>:error?error:`${result?.total||0} ${(result?.total||0)===1?'perfil encontrado':'perfis encontrados'}`}</div>
    {profileError&&<p className="quick-search-profile-error" role="alert">{profileError}</p>}
    {error&&<Button variant="outline" onClick={()=>setRevision(value=>value+1)}>Tentar novamente</Button>}
    {!error&&<div className="quick-search-grid">{result?.candidates.map(candidate=><article className="quick-search-card" key={candidate.id}><div className="quick-search-card-top"><div><h2>{candidate.name}</h2><p>{candidate.role||'Função não informada'}</p></div><span><MapPin size={14}/>{candidate.city||'Localização a confirmar'}</span></div><p className="quick-search-excerpt">{candidate.textPreview||'Experiências ainda não informadas.'}{candidate.textPreview?.length===210?'…':''}</p><div className="quick-search-card-bottom"><small>{candidate.updated?`Importado em ${brazilDate(candidate.updated)}`:'Data de importação não informada'}</small><Button variant="outline" disabled={opening!==null} onClick={()=>void openProfile(candidate)}>{opening===candidate.id?<><LoaderCircle size={15} className="spin"/>Abrindo…</>:'Ver perfil'}</Button></div></article>)}</div>}
    {!loading&&!error&&result?.total===0&&<p className="quick-search-empty">Nenhum perfil encontrado. Experimente menos palavras ou uma cidade mais ampla.</p>}
    {!error&&result&&result.total>24&&<nav className="quick-search-pagination" aria-label="Páginas dos candidatos"><span>Página {page} de {pages}</span><div><Button variant="outline" disabled={page<=1||loading} onClick={()=>setPage(value=>value-1)}>Anterior</Button><Button variant="outline" disabled={page>=pages||loading} onClick={()=>setPage(value=>value+1)}>Próxima</Button></div></nav>}
    <p className="quick-search-footnote">A busca encontra termos declarados no currículo. Experiência, disponibilidade e contatos precisam ser confirmados antes da recomendação.</p></div>
    <Sheet open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null)}}><SheetContent className="candidate-sheet">{selected&&<><SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.role||'Função não informada'} · {selected.city||'Localização a confirmar'}</SheetDescription></SheetHeader><div className="sheet-section"><h3>Contato informado</h3><p>{selected.phone||'Telefone não informado'} · {selected.email||'E-mail não informado'}</p><h3>Experiências declaradas</h3><pre className="source-text">{selected.text||'Experiências ainda não informadas.'}</pre>{selected.fileKey&&<a className="report-preview-link" href={`/api/files/${encodeURIComponent(selected.id)}`} target="_blank" rel="noreferrer"><FileText size={15}/>Abrir PDF privado</a>}<p className="muted">Para comparar com uma vaga e registrar contatos, volte ao espaço de recrutamento.</p></div></>}</SheetContent></Sheet>
  </main>;
}
