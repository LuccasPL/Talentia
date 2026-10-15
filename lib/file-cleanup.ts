import 'server-only';
import {database} from './server';

// Removes PDFs queued in pending_file_deletions (by erasure or by the daily retention job) from the private
// bucket, using the owner's session. Returns how many are still pending, or -1 if the queue could not be read.
export async function sweepFiles(id:string){
 const db=await database();
 const pending=await db.from('pending_file_deletions').select('file_key').eq('owner',id).limit(100);
 if(pending.error)return -1;
 const keys=pending.data.map(r=>r.file_key as string).filter(k=>k.startsWith(`${id}/`));
 if(!keys.length)return 0;
 const removed=await db.storage.from('curriculos').remove(keys);
 if(removed.error)return keys.length;
 // Files already gone are also safe to dequeue.
 await db.from('pending_file_deletions').delete().eq('owner',id).in('file_key',keys);
 return 0;
}
