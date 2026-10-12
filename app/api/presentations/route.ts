import {presentationRequest,preparePresentation} from '@/lib/client-presentation';
import {owner,readData,checkOrigin,readJson,apiError,HttpError} from '@/lib/server';
import {enforceRateLimit} from '@/lib/rate-limit';
export async function POST(request:Request){try{checkOrigin(request);const id=await owner();await enforceRateLimit('read');const input=presentationRequest.parse(await readJson(request,12000));const data=await readData(id);let presentation;try{presentation=preparePresentation(data,input)}catch(e){throw new HttpError((e as Error).message,data.version!==input.version?409:400)}return Response.json({presentation},{headers:{'Cache-Control':'no-store'}})}catch(e){return apiError(e)}}
