import {owner,database,apiError,HttpError,aiConfigured} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
import {usageSnapshotSchema} from '@/lib/usage-status';
import {aiUsageSummarySchema} from '@/lib/ai-usage';
export async function GET(){try{
 const id=await owner();await enforceRateLimit('read');
 const db=await database();const {data,error}=await db.rpc('api_usage_snapshot');
 if(error)throw new HttpError('Não foi possível consultar o uso. Tente novamente.',503);
 const parsed=usageSnapshotSchema.safeParse(data);if(!parsed.success)throw new HttpError('Não foi possível conferir o uso. Tente novamente.',503);
 const usage=await db.rpc('ai_usage_snapshot');
 const aiUsage=usage.error?{generatedAt:new Date().toISOString(),windowDays:30,entries:[]}:aiUsageSummarySchema.parse(usage.data);
 return Response.json({...parsed.data,aiEnabled:aiConfigured(id),aiUsage},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e)}}
