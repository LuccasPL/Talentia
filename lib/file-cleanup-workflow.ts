export type FileCleanupResult=
 | {status:'complete';pending:0}
 | {status:'pending';pending:number}
 | {status:'unverified';pending:null};

type Operation={error:unknown};
export type FileCleanupStore={
 list:(owner:string,limit:number)=>Promise<{keys:string[]|null;error:unknown}>;
 remove:(keys:string[])=>Promise<Operation>;
 dequeue:(owner:string,keys:string[])=>Promise<Operation>;
 count:(owner:string)=>Promise<{count:number|null;error:unknown}>;
};
const unverified:FileCleanupResult={status:'unverified',pending:null};

// Bounded work per request; count the whole queue afterwards, not just this batch.
// A failed operation never turns into a claim that all files have been removed.
export async function sweepFileQueue(owner:string,store:FileCleanupStore):Promise<FileCleanupResult>{
 try{
  if(!owner)return unverified;
  const listed=await store.list(owner,100);
  if(listed.error||!listed.keys)return unverified;
  if(listed.keys.some(key=>typeof key!=='string'||!key.startsWith(`${owner}/`)||key.length<=owner.length+1))return unverified;
  const keys=[...new Set(listed.keys)];
  if(keys.length){
   const removed=await store.remove(keys);
   if(removed.error)return unverified;
   // Dequeue only after the storage provider confirms success. Missing objects are idempotent.
   const dequeued=await store.dequeue(owner,keys);
   if(dequeued.error)return unverified;
  }
  const remaining=await store.count(owner);
  if(remaining.error||remaining.count===null||!Number.isSafeInteger(remaining.count)||remaining.count<0)return unverified;
  return remaining.count===0?{status:'complete',pending:0}:{status:'pending',pending:remaining.count};
 }catch{return unverified;}
}

export function fileCleanupWarning(result:FileCleanupResult){
 if(result.status==='complete')return '';
 if(result.status==='unverified')return 'Os dados do perfil foram excluídos, mas não foi possível confirmar a limpeza dos PDFs no armazenamento. A limpeza será tentada novamente ao abrir o espaço; se o aviso persistir, solicite suporte.';
 return `Ainda há ${result.pending} arquivo(s) na fila de limpeza desta conta. A limpeza continuará nos próximos acessos ao espaço.`;
}

export function fileCleanupRetryResponse(result:FileCleanupResult){
 const headers={'Cache-Control':'no-store'};
 if(result.status==='unverified')return Response.json({pending:null,complete:false,error:'Não foi possível confirmar a limpeza dos arquivos. Tente novamente.'},{status:503,headers});
 return Response.json({pending:result.pending,complete:result.status==='complete'},{headers});
}
