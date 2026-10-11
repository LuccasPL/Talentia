import {z} from 'zod';
import type {Candidate} from './domain';
export const searchConceptSchema=z.object({label:z.string().trim().min(2).max(120),terms:z.array(z.string().trim().min(2).max(80)).min(1).max(8)});
export const searchPlanSchema=z.object({query:z.string().trim().min(10).max(2000),concepts:z.array(searchConceptSchema).min(1).max(8),notes:z.string().trim().max(1500)});
export type SearchPlan=z.infer<typeof searchPlanSchema>;
export const savedSearchSchema=z.object({id:z.string().uuid(),name:z.string().trim().min(2).max(100),plan:searchPlanSchema,mode:z.enum(['any','all']),updated:z.string().datetime()}).superRefine((search,ctx)=>{try{validateSearchPlan(search.plan)}catch(e){ctx.addIssue({code:z.ZodIssueCode.custom,path:['plan'],message:(e as Error).message})}});
export type SavedSearch=z.infer<typeof savedSearchSchema>;
export type SearchMatch={candidateId:string;groups:{label:string;term:string;snippet:string;negated:boolean}[]};
export type SearchDocument={candidateId:string;segments:{original:string;normalized:string}[]};
export const normalizeSearch=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const forbidden=/\b(idade|sexo|genero|raca|etnia|religiao|estado civil|aparencia|deficiencia|orientacao sexual|sem filhos|com filhos|cpf|rg|data de nascimento|nacionalidade)\b/;
export function validateSearchPlan(input:unknown):SearchPlan{
 const plan=searchPlanSchema.parse(input);
 if(plan.concepts.some(c=>[c.label,...c.terms].some(t=>forbidden.test(normalizeSearch(t)))))throw Error('Use experiências e conhecimentos profissionais na busca, sem atributos pessoais protegidos.');
 const concepts=plan.concepts.map(c=>({...c,terms:c.terms.filter((term,i,terms)=>normalizeSearch(term)&&terms.findIndex(t=>normalizeSearch(t)===normalizeSearch(term))===i)}));
 if(concepts.some(c=>!c.terms.length))throw Error('Cada experiência precisa de pelo menos um termo válido.');
 if(new Set(concepts.map(c=>normalizeSearch(c.label))).size!==concepts.length)throw Error('Há experiências repetidas na busca.');
 return {...plan,concepts};
}
export function buildSearchIndex(candidates:Candidate[]):SearchDocument[]{return candidates.map(c=>({candidateId:c.id,segments:[c.role,...c.text.split(/\n|(?<=[.!?;])\s+/)].filter(s=>s.trim()&&!/^\s*(idade|sexo|gênero|genero|raça|raca|religião|religiao|estado civil|cpf|rg|nascimento|data de nascimento|telefone|e-?mail|endere[cç]o|cep)\s*:/i.test(s)).map(original=>({original,normalized:` ${normalizeSearch(original)} `}))}));}
export function findSearchMatches(index:SearchDocument[],plan:SearchPlan,mode:'any'|'all'):Map<string,SearchMatch>{
 const concepts=plan.concepts.map(c=>({...c,terms:c.terms.map(term=>({term,pattern:` ${normalizeSearch(term)} `})).filter(t=>t.pattern.trim())}));
 const matches=new Map<string,SearchMatch>();
 for(const document of index){const groups:SearchMatch['groups']=[];for(const concept of concepts){let found:SearchMatch['groups'][number]|undefined;
  for(const segment of document.segments){for(const {term,pattern} of concept.terms){const pos=segment.normalized.indexOf(pattern);if(pos<0)continue;const preceding=segment.normalized.slice(Math.max(0,pos-100),pos);const negated=/(?:\b(?:nao|sem|nenhuma|nenhum)\b(?:\s+\w+){0,7})\s*$/.test(preceding)||/\bnao\b.*\b(?:informad|mencionad|comprovad)/.test(segment.normalized);const hit={label:concept.label,term,snippet:snippetFor(segment.original,term),negated};if(!found||found.negated&&!negated)found=hit;}if(found&&!found.negated)break;}
  if(found)groups.push(found);
 }if(groups.length&&(mode==='any'||groups.length===concepts.length))matches.set(document.candidateId,{candidateId:document.candidateId,groups});}
 return matches;
}
// Keep a literal source excerpt; normalized character offsets do not map safely to accented source text.
function snippetFor(original:string,term:string){if(original.length<=500)return original;const words=normalizeSearch(term).split(' ');const sourceWords=[...original.matchAll(/[\p{L}\p{N}]+/gu)];let start=0;for(let i=0;i<sourceWords.length;i++){if(words.every((w,n)=>normalizeSearch(sourceWords[i+n]?.[0]||'')===w)){start=Math.max(0,sourceWords[i].index!-140);break;}}return `${start?'…':''}${original.slice(start,start+500)}${start+500<original.length?'…':''}`;}
export function searchOrder(a:SearchMatch|undefined,b:SearchMatch|undefined){const strong=(m:SearchMatch|undefined)=>m?.groups.filter(g=>!g.negated).length||0;return strong(b)-strong(a)||(b?.groups.length||0)-(a?.groups.length||0);}
