import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {refreshResponseSchema} from '@/lib/candidate-refresh';
import {checkOrigin,readJson,apiError,HttpError} from '@/lib/server';
export async function POST(request:Request){try{
 checkOrigin(request);
 const input=z.discriminatedUnion('action',[z.object({action:z.literal('view'),token:z.string().regex(/^[a-f0-9]{64}$/)}),z.object({action:z.literal('submit'),token:z.string().regex(/^[a-f0-9]{64}$/),answer:refreshResponseSchema})]).parse(await readJson(request,12000));
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)throw new HttpError('Este serviço está indisponível.',503);
 // Deliberately cookie-free: a candidate link never inherits the recruiter's session.
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await db.rpc('access_candidate_refresh',{token:input.token,answer:input.action==='submit'?input.answer:null});
 if(error)throw new HttpError('Não foi possível concluir. Confira os campos ou tente novamente.',503);
 if(data&&typeof data==='object'&&(data as {error?:string}).error==='invalid')throw new HttpError('Confira os campos e tente novamente.',400);
 if(!data)throw new HttpError('Este link não está disponível. Ele pode ter expirado, sido cancelado ou já ter recebido uma resposta. Peça um novo link à recrutadora.',410);
 return Response.json(data,{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
 }catch(e){return apiError(e)}}
