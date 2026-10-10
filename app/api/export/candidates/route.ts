import {owner,database,checkOrigin,apiError,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import {candidateCsv,type ExportCandidate} from '@/lib/candidate-export';
export async function POST(request:Request){try{
 checkOrigin(request);const id=await owner();await enforceRateLimit('export');const db=await database(),candidates:ExportCandidate[]=[];
 // Select only exportable fields. CV text, reports and private file paths never enter this response.
 for(let offset=0;;offset+=500){
  const {data,error}=await db.from('candidates').select('id,name,role,city,phone:payload->>phone,email:payload->>email,source:payload->>source,updated:payload->>updated,verification:payload->verification,archived:payload->>mergedInto').eq('owner',id).order('id').range(offset,offset+499);
  if(error)throw new HttpError('Não foi possível exportar os candidatos. Tente novamente.',503);
  candidates.push(...data as unknown as ExportCandidate[]);if(data.length<500)break;
  if(candidates.length>=10000)throw new HttpError('A base é grande demais para uma exportação única. Solicite uma exportação dividida.',413);
 }
 const csv=candidateCsv(candidates);if(Buffer.byteLength(csv,'utf8')>4*1024*1024)throw new HttpError('O arquivo é grande demais para uma exportação única. Solicite uma exportação dividida.',413);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="talentia-candidatos-${day}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Talentia-Export-Count':String(candidates.filter(c=>!c.archived).length)}});
}catch(e){return apiError(e)}}
