import type {Candidate,Job,RecordData} from './domain';
export type InterviewItem={id:string;criterionId:string;criterionText:string;kind:'experiencia'|'condicao'|'entrevista'|'geral';question:string;answer:string;observation:string};
export type InterviewGuide={candidateRevision:string;preparedAt:string;updated:string;items:InterviewItem[]};
export function interviewItemCurrent(item:InterviewItem,job:Job){return item.kind==='geral'||job.criteria.some(c=>c.id===item.criterionId&&c.text===item.criterionText&&c.kind===item.kind);}
export function prepareInterviewGuide(candidate:Candidate,job:Job,previous:InterviewGuide|undefined,at:string):InterviewGuide{
 if(!job.criteria.length)throw Error('Revise os critérios da vaga antes de preparar o roteiro.');
 const protectedTerms=/\b(idade|sexo|estado civil|religião|religiao|raça|raca|etnia|gênero|genero|orientação sexual|orientacao sexual|aparência|aparencia|sem filhos|com filhos)\b/i;
 if(job.criteria.some(c=>protectedTerms.test(c.text)))throw Error('Revise os critérios: use experiências, competências e condições de trabalho.');
 const evidence=job.analyses.find(a=>a.candidateId===candidate.id)?.evidence||[];
 const items:InterviewItem[]=previous?structuredClone(previous.items):[];
 const sorted=job.criteria.slice().sort((a,b)=>Number(evidence.find(e=>e.criterionId===b.id)?.status!=='encontrada')-Number(evidence.find(e=>e.criterionId===a.id)?.status!=='encontrada'));
 for(const criterion of sorted){
  if(items.some(i=>i.criterionId===criterion.id&&i.criterionText===criterion.text&&i.kind===criterion.kind))continue;
  const suggested=evidence.find(e=>e.criterionId===criterion.id)?.question?.trim();
  const question=criterion.kind==='entrevista'?`Conte uma situação relacionada a “${criterion.text}”. O que você fez e qual foi o resultado?`:criterion.kind==='condicao'?`Sobre “${criterion.text}”: como isso se encaixa na sua disponibilidade e quais pontos precisamos combinar?`:`Pode contar uma experiência relacionada a “${criterion.text}”, descrevendo suas atividades e um exemplo concreto?`;
  items.push({id:crypto.randomUUID(),criterionId:criterion.id,criterionText:criterion.text,kind:criterion.kind,question:suggested&&!protectedTerms.test(suggested)?suggested:question,answer:'',observation:''});
 }
 for(const [id,question] of [['interest','Depois de conhecer os detalhes, o que desperta seu interesse nesta oportunidade e quais dúvidas você tem?'],['availability','Qual é a sua disponibilidade para iniciar e conversar sobre as condições da vaga?']] as const){
  if(!items.some(i=>i.kind==='geral'&&i.criterionId===id))items.push({id:crypto.randomUUID(),criterionId:id,criterionText:'Conversa inicial',kind:'geral',question,answer:'',observation:''});
 }
 if(items.length>60)throw Error('Este roteiro atingiu o limite de histórico. Preserve as respostas e prepare um novo registro em outra vaga.');
 return {candidateRevision:candidate.editedAt||candidate.updated,preparedAt:at,updated:previous?.updated||'',items};
}
export function interviewSummary(guide:InterviewGuide|undefined,job?:Job){
 const answered=guide?.items.filter(i=>i.answer.trim()||i.observation.trim())||[];
 if(!answered.length)return '';
 return 'ENTREVISTA — REGISTROS DA RECRUTADORA\nRespostas declaradas na conversa; não são evidências documentais nem confirmação automática.\n\n'+answered.map(i=>`${i.criterionText}${job&&!interviewItemCurrent(i,job)?' (critério anterior, alterado ou removido)':''}\nPergunta: ${i.question}\nResposta registrada: ${i.answer.trim()||'Sem resposta registrada.'}${i.observation.trim()?`\nObservação da recrutadora: ${i.observation.trim()}`:''}`).join('\n\n');
}
export function recordInterview(stored:RecordData,guide:InterviewGuide,at:string):RecordData{
 const changed=interviewSummary(stored.interview)!==interviewSummary(guide);
 return {...stored,interview:{...guide,updated:at},reportNeedsReview:stored.reportNeedsReview||Boolean(changed&&stored.report),events:[...stored.events,{at,text:'Roteiro e registros de entrevista salvos · Sem confirmação automática'}]};
}
