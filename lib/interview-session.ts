import type {Job} from './domain';
import type {InterviewGuide,InterviewItem} from './interview-guide';
import {interviewItemCurrent} from './interview-guide.ts';

export function interviewSession(guide:InterviewGuide|undefined,job:Job){
 const current:InterviewItem[]=[],previous:InterviewItem[]=[];
 for(const item of guide?.items||[])(interviewItemCurrent(item,job)?current:previous).push(item);
 return {current,previous,answered:current.filter(i=>i.answer.trim()).length};
}
export function nextUnansweredQuestion(items:InterviewItem[],activeId:string){
 const index=items.findIndex(i=>i.id===activeId);
 const ordered=index<0?items:[...items.slice(index+1),...items.slice(0,index)];
 return ordered.find(i=>!i.answer.trim())?.id;
}
