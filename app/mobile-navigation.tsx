'use client';
import {CalendarDays,LayoutDashboard,Menu,Users} from 'lucide-react';
import {useSidebar} from '@/components/ui/sidebar';
export default function MobileNavigation({view,onNavigate}:{view:string;onNavigate:(view:string)=>void}){
 const {setOpenMobile,openMobile}=useSidebar();
 const links=[{id:'overview',label:'Início',icon:LayoutDashboard},{id:'candidates',label:'Talentos',icon:Users},{id:'agenda',label:'Agenda',icon:CalendarDays}];
 return <nav className="mobile-workspace-nav" aria-label="Atalhos principais"><div>{links.map(link=><button key={link.id} type="button" aria-current={view===link.id?'page':undefined} onClick={()=>{setOpenMobile(false);onNavigate(link.id)}}><link.icon size={20}/><span>{link.label}</span></button>)}<button type="button" aria-label="Abrir menu completo" aria-expanded={openMobile} onClick={()=>setOpenMobile(true)}><Menu size={20}/><span>Menu</span></button></div></nav>;
}
