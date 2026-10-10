'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Candidate} from '@/lib/domain';
import type {ImportRow} from '@/lib/pdf-import';
import {singleImportCheck} from '@/lib/import-monitor';

export function usePdfImports(enabled:boolean,onCandidates:(c:Candidate[])=>void){
 const [rows,setRows]=useState<ImportRow[]>([]),[checking,setChecking]=useState(false),[error,setError]=useState('');
 const callback=useRef(onCandidates);
 useEffect(()=>{callback.current=onCandidates},[onCandidates]);
 const check=useRef<ReturnType<typeof singleImportCheck<void>>|null>(null);
 useEffect(()=>{check.current=singleImportCheck(async()=>{
  setChecking(true);
  try{
   const response=await fetch('/api/imports',{method:'PATCH',cache:'no-store',signal:AbortSignal.timeout(120000)});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Não foi possível atualizar as importações.');
   setRows(body.imports);
   if(body.data)callback.current(body.data.candidates);
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível conferir os PDFs.');}
  finally{setChecking(false)}
 });return()=>{check.current=null};},[]);
 const refresh=useCallback(async()=>{if(enabled)await check.current?.()},[enabled]);
 useEffect(()=>{
  if(!enabled)return;
  void refresh();
  const timer=setInterval(()=>void refresh(),30000);
  const resume=()=>{if(document.visibilityState==='visible')void refresh()};
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('focus',resume);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume)};
 },[enabled,refresh]);
 return {rows,setRows,checking,error,refresh};
}
export type ImportMonitor=ReturnType<typeof usePdfImports>;
