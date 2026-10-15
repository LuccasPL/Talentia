import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {applicationAnswerSchema,safeFileName} from '@/lib/candidate-applications';
import {MAX_PDF_BYTES} from '@/lib/pdf-import';
import {checkOrigin,readJson,readForm,apiError,HttpError} from '@/lib/server';
export const maxDuration=60;
const token=z.string().regex(/^[a-f0-9]{64}$/);
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
const unavailable='Este link não está recebendo candidaturas. Ele pode ter expirado, sido cancelado ou atingido o limite de envios. Fale com a recrutadora.';
// Deliberately cookie-free: an application link never inherits the recruiter's session.
function anonymous(){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)throw new HttpError('Este serviço está indisponível.',503);
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function POST(request:Request){try{
 checkOrigin(request);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json'){
  const input=z.object({action:z.literal('view'),token}).parse(await readJson(request,1024));
  const {data,error}=await anonymous().rpc('access_application_link',{token:input.token});
  if(error)throw new HttpError('Não foi possível abrir o link. Tente novamente.',503);
  if(!data)throw new HttpError(unavailable,410);
  return Response.json(data,{headers});
 }
 const form=await readForm(request,MAX_PDF_BYTES+64*1024);
 const link=token.parse(form.get('token'));
 let raw:unknown;try{raw=JSON.parse(String(form.get('answer')||''))}catch{throw new HttpError('Confira os campos do formulário.')}
 const answer=applicationAnswerSchema.parse(raw);
 const file=form.get('file');
 if(!(file instanceof File)||!file.size||file.size>MAX_PDF_BYTES)throw new HttpError('Anexe seu currículo em PDF de até 2 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new HttpError('O arquivo não é um PDF válido.');
 const {data,error}=await anonymous().rpc('submit_application',{token:link,answer,file_name:safeFileName(file.name),file_base64:Buffer.from(bytes).toString('base64')});
 if(error)throw new HttpError('Não foi possível enviar. Confira os campos e o arquivo e tente novamente.',503);
 if(!data)throw new HttpError(unavailable,410);
 return Response.json({received:true},{headers});
}catch(e){return apiError(e)}}
