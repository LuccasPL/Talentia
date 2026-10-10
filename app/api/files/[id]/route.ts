import {supabase} from '@/lib/supabase/server';
import {owner,apiError,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import type {Candidate} from '@/lib/domain';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await owner();await enforceRateLimit('read');const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError('Arquivo não encontrado.',404);
 const db=await supabase();
 const lookup=async(candidateId:string)=>{const {data,error}=await db.from('candidates').select('payload').eq('owner',user).eq('id',candidateId).maybeSingle();if(error)throw new HttpError('Não foi possível consultar o arquivo.',503);return data?.payload as Candidate|undefined;};
 const found=await lookup(id);
 const candidate=found?.cvSourceId&&new URL(request.url).searchParams.get('original')!=='1'?await lookup(found.cvSourceId):found;
 if(!candidate?.fileKey?.startsWith(`${user}/`))throw new HttpError('Arquivo não encontrado.',404);
 const {data:object,error}=await db.storage.from('curriculos').download(candidate.fileKey);
 if(error||!object)throw new HttpError('Arquivo não encontrado.',404);
 return new Response(object,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="curriculo.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return apiError(e)}}
