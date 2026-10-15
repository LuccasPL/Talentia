import {z} from 'zod';
import {normalize,type Candidate} from './domain.ts';
import type {JobConditions} from './candidate-refresh.ts';

// Public application form: declared by the candidate, never verified by the link itself.
export const applicationAnswerSchema=z.object({
 name:z.string().trim().min(2).max(200),
 email:z.union([z.literal(''),z.string().trim().email().max(300)]),
 phone:z.string().trim().max(100).refine(s=>!s||s.replace(/\D/g,'').length>=8,'Confira o telefone com DDD.'),
 city:z.string().trim().min(2).max(300),
 role:z.string().trim().max(300),
 message:z.string().trim().max(2000),
 consent:z.literal(true),
}).strict().refine(r=>Boolean(r.phone||r.email),'Informe pelo menos um meio de contato.');
export type ApplicationAnswer=z.infer<typeof applicationAnswerSchema>;
export const blankAnswer={name:'',email:'',phone:'',city:'',role:'',message:'',consent:false};
export const applicationDays=[7,14,30] as const;
export const applicationLimits=[10,50,200] as const;
export type ApplicationContext={title:string;recruiter:string;conditions:JobConditions};
export type ApplicationLink={id:string;job_id:string;context:ApplicationContext;created_at:string;expires_at:string;revoked_at:string|null;max_submissions:number;submission_count:number};
export type CandidateApplication={id:string;link_id:string;job_id:string;job_title:string;response:ApplicationAnswer;file_name:string;file_sha256:string;file_size:number;created_at:string;reviewed_at:string|null;decision:'accepted'|'discarded'|null;import_id:string|null};

export function linkState(link:ApplicationLink,now:number):'ativo'|'cancelado'|'expirado'|'completo'{
 if(link.revoked_at)return 'cancelado';
 if(Date.parse(link.expires_at)<=now)return 'expirado';
 if(link.submission_count>=link.max_submissions)return 'completo';
 return 'ativo';
}

// File names come from the candidate's device: keep only a short, printable label.
export function safeFileName(name:string){const clean=name.normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g,' ').replace(/\s+/g,' ').trim().slice(-120);return clean||'curriculo.pdf';}

const digits=(s:string)=>s.replace(/\D/g,'');
// Hints only: the recruiter decides whether two records are the same person.
export function applicationDuplicates(application:CandidateApplication,candidates:Candidate[]){
 const email=application.response.email.trim().toLowerCase(),phone=digits(application.response.phone),name=normalize(application.response.name).trim();
 return candidates.filter(c=>!c.demo).map(c=>{
  const reasons:string[]=[];
  if(c.fileKey?.endsWith(`/${application.file_sha256}.pdf`))reasons.push('mesmo PDF');
  if(email&&c.email.trim().toLowerCase()===email)reasons.push('mesmo e-mail');
  if(phone.length>=8&&digits(c.phone).endsWith(phone.slice(-8))&&digits(c.phone).length>=8)reasons.push('mesmo telefone');
  if(!reasons.length&&name&&normalize(c.name).trim()===name)reasons.push('mesmo nome');
  return {candidate:c,reasons};
 }).filter(m=>m.reasons.length);
}

// Applied when the accepted application's PDF import completes. Declared contacts win over the
// PDF transcription because the candidate typed them, but they stay unverified.
export function declaredCandidate(candidate:Candidate,application:Pick<CandidateApplication,'response'|'job_title'|'created_at'>,at:string):Candidate{
 const answer=applicationAnswerSchema.parse(application.response);
 const declared={name:answer.name,phone:answer.phone||candidate.phone,email:answer.email||candidate.email,city:answer.city,role:candidate.role||answer.role};
 const fields=(Object.keys(declared) as (keyof typeof declared)[]).filter(k=>declared[k]!==candidate[k]);
 return {...candidate,...declared,source:`Candidatura por link · ${application.job_title}`.slice(0,300),changeLog:[...(candidate.changeLog||[]),{at,fields,confirmed:[],method:`Declarado pelo candidato no link de candidatura em ${application.created_at}`}]};
}
