import {owner,database,apiError,HttpError,aiConfigured} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import {usageSnapshotSchema} from '@/lib/usage-status';
export async function GET(){try{
 const id=await owner();await enforceRateLimit('read');
 const {data,error}=await(await database()).rpc('api_usage_snapshot');
 if(error)throw new HttpError('Não foi possível consultar o uso. Tente novamente.',503);
 const parsed=usageSnapshotSchema.safeParse(data);if(!parsed.success)throw new HttpError('Não foi possível conferir o uso. Tente novamente.',503);
 return Response.json({...parsed.data,aiEnabled:aiConfigured(id)},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e)}}
