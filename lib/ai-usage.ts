import {z} from 'zod';

export const aiTasks=['pdf-extraction','criteria','assisted-search','candidate-analysis'] as const;
export type AiTask=typeof aiTasks[number];
export const aiTaskLabels:Record<AiTask,string>={
 'pdf-extraction':'Leitura de currículo',
 criteria:'Organização de critérios',
 'assisted-search':'Sugestão de busca',
 'candidate-analysis':'Comparação com a vaga'
};
export const aiUsageSummarySchema=z.object({
 generatedAt:z.string().datetime({offset:true}),
 windowDays:z.number().int().positive(),
 entries:z.array(z.object({
  task:z.enum(aiTasks),model:z.string().min(1).max(100),batch:z.boolean(),
  calls:z.number().int().nonnegative(),inputTokens:z.number().int().nonnegative(),
  outputTokens:z.number().int().nonnegative(),cacheReadTokens:z.number().int().nonnegative(),
  cacheWriteTokens:z.number().int().nonnegative()
 })).max(100)
});
export type AiUsageSummary=z.infer<typeof aiUsageSummarySchema>;
export type AiUsageEntry=AiUsageSummary['entries'][number];

type Rates={input:number;output:number;cacheRead:number;cacheWrite:number;batchInput?:number;batchOutput?:number};
const RATES_PER_MILLION:Record<string,Rates>={
 'claude-sonnet-5-5':{input:2,output:10,cacheRead:.1,cacheWrite:2.5,batchInput:1,batchOutput:5},
 'claude-haiku-5-5':{input:.1,output:.5,cacheRead:.01,cacheWrite:.125,batchInput:.05,batchOutput:.25}
};
export function estimatedCostUsd(entry:AiUsageEntry):number|null{
 const rates=RATES_PER_MILLION[entry.model];
 if(!rates)return null;
 const inputRate=entry.batch?(rates.batchInput??rates.input):rates.input;
 const outputRate=entry.batch?(rates.batchOutput??rates.output):rates.output;
 const cachedRate=entry.batch?inputRate*.1:rates.cacheRead;
 const cacheWriteRate=entry.batch?inputRate*1.25:rates.cacheWrite;
 return (entry.inputTokens*inputRate+entry.outputTokens*outputRate+entry.cacheReadTokens*cachedRate+entry.cacheWriteTokens*cacheWriteRate)/1_000_000;
}
