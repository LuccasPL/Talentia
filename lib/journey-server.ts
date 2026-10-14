import {triageSource} from './candidate-triage';
import 'server-only';
import {createHash} from 'node:crypto';
import type {Data,RecordData} from './domain';
import {evaluationSource} from './recruitment-journey';
export function evaluationHash(data:Data,record:RecordData){const c=data.candidates.find(c=>c.id===record.candidateId),j=data.jobs.find(j=>j.id===record.jobId);return c&&j?createHash('sha256').update(evaluationSource(c,j,record)).digest('hex'):null;}
export function triageHash(data:Data,record:RecordData){const c=data.candidates.find(c=>c.id===record.candidateId),j=data.jobs.find(j=>j.id===record.jobId);return c&&j?createHash('sha256').update(triageSource(c,j)).digest('hex'):null;}
export function checkEvaluations(data:Data):Data{const candidates=new Map(data.candidates.map(c=>[c.id,c])),jobs=new Map(data.jobs.map(j=>[j.id,j]));return {...data,records:data.records.map(r=>{const c=candidates.get(r.candidateId),j=jobs.get(r.jobId);const evaluationHash=r.evaluation&&c&&j?createHash('sha256').update(evaluationSource(c,j,r)).digest('hex'):null;const triageHash=r.triage&&c&&j?createHash('sha256').update(triageSource(c,j)).digest('hex'):null;return {...r,evaluationNeedsReview:Boolean(r.evaluation&&r.evaluation.sourceHash!==evaluationHash),triageNeedsReview:Boolean(r.triage&&r.triage.sourceHash!==triageHash)};})};}
export {preserveJourney} from './recruitment-journey';
