import {createRoot} from 'react-dom/client';
import ApplicationPage from '../../app/candidatura/page';
import '../../app/globals.css';
// Test-only entrypoint for the public application page; APIs are simulated by the Playwright fixture or the preview mock below.
const params=new URLSearchParams(window.location.search);
if(params.get('mock')==='1'){
 const original=window.fetch.bind(window);
 // Local design preview only (never in Playwright): a fictitious vacancy with long conditions.
 window.fetch=async(input,init)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;if(url.endsWith('/api/public/applications')){await new Promise(r=>setTimeout(r,300));if(init?.body instanceof FormData)return Response.json({received:true});return Response.json({context:{title:'Atendimento · Loja conceito na Avenida Paulista',recruiter:'Recrutadora Fictícia',conditions:{location:'São Paulo, SP — Avenida Paulista',workMode:'Presencial',salary:'R$ 2.800 + comissão',schedule:'Escala 6x1, das 10h às 18h',benefits:'Vale-refeição, vale-transporte e plano de saúde',start:''}},expiresAt:'2026-10-29T12:00:00Z'});}return original(input,init)};
}
createRoot(document.getElementById('root')!).render(<ApplicationPage/>);
