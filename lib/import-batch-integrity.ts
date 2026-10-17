import {createHmac,timingSafeEqual} from 'node:crypto';

// Server-side proof: identical serialization to the original import signature.
export type BatchProof={owner:string;id:string;file_key:string;candidate_id:string;batch_id:string|null;batch_signature?:string|null};
export function batchSignature(row:Pick<BatchProof,'owner'|'id'|'file_key'|'candidate_id'>,batch:string,secret:string){
 return createHmac('sha256',secret).update(JSON.stringify([row.owner,row.id,row.file_key,row.candidate_id,batch])).digest('hex');
}
export function verifiedBatch(owner:string,row:BatchProof,secret:string):boolean{
 if(!secret||!owner||row.owner!==owner||typeof row.file_key!=='string'||!row.file_key.startsWith(`${owner}/`)
  ||!row.batch_id||!/^msgbatch_[a-zA-Z0-9]+$/.test(row.batch_id)
  ||typeof row.batch_signature!=='string'||!/^[a-f0-9]{64}$/.test(row.batch_signature))return false;
 const expected=batchSignature(row,row.batch_id,secret);
 return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(row.batch_signature,'hex'));
}

// A database-returned ID alone must never authorize a destructive provider request.
// Proofs are captured before the erase transaction removes the import rows; only IDs
// actually returned by that transaction and present in this verified snapshot may be deleted.
export async function deleteVerifiedBatches(owner:string,ids:string[],proofs:BatchProof[],secret:string,remove:(id:string)=>Promise<unknown>){
 const allowed=new Set(proofs.filter(row=>verifiedBatch(owner,row,secret)).map(row=>row.batch_id));
 let failed=0;
 for(const id of new Set(ids)){
  if(!allowed.has(id)){failed++;continue;}
  try{await remove(id)}catch{failed++;}
 }
 return failed;
}
