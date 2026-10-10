import 'server-only';
import {supabase} from './supabase/server';
import {HttpError,rateLimitOutcome} from './http-security';
export type RateBucket='read'|'write'|'imports-read'|'imports-sync'|'upload'|'ai-request'|'ai-call'|'export';
export async function enforceRateLimit(bucket:RateBucket){
 const {data,error}=await(await supabase()).rpc('consume_api_limit',{bucket_name:bucket});
 if(error)throw new HttpError('Não foi possível verificar o limite de uso. Tente novamente.',503);
 rateLimitOutcome(data);
}
