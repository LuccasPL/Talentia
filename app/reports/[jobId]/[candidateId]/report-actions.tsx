 'use client';
import {Printer,ArrowLeft} from 'lucide-react';
import Link from 'next/link';
export default function ReportActions(){return <div className="print-toolbar"><Link href="/"><ArrowLeft size={16}/>Voltar à Talentia</Link><button onClick={()=>window.print()}><Printer size={17}/>Imprimir ou salvar em PDF</button><p>Na janela de impressão, escolha “Salvar como PDF”. Revise o conteúdo antes de compartilhar.</p></div>}
