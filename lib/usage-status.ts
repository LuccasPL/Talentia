import {z} from 'zod';
export const usageBuckets=['read','write','imports-read','imports-sync','upload','ai-request','ai-call','export'] as const;
export const usageSnapshotSchema=z.object({generatedAt:z.string().datetime({offset:true}),limits:z.array(z.object({bucket:z.enum(usageBuckets),windowSeconds:z.number().int().positive(),limit:z.number().int().positive(),used:z.number().int().nonnegative(),remaining:z.number().int().nonnegative(),resetsAt:z.string().datetime({offset:true})})).min(1).max(20)});
export type UsageSnapshot=z.infer<typeof usageSnapshotSchema>;
export type UsageLimit=UsageSnapshot['limits'][number];
export function usageLabel(limit:UsageLimit){
 const labels:Record<UsageLimit['bucket'],string>={read:'Consulta de dados e currículos',write:'Salvar e editar dados','imports-read':'Histórico de importações','imports-sync':'Conferir processamento',upload:'Envio de PDFs','ai-request':'Organizar critérios e comparar perfis','ai-call':limit.windowSeconds===86400?'Chamadas à IA por dia':'Chamadas à IA por hora',export:'Exportação de candidatos'};
 return labels[limit.bucket];
}
export function usagePercent(limit:UsageLimit){return Math.max(0,Math.min(100,Math.round(limit.used/limit.limit*100)));}
export function effectiveAiRemaining(limits:UsageLimit[]){const calls=limits.filter(l=>l.bucket==='ai-call');return calls.length?Math.min(...calls.map(l=>l.remaining)):0;}
export function renewalLabel(value:string){return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value));}
