import type {AiTask} from './ai-usage';

const DEFAULT_MODEL_BY_TASK:Record<AiTask,string>={
 'pdf-extraction':'claude-haiku-5-5',
 criteria:'claude-haiku-5-5',
 'assisted-search':'claude-haiku-5-5',
 'candidate-analysis':'claude-sonnet-5-5'
};
const MODEL_ENV_BY_TASK:Record<AiTask,string>={
 'pdf-extraction':'ANTHROPIC_MODEL_EXTRACTION',
 criteria:'ANTHROPIC_MODEL_CRITERIA',
 'assisted-search':'ANTHROPIC_MODEL_SEARCH',
 'candidate-analysis':'ANTHROPIC_MODEL_ANALYSIS'
};

export function modelForTask(task:AiTask){
 const selected=process.env[MODEL_ENV_BY_TASK[task]]?.trim();
 if(selected)return selected;
 if(task==='candidate-analysis'&&process.env.ANTHROPIC_MODEL?.trim())return process.env.ANTHROPIC_MODEL.trim();
 return DEFAULT_MODEL_BY_TASK[task];
}
