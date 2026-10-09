import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {supabase,configured} from '@/lib/supabase/server';
import {readData} from '@/lib/server';
import {reportSections} from '@/lib/report-presentation';
import {brazilDate} from '@/lib/pt-br';
import ReportActions from './report-actions';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Parecer | Talentia',robots:{index:false,follow:false}};
export default async function ReportPage({params}:{params:Promise<{jobId:string;candidateId:string}>}){
 if(!configured())redirect('/login');
 const {data:{user},error}=await (await supabase()).auth.getUser();
 if(error||!user)redirect('/login');
 const {jobId,candidateId}=await params;
 const data=await readData(user.id);
 const job=data.jobs.find(j=>j.id===jobId),candidate=data.candidates.find(c=>c.id===candidateId),record=data.records.find(r=>r.jobId===jobId&&r.candidateId===candidateId);
 if(!job||!candidate||!record?.report.trim())notFound();
 if(record.reportNeedsReview)return <main className="auth-shell"><section className="auth-card"><h1>Este parecer precisa de revisão.</h1><p>O cadastro ou os registros da entrevista foram atualizados. Abra a aba Parecer, revise o texto e salve novamente antes de imprimir.</p><Link href="/">Voltar à Talentia</Link></section></main>;
 const sections=reportSections(record.report);
 return <main className="print-shell"><ReportActions/><article className="print-document"><header className="print-header"><div className="print-brand">talentia<span>.</span></div><span className="print-document-type">PARECER DE RECRUTAMENTO</span></header><section className="print-identity"><span className="eyebrow">{job.title}</span><h1>{candidate.name}</h1><p>{candidate.role}</p><div className="print-meta"><span>Localização informada: {candidate.city||'A confirmar'}</span><span>Emitido em {brazilDate(new Date().toISOString())}</span></div></section><div className="print-review-note">Documento para revisão da recrutadora. Informações declaradas no currículo devem ser conferidas no processo seletivo.</div>{sections.map((section,i)=><section className="print-section" key={i}><h2><span>{String(i+1).padStart(2,'0')}</span>{section.title}</h2><div className="print-section-content">{section.content}</div></section>)}<footer className="print-footer"><span>Talentia · Feito para apoiar o seu olhar.</span><span>Uso restrito ao processo seletivo.</span></footer></article></main>;
}
