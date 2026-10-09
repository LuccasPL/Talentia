import {candidateSchema} from '@/lib/validation';
import {owner,readData,addCandidate,checkOrigin,apiError} from '@/lib/server';
export async function POST(request:Request){try{checkOrigin(request);const id=await owner();const body=await request.json() as {candidate:unknown};const candidate=candidateSchema.parse(body.candidate);candidate.demo=false;delete candidate.fileKey;candidate.updated=new Date().toISOString();candidate.id=crypto.randomUUID();await readData(id);await addCandidate(id,candidate);return Response.json(await readData(id))}catch(e){return apiError(e)}}
