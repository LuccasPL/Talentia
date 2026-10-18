import {checkEvaluations} from './journey-server';
import 'server-only';
import {checkReportReviews} from './report-review-server';
import {HttpError,assertSameOrigin} from './http-security';
export {HttpError,readJson,readForm} from './http-security';
import {aiUserAllowed} from './ai-access';
import {configured,supabase} from './supabase/server';
import {starterJob,type Data,type Candidate,type Job,type RecordData} from './domain';
const validCandidateId=(candidateId:string|undefined):candidateId is string=>typeof candidateId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId);

export async function owner(){if(!configured())throw new HttpError('O acesso ainda está sendo configurado.',503);const {data:{user},error}=await (await supabase()).auth.getUser();if(error||!user)throw new HttpError('Entre na sua conta para acessar este espaço.',401);return user.id}
export async function database(){return supabase()}
export function aiConfigured(id:string){return Boolean(process.env.ANTHROPIC_API_KEY)&&aiUserAllowed(id)}
export function requireAiAccess(id:string){if(!aiUserAllowed(id))throw new HttpError('O uso da IA ainda não foi liberado para esta conta. Solicite acesso ao piloto.',403)}
export function requestOrigin(request:Request){const url=new URL(request.url);const host=request.headers.get('host')||url.host;const protocol=request.headers.get('x-forwarded-proto')||url.protocol.replace(':','');if(protocol!=='https'&&protocol!=='http')throw new HttpError('Origem inválida.',403);return new URL(`${protocol}://${host}`).origin}
export function checkOrigin(request:Request){assertSameOrigin(request,requestOrigin(request))}
export async function readData(id:string,scope:'full'|'overview'='full'):Promise<Data>{
 const db=await database();
 const initial=await db.from('workspaces').select('jobs,records,version,clients').eq('owner',id).maybeSingle();
 let row=initial.data;
 if(initial.error)throw new HttpError('Não foi possível carregar o banco de dados.',503);
 if(!row){
  const first={...starterJob,id:crypto.randomUUID(),title:'Minha primeira vaga',description:'',criteria:[],analyses:[],stage:0};
  const created=await db.from('workspaces').upsert({owner:id,jobs:[first],records:[],version:1},{onConflict:'owner',ignoreDuplicates:true});
  if(created.error)throw new HttpError('Não foi possível criar seu espaço.',503);
  const reloaded=await db.from('workspaces').select('jobs,records,version,clients').eq('owner',id).single();
  row=reloaded.data;
  if(reloaded.error||!row)throw new HttpError('Não foi possível carregar seu espaço.',503);
 }
 const candidates:Candidate[]=[];
 let candidateCount:number|undefined;
 if(scope==='overview'){
  const relatedIds=[...new Set<string>([
   ...row.records.map((record:RecordData)=>record.candidateId),
   ...row.jobs.flatMap((job:Job)=>job.analyses.map(analysis=>analysis.candidateId))
  ])].filter(validCandidateId);
  for(let offset=0;offset<relatedIds.length;offset+=100){
   const result=await db.from('candidates').select('payload').eq('owner',id).in('id',relatedIds.slice(offset,offset+100));
   if(result.error)throw new HttpError('Não foi possível carregar os candidatos acompanhados.',503);
   candidates.push(...result.data.map(candidate=>candidate.payload as Candidate));
  }
  const sourceIds=[...new Set(candidates.map(candidate=>candidate.cvSourceId).filter(validCandidateId))].filter(sourceId=>!candidates.some(candidate=>candidate.id===sourceId));
  for(let offset=0;offset<sourceIds.length;offset+=100){
   const result=await db.from('candidates').select('payload').eq('owner',id).in('id',sourceIds.slice(offset,offset+100));
   if(result.error)throw new HttpError('Não foi possível carregar a origem dos currículos.',503);
   candidates.push(...result.data.map(candidate=>candidate.payload as Candidate));
  }
  const count=await db.from('candidates').select('id',{count:'exact',head:true}).eq('owner',id).is('payload->>mergedInto',null);
  if(count.error)throw new HttpError('Não foi possível contar os candidatos.',503);
  candidateCount=count.count||0;
 }else{
  for(let offset=0;;offset+=500){
   const result=await db.from('candidates').select('payload').eq('owner',id).order('id').range(offset,offset+499);
   if(result.error)throw new HttpError('Não foi possível carregar os candidatos.',503);
   candidates.push(...result.data.map(candidate=>candidate.payload as Candidate));
   if(result.data.length<500)break;
  }
  candidateCount=candidates.filter(candidate=>!candidate.mergedInto).length;
 }
 const data=checkReportReviews(checkEvaluations({clients:row.clients||[],jobs:row.jobs,records:row.records,candidates:candidates.filter(candidate=>!candidate.mergedInto),archivedCandidates:candidates.filter(candidate=>candidate.mergedInto),version:row.version,aiConfigured:aiConfigured(id),candidateCount}));
 const pending=await db.from('candidate_applications').select('id',{count:'exact',head:true}).eq('owner',id).is('reviewed_at',null);
 return {...data,pendingApplications:pending.error?0:pending.count||0};
}
export async function addCandidate(id:string,c:Candidate){const {error}=await (await database()).from('candidates').insert({owner:id,id:c.id,name:c.name,city:c.city,role:c.role,file_key:c.fileKey||null,payload:c});if(error)throw new HttpError('Não foi possível salvar o candidato. O currículo pode já estar cadastrado.',409)}
export function apiError(e:unknown){if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status,headers:{'Cache-Control':'no-store',...(e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})}});if(e instanceof Error&&e.name==='ZodError')return Response.json({error:'Confira os campos: há informações inválidas ou muito longas.'},{status:400});console.error('Talentia request failed',e instanceof Error?e.name:'unknown');return Response.json({error:'Não foi possível concluir. Seus dados não foram descartados; tente novamente.'},{status:500})}
