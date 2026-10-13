import type {Candidate} from './domain';
import type {MergeChoices} from './candidate-duplicates';
export function curriculumPending(candidate:Candidate){return !candidate.demo&&!candidate.fileKey&&!candidate.cvSourceId&&candidate.source==='Cadastro manual';}
export function attachmentChoices(candidate:Candidate):MergeChoices{return {name:'primary',role:candidate.role?'primary':'secondary',city:candidate.city?'primary':'secondary',phone:candidate.phone?'primary':'secondary',email:candidate.email?'primary':'secondary',text:'secondary'};}
