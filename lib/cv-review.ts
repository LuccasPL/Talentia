import type {Candidate,Data} from './domain.ts';
import {normalizeSearch} from './assisted-search.ts';
export type CvReviewItem={candidate:Candidate;source:Candidate|undefined;issues:string[];changed:boolean};
export function cvSource(candidate:Candidate,profiles:Map<string,Candidate>){return candidate.cvSourceId?profiles.get(candidate.cvSourceId):candidate;}
export function cvReviewItems(data:Data):CvReviewItem[]{const profiles=new Map([...data.candidates,...(data.archivedCandidates||[])].map(c=>[c.id,c]));return data.candidates.filter(c=>!c.mergedInto&&(c.fileKey||c.cvSourceId)).map(candidate=>{const source=cvSource(candidate,profiles),issues:string[]=[];
 if(!candidate.name.trim())issues.push('Nome não informado');if(!candidate.role.trim())issues.push('Função não informada');if(!candidate.city.trim())issues.push('Cidade não informada');if(!candidate.phone.trim()&&!candidate.email.trim())issues.push('Sem telefone ou e-mail');if(candidate.text.trim().length<200)issues.push('Texto curto: confira experiências e formação');if(!source?.fileKey)issues.push('PDF de origem indisponível no cadastro');
 const original=source?.originalText??source?.text;return {candidate,source,issues,changed:original!==undefined&&original!==candidate.text};
 }).sort((a,b)=>b.issues.length-a.issues.length||a.candidate.name.localeCompare(b.candidate.name,'pt-BR'));}
export function filterCvReview(items:CvReviewItem[],query:string,onlyIssues:boolean){const terms=normalizeSearch(query).split(' ').filter(Boolean);return items.filter(i=>(!onlyIssues||i.issues.length>0)&&terms.every(t=>normalizeSearch(`${i.candidate.name} ${i.candidate.role} ${i.source?.source||i.candidate.source}`).includes(t)));}
