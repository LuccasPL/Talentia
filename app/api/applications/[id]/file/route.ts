import {owner,database,apiError,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
// Lets the owner read a pending application's PDF before deciding. Reviewed applications no longer keep the file here.
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 await owner();await enforceRateLimit('read');const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError('Arquivo não encontrado.',404);
 const {data,error}=await (await database()).rpc('application_file',{application_id:id});
 if(error)throw new HttpError('Não foi possível consultar o arquivo.',503);
 if(typeof data!=='string')throw new HttpError('Arquivo não encontrado. A candidatura pode já ter sido revisada.',404);
 const bytes=Buffer.from(data,'base64');
 if(bytes.subarray(0,5).toString('latin1')!=='%PDF-')throw new HttpError('Arquivo não encontrado.',404);
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="candidatura.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return apiError(e)}}
