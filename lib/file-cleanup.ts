import 'server-only';
import {database} from './server';
import {sweepFileQueue,type FileCleanupResult} from './file-cleanup-workflow';

// Removes PDFs queued in pending_file_deletions (by erasure or by the daily retention job) from the private
// bucket, using the owner's session. Unknown state is explicit, never a zero count.
export async function sweepFiles(id:string):Promise<FileCleanupResult>{
 try{
  const db=await database();
  return await sweepFileQueue(id,{
   async list(owner,limit){
    const result=await db.from('pending_file_deletions').select('file_key').eq('owner',owner).order('created_at').order('file_key').limit(limit);
    return {keys:result.data?.map(row=>row.file_key as string)??null,error:result.error};
   },
   async remove(keys){return db.storage.from('curriculos').remove(keys);},
   async dequeue(owner,keys){return db.from('pending_file_deletions').delete().eq('owner',owner).in('file_key',keys);},
   async count(owner){return db.from('pending_file_deletions').select('file_key',{count:'exact',head:true}).eq('owner',owner);},
  });
 }catch{return {status:'unverified',pending:null};}
}
