import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {applicationAnswerSchema,safeFileName} from '@/lib/candidate-applications';
import {clientHash,clientIp,issueFormToken,checkFormToken,pdfRisks} from '@/lib/public-application-security';
import {MAX_PDF_BYTES} from '@/lib/pdf-import';
import {checkOrigin,readJson,readForm,apiError,HttpError} from '@/lib/server';
export const maxDuration=60;
const token=z.string().regex(/^[a-f0-9]{64}$/);
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
const unavailable='Este link não está recebendo candidaturas. Ele pode ter expirado, sido cancelado ou atingido o limite de envios. Fale com a recrutadora.';
// Values returned by the gateway RPCs. They never raise for user input, so attempt counters persist.
const failures:Record<string,[string,number]>={
 unavailable:[unavailable,410],
 rate:['Muitas tentativas a partir desta conexão. Aguarde uma hora e tente novamente.',429],
 invalid:['Confira os campos do formulário e tente novamente.',400],
 file:['O arquivo não é um PDF válido. Exporte o currículo em PDF e tente novamente.',400],
};
// Deliberately cookie-free: an application link never inherits the recruiter's session.
function gateway(request:Request){
 const secret=process.env.TALENTIA_PUBLIC_GATEWAY_SECRET;
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||!secret||secret.length<32)throw new HttpError('Este serviço está indisponível no momento. Tente novamente mais tarde.',503);
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return {db,secret,client:clientHash(secret,clientIp(request.headers))};
}
function outcome(data:unknown,error:unknown){
 if(error||!data||typeof data!=='object')throw new HttpError('Não foi possível concluir. Tente novamente em alguns instantes.',503);
 const code=(data as {error?:string}).error;
 if(code==='gateway'||code==='client'){console.error('Talentia application gateway rejected',code);throw new HttpError('Este serviço está indisponível no momento. Tente novamente mais tarde.',503);}
 if(code){const [message,status]=failures[code]||failures.invalid;throw new HttpError(message,status);}
 return data as Record<string,unknown>;
}
export async function POST(request:Request){try{
 checkOrigin(request);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json'){
  const input=z.object({action:z.literal('view'),token}).parse(await readJson(request,1024));
  const {db,secret,client}=gateway(request);
  const {data,error}=await db.rpc('application_view',{token:input.token,gateway_key:secret,client_hash:client});
  const view=outcome(data,error);
  return Response.json({...view,formToken:issueFormToken(secret,input.token,Date.now())},{headers});
 }
 const form=await readForm(request,MAX_PDF_BYTES+64*1024);
 const link=token.parse(form.get('token'));
 const {db,secret,client}=gateway(request);
 // Honeypot: the "website" field is invisible to people. Bots that fill it get a normal-looking reply and nothing is stored.
 if(String(form.get('website')||'').trim())return Response.json({received:true},{headers});
 const timing=checkFormToken(secret,link,String(form.get('formToken')||''),Date.now());
 if(timing==='fast')throw new HttpError('Revise seus dados com calma e envie novamente em alguns segundos.',400);
 if(timing!=='ok')throw new HttpError('A página ficou aberta por muito tempo. Recarregue o link e envie novamente.',410);
 let raw:unknown;try{raw=JSON.parse(String(form.get('answer')||''))}catch{throw new HttpError('Confira os campos do formulário.')}
 const answer=applicationAnswerSchema.parse(raw);
 const file=form.get('file');
 if(!(file instanceof File)||!file.size||file.size>MAX_PDF_BYTES)throw new HttpError('Anexe seu currículo em PDF de até 2 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new HttpError('O arquivo não é um PDF válido.');
 const risks=pdfRisks(bytes);
 if(risks.length)throw new HttpError(`Este PDF tem recursos que não aceitamos (${risks.join(', ')}). Exporte o currículo novamente como PDF simples, sem senha, e tente de novo.`,400);
 const {data,error}=await db.rpc('application_submit',{token:link,answer,file_name:safeFileName(file.name),file_base64:Buffer.from(bytes).toString('base64'),gateway_key:secret,client_hash:client});
 outcome(data,error);
 return Response.json({received:true},{headers});
}catch(e){return apiError(e)}}
