import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {configured,supabase} from '@/lib/supabase/server';
import {readData} from '@/lib/server';
import {presentationOptions} from '@/lib/client-presentation';
import PresentationBuilder from './presentation-builder';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Apresentação ao cliente | Talentia',robots:{index:false,follow:false}};
export default async function PresentationPage({params}:{params:Promise<{jobId:string}>}){
 if(!configured())redirect('/login');const {data:{user},error}=await (await supabase()).auth.getUser();if(error||!user)redirect('/login');
 const {jobId}=await params,data=await readData(user.id),job=data.jobs.find(j=>j.id===jobId);if(!job)notFound();
 if(!data.version)return <main className="auth-shell"><section className="auth-card"><h1>Recarregue seu espaço.</h1><Link href="/">Voltar à Talentia</Link></section></main>;
 return <PresentationBuilder jobId={job.id} title={job.title} client={data.clients?.find(c=>c.id===job.clientId)?.name||''} version={data.version} options={presentationOptions(data,job.id)}/>;
}
